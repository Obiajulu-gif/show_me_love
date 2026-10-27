import { db } from "./db";

export type PublicWallEntry = { id: string; name: string; message: string; quantity: number; at: Date };

/** Newest first: successful, public payments that carry a message. */
export async function publicWall(creatorId: string, limit = 20): Promise<PublicWallEntry[]> {
  const rows = await db()`
    select ref, supporter_name, message, quantity, coalesce(completed_at, created_at) as at from payments
    where creator_id = ${creatorId} and status = 'successful' and is_public and coalesce(message, '') <> ''
    order by coalesce(completed_at, created_at) desc limit ${limit}`;
  return rows.map((r) => ({ id: r.ref, name: r.supporter_name?.trim() || "Someone", message: r.message, quantity: r.quantity, at: r.at }));
}
