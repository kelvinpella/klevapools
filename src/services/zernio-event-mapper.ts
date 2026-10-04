import { createHash } from "node:crypto";
import type { WhatsappIncomingMessageJob } from "../queues/zernio-events.js";
import type { ZernioWebhookPayload } from "./zernio-events.js";

export function toWhatsappMessageJob(
  payload: ZernioWebhookPayload,
): WhatsappIncomingMessageJob | null {
  const sender = payload.message?.sender;
  const phoneNumber = sender?.phoneNumber?.replace(/\D/g, "") ?? "";
  const senderIdentity = sender?.businessScopedUserId ?? (phoneNumber || sender?.id);
  const accountId = payload.account?.accountId;
  const conversationId = payload.conversation?.id;
  const eventId = payload.id;

  if (
    !senderIdentity ||
    senderIdentity.length < 5 ||
    !accountId ||
    !conversationId ||
    !eventId
  ) {
    return null;
  }

  const personKey = createHash("sha256").update(senderIdentity).digest("hex");
  const interactiveId = payload.metadata?.interactiveId;

  return {
    eventId,
    personKey,
    accountId,
    conversationId,
    interactiveId:
      typeof interactiveId === "string" ? interactiveId : undefined,
    standby: payload.metadata?.standby === true,
  };
}