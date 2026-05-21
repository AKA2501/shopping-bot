# Shopping Bot Stock Alert System

Node.js 20 stock watcher that runs every 5 minutes in GitHub Actions, stores stock state in Supabase, sends cleaner grouped stock emails, reads reply commands over IMAP, and creates manual-checkout order intents.

## What it does

- Watches one or more `pincode -> recipient(s)` targets
- Stores pincode-scoped cache rows in Supabase
- Sends cleaner alerts only for:
  - `OUT OF STOCK -> IN STOCK`
  - `IN STOCK -> OUT OF STOCK`
  - `LOW STOCK` when quantity crosses below `LOW_STOCK_THRESHOLD`
- Sends a clean initial stock snapshot when a target has no prior cache
- Reads recent inbox replies and supports:
  - `BUY <SKU> <QTY>`
  - `STATUS <SKU>`
  - `LIST IN_STOCK`
  - `HELP`

## Required repository secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BOT_SMTP_HOST`
- `BOT_SMTP_PORT`
- `BOT_SMTP_USER`
- `BOT_SMTP_PASS`
- `BOT_IMAP_HOST`
- `BOT_IMAP_PORT`
- `BOT_IMAP_USER`
- `BOT_IMAP_PASS`
- `PRODUCT_CATEGORY`
- `PRODUCT_URL_BASE`

Use one of these config styles:

- Preferred: `RECIPIENT_TARGETS`
- Legacy fallback: `EMAIL_TO` and `PINCODE`

Example `RECIPIENT_TARGETS` secret:

```json
[
  { "pincode": "122004", "recipients": ["alice@example.com"] },
  { "pincode": "110001", "recipients": ["bob@example.com", "team@example.com"] }
]
```

## Setup

1. Apply [sql/schema.sql](/C:/Users/aniru/Documents/Codex/2026-05-20/work-inside-this-repository-https-github/sql/schema.sql) in Supabase.
2. Add the required GitHub repository secrets.
3. Optionally copy [.env.example](/C:/Users/aniru/Documents/Codex/2026-05-20/work-inside-this-repository-https-github/.env.example) to `.env` for local runs.
4. Install dependencies with `npm install`.
5. Verify database access with `npm run db:init`.

## Run locally

- `npm run check`
- `npm run check:dry`
- `npm run products:print`
- `npm run replies:check`
- `npm run send:test-email`

## Testing and troubleshooting

- Re-run [sql/schema.sql](/C:/Users/aniru/Documents/Codex/2026-05-20/work-inside-this-repository-https-github/sql/schema.sql) after upgrading to the multi-pincode cache model.
- If alerts stop on GitHub Actions but local runs work, verify Gmail app-password secrets for both SMTP and IMAP.
- If replies are skipped, confirm the sender email appears in at least one `RECIPIENT_TARGETS` recipient list.
- Use `npm run check:dry` to preview alert formatting without writing to Supabase or sending email.

## Safety

Manual checkout only. No auto-login, OTP bypass, CAPTCHA bypass, anti-bot bypass, auto-pay, or payment storage is performed.
