# Bot commands

## User commands

- /start — show the storefront menu and optionally count a referral link.
- /help — show basic usage and safety notes.
- /id — show Telegram chat ID.
- /balance — show balance fields currently stored locally.

## Administrator commands

- /admin — show the admin command list.
- /status — show uptime, memory, user and pending-request counts.
- /user USER_ID — inspect a profile without revealing passwords.
- /addmoney USER_ID AMOUNT — adjust a wallet by a signed integer; resulting balance cannot be negative.
- /trungcode USER_ID BRAND ACCOUNT_LABEL CODE — store an awarded-code record.
- /broadcast MESSAGE — send an administrator-authored notice to registered users.
- /requests — list up to 10 pending service, deposit or giftcode requests.

## Input states

- Deposit amount: creates a pending review request; it does not confirm payment or generate a fake payment QR.
- Giftcode: creates a validation request; redemption and balance credit are not simulated.
- Service details: stores a support/service request.
- Account label: stores a username-like label and mini-code only, never a password.
