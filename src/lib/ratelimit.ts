import { db } from "./db";

/** Fixed-window counter. True when this hit is within `limit`. */
export async function hit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const [r] = await db()`
    insert into rate_limits (key, window_start, count)
    values (${key}, to_timestamp(floor(extract(epoch from now()) / ${windowSec}) * ${windowSec}), 1)
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count`;
  return r.count <= limit;
}
