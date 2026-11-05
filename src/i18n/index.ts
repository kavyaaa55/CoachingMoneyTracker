import { en, type Messages } from "./en";
import { hi } from "./hi";

export type Locale = "en" | "hi";

export function messages(locale: Locale): Messages {
  return locale === "hi" ? hi : en;
}
