import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX = { avatar: 10, cover: 5 } as const;

/** Validates type + size, stores the file and returns its public URL. Blob when a token is set, public/uploads in dev. */
export async function saveUpload(file: File, kind: "avatar" | "cover"): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new Error("Use a PNG, JPEG or WebP image.");
  if (file.size > MAX[kind] * 1024 * 1024) throw new Error(`That image is too big. The limit is ${MAX[kind]} MB.`);
  const name = `${kind}-${randomUUID()}.${ext}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    return (await put(`uploads/${name}`, file, { access: "public", contentType: file.type })).url;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Uploads are not configured: set BLOB_READ_WRITE_TOKEN.");
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}
