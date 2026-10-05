import { Zernio } from "@zernio/node";

// Draft-only Flow JSON for keyword search.
// Lifecycle: DRAFT -> upload JSON -> send with draft:true for testing.
// Never published by this codebase.
export const FIND_JOB_SEARCH_FLOW_NAME = "tafuta_kazi_search";
export const FIND_JOB_SEARCH_FLOW_CATEGORIES = ["SURVEY"] as const;
export const FIND_JOB_SEARCH_FLOW_SCREEN = "SEARCH";
export const FIND_JOB_SEARCH_FLOW_CTA = "Tafuta";

export const FIND_JOB_SEARCH_FLOW_JSON = {
  version: "7.1",
  screens: [
    {
      id: "SEARCH",
      title: "Tafuta kazi",
      terminal: true,
      data: {
        keyword: {
          type: "string",
          __example__: "mpishi",
        },
      },
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "Form",
            name: "search_form",
            init_values: {},
            children: [
              {
                type: "TextHeading",
                text: "Tafuta kazi",
              },
              {
                type: "TextInput",
                label: "Andika jina la kazi",
                required: true,
                name: "keyword",
                input_type: "text",
                helper_text: "Mfano: mpishi, dereva, mlinzi",
              },
              {
                type: "Footer",
                label: "Tafuta",
                on_click_action: {
                  name: "complete",
                  payload: {
                    keyword: "${form.keyword}",
                  },
                },
              },
            ],
          },
        ],
      },
    },
  ],
};

export function getFindJobSearchFlowId(): string | undefined {
  return (
    process.env["ZERNIO_FIND_JOB_FLOW_ID"] ??
    process.env["ZERNIO_TAFUTA_FLOW_ID"]
  );
}

export type FindJobSearchResult = {
  keyword?: unknown;
  raw: unknown;
};

// Uses official @zernio/node SDK. Creates a DRAFT and uploads JSON.
// Never calls publish — stays DRAFT for testing.
export async function createFindJobSearchDraftFlow(
  accountId: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ flowId: string }> {
  const zernio = new Zernio({ apiKey });

  const { data, error } = await zernio.whatsappflows.createWhatsAppFlow({
    body: {
      accountId,
      name: FIND_JOB_SEARCH_FLOW_NAME,
      categories: [...FIND_JOB_SEARCH_FLOW_CATEGORIES],
    },
    signal,
  });
  if (error || !data) {
    throw new Error("Zernio flow draft creation failed", { cause: error });
  }
  const flowId = data.flow?.id;
  if (!flowId) {
    throw new Error("Zernio flow draft creation returned no id");
  }

  const { error: uploadError } =
    await zernio.whatsappflows.uploadWhatsAppFlowJson({
      path: { flowId },
      body: { accountId, flow_json: FIND_JOB_SEARCH_FLOW_JSON },
      signal,
    });
  if (uploadError) {
    throw new Error("Zernio flow JSON upload failed", { cause: uploadError });
  }

  return { flowId };
}

export function parseFindJobSearchResponse(
  responseData: unknown,
): FindJobSearchResult {
  const record =
    typeof responseData === "object" && responseData !== null
      ? (responseData as Record<string, unknown>)
      : {};
  return { keyword: record["keyword"], raw: responseData };
}
