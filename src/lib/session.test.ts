import { describe, expect, it } from "vitest";
import { readSession, signSession } from "./session";

const secret = "a-test-secret-that-is-long-enough-000";
const now = 1_000_000;
const token = signSession({ userId: "user-1", version: 0, expiresAt: now + 1000 }, secret);

describe("session tokens", () => {
  it("reads a valid token", () => {
    expect(readSession(token, secret, now)).toEqual({ userId: "user-1", version: 0 });
  });

  it("rejects an expired token", () => {
    expect(readSession(token, secret, now + 1000)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    expect(readSession(token, "another-secret-that-is-long-enough-00", now)).toBeNull();
  });

  it("rejects a token whose user was changed", () => {
    const [, signed] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ userId: "user-2", expiresAt: now + 1000 }),
    ).toString("base64url");
    expect(readSession(`${forged}.${signed}`, secret, now)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(readSession("", secret, now)).toBeNull();
    expect(readSession("abc", secret, now)).toBeNull();
    expect(readSession(`${token}.extra`, secret, now)).toBeNull();
  });
});
