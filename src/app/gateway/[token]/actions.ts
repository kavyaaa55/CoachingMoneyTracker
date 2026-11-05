"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { balanceOf } from "@/domain/instalments";
import { nowOnAppDate } from "@/lib/clock";
import { env } from "@/lib/env";
import { instalmentById } from "@/lib/ledger";
import { instalmentIdFromToken } from "@/lib/pay-links";
import type { PaymentEvent, RecordedPayment } from "@/lib/payments";
import { signBody } from "@/lib/signing";

const OVERPAYMENT_PAISE = 100_000;

const formSchema = z.object({
  token: z.string().min(1),
  attempt: z.uuid(),
  outcome: z.enum(["success", "part", "over", "unknown", "fail"]),
});

async function sendWebhook(event: PaymentEvent): Promise<RecordedPayment | null> {
  const body = JSON.stringify(event);

  try {
    const response = await fetch(`${env.APP_URL}/api/webhooks/payment`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gateway-signature": signBody(body, env.GATEWAY_WEBHOOK_SECRET),
      },
      body,
    });
    return response.ok ? ((await response.json()) as RecordedPayment) : null;
  } catch {
    return null;
  }
}

/** Plays the part of the outside gateway. The app itself only trusts the signed webhook. */
export async function payAtGateway(formData: FormData) {
  if (!env.DEMO_MODE) notFound();

  const form = formSchema.safeParse(Object.fromEntries(formData));
  if (!form.success) notFound();

  const { token, attempt, outcome } = form.data;
  const instalmentId = instalmentIdFromToken(token);
  const instalment = instalmentId ? await instalmentById(instalmentId) : null;
  if (!instalment) redirect(`/gateway/${token}`);

  const failedUrl = `/gateway/${token}?failed=1`;
  if (outcome === "fail") redirect(failedUrl);

  const balance = balanceOf(instalment);
  const amounts = {
    success: balance,
    part: Math.max(100, Math.round(balance / 200) * 100),
    over: balance + OVERPAYMENT_PAISE,
    unknown: balance,
  };

  const result = await sendWebhook({
    // The attempt id comes from the page, so a double click sends the same reference.
    gatewayRef: `GW-TEST-${attempt}`,
    instalmentRef: outcome === "unknown" ? null : instalment.id,
    amountPaise: amounts[outcome],
    paidAt: nowOnAppDate().toISOString(),
  });
  if (!result) redirect(failedUrl);

  if (result.status === "unmatched") {
    redirect(`/parent?student=${instalment.studentId}&payment=checking`);
  }
  redirect(
    `/parent?student=${instalment.studentId}&payment=received&receipt=${result.paymentId}`,
  );
}
