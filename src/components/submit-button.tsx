"use client";

import { useFormStatus } from "react-dom";

const styles = {
  primary:
    "min-h-14 w-full rounded-sm bg-primary px-4 py-2 text-lg leading-7 font-medium text-on-primary transition-colors duration-150 hover:bg-primary-hover disabled:bg-divider disabled:text-muted",
  secondary:
    "min-h-12 w-full rounded-sm border border-control bg-surface px-4 py-2 font-medium text-ink transition-colors duration-150 hover:bg-highlight disabled:text-muted",
  link: "min-h-12 px-2 font-medium underline underline-offset-4 disabled:text-muted",
};

type Props = {
  label: string;
  pendingLabel?: string;
  variant?: keyof typeof styles;
};

export function SubmitButton({ label, pendingLabel, variant = "primary" }: Props) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={styles[variant]}>
      {pending ? (pendingLabel ?? label) : label}
    </button>
  );
}
