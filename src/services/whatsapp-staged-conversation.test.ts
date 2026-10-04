import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { STAGE_MESSAGES } from "./whatsapp-stages.js";
import type {
  ConversationStage,
  ConversationState,
} from "./whatsapp-conversation-state.js";
import { handleStagedConversation } from "./whatsapp-staged-conversation.js";
import type { WhatsappIncomingMessageJob } from "../queues/zernio-events.js";

const EXPECTED_STAGES: ConversationStage[] = [
  "get_started",
  "tafuta_kazi",
  "tangaza_kazi",
  "taarifa_zaidi",
];

describe("STAGE_MESSAGES map", () => {
  it("contains get_started plus the three get-started options as stages", () => {
    assert.deepEqual(new Set(Object.keys(STAGE_MESSAGES)), new Set(EXPECTED_STAGES));
  });

  it("gives every child stage a back button to get_started", () => {
    for (const stage of EXPECTED_STAGES.filter((s) => s !== "get_started")) {
      const buttons = STAGE_MESSAGES[stage].buttons;
      assert.ok(
        buttons.some((b) => b.payload === "get_started"),
        `${stage} should include a back button to get_started`,
      );
    }
  });

  it("gives get_started three option buttons that are themselves stages", () => {
    const payloads = STAGE_MESSAGES["get_started"].buttons.map((b) => b.payload);
    assert.deepEqual(new Set(payloads), new Set(["tafuta_kazi", "tangaza_kazi", "taarifa_zaidi"]));
  });
});

type FakeRedis = {
  store: Map<string, string>;
  get: (key: string) => Promise<string | null>;
  set: (
    key: string,
    value: string,
    ..._args: unknown[]
  ) => Promise<string>;
};

function makeRedis(): FakeRedis {
  const store = new Map<string, string>();
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    },
  };
}

function makeJob(
  overrides: Partial<WhatsappIncomingMessageJob> = {},
): WhatsappIncomingMessageJob {
  return {
    eventId: "evt-1",
    personKey: "person-1",
    accountId: "acct-1",
    conversationId: "conv-1",
    standby: false,
    ...overrides,
  };
}

function makeState(
  overrides: Partial<ConversationState> = {},
): ConversationState {
  return {
    stage: "get_started",
    promptSent: true,
    promptEventId: "evt-0",
    responses: [],
    ...overrides,
  };
}

const silentLogger = {
  info: () => {},
  error: () => {},
} as unknown as import("fastify").FastifyBaseLogger;

describe("handleStagedConversation transitions", () => {
  let fetchCalls: { url: URL; body: Record<string, unknown> }[] = [];
  let originalFetch: typeof fetch;

  beforeEach(() => {
    fetchCalls = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
      let parsed: Record<string, unknown>;
      let url: URL;
      if (input instanceof Request) {
        url = new URL(input.url);
        const text = await input.text();
        parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } else {
        parsed = JSON.parse(String(init?.body)) as Record<string, unknown>;
        url = new URL(String(input));
      }
      fetchCalls.push({ url, body: parsed });
      return new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("selecting tafuta_kazi moves to that stage and sends its placeholder", async () => {
    const redis = makeRedis();
    const state = makeState();
    await handleStagedConversation({
      job: makeJob({ eventId: "evt-select", interactiveId: "tafuta_kazi" }),
      redis: redis as never,
      apiKey: "key",
      logger: silentLogger,
      signal: AbortSignal.timeout(5000),
      key: "k",
      state,
    });

    assert.equal(state.stage, "tafuta_kazi");
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].body["message"], "[Placeholder] Tafuta kazi message");
    const buttons = fetchCalls[0].body["buttons"] as { payload: string }[];
    assert.ok(buttons.some((b) => b.payload === "get_started"));
    const saved = JSON.parse(redis.store.get("k") as string) as ConversationState;
    assert.equal(saved.stage, "tafuta_kazi");
  });

  it("free text replays the current stage without changing it", async () => {
    const redis = makeRedis();
    const state = makeState({ stage: "tafuta_kazi" });
    await handleStagedConversation({
      job: makeJob({ eventId: "evt-free" }),
      redis: redis as never,
      apiKey: "key",
      logger: silentLogger,
      signal: AbortSignal.timeout(5000),
      key: "k",
      state,
    });

    assert.equal(state.stage, "tafuta_kazi");
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].body["message"], "[Placeholder] Tafuta kazi message");
  });

  it("last tap wins even from an old message", async () => {
    const redis = makeRedis();
    const state = makeState({ stage: "tafuta_kazi" });
    await handleStagedConversation({
      job: makeJob({ eventId: "evt-switch", interactiveId: "tangaza_kazi" }),
      redis: redis as never,
      apiKey: "key",
      logger: silentLogger,
      signal: AbortSignal.timeout(5000),
      key: "k",
      state,
    });

    assert.equal(state.stage, "tangaza_kazi");
    assert.equal(fetchCalls[0].body["message"], "[Placeholder] Tangaza kazi message");
  });

  it("back button returns to get_started and re-sends the menu", async () => {
    const redis = makeRedis();
    const state = makeState({ stage: "tafuta_kazi" });
    await handleStagedConversation({
      job: makeJob({ eventId: "evt-back", interactiveId: "get_started" }),
      redis: redis as never,
      apiKey: "key",
      logger: silentLogger,
      signal: AbortSignal.timeout(5000),
      key: "k",
      state,
    });

    assert.equal(state.stage, "get_started");
    assert.equal(fetchCalls[0].body["message"], STAGE_MESSAGES["get_started"].body);
  });
});
