import { createHash } from "node:crypto";
import type { Redis } from "ioredis";
import type { StageId } from "./whatsapp-stages.js";

const STATE_TTL_SECONDS = 7 * 24 * 60 * 60;

export type ConversationStage = StageId;

export type ConversationResponse = {
  stage: ConversationStage;
  response: string;
  eventId: string;
  receivedAt: string;
};

export type ConversationState = {
  stage: ConversationStage;
  promptSent: boolean;
  promptEventId: string;
  responses: ConversationResponse[];
  selectedJobId?: string;
  listOffset?: number;
  listKeyword?: string;
};

export function conversationKey(personKey: string, accountId: string): string {
  const stateHash = createHash("sha256")
    .update(`${accountId}:${personKey}`)
    .digest("hex");
  return `naja:whatsapp:conversation:${stateHash}`;
}

export function getStartedIdempotencyKey(eventId: string): string {
  const eventHash = createHash("sha256").update(eventId).digest("hex");
  return `naja-get-started-${eventHash}`;
}

export function stageIdempotencyKey(
  stage: ConversationStage,
  eventId: string,
): string {
  if (stage === "get_started") {
    return getStartedIdempotencyKey(eventId);
  }
  const eventHash = createHash("sha256").update(eventId).digest("hex");
  return `naja-${stage}-${eventHash}`;
}

export async function loadConversationState(
  redis: Redis,
  key: string,
): Promise<ConversationState | null> {
  const value = await redis.get(key);
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as ConversationState;
    // Migrate pre-stage-map records where completion was a terminal marker.
    if (
      (parsed.stage as string) === "get_started_complete" &&
      parsed.responses.length > 0
    ) {
      const last = parsed.responses[parsed.responses.length - 1];
      if (
        last.response === "Tafuta kazi" ||
        last.response === "tafuta_kazi"
      ) {
        return { ...parsed, stage: "tafuta_kazi" };
      }
      if (
        last.response === "Tangaza kazi" ||
        last.response === "tangaza_kazi"
      ) {
        return { ...parsed, stage: "tangaza_kazi" };
      }
      return { ...parsed, stage: "get_started" };
    }
    if ((parsed.stage as string) === "get_started_complete") {
      return { ...parsed, stage: "get_started" };
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveConversationState(
  redis: Redis,
  key: string,
  state: ConversationState,
): Promise<void> {
  await redis.set(key, JSON.stringify(state), "EX", STATE_TTL_SECONDS);
}

export async function clearConversationState(
  redis: Redis,
  key: string,
): Promise<void> {
  await redis.del(key);
}
