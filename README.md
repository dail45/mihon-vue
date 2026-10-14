# Mihon Vue

An independent **Vue 3 + Vite + TypeScript** UI client for Suwayomi-Server, inspired by Mihon's Material Design 3 interface. Not an official Mihon client.

## Start locally

Requires Node.js **22.12+** (or 20.19+) and a running Suwayomi-Server.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open the URL printed by Vite. The example environment uses `/api/v1` through Vite's development proxy to `http://localhost:4567`. Without an environment override, the store defaults to `http://localhost:4567/api/v1` directly. Change the backend address in **More → Suwayomi-Server** or the toolbar's server button. It is saved as a UI preference, not a database.

`localhost` means the browser's device for absolute API URLs, and the Vite host for the development proxy. Phones usually need your server's LAN address or a same-origin proxy. Run Vite only on a trusted network; the dev server exposes the proxied API.

### Production

```sh
npm run build
npm run preview
```

Deploy `dist/` as a static SPA. Configure your host to fall back to `index.html` for client-side routes (including `/manga/:id`). Prefer a reverse proxy for `/api/` to Suwayomi, with API routing taking precedence over the SPA fallback. Vite's development proxy is **not** part of the production build. Use HTTPS for both the UI and API, or use same-origin routing; an HTTPS UI cannot safely call an HTTP backend.

The client sends session cookies with requests. Cross-origin APIs require appropriate Suwayomi CORS and cookie settings; same-origin deployment is recommended. This initial scaffold does not implement a login screen. If your server requires authentication, authenticate via your server's supported flow. Do not embed passwords, PATs, or server secrets in `VITE_*` variables, source files, URLs, or Git remotes.

## Implemented

- Explicit Vuetify **`md3` blueprint** and Mihon's default light/dark color tokens.
- System/light/dark theme preference; theme toggle; self-hosted Roboto and rounded Material Symbols.
- 64px top app bar and 80px five-destination bottom navigation: Library, Updates, History, Browse, More.
- Server-backed library categories and compact covers with unread/download badges.
- Library search, unread filtering, title/unread sorting, loading/error/empty states, and retry.
- Manga details, genres, chapter listing, and server-backed add/remove library membership (confirmation before removal).
- Read-only installed-source listing, server settings, appearance settings, and not-found route.
- Typed `Manga`, `Chapter`, `Source`, `Category`, and tracker DTOs; API adapter; `useSuwayomiStore` Pinia store.
- Request-version guards prevent stale reads from a previous server or screen replacing current state.
- No scraping, extension management, SQL database, or fabricated production manga data.

## Deliberate scope limits

This is an **initial scaffold**, not a complete pixel-perfect clone. Updates/History explicitly identify themselves as not implemented. Browse lists installed sources but does not browse/search their catalogues. Reader, progress editing, downloads, selection mode, category editing, tracking, authentication UI, and background subscriptions are not implemented.

Mihon's Compose sources were inspected for color roles, cover overlays, grid spacing, category tabs, and navigation structure. Pixel-perfect parity against native Android screenshots has **not** been established. Desktop currently retains the requested bottom navigation, rather than Mihon's adaptive tablet rail.

Suwayomi's inspected master revision disables its OpenAPI plugin and uses stub documentation builders. Contracts were hand-written from the actual REST controllers/models, **not** generated from a working Swagger endpoint. See [the pinned references and endpoint map](docs/REFERENCES.md). Verify against your installed server version; no live Suwayomi instance was available during implementation.

## Project structure

```text
src/api/             REST client, DTO contracts, error translation
src/stores/          In-memory server state; harmless UI preferences
src/plugins/         Vuetify MD3, themes, Material Symbols icon set
src/router/          Lazy-loaded Vue Router screens
src/components/      Manga card, empty state, connection dialog
src/views/           Library, manga, browse, more, planned screens
src/styles/          Compose-specific geometry and accessibility styles
src/assets/          Checked-in self-hosted icon font subset
scripts/             Optional font-subsetting and screenshot QA utilities
tests/               DTO fixtures, unit tests, intercepted browser tests
```

Server state is in memory only. Local storage contains the API address and theme preference; it contains no manga library, chapters, credentials, or reading history. TypeScript interfaces provide compile-time checks, not runtime schema validation.

## Validation

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
```

Browser tests cover **390×844 mobile** and **1440×1000 desktop**. They intercept API requests with synthetic fixtures, checking search, filters, categories, details, confirmation, theme, connection validation, navigation, and horizontal overflow. These are not live-backend integration tests. Set `CHROMIUM_PATH` if using an existing Chromium installation.

Optional visual capture (requires Node.js 22.18+ for native TypeScript fixture imports): start Vite, then run `CHROMIUM_PATH=/path/to/chromium node scripts/capture-ui.mjs`. `QA_BASE_URL` and `QA_OUTPUT` override its local URL/output directory. It captures 28 route/state screenshots, checks overflow/runtime errors, and does not itself replace human visual inspection.

The checked-in Material Symbols subset is sufficient for current screens and Vuetify's MD icon aliases. If adding icons, regenerate it with `python scripts/subset-icons.py` after installing `fonttools[woff]` and `brotli`. Ordinary builds do not require Python.

## Attribution

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). No project-wide license for the original application code has been selected yet; choose one before distributing it further. Never commit access tokens. If a token has been pasted into a chat, revoke it and use a newly issued credential through a secure channel.
