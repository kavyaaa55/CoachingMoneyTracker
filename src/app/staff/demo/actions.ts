"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { endSession, requireUser } from "@/lib/auth";
import { daysToNextDue, MAX_JUMP_DAYS, moveDemoDate, resetDemo, syncDemoClock } from "@/lib/demo";
import { env } from "@/lib/env";

const moveSchema = z.union([
  z.literal("next-due"),
  z.coerce.number().int().min(1).max(MAX_JUMP_DAYS),
]);

export async function moveTime(formData: FormData) {
  await requireUser("accounts");
  if (!env.DEMO_MODE) notFound();

  const move = moveSchema.safeParse(formData.get("days"));
  if (!move.success) redirect("/staff/demo");

  await syncDemoClock();
  const days = move.data === "next-due" ? await daysToNextDue() : move.data;
  const counts = await moveDemoDate(days);

  const summary = new URLSearchParams({
    moved: String(days),
    sent: String(counts.remindersSent),
    stopped: String(counts.remindersStopped),
    paid: String(counts.paymentsMatched),
    tasks: String(counts.tasksCreated),
  });
  redirect(`/staff/demo?${summary}`);
}

/** Every user is recreated, so each session ends and sign-in is the honest next step. */
export async function resetEverything() {
  await requireUser("accounts");
  if (!env.DEMO_MODE) notFound();

  await resetDemo();
  await endSession();
  redirect("/login");
}
