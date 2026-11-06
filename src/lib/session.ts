import { readToken, signToken } from "./signing";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60_000;

type SessionPayload = { userId: string; version: number; expiresAt: number };

export const signSession = (payload: SessionPayload, secret: string) =>
  signToken(payload, `${secret}:session`);

/** Returns who the token is for, or null if it is forged, malformed or expired. */
export function readSession(token: string, secret: string, now: number) {
  const payload = readToken(token, `${secret}:session`) as Partial<SessionPayload> | null;
  if (
    typeof payload?.userId !== "string" ||
    typeof payload.expiresAt !== "number" ||
    typeof payload.version !== "number"
  ) {
    return null;
  }
  return payload.expiresAt > now ? { userId: payload.userId, version: payload.version } : null;
}
