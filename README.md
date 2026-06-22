# @conciar/create-vue-shop

Scaffold a **Conciar-compatible headless storefront for Vue** — a clean Vue 3 + Vite + Tailwind + Pinia skeleton wired to the Conciar Connect API, ready to rebrand and ship.

> Framework-scoped on purpose: the storefront is built on Pinia stores, composables, and SFCs. Other frameworks would ship as sibling packages (e.g. `@conciar/create-react-shop`).

```bash
npm create @conciar/vue-shop@latest my-shop
# or: npm create @conciar/vue-shop@latest   (prompts for the directory)
```

You'll be asked for a project name and your Conciar API base URL, Connect API key, and sales-channel key. The CLI scaffolds the app, writes `.env.local`, and prints the next steps:

```bash
cd my-shop
npm install
npm run dev
```

## What you get

A working storefront, no wine/demo domain baggage:

- **Catalogue & detail** — product listing with search, filters, pagination; product detail with a generic spec list, tax breakdown, and a compare tray/modal.
- **Cart & checkout** — cart drawer + full cart, coupons (single/stackable), automatic promotion badges & discount lines, PostNL pickup-point & delivery-timeframe pickers, server-validated checkout (out-of-stock / price-drift / expired-coupon handling).
- **Customer accounts** — OTP login, order history & detail, subscription management.
- **i18n** — `en` / `nl` / `fr` / `de` via vue-i18n, all in parity.
- **Conciar core** — the API client (`src/api/conciar.ts` + types), Pinia stores (cart, store config, countries, customer/auth), and composables, decoupled from any specific UI domain.

## Configure

`.env.local` (generated for you) holds the connection:

| Variable | Purpose |
| --- | --- |
| `CONCIAR_API_URL` | API base URL — used by the dev proxy in `vite.config.ts` (server-only) |
| `CONCIAR_API_KEY` | Connect API key (server-only, never bundled) |
| `CONCIAR_SALES_CHANNEL_KEY` | Sales-channel key (server-only) |
| `VITE_CONCIAR_API_URL` | Any non-empty value switches off mock mode and enables real API calls |
| `VITE_APP_URL` | Public URL of the shop (OAuth redirect_uri) |

Leave `VITE_CONCIAR_API_URL` empty to run in **mock mode** with built-in sample data — handy for a first look before wiring credentials.

## Rebrand

- **Color:** change `--color-primary` (and `-dark`/`-light`) in `src/assets/main.css` — it flows through every `*-primary` utility.
- **Fonts / copy:** fonts are set in `src/assets/main.css`; UI copy lives in `src/locales/*.ts`.

## Requirements

Node ≥ 18.

## Other Conciar SDKs & libraries

Looking for clients in other languages or frameworks? See the full list at
[conciar.com/en/developers/sdks-libraries](https://conciar.com/en/developers/sdks-libraries).
