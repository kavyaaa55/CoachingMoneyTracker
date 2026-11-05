import Link from "next/link";
import { UploadForm } from "@/components/upload-form";
import { messages } from "@/i18n";
import { requireUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { batchChoices } from "@/lib/upload";
import { checkUpload, saveBatchUpload } from "./actions";

type Query = { added?: string; changed?: string };

export default async function UploadPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requireUser("accounts");
  const query = await searchParams;
  const t = messages(await getLocale());
  const u = t.staff.upload;

  const batches = await batchChoices();
  const saved = query.added !== undefined;

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="max-w-[640px]">
        <h1 className="text-[32px] leading-10 font-medium">{u.title}</h1>
        <p className="mt-2 text-muted">{u.intro}</p>
      </div>

      {saved && (
        <div role="status" className="max-w-[640px] rounded-md bg-paid-tint px-4 py-3 text-paid">
          <p>{u.saved(Number(query.added) || 0, Number(query.changed) || 0)}</p>
          <p className="mt-1">
            {u.savedNext}{" "}
            <Link href="/staff/tasks" className="font-medium underline underline-offset-4">
              {u.goToTasks}
            </Link>
          </p>
        </div>
      )}

      {batches.length === 0 ? (
        <p className="rounded-md border border-divider bg-surface p-6 text-muted">{u.noBatches}</p>
      ) : (
        <UploadForm
          batches={batches.map((batch) => ({
            id: batch.id,
            label: `${batch.centre} · ${batch.name}`,
          }))}
          checkAction={checkUpload}
          saveAction={saveBatchUpload}
          labels={{
            batchLabel: u.batchLabel,
            chooseBatch: u.chooseBatch,
            kindLabel: u.kindLabel,
            attendance: u.kinds.attendance,
            scores: u.kinds.scores,
            fileLabel: u.fileLabel,
            fileHint: u.fileHint,
            check: u.check,
            checking: u.checking,
            template: u.template,
            templateHint: u.templateHint,
            tooBig: u.tooBig,
            line: u.line,
            problem: u.problem,
            previewTitle: u.previewTitle,
            student: u.student,
            details: u.details,
            status: u.status,
            saving: u.saving,
            startAgain: u.startAgain,
            nothingNew: u.nothingNew,
          }}
        />
      )}

      <section className="max-w-[640px] rounded-md border border-divider bg-surface p-6">
        <h2 className="font-medium">{u.formatTitle}</h2>
        <ul className="mt-2 list-disc pl-5 text-muted">
          <li>{u.formatAttendance}</li>
          <li>{u.formatScores}</li>
          <li>{u.formatDates}</li>
          <li>{u.formatBlank}</li>
        </ul>
      </section>
    </div>
  );
}
