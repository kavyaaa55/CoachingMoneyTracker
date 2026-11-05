import { readToken, signToken } from "./signing";

export const PAY_LINK_TTL_MS = 7 * 24 * 60 * 60_000;

type PayLink = { instalmentId: string; expiresAt: number };

/** A signed link for one instalment. It shows no student data, so it is safe in a message. */
export function createPayLink(instalmentId: string, now: number, secret: string): string {
  const payload: PayLink = { instalmentId, expiresAt: now + PAY_LINK_TTL_MS };
  return `/gateway/${signToken(payload, `${secret}:pay-link`)}`;
}

export function readPayLink(token: string, now: number, secret: string): string | null {
  const payload = readToken(token, `${secret}:pay-link`) as Partial<PayLink> | null;
  if (typeof payload?.instalmentId !== "string" || typeof payload.expiresAt !== "number") {
    return null;
  }
  return payload.expiresAt > now ? payload.instalmentId : null;
}
