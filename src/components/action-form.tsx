"use client";

import { useActionState, useEffect, useRef } from "react";
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
  const form = useRef<HTMLFormElement>(null);
  const typed = useRef<FormData | null>(null);

  // React clears a form after its action runs, so put back what was typed when it failed.
  useEffect(() => {
    if (!state.error || !form.current || !typed.current) return;

    for (const field of form.current.querySelectorAll<HTMLInputElement>("input, select, textarea")) {
      const value = typed.current.get(field.name);
      if (field.type !== "hidden" && typeof value === "string") field.value = value;
    }
  }, [state]);

  return (
    <form
      ref={form}
      action={formAction}
      onSubmit={(event) => {
        typed.current = new FormData(event.currentTarget);
      }}
      className="flex flex-col gap-4"
    >
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
