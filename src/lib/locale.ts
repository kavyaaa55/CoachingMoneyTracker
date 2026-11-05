import { cookies } from "next/headers";
import type { Locale } from "@/i18n";

export const LOCALE_COOKIE = "lang";

export const isLocale = (value: unknown): value is Locale => value === "en" || value === "hi";

export async function chosenLocale(): Promise<Locale | null> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : null;
}

export async function getLocale(): Promise<Locale> {
  return (await chosenLocale()) ?? "en";
}

export async function saveLocale(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
}
