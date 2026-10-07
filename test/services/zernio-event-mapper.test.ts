import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { toWhatsappMessageJob } from "../../src/services/zernio-event-mapper.js";

function basePayload() {
  return {
    id: "evt-1",
    account: { accountId: "acct-1" },
    conversation: { id: "conv-1" },
    message: {
      sender: { businessScopedUserId: "sender-identity-123" },
    },
  };
}

describe("toWhatsappMessageJob tap routing", () => {
  it("prefers interactiveId for menu buttons", () => {
    const job = toWhatsappMessageJob({
      ...basePayload(),
      metadata: { interactiveId: "tafuta_kazi" },
    });
    assert.equal(job?.interactiveId, "tafuta_kazi");
  });

  it("captures carousel quick-reply taps from buttonPayload", () => {
    const job = toWhatsappMessageJob({
      ...basePayload(),
      metadata: {
        buttonPayload: "job_more:mixed:9",
        quotedMessageId: "wamid.x",
        quotedMessage: "text",
      },
    });
    assert.equal(job?.interactiveId, "job_more:mixed:9");
  });

  it("prefers interactiveId when both tap fields are present", () => {
    const job = toWhatsappMessageJob({
      ...basePayload(),
      metadata: {
        interactiveId: "get_started",
        buttonPayload: "job_more:mixed:9",
      },
    });
    assert.equal(job?.interactiveId, "get_started");
  });
});
