import { Zernio } from "@zernio/node";
import type { WhatsappIncomingMessageJob } from "../queues/zernio-events.js";
import { STAGE_MESSAGES, type StageId } from "./whatsapp-stages.js";
import { getFindJobSearchFlowId } from "./stages/find-job/flow.js";
import type { CarouselCard } from "./jobs/job-carousel.js";

export async function sendStageMessage(
  stage: StageId,
  job: WhatsappIncomingMessageJob,
  apiKey: string,
  idempotencyKey: string,
  signal: AbortSignal,
): Promise<void> {
  const definition = STAGE_MESSAGES[stage];
  const zernio = new Zernio({ apiKey });

  if (definition.flow) {
    const flowId = getFindJobSearchFlowId();
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
                  flow_action_payload: { screen: definition.flow.screen },
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

  const { error } = await zernio.messages.sendInboxMessage({
    path: { conversationId: job.conversationId },
    body: {
      accountId: job.accountId,
      message: definition.body,
      ...(definition.imageUrl
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
      buttons: buttons.map((button) => ({ type: "postback" as const, ...button })),
    },
    headers: { "Idempotency-Key": idempotencyKey },
    signal,
  });

  if (error) {
    throw new Error("Zernio message send failed", { cause: error });
  }
}
