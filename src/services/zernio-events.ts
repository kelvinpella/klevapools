import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";

export type ZernioWebhookPayload = {
  id?: string;
  event?: string;
  account?: {
    accountId?: string;
    profileId?: string;
    platform?: string;
  };
  conversation?: { id?: string };
  message?: Record<string, unknown>;
};

export type ParsedZernioWebhookBody = {
  rawBody: Buffer;
  payload: ZernioWebhookPayload;
};

export function parseZernioWebhookBody(rawBody: Buffer): ParsedZernioWebhookBody {
  return {
    rawBody,
    payload: JSON.parse(rawBody.toString("utf8")) as ZernioWebhookPayload,
  };
}

export function isValidZernioSignature(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !/^[a-f0-9]{64}$/.test(signature)) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function processZernioEvent(
  payload: ZernioWebhookPayload,
  logger: FastifyBaseLogger,
): void {
  if (
    payload.event !== "message.received" ||
    payload.account?.platform !== "whatsapp"
  ) {
    return;
  }

  logger.info(
    {
      eventId: payload.id,
      accountId: payload.account.accountId,
      profileId: payload.account.profileId,
      conversationId: payload.conversation?.id,
      message: payload.message,
    },
    "Received WhatsApp message",
  );

}