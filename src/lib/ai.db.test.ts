import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, sqlClient } from "@/db/client";
import {
  auditEvents,
  batches,
  centres,
  instalments,
  payments,
  riskFlags,
  students,
  users,
} from "@/db/schema";
import { rupees } from "@/domain/money";
import { draftCallBrief, readPayerNote } from "./ai";
import { queueWithSuggestions } from "./books";
import { env } from "./env";
import { recordPayment } from "./payments";

let staffId: string;
let taskId: string;
let sent: string[];

const GOOD = "- Thank them for making the time.\n- Ask how things have felt lately.\n- Offer extra help.";

/** The network is never used in tests. */
function geminiReplies(text: string | null, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(String(init.body));
      if (text === null) throw new Error("offline");
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
        { status: ok ? 200 : 500 },
      );
    }),
  );
}

const task = async () => (await db.select().from(riskFlags).where(eq(riskFlags.id, taskId)))[0];

const queued = (note: string, amount = 10000) =>
  recordPayment({
    gatewayRef: `TEST-NOTE-${sent.length}-${Math.round(amount)}`,
    instalmentRef: null,
    amountPaise: rupees(amount),
    paidAt: "2026-10-29T06:00:00.000Z",
    note,
  });

beforeEach(async () => {
  sent = [];
  env.GEMINI_API_KEY = "test-key";
  await db.execute(
    sql`truncate table audit_events, risk_flags, payments, instalments, students, users, batches, centres cascade`,
  );
  const [centre] = await db.insert(centres).values({ name: "Centre 1" }).returning();
  const [batch] = await db
    .insert(batches)
    .values({ name: "NEET 2027 Morning", centreId: centre.id })
    .returning();
  const [parent, staff] = await db
    .insert(users)
    .values([
      { phone: "+919000000003", name: "Parent", role: "parent" as const },
      { phone: "+919000000100", name: "Staff", role: "accounts" as const },
    ])
    .returning();
  staffId = staff.id;
  const [student] = await db
    .insert(students)
    .values({
      code: "STU-0219",
      name: "Mohit Gurjar",
      batchId: batch.id,
      parentId: parent.id,
      planTotalPaise: rupees(120000),
      termStart: "2026-07-01",
      termEnd: "2027-06-30",
    })
    .returning();
  await db.insert(instalments).values([
    { studentId: student.id, sequence: 1, dueDate: "2026-07-15", amountPaise: rupees(40000) },
    { studentId: student.id, sequence: 2, dueDate: "2026-11-15", amountPaise: rupees(40000) },
  ]);
  const [flag] = await db
    .insert(riskFlags)
    .values({
      studentId: student.id,
      band: "high",
      reasons: [
        { kind: "attendance", from: 83, to: 42 },
        { kind: "missed", count: 1 },
      ],
      flaggedOn: "2026-10-01",
    })
    .returning();
  taskId = flag.id;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await sqlClient.end();
});

describe("the call brief", () => {
  it("saves a safe draft, labelled as AI, with an audit entry", async () => {
    geminiReplies(GOOD);
    expect(await draftCallBrief(taskId, staffId)).toBe("ai");
    expect(await task()).toMatchObject({ callBrief: GOOD, briefSource: "ai" });
    expect((await db.select().from(auditEvents))[0].action).toBe("ai.brief");
  });

  it("sends no name, phone or fee reason", async () => {
    geminiReplies(GOOD);
    await draftCallBrief(taskId, staffId);
    expect(sent[0]).toContain("83%");
    expect(sent[0]).not.toMatch(/Mohit|Gurjar|STU-0219|9000000003|overdue/);
  });

  it("falls back to the template if the draft talks about money", async () => {
    geminiReplies(`${GOOD}\n- Remind them the fee is overdue.`);
    expect(await draftCallBrief(taskId, staffId)).toBe("template");
    expect((await task()).callBrief).not.toMatch(/fee/i);
  });

  it("falls back when the service fails, is offline, or has no key", async () => {
    geminiReplies("x", false);
    expect(await draftCallBrief(taskId, staffId)).toBe("template");

    geminiReplies(null);
    expect(await draftCallBrief(taskId, staffId)).toBe("template");

    env.GEMINI_API_KEY = undefined;
    geminiReplies(GOOD);
    sent = [];
    expect(await draftCallBrief(taskId, staffId)).toBe("template");
    expect(sent).toHaveLength(0);
  });

  it("changes nothing but the task, and refuses a closed task", async () => {
    geminiReplies(GOOD);
    await draftCallBrief(taskId, staffId);
    expect(await db.select().from(payments)).toHaveLength(0);

    await db.update(riskFlags).set({ taskStatus: "called" }).where(eq(riskFlags.id, taskId));
    expect(await draftCallBrief(taskId, staffId)).toBeNull();
  });
});

describe("reading a payer's note", () => {
  const reply = '{"names":["NAME_1"],"instalment":2,"programme":"NEET"}';

  it("masks the name, then suggests the right instalment", async () => {
    const { paymentId } = await queued("Mohit ki doosri kist ka advance");
    geminiReplies(reply);
    expect(await readPayerNote(paymentId!, staffId)).toBe(true);
    expect(sent[0]).not.toContain("Mohit");

    const { rows } = await queueWithSuggestions();
    expect(rows[0].suggestions).toMatchObject([
      { studentCode: "STU-0219", sequence: 2, reason: "payer-note" },
    ]);
  });

  it("only suggests: the money stays unmatched until a person decides", async () => {
    const { paymentId } = await queued("Mohit doosri kist");
    geminiReplies(reply);
    await readPayerNote(paymentId!, staffId);
    const [row] = await db.select().from(payments).where(eq(payments.id, paymentId!));
    expect(row).toMatchObject({ status: "unmatched", instalmentId: null, receiptNo: null });
  });

  it("offers nothing that does not fit the balance", async () => {
    const { paymentId } = await queued("Mohit doosri kist", 50000);
    geminiReplies(reply);
    await readPayerNote(paymentId!, staffId);
    expect((await queueWithSuggestions()).rows[0].suggestions).toEqual([]);
  });

  it("reports failure and saves nothing when the model cannot help", async () => {
    const { paymentId } = await queued("Mohit doosri kist");
    geminiReplies("not json");
    expect(await readPayerNote(paymentId!, staffId)).toBe(false);
    expect((await db.select().from(payments))[0].noteHints).toBeNull();
  });
});
