# Security notes

- The supplied Python snippet contained a hard-coded Telegram bot token. Treat it as compromised: revoke it with @BotFather and create a new one before using any code.
- Never commit .env, bot tokens, WebSocket shared secrets, or JSON database files.
- ADMIN_ID must be a numeric Telegram user ID. Admin commands validate the sender ID.
- Do not collect passwords, session cookies, login codes, or OTPs.
- Deposit requests do not mean payment received. No balance is credited automatically.
- JSON storage is intended for a small local instance, not a production financial ledger or multiple concurrent writers.
- The optional WebSocket bridge requires WSS and shared-secret validation on accepted incoming broadcasts. Remote start/stop and token replacement are not implemented.
- Review all external URLs before enabling them and use links you control or trust.
