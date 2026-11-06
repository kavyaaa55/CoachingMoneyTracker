import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { paymentEventSchema, recordPayment } from "@/lib/payments";
import { verifyBody } from "@/lib/signing";

const SIGNATURE_HEADER = "x-gateway-signature";

function parse(body: string) {
  try {
    return paymentEventSchema.safeParse(JSON.parse(body));
  } catch {
    return null;
  }
}

const MAX_BODY_BYTES = 64_000;

export async function POST(request: Request) {
  // Checked before reading, so an unsigned request cannot make the server hold a huge body.
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    return Response.json({ error: "Too large" }, { status: 413 });
  }

  const body = await request.text();
  const signature = request.headers.get(SIGNATURE_HEADER);

  if (!verifyBody(body, signature, env.GATEWAY_WEBHOOK_SECRET)) {
    log("warn", "webhook.bad_signature");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = parse(body);
  if (!event?.success) {
    log("error", "webhook.invalid_event");
    return Response.json({ error: "Invalid event" }, { status: 400 });
  }

  return Response.json(await recordPayment(event.data));
}
