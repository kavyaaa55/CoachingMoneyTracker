import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60_000;

type SessionPayload = { userId: string; expiresAt: number };

const signature = (body: string, secret: string) =>
  createHmac("sha256", secret).update(body).digest("base64url");

export function signSession(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signature(body, secret)}`;
}

/** Returns the user id, or null if the token is forged, malformed or expired. */
export function readSession(token: string, secret: string, now: number): string | null {
  const [body, given, extra] = token.split(".");
  if (!body || !given || extra !== undefined) return null;

  const expected = Buffer.from(signature(body, secret));
  const actual = Buffer.from(given);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    return payload.expiresAt > now ? payload.userId : null;
  } catch {
    return null;
  }
}
