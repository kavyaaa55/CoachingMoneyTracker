import { and, count, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { otpCodes, users } from "@/db/schema";
import {
  generateOtp,
  hashOtp,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_PER_WINDOW,
  OTP_TTL_MS,
  OTP_WINDOW_MS,
  otpMatches,
  otpState,
} from "@/domain/otp";
import { env } from "./env";

export type RequestResult = { status: "sent"; code: string | null } | { status: "rate-limited" };
export type VerifyResult = "ok" | "wrong" | "expired" | "locked";

/**
 * Unknown numbers get the same "sent" result, so this cannot be used to find out who is
 * registered. The SMS is mocked: the caller shows the code on screen in demo mode.
 */
export async function requestOtp(phone: string, now = new Date()): Promise<RequestResult> {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone));
  if (!user) return { status: "sent", code: null };

  const since = new Date(now.getTime() - OTP_WINDOW_MS);
  const code = generateOtp();

  const allowed = await db.transaction(async (tx) => {
    // One request per number at a time, so parallel requests cannot all pass the limit.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${phone}))`);

    const [recent] = await tx
      .select({ total: count() })
      .from(otpCodes)
      .where(and(eq(otpCodes.phone, phone), gte(otpCodes.createdAt, since)));
    if (recent.total >= OTP_MAX_PER_WINDOW) return false;

    await tx
      .update(otpCodes)
      .set({ consumedAt: now })
      .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt)));
    await tx.insert(otpCodes).values({
      phone,
      codeHash: hashOtp(phone, code, env.SESSION_SECRET),
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      createdAt: now,
    });
    return true;
  });

  return allowed ? { status: "sent", code } : { status: "rate-limited" };
}

export async function verifyOtp(
  phone: string,
  code: string,
  now = new Date(),
): Promise<VerifyResult> {
  const [record] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!record) return "wrong";

  const state = otpState(record, now);
  if (state !== "usable") return state;

  // Count the attempt first, in one statement, so parallel guesses cannot beat the limit.
  const counted = await db
    .update(otpCodes)
    .set({ attempts: sql`${otpCodes.attempts} + 1` })
    .where(
      and(
        eq(otpCodes.id, record.id),
        isNull(otpCodes.consumedAt),
        lt(otpCodes.attempts, OTP_MAX_ATTEMPTS),
      ),
    )
    .returning({ id: otpCodes.id });
  if (counted.length === 0) return "locked";

  if (!otpMatches(record.codeHash, hashOtp(phone, code, env.SESSION_SECRET))) return "wrong";

  const consumed = await db
    .update(otpCodes)
    .set({ consumedAt: now })
    .where(and(eq(otpCodes.id, record.id), isNull(otpCodes.consumedAt)))
    .returning({ id: otpCodes.id });

  return consumed.length === 1 ? "ok" : "wrong";
}
