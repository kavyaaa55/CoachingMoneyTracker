import { lt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { rateLimits } from "@/db/schema";

/** Generous, because a whole coaching centre can share one address. */
export const IP_LIMIT = { requests: 30, windowMs: 10 * 60_000 };

const DAY_MS = 86_400_000;

/**
 * Counts one hit and says whether it is within the limit. It lives in Postgres, in one atomic
 * statement, so the limit holds across parallel requests and across several app servers.
 */
export async function withinLimit(
  key: string,
  { requests, windowMs } = IP_LIMIT,
  now = new Date(),
): Promise<boolean> {
  const expired = sql`${rateLimits.windowStart} < ${new Date(now.getTime() - windowMs).toISOString()}::timestamptz`;

  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart: now, hits: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        hits: sql`case when ${expired} then 1 else ${rateLimits.hits} + 1 end`,
        windowStart: sql`case when ${expired} then ${now.toISOString()}::timestamptz else ${rateLimits.windowStart} end`,
      },
    })
    .returning({ hits: rateLimits.hits });

  return row.hits <= requests;
}

export const forgetOldLimits = (now = new Date()) =>
  db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now.getTime() - DAY_MS)));

/** The address our own proxy saw. The last entry is the one a client cannot forge. */
export async function clientIp() {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return forwarded || store.get("x-real-ip") || "unknown";
}
