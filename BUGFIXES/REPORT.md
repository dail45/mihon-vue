# E2E Interactive Bug-Hunt & Parity Report

## Master Screen Audit Checklist

- [x] **Batch 1: Core Navigation & Library**
  - [x] Library (`/`, `/library` — `LibraryView.vue`)
  - [x] Categories (`/categories` — `CategoriesView.vue`)
  - [x] More (`/more` — `MoreView.vue`)

- [x] **Batch 2: Updates & History**
  - [x] Updates (`/updates` — `UpdatesView.vue`)
  - [x] Upcoming (`/upcoming` — `UpcomingView.vue`)
  - [x] History (`/history` — `HistoryView.vue`)

- [x] **Batch 3: Browse, Catalogue & Discovery**
  - [x] Browse (`/browse` — `BrowseView.vue`: Sources, Extensions, Migrate tabs)
  - [x] Source Catalogue (`/browse/source/:sourceId` — `SourceView.vue`)
  - [x] Global Search (`/browse/global-search` — `GlobalSearchView.vue`)

- [x] **Batch 4: Manga Details & Tracking**
  - [x] Manga Detail (`/manga/:id` — `MangaView.vue`)
  - [x] Manga Notes (`/manga/:id/notes` — `MangaNotesView.vue`)
  - [x] Tracker Dialogs & Wheel Pickers (`TrackInfoDialog.vue`, `TrackerLoginView.vue`)
  - [x] Tracker Search (`/tracker-search` — `TrackerSearchView.vue`)

- [x] **Batch 5: Reader & Offline Experience**
  - [x] Reader (`/manga/:id/read/:chapterIndex` — `ReaderView.vue`)
  - [x] Download Queue (`/download-queue` — `DownloadQueueView.vue`)
  - [x] Onboarding (`/onboarding` — `OnboardingView.vue`)

- [x] **Batch 6: Settings Ecosystem**
  - [x] Settings Main Layout (`/settings` — `SettingsView.vue`)
  - [x] Sub-screens: Appearance, Library, Reader, Downloads, Tracking, Browse, Data & Storage, Security, Advanced, About/Debug

---

## Bug Log & Resolution History

*(Incremental bug reports will be appended below)*

### [BUG-001] Library Bottom Action Menu Overlaps Desktop Navigation Rail
* **Type:** Visual / MD3 Layout Defect
* **Screen / Route:** `/library` (`MangaBottomActionMenu.vue`, `LibraryView.vue`)
* **Viewport:** Desktop (`1440x900`) / Tablet
* **Files Modified:** `src/features/manga/components/MangaBottomActionMenu.vue`
* **Problem & Root Cause:** When selection mode is entered in the Library on desktop or tablet layouts, `MangaBottomActionMenu` rendered with `position: fixed; inset-inline: 0; z-index: 1100;`. Because `inset-inline: 0` spans the full viewport width from x=0 to x=1440, the action bar completely overlapped the bottom 72px of the permanent 80px-wide navigation rail (`.mihon-rail`), obscuring the navigation rail container and violating Material Design 3 drawer/rail boundaries.
* **Fix Applied:** Changed `.manga-bottom-action` positioning from `inset-inline: 0;` to `inset-inline-start: var(--v-layout-left, 0px); inset-inline-end: var(--v-layout-right, 0px);`. This dynamically respects Vuetify's layout drawer offset (`80px` on desktop/tablet) while retaining 100% full-width on mobile viewports.
* **Screenshots (if Visual):**
  * Before: `./BUG-001-manga-bottom-action-rail-overlap/before.png`
  * After: `./BUG-001-manga-bottom-action-rail-overlap/after.png`

### [BUG-002] Library Items Stuck in Long-Press State and Unwanted Navigation During Selection Mode
* **Type:** Functional / Logical
* **Screen / Route:** `/library` (`LibraryCompactGridItem.vue`, `LibraryComfortableGridItem.vue`, `LibraryListItem.vue`)
* **Viewport:** Both (Desktop & Mobile)
* **Files Modified:** `src/features/library/components/LibraryCompactGridItem.vue`, `src/features/library/components/LibraryComfortableGridItem.vue`, `src/features/library/components/LibraryListItem.vue`
* **Problem & Root Cause:**
  1. In `onContextMenu`, right-clicking a manga item to select or range-select set `longPressed = true` and checked `if (longPressed) return`. Because desktop contextmenu events do not fire synthetic left clicks, `longPressed` remained permanently `true`. This blocked all subsequent right-clicks on that item and caused the next left click to be swallowed and dropped.
  2. In selection mode, left-clicking unselected items caused Vue Router to navigate to `/manga/:id` because the router-link's navigation listener fired before bubbling `@click` handlers could cancel navigation.
* **Fix Applied:**
  1. Separated context menu handling from touch long-press state: `onContextMenu` now prevents default and emits `'range'` directly without toggling or checking `longPressed`.
  2. Added an auto-clear timeout (`400ms`) to `onPointerDown` long-press timers to prevent stale touch hold state.
  3. Added `.capture` and `event.stopPropagation()` to `@click.capture="onClick"` and `@click.capture.stop="onLinkClick"`, ensuring selection toggle events are intercepted in the capture phase before Vue Router initiates navigation.

