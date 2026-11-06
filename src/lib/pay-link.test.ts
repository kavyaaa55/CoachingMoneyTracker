import { describe, expect, it } from "vitest";
import { createPayLink, PAY_LINK_TTL_MS, readPayLink } from "./pay-link";
import { signSession } from "./session";

const secret = "a-test-secret-that-is-long-enough-000";
const now = 1_000_000;
const token = createPayLink("instalment-1", now, secret).replace("/gateway/", "");

describe("pay links", () => {
  it("reads a valid link", () => {
    expect(readPayLink(token, now, secret)).toBe("instalment-1");
  });

  it("expires", () => {
    expect(readPayLink(token, now + PAY_LINK_TTL_MS, secret)).toBeNull();
  });

  it("rejects a changed link", () => {
    expect(readPayLink(`x${token}`, now, secret)).toBeNull();
    expect(readPayLink(token, now, "another-secret-that-is-long-enough-00")).toBeNull();
  });

  it("does not accept a session token as a pay link", () => {
    const session = signSession({ userId: "user-1", version: 0, expiresAt: now + 1000 }, secret);
    expect(readPayLink(session, now, secret)).toBeNull();
  });
});
