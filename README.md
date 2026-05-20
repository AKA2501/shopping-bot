# Shopping Bot Stock Alert System

Node.js 20 stock watcher that runs every 5 minutes in GitHub Actions, stores product state in Supabase, sends one grouped stock email per run, reads reply commands over IMAP, and creates manual-checkout order intents.

## What it does

- Fetches protein products from `PRODUCT_URL_BASE` using `PRODUCT_CATEGORY` and `PINCODE`
- Normalizes products into a stable stock cache
- Detects new products, restocks, quantity changes, and price changes
- Stores `stock_events` and updates `product_stock_cache` in Supabase
- Sends one grouped stock update email when changes are detected
- Reads recent inbox replies and supports:
  - `BUY <SKU> <QTY>`
  - `STATUS <SKU>`
  - `LIST IN_STOCK`
  - `HELP`
- Saves `email_commands` and `order_intents`
- Replies with manual checkout guidance only

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
- `EMAIL_TO`
- `PRODUCT_CATEGORY`
- `PRODUCT_URL_BASE`
- `PINCODE`

## Setup

1. Apply [sql/schema.sql](/C:/Users/aniru/Documents/Codex/2026-05-20/work-inside-this-repository-https-github/sql/schema.sql) in the Supabase SQL Editor.
2. Add the required GitHub repository secrets.
3. Optionally copy `.env.example` to `.env` for local runs.
4. Install dependencies with `npm install`.
5. Verify database access with `npm run db:init`.

## Run locally

- `npm run check`
- `npm run check:dry`
- `npm run products:print`
- `npm run replies:check`
- `npm run send:test-email`

## Notes

- `PRODUCT_URL_BASE` should point to the upstream JSON product endpoint or base URL used for product fetches.
- The fetch client sends `category` and `pincode` as query params and supports common JSON response shapes such as a top-level array, `products`, `data.products`, `items`, or `results`.
- Order mode is manual checkout only. There is no auto-login, OTP bypass, CAPTCHA bypass, anti-bot bypass, auto-pay, or payment storage.

## Troubleshooting

- If `npm run db:init` reports missing tables, apply [sql/schema.sql](/C:/Users/aniru/Documents/Codex/2026-05-20/work-inside-this-repository-https-github/sql/schema.sql) in Supabase and rerun the check.
- If no products are found, verify `PRODUCT_URL_BASE`, `PRODUCT_CATEGORY`, and `PINCODE`, and confirm the endpoint returns product JSON.
- If replies are skipped, confirm the sender address is included in `EMAIL_TO` and that IMAP credentials point to the bot inbox.
- Use `npm run check:dry` before turning on the scheduled workflow.

