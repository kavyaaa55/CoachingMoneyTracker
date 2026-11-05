export const buttonStyles = {
  primary:
    "block min-h-14 w-full rounded-sm bg-primary px-4 py-3.5 text-center text-lg leading-7 font-medium text-on-primary transition-colors duration-150 hover:bg-primary-hover disabled:bg-divider disabled:text-muted",
  secondary:
    "block min-h-12 w-full rounded-sm border border-control bg-surface px-4 py-2.5 text-center font-medium text-ink transition-colors duration-150 hover:bg-highlight disabled:text-muted",
  link: "min-h-12 px-2 font-medium underline underline-offset-4 disabled:text-muted",
};

/** A 48px tap target that does not make its table row or line any taller. */
export const rowLink = "-my-3 inline-flex min-h-12 items-center font-medium underline underline-offset-4";

export type ButtonVariant = keyof typeof buttonStyles;
