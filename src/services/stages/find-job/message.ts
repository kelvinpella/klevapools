import type { StageMessage } from "../stage-types.js";
import { BACK_BUTTON } from "../stage-types.js";

export const FIND_JOB_BANNER_URL =
  "https://res.cloudinary.com/dpw2dpthx/image/upload/v1791161180/tafuta_kazi_banner_iw3axp.jpg";

export const FIND_JOB_MESSAGE: StageMessage = {
  body: [
    "*Maelezo*",
    "",
    "1. Bofya *Andika jina la kazi* kama wahitaji kutafuta(search) kwa kuandika jina la kazi unayoitaka",
    "",
    "2. Bofya *Kazi mpya mchanganyiko* kama wahitaji kuona kazi mchanganyiko zote zilizotangazwa hivi karibuni.",
    "",
    "3. Bofya *Rudi nyuma* kama wahitaji kurudi kwenye menyu kuu.",
  ].join("\n"),
  imageUrl: FIND_JOB_BANNER_URL,
  imageType: "image",
  buttons: [
    { type: "postback", title: "Andika jina la kazi", payload: "tafuta_kazi_search" },
    { type: "postback", title: "Kazi mpya mchanganyiko", payload: "tafuta_kazi_mixed" },
    BACK_BUTTON,
  ],
};
