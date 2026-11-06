import type { RiskBand, RiskReason } from "./risk";

/**
 * The rules around the model. It only ever drafts or reads: nothing here can change a fee, send a
 * parent a message or mark anything paid. What leaves the system is decided here, in plain code.
 */

export type DraftSource = "ai" | "template";

const LANGUAGE_NAMES = { en: "English", hi: "Hindi" };

/**
 * Attendance and test facts only. No name, ID or phone, and the fee reason is left out on purpose:
 * a counsellor's call is about the student, and the flag must never turn into a fee action.
 */
export function briefPrompt(reasons: RiskReason[], band: RiskBand, language: "en" | "hi") {
  const facts = reasons.flatMap((reason) => {
    if (reason.kind === "attendance") return [`Attendance fell from ${reason.from}% to ${reason.to}%.`];
    if (reason.kind === "tests") return [`Test scores fell from ${reason.from}% to ${reason.to}%.`];
    if (reason.kind === "missing") return [`No attendance has been recorded for ${reason.weeks} weeks.`];
    return [];
  });

  return [
    "You help a counsellor at an Indian coaching institute prepare a phone call to a parent.",
    `The student is on a ${band === "high" ? "high" : "watch"} concern level. This is a flag from a simple rule and it may be wrong.`,
    `Facts: ${facts.join(" ")}`,
    `Write in ${LANGUAGE_NAMES[language]}, as 3 short lines, each starting with "- ": one warm way to open, one open question about how the student is doing, one way to offer support.`,
    "Do not mention money, fees, payments or dues. Do not say the student is leaving or at risk. Do not diagnose. Use no names and no numbers. Never use placeholders or brackets.",
  ].join("\n");
}

/** Whole words in English, because "fee" sits inside "feeling", which a warm call guide will use. */
const MONEY_WORDS = /\b(fees?|payments?|instal+ments?|dues|rupees?)\b|₹|फ़ीस|फीस|भुगतान|किस्त|बकाया/i;
const MIN_BRIEF = 40;
const MAX_BRIEF = 700;

/** Checks a draft before anyone sees it. A draft that fails is thrown away for the template. */
export function isSafeBrief(text: string): boolean {
  return (
    text.length >= MIN_BRIEF &&
    text.length <= MAX_BRIEF &&
    !MONEY_WORDS.test(text) &&
    !/https?:|www\.|\d{5,}|[[\]{}<>]/.test(text)
  );
}

export type MaskedNote = { masked: string; tokens: Record<string, string> };

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Replaces every student name with a token before a note leaves the system, and long numbers too.
 * The names we hold are in English script, so a name typed in Devanagari is not caught: that is
 * stated in the limits.
 */
export function maskNote(note: string, knownNames: string[]): MaskedNote {
  const words = [...new Set(knownNames.flatMap((name) => name.split(/\s+/)))]
    .filter((word) => word.length >= 3)
    .sort((a, b) => b.length - a.length);

  const tokens: Record<string, string> = {};
  let masked = note;
  for (const word of words) {
    const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
    if (!pattern.test(masked)) continue;
    const token = `NAME_${Object.keys(tokens).length + 1}`;
    tokens[token] = word;
    masked = masked.replace(pattern, token);
  }

  return { masked: masked.replace(/\d{7,}/g, "NUMBER"), tokens };
}

export function notePrompt(masked: string) {
  return [
    "A parent at an Indian coaching institute wrote this note with a fee payment. It may mix Hindi and English.",
    "Student names have been replaced with tokens like NAME_1.",
    `Note: "${masked}"`,
    'Return JSON only: {"names": [tokens that name the student], "instalment": which instalment number 1 to 4 or null, "programme": "JEE", "NEET" or null}.',
    "Use null when the note does not say. Do not guess.",
  ].join("\n");
}

export type NoteHints = { names: string[]; instalment: number | null; programme: string | null };

/** Trusts nothing from the model: only tokens we made and values in range are kept. */
export function readHints(reply: string, tokens: Record<string, string>): NoteHints | null {
  let data: { names?: unknown; instalment?: unknown; programme?: unknown };
  try {
    data = JSON.parse(reply);
  } catch {
    return null;
  }

  const names = Array.isArray(data.names)
    ? data.names.flatMap((token) => (typeof token === "string" && tokens[token] ? [tokens[token]] : []))
    : [];
  const instalment =
    Number.isInteger(data.instalment) && Number(data.instalment) >= 1 && Number(data.instalment) <= 4
      ? Number(data.instalment)
      : null;
  const programme = data.programme === "JEE" || data.programme === "NEET" ? data.programme : null;

  return { names, instalment, programme };
}
