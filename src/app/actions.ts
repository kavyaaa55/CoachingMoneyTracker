"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { clearPendingLogin, currentUser, endSession } from "@/lib/auth";
import { isLocale, saveLocale } from "@/lib/locale";

export async function setLanguage(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;

  await saveLocale(locale);

  const user = await currentUser();
  if (user) await db.update(users).set({ language: locale }).where(eq(users.id, user.id));
}

export async function signOut() {
  await endSession();
  await clearPendingLogin();
  redirect("/login");
}
