import type { StageMessage } from "../stage-types.js";
import { BACK_BUTTON } from "../stage-types.js";

export const JOB_DETAIL_MESSAGE: StageMessage = {
  body: "[Job detail]",
  buttons: [BACK_BUTTON],
};
