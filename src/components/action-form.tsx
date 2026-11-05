"use client";

import { useActionState } from "react";
import { SubmitButton } from "./submit-button";

export type FormState = { error?: string };

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "link";
  children?: React.ReactNode;
};

/** A form that shows the error returned by its server action. */
export function ActionForm({ action, label, pendingLabel, variant, children }: Props) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {children}
      {state.error && (
        <p role="alert" className="rounded-md bg-error-tint px-4 py-3 text-error">
          {state.error}
        </p>
      )}
      <SubmitButton label={label} pendingLabel={pendingLabel} variant={variant} />
    </form>
  );
}
