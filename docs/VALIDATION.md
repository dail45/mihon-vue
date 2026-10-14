# Validation performed

## Automated and visual checks

- `npm run build`: passed, including strict `vue-tsc` checks.
- `npm test`: 19 tests passed. Includes REST URL/method/form contracts, category coverage, deduplication, stale-response guards, error retention, manga/chapter loading, reader bounds, serialized writes, paused retries, and explicit bookmark commands.
- `npm run test:e2e`: 16 tests passed across 390×844 and 1440×1000 Chromium viewports. Tests use intercepted synthetic API responses, not a live server. Includes page/chapter navigation, RTL, touch-handler simulation, mode/scale/background preferences, webtoon visibility, page errors, and manual/opt-in progress writes.
- Initial 28 scaffold route/state captures were inspected. A further 28 reader/manga captures were generated and inspected, including settings tabs, mode menus, chapter sheets, hidden controls, fit-width/paper backgrounds, loading failures, and zero-page responses. No horizontal overflow or page exceptions were reported by the capture runs. Clearly labelled schematic test charts are used, not production manga or invented cover artwork.
- 12 base semantic theme foreground/background pairs were checked: minimum contrast 6.46:1. Additional reader checks corrected slider-track visibility, informational text contrast, and the recovery button on the paper background. This is not a full WCAG audit.
- Production dependency audit at the initial baseline reported no known vulnerabilities. No dependency versions were added for the reader extension.
- Source scan found no GitHub PAT/token literals in project source, tests, scripts, documentation, environment example, or package manifests.

## Live, read-only verification

User-provided endpoint: `http://suwayomi.dail45.ru/`, redirecting to `https://suwayomi.dail45.ru/`.

`GET /api/v1/settings/about` reported Stable **v2.4.2366 / r2366**. This runtime identifier is not the pinned reference master commit. Categories, sources, and manga wire payloads were inspected; stable categories omit the reference master's `isDefaultCategory` field, which is therefore optional in the client DTO.

Verified through the actual UI with API interception disabled:

- Library and category data loaded.
- A real manga detail screen loaded.
- Its chapter endpoint loaded and the reader received page-count data.
- The installed-source list loaded.
- No runtime exceptions were recorded.
- No client-initiated progress, bookmark, or library writes were submitted. The live smoke harness blocks writes and image-side progress updates. Chapter GET endpoints can still run the server’s own page discovery/cache or configured sync behavior; a read-only client smoke is not proof that the server performs no internal side effects.

**Blocked live page delivery:** the selected first page failed to decode in the browser. A direct GET of `/api/v1/manga/83/chapter/1/page/0?updateProgress=false` returned HTTP **500**, body **`Cloudflare bypass currently disabled`**. This establishes a server/source-side failure for that tested page, not successful reader delivery. Server bypass settings were not changed. This single result does not establish that every source or page fails.

The live script is explicit opt-in (`scripts/smoke-live.mjs`) and reports partial coverage separately; it fails its overall smoke status if image delivery is not verified. The simulated browser suite passing is not evidence that live image delivery passed.

Not verified: live progress/bookmark persistence, all live titles/pages/sources, authenticated deployments, native Android screenshot parity, real-device touch/zoom, non-Chromium browsers, or production hosting configuration.
