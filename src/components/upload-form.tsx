"use client";

import { useActionState, useState } from "react";
import { UPLOAD_MAX_BYTES, type UploadKind } from "@/domain/upload";
import { ActionForm, type FormState } from "./action-form";
import { buttonStyles } from "./button-styles";
import { DataTable } from "./data-table";
import { SubmitButton } from "./submit-button";

export type PreviewRow = { key: string; student: string; detail: string; status: string };

export type UploadPreview = {
  batchId: string;
  kind: UploadKind;
  text: string;
  summary: string;
  rows: PreviewRow[];
  moreRows: string | null;
  /** Null when everything in the file is already saved. */
  saveLabel: string | null;
};

export type UploadState = {
  error?: string;
  problems?: { key: string; line: string; message: string }[];
  problemsTitle?: string;
  problemsMore?: string | null;
  preview?: UploadPreview;
};

type Labels = {
  batchLabel: string;
  chooseBatch: string;
  kindLabel: string;
  attendance: string;
  scores: string;
  fileLabel: string;
  fileHint: string;
  check: string;
  checking: string;
  template: string;
  templateHint: string;
  tooBig: string;
  line: string;
  problem: string;
  previewTitle: string;
  student: string;
  details: string;
  status: string;
  saving: string;
  startAgain: string;
  nothingNew: string;
};

type Props = {
  batches: { id: string; label: string }[];
  labels: Labels;
  checkAction: (state: UploadState, formData: FormData) => Promise<UploadState>;
  saveAction: (state: FormState, formData: FormData) => Promise<FormState>;
};

function Steps({ batches, labels, checkAction, saveAction, onReset }: Props & { onReset: () => void }) {
  const [state, formAction] = useActionState(checkAction, {});
  const [batchId, setBatchId] = useState("");
  const [kind, setKind] = useState<UploadKind>("attendance");
  const [tooBig, setTooBig] = useState(false);

  const { preview } = state;
  const selectClass = "h-12 w-full rounded-md border border-control bg-surface px-3";

  if (preview) {
    return (
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl leading-7 font-medium">{labels.previewTitle}</h2>
          <p className="mt-1 text-muted">{preview.summary}</p>
        </div>
        <DataTable
          rows={preview.rows}
          rowKey={(row) => row.key}
          columns={[
            { header: labels.student, cell: (row) => row.student },
            { header: labels.details, cell: (row) => row.detail },
            { header: labels.status, cell: (row) => row.status },
          ]}
        />
        {preview.moreRows && <p className="text-sm text-muted">{preview.moreRows}</p>}
        <div className="flex max-w-[480px] flex-col gap-3">
          {preview.saveLabel ? (
            <ActionForm action={saveAction} label={preview.saveLabel} pendingLabel={labels.saving}>
              <input type="hidden" name="batchId" value={preview.batchId} />
              <input type="hidden" name="kind" value={preview.kind} />
              <input type="hidden" name="text" value={preview.text} />
            </ActionForm>
          ) : (
            <p className="rounded-md bg-highlight px-4 py-3">{labels.nothingNew}</p>
          )}
          <button type="button" onClick={onReset} className={buttonStyles.secondary}>
            {labels.startAgain}
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <form
        action={formAction}
        onSubmit={(event) => {
          const file = new FormData(event.currentTarget).get("file");
          const oversized = file instanceof File && file.size > UPLOAD_MAX_BYTES;
          setTooBig(oversized);
          if (oversized) event.preventDefault();
        }}
        className="flex max-w-[560px] flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="batchId" className="font-medium">
            {labels.batchLabel}
          </label>
          <select
            id="batchId"
            name="batchId"
            required
            value={batchId}
            onChange={(event) => setBatchId(event.target.value)}
            className={selectClass}
          >
            <option value="">{labels.chooseBatch}</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="kind" className="font-medium">
            {labels.kindLabel}
          </label>
          <select
            id="kind"
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as UploadKind)}
            className={selectClass}
          >
            <option value="attendance">{labels.attendance}</option>
            <option value="scores">{labels.scores}</option>
          </select>
        </div>

        {batchId && (
          <div>
            <a
              href={`/staff/upload/template?batch=${batchId}&kind=${kind}`}
              className="inline-block min-h-12 py-3 font-medium underline underline-offset-4"
            >
              {labels.template}
            </a>
            <p className="text-sm text-muted">{labels.templateHint}</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="file" className="font-medium">
            {labels.fileLabel}
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="min-h-12 w-full rounded-md border border-control bg-surface px-3 py-2.5"
          />
          <p className="text-sm text-muted">{labels.fileHint}</p>
        </div>

        {(tooBig || state.error) && (
          <p role="alert" className="rounded-md bg-error-tint px-4 py-3 text-error">
            {tooBig ? labels.tooBig : state.error}
          </p>
        )}

        <SubmitButton label={labels.check} pendingLabel={labels.checking} />
      </form>

      {state.problems && (
        <section className="flex flex-col gap-3" role="alert">
          <h2 className="text-xl leading-7 font-medium text-error">{state.problemsTitle}</h2>
          <DataTable
            rows={state.problems}
            rowKey={(row) => row.key}
            columns={[
              { header: labels.line, cell: (row) => row.line },
              { header: labels.problem, cell: (row) => row.message },
            ]}
          />
          {state.problemsMore && <p className="text-sm text-muted">{state.problemsMore}</p>}
        </section>
      )}
    </>
  );
}

/** Checks a file first, then offers to save it. Starting again remounts the steps. */
export function UploadForm(props: Props) {
  const [round, setRound] = useState(0);
  return <Steps key={round} {...props} onReset={() => setRound((value) => value + 1)} />;
}
