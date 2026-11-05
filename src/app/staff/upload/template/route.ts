import { redirect } from "next/navigation";
import { z } from "zod";
import { csvCell } from "@/domain/tally";
import { templateColumns, UPLOAD_KINDS } from "@/domain/upload";
import { requireUser } from "@/lib/auth";
import { batchStudents } from "@/lib/upload";

const querySchema = z.object({ batch: z.uuid(), kind: z.enum(UPLOAD_KINDS) });

/** One row per current student, so staff only fill in the blanks. */
export async function GET(request: Request) {
  await requireUser("accounts");

  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) redirect("/staff/upload");
  const { batch, kind } = query.data;

  const columns = templateColumns(kind);
  const blanks = columns.slice(2).map(() => "");
  const current = (await batchStudents(batch)).filter((student) => !student.exitDate);

  const lines = [columns, ...current.map((s) => [s.code, s.name, ...blanks])].map((cells) =>
    cells.map(csvCell).join(","),
  );

  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${kind}-template.csv"`,
      "cache-control": "no-store",
    },
  });
}