### [BUG-003] Updates Snackbar Floating with Hardcoded Mobile Offset on Desktop and Rail Alignment
* **Type:** Visual / MD3 Layout Defect
* **Screen / Route:** `/updates` (`UpdatesView.vue`, `UpdatesBottomBar.vue`, `UpcomingView.vue`)
* **Viewport:** Desktop (`1440x900`) & Mobile (`390x844`)
* **Files Modified:** `src/features/updates/views/UpdatesView.vue`, `src/features/updates/components/UpdatesBottomBar.vue`, `src/features/updates/views/UpcomingView.vue`
* **Problem & Root Cause:**
  1. In `UpdatesView.vue`, `.updates-snackbar` positioned with `bottom: calc(80px + env(safe-area-inset-bottom, 0px));`, hardcoding the 80px height of the mobile bottom navigation bar. On desktop/tablet viewports where no bottom navigation bar exists, the snackbar floated 80px high in mid-air instead of the MD3 specification (16px from screen bottom).
  2. In `UpdatesBottomBar.vue`, `.updates-action-snackbar` positioned with `bottom: calc(16px + ...);` when not in selection mode, which placed it underneath the 80px mobile navigation bar when visible.
  3. In `UpdatesBottomBar.vue` and `UpcomingView.vue`, bars were positioned with `left: var(--v-layout-left, 0px); right: 0;` rather than bidirectional layout insets `inset-inline-start` / `inset-inline-end`.
* **Fix Applied:**
  1. Changed `.updates-snackbar` and `.updates-action-snackbar` default offset to `bottom: calc(var(--v-layout-bottom, 0px) + 16px + env(safe-area-inset-bottom, 0px));`, which dynamically uses 0px on desktop (16px from bottom) and 80px on mobile (96px from bottom, floating 16px above the navigation bar).
  2. Changed `UpdatesBottomBar.vue` and `UpcomingView.vue` to use `inset-inline-start: var(--v-layout-left, 0px); inset-inline-end: var(--v-layout-right, 0px);`.
* **Screenshots (if Visual):**
  * Before: `./BUG-003-updates-snackbar-desktop-offset/before.png`
  * After: `./BUG-003-updates-snackbar-desktop-offset/after.png`

### [BUG-004] Updates and Upcoming Fast Scrollers Inoperative Due to Element vs Window Scroll Desync
* **Type:** Visual & Functional / MD3 Layout Defect
* **Screen / Route:** `/updates`, `/upcoming` (`UpdatesView.vue`, `UpcomingView.vue`)
* **Viewport:** Both (Desktop & Mobile)
* **Files Modified:** `src/features/updates/views/UpdatesView.vue`, `src/features/updates/views/UpcomingView.vue`
* **Problem & Root Cause:**
  1. In `UpdatesView.vue`, the fast scroll thumb `.updates-fast-scroll` was styled as `position: absolute; right: 2px; top: 0;` inside `.updates-feed`, with scroll events attached only to `@scroll.passive="onFeedScroll"` on `.updates-feed`. Because the application layout allows the document window (`window`) to scroll rather than the internal feed element, `onFeedScroll` never fired. The fast scroller thumb remained permanently hidden (`opacity: 0`), and dragging it attempted to set `scrollTop` on the non-scrolling feed container.
  2. Pull-to-refresh in `UpdatesView.vue` checked `container.scrollTop > 0` but failed to check `window.scrollY > 0`, causing pull-to-refresh to trigger when touching and dragging down anywhere down the page.
  3. In `UpcomingView.vue`, the mobile layout scrolled `window` while `@scroll.passive="onScrolled"` was only bound to `.upcoming-panels`.
* **Fix Applied:**
  1. Updated `UpdatesView.vue` and `UpcomingView.vue` scroll metrics to support both internal element scrolling and window scrolling seamlessly (`window.scrollY` and `window.scrollTo`).
  2. Registered global `window` scroll and resize listeners in `onMounted` with proper cleanup in `onUnmounted` / `onBeforeUnmount`.
  3. Changed `.updates-fast-scroll` to `position: fixed; right: 2px; top: 64px; z-index: 100;`.
  4. Added `window.scrollY > 0` guards to `onTouchStart` and `onTouchMove` in `UpdatesView.vue`.
* **Screenshots (if Visual):**
  * Before: `./BUG-004-updates-fast-scroller-window-scroll/before.png`
  * After: `./BUG-004-updates-fast-scroller-window-scroll/after.png`

