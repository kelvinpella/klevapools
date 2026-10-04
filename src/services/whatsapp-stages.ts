export type StageId =
  | "get_started"
  | "tafuta_kazi"
  | "tangaza_kazi"
  | "taarifa_zaidi";

export type StageButton = {
  type: "postback";
  title: string;
  payload: string;
};

export type StageMessage = {
  body: string;
  imageUrl?: string;
  imageType?: "image" | "video" | "audio" | "file";
  buttons: StageButton[];
};

export const BACK_BUTTON: StageButton = {
  type: "postback",
  title: "Rudi nyuma",
  payload: "get_started",
};

export const STAGE_MESSAGES: Record<StageId, StageMessage> = {
  get_started: {
    body: "Karibu Naja! Chagua unachotaka kufanya.",
    imageUrl: "https://placehold.co/1200x630/png?text=Naja+Marketplace",
    imageType: "image",
    buttons: [
      { type: "postback", title: "Tafuta kazi", payload: "tafuta_kazi" },
      { type: "postback", title: "Tangaza kazi", payload: "tangaza_kazi" },
      { type: "postback", title: "Taarifa zaidi", payload: "taarifa_zaidi" },
    ],
  },
  tafuta_kazi: {
    body: "[Placeholder] Tafuta kazi message",
    buttons: [BACK_BUTTON],
  },
  tangaza_kazi: {
    body: "[Placeholder] Tangaza kazi message",
    buttons: [BACK_BUTTON],
  },
  taarifa_zaidi: {
    body: "[Placeholder] Taarifa zaidi message",
    buttons: [BACK_BUTTON],
  },
};

export function isStageId(value: string | undefined): value is StageId {
  return (
    value === "get_started" ||
    value === "tafuta_kazi" ||
    value === "tangaza_kazi" ||
    value === "taarifa_zaidi"
  );
}
