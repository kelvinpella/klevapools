import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import type { WhatsappIncomingMessageJob } from "../queues/zernio-events.js";
import {
  saveConversationState,
  stageIdempotencyKey,
  type ConversationState,
} from "./whatsapp-conversation-state.js";
import {
  STAGE_MESSAGES,
  isStageId,
} from "./whatsapp-stages.js";
import { sendStageMessage } from "./whatsapp-stage-messages.js";

export type StagedConversationContext = {
  job: WhatsappIncomingMessageJob;
  redis: Redis;
  apiKey: string;
  logger: FastifyBaseLogger;
  signal: AbortSignal;
  key: string;
  state: ConversationState;
};

function responseLabel(stage: ConversationState["stage"]): string {
  const definition = STAGE_MESSAGES[stage];
  const button = definition.buttons.find((item) => item.payload === stage);
  if (button) return button.title;
  if (stage === "get_started") return "Get started";
  if (stage === "tafuta_kazi") return "Tafuta kazi";
  if (stage === "tangaza_kazi") return "Tangaza kazi";
  return "Taarifa zaidi";
}

export async function handleStagedConversation({
  job,
  redis,
  apiKey,
  logger,
  signal,
  key,
  state,
}: StagedConversationContext): Promise<void> {
  // No prompt sent yet (new conversation race or migrated state): send current stage.
  if (!state.promptSent) {
    await sendStageMessage(
      state.stage,
      { ...job, eventId: state.promptEventId },
      apiKey,
      stageIdempotencyKey(state.stage, state.promptEventId),
      signal,
    );
    signal.throwIfAborted();
    state.promptSent = true;
    await saveConversationState(redis, key, state);
    logger.info(
      { eventId: state.promptEventId, stage: state.stage },
      "Sent WhatsApp stage message",
    );
    return;
  }

  // Last tap wins: any recognized Stage payload moves to that Stage.
  if (isStageId(job.interactiveId)) {
    const target = job.interactiveId;
    await sendStageMessage(
      target,
      job,
      apiKey,
      stageIdempotencyKey(target, job.eventId),
      signal,
    );
    signal.throwIfAborted();
    state.stage = target;
    state.promptSent = true;
    state.responses.push({
      stage: target,
      response: responseLabel(target),
      eventId: job.eventId,
      receivedAt: new Date().toISOString(),
    });
    await saveConversationState(redis, key, state);
    logger.info(
      { eventId: job.eventId, stage: target },
      "Received WhatsApp stage selection",
    );
    return;
  }

  // Free text or unknown payload: replay current Stage (7-day resume included).
  // All outbound is through defined interactive messages.
  await sendStageMessage(
    state.stage,
    job,
    apiKey,
    stageIdempotencyKey(state.stage, job.eventId),
    signal,
  );
  signal.throwIfAborted();
  await saveConversationState(redis, key, state);
  logger.info(
    { eventId: job.eventId, stage: state.stage },
    "Replayed current WhatsApp stage message",
  );
}