### [BUG-005] History Add to Library Fails Due to Searching Library-Only Manga
* **Type:** Functional / Logical
* **Screen / Route:** `/history` (`HistoryView.vue`)
* **Viewport:** Both (Desktop & Mobile)
* **Files Modified:** `src/features/history/views/HistoryView.vue`
* **Problem & Root Cause:**
  In `HistoryItem.vue`, the "Add to library" (favorite) icon button is conditionally shown when a history entry is not in the library (`v-if="showFavorite"` where `showFavorite = !entry.inLibrary`).
  When clicked, it invoked `requestFavorite(mangaId)`.
  In `HistoryView.vue`, `requestFavorite` looked up `const manga = uniqueLibraryManga.value.find(item => item.id === mangaId) ?? null; if (!manga) return;`.
  Because `uniqueLibraryManga` only contains titles currently in the library, `uniqueLibraryManga.value.find` always returned `null` for any non-library entry.
  Consequently, `if (!manga) return` immediately aborted the function, silently dropping all user clicks on "Add to library" and making it impossible to add non-library titles from history or display the `DuplicateMangaDialog`.
* **Fix Applied:**
  Updated `requestFavorite` in `HistoryView.vue` to fetch the manga details via `createSuwayomiApi(server.apiUrl).manga(mangaId)` if not found in `uniqueLibraryManga.value`. If fetched, it runs `findDuplicateManga(manga, uniqueLibraryManga.value)` and displays `DuplicateMangaDialog` if duplicates are detected; otherwise it directly proceeds to `addToLibrary(mangaId)`.

### [BUG-006] Browse and Extensions Snackbars Floating with Hardcoded Mobile Offset on Desktop and Rail Misalignment
* **Type:** Visual / MD3 Layout Defect
* **Screen / Route:** `/browse` (`BrowseView.vue`, `BrowseExtensionsTab.vue`, `ExtensionStoresPanel.vue`, `ExtensionDetailsView.vue`, `SourcesFilterView.vue`, `ExtensionFilterView.vue`)
* **Viewport:** Desktop (`1440x900`) & Mobile (`390x844`)
* **Files Modified:** `src/features/browse/views/BrowseView.vue`, `src/features/browse/components/BrowseExtensionsTab.vue`, `src/features/browse/components/ExtensionStoresPanel.vue`, `src/features/browse/views/ExtensionDetailsView.vue`, `src/features/browse/views/SourcesFilterView.vue`, `src/features/browse/views/ExtensionFilterView.vue`
* **Problem & Root Cause:**
  1. In `BrowseView.vue` and `BrowseExtensionsTab.vue`, `.sources-snackbar` and `.extensions-snackbar` positioned with `bottom: calc(80px + 16px);`, hardcoding the 80px height of the mobile bottom navigation bar. On desktop viewports where no bottom bar exists (`--v-layout-bottom` is 0px), the snackbar floated 96px in the air instead of the MD3 specification (16px from screen bottom).
  2. On desktop viewports with an 80px permanent navigation rail (`.mihon-rail`), `left: 50%; transform: translateX(-50%)` positioned the snackbar relative to the full viewport width (1440px), centering it at x=720px rather than the content area center (x=760px), shifting it 40px leftward towards the rail.
  3. On mobile viewports with a home indicator or notch, safe-area insets (`env(safe-area-inset-bottom)`) were omitted.
* **Fix Applied:**
  1. Changed snackbar bottom positioning across Browse views to `bottom: calc(var(--v-layout-bottom, 0px) + 16px + env(safe-area-inset-bottom, 0px));`. This dynamically evaluates to 16px on desktop (when `--v-layout-bottom` is 0px) and 96px + safe-area on mobile (floating 16px above the navigation bar).
  2. Changed horizontal centering to `left: calc((100% + var(--v-layout-left, 0px) - var(--v-layout-right, 0px)) / 2); transform: translateX(-50%);`. This automatically shifts the center coordinate to respect the navigation rail drawer on desktop while remaining at 50% on mobile.
* **Screenshots (if Visual):**
  * Before: `./BUG-006-browse-snackbar-desktop-offset/before.png`
  * After: `./BUG-006-browse-snackbar-desktop-offset/after.png`

### [BUG-007] Source Catalogue Mode and Back Navigation Crash on structuredClone of Reactive Proxies
* **Type:** Functional / Logical
* **Screen / Route:** `/browse/source/:sourceId` (`SourceView.vue`, `sourceFilter.ts`)
* **Viewport:** Both (Desktop & Mobile)
* **Files Modified:** `src/features/browse/utils/sourceFilter.ts`
* **Problem & Root Cause:**
  When switching source listing modes (`chooseListing('popular')` / `chooseListing('latest')`), exiting catalogue search via the back button (`goBack()`), or resetting filters (`onFiltersReset()`), `SourceView.vue` calls `cloneSourceFilters(defaultFilters.value)` or `cloneSourceFilters(sourceFilters.value)`.
  In `sourceFilter.ts`, `cloneSourceFilters` was implemented as `return structuredClone(filters)`. Because `defaultFilters.value` and `sourceFilters.value` in Vue 3 are reactive proxies, the browser's native `structuredClone` algorithm threw:
  `DataCloneError: Failed to execute 'structuredClone' on 'Window': [object Object] could not be cloned.`
  This unhandled error interrupted execution of the click handlers, crashing listing mode switches and preventing the toolbar back button from closing search mode.
* **Fix Applied:**
  Replaced `structuredClone` in `cloneSourceFilters` with a deep-clone implementation that recursively copies filter objects, option values, display labels, group children, and filter state properties without attempting to pass Vue reactive proxies through browser `structuredClone`.

