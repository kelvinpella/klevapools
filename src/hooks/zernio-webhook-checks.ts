import type { FastifyReply, FastifyRequest } from "fastify";
import {
  isValidZernioSignature,
  type ParsedZernioWebhookBody,
} from "../services/zernio-events.js";

export async function checkZernioWebhook(
  request: FastifyRequest<{ Body: ParsedZernioWebhookBody }>,
  reply: FastifyReply,
): Promise<void> {
  const secret = process.env.ZERNIO_WEBHOOK_SECRET;
  if (!secret) {
    request.log.error("ZERNIO_WEBHOOK_SECRET is not configured");
    reply.code(500).send({ error: "Webhook is not configured" });
    return;
  }

  const signature = request.headers["x-zernio-signature"];
  if (
    !isValidZernioSignature(
      request.body.rawBody,
      typeof signature === "string" ? signature : undefined,
      secret,
    )
  ) {
    reply.code(401).send({ error: "Invalid webhook signature" });
    return;
  }

  const { payload } = request.body;
  if (
    payload.event !== "message.received" ||
    payload.account?.platform !== "whatsapp"
  ) {
    reply.code(200).send({ received: true, ignored: true });
  }
}