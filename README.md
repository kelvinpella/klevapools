# Naja

Naja is a Fastify API for a WhatsApp-based marketplace connecting Tanzanian households with trusted domestic workers.

## Requirements

- Node.js 26 or later
- npm

## Setup

Install dependencies:

```sh
npm install
```

Create a `.env` file in the project root and set the secret configured for the Zernio webhook:

```env
ZERNIO_API_KEY=your-zernio-api-key
ZERNIO_WEBHOOK_SECRET=replace-with-your-webhook-secret
REDIS_URL=redis://127.0.0.1:6379
```

Keep `.env` private. The development command loads it automatically.

## Run locally

The development script starts local Redis when needed, then starts the API and the separate BullMQ worker:

```sh
npm run dev
```

Press Ctrl+C to stop the API, worker, and any Redis process that the script started. If a local Redis server was already running, the script leaves it running.

For deployment, run `npm start` and `npm run start:worker` as separate processes, both configured with the same `REDIS_URL`. Use a managed or separately supervised Redis instance; `scripts/dev.sh` is for local development.

The server listens on `http://localhost:3000`. `GET /` returns the service name, status, and description.

## Zernio WhatsApp webhook

Configure a Zernio webhook with:

- URL: `https://<public-host>/webhooks/zernio`
- Secret: the same value as `ZERNIO_WEBHOOK_SECRET`
- Event: `message.received`

The endpoint verifies Zernio's HMAC signature against the raw request body and enqueues WhatsApp `message.received` events in the `naja-whatsapp-incoming-messages` BullMQ queue before returning `200`. A Redis-backed person lock prevents the same sender from being processed concurrently. A SHA-256 hash of the stable WhatsApp Business-Scoped User ID is preferred; the phone number is used when the BSUID is unavailable. Raw sender identifiers and message text are not stored in queue job data. If Redis cannot enqueue a message within three seconds, the endpoint returns `503` so Zernio can retry.

Jobs retry up to five times with exponential backoff. Exhausted jobs are copied to the `naja-whatsapp-incoming-messages-dead-letter` queue, and stalled jobs are logged. `SIGINT` and `SIGTERM` close Fastify and gracefully drain the worker.

When a phone has no saved stage, the worker sends a WhatsApp image-header reply-button menu with the options **Tafuta kazi**, **Tangaza kazi**, and **Vigezo na Masharti**. The image URL and body are placeholders. Button responses are associated with the `get_started` stage and temporarily stored in Redis for seven days; this implementation does not write to Supabase or implement later stages yet.

Zernio replies use `ZERNIO_API_KEY`. The webhook endpoint uses `ZERNIO_WEBHOOK_SECRET`, which must match the secret set in Zernio. `REDIS_URL` defaults to `redis://127.0.0.1:6379` if omitted.

For local testing, run `npm run dev` first, then run `npm run dev:ngrok` in a second terminal. Use the HTTPS forwarding URL printed by ngrok, followed by `/webhooks/zernio`, in Zernio. The current `dev:ngrok` script expects the ngrok binary at `/tmp/ngrok-darwin-arm64/ngrok` and requires ngrok to be authenticated.