### [BUG-008] Browse Tab State Lost on Back Navigation from Sub-views
* **Type:** Functional / Logical
* **Screen / Route:** `/browse` (`BrowseView.vue`, `DefaultLayout.vue`, `ExtensionStoresView.vue`)
* **Viewport:** Both (Desktop & Mobile)
* **Files Modified:** `src/features/browse/views/BrowseView.vue`, `src/app/layouts/DefaultLayout.vue`, `src/features/browse/views/ExtensionStoresView.vue`
* **Problem & Root Cause:**
  1. `BrowseView.vue` declared `const activeTab = ref('sources')` with no binding or synchronization with route query or history state. When switching to "Extensions" or "Migrate" tabs, the tab state was purely ephemeral in-memory state.
  2. Sub-views accessible from the Extensions tab (`/browse/extensions/filter` and `/browse/extensions/stores`) routed back to `/browse` unconditionally without specifying the origin tab.
  3. Consequently, navigating to any extension sub-screen and clicking "Back" caused `BrowseView` to reset `activeTab` to `'sources'`, kicking the user away from the Extensions tab.
* **Fix Applied:**
  1. Synchronized `activeTab` in `BrowseView.vue` with `route.query.tab` (supporting `'sources'`, `'extensions'`, `'migrate'`), updating the route query via `router.replace` on tab changes and watching `route.query.tab`.
  2. Updated `DefaultLayout.vue` and `ExtensionStoresView.vue` back handlers to return to `{ path: '/browse', query: { tab: 'extensions' } }` or `{ path: '/browse', query: { tab: 'sources' } }` for sub-routes under `/browse/extensions/` and `/browse/sources/`.

### [BUG-009] Missing i18n Translation Keys Warning for Sources and Extensions Filter App Bar
* **Type:** Functional / Console Defect
* **Screen / Route:** `/browse/sources/filter`, `/browse/extensions/filter` (`SourcesFilterView.vue`, `ExtensionFilterView.vue`, `src/core/i18n/index.ts`, `src/router/index.ts`)
* **Viewport:** Both (Desktop & Mobile)
* **Files Modified:** `src/core/i18n/index.ts`, `src/router/index.ts`
* **Problem & Root Cause:**
  1. In `src/router/index.ts`, routes `/browse/sources/filter` and `/browse/extensions/filter` were registered with `meta: { title: 'Sources' }` and `meta: { title: 'Extensions' }` using raw English strings rather than Mihon string resource keys (`label_sources` and `label_extensions`).
  2. In `DefaultLayout.vue`, `toolbarTitle` computed `stringResource(route.meta.title as string)`. Because `stringResource` directly called `i18n.global.t(key)` without checking `i18n.global.te(key)` first, vue-i18n threw 3 intlify warnings on every navigation: `[WARNING] [intlify] Not found 'Sources' key in 'ru' locale messages`, fallback to 'en', and not found in 'en'.
  3. Furthermore, because raw English strings were stored in `meta.title`, the app bar header and page title failed to localize when non-English application languages (such as Russian) were active.
* **Fix Applied:**
  1. Added a `te(key)` existence check in `stringResource` (`src/core/i18n/index.ts`) before invoking `t(key)`. Non-key arbitrary text now cleanly returns itself without emitting console warnings.
  2. Updated router route metadata for `/browse/sources/filter` and `/browse/extensions/filter` to use canonical resource keys `'label_sources'` and `'label_extensions'`.
  3. Updated `router.afterEach` in `src/router/index.ts` to translate `to.meta.title` through `stringResource`, localizing the browser document title properly.

### [BUG-010] Extraneous Non-Props Attributes Warning on DownloadDropdownMenu in MangaToolbar
* **Type:** Functional / Console Defect
* **Screen / Route:** `/manga/:id` (`MangaToolbar.vue`, `DownloadDropdownMenu.vue`)
* **Viewport:** Both (Desktop & Mobile)
* **Files Modified:** `src/features/manga/components/DownloadDropdownMenu.vue`
* **Problem & Root Cause:**
  When mounting `/manga/:id`, `MangaToolbar.vue` passes `v-model="downloadExpanded"` to `<DownloadDropdownMenu>`. Vue compiles `v-model` into `modelValue` and `@update:modelValue`. Because `DownloadDropdownMenu.vue` only declared `expanded?: boolean` in `defineProps` and renders multi-root / fragment nodes (`<v-menu>` and `<v-dialog>`), Vue could not inherit the extraneous `modelValue` attribute to the root node and logged:
  `[Vue warn]: Extraneous non-props attributes (modelValue) were passed to component but could not be automatically inherited because component renders fragment or text or teleport root nodes.`
  Furthermore, the `downloadExpanded` state in `MangaToolbar` failed to synchronize with the internal open state of the dropdown.
* **Fix Applied:**
  Added `modelValue?: boolean` with default `undefined` to `defineProps` and `(event: 'update:modelValue', value: boolean): void` to `defineEmits` in `DownloadDropdownMenu.vue`. Updated the computed `open` ref to derive from `props.modelValue ?? props.expanded` and emit both `update:modelValue` and `update:expanded`.

