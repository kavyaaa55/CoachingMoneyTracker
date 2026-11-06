import Link from "next/link";
import { approveStudentRefund, payStudentRefund } from "@/app/staff/students/[id]/refund/actions";
import type { refunds } from "@/db/schema";
import type { IsoDate } from "@/domain/dates";
import { refundStage } from "@/domain/refund";
import { formatDate, type Locale } from "@/i18n";
import type { Messages } from "@/i18n/en";
import { REFUND_METHODS } from "@/lib/refunds";
import { ActionForm } from "./action-form";
import { TextField } from "./text-field";

type Props = {
  refund: typeof refunds.$inferSelect;
  userId: string;
  today: IsoDate;
  locale: Locale;
  t: Messages;
};

/** What happens to a saved refund: a second person approves it, then it is paid. */
export function RefundSteps({ refund, userId, today, locale, t }: Props) {
  const s = t.staff.refund.steps;
  const stage = refundStage(refund.refundPaise, refund.status);
  const ids = (
    <>
      <input type="hidden" name="studentId" value={refund.studentId} />
      <input type="hidden" name="refundId" value={refund.id} />
    </>
  );

  if (stage === "nothing-due") return <p className="rounded-md bg-highlight px-4 py-3">{s.nothing}</p>;

  if (stage === "to-approve") {
    return refund.createdBy === userId ? (
      <p className="rounded-md bg-highlight px-4 py-3">{s.needsSecond}</p>
    ) : (
      <div className="flex flex-col gap-3">
        <p className="text-muted">{s.approveHint}</p>
        <ActionForm action={approveStudentRefund} label={s.approve} pendingLabel={s.approving}>
          {ids}
        </ActionForm>
      </div>
    );
  }

  if (stage === "to-pay") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted">{s.payHint}</p>
        <ActionForm action={payStudentRefund} label={s.markPaid} pendingLabel={s.marking}>
          {ids}
          <div className="flex flex-col gap-2">
            <label htmlFor="method" className="font-medium">
              {s.method}
            </label>
            <select
              id="method"
              name="method"
              className="h-12 w-full rounded-md border border-control bg-surface px-3"
            >
              {REFUND_METHODS.map((method) => (
                <option key={method} value={method}>
                  {t.paymentMethods[method]}
                </option>
              ))}
            </select>
          </div>
          <TextField name="reference" label={s.reference} />
          <TextField name="paidOn" label={s.paidOn} type="date" defaultValue={today} />
        </ActionForm>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-md bg-paid-tint px-4 py-3 text-paid">
      <p>{s.paid(formatDate(refund.paidOn!, locale), refund.paidRef ?? "")}</p>
      <Link
        href={`/staff/refunds/${refund.id}/credit-note`}
        className="font-medium underline underline-offset-4"
      >
        {s.creditNote(refund.creditNoteNo ?? "")}
      </Link>
    </div>
  );
}
