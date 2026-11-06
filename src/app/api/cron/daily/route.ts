import { env } from "@/lib/env";
import { runDay } from "@/lib/pipeline";
import { safeEqual } from "@/lib/signing";

/** Called once a day by a scheduler, which sends the secret as a bearer token. */
export async function GET(request: Request) {
  const header = request.headers.get("authorization") ?? "";

  if (!safeEqual(header, `Bearer ${env.CRON_SECRET}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDay();
  return Response.json(result, { status: result.failed.length > 0 ? 500 : 200 });
}
