import { Zernio } from "@zernio/node";
import type { WhatsappIncomingMessageJob } from "../queues/zernio-events.js";
import { STAGE_MESSAGES, type StageId } from "./whatsapp-stages.js";
import { getFindJobSearchFlowId } from "./stages/find-job/flow.js";
import { getPostJobFlowId } from "./stages/post-job/flow.js";
import type { CarouselCard } from "./jobs/job-carousel.js";

export async function sendStageMessage(
  stage: StageId,
  job: WhatsappIncomingMessageJob,
  apiKey: string,
  idempotencyKey: string,
  signal: AbortSignal,
  opts?: { prefill?: Record<string, unknown> },
): Promise<void> {
  const definition = STAGE_MESSAGES[stage];
  const zernio = new Zernio({ apiKey });

  if (definition.flow) {
    const flowId =
      stage === "tangaza_kazi"
        ? getPostJobFlowId()
        : getFindJobSearchFlowId();
    if (flowId) {
      try {
        const { error } = await zernio.messages.sendInboxMessage({
          path: { conversationId: job.conversationId },
          body: {
            accountId: job.accountId,
            message: definition.body,
            interactive: {
              type: "flow",
              body: { text: definition.body },
              action: {
                name: "flow",
                parameters: {
                  flow_token: idempotencyKey.slice(0, 200),
                  flow_id: flowId,
                  flow_cta: definition.flow.cta,
                  flow_action: "navigate",
                  flow_action_payload: {
                    screen: definition.flow.screen,
                    ...(opts?.prefill
                      ? { data: opts.prefill }
                      : {}),
                  },
                  mode: "draft",
                },
              },
            },
          },
          headers: { "Idempotency-Key": idempotencyKey },
          signal,
        });

        if (error) {
          throw new Error("Zernio flow message send failed", { cause: error });
        }
        return;
      } catch (error) {
        // Flow sends depend on WABA/Flow health (e.g. Meta 139000 Blocked by
        // Integrity). Fall back to the plain Stage message so the menu keeps
        // working; the failure is still logged upstream via the thrown job
        // error path. Re-throw only if fallback also fails below.
        // Log redacted cause, then continue to buttons fallback.
        console.warn(
          `[whatsapp-stage-messages] Flow send failed for stage ${stage}, falling back to buttons:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
    // No flow configured (testing without a DRAFT): fall through to buttons.
  }

  const sendButtons = async (withImage: boolean): Promise<void> => {
    const { error } = await zernio.messages.sendInboxMessage({
      path: { conversationId: job.conversationId },
      body: {
        accountId: job.accountId,
        message: definition.body,
        ...(withImage && definition.imageUrl
          ? {
              attachmentUrl: definition.imageUrl,
              attachmentType: definition.imageType ?? "image",
            }
          : {}),
        buttons: definition.buttons,
      },
      headers: { "Idempotency-Key": idempotencyKey },
      signal,
    });

    if (error) {
      throw new Error("Zernio message send failed", { cause: error });
    }
  };

  if (!definition.imageUrl) {
    await sendButtons(false);
    return;
  }

  // A dead banner must never brick the menu: on image failure (bad URL,
  // unreachable host) fall back to the text-only message.
  try {
    await sendButtons(true);
  } catch (error) {
    console.warn(
      `[whatsapp-stage-messages] Image send failed for stage ${stage}, falling back to text-only:`,
      error instanceof Error ? error.message : error,
    );
    await sendButtons(false);
  }
}

export async function sendJobCarousel(
  heading: string,
  cards: CarouselCard[],
  job: WhatsappIncomingMessageJob,
  apiKey: string,
  idempotencyKey: string,
  signal: AbortSignal,
): Promise<void> {
  const zernio = new Zernio({ apiKey });
  const { error } = await zernio.messages.sendInboxMessage({
    path: { conversationId: job.conversationId },
    body: {
      accountId: job.accountId,
      message: heading,
      interactive: {
        type: "carousel",
        body: { text: heading },
        action: {
          cards: cards.map((card, index) => ({
            card_index: index,
            type: "cta_url",
            header: { type: "image", image: { link: card.imageUrl } },
            body: { text: card.body },
            action: {
              buttons: card.buttons.map((button) => ({
                type: "quick_reply",
                quick_reply: { id: button.id, title: button.title },
              })),
            },
          })),
        },
      },
    },
    headers: { "Idempotency-Key": idempotencyKey },
    signal,
  });

  if (error) {
    throw new Error("Zernio carousel send failed", { cause: error });
  }
}

export async function sendJobText(
  body: string,
  buttons: { title: string; payload: string }[],
  job: WhatsappIncomingMessageJob,
  apiKey: string,
  idempotencyKey: string,
  signal: AbortSignal,
  opts?: { imageUrl?: string; imageType?: "image" | "video" | "audio" | "file" },
): Promise<void> {
  const zernio = new Zernio({ apiKey });
  const { error } = await zernio.messages.sendInboxMessage({
    path: { conversationId: job.conversationId },
    body: {
      accountId: job.accountId,
      message: body,
      ...(opts?.imageUrl
        ? {
            attachmentUrl: opts.imageUrl,
            attachmentType: opts.imageType ?? "image",
          }
        : {}),
      // No buttons: plain text message (e.g. terminal confirmations after
      // state is cleared, where a tap would have nowhere to resume to).
      ...(buttons.length > 0
        ? {
            buttons: buttons.map((button) => ({
              type: "postback" as const,
              ...button,
            })),
          }
        : {}),
    },
    headers: { "Idempotency-Key": idempotencyKey },
    signal,
  });

  if (error) {
    throw new Error("Zernio message send failed", { cause: error });
  }
}
