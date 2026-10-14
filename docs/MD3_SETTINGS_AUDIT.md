# MD3 settings increment — six-point review

Scope: Vue/Vuetify 4.2.5 web presentation, inspired by pinned Mihon
`446f6df82c390ab760802c2fce3b677bce3f31c1`. This is **not full Mihon feature parity**.

## References compared

- Mihon `presentation/components/TabbedDialog.kt`: PrimaryTabRow, optional overflow,
  immediate changes, no Done footer.
- Mihon `presentation/manga/ChapterSettingsDialog.kt`: overflow defaults/reset,
  confirmation and optional application to library, filter/sort/display.
- Mihon `presentation-core/.../components/AdaptiveSheet.kt`: phone bottom sheet,
  tablet centered sheet, maximum 460dp, implicit dismissal.
- Mihon `util/system/DisplayExtensions.kt`: Automatic / Always / Landscape / Never;
  automatic smallest dimension thresholds 700 portrait / 600 landscape.
- Mihon `presentation/more/settings/screen/SettingsMainScreen.kt`: ten sections,
  selected rounded navigation item and two-pane settings.
- Mihon `SettingsAppearanceScreen.kt` and `reader/settings/ReaderSettingsDialog.kt`:
  grouped preferences and choice dialogs, not a wall of outlined selects.
- Official MD3 slider guidance: https://m3.material.io/components/sliders/guidelines
- Official MD3 tabs specs: https://m3.material.io/components/tabs/specs

## Changes by user issue

1. Shared `Md3Slider.vue`: refreshed vertical 4×44 CSS-pixel handle, 16px equal-height
   active/inactive track, gap around the handle, discrete stop dots, native semantic
   range input, keyboard Home/End/arrows, disabled and RTL states. Intermediate dots
   suppressed for more than 20 intervals to avoid crowding. Used for grid columns and
   reader page position. This is an explicit component adaptation, **not** a claim that
   Vuetify's default slider already has the refreshed shape.
2. Settings navigation contains the ten native sections in their original order:
   Appearance, Library, Reader, Downloads, Tracking, Browse, Data & storage, Security,
   Advanced, About. Separate eleventh Suwayomi section. Structure does not imply all
   native settings are implemented.
3. Supported appearance/reader choices use preference rows and radio-choice dialogs;
   theme modes use buttons; groups and spacing replace the old outlined-select wall.
   Library controls retain their functional browser preferences. Unsupported entries
   are disabled and explain their limitations; no decorative stateful controls.
4. Modal tabs use selected primary text and rounded 3px content-width indicators
   (minimum 24px), not full-tab-width underlines. Library category tabs and catalogue
   buttons are separate components and are not indiscriminately restyled.
5. Removed the shared Done footer from library/chapter/reader sheets. Escape, scrim,
   and phone downward header swipe dismiss sheets. Chapter overflow contains Set as
   default / Reset to defaults. Defaults require confirmation; optional application
   reads the library and only changes browser chapter preferences. Cancel/OK in this
   confirmation are intentional. The native library sheet has no defaults overflow,
   so a misleading global menu was not invented there.
6. Shared persisted tablet policy controls rail/bottom navigation, centered/bottom
   settings sheets, settings panes and manga panes. Defaults follow the reference's
   orientation thresholds in CSS viewport pixels, **not equivalent Android dp**.
   On windows narrower than 600px, forced tablet keeps rail/centered sheets but
   settings and manga remain single-column so text stays readable. Browser dialogs
   retain accessible focus trapping/Escape; Android back/gesture semantics are adapted.

## Real server settings

REST does not expose configuration through the pinned SettingsController. GraphQL
registration and SettingsQuery/SettingsMutation were inspected; live read-only
introspection confirmed SettingsType, SetSettingsInput, PartialSettingsTypeInput and
six selected field types. A combined introspection query was rejected by the server's
query-shape guard; separate focused introspections succeeded.

`serverSettings.ts` requests **only**: downloadAsCbz, autoDownloadNewChapters,
autoDownloadIgnoreReUploads, autoDownloadNewChaptersLimit, globalUpdateInterval,
maxSourcesInParallel. No auth passwords, database passwords, proxy credentials,
SyncYomi API keys, network binding or storage paths are fetched.

Changes remain drafts until explicit Save → confirmation → Save to server. Only changed
allowlisted fields are sent. No retries on mutations. Unconfirmed saves show an ambiguous
outcome warning and require reloading before another attempt. Reads/errors/absence are
not silently turned into editable defaults. Authentication uses the existing server
session; server URL changes invalidate stale results.

Live acceptance loads values and cancels/discards a draft, **never saves configuration**.
The actual server mutation path is covered only by isolated fixture tests, not claimed
as verified by writing to the user's server.

## Remaining gaps (explicit, not completion claims)

- Tracking-service login/sync; backups/restore/storage usage/cache deletion; Android
  biometric lock, secure-screen protection, notification and battery preferences;
  extension repositories/content-warning policy; translations/custom date formats,
  dynamic colors and alternate palettes are not integrated.
- Reader settings still expose Reading/General, not Mihon's full Color filter page.
- Scanlator selection remains unimplemented; Last update library sort remains disabled
  because the REST summaries do not provide trustworthy data for it.
- Server configuration editor covers six operational fields, not all Suwayomi settings.
- Phone swipe dismissal is a header gesture, not a full Compose anchored/nested-scroll
  implementation. No full Android gesture/pixel-parity claim.

## Acceptance and artifacts

Unit/build/browser regression results are recorded separately at delivery. Live captures
are produced by `scripts/capture-md3-settings-live.mjs`, with no fixture fallback. All
writes, legacy GET library mutations and onlineFetch=true are blocked; only the exact
allowlisted read-only GraphQL query is exempted from the POST guard. Catalogue GETs
may populate server cache; read-only QA is not a promise of zero cache side effects.
Screenshots, covers and raw live payloads stay outside this repository.

Validation for this increment: `npm test` — 70 passing unit tests;
`npm run build` — passing TypeScript and production build; full browser suite —
52 passing checks across mobile/desktop, then 8 focused MD3/server checks re-run
successfully after the final returned-value verification guard. Live acceptance —
32 phone/desktop screenshots, both read-only server checks successful, no page
errors or attempted blocked writes. Every final PNG was individually inspected;
two early cover captures were replaced after waiting for both image loading and
Vuetify's loaded-state transition. This verifies the shown settings/layout states,
not all unimplemented settings or actual live server writes.
