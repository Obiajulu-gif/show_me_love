import { db } from "./db";

/** Read-only views for the admin console. Money is USDT as text; counts are numbers. */

export async function platformStats() {
  const [r] = await db()`
    select
      (select count(*) from users)::int as users,
      (select count(*) from users where created_at > now() - interval '7 days')::int as users7,
      (select count(*) from users where role = 'admin')::int as admins,
      (select count(*) from creators)::int as creators,
      (select count(*) from creators where created_at > now() - interval '7 days')::int as creators7,
      (select count(*) from payments where status = 'successful')::int as ok,
      (select coalesce(sum(received_usdt), 0)::text from payments where status = 'successful') as received,
      (select coalesce(sum(received_usdt), 0)::text from payments where status = 'successful' and completed_at > now() - interval '7 days') as received7,
      (select count(*) from payments where status = 'pending')::int as pending,
      (select count(*) from payments where status in ('failed','expired') and created_at > now() - interval '7 days')::int as failed7,
      (select coalesce(-sum(amount_usdt), 0)::text from ledger_entries where kind = 'fee') as fees,
      (select coalesce(sum(amount_usdt), 0)::text from ledger_entries) as owed,
      (select count(*) from withdrawals where status = 'awaiting_review')::int as review,
      (select count(*) from withdrawals where status = 'processing')::int as processing,
      (select coalesce(sum(amount_usdt), 0)::text from withdrawals where status = 'paid') as paid,
      (select count(*) from reports where resolved_at is null)::int as reports`;
  return {
    users: { total: r.users, new7d: r.users7, admins: r.admins },
    creators: { total: r.creators, new7d: r.creators7 },
    payments: { successful: r.ok, receivedUsdt: r.received, received7dUsdt: r.received7, pending: r.pending, failed7d: r.failed7 },
    feesUsdt: r.fees,
    owedUsdt: r.owed,
    withdrawals: { awaitingReview: r.review, processing: r.processing, paidUsdt: r.paid },
    openReports: r.reports,
  };
}

