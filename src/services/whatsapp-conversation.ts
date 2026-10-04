import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import type { WhatsappIncomingMessageJob } from "../queues/zernio-events.js";
import {
  conversationKey,
  loadConversationState,
} from "./whatsapp-conversation-state.js";
import { handleNewConversation } from "./whatsapp-new-conversation.js";
import { handleStagedConversation } from "./whatsapp-staged-conversation.js";
import { sendTypingIndicator } from "./zernio-typing-indicator.js";

export async function processWhatsappMessage(
  job: WhatsappIncomingMessageJob,
  redis: Redis,
  apiKey: string,
  logger: FastifyBaseLogger,
  signal: AbortSignal,
): Promise<void> {
  if (job.standby) {
    logger.info({ eventId: job.eventId }, "Skipping WhatsApp standby message");
    return;
  }

  await sendTypingIndicator(
    job.conversationId,
    job.accountId,
    apiKey,
    logger,
    signal,
  );

  signal.throwIfAborted();
  const key = conversationKey(job.personKey, job.accountId);
  const state = await loadConversationState(redis, key);
  signal.throwIfAborted();

  if (!state) {
    await handleNewConversation({ job, redis, apiKey, logger, signal, key });
    return;
  }

  await handleStagedConversation({
    job,
    redis,
    apiKey,
    logger,
    signal,
    key,
    state,
  });
}
