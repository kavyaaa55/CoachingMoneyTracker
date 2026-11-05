import { readToken, signToken } from "./signing";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60_000;

type SessionPayload = { userId: string; expiresAt: number };

export const signSession = (payload: SessionPayload, secret: string) =>
  signToken(payload, `${secret}:session`);

/** Returns the user id, or null if the token is forged, malformed or expired. */
export function readSession(token: string, secret: string, now: number): string | null {
  const payload = readToken(token, `${secret}:session`) as Partial<SessionPayload> | null;
  if (typeof payload?.userId !== "string" || typeof payload.expiresAt !== "number") return null;
  return payload.expiresAt > now ? payload.userId : null;
}
