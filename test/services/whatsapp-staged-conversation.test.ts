import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { STAGE_MESSAGES as REGISTRY } from "../../src/services/whatsapp-stages.js";
import type {
  ConversationStage,
  ConversationState,
} from "../../src/services/whatsapp-conversation-state.js";
import { handleStagedConversation } from "../../src/services/whatsapp-staged-conversation.js";
import type { WhatsappIncomingMessageJob } from "../../src/queues/zernio-events.js";

const EXPECTED_STAGES: ConversationStage[] = [
  "get_started",
  "tafuta_kazi",
  "tafuta_kazi_search",
  "tafuta_kazi_mixed",
  "tangaza_kazi",
  "taarifa_zaidi",
];

describe("STAGE_MESSAGES map", () => {
  it("contains get_started plus extensible stages", () => {
    assert.deepEqual(new Set(Object.keys(REGISTRY)), new Set(EXPECTED_STAGES));
  });

  it("gives every child stage a back path to get_started", () => {
    for (const stage of EXPECTED_STAGES.filter((s) => s !== "get_started")) {
      const buttons = REGISTRY[stage].buttons;
      assert.ok(
        buttons.some((b) => b.payload === "get_started"),
        `${stage} should include a back button to get_started`,
      );
    }
  });

  it("gives get_started three option buttons that are themselves stages", () => {
    const payloads = REGISTRY["get_started"].buttons.map((b) => b.payload);
    assert.deepEqual(new Set(payloads), new Set(["tafuta_kazi", "tangaza_kazi", "taarifa_zaidi"]));
  });

  it("renders tafuta_kazi menu with banner, formatted body, and ordered options", () => {
    const tafuta = REGISTRY["tafuta_kazi"];
    assert.equal(
      tafuta.imageUrl,
      "https://res.cloudinary.com/dpw2dpthx/image/upload/v1791161180/tafuta_kazi_banner_iw3axp.jpg",
    );
    assert.ok(tafuta.body.includes("*Maelezo*"));
    assert.ok(tafuta.body.includes("*Andika jina la kazi*"));
    assert.ok(tafuta.body.includes("*Kazi mpya mchanganyiko*"));
    assert.ok(tafuta.body.includes("*Rudi nyuma*"));
    assert.deepEqual(
      tafuta.buttons.map((b) => b.payload),
      ["tafuta_kazi_search", "tafuta_kazi_mixed", "get_started"],
    );
    assert.deepEqual(
      tafuta.buttons.map((b) => b.title),
      ["Andika jina la kazi", "Kazi mpya mchanganyiko", "Rudi nyuma"],
    );
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
  let originalFlowId: string | undefined;
  let originalLegacyFlowId: string | undefined;

  beforeEach(() => {
    fetchCalls = [];
    originalFetch = globalThis.fetch;
    originalFlowId = process.env["ZERNIO_FIND_JOB_FLOW_ID"];
    originalLegacyFlowId = process.env["ZERNIO_TAFUTA_FLOW_ID"];
    delete process.env["ZERNIO_FIND_JOB_FLOW_ID"];
    delete process.env["ZERNIO_TAFUTA_FLOW_ID"];
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
    if (originalFlowId === undefined) delete process.env["ZERNIO_FIND_JOB_FLOW_ID"];
    else process.env["ZERNIO_FIND_JOB_FLOW_ID"] = originalFlowId;
    if (originalLegacyFlowId === undefined) delete process.env["ZERNIO_TAFUTA_FLOW_ID"];
    else process.env["ZERNIO_TAFUTA_FLOW_ID"] = originalLegacyFlowId;
  });

  it("selecting tafuta_kazi moves to that stage and sends its menu", async () => {
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
    assert.ok(
      (fetchCalls[0].body["message"] as string).includes("*Maelezo*"),
    );
    const buttons = fetchCalls[0].body["buttons"] as { payload: string }[];
    assert.deepEqual(
      buttons.map((b) => b.payload),
      ["tafuta_kazi_search", "tafuta_kazi_mixed", "get_started"],
    );
    const saved = JSON.parse(redis.store.get("k") as string) as ConversationState;
    assert.equal(saved.stage, "tafuta_kazi");
  });

  it("selecting tafuta_kazi_search moves to search and falls back to buttons without a flow id", async () => {
    const redis = makeRedis();
    const state = makeState({ stage: "tafuta_kazi" });
    await handleStagedConversation({
      job: makeJob({ eventId: "evt-search", interactiveId: "tafuta_kazi_search" }),
      redis: redis as never,
      apiKey: "key",
      logger: silentLogger,
      signal: AbortSignal.timeout(5000),
      key: "k",
      state,
    });

    assert.equal(state.stage, "tafuta_kazi_search");
    assert.equal(fetchCalls.length, 1);
    assert.ok(fetchCalls[0].body["message"]);
    assert.ok(!("interactive" in fetchCalls[0].body));
  });

  it("selecting tafuta_kazi_mixed moves to mixed placeholder", async () => {
    const redis = makeRedis();
    const state = makeState({ stage: "tafuta_kazi" });
    await handleStagedConversation({
      job: makeJob({ eventId: "evt-mixed", interactiveId: "tafuta_kazi_mixed" }),
      redis: redis as never,
      apiKey: "key",
      logger: silentLogger,
      signal: AbortSignal.timeout(5000),
      key: "k",
      state,
    });

    assert.equal(state.stage, "tafuta_kazi_mixed");
    assert.equal(fetchCalls.length, 1);
    assert.ok(
      (fetchCalls[0].body["message"] as string).includes("Kazi mpya mchanganyiko"),
    );
  });

  it("nfm_reply flow responses are logged without sending or changing stage", async () => {
    const redis = makeRedis();
    const logged: Record<string, unknown>[] = [];
    const logger = {
      info: (obj: Record<string, unknown>) => void logged.push(obj),
      error: () => {},
    } as unknown as import("fastify").FastifyBaseLogger;
    const state = makeState({ stage: "tafuta_kazi_search" });
    await handleStagedConversation({
      job: makeJob({
        eventId: "evt-flow",
        interactiveType: "nfm_reply",
        flowResponseData: { keyword: "mpishi" },
      }),
      redis: redis as never,
      apiKey: "key",
      logger,
      signal: AbortSignal.timeout(5000),
      key: "k",
      state,
    });

    assert.equal(state.stage, "tafuta_kazi_search");
    assert.equal(fetchCalls.length, 0);
    assert.equal(logged.length, 1);
    assert.equal(logged[0]["keyword"], "mpishi");
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
    assert.ok(
      (fetchCalls[0].body["message"] as string).includes("*Maelezo*"),
    );
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
    assert.equal(fetchCalls[0].body["message"], REGISTRY["get_started"].body);
  });
});
