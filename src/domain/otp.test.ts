import { describe, expect, it } from "vitest";
import {
  generateOtp,
  hashOtp,
  isOtpFormat,
  normalisePhone,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  otpMatches,
  otpState,
} from "./otp";

describe("normalisePhone", () => {
  it("accepts common formats", () => {
    expect(normalisePhone("9000000002")).toBe("+919000000002");
    expect(normalisePhone("+91 90000 00002")).toBe("+919000000002");
    expect(normalisePhone("09000000002")).toBe("+919000000002");
    expect(normalisePhone("919000000002")).toBe("+919000000002");
  });

  it("rejects numbers that are not Indian mobiles", () => {
    expect(normalisePhone("12345")).toBeNull();
    expect(normalisePhone("1000000002")).toBeNull();
    expect(normalisePhone("90000000021")).toBeNull();
    expect(normalisePhone("abcdefghij")).toBeNull();
  });
});

describe("otp codes", () => {
  it("always generates six digits", () => {
    for (let i = 0; i < 200; i += 1) expect(isOtpFormat(generateOtp())).toBe(true);
  });

  it("matches only the same code for the same phone and secret", () => {
    const stored = hashOtp("+919000000002", "123456", "secret");
    expect(otpMatches(stored, hashOtp("+919000000002", "123456", "secret"))).toBe(true);
    expect(otpMatches(stored, hashOtp("+919000000002", "654321", "secret"))).toBe(false);
    expect(otpMatches(stored, hashOtp("+919000000003", "123456", "secret"))).toBe(false);
    expect(otpMatches(stored, hashOtp("+919000000002", "123456", "other"))).toBe(false);
  });
});

describe("otpState", () => {
  const start = new Date("2026-11-02T10:00:00Z");
  const expiresAt = new Date(start.getTime() + OTP_TTL_MS);

  it("is usable until it expires", () => {
    expect(otpState({ expiresAt, attempts: 0 }, start)).toBe("usable");
    expect(otpState({ expiresAt, attempts: 0 }, new Date(expiresAt.getTime() - 1))).toBe("usable");
  });

  it("expires exactly at the time limit", () => {
    expect(otpState({ expiresAt, attempts: 0 }, expiresAt)).toBe("expired");
  });

  it("allows the last attempt, then locks", () => {
    expect(otpState({ expiresAt, attempts: OTP_MAX_ATTEMPTS - 1 }, start)).toBe("usable");
    expect(otpState({ expiresAt, attempts: OTP_MAX_ATTEMPTS }, start)).toBe("locked");
  });
});
