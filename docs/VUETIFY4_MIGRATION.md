# Vuetify 4 migration record

Dependency: Vuetify **4.2.5**, resolved by `package-lock.json`; app version **0.5.0**.

Source: [official upgrade guide](https://v4.vuetifyjs.com/en/getting-started/upgrade-guide/), also read from [the official repository](https://github.com/vuetifyjs/vuetify/blob/master/packages/docs/src/pages/en/getting-started/upgrade-guide.md). The main documentation URL timed out during extraction; the complete guide was read from the repository instead. Installed package source was checked for actual API/defaults.

This migration adopts v4 rather than restoring v3 behavior with legacy typography, shadow, grid or reset snippets. Mihon's palette and app-specific cover geometry are retained deliberately. Material Design 3 is not React's Material UI/MUI, and a v4 dependency is not proof of complete Android Mihon parity.

| Area | Changes / reviewed files |
|---|---|
| Dependency/configuration | package.json/package-lock.json upgraded to v4; removed v3 `md3` blueprint from src/plugins/vuetify.ts. Explicit component registration and self-hosted symbols retained. |
| Typography | All src/views and src/components Vue templates, including App, reader, error states and server dialog: MD2 text-h/subtitle/body/caption classes replaced by MD3 title/headline/body utilities. No compatibility type scale enabled. |
| CSS layers | public/layers.css loaded first in index.html; application base/components placed before Vuetify utilities. Reader styles also layered. This prevents old unlayered rules overriding every v4 utility. |
| Reset | Scoped authored heading/paragraph margins and explicit custom-button styles only. No blanket v3 universal reset. |
| Native controls | VCheckbox for boolean and tri-state rows (a controlled activation adapter synchronizes checked/indeterminate for the three-state cycle; mouse and Space are covered); VChip button controls for library display and Popular/Latest; VTextField for inline library/browse/updates/catalogue search; adaptive Vuetify dialog/sheet for library/chapter/reader settings. |
| Theme | Static Mihon light/dark tokens kept; App synchronizes browser system preference. Explicit colors are intentional, not a v3 default-theme compatibility mode. |
| Defaults | Removed legacy global button text-transform/letter-spacing and card-elevation overrides. v4 already removes default uppercase. Retained outlined text/select and primary checkbox/switch product choices. |
| Theme opacity | Custom alpha mixtures migrated to color-mix for v4 theme transparency support. |
| Responsive layout | v4 breakpoints kept; the app's 720px navigation/sheet switch remains explicit Mihon-inspired geometry. VContainer caps for detail/settings remain intentional. No VRow/VCol legacy grid restoration; manga collection uses CSS grid. |
| Overlay stack | Consistent Vuetify/component/overlay prebundling in vite.config.ts avoids duplicated dev overlay stacks. |
| Elevation | Existing intentional flat topbar/navigation use 0; no elevation >5 found and no MD2 shadow restoration. |
| Unused breaking changes | No VForm slot refs, item.raw select slots, VSnackbarQueue/default slot, multiline snackbar, range date picker, grid alignment props or removed Sass variables were found. |
| Sorting/display logic | Keep the comparator/filter/persistence fixes described in SORT_DISPLAY_AUDIT.md. Rendering changes do not replace or reset functional regression coverage. |

## Verification

- `tests/unit/vuetify4.test.ts` guards dependency major, absence of legacy typography/blueprint, layer order and native controls.
- Existing unit/browser suites must pass on v4. Runtime `.v-application[data-vuetify-version]` exposes installed version for acceptance assertions.
- Real-server acceptance uses explicit Suwayomi URL and mutation guards; v3 screenshots/reports are not reused as proof of v4 behavior. Live QA files are kept outside the repository.

## Still not parity

This is not a full Android Compose port. Missing native features and behavioral limitations remain documented in SORT_DISPLAY_AUDIT.md and PARITY_AUDIT.md. Native Android baseline/instrumentation is unavailable; browser screenshots do not certify pixel equality across native densities. No hidden compatibility snippets are used to claim a v4 migration while preserving an MD2 type/shadow system.

Dependency audit: `npm audit --omit=dev` reported zero production vulnerabilities after migration. The full audit still reports three development-tool findings in the existing Vitest toolchain; a separate major Vitest upgrade was not bundled into this UI migration.

## Acceptance results for this increment

- `npm test`: **62 passed** (9 files).
- `npm run build`: passed (TypeScript and production Vite build).
- `npm run test:e2e`: **44 passed**, mobile 390×844 and desktop 1440×1000. An additional targeted pass checked the final toolbar field centering/native 16px typography on both devices.
- Real Suwayomi sorting/display acceptance: **54 checks**, Vuetify runtime **4.2.5**, no reported browser errors or blocked mutation attempts.
- Screenshot acceptance is separate from fixture regression; real captures are supplied privately, not committed. Runtime, image/overflow/font checks and mutation guards are recorded in their reports.

The three-state adapter uses the native VCheckbox input and explicit checked/indeterminate synchronization. The test covers all three states by mouse and Space rather than trusting component visuals alone. It also verifies inclusion/exclusion against the actual displayed card order.