### [BUG-011] Chapter List Items Context Menu Event Swallowed Blocking Desktop Selection and Range Selection
* **Type:** Functional / Logical
* **Screen / Route:** `/manga/:id` (`MangaChapterListItem.vue`, `MangaView.vue`)
* **Viewport:** Desktop (`1440x900`) / Tablet
* **Files Modified:** `src/features/manga/components/MangaChapterListItem.vue`
* **Problem & Root Cause:**
  In `MangaChapterListItem.vue`, the context menu event was bound as `@contextmenu.prevent` with no listener handler. On desktop layouts where touch long-press is not native, right-clicking on chapter rows was completely swallowed and ignored. Desktop users were unable to right-click to enter chapter selection mode or right-click across chapters to perform multi-item range selection (unlike `LibraryCompactGridItem`, `LibraryComfortableGridItem`, and `LibraryListItem` in `BUG-002`).
* **Fix Applied:**
  Added an `onContextMenu` handler to `MangaChapterListItem.vue` bound to `@contextmenu.prevent="onContextMenu"` that emits `'longpress'`. In `MangaView.vue`, `@longpress` connects to `handleLongPressSelect(chapter, visibleChapters)`, enabling desktop users to right-click to select chapters and range-select naturally.

### [BUG-012] Manga Notes Missing Parent Fallback on Back Navigation and CSS Insets Fallback
* **Type:** Visual & Functional / MD3 Layout Defect
* **Screen / Route:** `/manga/:id/notes` (`MangaNotesView.vue`)
* **Viewport:** Both (Desktop & Mobile)
* **Files Modified:** `src/features/manga/views/MangaNotesView.vue`
* **Problem & Root Cause:**
  1. In `MangaNotesView.vue`, the app bar back button executed `@click="router.back()"`. If the screen was loaded directly in a new tab, refreshed, or opened from an external route, `router.back()` navigated back to the unrelated previous URL or exited the app instead of returning to the parent manga detail screen (`/manga/:id`).
  2. In CSS, `.notes-screen` defined `left: var(--v-layout-left); right: var(--v-layout-right);` without default fallback values (`0px`). When `--v-layout-left` was not set by Vuetify (such as when `meta.detail: true` hides the navigation drawer rail), the CSS properties evaluated to invalid, breaking layout positioning.
* **Fix Applied:**
  1. Replaced `router.back()` with a `navigateUp` function that verifies `window.history.state?.back` and falls back to `/manga/${mangaId.value}`.
  2. Replaced `left` / `right` with `inset-inline-start: var(--v-layout-left, 0px); inset-inline-end: var(--v-layout-right, 0px);`.
* **Screenshots (if Visual):**
  * Before: `./BUG-012-manga-notes-navigation-and-layout/before.png`
  * After: `./BUG-012-manga-notes-navigation-and-layout/after.png`

### [BUG-013] Tracker Search Discards Query Parameter and Root Deep-Link Hijacks Sub-routes
* **Type:** Functional / Logical
* **Screen / Route:** `/tracker-search` (`TrackerSearchView.vue`, `src/app/App.vue`)
* **Viewport:** Both (Desktop & Mobile)
* **Files Modified:** `src/features/trackers/views/TrackerSearchView.vue`, `src/app/App.vue`
* **Problem & Root Cause:**
  1. In `TrackerSearchView.vue`, `useTrackerSearch` was initialized with `initialQuery: String(route.query.q ?? '')`. When navigating with the standard query parameter `query` (e.g. `/tracker-search?query=naruto` or from external links), `route.query.q` evaluated to undefined, causing the query to initialize as an empty string and dropping the user's intended search term.
  2. In `src/app/App.vue`, `applyDeepLink()` invoked `resolveDeepLink(window.location.search)` unconditionally on mount and popstate across the entire application without verifying the current path. When landing on `/tracker-search?query=naruto`, `resolveDeepLink` matched the `query` key as an Android `ACTION_SEARCH` intent and forcibly replaced the route with `/browse/global-search?q=naruto`, hijacking navigation away from Tracker Search.
  3. In `TrackerSearchView.vue`, the floating snackbar `.ts__snackbar` lacked layout inset and safe area offsets (`--v-layout-bottom` and `env(safe-area-inset-bottom)`), overlapping bottom elements on mobile.
* **Fix Applied:**
  1. Updated `initialQuery` in `TrackerSearchView.vue` to evaluate `String(route.query.q ?? route.query.query ?? '')`.
  2. Updated `applyDeepLink()` in `src/app/App.vue` to only process launcher intent deep links at the root entry points (`/` or `/library`), preventing URL interception on dedicated screens such as `/tracker-search`.
  3. Updated `.ts__snackbar` in `TrackerSearchView.vue` to compute `bottom: calc(var(--v-layout-bottom, 0px) + 24px + env(safe-area-inset-bottom, 0px));` and horizontal centering with navigation drawer compensation.

