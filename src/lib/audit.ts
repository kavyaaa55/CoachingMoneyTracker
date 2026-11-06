import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditEvents, users } from "@/db/schema";

export const AUDIT_ACTIONS = [
  "payment.manual",
  "payment.applied",
  "payment.reversed",
  "refund.saved",
  "refund.approved",
  "refund.paid",
  "upload.saved",
  "task.reviewed",
  "month.closed",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

type Entry = {
  actorId: string;
  action: AuditAction;
  entityId: string;
  /** Facts for the record: what changed, and the old value where one was replaced. */
  detail?: Record<string, unknown>;
};

/** Takes the open transaction, so a change and its record stand or fall together. */
export async function audit(client: Pick<typeof db, "insert">, entry: Entry) {
  await client.insert(auditEvents).values({ ...entry, detail: entry.detail ?? {} });
}

export const AUDIT_PER_PAGE = 50;

export function recentAudit() {
  return db
    .select({
      id: auditEvents.id,
      at: auditEvents.at,
      action: auditEvents.action,
      detail: auditEvents.detail,
      actor: users.name,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorId))
    .orderBy(desc(auditEvents.at))
    .limit(AUDIT_PER_PAGE);
}
