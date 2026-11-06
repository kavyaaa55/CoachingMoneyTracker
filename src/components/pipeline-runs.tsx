import type { pipelineRuns } from "@/db/schema";
import { formatDate, type Locale } from "@/i18n";
import type { Messages } from "@/i18n/en";
import { DataTable } from "./data-table";

type Props = {
  runs: (typeof pipelineRuns.$inferSelect)[];
  locale: Locale;
  t: Messages;
};

/** What each day took in and did, so a job that stopped running cannot go unnoticed. */
export function PipelineRuns({ runs, locale, t }: Props) {
  const p = t.staff.pipeline;

  if (runs.length === 0) {
    return <p className="rounded-md border border-divider bg-surface p-6 text-muted">{p.empty}</p>;
  }

  return (
    <DataTable
      rows={runs}
      rowKey={(run) => run.id}
      columns={[
        { header: p.date, cell: (run) => formatDate(run.runOn, locale) },
        { header: p.source, cell: (run) => p.sources[run.source] },
        { header: p.payments, align: "right", cell: (run) => run.counts.paymentsMatched },
        { header: p.queued, align: "right", cell: (run) => run.counts.paymentsQueued },
        { header: p.records, align: "right", cell: (run) => run.counts.recordsUploaded },
        { header: p.sent, align: "right", cell: (run) => run.counts.remindersSent },
        { header: p.stopped, align: "right", cell: (run) => run.counts.remindersStopped },
        { header: p.tasks, align: "right", cell: (run) => run.counts.tasksCreated },
        {
          header: p.status,
          cell: (run) =>
            run.failed.length === 0 ? (
              p.ok
            ) : (
              <span className="text-error">{p.failed(run.failed.join(", "))}</span>
            ),
        },
      ]}
    />
  );
}
