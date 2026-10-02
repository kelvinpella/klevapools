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
ZERNIO_WEBHOOK_SECRET=replace-with-your-webhook-secret
```

Keep `.env` private. The development command loads it automatically.

## Run locally

```sh
npm run dev
```

The server listens on `http://localhost:3000`. `GET /` returns the service name, status, and description.

## Zernio WhatsApp webhook

Configure a Zernio webhook with:

- URL: `https://<public-host>/webhooks/zernio`
- Secret: the same value as `ZERNIO_WEBHOOK_SECRET`
- Event: `message.received`

The endpoint verifies Zernio's HMAC signature against the raw request body and responds with `200` before processing the event asynchronously. Incoming WhatsApp messages are currently logged; they are not persisted or connected to marketplace workflows yet. Zernio's test webhook can be used to verify delivery.

For local testing, run `npm run dev` first, then run `npm run dev:ngrok` in a second terminal. Use the HTTPS forwarding URL printed by ngrok, followed by `/webhooks/zernio`, in Zernio. The current `dev:ngrok` script expects the ngrok binary at `/tmp/ngrok-darwin-arm64/ngrok` and requires ngrok to be authenticated.