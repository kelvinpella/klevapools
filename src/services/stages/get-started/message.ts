import type { StageMessage } from "../stage-types.js";

export const GET_STARTED_MESSAGE: StageMessage = {
  body: "Karibu Naja! Chagua unachotaka kufanya.",
  imageUrl: "https://placehold.co/1200x630/png?text=Naja+Marketplace",
  imageType: "image",
  buttons: [
    { type: "postback", title: "Tafuta kazi", payload: "tafuta_kazi" },
    { type: "postback", title: "Tangaza kazi", payload: "tangaza_kazi" },
    { type: "postback", title: "Taarifa zaidi", payload: "taarifa_zaidi" },
  ],
};