### [BUG-014] Reader Tap / Click Events Blocked by Surface Button Wrapper and Navigation Trapping
* **Type:** Visual & Functional / Logical
* **Screen / Route:** `/manga/:id/read/:chapterIndex` (`ReaderView.vue`, `ReaderPageIndicator.vue`)
* **Viewport:** Both (Desktop `1440x900` & Mobile `390x844`)
* **Files Modified:** `src/features/reader/views/ReaderView.vue`, `src/features/reader/components/ReaderPageIndicator.vue`
* **Problem & Root Cause:**
  1. In `ReaderView.vue`, the pager page container was rendered as an interactive `<button class="reader-page-surface">`. Meanwhile, `onViewerClick` checked `if (target?.closest('button, ...')) return;`. Because `.reader-page-surface` was itself a button, every mouse click or touch tap on the manga page was intercepted and swallowed by `target?.closest`, immediately aborting execution. As a result, tapping the center 34% never toggled the reader top and bottom app bars, and tapping left 33% or right 33% never turned pages or triggered transitions.
  2. In `ReaderTopBar`, the back arrow button was bound directly to `@back="router.back()"`. If the reader was loaded directly in a new tab, restored from history, or refreshed, `window.history.state?.back` was missing or pointed externally, trapping the user inside the reader view.
  3. In `ReaderPageIndicator.vue`, `.reader-page-indicator` had `bottom: env(safe-area-inset-bottom, 0px);`. When the safe-area inset was 0px (standard desktops and unnotched displays), the badge text was rendered flush against the bottom pixel boundary of the screen without MD3 margin.
* **Fix Applied:**
  1. Replaced `<button v-else class="reader-page-surface">` with `<div v-else class="reader-page-surface" role="region" aria-label="Manga page surface">`, and excluded `.reader-page-surface` from `target?.closest` in `onViewerClick`.
  2. Added a `navigateUp` function in `ReaderView.vue` that verifies whether `window.history.state?.back` includes `/manga/` before navigating back, falling back to `/manga/${route.params.id}`.
  3. Updated `ReaderPageIndicator.vue` bottom positioning to `bottom: calc(12px + env(safe-area-inset-bottom, 0px));`.
* **Screenshots (if Visual):**
  * Before: `./BUG-014-reader-click-navigation-and-layout/before.png`
  * After: `./BUG-014-reader-click-navigation-and-layout/after.png`

### [BUG-015] Download Queue Back Navigation Fails in Direct Access and Unset Bidirectional Layout Insets
* **Type:** Visual & Functional / MD3 Layout Defect
* **Screen / Route:** `/download-queue` (`DownloadQueueView.vue`)
* **Viewport:** Both (Desktop `1440x900` & Mobile `390x844`)
* **Files Modified:** `src/features/downloads/views/DownloadQueueView.vue`
* **Problem & Root Cause:**
  1. In `DownloadQueueView.vue`, the toolbar back button had `@click="router.back()"`. Because `/download-queue` is registered with `meta: { detail: true, ownToolbar: true }`, it renders its own app bar. When accessed directly in a fresh browser session or external link, `window.history.state?.back` was null, causing `router.back()` to fail silently and leaving the user trapped on the download queue screen instead of navigating to `/more`.
  2. `.queue-toolbar` positioned with physical `left:` and `right:` rather than bidirectional layout insets `inset-inline-start: var(--v-layout-left, 0px)` and `inset-inline-end: var(--v-layout-right, 0px)`.
  3. `.queue-fab` used hardcoded `right: 16px` without respecting drawer insets `calc(16px + var(--v-layout-right, 0px))`.
  4. `.queue-snackbar` had `bottom: calc(72px + env(safe-area-inset-bottom));`, hardcoding a 72px offset for a non-existent bottom navigation bar (as `meta.detail: true` hides mobile bottom nav).
* **Fix Applied:**
  1. Added a `navigateUp` method checking `window.history.state?.back` and falling back to `/more`, binding it to `@click="navigateUp"`.
  2. Updated `.queue-toolbar` to `inset-inline-start: var(--v-layout-left, 0px); inset-inline-end: var(--v-layout-right, 0px);`.
  3. Updated `.queue-fab` to `inset-inline-end: calc(16px + var(--v-layout-right, 0px));`.
  4. Updated `.queue-snackbar` to `bottom: calc(var(--v-layout-bottom, 0px) + 16px + env(safe-area-inset-bottom, 0px));` with dynamic navigation drawer horizontal centering.
* **Screenshots (if Visual):**
  * Before: `./BUG-015-download-queue-navigation-and-layout/before.png`
  * After: `./BUG-015-download-queue-navigation-and-layout/after.png`

