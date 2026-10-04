import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import type { WhatsappIncomingMessageJob } from "../queues/zernio-events.js";
import {
  getStartedIdempotencyKey,
  saveConversationState,
  type ConversationState,
} from "./whatsapp-conversation-state.js";
import { sendGetStartedMessage } from "./whatsapp-get-started.js";

const GET_STARTED_OPTIONS = new Map([
  ["tafuta_kazi", "Tafuta kazi"],
  ["tangaza_kazi", "Tangaza kazi"],
  ["taarifa_zaidi", "Taarifa zaidi"],
]);

export type StagedConversationContext = {
  job: WhatsappIncomingMessageJob;
  redis: Redis;
  apiKey: string;
  logger: FastifyBaseLogger;
  signal: AbortSignal;
  key: string;
  state: ConversationState;
};

export async function handleStagedConversation({
  job,
  redis,
  apiKey,
  logger,
  signal,
  key,
  state,
}: StagedConversationContext): Promise<void> {
  if (state.stage === "get_started" && !state.promptSent) {
    await sendGetStartedMessage(
      { ...job, eventId: state.promptEventId },
      apiKey,
      getStartedIdempotencyKey(state.promptEventId),
      signal,
    );
    signal.throwIfAborted();
    state.promptSent = true;
    await saveConversationState(redis, key, state);
    logger.info({ eventId: state.promptEventId }, "Sent get-started WhatsApp menu");
    return;
  }

  const responseId = job.interactiveId;
  const response = responseId ? GET_STARTED_OPTIONS.get(responseId) : undefined;
  if (!response) {
    logger.info(
      { eventId: job.eventId, stage: state.stage },
      "Received WhatsApp message with no recognized stage response",
    );
    return;
  }

  if (!state.responses.some((item) => item.stage === "get_started")) {
    state.responses.push({
      stage: "get_started",
      response,
      eventId: job.eventId,
      receivedAt: new Date().toISOString(),
    });
    state.stage = "get_started_complete";
    await saveConversationState(redis, key, state);
  }

  logger.info(
    { eventId: job.eventId, stage: "get_started", response },
    "Received get-started button response",
  );
}
