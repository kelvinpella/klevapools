import type { WhatsappIncomingMessageJob } from "../queues/zernio-events.js";
import { sendStageMessage } from "./whatsapp-stage-messages.js";

export async function sendGetStartedMessage(
  job: WhatsappIncomingMessageJob,
  apiKey: string,
  idempotencyKey: string,
  signal: AbortSignal,
): Promise<void> {
  await sendStageMessage("get_started", job, apiKey, idempotencyKey, signal);
}
