import { NextResponse } from "next/server";

import { handleRasEvent } from "@/lib/payments";
import { webhookKey } from "@/lib/ras";
import { decryptWebhook } from "@/lib/webhookCrypto";

export async function POST(req: Request) {
  const key = webhookKey();
  if (!key) return new NextResponse(null, { status: 404 });
  const b = await req.json().catch(() => null);
  const iv = req.headers.get("x-api-key");
  const event = b && typeof b.hash === "string" && iv ? decryptWebhook(b.hash, iv, key) : null;
  if (!event) return NextResponse.json({ error: "Bad webhook body." }, { status: 400 });
  try {
    await handleRasEvent(event);
  } catch (e) {
    console.error("webhook failed", event.event_id, e instanceof Error ? e.message : e); // never log the payload (customer email)
    return NextResponse.json({ error: "Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
