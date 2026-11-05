import { createHmac, timingSafeEqual } from "node:crypto";

const hmac = (value: string, secret: string) =>
  createHmac("sha256", secret).update(value).digest("base64url");

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export const signBody = hmac;

export const verifyBody = (body: string, signature: string | null, secret: string) =>
  signature !== null && safeEqual(hmac(body, secret), signature);

export function signToken(payload: unknown, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body, secret)}`;
}

/** Returns the payload, or null if the token is forged or malformed. */
export function readToken(token: string, secret: string): unknown {
  const [body, given, extra] = token.split(".");
  if (!body || !given || extra !== undefined || !safeEqual(hmac(body, secret), given)) return null;

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
}
