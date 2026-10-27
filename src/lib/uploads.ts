import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_BYTES = 4 * 1024 * 1024; // Vercel function bodies cap near 4.5 MB

/** Identify the image from its leading bytes; the client-declared MIME type is not trusted. */
function sniff(b: Uint8Array): { ext: string; type: string } | null {
  const at = (o: number, sig: number[]) => sig.every((v, i) => b[o + i] === v);
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: "png", type: "image/png" };
  if (at(0, [0xff, 0xd8, 0xff])) return { ext: "jpg", type: "image/jpeg" };
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return { ext: "webp", type: "image/webp" };
  return null;
}

/** Validates content + size, stores the file and returns its public URL. Blob when a token is set, public/uploads in dev. */
export async function saveUpload(file: File, kind: "avatar" | "cover"): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("Images must be 4 MB or smaller.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kindOf = sniff(bytes);
  if (!kindOf) throw new Error("Use a PNG, JPEG or WebP image.");
  const { ext, type } = kindOf;
  const name = `${kind}-${randomUUID()}.${ext}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    return (await put(`uploads/${name}`, Buffer.from(bytes), { access: "public", contentType: type })).url;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Uploads are not configured: set BLOB_READ_WRITE_TOKEN.");
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  return `/uploads/${name}`;
}
