import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { payments, riskFlags, students, users } from "@/db/schema";
import {
  briefPrompt,
  isSafeBrief,
  maskNote,
  notePrompt,
  readHints,
  readVerdicts,
  riskPrompt,
  type RiskCase,
} from "@/domain/ai";
import { callBriefTemplate, messages } from "@/i18n";
import { audit } from "./audit";
import { env } from "./env";
import { errorName, log } from "./log";

const TIMEOUT_MS = 12_000;
const URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const RETRY_AFTER_MS = 1_000;
const isBusy = (status: number) => status === 429 || status >= 500;

/** One call to Gemini, with one retry if it is busy. Failure returns null for the plain rules. */
async function askGemini(
  prompt: string,
  json = false,
  timeoutMs = TIMEOUT_MS,
  retry = true,
): Promise<string | null> {
  if (!env.GEMINI_API_KEY) return null;

  try {
    const response = await fetch(`${URL_BASE}/${env.GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": env.GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingBudget: 0 },
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      if (retry && isBusy(response.status)) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS));
        return askGemini(prompt, json, timeoutMs, false);
      }
      log("warn", "ai.call_failed", { status: response.status });
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === "string" ? text.trim() : null;
  } catch (error) {
    log("warn", "ai.call_failed", { error: errorName(error) });
    return null;
  }
}

const JUDGE_TIMEOUT_MS = 30_000;

/** One call for everyone who shows a sign. Returns null if the model cannot give a verdict. */
export async function judgeRisk(cases: RiskCase[]) {
  if (cases.length === 0) return null;

  const reply = await askGemini(riskPrompt(cases), true, JUDGE_TIMEOUT_MS);
  return reply === null
    ? null
    : readVerdicts(
        reply,
        cases.map((item) => item.id),
      );
}

/**
 * Writes only to the call task and the audit log, so it has no route to fees or parents. A draft
 * that is missing or fails the checks is replaced by the plain template, so staff always get a guide.
 */
export async function draftCallBrief(taskId: string, actorId: string) {
  const [task] = await db
    .select({
      band: riskFlags.band,
      reasons: riskFlags.reasons,
      status: riskFlags.taskStatus,
      language: users.language,
    })
    .from(riskFlags)
    .innerJoin(students, eq(students.id, riskFlags.studentId))
    .innerJoin(users, eq(users.id, students.parentId))
    .where(eq(riskFlags.id, taskId));
  if (task?.status !== "open") return null;

  const draft = await askGemini(briefPrompt(task.reasons, task.band, task.language));
  const safe = draft !== null && isSafeBrief(draft);
  const source = safe ? ("ai" as const) : ("template" as const);
  const callBrief = safe ? draft : callBriefTemplate(task.reasons, messages(task.language));

  await db.update(riskFlags).set({ callBrief, briefSource: source }).where(eq(riskFlags.id, taskId));
  await audit(db, {
    actorId,
    action: "ai.brief",
    entityId: taskId,
    detail: { source, ...(safe ? { model: env.GEMINI_MODEL } : {}) },
  });
  return source;
}

/** Names are masked before the note leaves, and matched back to students on our side. */
export async function readPayerNote(paymentId: string, actorId: string) {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (payment?.status !== "unmatched" || !payment.payerNote) return false;

  const names = await db.select({ name: students.name }).from(students);
  const { masked, tokens } = maskNote(
    payment.payerNote,
    names.map((row) => row.name),
  );

  const reply = await askGemini(notePrompt(masked), true);
  const hints = reply === null ? null : readHints(reply, tokens);
  if (!hints) return false;

  await db.update(payments).set({ noteHints: hints }).where(eq(payments.id, paymentId));
  await audit(db, {
    actorId,
    action: "ai.note",
    entityId: paymentId,
    detail: { sent: masked, model: env.GEMINI_MODEL },
  });
  return true;
}
