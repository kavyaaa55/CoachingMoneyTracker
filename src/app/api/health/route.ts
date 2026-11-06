import { desc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pipelineRuns } from "@/db/schema";
import { errorName, log } from "@/lib/log";

export const dynamic = "force-dynamic";

/** For load balancers and uptime monitors. It reports no data about any person. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    const [latest] = await db
      .select({ runOn: pipelineRuns.runOn })
      .from(pipelineRuns)
      .orderBy(desc(pipelineRuns.runOn))
      .limit(1);

    return Response.json({ status: "ok", lastPipelineRun: latest?.runOn ?? null });
  } catch (error) {
    log("error", "health.database_unreachable", { error: errorName(error) });
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