### [BUG-016] Onboarding Desktop Card Unconstrained, Missing Step Indicator, and Unmount Navigation Rewind
* **Type:** Visual & Functional / MD3 Layout Defect
* **Screen / Route:** `/onboarding` (`OnboardingView.vue`, `GuidesStep.vue`, `src/app/App.vue`)
* **Viewport:** Both (Desktop `1440x900` & Mobile `390x844`)
* **Files Modified:** `src/features/onboarding/views/OnboardingView.vue`, `src/features/onboarding/components/GuidesStep.vue`, `src/app/App.vue`
* **Problem & Root Cause:**
  1. On desktop viewports (`1440x900`) and tablets (`>=640px`), `.onboarding-content`, `.onboarding-box`, and `.onboarding-accept` stretched across 100% full-width (1408px wide button and card), violating MD3 adaptive form specifications requiring max-width 640px centered containers.
  2. There was no step indicator showing progress across the 4 onboarding steps (`Theme`, `Storage`, `Permissions`, `Guides`).
  3. There was no visible "Back" button on the screen when on steps 1–3 (`currentStep > 0`), requiring desktop users to know hidden keyboard shortcuts (`Escape` or `Alt+Left`).
  4. When completing onboarding, `onBeforeUnmount` executed `for (let i = 0; i < pushedStates; i += 1) window.history.back()`, calling `window.history.back()` asynchronously multiple times upon unmount. This cancelled router navigation and popped the browser back to `/onboarding`. In addition, `GuidesStep.vue` had a multi-root fragment (`<div>` and `<v-dialog>`), causing Vue `<Transition>` warnings.
* **Fix Applied:**
  1. Constrained `.onboarding-content` and `.onboarding-actions` to `max-width: 640px; margin-inline: auto;` with centered column alignment on desktop viewports while preserving fluid 100% width on mobile.
  2. Implemented an MD3 step indicator stepper with 4 animated progress pills representing current and completed steps.
  3. Added an MD3 outlined "Back" action button (`.onboarding-back`) displayed alongside the primary action whenever `currentStep > 0`.
  4. Added `isFinishing` guard and `pushedStates = 0` to prevent `onBeforeUnmount` from rewinding history on completion, updated router navigation to `router.replace('/library')`, moved `<v-dialog>` inside `<div class="guides-step">` in `GuidesStep.vue` to make it a single root element, and updated `App.vue` to route to `/library` upon completion.
* **Screenshots (if Visual):**
  * Before: `./BUG-016-onboarding-responsive-layout-and-steps/before.png`
  * After: `./BUG-016-onboarding-responsive-layout-and-steps/after.png`

### [BUG-017] About Screen Copies "Server address: None" Due to Unwrapped Pinia Store Property
* **Type:** Functional / Logical
* **Screen / Route:** `/about` and `/settings/about` (`AboutView.vue`)
* **Viewport:** Both (Desktop & Mobile)
* **Files Modified:** `src/features/settings/views/AboutView.vue`
* **Problem & Root Cause:**
  In `AboutView.vue`, `debugInfo()` generates system and environment diagnostics copied to the clipboard when clicking on the "Version" row (`onPreferenceClick`). The string template interpolated `Server address: ${server.apiUrl.value || 'None'}`.
  Because `server` is a Pinia store created via `useSuwayomiStore()`, Pinia automatically unwraps `ref` and `computed` properties on store instances. Therefore, `server.apiUrl` is a primitive `string` (e.g. `'https://suwayomi.dail45.ru/api/v1'`), and accessing `.value` on it produces `undefined`.
  Consequently, `undefined || 'None'` always evaluated to `'None'`, so copying the debug info to the clipboard always reported that no server was configured (`Server address: None`), even when connected to a live Suwayomi server.
* **Fix Applied:**
  Updated `debugInfo()` in `AboutView.vue` to evaluate `${server.apiUrl || 'None'}` directly without `.value`.

### [BUG-018] Data and Storage Settings Category Subtitle Untranslated Due to Misnamed i18n Key
* **Type:** Visual & Functional / i18n Defect
* **Screen / Route:** `/settings` (`SettingsView.vue`, `SettingsLayout.vue`)
* **Viewport:** Both (Desktop `1440x900` & Mobile `390x844`)
* **Files Modified:** `src/features/settings/views/SettingsView.vue`, `src/app/layouts/SettingsLayout.vue`
* **Problem & Root Cause:**
  In `SECTION_STRING_MAP` of `SettingsView.vue` and `SettingsLayout.vue`, category metadata for `"data"` specified `{ title: 'label_data_storage', subtitle: 'pref_data_summary' }`.
  In Mihon's string resources (`MR.strings`), the canonical key for the data and storage subtitle ("Manual & automatic backups, storage space") is `pref_backup_summary` (`src/locales/en.json:199`), and `pref_data_summary` does not exist in any locale dictionary.
  Because `t('pref_data_summary')` returned undefined, `getItemSubtitle` fell back to the hardcoded English string `item.subtitle`. Consequently, in non-English locales (such as Russian), every category in the settings list was properly translated except for "Data and storage", whose subtitle remained untranslated in English.
* **Fix Applied:**
  Updated `SECTION_STRING_MAP` in both `SettingsView.vue` and `SettingsLayout.vue` to map `data.subtitle` to `'pref_backup_summary'`.
* **Screenshots (if Visual):**
  * Before: `./BUG-018-settings-data-summary-i18n-key/before.png`
  * After: `./BUG-018-settings-data-summary-i18n-key/after.png`

