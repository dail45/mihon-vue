# Validation performed

## Automated and visual checks

- `npm run build`: passed, including strict `vue-tsc` checks.
- `npm test`: 24 tests passed. Includes REST URL/method/form contracts, category coverage, deduplication, stale-response guards, error retention, manga/chapter loading, reader bounds, serialized writes, paused retries, explicit bookmark commands, source pagination/deduplication, retry retention, and stale catalogue responses.
- `npm run test:e2e`: 22 tests passed across 390×844 and 1440×1000 Chromium viewports. Tests use intercepted synthetic API responses, not a live server. Includes page/chapter navigation, RTL, touch-handler simulation, mode/scale/background preferences, webtoon visibility, page errors, and manual/opt-in progress writes, catalogue search/latest, unsupported/missing sources, pagination error recovery, and returning from manga to the source search.
- Initial 28 scaffold route/state captures were inspected. A further 28 reader/manga captures were generated and inspected, including settings tabs, mode menus, chapter sheets, hidden controls, fit-width/paper backgrounds, loading failures, and zero-page responses. No horizontal overflow or page exceptions were reported by the capture runs. Clearly labelled schematic test charts are used, not production manga or invented cover artwork.
- A further 22 catalogue/source route captures at both sizes were generated and individually inspected: source list, Popular, Latest, search, empty, missing/unsupported source, initial/append errors, loaded pages, and dark theme.
- 12 base semantic theme foreground/background pairs were checked: minimum contrast 6.46:1. Additional reader checks corrected slider-track visibility, informational text contrast, and the recovery button on the paper background. The new light-theme pagination error alert was checked at 5.13:1. This is not a full WCAG audit.
- Production dependency audit at the initial baseline reported no known vulnerabilities. No dependencies were added for the reader or catalogue extensions.
- Source scan found no GitHub PAT/token literals in project source, tests, scripts, documentation, environment example, or package manifests.

## Live, read-only verification

User-provided endpoint: `http://suwayomi.dail45.ru/`, redirecting to `https://suwayomi.dail45.ru/`.

`GET /api/v1/settings/about` reported Stable **v2.4.2366 / r2366**. This runtime identifier is not the pinned reference master commit. Categories, sources, and manga wire payloads were inspected; stable categories omit the reference master's `isDefaultCategory` field, which is therefore optional in the client DTO.

Verified through the actual UI with API interception disabled:

- Library and category data loaded.
- A real manga detail screen loaded.
- Its chapter endpoint loaded and the reader received page-count data.
- Real images decoded; next-page navigation, RTL page-button navigation, and Webtoon mode passed.
- The installed-source list loaded.
- Popular catalogue titles loaded for the source of the tested manga (MangaDex RU). Latest and a search using a real catalogue title also returned successful `mangaList` responses.
- No runtime exceptions were recorded; the write guard reported no attempted client mutations.
- No client-initiated progress, bookmark, or library writes were submitted. The live smoke harness blocks writes and image-side progress updates. Chapter GET endpoints can still run the server’s own page discovery/cache or configured sync behavior; catalogue GETs can populate the server cache. These checks do not establish zero internal backend side effects.

An earlier source/page returned HTTP 500, `Cloudflare bypass currently disabled`. After the user switched sources, the checks above passed without changing bypass settings. An intermediate catalogue run selected the empty local source; the harness was corrected to use the source of the manga actually read, and the final opt-in catalogue run passed. Neither result establishes that every installed source works.

The live script is explicit opt-in (`scripts/smoke-live.mjs`) and reports partial coverage separately. With `LIVE_TEST_CATALOGUE=1`, failure to display Popular results also fails the overall smoke. Live pagination error recovery was not verified; that failure path was exercised using intercepted fixtures. The live reader check is mobile Chromium, not an exhaustive real-device suite.

Not verified: live progress/bookmark persistence, all live titles/pages/sources, authenticated deployments, native Android screenshot parity, real-device touch/zoom, non-Chromium browsers, or production hosting configuration.


