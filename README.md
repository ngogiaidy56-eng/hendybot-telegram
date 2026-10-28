# Hendy Telegram Bot (Cloudflare Workers)

Telegram webhook bot deployed as a Cloudflare Worker. Bot tokens and webhook secrets are **Cloudflare secrets**, never values in `wrangler.toml`.

## Features

- Telegram webhook with secret-token validation.
- `/start`, `/help`, and `/id` commands.
- Inline menu for customer support, Vietsub requests, Mini App, and admin actions.
- Optional Cloudflare KV persistence for user profiles and conversation state.
- Optional backend integration through `CORE_BACKEND_URL/api/bot-trigger`.
- Protected webhook setup and status endpoints.

## 1. Rotate the exposed bot token first

The previous `wrangler.toml` contained a bot token in source control. Treat that token as compromised and revoke/regenerate it in **@BotFather**. Use only the new token from this point on. Removing it from the current file does not remove it from Git history.

## 2. Install and configure

Requirements: Node.js 20+ and a Cloudflare account with Wrangler access.

```bash
npm install
npx wrangler login
npx wrangler secret put BOT_TOKEN
npx wrangler secret put WEBHOOK_SECRET_TOKEN
npx wrangler secret put WEBHOOK_SETUP_KEY
```

Use three separate values:
- `BOT_TOKEN`: the new token from BotFather.
- `WEBHOOK_SECRET_TOKEN`: 32+ random characters containing only letters, numbers, underscores or hyphens.
- `WEBHOOK_SETUP_KEY`: another strong random secret used to protect setup endpoints.

Do not paste secrets into chat, commit them, or add them to `[vars]`.

Optional configuration:
```bash
npx wrangler secret put CORE_BACKEND_URL
npx wrangler secret put WEB_APP_URL
npx wrangler secret put DEPOSIT_INFO
```

`CORE_BACKEND_URL` must be the HTTPS base URL of a backend that implements `POST /api/bot-trigger`. Leave it unset if this integration is not deployed; Vietsub requests will report that the backend is unavailable instead of claiming the video was processed.

Update `ADMIN_ID` in `wrangler.toml` to the numeric Telegram user ID of the bot administrator. Check your ID by messaging the bot and using `/id`.

## 3. Persist state in Cloudflare KV (recommended)

Without KV, the Worker uses in-memory fallback storage for local smoke tests only; user state may be lost when an isolate is recycled.

```bash
npx wrangler kv namespace create HENDY_KV
```

Copy the returned namespace ID into the commented `[[kv_namespaces]]` block in `wrangler.toml`, uncomment the three lines, and deploy again. This stores user profiles and pending conversation states. For real payments or balances, use a transactional database/backend; KV is not a financial ledger.

## 4. Test, deploy, and activate webhook

```bash
npm run check
npm test
npx wrangler deploy
```

After deployment, activate the webhook with a POST request. Do not use a browser GET request:

```bash
curl -X POST "https://hendybot-telegram.ngogiaidy56.workers.dev/set-webhook" \
  -H "x-setup-key: YOUR_WEBHOOK_SETUP_KEY"
```

Check webhook status:

```bash
curl "https://hendybot-telegram.ngogiaidy56.workers.dev/webhook-info" \
  -H "x-setup-key: YOUR_WEBHOOK_SETUP_KEY"
```

The setup endpoints never return the webhook secret. Keep the setup key private. A healthy root endpoint at `/` returns JSON service status.

## 5. Behavior notes

- The bot does not pretend a payment has succeeded and does not deduct money for unimplemented services.
- Deposit instructions are shown only when `DEPOSIT_INFO` is configured.
- Vietsub links are forwarded only when the backend URL is configured and responds successfully.
- Admin actions compare the sender's Telegram ID against `ADMIN_ID`.
- Telegram menu links must use valid HTTPS URLs.
