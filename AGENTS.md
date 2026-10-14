# Project and reference provenance

## Working repository

- Target frontend: https://github.com/dail45/mihon-vue
- Stack: Vue 3 Composition API (`<script setup lang="ts">`), Vite, TypeScript, Pinia, Vue Router, Vuetify 4 with native MD3 typography/elevation (no legacy MD2 compatibility blueprint), and ofetch.
- This is an independently implemented web UI inspired by Mihon, not a Kotlin fork or a complete pixel-perfect port.

## UI reference: Mihon

- Repository: https://github.com/mihonapp/mihon
- Inspected commit: **`446f6df82c390ab760802c2fce3b677bce3f31c1`**
- Pinned revision: https://github.com/mihonapp/mihon/tree/446f6df82c390ab760802c2fce3b677bce3f31c1
- UI reference directory: `app/src/main/java/eu/kanade/presentation/`.
- Library toolbar, tabs, compact grid, cover overlays, and theme colors informed the initial UI.
- Reader reference files: `reader/appbars/ReaderTopBar.kt`, `reader/appbars/ReaderBottomBar.kt`, and `reader/settings/ReaderSettingsDialog.kt`, under the UI reference directory above.
- Catalogue UI reference: `browse/BrowseSourceScreen.kt` (compact grid, refresh/append loading and recoverable errors).
- Default color reference: `theme/colorscheme/TachiyomiColorScheme.kt`.
- These references are pinned to this commit; do not claim parity against a newer Mihon version without inspecting it.

## Backend/API reference: Suwayomi-Server

- Repository: https://github.com/Suwayomi/Suwayomi-Server
- Inspected source commit: **`e2ce828abb81f0f5ce1a3fb86194a2746b519c85`**
- Pinned revision: https://github.com/Suwayomi/Suwayomi-Server/tree/e2ce828abb81f0f5ce1a3fb86194a2746b519c85
- Contracts were hand-written from REST route registration, Kotlin controllers, and DTO models. The OpenAPI plugin is disabled in this inspected revision.
- This reference revision is not a claim about the version deployed on the live server.
- Detailed pinned file links, endpoint semantics, and known legacy progress limitations: `docs/REFERENCES.md`.

## Testing and boundaries

- User-provided live test server: http://suwayomi.dail45.ru/ (redirects to HTTPS).
- Observed live build from `/api/v1/settings/about`: `v2.4.2366`, revision `r2366`, Stable. This is a runtime build identifier, not the pinned source commit above.
- Keep live checks read-only by default. Do not change library membership, progress, bookmarks, sources, or downloads just to run a smoke test without explicit approval.
- Automated browser tests use intercepted synthetic fixtures. Never ship those fixtures as production manga or an offline fallback.
- Production code remains a headless REST client: no scraping, extension management, or local SQL database.
- Never store access tokens in source files, environment examples, Git remotes, documentation, or committed configuration.
- Validation commands: `npm test`, `npm run build`, `npm run test:e2e`. Set `CHROMIUM_PATH` for an existing Chromium installation.

- Live catalogue GETs can populate server cache. They must not be described as guaranteeing zero backend side effects. Keep library/progress/bookmark mutations blocked in smoke tests.
- User preference: manual acceptance tests and screenshots must use the real user-provided Suwayomi server and real source content, never the synthetic test source. Use `scripts/capture-live.mjs` with `LIVE_SUWAYOMI_API_URL` explicitly set. Isolated fixture tests are regression checks only, not evidence of live behavior.
- Do not commit live screenshots, manga covers/pages, chapter metadata, or raw API dumps. Save live QA output outside the repository.
