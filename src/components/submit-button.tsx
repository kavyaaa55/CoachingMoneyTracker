"use client";

import { useFormStatus } from "react-dom";
import { buttonStyles, type ButtonVariant } from "./button-styles";

type Props = {
  label: string;
  pendingLabel?: string;
  variant?: ButtonVariant;
};

export function SubmitButton({ label, pendingLabel, variant = "primary" }: Props) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={buttonStyles[variant]}>
      {pending ? (pendingLabel ?? label) : label}
    </button>
  );
}
