import { createHash } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import type { WhatsappIncomingMessageJob } from "../queues/zernio-events.js";
import { sendTypingIndicator } from "./zernio-typing-indicator.js";

const STATE_TTL_SECONDS = 7 * 24 * 60 * 60;
const GET_STARTED_IMAGE_URL =
  "https://placehold.co/1200x630/png?text=Naja+Marketplace";
const GET_STARTED_BODY = "Karibu Naja! Chagua unachotaka kufanya.";

const GET_STARTED_OPTIONS = new Map([
  ["tafuta_kazi", "Tafuta kazi"],
  ["tangaza_kazi", "Tangaza kazi"],
  ["taarifa_zaidi", "Taarifa zaidi"],
]);

type ConversationResponse = {
  stage: "get_started";
  response: string;
  eventId: string;
  receivedAt: string;
};

type ConversationState = {
  stage: "get_started" | "get_started_complete";
  promptSent: boolean;
  promptEventId: string;
  responses: ConversationResponse[];
};

function stateKey(personKey: string, accountId: string): string {
  const stateHash = createHash("sha256")
    .update(`${accountId}:${personKey}`)
    .digest("hex");
  return `naja:whatsapp:conversation:${stateHash}`;
}

function idempotencyKey(eventId: string): string {
  const eventHash = createHash("sha256").update(eventId).digest("hex");
  return `naja-get-started-${eventHash}`;
}

function parseState(value: string | null): ConversationState | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as ConversationState;
  } catch {
    return null;
  }
}

async function saveState(
  redis: Redis,
  key: string,
  state: ConversationState,
): Promise<void> {
  await redis.set(key, JSON.stringify(state), "EX", STATE_TTL_SECONDS);
}

async function sendGetStartedMessage(
  job: WhatsappIncomingMessageJob,
  apiKey: string,
  key: string,
  signal: AbortSignal,
): Promise<void> {
  const url = new URL(
    `https://zernio.com/api/v1/inbox/conversations/${encodeURIComponent(job.conversationId)}/messages`,
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({
      accountId: job.accountId,
      message: GET_STARTED_BODY,
      attachmentUrl: GET_STARTED_IMAGE_URL,
      attachmentType: "image",
      buttons: [
        { type: "postback", title: "Tafuta kazi", payload: "tafuta_kazi" },
        { type: "postback", title: "Tangaza kazi", payload: "tangaza_kazi" },
        { type: "postback", title: "Taarifa zaidi", payload: "taarifa_zaidi" },
      ],
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Zernio message send failed with status ${response.status}`);
  }
}

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
  const key = stateKey(job.personKey, job.accountId);
  let state = parseState(await redis.get(key));
  signal.throwIfAborted();

  if (!state) {
    state = {
      stage: "get_started",
      promptSent: false,
      promptEventId: job.eventId,
      responses: [],
    };
    await saveState(redis, key, state);
  }

  if (state.stage === "get_started" && !state.promptSent) {
    await sendGetStartedMessage(
      { ...job, eventId: state.promptEventId },
      apiKey,
      idempotencyKey(state.promptEventId),
      signal,
    );
    signal.throwIfAborted();
    state.promptSent = true;
    await saveState(redis, key, state);
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
    await saveState(redis, key, state);
  }

  logger.info(
    { eventId: job.eventId, stage: "get_started", response },
    "Received get-started button response",
  );
}