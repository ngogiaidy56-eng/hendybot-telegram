# Hendy Cybertech Telegram Bot — Render

Telegram bot using Node.js, Express and WebSocket. Production runs as a Render **Web Service**; Cloudflare Workers/Wrangler are no longer required for deployment.

## Render deployment (Blueprint)

1. Push or merge this branch into the repository's `main` branch.
2. Open [Render Blueprint](https://dashboard.render.com/blueprint/new?repo=https%3A%2F%2Fgithub.com%2Fngogiaidy56-eng%2Fhendybot-telegram) and connect `ngogiaidy56-eng/hendybot-telegram`.
3. Render reads `render.yaml`, installs dependencies, runs syntax checks/tests, then starts the service with `npm start`.
4. During the first Blueprint setup, supply these secret values in Render. Never put them in source code, GitHub files, or chat messages:
   - `BOT_TOKEN`: create/rotate the bot token using `@BotFather`. Any token ever committed to a repository must be revoked.
   - `WEBHOOK_SECRET_TOKEN`: a long random value using only letters, numbers, underscore and hyphen (`A-Z a-z 0-9 _ -`); Telegram rejects other characters.
   - `WEBHOOK_SETUP_KEY`: a different long random secret used only to authorize the setup endpoints.
   - `ADMIN_PASSWORD`: a strong, separate admin-panel password.
5. Wait until Render reports the deployment is live and `/healthz` returns HTTP 200. The service name and endpoint are configured by the Blueprint.
6. In a secure terminal, set the public URL and the setup key, then register the webhook:
   
       APP_URL=https://<your-service>.onrender.com WEBHOOK_SETUP_KEY='<your-setup-key>' npm run setup

   On PowerShell:
   
       $env:APP_URL = "https://<your-service>.onrender.com"
       $env:WEBHOOK_SETUP_KEY = "<your-setup-key>"
       npm run setup

The setup script first checks `/healthz`, sends a protected POST to `/auto-setup`, then calls the protected `/webhook-info` endpoint to verify the exact registered webhook URL. It does not print bot or setup secrets. The Render service itself reads `BOT_TOKEN` and `WEBHOOK_SECRET_TOKEN` from its own Environment settings.

## Render configuration

- **Runtime:** Node.js
- **Build command:** `npm install && npm run check && npm test`
- **Start command:** `npm start`
- **Health check:** `/healthz`
- **Port:** reads Render's `PORT` value and binds to `0.0.0.0`
- **Region:** Singapore
- **Blueprint:** `render.yaml`

For an always-on production bot, change the Blueprint plan from `free` to `starter` (or select an appropriate paid plan) in line with Render's current pricing. Free instances may spin down during inactivity, so they are best for demos/tests.

## Admin security

- Admin login validates the `ADMIN_PASSWORD` environment variable.
- A successful login sets an HttpOnly, SameSite cookie; the raw password is not embedded into the HTML or stored in browser storage.
- Admin REST endpoints and WebSocket control connections require the authenticated session.
- `/auto-setup`, `/set-webhook`, and `/webhook-info` require `x-setup-key`.
- Configure a strong `WEBHOOK_SECRET_TOKEN` with only Telegram-supported characters.

## Local development

Use Node.js 22 or later.

    npm install
    npm run check
    npm test
    npm start

Copy `.env.example` to `.env` and fill in local values. Keep `.env` out of Git. For local testing, `PORT=3000` is fine; Render injects `PORT` automatically.

## Health and application routes

- `GET /`: JSON health summary or redirects browsers to `/admin`
- `GET /healthz`: Render health check
- `POST /webhook`: Telegram update receiver protected by `WEBHOOK_SECRET_TOKEN`
- `POST /auto-setup`: authorized webhook registration and bot command setup
- `GET /webhook-info`: authorized webhook status
- `GET /admin`: admin panel
- `GET /mini-app`: Telegram Mini App
- `/ws`: authenticated admin WebSocket

## Persistence note

The current application store uses process memory unless a persistent backend is configured. Render redeploys/restarts can clear in-memory user balances, linked-account state and logs. Treat this deployment as a functional starting point, not a durable wallet/account database. Before storing real balances or customer credentials in production, connect a persistent database (for example, Render Postgres) and migrate the user/state store to it.

## Documentation

- Render web services: https://render.com/docs/web-services
- Render Blueprints: https://render.com/docs/blueprint-spec
- Render health checks: https://render.com/docs/health-checks
- Render environment variables: https://render.com/docs/configure-environment-variables
