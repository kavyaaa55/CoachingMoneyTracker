"use client";

import { useActionState } from "react";
import type { FormState } from "./action-form";
import { SubmitButton } from "./submit-button";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  taskId: string;
  labels: { note: string; noteHint: string; called: string; falseFlag: string; saving: string };
};

/** One note, two outcomes. */
export function TaskReviewForm({ action, taskId, labels }: Props) {
  const [state, formAction] = useActionState(action, {});
  const noteId = `note-${taskId}`;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="taskId" value={taskId} />
      <div className="flex flex-col gap-2">
        <label htmlFor={noteId} className="font-medium">
          {labels.note}
        </label>
        <textarea
          id={noteId}
          name="note"
          rows={2}
          maxLength={300}
          className="w-full rounded-md border border-control bg-surface px-4 py-3"
        />
        <p className="text-sm text-muted">{labels.noteHint}</p>
      </div>
      {state.error && (
        <p role="alert" className="rounded-md bg-error-tint px-4 py-3 text-error">
          {state.error}
        </p>
      )}
      <div className="flex flex-col gap-2 md:flex-row">
        <div className="md:w-48">
          <SubmitButton
            label={labels.called}
            pendingLabel={labels.saving}
            variant="secondary"
            name="outcome"
            value="called"
          />
        </div>
        <div className="md:w-48">
          <SubmitButton
            label={labels.falseFlag}
            pendingLabel={labels.saving}
            variant="secondary"
            name="outcome"
            value="false_flag"
          />
        </div>
      </div>
    </form>
  );
}
