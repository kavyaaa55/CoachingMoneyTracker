import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_PER_WINDOW = 5;
export const OTP_WINDOW_MS = 10 * 60_000;

export type OtpState = "usable" | "expired" | "locked";

/** Accepts common ways of typing an Indian mobile number. Returns +91XXXXXXXXXX or null. */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

export const isOtpFormat = (code: string) => /^\d{6}$/.test(code);

export const generateOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export const hashOtp = (phone: string, code: string, secret: string) =>
  createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");

export function otpMatches(storedHash: string, submittedHash: string): boolean {
  const stored = Buffer.from(storedHash);
  const submitted = Buffer.from(submittedHash);
  return stored.length === submitted.length && timingSafeEqual(stored, submitted);
}

export function otpState(record: { expiresAt: Date; attempts: number }, now: Date): OtpState {
  if (record.attempts >= OTP_MAX_ATTEMPTS) return "locked";
  return now.getTime() >= record.expiresAt.getTime() ? "expired" : "usable";
}
