import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  FIND_JOB_SEARCH_FLOW_JSON,
  FIND_JOB_SEARCH_FLOW_CTA,
  FIND_JOB_SEARCH_FLOW_SCREEN,
  parseFindJobSearchResponse,
} from "../../src/services/stages/find-job/flow.js";

describe("find-job search Flow (draft-only)", () => {
  it("uses Tafuta CTA and SEARCH screen", () => {
    assert.equal(FIND_JOB_SEARCH_FLOW_CTA, "Tafuta");
    assert.equal(FIND_JOB_SEARCH_FLOW_SCREEN, "SEARCH");
  });

  it("defines a single search screen with keyword input and Tafuta footer", () => {
    const screen = FIND_JOB_SEARCH_FLOW_JSON.screens[0];
    assert.equal(screen.id, "SEARCH");
    const form = screen.layout.children[0];
    assert.equal(form.type, "Form");
    const input = form.children.find((c) => c.type === "TextInput");
    assert.ok(input);
    assert.equal(input.name, "keyword");
    const footer = form.children.find((c) => c.type === "Footer");
    assert.equal(footer.label, "Tafuta");
  });

  it("parses keyword from flow responses for logging", () => {
    assert.equal(
      parseFindJobSearchResponse({ keyword: "mpishi" }).keyword,
      "mpishi",
    );
  });
});
