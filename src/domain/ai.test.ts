import { describe, expect, it } from "vitest";
import { briefPrompt, isSafeBrief, maskNote, notePrompt, readHints } from "./ai";

const reasons = [
  { kind: "attendance" as const, from: 83, to: 42 },
  { kind: "tests" as const, from: 59, to: 37 },
  { kind: "missed" as const, count: 2 },
];

describe("briefPrompt", () => {
  it("sends the facts and the language", () => {
    const prompt = briefPrompt(reasons, "high", "hi");
    expect(prompt).toContain("83%");
    expect(prompt).toContain("Hindi");
  });

  it("never sends the fee reason, so a call cannot turn into a fee action", () => {
    expect(briefPrompt(reasons, "high", "en")).not.toMatch(/overdue|2 instalments/);
  });
});

describe("isSafeBrief", () => {
  const good = "- Thank them for their time.\n- Ask how things have felt lately.\n- Offer extra help.";

  it("accepts a plain draft", () => {
    expect(isSafeBrief(good)).toBe(true);
  });

  it("throws away anything about money, in either language", () => {
    expect(isSafeBrief(`${good} Remind them of the fee.`)).toBe(false);
    expect(isSafeBrief(`${good} बकाया की याद दिलाएँ।`)).toBe(false);
    expect(isSafeBrief(`${good} ₹15,000 is pending.`)).toBe(false);
  });

  it("does not mistake an ordinary word for money", () => {
    expect(isSafeBrief(`${good} Ask how the student has been feeling.`)).toBe(true);
  });

  it("throws away a draft with a placeholder left in it", () => {
    expect(isSafeBrief(`${good} I am calling from [Institute Name].`)).toBe(false);
  });

  it("throws away links, long numbers, and drafts too short or too long", () => {
    expect(isSafeBrief(`${good} https://example.com`)).toBe(false);
    expect(isSafeBrief(`${good} Call 9000000002`)).toBe(false);
    expect(isSafeBrief("Too short")).toBe(false);
    expect(isSafeBrief("a".repeat(701))).toBe(false);
  });
});

describe("maskNote", () => {
  it("replaces names and long numbers before a note leaves the system", () => {
    const { masked, tokens } = maskNote("Mohit Gurjar ki kist, call 9000000003", ["Mohit Gurjar"]);
    expect(masked).not.toMatch(/Mohit|Gurjar|9000000003/);
    expect(Object.values(tokens).sort()).toEqual(["Gurjar", "Mohit"]);
  });

  it("ignores case, and does not touch part of another word", () => {
    expect(maskNote("mohit paid", ["Mohit"]).masked).toMatch(/^NAME_\d+ paid$/);
    expect(maskNote("Devastating", ["Dev"]).masked).toBe("Devastating");
  });

  it("puts the masked note in the prompt", () => {
    const { masked } = maskNote("Mohit ki doosri kist", ["Mohit"]);
    expect(notePrompt(masked)).not.toContain("Mohit");
  });
});

describe("readHints", () => {
  const tokens = { NAME_1: "Mohit" };

  it("turns tokens back into names on our side", () => {
    expect(
      readHints('{"names":["NAME_1"],"instalment":2,"programme":"NEET"}', tokens),
    ).toEqual({ names: ["Mohit"], instalment: 2, programme: "NEET" });
  });

  it("drops anything the model invented", () => {
    expect(
      readHints('{"names":["NAME_9","Rahul"],"instalment":9,"programme":"MBA"}', tokens),
    ).toEqual({ names: [], instalment: null, programme: null });
  });

  it("gives up on a reply that is not JSON", () => {
    expect(readHints("Sorry, I cannot help", tokens)).toBeNull();
  });
});
