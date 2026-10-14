# Validation performed

- `npm run build`: passed, including strict `vue-tsc` checks.
- `npm test`: 10 tests passed (REST URL/method contracts, category coverage, deduplication, stale-response guards, error retention, manga/chapter loading, failed membership writes, and server-change data clearing).
- `npm run test:e2e`: 6 tests passed across 390×844 and 1440×1000 Chromium viewports. Tests use intercepted synthetic API responses, not a live server.
- 28 route/state captures generated; mobile and desktop layouts visually inspected. Icon loading, ligature shaping, wrapping, filtering, confirmation, error, and connection-dialog states were checked. No horizontal overflow or runtime exceptions were reported by the capture run.
- 12 semantic theme foreground/background pairs checked: minimum contrast 6.46:1. This is not a full WCAG audit.
- Production dependency audit: no known vulnerabilities reported by `npm audit --omit=dev` at validation time.
- Source scan found no GitHub PAT/token literals in project source, tests, scripts, documentation, environment example, or package manifests.

Not verified: live Suwayomi compatibility/authentication/CORS, real cover delivery, native Android screenshot parity, cross-browser behavior, and production hosting configuration. Synthetic fixtures exist only under tests and QA tooling; they are not an offline production fallback.
