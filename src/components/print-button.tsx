"use client";

import { buttonStyles } from "./button-styles";

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonStyles.primary}>
      {label}
    </button>
  );
}
