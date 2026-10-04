import type { WhatsappIncomingMessageJob } from "../queues/zernio-events.js";

const GET_STARTED_IMAGE_URL =
  "https://placehold.co/1200x630/png?text=Naja+Marketplace";
const GET_STARTED_BODY = "Karibu Naja! Chagua unachotaka kufanya.";

// Raw HTTP predates the AGENTS.md SDK rule: migrate to
// @zernio/node messages.sendInboxMessage once buttons + Idempotency-Key
// support through the SDK is verified.
export async function sendGetStartedMessage(
  job: WhatsappIncomingMessageJob,
  apiKey: string,
  idempotencyKey: string,
  signal: AbortSignal,
): Promise<void> {
  const url = new URL(
    `https://zernio.com/api/v1/inbox/conversations/${encodeURIComponent(job.conversationId)}/messages`,
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      accountId: job.accountId,
      message: GET_STARTED_BODY,
      attachmentUrl: GET_STARTED_IMAGE_URL,
      attachmentType: "image",
      buttons: [
        { type: "postback", title: "Tafuta kazi", payload: "tafuta_kazi" },
        { type: "postback", title: "Tangaza kazi", payload: "tangaza_kazi" },
        { type: "postback", title: "Taarifa zaidi", payload: "taarifa_zaidi" },
      ],
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Zernio message send failed with status ${response.status}`);
  }
}
