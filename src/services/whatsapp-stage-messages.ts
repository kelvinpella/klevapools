import { Zernio } from "@zernio/node";
import type { WhatsappIncomingMessageJob } from "../queues/zernio-events.js";
import { STAGE_MESSAGES, type StageId } from "./whatsapp-stages.js";

export async function sendStageMessage(
  stage: StageId,
  job: WhatsappIncomingMessageJob,
  apiKey: string,
  idempotencyKey: string,
  signal: AbortSignal,
): Promise<void> {
  const definition = STAGE_MESSAGES[stage];
  const zernio = new Zernio({ apiKey });

  const { error } = await zernio.messages.sendInboxMessage({
    path: { conversationId: job.conversationId },
    body: {
      accountId: job.accountId,
      message: definition.body,
      ...(definition.imageUrl
        ? {
            attachmentUrl: definition.imageUrl,
            attachmentType: definition.imageType ?? "image",
          }
        : {}),
      buttons: definition.buttons,
    },
    headers: { "Idempotency-Key": idempotencyKey },
    signal,
  });

  if (error) {
    throw new Error("Zernio message send failed", { cause: error });
  }
}
