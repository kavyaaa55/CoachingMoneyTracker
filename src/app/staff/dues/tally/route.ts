import { redirect } from "next/navigation";
import { z } from "zod";
import { tallyCsv } from "@/domain/tally";
import { requireUser } from "@/lib/auth";
import { tallyCreditNotes, tallyReceipts } from "@/lib/dues";

const querySchema = z.object({
  centre: z.uuid().optional(),
  batch: z.string().max(100).optional(),
  from: z.iso.date(),
  to: z.iso.date(),
});

export async function GET(request: Request) {
  await requireUser("accounts");

  const params = new URL(request.url).searchParams;
  const backTo = (error: string) => {
    const back = new URLSearchParams(params);
    back.set("error", error);
    return `/staff/dues?${back}`;
  };

  const query = querySchema.safeParse(Object.fromEntries(params));
  if (!query.success || query.data.from > query.data.to) redirect(backTo("dates"));
  const { centre, batch, from, to } = query.data;

  const range = { from, to, centreId: centre ?? null, batch: batch ?? null };
  const [receipts, creditNotes] = await Promise.all([
    tallyReceipts(range),
    tallyCreditNotes(range),
  ]);
  const vouchers = [...receipts, ...creditNotes].sort((a, b) => a.paidOn.localeCompare(b.paidOn));
  if (vouchers.length === 0) redirect(backTo("empty"));

  return new Response(tallyCsv(vouchers), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="tally-receipts-${from}-to-${to}.csv"`,
      "cache-control": "no-store",
    },
  });
}
