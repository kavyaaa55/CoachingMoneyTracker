import { describe, expect, it } from "vitest";
import { decideAccess, homeFor, missingConsents } from "./access";

describe("decideAccess", () => {
  it("sends signed-out visitors to login", () => {
    expect(decideAccess(null, "parent")).toBe("login");
    expect(decideAccess(null, "accounts")).toBe("login");
  });

  it("allows the matching role", () => {
    expect(decideAccess({ role: "parent" }, "parent")).toBe("allow");
    expect(decideAccess({ role: "accounts" }, "accounts")).toBe("allow");
  });

  it("blocks each role from the other side", () => {
    expect(decideAccess({ role: "parent" }, "accounts")).toBe("wrong-role");
    expect(decideAccess({ role: "accounts" }, "parent")).toBe("wrong-role");
  });
});

describe("homeFor", () => {
  it("sends each role to its own home", () => {
    expect(homeFor("parent")).toBe("/parent");
    expect(homeFor("accounts")).toBe("/staff");
  });
});

describe("missingConsents", () => {
  it("lists every child without consent", () => {
    expect(missingConsents(["a", "b"], [])).toEqual(["a", "b"]);
    expect(missingConsents(["a", "b"], ["a"])).toEqual(["b"]);
  });

  it("is empty once all children are covered", () => {
    expect(missingConsents(["a", "b"], ["b", "a"])).toEqual([]);
  });
});
