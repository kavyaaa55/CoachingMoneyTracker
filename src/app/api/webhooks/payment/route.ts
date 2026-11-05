import { env } from "@/lib/env";
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

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get(SIGNATURE_HEADER);

  if (!verifyBody(body, signature, env.GATEWAY_WEBHOOK_SECRET)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = parse(body);
  if (!event?.success) {
    return Response.json({ error: "Invalid event" }, { status: 400 });
  }

  return Response.json(await recordPayment(event.data));
}
