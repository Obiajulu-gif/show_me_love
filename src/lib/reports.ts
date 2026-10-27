import { db } from "./db";
import { hit } from "./ratelimit";

export class ReportError extends Error {}

export const REPORT_REASONS = ["spam", "impersonation", "scam", "inappropriate", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export async function submitReport(
  i: { username: string; reason: string; details?: string; reporterEmail?: string },
  ip: string,
): Promise<void> {
  const username = String(i.username ?? "").trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new ReportError("That page name doesn't look right.");
  if (!REPORT_REASONS.includes(i.reason as ReportReason)) throw new ReportError("Pick a reason.");
  const details = String(i.details ?? "").trim();
  if (details.length > 1000) throw new ReportError("Keep the details under 1000 characters.");
  const email = String(i.reporterEmail ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ReportError("That email doesn't look right.");
  if (!(await hit(`report:${ip}`, 5, 3600))) throw new ReportError("Too many reports. Try again later.");
  await db()`insert into reports (username, reason, details, reporter_email)
    values (${username}, ${i.reason}, ${details || null}, ${email || null})`;
}
