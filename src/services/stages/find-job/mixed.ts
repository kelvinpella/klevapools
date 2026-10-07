import type { StageMessage } from "../stage-types.js";
import { BACK_BUTTON } from "../stage-types.js";

export const FIND_JOB_MIXED_MESSAGE: StageMessage = {
  body: "[Placeholder] Kazi mpya mchanganyiko — orodha ya kazi mchanganyiko zilizotangazwa hivi karibuni itaonekana hapa.",
  buttons: [
    { type: "postback", title: "Andika jina la kazi", payload: "tafuta_kazi_search" },
    BACK_BUTTON,
  ],
};
