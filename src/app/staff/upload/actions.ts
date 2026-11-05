"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import type { PreviewRow, UploadState } from "@/components/upload-form";
import { UPLOAD_KINDS, UPLOAD_MAX_BYTES } from "@/domain/upload";
import { formatDate, messages, type Locale } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { inspectUpload, saveUpload, type Inspection } from "@/lib/upload";

const SHOWN_ROWS = 25;
const SHOWN_PROBLEMS = 20;

const choiceSchema = z.object({ batchId: z.uuid(), kind: z.enum(UPLOAD_KINDS) });
const saveSchema = choiceSchema.extend({ text: z.string().min(1).max(UPLOAD_MAX_BYTES) });

/** A spreadsheet file is a zip, so it starts PK. A text file never holds a null byte. */
const looksBinary = (text: string) => text.startsWith("PK") || text.includes("\0");

function previewRows(inspection: Inspection, locale: Locale): PreviewRow[] {
  const u = messages(locale).staff.upload;
  const nameOf = new Map(
    inspection.students.map((student) => [student.id, `${student.name} · ${student.code}`]),
  );
  const row = (key: string, studentId: string, detail: string, status: PreviewRow["status"]) => ({
    key,
    student: nameOf.get(studentId) ?? "",
    detail,
    status,
  });

  if (inspection.kind === "attendance") {
    return inspection.changes.map(({ record, before, status }) => {
      const value = u.attendanceValue(record.present, record.total);
      const week = u.weekOf(formatDate(record.weekStart, locale));
      const was = before && status === "changed" ? u.was(u.attendanceValue(before.present, before.total)) : "";
      return row(`${record.studentId}|${record.weekStart}`, record.studentId, `${week}: ${value}${was}`, u.statuses[status]);
    });
  }

  return inspection.changes.map(({ record, before, status }) => {
    const value = u.scoreValue(record.score, record.maxScore);
    const test = `${record.testName}, ${formatDate(record.takenOn, locale)}`;
    const was = before && status === "changed" ? u.was(u.scoreValue(before.score, before.maxScore)) : "";
    return row(`${record.studentId}|${record.testName}`, record.studentId, `${test}: ${value}${was}`, u.statuses[status]);
  });
}

export async function checkUpload(_: UploadState, formData: FormData): Promise<UploadState> {
  await requireUser("accounts");
  const locale = await getLocale();
  const u = messages(locale).staff.upload;

  const choice = choiceSchema.safeParse({
    batchId: formData.get("batchId"),
    kind: formData.get("kind"),
  });
  if (!choice.success) return { error: u.needBatch };
  const { batchId, kind } = choice.data;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: u.needFile };
  if (file.size > UPLOAD_MAX_BYTES) return { error: u.tooBig };

  const text = await file.text();
  if (looksBinary(text)) return { error: u.notCsv };

  const inspection = await inspectUpload({ kind, batchId, text });

  if (inspection.errors.length > 0) {
    const total = inspection.errors.length;
    return {
      problemsTitle: u.problemsTitle(total),
      problems: inspection.errors.slice(0, SHOWN_PROBLEMS).map((error, index) => ({
        key: `${error.line}-${index}`,
        line: String(error.line),
        message: u.problems[error.problem](error.value),
      })),
      problemsMore: total > SHOWN_PROBLEMS ? u.problemsMore(total - SHOWN_PROBLEMS) : null,
    };
  }

  const count = (status: string) =>
    inspection.changes.filter((change) => change.status === status).length;
  const added = count("new");
  const changed = count("changed");
  const rows = previewRows(inspection, locale);

  return {
    preview: {
      batchId,
      kind,
      text,
      summary: u.summary(added, changed, count("same"), inspection.blank),
      rows: rows.slice(0, SHOWN_ROWS),
      moreRows: rows.length > SHOWN_ROWS ? u.moreRows(rows.length - SHOWN_ROWS) : null,
      saveLabel: added + changed > 0 ? u.save(added + changed) : null,
    },
  };
}

export async function saveBatchUpload(_: FormState, formData: FormData): Promise<FormState> {
  await requireUser("accounts");
  const u = messages(await getLocale()).staff.upload;

  const form = saveSchema.safeParse(Object.fromEntries(formData));
  if (!form.success) return { error: u.invalidNow };

  const outcome = await saveUpload(form.data);
  if (!outcome.saved) return { error: u.invalidNow };

  redirect(`/staff/upload?added=${outcome.added}&changed=${outcome.changed}`);
}
