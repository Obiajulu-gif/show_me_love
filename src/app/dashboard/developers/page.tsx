import { redirect } from "next/navigation";

import { DevelopersManager } from "@/components/DevelopersManager";
import { listApps } from "@/lib/connect";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Developers({ searchParams }: { searchParams: Promise<{ guide?: string }> }) {
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  const apps = (await listApps(uid)).map((a) => ({
    id: a.id, name: a.name, mode: a.mode, redirectUris: a.redirectUris, clientId: a.clientId,
    keys: a.keys.filter((k) => !k.revokedAt).map((k) => ({ id: k.id, prefix: k.prefix, last4: k.last4, createdAt: k.createdAt.toISOString() })),
  }));
  const guide = (await searchParams).guide === "open";
  return <DevelopersManager apps={apps} origin={(process.env.PUBLIC_APP_URL ?? "").replace(/\/$/, "")} guide={guide} />;
}
