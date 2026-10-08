import { Zernio } from "@zernio/node";

// Draft-only Flow JSON for posting a job (Tangaza kazi).
// Lifecycle: DRAFT -> upload JSON -> send with draft:true for testing.
// Never published by this codebase.
// Screen 1 (DETAILS): title, description, area, budget. Button: Endelea.
// Screen 2 (PICHA): optional single PhotoPicker. Button: Tangaza.
export const POST_JOB_FLOW_NAME = "tangaza_kazi";
export const POST_JOB_FLOW_CATEGORIES = ["SURVEY"] as const;
export const POST_JOB_FLOW_SCREEN = "DETAILS";
export const POST_JOB_FLOW_CTA = "Weka Tangazo";

export const POST_JOB_FLOW_JSON = {
  version: "7.1",
  screens: [
    {
      id: "DETAILS",
      title: "Tangaza kazi",
      terminal: false,
      data: {
        init_values: {
          type: "object",
          __example__: {
            title: "Mpishi wa pilau anahitajika",
            description: "Nahitaji mpishi wa pilau weekend",
            area: "Mbezi, Dar es Salaam",
            budget: "50000",
          },
        },
      },
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "Form",
            name: "details_form",
            ["init-values"]: "${data.init_values}",
            children: [
              {
                type: "TextHeading",
                text: "Tangaza kazi",
              },
              {
                type: "TextInput",
                label: "Jina la kazi",
                required: true,
                name: "title",
                ["input-type"]: "text",
                ["max-chars"]: 80,
                ["helper-text"]: "Mpishi wa pilau anahitajika",
              },
              {
                type: "TextArea",
                label: "Maelezo",
                required: true,
                name: "description",
                ["max-length"]: 500,
                ["helper-text"]: "Eleza kazi kwa kifupi",
              },
              {
                type: "TextInput",
                label: "Eneo",
                required: true,
                name: "area",
                ["input-type"]: "text",
                ["max-chars"]: 80,
                ["helper-text"]: "Mfano: Mbezi, Dar es Salaam",
              },
              {
                type: "TextInput",
                label: "Bajeti(Tsh)",
                required: true,
                name: "budget",
                ["input-type"]: "number",
                ["helper-text"]: "Mfano: 50000",
              },
              {
                type: "Footer",
                label: "Endelea",
                ["on-click-action"]: {
                  name: "navigate",
                  next: { type: "screen", name: "PICHA" },
                  payload: {
                    title: "${form.title}",
                    description: "${form.description}",
                    area: "${form.area}",
                    budget: "${form.budget}",
                  },
                },
              },
            ],
          },
        ],
      },
    },
    {
      id: "PICHA",
      title: "Weka picha ya kazi",
      terminal: true,
      data: {
        title: {
          type: "string",
          __example__: "Mpishi wa pilau anahitajika",
        },
        description: {
          type: "string",
          __example__: "Nahitaji mpishi wa pilau weekend",
        },
        area: {
          type: "string",
          __example__: "Mbezi, Dar es Salaam",
        },
        budget: {
          type: "string",
          __example__: "50000",
        },
      },
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "Form",
            name: "photo_form",
            children: [
              {
                type: "TextHeading",
                text: "Weka picha ya kazi",
              },
              {
                type: "PhotoPicker",
                name: "job_image",
                label: "Weka picha ya kazi",
                description:
                  "Mfano: picha ya eneo la kusafishwa. JPG/PNG, max 5MB. iPhone (HEIC): Settings > Camera > Formats > Most Compatible",
                ["photo-source"]: "camera_gallery",
                ["max-file-size-kb"]: 5120,
                ["min-uploaded-photos"]: 0,
                ["max-uploaded-photos"]: 1,
              },
              {
                type: "Footer",
                label: "Tangaza",
                ["on-click-action"]: {
                  name: "complete",
                  payload: {
                    title: "${data.title}",
                    description: "${data.description}",
                    area: "${data.area}",
                    budget: "${data.budget}",
                    job_image: "${form.job_image}",
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

export function getPostJobFlowId(): string | undefined {
  return process.env["ZERNIO_TANGAZA_FLOW_ID"];
}

export type PostJobFlowMedia = {
  file_name?: unknown;
  mime_type?: unknown;
  cdn_url?: unknown;
  media_id?: unknown;
  id?: unknown;
  encryption_metadata?: unknown;
};

export type PostJobSubmit = {
  title?: unknown;
  description?: unknown;
  area?: unknown;
  budget?: unknown;
  job_image?: unknown;
  raw: unknown;
};

// Uses official @zernio/node SDK. Creates a DRAFT and uploads JSON.
// Never calls publish — stays DRAFT for testing.
// Reuses the existing DRAFT with the same name if Meta reports
// "Flow name is not unique" (error_subcode 4016019).
export async function createPostJobDraftFlow(
  accountId: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ flowId: string; reused: boolean }> {
  const zernio = new Zernio({ apiKey });

  const uploadJson = async (flowId: string): Promise<void> => {
    const { error: uploadError } =
      await zernio.whatsappflows.uploadWhatsAppFlowJson({
        path: { flowId },
        body: { accountId, flow_json: POST_JOB_FLOW_JSON },
        signal,
      });
    if (uploadError) {
      throw new Error("Zernio flow JSON upload failed", { cause: uploadError });
    }
  };

  const listFlowsByName = async (
    name: string,
  ): Promise<{ id?: string; name?: string; status?: string }[]> => {
    const { data, error } = await zernio.whatsappflows.listWhatsAppFlows({
      query: { accountId },
      signal,
    });
    if (error || !data?.flows) return [];
    return data.flows.filter(
      (flow: { name?: string }) => flow.name === name,
    );
  };

  const createWithName = async (
    name: string,
  ): Promise<{ flowId: string } | undefined> => {
    try {
      const { data, error } = await zernio.whatsappflows.createWhatsAppFlow({
        body: {
          accountId,
          name,
          categories: [...POST_JOB_FLOW_CATEGORIES],
        },
        signal,
      });
      if (!error && data?.flow?.id) return { flowId: data.flow.id };
    } catch {
      // Name taken (4016019) surfaces as a thrown _ZernioApiError here —
      // fall through to DRAFT reuse / versioned-name retry below.
    }
    return undefined;
  };

  const created = await createWithName(POST_JOB_FLOW_NAME);
  if (created) {
    await uploadJson(created.flowId);
    return { flowId: created.flowId, reused: false };
  }

  const existing = await listFlowsByName(POST_JOB_FLOW_NAME);
  const draft = existing.find((flow) => flow.status === "DRAFT" && flow.id);
  if (draft?.id) {
    await uploadJson(draft.id);
    return { flowId: draft.id, reused: true };
  }

  for (let version = 2; version <= 5; version += 1) {
    const versioned = `${POST_JOB_FLOW_NAME}_v${version}`;
    const alreadyTaken = (await listFlowsByName(versioned)).length > 0;
    if (alreadyTaken) continue;
    const retry = await createWithName(versioned);
    if (retry) {
      await uploadJson(retry.flowId);
      console.warn(
        `[post-job-flow] Name ${POST_JOB_FLOW_NAME} taken (status: ${existing.map((flow) => flow.status).join(",") || "unknown"}), created ${versioned} instead.`,
      );
      return { flowId: retry.flowId, reused: false };
    }
  }

  throw new Error(
    `Zernio flow draft creation failed: name ${POST_JOB_FLOW_NAME} taken by non-DRAFT flow (${existing.map((flow) => `${flow.status}:${flow.id}`).join(", ") || "unknown"}). Rename the constant or delete the blocking flow.`,
  );
}

export function parsePostJobResponse(responseData: unknown): PostJobSubmit {
  const record =
    typeof responseData === "object" && responseData !== null
      ? (responseData as Record<string, unknown>)
      : {};
  return {
    title: record["title"],
    description: record["description"],
    area: record["area"],
    budget: record["budget"],
    job_image: record["job_image"],
    raw: responseData,
  };
}
