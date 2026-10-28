# Local operating notes

## Environment

1. Install Node.js 22 or newer.
2. Copy .env.example to .env.
3. Fill BOT_TOKEN with a newly generated token and ADMIN_ID with your numeric Telegram user ID.
4. Review all website, group, channel and support URLs.
5. Run npm run verify to validate syntax and tests without contacting Telegram.

## Database

The default database path is data/database.json. Before a save, the prior file is copied to data/database_backup.json. Both files are excluded from Git. The loader can read the older Python users dictionary format and intentionally removes legacy password fields while migrating account labels.

JSON storage is appropriate for a small single-process bot only. It is not a replacement for transactional payment/accounting infrastructure.

## Polling

Telegram getUpdates long polling cannot be used while a webhook is active for the same bot. This source does not remove or change a webhook automatically.

## Stop

Press Ctrl+C or send SIGTERM. The process exits the polling loop and closes the optional WebSocket connection.
