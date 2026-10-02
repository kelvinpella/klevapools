import type { FastifyPluginAsync } from "fastify";
import {
  isValidZernioSignature,
  parseZernioWebhookBody,
  processZernioEvent,
  type ParsedZernioWebhookBody,
} from "../../services/zernio-events.js";

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
    async (request, reply) => {
      const secret = process.env.ZERNIO_WEBHOOK_SECRET;
      if (!secret) {
        request.log.error("ZERNIO_WEBHOOK_SECRET is not configured");
        return reply.code(500).send({ error: "Webhook is not configured" });
      }

      const signature = request.headers["x-zernio-signature"];
      if (
        !isValidZernioSignature(
          request.body.rawBody,
          typeof signature === "string" ? signature : undefined,
          secret,
        )
      ) {
        return reply.code(401).send({ error: "Invalid webhook signature" });
      }

      const { payload } = request.body;

      setImmediate(() => {
        try {
          processZernioEvent(payload, request.log);
        } catch (error) {
          request.log.error(
            { err: error, eventId: payload.id },
            "Zernio event processing failed",
          );
        }
      });
      return reply.code(200).send({ received: true });
    },
  );
};

export default zernioWebhookRoutes;