## Final real-data screenshot acceptance

Per the user's request, final acceptance uses **only the real Suwayomi server**, not the synthetic QA source. `scripts/capture-live.mjs` captured 24 actual screens: 12 each at 390×844 and 1440×1000. Library covers, manga metadata, reader pages, hidden controls, page 2, settings, Webtoon, the real chapter sheet, Popular, Latest, search, and dark search were individually inspected. The final report recorded no runtime errors, no blocked/attempted client mutations, no failed mounted visible images, and no horizontal overflow. Images remain outside Git; no live manga content was committed.

The first real manga capture exposed a stable REST compatibility issue: `source: null` produced an incorrect “Source unavailable” label even with a working `sourceId`. The detail screen now resolves a missing source object through the installed-source list; the corrected MangaDex (RU) label was verified on the real mobile and desktop captures. `npm run build` passed again after this fix. The 24 unit / 22 fixture browser results above were obtained before this final label-only correction and are not substituted for live acceptance evidence.

## 0.4.0 parity and toolbar increment

Final code checks:

- `npm test`: **31 passed** in 6 test files. Includes a new static guard that every Vuetify component used in Vue templates is explicitly registered, recent-feed REST paths, zero-based pagination, deduplication, retry retention, stale-response disposal and second-based date handling.
- `npm run build`: passed with TypeScript checking.
- `CHROMIUM_PATH=... npm run test:e2e`: **34 passed**, across mobile and desktop. These are isolated synthetic-fixture regression checks, not live acceptance. Added coverage for all four library layouts, settings routes, recent feed groups/search/filter, chapter filters, catalogue layouts, filter-chip geometry (32px height / 8px corners), inline source search, absent global server/theme actions, rail geometry and inactive-icon colors.
- `git diff --check`: passed. Secret-pattern scan across source/tests/scripts/docs/manifests: passed.

Real-data acceptance used the user-provided Suwayomi endpoint, never the synthetic test source:

- `scripts/capture-parity-live.mjs`: **64 route/state captures** (33 mobile including 320px/720px source checks, 31 desktop). Library layouts and Filter/Sort/Display sheets, cover viewer, chapter settings, source Popular/Latest/search/display menu/list, recent updates, More, read-only categories, limited settings and About were exercised. History's explicit unimplemented state was captured, not counted as an implemented history feed.
- The desktop pass was repeated after refining active/inactive rail colors. Its final 31 captures replace the earlier desktop images in the deliverable.
- `scripts/capture-live.mjs`: a further **24 real-data regression captures** for library/manga, reader controls, next page, Webtoon, chapter sheet, catalogue/search and dark search. The deliverable keeps 12 reader-specific states from this set and the 64 controls captures, avoiding duplicate route images.
- Final live reports recorded no page exceptions, unresolved Vue components, horizontal page overflow, blocked/attempted client mutations or failed visible mounted images. The control harness also checked visible icon ligatures. No library membership, bookmarks or progress writes were sent. GETs can still populate the server's own caches and perform server-side discovery.
- Contact-sheet inspection and full-size toolbar checks caught a real desktop layout defect: `VNavigationDrawer` had not been explicitly registered. This was corrected; geometry assertions and the registration test were added, and both regression tests and live captures were repeated. Earlier passing tests did not establish correct drawer placement.
- The capture harness initially checked images before Vuetify had mounted lazy image elements. It now waits for visible image containers to decode their actual images. Final captures contain the real covers; an early blank-cover capture is not acceptance evidence.

This is not an exhaustive native parity or accessibility audit. No Android/native screenshot baseline or pixel-diff run was performed. Live pagination error recovery, updates pagination beyond the first page, live mutations, authenticated deployments, non-Chromium browsers and physical-device behavior remain unverified. The 190-file source inventory in `PARITY_AUDIT.md` lists missing/partial components rather than claiming full implementation; native controllers and shared widgets outside that directory are not exhaustively inventoried.
