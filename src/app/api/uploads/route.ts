import { NextResponse } from "next/server";

import { requireUser, Unauthorized } from "@/lib/session";
import { saveUpload } from "@/lib/uploads";

export async function POST(req: Request) {
  try {
    await requireUser();
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    const kind = form?.get("kind");
    if (!(file instanceof File) || (kind !== "avatar" && kind !== "cover")) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
    return NextResponse.json({ ok: true, url: await saveUpload(file, kind) });
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof Error && /^(Use a PNG|Images must be)/.test(e.message)) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
