export type StageId =
  | "get_started"
  | "tafuta_kazi"
  | "tafuta_kazi_search"
  | "tafuta_kazi_mixed"
  | "tangaza_kazi"
  | "taarifa_zaidi"
  | "job_detail"
  | "job_apply";

export type StageButton = {
  type: "postback";
  title: string;
  payload: string;
};

export type StageFlow = {
  cta: string;
  screen: string;
  mode: "draft";
};

export type StageMessage = {
  body: string;
  imageUrl?: string;
  imageType?: "image" | "video" | "audio" | "file";
  buttons: StageButton[];
  flow?: StageFlow;
};

export const BACK_BUTTON: StageButton = {
  type: "postback",
  title: "Rudi nyuma",
  payload: "get_started",
};
