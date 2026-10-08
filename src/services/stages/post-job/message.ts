import type { StageMessage } from "../stage-types.js";
import { BACK_BUTTON } from "../stage-types.js";
import { POST_JOB_FLOW_CTA, POST_JOB_FLOW_SCREEN } from "./flow.js";

export const POST_JOB_MESSAGE: StageMessage = {
  body: [
    "Weka tangazo lako la kazi hapa.",
    "",
    "Bofya *Weka Tangazo* kujaza fomu: jina, maelezo, eneo na bajeti. Utaweza kuweka picha ya kazi (hiari).",
  ].join("\n"),
  buttons: [BACK_BUTTON],
  flow: {
    cta: POST_JOB_FLOW_CTA,
    screen: POST_JOB_FLOW_SCREEN,
    mode: "draft",
  },
};
