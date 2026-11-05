"use client";

import { useFormStatus } from "react-dom";
import { buttonStyles, type ButtonVariant } from "./button-styles";

type Props = {
  label: string;
  pendingLabel?: string;
  variant?: ButtonVariant;
  /** Sent with the form, for a form with two outcomes. */
  name?: string;
  value?: string;
};

export function SubmitButton({ label, pendingLabel, variant = "primary", name, value }: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={buttonStyles[variant]}
    >
      {pending ? (pendingLabel ?? label) : label}
    </button>
  );
}
