import { NextResponse } from "next/server";

import { listCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ treats: await listCatalog() });
}
