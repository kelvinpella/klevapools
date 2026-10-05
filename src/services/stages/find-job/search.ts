import type { StageMessage } from "../stage-types.js";
import { BACK_BUTTON } from "../stage-types.js";

export const FIND_JOB_SEARCH_MESSAGE: StageMessage = {
  body: "Andika jina la kazi unayoitaka, kisha bofya *Tafuta* kufungua fomu ya kutafuta.",
  buttons: [BACK_BUTTON],
  flow: {
    cta: "Tafuta",
    screen: "SEARCH",
    mode: "draft",
  },
};
