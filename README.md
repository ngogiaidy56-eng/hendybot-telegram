# Hendy Cybertech Telegram Bot — Cloudflare Workers

Telegram webhook bot built with JavaScript ES Modules. The Cloudflare Worker is the public HTTPS entry point and serves the admin and Mini App HTML routes (/admin and /mini-app). This repository deploys a **Worker** in the Cloudflare Workers & Pages dashboard; it is not a separate static Pages project.

## Cloudflare entry points

- **src/index.js** — Cloudflare Worker entry point and Telegram webhook handler.
- **src/server.js** — optional Express/WebSocket server for local Node.js development; it is not the production Worker entry point.
- **wrangler.toml** — Worker name, entry point, compatibility date and workers.dev routing.
- **scripts/setup.js** — deploys the Worker, waits for DNS/HTTPS health, uploads secrets without printing them, then registers and verifies the Telegram webhook.

The Cloudflare Worker name must match **hendybot-telegram**. WORKER_URL must be the exact HTTPS origin assigned to that Worker.

## Configure Cloudflare Workers & Pages

1. Open the [Cloudflare Workers & Pages dashboard](https://dash.cloudflare.com/) and select the hendybot-telegram Worker.
2. Ensure the account's **workers.dev** domain is enabled. The configured default is https://hendybot-telegram.ngogiaidy56.workers.dev. If Cloudflare assigns a different URL, set the GitHub Actions variable WORKER_URL to that exact origin.
3. The included GitHub Actions workflow is the deployment authority. After tests pass on main, it runs Wrangler to deploy the Worker, waits until DNS and HTTPS health checks succeed, injects secrets, and only then registers the Telegram webhook.
4. If this Worker is connected to Cloudflare **Settings → Builds** with automatic production deployments, disable/disconnect that second deployment path when using the supplied GitHub Actions workflow. Do not run two independent production deployers against the same Worker. Wrangler configuration remains the source of truth.

Cloudflare documentation: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/

## GitHub Actions secrets

In GitHub, open **Settings → Secrets and variables → Actions** and add:

- **BOT_TOKEN** — a newly issued token from @BotFather.
- **CLOUDFLARE_API_TOKEN** — API token with permissions to deploy Workers and manage Worker secrets in the target account.
- **CLOUDFLARE_ACCOUNT_ID** — the Cloudflare account ID.
- Optional **ADMIN_PASSWORD** — separate password for the admin panel; it is never printed in logs.

Set the Actions variable **WORKER_URL** only if the Worker URL differs from the default. The setup script generates WEBHOOK_SECRET_TOKEN and WEBHOOK_SETUP_KEY and writes them to Cloudflare Secrets. Never commit these values or put them into chat messages.

**Security note:** a bot token was previously present in a tracked sample environment file. Revoke that token using @BotFather and put a newly issued token in GitHub Actions Secrets. Removing a token from the latest version does not erase it from Git history.

## Local development and checks

Use Node.js 22 or later.

    npm install
    npm run check
    npm test
    npm run build

To deploy manually, authenticate Wrangler for the intended Cloudflare account and provide the new token through an environment variable—not as a command-line argument.

    # Bash example only. Do not commit these values.
    export BOT_TOKEN='PASTE_NEW_TOKEN_HERE'
    export CLOUDFLARE_ACCOUNT_ID='YOUR_ACCOUNT_ID'
    export CLOUDFLARE_API_TOKEN='YOUR_WORKERS_API_TOKEN'
    npm run setup

The setup process deploys first, then retries DNS/HTTPS and the JSON health endpoint. It stops without calling Telegram's setWebhook if the Worker URL is not healthy.

## Verify after deployment

- Open WORKER_URL in a browser or run: curl -H 'Accept: application/json' "$WORKER_URL"
- Confirm the JSON reports service "Hendy Telegram Bot" and status "ok".
- Open the bot in Telegram and send /start.
- Check webhook status from a secure terminal using the protected /webhook-info endpoint or Telegram Bot API. Do not paste tokens or setup keys into support messages.

Do not call webhook setup through an unauthenticated GET request. Setup requires POST and the x-setup-key header.
