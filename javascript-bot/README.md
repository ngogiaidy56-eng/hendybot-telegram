# HENDY Telegram Bot — JavaScript source archive

This directory stores a standalone rewrite of the supplied Python bot as JavaScript ES modules. It is intended for source control and review. Adding these files does not start the bot or deploy it to a server.

## Runtime

- Node.js 22 or newer; built-in fetch and WebSocket.
- No TypeScript and no third-party runtime packages.
- Telegram Bot API long polling.
- JSON database with serialized writes and recovery backup.
- Optional secure WebSocket bridge; disabled without explicit settings.

## Source structure

    javascript-bot/
    ├── .env.example
    ├── .gitignore
    ├── package.json
    ├── README.md
    ├── SECURITY.md
    ├── data/.gitkeep
    ├── docs/
    │   ├── architecture.md
    │   ├── commands.md
    │   └── operations.md
    ├── logs/.gitkeep
    ├── src/
    │   ├── bot.js
    │   ├── config.js
    │   ├── logger.js
    │   ├── master-socket.js
    │   ├── menu.js
    │   ├── storage.js
    │   └── telegram-api.js
    └── test/bot.test.js

## Validation without running a bot

From this directory:

    npm run check
    npm test
    npm run verify

These commands only check source and run local tests; they do not contact Telegram. The optional local-run command is npm start after privately configuring .env. Do not run it unless you intentionally want the bot to start polling Telegram.

Telegram getUpdates polling cannot run simultaneously with an active webhook for the same bot. This project will not remove a webhook automatically.

## Data and service flow

The JSON database stores profiles, non-secret account labels, wallet audit records, awarded-code history, conversation state, and pending service/deposit/giftcode requests. New accounts start with a zero balance. Real payment verification, product inventory and giftcode redemption require a trusted transactional backend.

## Safety boundaries

This rewrite does not collect passwords, store login credentials, receive or forward OTPs, generate fake payment QR codes, automatically credit deposits, implement SMS spam, or scan accounts. Account linking stores a label and mini-code label only. Deposit and giftcode submissions remain pending until reviewed.
