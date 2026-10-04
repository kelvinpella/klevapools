import { createHash } from "node:crypto";
import type { Redis } from "ioredis";

const STATE_TTL_SECONDS = 7 * 24 * 60 * 60;

export type ConversationStage = "get_started" | "get_started_complete";

export type ConversationResponse = {
  stage: "get_started";
  response: string;
  eventId: string;
  receivedAt: string;
};

export type ConversationState = {
  stage: ConversationStage;
  promptSent: boolean;
  promptEventId: string;
  responses: ConversationResponse[];
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

export async function loadConversationState(
  redis: Redis,
  key: string,
): Promise<ConversationState | null> {
  const value = await redis.get(key);
  if (!value) return null;

  try {
    return JSON.parse(value) as ConversationState;
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
