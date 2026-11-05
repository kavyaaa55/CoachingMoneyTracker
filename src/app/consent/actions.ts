"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/action-form";
import { db } from "@/db/client";
import { consents } from "@/db/schema";
import { CONSENT_NOTICE_VERSION } from "@/domain/access";
import { requireUser } from "@/lib/auth";
import { childrenOf } from "@/lib/students";

export async function giveConsent(): Promise<FormState> {
  const user = await requireUser("parent");
  const children = await childrenOf(user.id);

  if (children.length > 0) {
    await db
      .insert(consents)
      .values(
        children.map((child) => ({
          studentId: child.id,
          parentId: user.id,
          noticeVersion: CONSENT_NOTICE_VERSION,
        })),
      )
      .onConflictDoNothing();
  }

  redirect("/parent");
}
