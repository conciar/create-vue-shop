# Conciar storefront

A Vue 3 + Vite + Tailwind + Pinia storefront wired to the Conciar Connect API,
scaffolded by [`@conciar/create-vue-shop`](https://www.npmjs.com/package/@conciar/create-vue-shop).

```bash
npm install
npm run dev
```

The dev server runs on <http://localhost:5173>. With `VITE_CONCIAR_API_URL`
empty the shop runs in **mock mode** against built-in sample data, so it works
before any credentials exist.

## Configuration

Connection settings live in `.env.local`, which the scaffolder generated for you.

| Variable | Purpose |
| --- | --- |
| `CONCIAR_API_URL` | API base URL — used by the dev proxy and the production server (server-only) |
| `CONCIAR_API_KEY` | Connect API key (server-only, never bundled into the browser) |
| `CONCIAR_SALES_CHANNEL_KEY` | Sales-channel key (server-only) |
| `VITE_SHOP_NAME` | Shop display name — logo, footer, copyright, page title |
| `VITE_CONCIAR_API_URL` | Any non-empty value switches off mock mode |
| `VITE_APP_URL` | Public URL of the shop |
| `PORT` | Port the production server listens on (default `3000`) |

The secret API key is never bundled. In development the Vite proxy injects it;
in production `server.mjs` does the same job. Never move it to a `VITE_`-prefixed
variable.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check and build to `dist/` |
| `npm start` | Serve `dist/` and proxy `/api` with the secret injected server-side |
| `npm run test:unit` | Unit tests (vitest) |
| `npm run test:coverage` | Unit tests with a coverage report |
| `npm run lint` | ESLint with `--fix` |
| `npm run format` | Prettier over `src/` |

## Making it yours

- **Colour** — change `--color-primary` (and `-dark`/`-light`) in `src/assets/main.css`; it flows through every `*-primary` utility.
- **Fonts** — also in `src/assets/main.css`.
- **Copy** — `src/locales/*.ts`, with `en` / `nl` / `fr` / `de` in parity. Delete the locales you don't need from `src/i18n.ts`.
- **Product images** — `src/utils/images.ts` is the single place that decides what a product's picture is. Point it at placeholder artwork if your catalogue has no uploads yet.
- **Billing wording** — `src/utils/billing.ts` renders every "Monthly" / "Every 3 months" label from the `billing.*` locale keys.

## Layout

```
src/
  api/          Conciar Connect client, types, and mock data
  components/   Cart, checkout, compare, layout, product, promo, subscription
  composables/  Coupons, shipping pickers, modal a11y, address formatting
  stores/       Pinia: cart, catalog, compare, countries, customer, storeConfig
  utils/        Money, promotions, slugs, images, billing cycles, cart mapping
  views/        One per route; see src/router/index.ts
```

## Deploying

```bash
npm run build
npm start
```

`server.mjs` reads `CONCIAR_API_URL`, `CONCIAR_API_KEY`, and
`CONCIAR_SALES_CHANNEL_KEY` from the environment (or `.env.local`), proxies
`/api/*` to Conciar with the credentials attached, serves the SPA with history
fallback, and converts the payment provider's POST return into a GET redirect.
Run it behind your own TLS-terminating reverse proxy, or any Node host.