export const ACTIVITY_KINDS = ["signup", "page", "payment", "withdrawal", "report"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export type ActivityItem = { at: Date; kind: ActivityKind; title: string; detail: string; tone: "good" | "bad" | "warn" | "plain"; href: string };

const naira = (v: unknown) => (v == null ? "" : `₦${Number(v).toLocaleString("en-NG")}`);
const usdt = (v: unknown) => (v == null ? "" : `${Number(v).toFixed(2)} USDT`);

/** One newest-first feed. Pending checkouts are left out: they are noise until they settle or fail. */
export async function activity({ limit = 50, kind }: { limit?: number; kind?: ActivityKind }): Promise<ActivityItem[]> {
  const sql = db();
  const rows = await sql`
    select * from (
      select created_at as at, 'signup' as kind, email::text as a, role as b, null::text as c, null::numeric as n1, null::numeric as n2, null::text as st, null::text as ref from users
      union all
      select created_at, 'page', username::text, display_name, null, unit_price_ngn, null, null, null from creators
      union all
      select coalesce(p.completed_at, p.created_at), 'payment', coalesce(nullif(p.supporter_name, ''), 'Someone'), c.username::text, p.kind, p.amount_ngn,
             coalesce(p.received_usdt, p.amount_usdt), p.status, p.ref
        from payments p left join creators c on c.user_id = p.creator_id where p.status <> 'pending'
      union all
      select w.created_at, 'withdrawal', c.username::text, w.method, 'requested', w.amount_ngn, w.amount_usdt, 'requested', w.id::text
        from withdrawals w join creators c on c.user_id = w.creator_id
      union all
      select w.updated_at, 'withdrawal', c.username::text, w.method, 'settled', w.amount_ngn, w.amount_usdt, w.status, w.id::text
        from withdrawals w join creators c on c.user_id = w.creator_id where w.status in ('paid','rejected','failed')
      union all
      select created_at, 'report', username, reason, details, null, null, case when resolved_at is null then 'open' else 'resolved' end, id::text from reports
    ) feed
    ${kind ? sql`where kind = ${kind}` : sql``}
    order by at desc limit ${Math.min(Math.max(limit, 1), 200)}`;
  return rows.map((r) => item(r));
}

function item(r: Record<string, any>): ActivityItem {
  const at = new Date(r.at);
  switch (r.kind as ActivityKind) {
    case "signup":
      return { at, kind: "signup", title: `${r.a} signed up`, detail: r.b === "admin" ? "Admin" : "New account", tone: "plain", href: `/admin/users?q=${encodeURIComponent(r.a)}` };
    case "page":
      return { at, kind: "page", title: `@${r.a} went live`, detail: `${r.b || r.a}, ${naira(r.n1)} per treat`, tone: "good", href: `/@${r.a}` };
    case "payment": {
      const to = r.b ? `@${r.b}` : r.c === "group" ? "a group" : "a creator";
      const ok = r.st === "successful";
      return {
        at, kind: "payment", tone: ok ? "good" : r.st === "refunded" ? "warn" : "bad",
        title: ok ? `${r.a} sent ${to} ${naira(r.n1)}` : `${r.a} → ${to}: payment ${r.st}`,
        detail: `${usdt(r.n2)}${r.c !== "treat" ? `, ${r.c}` : ""}`, href: `/admin/payments?q=${r.ref}`,
      };
    }
    case "withdrawal": {
      const how = r.b === "ngn_bank" ? "to bank" : "in USDT";
      const requested = r.c === "requested";
      return {
        at, kind: "withdrawal", href: "/admin/withdrawals",
        tone: requested ? "warn" : r.st === "paid" ? "good" : "bad",
        title: requested ? `@${r.a} asked to withdraw ${usdt(r.n2)} ${how}` : `Withdrawal for @${r.a} ${r.st}`,
        detail: requested ? (r.n1 ? naira(r.n1) : "") : usdt(r.n2),
      };
    }
    default:
      return { at, kind: "report", title: `@${r.a} reported: ${r.b}`, detail: r.st === "open" ? "Open" : "Resolved", tone: r.st === "open" ? "bad" : "plain", href: "/admin/reports" };
  }
}

export type UserRow = {
  id: string; email: string; role: string; joined: Date; username: string | null; displayName: string | null;
  receivedUsdt: string; balanceUsdt: string; treats: number; lastTreat: Date | null;
};

/** Everyone who registered, with their page and earnings. `q` matches email or username, case-insensitive. */
export async function listUsers({ q = "", limit = 50, offset = 0 }: { q?: string; limit?: number; offset?: number }) {
  const sql = db();
  const s = q.trim();
  const where = s ? sql`where u.email ilike ${"%" + s + "%"} or c.username ilike ${"%" + s + "%"}` : sql``;
  const [{ n }] = await sql`select count(*)::int as n from users u left join creators c on c.user_id = u.id ${where}`;
  const rows = await sql`
    select u.id, u.email::text, u.role, u.created_at, c.username::text, c.display_name,
      coalesce((select sum(amount_usdt) from ledger_entries l where l.creator_id = u.id and (l.kind = 'credit' or (l.kind = 'reversal' and l.ref like 'rev:%'))), 0)::text as received,
      coalesce((select sum(amount_usdt) from ledger_entries l where l.creator_id = u.id), 0)::text as balance,
      (select count(*) from payments p where p.creator_id = u.id and p.status = 'successful')::int as treats,
      (select max(completed_at) from payments p where p.creator_id = u.id and p.status = 'successful') as last_treat
    from users u left join creators c on c.user_id = u.id
    ${where}
    order by u.created_at desc, u.email
    limit ${Math.min(Math.max(limit, 1), 200)} offset ${Math.max(offset, 0)}`;
  return {
    total: n as number,
    rows: rows.map((r): UserRow => ({
      id: r.id, email: r.email, role: r.role, joined: new Date(r.created_at), username: r.username ?? null, displayName: r.display_name ?? null,
      receivedUsdt: r.received, balanceUsdt: r.balance, treats: r.treats, lastTreat: r.last_treat ? new Date(r.last_treat) : null,
    })),
  };
}

export const PAYMENT_STATUSES = ["successful", "pending", "failed", "expired", "refunded"] as const;

/** Newest payments for the payments page when nothing is searched. Same columns as searchPayments. */
export async function recentPayments({ status, limit = 50 }: { status?: string; limit?: number }) {
  const sql = db();
  const ok = (PAYMENT_STATUSES as readonly string[]).includes(status ?? "");
  return await sql`
    select p.ref, p.kind, p.status, p.supporter_name, p.supporter_email, p.amount_ngn, p.amount_usdt, p.received_usdt, p.refund_address,
           p.created_at, c.username::text as username
    from payments p left join creators c on c.user_id = p.creator_id
    ${ok ? sql`where p.status = ${status!}` : sql``}
    order by p.created_at desc limit ${Math.min(Math.max(limit, 1), 200)}`;
}
