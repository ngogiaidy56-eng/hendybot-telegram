# Hendy Game Tool Bot (Cloudflare Workers)

Telegram storefront bot inspired by the supplied menu reference. The Worker serves a Telegram webhook; GitHub Actions validates and deploys it.

## Features

- Game-service storefront menu: Minigame Live, tool rental, code catalog, deposit instructions, VIP packages, matchmaking requests, referrals, giftcode verification, and customer support.
- Telegram commands: /start, /help, /id, and /balance.
- User profile fields for main/secondary balance, confirmed deposits, referral count, and membership status.
- Optional Cloudflare KV storage for user profiles and ongoing form state.
- Optional HTTPS backend integration via CORE_BACKEND_URL/api/bot-trigger.
- Protected webhook setup and status endpoints.
- Webhook token and setup key generated during setup; secrets remain in Cloudflare secret storage.

## Setup

1. Revoke any previously exposed bot token in @BotFather and create a new token.
2. Add the following GitHub Actions secrets: BOT_TOKEN, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID.
3. Set the repository variable WORKER_URL if your Worker URL is not the default.
4. Authenticate Wrangler locally if testing manually:

    npm install
    npx wrangler login
    npm run setup

The setup script verifies the supplied token, generates WEBHOOK_SECRET_TOKEN and WEBHOOK_SETUP_KEY, stores them as Worker secrets, deploys the Worker, registers the Telegram webhook, and verifies status.

## Configure the storefront

Edit wrangler.toml to set BOT_TITLE and your own ADMIN_ID. Configure optional SITE_URL, GROUP_URL, CHANNEL_URL, and SUPPORT_URL HTTPS links. Do not use third-party links unless you intend users to open them.

Configure secrets only through Wrangler or GitHub Actions:

    npx wrangler secret put BOT_TOKEN
    npx wrangler secret put WEBHOOK_SECRET_TOKEN
    npx wrangler secret put WEBHOOK_SETUP_KEY
    npx wrangler secret put DEPOSIT_INFO
    npx wrangler secret put CORE_BACKEND_URL

CORE_BACKEND_URL must be your own HTTPS backend implementing POST /api/bot-trigger. Without it, service requests can fall back to a notification for ADMIN_ID. If neither backend nor admin is configured, the bot tells the user the request could not be delivered.

## Persistent data

For production, create a KV namespace:

    npx wrangler kv namespace create HENDY_KV

Bind the returned namespace ID with the HENDY_KV block in wrangler.toml, then deploy again. Without KV, in-memory state is only a local smoke-test fallback and may be lost when the Worker isolate is recycled.

## Important transaction behavior

- A request to deposit money is not a confirmation that money has been received.
- The bot does not automatically credit balances or claim that a giftcode succeeded without trusted backend/admin confirmation.
- OTPs, passwords, and login codes should never be requested or sent to this bot.
- This bot provides the storefront and request routing. Real inventory, accounting, payment verification, package entitlements, and giftcode redemption require a separately implemented trusted backend.
