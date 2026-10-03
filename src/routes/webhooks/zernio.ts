import type { FastifyPluginAsync } from "fastify";
import {
  parseZernioWebhookBody,
  type ParsedZernioWebhookBody,
} from "../../services/zernio-events.js";
import { enqueueWhatsappIncomingMessage } from "../../queues/zernio-events.js";
import { checkZernioWebhook } from "../../hooks/zernio-webhook-checks.js";
import { toWhatsappMessageJob } from "../../services/zernio-event-mapper.js";

const zernioWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (request, body, done) => {
      try {
        const rawBody = Buffer.isBuffer(body)
          ? body
          : Buffer.from(body, "utf8");
        done(null, parseZernioWebhookBody(rawBody));
      } catch (error) {
        done(error instanceof Error ? error : new Error("Invalid JSON"));
      }
    },
  );

  app.post<{ Body: ParsedZernioWebhookBody }>(
    "/zernio",
    {
      preHandler: async (request, reply) =>
        checkZernioWebhook(request, reply),
    },
    async (request, reply) => {
      const { payload } = request.body;
      const job = toWhatsappMessageJob(payload);
      if (!job) {
        request.log.warn(
          { eventId: payload.id },
          "WhatsApp message is missing sender identity, account, or conversation ID",
        );
        return reply.code(422).send({ error: "Incomplete WhatsApp message event" });
      }

      try {
        await enqueueWhatsappIncomingMessage(
          app.whatsappIncomingMessagesQueue,
          job,
        );
      } catch (error) {
        request.log.error(
          { err: error, eventId: payload.id },
          "Failed to enqueue WhatsApp message",
        );
        return reply.code(503).send({ error: "Message queue unavailable" });
      }

      return reply.code(200).send({ received: true, queued: true });
    },
  );
};

export default zernioWebhookRoutes;
