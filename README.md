# Hendy Cybertech Telegram Bot — Cloudflare Workers

Telegram webhook bot built with JavaScript ES Modules. The Cloudflare Worker is the public HTTPS entry point and serves the admin and Mini App HTML routes (/admin and /mini-app). This repository deploys a **Worker**, not a standalone Pages static-site project.

## Cloudflare entry points

- **src/index.js** — Cloudflare Worker entry point and Telegram webhook handler.
- **src/server.js** — optional Express/WebSocket server for local Node.js development; it is not the production Worker entry point.
- **wrangler.toml** — Worker name, entry point, compatibility date and public workers.dev route.
- **scripts/setup.js** — deploys or waits for the Worker, checks DNS/HTTPS health, uploads secrets without printing them, then registers and verifies the webhook.

The Worker name in Cloudflare must match **hendybot-telegram**. WORKER_URL must be the exact HTTPS origin assigned to the Worker.

## Configure Workers & Pages

1. Open Cloudflare Workers & Pages and select the hendybot-telegram Worker.
2. Under **Settings → Builds**, connect this repository if using Cloudflare Workers Builds. Set the root directory to the repository root, the build command to **npm run build**, and the deploy command to **npx wrangler deploy**. Keep the Cloudflare Worker name aligned with the name in wrangler.toml.
3. Ensure the Worker's **workers.dev** domain is enabled. The default URL is https://hendybot-telegram.ngogiaidy56.workers.dev. If Cloudflare assigns a different URL, set the GitHub Actions variable WORKER_URL to that exact origin.
4. Use one deployment authority for source releases. The GitHub Actions workflow validates code and performs protected webhook setup after the Cloudflare Worker is healthy. Avoid adding a second independent production deployment workflow that races the native build.

Cloudflare's build/deploy settings are documented at:
https://developers.cloudflare.com/workers/ci-cd/builds/configuration/

## GitHub Actions secrets

In GitHub, open **Settings → Secrets and variables → Actions** and add:

- **BOT_TOKEN** — a newly issued token from @BotFather.
- **CLOUDFLARE_API_TOKEN** — token with permission to manage Workers in the target account.
- **CLOUDFLARE_ACCOUNT_ID** — your Cloudflare account ID.
- Optional **ADMIN_PASSWORD** — separate password for the admin panel. It is never printed by the workflow.

Set the Actions variable **WORKER_URL** if the URL differs from the default. The workflow generates WEBHOOK_SECRET_TOKEN and WEBHOOK_SETUP_KEY and writes them to Cloudflare Secrets. Never commit these values or put them into chat messages.

**Security note:** if a bot token has ever appeared in a committed file, including a sample environment file, revoke it using @BotFather and replace it with a new token in GitHub and Cloudflare. Removing a token from the latest commit does not erase it from Git history.

## Local development and tests

Use Node.js 22 or later.

    npm install
    npm run check
    npm test
    npm run build

For a local deployment from your terminal, authenticate Wrangler with the intended Cloudflare account and provide the new token through an environment variable (do not put it in a command argument).

    # Bash example: set these in your terminal session, not in source control.
    export BOT_TOKEN='PASTE_NEW_TOKEN_HERE'
    export CLOUDFLARE_ACCOUNT_ID='YOUR_ACCOUNT_ID'
    export CLOUDFLARE_API_TOKEN='YOUR_WORKERS_API_TOKEN'
    npm run setup

The setup script deploys the Worker first, waits for DNS and HTTPS to return the expected health response, then writes secrets and registers the webhook. If the hostname is unavailable, the script stops before calling Telegram's setWebhook.

## Verify after deployment

- Open WORKER_URL in a browser or run: curl -H 'Accept: application/json' "$WORKER_URL"
- Confirm the JSON health response reports service "Hendy Telegram Bot" and status "ok".
- Open the bot in Telegram and send /start.
- Check webhook status through the protected /webhook-info setup endpoint or Telegram from a secure terminal. Do not paste bot tokens or setup keys into support messages.

Do not use an unauthenticated GET request to configure the webhook. Setup endpoints require POST plus the x-setup-key header.
