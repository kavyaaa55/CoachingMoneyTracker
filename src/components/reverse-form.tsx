import { reverseFromLedger } from "@/app/staff/books/actions";
import type { Messages } from "@/i18n/en";
import { ActionForm } from "./action-form";
import { TextField } from "./text-field";

type Props = { paymentId: string; studentId: string; t: Messages };

/** Reversing is destructive, so it opens a step that asks why before anything happens. */
export function ReverseForm({ paymentId, studentId, t }: Props) {
  const r = t.staff.ledger.reverse;

  return (
    <details>
      <summary className="min-h-12 cursor-pointer py-3 font-medium text-error underline underline-offset-4">
        {r.open}
      </summary>
      <div className="mt-2 min-w-56">
        <ActionForm action={reverseFromLedger} label={r.confirm} pendingLabel={r.saving} variant="secondary">
          <input type="hidden" name="paymentId" value={paymentId} />
          <input type="hidden" name="studentId" value={studentId} />
          <TextField name="note" label={r.note} />
        </ActionForm>
      </div>
    </details>
  );
}