### [BUG-019] Debug Sub-screens Parent Navigation Fallback and Backup File Schema Title Mismatch
* **Type:** Visual & Functional / MD3 Layout Defect
* **Screen / Route:** `/settings/debug/backup-schema`, `/settings/debug/worker`, `/settings/data/create-backup`, `/settings/data/restore-backup`, `/settings/advanced/clear-database` (`BackupSchemaView.vue`, `WorkerInfoView.vue`, `CreateBackupView.vue`, `RestoreBackupView.vue`, `ClearDatabaseView.vue`)
* **Viewport:** Both (Desktop `1440x900` & Mobile `390x844`)
* **Files Modified:** `src/features/settings/views/BackupSchemaView.vue`, `src/features/settings/views/WorkerInfoView.vue`, `src/features/settings/views/CreateBackupView.vue`, `src/features/settings/views/RestoreBackupView.vue`, `src/features/settings/views/ClearDatabaseView.vue`
* **Problem & Root Cause:**
  1. In `BackupSchemaView.vue`, `TITLE` and `props.title` were defaulted to `'Backup schema'` instead of Mihon's canonical title `'Backup file schema'` (`BackupSchemaScreen.kt:30`: `const val TITLE = "Backup file schema"` and router meta title `Backup file schema`), causing a header vs document title mismatch.
  2. In `BackupSchemaView.vue`, `goBack()` navigated to `/settings` when `window.history.state?.back` was missing, bypassing its parent Debug Info screen (`/settings/advanced/debug`) and section (`/settings/advanced`).
  3. In `WorkerInfoView.vue`, `goBack()` navigated to `/settings/advanced` instead of its parent Debug Info screen (`/settings/advanced/debug`).
  4. In `CreateBackupView.vue` and `RestoreBackupView.vue`, toolbar styles used `left: var(--v-layout-left); right: var(--v-layout-right);` without default `0px` fallbacks, evaluating to CSS-invalid `auto` when `--v-layout-left` was unset.
  5. Floating toasts in `CreateBackupView.vue`, `RestoreBackupView.vue`, `ClearDatabaseView.vue`, and `WorkerInfoView.vue` used unconstrained `left: 50%; bottom: 24px;` without bidirectional drawer offsets or safe-area bottom insets (`env(safe-area-inset-bottom)`).
* **Fix Applied:**
  1. Updated `displayTitle` in `BackupSchemaView.vue` to default to `BACKUP_FILE_SCHEMA` (`'Backup file schema'`).
  2. Updated `goBack()` in both `BackupSchemaView.vue` and `WorkerInfoView.vue` to fall back to `/settings/advanced/debug`.
  3. Replaced physical `left`/`right` with `inset-inline-start: var(--v-layout-left, 0px); inset-inline-end: var(--v-layout-right, 0px);` in `CreateBackupView.vue`, `RestoreBackupView.vue`, and `ClearDatabaseView.vue`.
  4. Updated toasts to compute `left: calc((100% + var(--v-layout-left, 0px) - var(--v-layout-right, 0px)) / 2); transform: translateX(-50%);` and `bottom: calc(var(--v-layout-bottom, 0px) + 24px + env(safe-area-inset-bottom, 0px));`.
* **Screenshots (if Visual):**
  * Before: `./BUG-019-backup-schema-title-and-debug-navigation/before.png`
  * After: `./BUG-019-backup-schema-title-and-debug-navigation/after.png`

### [BUG-020] Chapter Download Indicator Menu Trigger Desync, Activator Leak and Long-Press Prerequisite
* **Type:** Functional & Visual / UX Defect
* **Screen / Route:** `/manga/:id` (`ChapterDownloadIndicator.vue`)
* **Viewport:** Both (Desktop `1440x900` & Mobile `390x844`)
* **Files Modified:** `src/features/manga/components/ChapterDownloadIndicator.vue`
* **Problem & Root Cause:**
  1. `<v-menu>` lacked `:open-on-click="false"`. Because Vuetify attaches an activator click listener by default, clicking on a non-downloaded chapter button started the download AND immediately popped open an empty or queued dropdown menu at the same time.
  2. `watch(() => props.state, () => { menu.value = false })` triggered on every download polling tick (every 1000ms in `useMangaDownloads.ts`), abruptly slamming open menus shut and causing flickering when reopening.
  3. Opening the delete menu on already-downloaded chapters was bound exclusively to a 500ms long-press timer (`pressTimer`), requiring users to awkwardly hold down the mouse on desktop and hold down their finger on mobile just to delete a chapter, while simple clicks either did nothing or immediately conflicted with Vuetify's toggle state.
* **Fix Applied:**
  1. Added `:open-on-click="false"` so that Vuetify's activator click listener does not automatically trigger the menu; opening/closing is strictly driven by component state.
  2. Restricted `watch` to `normalizedState` transitions (`if (next !== prev)`), preventing polling updates and progress changes from closing the active menu.
  3. Separated mouse from touch interactions: restricted long-press timer to `event.pointerType === 'touch'`.
  4. Added regular click toggle (`menu.value = !menu.value`) and context menu listener for downloaded/downloading chapters so single click or right-click immediately displays the Delete or Cancel menu.
  5. Hooked up canonical i18n string resources (`action_delete`, `action_cancel`, `action_start_downloading_now`).






