import Fastify from "fastify";
import zernioWebhookRoutes from "./routes/webhooks/zernio.js";

const fastify = Fastify({
  logger: true,
});

fastify.get("/", async () => {
  return {
    service: "Naja API",
    status: "ok",
    description: "Connecting Tanzanian households with trusted domestic workers.",
  };
});

fastify.register(zernioWebhookRoutes, { prefix: "/webhooks" });

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
    console.log("Server is running on http://localhost:3000");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
