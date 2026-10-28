# Architecture

    Telegram user
        |
        v
    src/bot.js  -- long-poll loop and command/callback routing
        |                    |
        v                    v
    src/telegram-api.js    src/menu.js
        |
        v
    Telegram Bot API

    src/bot.js -> src/storage.js -> data/database.json
    all modules -> src/logger.js
    src/bot.js -> optional src/master-socket.js -> WSS server you control

## Responsibilities

- config.js validates environment values and accepts HTTPS or WSS destinations only.
- bot.js routes commands, callbacks, form states and administrator actions.
- telegram-api.js wraps Telegram HTTP calls, timeouts and API errors.
- menu.js creates inline keyboards and escapes user-controlled HTML.
- storage.js serializes database writes, backs up previous data and sanitizes legacy password fields.
- master-socket.js provides an optional status/log channel and accepts only shared-secret-authenticated broadcast commands.
- logger.js writes timestamped logs to console and a local file.
