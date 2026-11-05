"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { runReminders } from "@/lib/reminders";

export async function runRemindersNow() {
  await requireUser("accounts");
  const { sent, stopped, failed } = await runReminders();

  redirect(`/staff/reminders?sent=${sent}&stopped=${stopped}&failed=${failed}`);
}
