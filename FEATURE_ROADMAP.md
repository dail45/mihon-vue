# Implementation Roadmap: Feature Parity & Fork Innovations for mihon-vue

> **Architectural Engineering Plan & Sprint Specifications**  
> **Prepared by:** Principal Frontend Architect & Product Lead  
> **Target Frontend:** `mihon-vue` (Vue 3, TypeScript, Pinia, Vue Router, Vuetify 4 MD3)  
> **Backend Integration:** Suwayomi-Server (Headless REST v1 & GraphQL `/api/graphql`)  
> **Source References:**  
> • **Mihon Upstream** (`446f6df82c390ab760802c2fce3b677bce3f31c1`)  
> • **TachiyomiSY** (`87d8db2de`)  
> • **Komikku** (`1656575e8f`)  
> **Date:** October 2026

---

## 1. Executive Summary & Architectural Directives

This document provides the definitive, actionable, step-by-step engineering roadmap to advance `mihon-vue` from **91.2% core Mihon parity** to **100% Mihon parity**, while strategically incorporating the most valuable source-agnostic power-user innovations from **TachiyomiSY** and **Komikku**.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              FEATURE ROADMAP SPRINT PHASES                             │
├─────────┬─────────────────────────────────────────────────────────┬────────────────────┤
│ Phase 1 │ Core Mihon 100% Parity & Suwayomi GraphQL Mutations     │ SPRINT 1 (Core)    │
│ Phase 2 │ Pro Reader Engine Overhaul (Desktop & Mobile UX)        │ SPRINT 2 (Reader)  │
│ Phase 3 │ Power-User Library, Categories, Updates & History       │ SPRINT 3 (Library) │
│ Phase 4 │ Browse Feeds, Saved Searches & Bulk Discovery           │ SPRINT 4 (Browse)  │
│ Phase 5 │ Advanced Manga Management & Tracking Automation         │ SPRINT 5 (Manga)   │
│ Phase 6 │ Theme Engine, Navbar Customization & WebDAV Cloud Sync  │ SPRINT 6 (Ecosystem│
└─────────┴─────────────────────────────────────────────────────────┴────────────────────┘
```

### 1.1 Strict Exclusion Policy (Safety & Feasibility Guardrails)
To maintain code cleanliness, security, and web feasibility, the following items are strictly excluded from this roadmap and all implementation sprints:
1. **Adult / Hentai Scrapers & Dedicated Screens**: Excludes `SettingsEhScreen`, `BrowseSourceEHentaiList`, ExHentai/E-Hentai gallery parser logic, nHentai, 8Muses, and adult batch-add URL parsers.
2. **Lewd Tri-State Filter (`filterLewd`)**: Excluded from library, browse, and updates filter dialogs.
3. **Android-Exclusive OS Capabilities**: Inviable browser features such as native APK installation (`PackageInstaller`), Android Storage Access Framework (`SAF`) tree permissions, biometric prompt hardware cryptography, and volume-rocker page flip listeners are excluded or replaced with standard web equivalents.

---

## Phase 1: Core Mihon 100% Parity & Suwayomi GraphQL Mutations

**Goal**: Close the remaining 8.8% gap against upstream Mihon by unlocking Suwayomi-Server's native GraphQL mutation surface for batch category assignments, batch chapter downloading, and full client-side migration orchestration.

---

### 1.1 Suwayomi GraphQL Batch Category Assignment
- **Feature Name & Origin**: Batch Category Assignment via GraphQL `[Mihon + Suwayomi GraphQL]`
- **Reference Files (Kotlin)**:
  - `mihon/app/src/main/java/eu/kanade/presentation/category/components/CategoryDialogs.kt` (`ChangeCategoryDialog`, lines 189–295)
  - `mihon/app/src/main/java/eu/kanade/tachiyomi/ui/library/LibraryViewModel.kt` (`setMangaCategories`, `clearSelection`)
  - Suwayomi GraphQL schema (`Suwayomi-VUI/schema.graphql`): `updateMangaCategories`, `updateMangasCategories`, `updateManga`
- **Target Files in `mihon-vue`**:
  - `src/core/api/categoriesBatch.ts` *(NEW)*: GraphQL mutation client for single and multi-manga category assignments
  - `src/features/library/components/ChangeCategoryDialog.vue` *(MODIFY)*: Keep existing MD3 tri-state dialog emitting `confirm(include, exclude)`
  - `src/features/library/views/LibraryView.vue` *(MODIFY)*: Replace notification stub in `onChangeCategoryConfirmed()` with real mutation call
  - `src/features/library/stores/suwayomi.ts` *(MODIFY)*: Add optimistic category map updater
- **State & Data Contract**:
  - **Endpoint**: `POST /api/graphql`
  - **Mutation**:
    ```graphql
    mutation UpdateMangasCategories($input: UpdateMangasCategoriesInput!) {
      updateMangasCategories(input: $input) {
        clientMutationId
      }
    }
    ```
  - **TypeScript Interface**:
    ```typescript
    export interface UpdateMangaCategoriesPatch {
      addToCategories?: number[]
      removeFromCategories?: number[]
      clearCategories?: boolean
    }

    export interface UpdateMangasCategoriesInput {
      ids: number[]
      patch: UpdateMangaCategoriesPatch
    }
    ```
  - **Fallback**: For Suwayomi servers lacking batch endpoint, iterate IDs with `updateManga(input: { id, patch: { categories: nextCategories } })`.
- **Acceptance Criteria**:
  - [x] Opening `ChangeCategoryDialog` with one or more selected manga displays checkmarks for categories containing all selected manga, and dashes (indeterminate) for categories containing some selected manga.
  - [x] Clicking a checkbox cycles through Checked (add to category) -> Unchecked (remove from category) -> Indeterminate (leave unchanged).
  - [x] Confirming executes `updateMangasCategories` GraphQL mutation against `/api/graphql` with selected IDs and `{ addToCategories, removeFromCategories }`.
  - [x] Fallback executes sequential GraphQL updates if batch mutation is not supported by backend version.
  - [x] On completion, `libraryByCategory` in `useSuwayomiStore` updates reactively; tab badge counts update without requiring a manual browser reload.
  - [x] Toast notification reads "Categories updated" instead of "Setting categories is not supported in the web version".

---

### 1.2 Library Batch Download Dropdown in Selection Bar
- **Feature Name & Origin**: Library Batch Download Actions `[Mihon]`
- **Reference Files (Kotlin)**:
  - `mihon/app/src/main/java/eu/kanade/presentation/manga/components/MangaBottomActionMenu.kt` (`LibraryBottomActionMenu`, lines 231–358; `DownloadDropdownMenu`)
  - `mihon/app/src/main/java/eu/kanade/tachiyomi/ui/library/LibraryViewModel.kt` (`performDownloadAction`, lines 499–509; `downloadNextChapters`, `downloadBookmarkedChapters`)
  - `mihon/domain/src/main/java/mihon/domain/chapter/interactor/FilterChaptersForDownload.kt`
- **Target Files in `mihon-vue`**:
  - `src/features/manga/components/MangaBottomActionMenu.vue` *(MODIFY)*: Enable `canDownload: true` when `variant === 'library'`; add `DownloadDropdownMenu`
  - `src/features/library/views/LibraryView.vue` *(MODIFY)*: Wire `:can-download="true"` and `@download="onBatchDownload"` on `<MangaBottomActionMenu>`
  - `src/features/library/stores/suwayomi.ts` *(MODIFY)*: Add `batchDownloadChapters(mangaList: Manga[], action: BatchDownloadAction)`
  - `src/core/api/chapterDownloads.ts` *(MODIFY)*: Add batch queueing helper
- **State & Data Contract**:
  - **TypeScript Interface**:
    ```typescript
    export type BatchDownloadAction =
      | 'NEXT_1_CHAPTER'
      | 'NEXT_5_CHAPTERS'
      | 'NEXT_10_CHAPTERS'
      | 'NEXT_25_CHAPTERS'
      | 'UNREAD_CHAPTERS'
      | 'BOOKMARKED_CHAPTERS'
    ```
  - **Execution**: For each selected manga, retrieve cached chapters, sort in ascending reading order, filter based on action (skipping read and already-downloaded chapters), and dispatch to Suwayomi GraphQL `enqueueChapterDownload` / REST download endpoint.
- **Acceptance Criteria**:
  - [x] Selecting 1+ manga in Library displays the Download icon button in `MangaBottomActionMenu` (`variant="library"`).
  - [x] Clicking Download button opens an MD3 menu anchored above the button with items: "Next chapter", "Next 5 chapters", "Next 10 chapters", "Next 25 chapters", "Unread", "Bookmarked".
  - [x] Selecting an option queues only eligible unread/bookmarked chapters for download across all selected manga.
  - [x] Action bar selection mode exits upon dispatch; snackbar displays "Queued X chapters for download".
  - [x] Migrate and Delete actions relocate into the overflow popup menu (`more_vert`), matching Mihon's layout.

---

### 1.3 Full Client-Side Migration Orchestration Engine
- **Feature Name & Origin**: Client-Side Migration Orchestrator `[Mihon + SY + KMK + Suwayomi Adaptor]`
- **Reference Files (Kotlin)**:
  - `mihon/app/src/main/java/mihon/feature/migration/list/MigrationListScreenModel.kt`: Migration state machine, flags evaluation (`MigrationFlag.CHAPTER`, `CATEGORY`, `CUSTOM_COVER`, `NOTES`, `REMOVE_DOWNLOAD`), progress reporting.
  - `mihon/app/src/main/java/mihon/domain/migration/models/MigrationFlag.kt`: Bitmask flag definitions.
- **Target Files in `mihon-vue`**:
  - `src/features/migration/composables/useMigrationOrchestrator.ts` *(NEW)*: 4-step transactional migration runner with automatic rollback stack
  - `src/core/api/chaptersBatch.ts` *(MODIFY)*: Batch GraphQL `UpdateChapters` mutation wrapper
  - `src/features/migration/views/MigrationListView.vue` *(MODIFY)*: Replace `UNSUPPORTED` stubs with real orchestration calls
  - `src/features/migration/components/MigrationProgressDialog.vue` *(MODIFY)*: Wire active progress bar, step description, and cancel handle
- **State & Data Contract**:
  - **TypeScript Interfaces**:
    ```typescript
    export interface MigrationFlags {
      copyChapters: boolean
      copyCategories: boolean
      copyNotes: boolean
      copyCustomCover: boolean
    }

    export interface MigrationOptions {
      replace: boolean // true: Migrate (delete source); false: Copy (keep source)
      flags: MigrationFlags
    }

    export interface MigrationStepStatus {
      step: 'ADD_TARGET' | 'SYNC_CHAPTERS' | 'ASSIGN_CATEGORIES' | 'COPY_NOTES' | 'DELETE_SOURCE'
      current: number
      total: number
      currentMangaTitle: string
      stepLabel: string
    }
    ```
  - **4-Step Transaction Pipeline**:
    1. **Add Target to Library**: `POST /api/v1/manga/{targetId}/library` (fallback `GET /api/v1/manga/{targetId}/library`).
    2. **Sync Chapter Progress & Bookmarks**: Fetch source chapters and target chapters; match target chapters by numerical `chapterNumber` (or sanitized name); execute GraphQL `UpdateChapters` batch mutation (`isRead: true`, `lastPageRead: N`).
    3. **Sync Categories**: Retrieve source categories from `libraryByCategory`; assign to target manga via `updateMangasCategories` GraphQL mutation.
    4. **Copy Notes & Delete Source**: Copy notes in `useMangaNotesStore`; if `replace === true`, call `DELETE /api/v1/manga/{sourceId}/library`.
  - **Rollback Handler**: If step 2 or 3 fails, the target manga is removed via `DELETE /api/v1/manga/{targetId}/library`, leaving the original source manga untouched.
- **Acceptance Criteria**:
  - [x] Clicking "Migrate" or "Copy" in `MigrationListView.vue` executes the 4-step orchestration sequence without displaying the legacy limitation toast.
  - [x] `MigrationProgressDialog.vue` renders an active MD3 linear progress bar with step label ("Step 2/4: Copying chapter progress...") and title.
  - [x] Read status and `lastPageRead` progress transfer accurately to matching chapters in the target manga.
  - [x] Target manga receives the same category assignments as the source manga.
  - [x] In Migrate mode (`replace = true`), source manga is deleted from library only after target is successfully populated.
  - [x] In Copy mode (`replace = false`), both source and target remain in library.
  - [x] Network errors during progress copy trigger rollback (deleting target manga), preserving source manga integrity.
  - [x] Clicking "Cancel" stops subsequent migrations in the queue safely.

---

### 1.4 Single-Entry Smart Migration Toggle
- **Feature Name & Origin**: Single-Entry Smart Migration `[Komikku]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/domain/source/service/SourcePreferences.kt` (`migration_smart_search_single_entry`, line 90)
  - `komikku/app/src/main/java/mihon/feature/migration/config/MigrationConfigScreenSheet.kt` (lines 166–175)
  - `komikku/app/src/main/java/mihon/feature/migration/config/MigrationConfigScreen.kt` (lines 122–129)
  - `komikku/app/src/main/java/mihon/feature/migration/list/MigrationListScreen.kt` (lines 34–65)
- **Target Files in `mihon-vue`**:
  - `src/features/migration/views/MigrationConfigView.vue` *(MODIFY)*: Add "Use smart search for single entry" switch in config sheet
  - `src/features/migration/views/MigrationListView.vue` *(MODIFY)*: Auto-select highest scoring match (`similarity >= 0.4`) and provide 1-click execution
  - `src/features/settings/stores/preferences.ts` *(MODIFY)*: Persist `migrationSmartSearchSingleEntry`
- **State & Data Contract**:
  - **Storage Key**: `localStorage['mihon.migration.smartSearchSingleEntry']` (`'true' | 'false'`, default `'false'`)
  - **Scoring**: Normalized Levenshtein distance `similarity >= 0.4` with chapter count tie-breaker.
- **Acceptance Criteria**:
  - [x] Migrating a single manga (`mangaIds.length === 1`) displays config sheet featuring "Smart search for single entry" switch.
  - [x] If switch is disabled, clicking Continue navigates to manual search (`MigrateSearchView.vue`).
  - [x] If switch is enabled, clicking Continue navigates directly to `MigrationListView.vue` with target auto-selected.
  - [x] Highest scoring candidate (`>= 40% similarity`) is preselected with match confidence badge (`95% match`).
  - [x] One-click "Migrate" action button executes migration immediately; "Search manually" overflow action allows manual override.

---

### 1.5 Global Search Pinned-State 3-Way Cycle Filter
- **Feature Name & Origin**: Global Search Pinned-State Cycle Filter `[Komikku]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/domain/source/service/SourcePreferences.kt` (`globalSearchPinnedState`, lines 92–95)
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/browse/source/globalsearch/GlobalSearchScreenModel.kt` (lines 20–29)
  - `komikku/app/src/main/java/eu/kanade/presentation/browse/components/GlobalSearchToolbar.kt` (lines 94–128)
- **Target Files in `mihon-vue`**:
  - `src/features/browse/stores/browsePreferences.ts` *(MODIFY)*: Add `globalSearchPinnedState: Ref<'All' | 'PinnedOnly' | 'Unpinned'>`
  - `src/features/browse/components/GlobalSearchToolbar.vue` *(MODIFY)*: Replace static chips with 3-state cycling FilterChip
  - `src/features/browse/views/GlobalSearchView.vue` *(MODIFY)*: Filter query worker pool by active pinned state
- **State & Data Contract**:
  - **Storage Key**: `localStorage['mihon.globalSearchPinnedState']` (`'PinnedOnly' | 'Unpinned' | 'All'`, default `'PinnedOnly'`)
  - **Cycle Sequence**: `PinnedOnly` -> `Unpinned` -> `All` -> `PinnedOnly`.
- **Acceptance Criteria**:
  - [x] Global search toolbar features a single dynamic filter chip displaying current state and icon (`mdi-pin`, `mdi-pin-off-outline`, or `mdi-check-all`).
  - [x] Clicking the chip cycles sequentially between Pinned Only -> Unpinned Only -> All Sources.
  - [x] Cycling filter aborts in-flight searches from the excluded pool and immediately queries the selected source partition.
  - [x] State persists across sessions in `localStorage`.
  - [x] If user has zero pinned sources, automatically defaults to "All sources" without crashing.

---

## Phase 2: Pro Reader Engine Overhaul (Desktop & Mobile UX)

**Goal**: Deliver a desktop-grade and mobile-optimized reading engine with dual-page spreads, aspect-ratio constraints for ultrawide monitors, anticipatory page caching, smaller tap boundaries, and canvas-stitched clipboard export.

---

### 2.1 Reader Double-Page Spread
- **Feature Name & Origin**: Double-Page Spread Layout `[SY + KMK]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/reader/setting/ReaderPreferences.kt` (`pageLayout`, `invertDoublePages`, `centerMarginType`, lines 205–210)
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/reader/viewer/pager/PagerConfig.kt` (`PageLayout`, `CenterMarginType`, `shiftDoublePage`, lines 65–86)
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/reader/viewer/pager/PagerViewerAdapter.kt` (`setJoinedItems`, lines 238–346)
- **Target Files in `mihon-vue`**:
  - `src/features/reader/stores/readerPreferences.ts` *(MODIFY)*: Add `pageLayout`, `invertDoublePages`, `shiftDoublePages`, `centerMarginType`
  - `src/features/reader/views/ReaderView.vue` *(MODIFY)*: Compute spread pairs `[Page, Page | null]`, landscape auto-spread, CSS grid spread layout
  - `src/features/reader/components/ReadingModePage.vue` *(MODIFY)*: Add Page Layout mode selector, Shift Cover switch, Invert Spread switch, and Gutter margin selector
- **State & Data Contract**:
  - **Storage Keys**:
    - `mihon.reader.pageLayout`: `'single' | 'double' | 'auto'` (default: `'auto'`)
    - `mihon.reader.shiftDoublePages`: `boolean` (default: `false`)
    - `mihon.reader.invertDoublePages`: `boolean` (default: `false`)
    - `mihon.reader.centerMarginType`: `'none' | 'double' | 'wide' | 'double_and_wide'` (default: `'none'`)
  - **TypeScript Interface**:
    ```typescript
    export type PageLayoutMode = 'single' | 'double' | 'auto'
    export type CenterMarginType = 'none' | 'double' | 'wide' | 'double_and_wide'

    export interface SpreadPageItem {
      primaryIndex: number
      secondaryIndex: number | null
      isShifted: boolean
      isLandscapeScan: boolean
    }
    ```
- **Acceptance Criteria**:
  - [x] When `pageLayout` is `'double'` (or `'auto'` on landscape viewports `width > height`), reader renders two consecutive portrait pages side-by-side.
  - [x] Single pages with landscape aspect ratio (`naturalWidth > naturalHeight`) display solo without pairing.
  - [x] Enabling `shiftDoublePages` keeps Page 0 (cover) displayed solo (`[0, null]`), pairing subsequent pages as `[1, 2], [3, 4]`.
  - [x] When reading mode is RTL or `invertDoublePages` is true, secondary page renders on the left and primary on the right (Manga reading order).
  - [x] Center gutter margin inserts a configurable spine divider (e.g. 8px background gap) between paired pages when `centerMarginType !== 'none'`.
  - [x] Page navigation advances by 2 pages in spread mode (or 1 page when traversing a solo cover/landscape page).

---

### 2.2 Webtoon Smart Scale on Wide Screens
- **Feature Name & Origin**: Webtoon Smart Scale `[Komikku]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/reader/setting/ReaderPreferences.kt` (`webtoonScaleType`, `WebtoonScaleType`, lines 67, 246–256)
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/reader/viewer/webtoon/WebtoonViewer.kt` (`webtoonScaleTypeChangedListener`, lines 181–207)
  - `komikku/app/src/main/java/eu/kanade/presentation/reader/settings/ReadingModePage.kt`
- **Target Files in `mihon-vue`**:
  - `src/features/reader/stores/readerPreferences.ts` *(MODIFY)*: Add `webtoonScaleType`, `longStripGapSmartScale`
  - `src/features/reader/views/ReaderView.vue` *(MODIFY)*: Apply responsive CSS `max-width` to `.reader-strip`
  - `src/features/reader/components/ReadingModePage.vue` *(MODIFY)*: Add Webtoon Scale Type chip row
- **State & Data Contract**:
  - **Storage Key**: `mihon.reader.webtoonScaleType` (`'fit' | '4:3' | '3:2' | '16:9' | '20:9'`, default `'fit'`)
  - **CSS Constraint Formula**:
    ```css
    .reader-strip {
      max-width: calc(100vh * var(--webtoon-aspect-ratio, 0));
      margin-inline: auto;
      width: 100%;
    }
    ```
    - `fit`: `100%` (no constraint)
    - `4:3`: ratio `0.75`
    - `3:2`: ratio `0.6667`
    - `16:9`: ratio `0.5625`
    - `20:9`: ratio `0.45`
- **Acceptance Criteria**:
  - [x] On desktop/tablet displays, selecting 16:9, 4:3, 3:2, or 20:9 constrains the webtoon strip width relative to viewport height.
  - [x] On viewports narrower than the calculated max-width (e.g. mobile portrait), strip seamlessly fills 100% width without horizontal scrolling.
  - [x] Selecting "Fit" expands strip to 100% width across all screens.
  - [x] Scale updates reactively upon selecting a chip in `ReadingModePage.vue` without reloading.

---

### 2.3 Auto-Webtoon Heuristic Mode
- **Feature Name & Origin**: Auto-Webtoon Heuristic Detection `[SY + KMK]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/exh/util/MangaType.kt` (`mangaType`, lines 28–50; `isWebtoonTag`, `isManhwaTag`, `isManhuaTag`)
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/reader/ReaderViewModel.kt` (`getMangaReadingMode`, lines 1004–1018)
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/reader/setting/ReaderPreferences.kt` (`useAutoWebtoon`, line 191)
- **Target Files in `mihon-vue`**:
  - `src/features/reader/utils/autoWebtoon.ts` *(NEW)*: Heuristic tag and genre matching helper
  - `src/features/reader/stores/readerPreferences.ts` *(MODIFY)*: Add `autoWebtoon: boolean` (default `true`)
  - `src/features/reader/stores/reader.ts` *(MODIFY)*: When reading mode is `'default'`, detect webtoon tags and set active mode to `'webtoon'`
  - `src/features/reader/components/GeneralSettingsPage.vue` *(MODIFY)*: Add "Auto-Webtoon detection" switch
- **State & Data Contract**:
  - **Storage Key**: `mihon.reader.autoWebtoon` (boolean, default: `true`)
  - **Matching Keywords**: Case-insensitive substring check across `manga.genre`: `['webtoon', 'long strip', 'manhwa', 'manhua', 'манхва', 'маньхуа']`.
- **Acceptance Criteria**:
  - [x] Opening a manga with default reading mode whose genre contains "webtoon" or "manhwa" automatically sets reader mode to Webtoon (Long strip).
  - [x] Explicit user per-manga reading mode overrides (e.g. forced LTR) are strictly respected and not overridden.
  - [x] Disabling `autoWebtoon` in reader settings enforces global `defaultReadingMode` across all titles.

---

### 2.4 Continuous Strip Gaps Mode
- **Feature Name & Origin**: Long Strip with Gaps `[Mihon + SY + KMK]`
- **Reference Files (Kotlin)**:
  - `mihon/app/src/main/java/eu/kanade/presentation/reader/settings/ReadingModePage.kt` (`CONTINUOUS_VERTICAL`)
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/reader/setting/ReadingMode.kt` (`CONTINUOUS_VERTICAL(5)`)
- **Target Files in `mihon-vue`**:
  - `src/features/reader/stores/readerPreferences.ts` *(MODIFY)*: Expand `ReadingMode` union to `'ltr' | 'rtl' | 'webtoon' | 'continuous'`; add `stripGapSize: number`
  - `src/features/reader/views/ReaderView.vue` *(MODIFY)*: Render `.reader-strip--gaps` with dynamic row gap styling
  - `src/features/reader/components/ReadingModePage.vue` *(MODIFY)*: Remove unsupported toast restriction and wire continuous mode
  - `src/features/reader/components/GeneralSettingsPage.vue` *(MODIFY)*: Add gap size slider (0..32px)
- **State & Data Contract**:
  - **Storage Keys**:
    - `mihon.reader.mode`: `'ltr' | 'rtl' | 'webtoon' | 'continuous'`
    - `mihon.reader.stripGapSize`: `number` (default: `16` in px)
  - **CSS Layout**:
    ```css
    .reader-strip--gaps {
      display: flex;
      flex-direction: column;
      row-gap: var(--reader-strip-gap, 16px);
      padding: var(--reader-strip-gap, 16px) 0;
    }
    ```
- **Acceptance Criteria**:
  - [x] Selecting "Long strip with gaps" in `ReadingModePage` sets `mode = 'continuous'` without showing an unsupported notification.
  - [x] Vertical scroll renders distinct visible gap separation between consecutive images.
  - [x] Scroll position tracking and active page number calculation function smoothly with gaps present.
  - [x] Gap size adjusts from 0px to 32px via slider and persists in `localStorage`.

---

### 2.5 Smaller Tap Zones Toggle
- **Feature Name & Origin**: Smaller Tap Zones `[Komikku]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/reader/setting/ReaderPreferences.kt` (`smallerTapZone`, line 168)
  - `komikku/app/src/main/java/eu/kanade/presentation/reader/settings/ReadingModePage.kt`
- **Target Files in `mihon-vue`**:
  - `src/features/reader/stores/readerPreferences.ts` *(MODIFY)*: Add `smallerTapZone: boolean` (default `false`)
  - `src/features/reader/views/ReaderView.vue` *(MODIFY)*: Update horizontal coordinate boundary checks in `onViewerClick`
  - `src/features/reader/components/ReadingModePage.vue` *(MODIFY)*: Add "Smaller tap zones" switch
- **State & Data Contract**:
  - **Storage Key**: `mihon.reader.smallerTapZone` (boolean, default: `false`)
  - **Zone Boundaries**:
    - Default (`false`): Left 33.3% = Backward, Right 33.3% = Forward, Middle 33.4% = Menu
    - Smaller (`true`): Left 25% = Backward, Right 25% = Forward, Middle 50% = Menu
- **Acceptance Criteria**:
  - [x] When `smallerTapZone` is enabled, tapping anywhere within the middle 50% of the screen toggles top/bottom reader bars.
  - [x] Edge navigation triggers strictly on the outer 25% boundaries.
  - [x] Preference toggles reactively in `ReadingModePage.vue`.

---

### 2.6 Gesture & Zoom Controls
- **Feature Name & Origin**: Paged Zoom Lock & Webtoon Pinch Toggle `[Komikku]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/reader/setting/ReaderPreferences.kt` (`pagedDisableZoomIn:104`, `webtoonPinchToZoomEnabled:61`)
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/reader/viewer/pager/PagerConfig.kt` (`disableZoomIn:54`)
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/reader/viewer/webtoon/WebtoonViewer.kt` (`pinchToZoomChangedListener:177`)
- **Target Files in `mihon-vue`**:
  - `src/features/reader/stores/readerPreferences.ts` *(MODIFY)*: Add `pagedDisableZoomIn` and `webtoonPinchToZoom`
  - `src/features/reader/views/ReaderView.vue` *(MODIFY)*: Conditionally suppress touch pinch events and double-click zoom
  - `src/features/reader/components/ReadingModePage.vue` *(MODIFY)*: Add checkboxes in Pager and Webtoon settings sections
- **State & Data Contract**:
  - **Storage Keys**:
    - `mihon.reader.pagedDisableZoomIn`: `boolean` (default: `false`)
    - `mihon.reader.webtoonPinchToZoom`: `boolean` (default: `true`)
- **Acceptance Criteria**:
  - [x] When `webtoonPinchToZoom` is false, two-finger pinching on Webtoon strip is suppressed, preventing jumpy page scaling while scrolling.
  - [x] When `pagedDisableZoomIn` is true, double-click/double-tap zoom is disabled in paged mode, preserving fixed framing.
  - [x] Preferences persist in `localStorage`.

---

### 2.7 Wide Image 2x Zoom
- **Feature Name & Origin**: Wide Image Zoom Scale Type `[Komikku]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/reader/setting/ReaderPreferences.kt` (`landscapeZoomType`, `LandscapeZoomScaleType`, lines 84, 239–245)
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/reader/viewer/ReaderPageImageView.kt` (`landscapeZoom`, lines 127–154)
- **Target Files in `mihon-vue`**:
  - `src/features/reader/stores/readerPreferences.ts` *(MODIFY)*: Add `landscapeZoom` and `landscapeZoomType: 'fit' | 'double'`
  - `src/features/reader/views/ReaderView.vue` *(MODIFY)*: Apply 2x transform scale when `landscapeZoomType === 'double'` on landscape scans
  - `src/features/reader/components/ReadingModePage.vue` *(MODIFY)*: Add Landscape Zoom Scale Type chip selector ("Fit screen" vs "Double (2x)")
- **State & Data Contract**:
  - **Storage Keys**:
    - `mihon.reader.landscapeZoom`: `boolean` (default: `true`)
    - `mihon.reader.landscapeZoomType`: `'fit' | 'double'` (default: `'fit'`)
- **Acceptance Criteria**:
  - [x] Viewing a wide landscape page (`naturalWidth > naturalHeight`) in paged mode with `landscapeZoomType === 'double'` scales image to 200% (`scale(2)`) with scroll capability.
  - [x] When set to `'fit'`, image scales to fit window height.
  - [x] Switching options applies immediately without reload.

---

### 2.8 Dual-Page Clipboard Copy & Canvas Stitching
- **Feature Name & Origin**: Spread Clipboard Copy Actions `[Komikku + SY]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/presentation/reader/ReaderPageActionsDialog.kt` (`action_copy_to_clipboard_first_page`, `action_copy_to_clipboard_second_page`, `action_copy_to_clipboard_combined_page`)
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/reader/ReaderViewModel.kt` (`shareImages`, lines 1349–1373)
- **Target Files in `mihon-vue`**:
  - `src/features/reader/utils/canvasStitch.ts` *(NEW)*: Offscreen Canvas utility stitching two image URLs into a single PNG Blob
  - `src/features/reader/components/ReaderPageActionsDialog.vue` *(MODIFY)*: Render 3 action rows when viewing a spread (First page, Second page, Combined page)
  - `src/features/reader/views/ReaderView.vue` *(MODIFY)*: Pass spread image URLs to actions dialog
- **State & Data Contract**:
  - **Stitcher Function**:
    ```typescript
    export async function stitchPagesToBlob(
      firstUrl: string,
      secondUrl: string,
      direction: 'ltr' | 'rtl' = 'ltr'
    ): Promise<Blob>
    ```
  - **Clipboard API**: Writes PNG blob directly via `navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])`.
- **Acceptance Criteria**:
  - [x] Opening page actions on a double-page spread presents:
    - First page actions (Copy, Share, Save)
    - Second page actions (Copy, Share, Save)
    - Combined spread actions (Copy combined, Share combined, Save combined)
  - [x] Clicking "Copy to clipboard (combined)" loads both image bitmaps, stitches them side-by-side onto an offscreen canvas in correct LTR/RTL reading order, and writes PNG Blob to system clipboard.
  - [x] Clicking "Save combined" downloads the stitched image file.
  - [x] Snackbar confirms "Combined page copied to clipboard".

---

### 2.9 Anticipatory Page Preloading Buffer
- **Feature Name & Origin**: Anticipatory Image Preloader `[Mihon + SY + KMK]`
- **Reference Files (Kotlin)**:
  - `mihon/app/src/main/java/eu/kanade/tachiyomi/ui/reader/loader/HttpPageLoader.kt`
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/reader/setting/ReaderPreferences.kt` (`preloadSize`, line 189)
- **Target Files in `mihon-vue`**:
  - `src/features/reader/composables/usePagePreloader.ts` *(NEW)*: Composable prefetching `currentPage + 1`, `currentPage + 2`, and `currentPage - 1`
  - `src/features/reader/views/ReaderView.vue` *(MODIFY)*: Integrate `usePagePreloader` tied to `reader.pageIndex`
- **State & Data Contract**:
  - **Composable Contract**:
    ```typescript
    export function usePagePreloader(options: {
      pageIndex: () => number
      pageCount: () => number
      pageUrl: (index: number) => string
      bufferAhead?: number // default: 2
      bufferBehind?: number // default: 1
    }): {
      preloadCache: Ref<Map<number, HTMLImageElement>>
      clearCache: () => void
    }
    ```
- **Acceptance Criteria**:
  - [x] When current page index updates in paged mode, preloader instantiates `new Image()` for `index + 1`, `index + 2`, and `index - 1`.
  - [x] Preloaded images are kept in memory cache; turning pages forward displays next page with 0ms delay without loading spinner.
  - [x] Switching chapters or unmounting reader releases image memory references to prevent leaks.

---

## Phase 3: Power-User Library, Categories, Updates & History

**Goal**: Upgrade Library and History management with dynamic runtime grouping, tag-priority sorting, hidden category flags, tri-state category inclusion/exclusion, panorama cards, FlagKit icons, and update error reviews.

---

### 3.1 Dynamic Library Grouping
- **Feature Name & Origin**: Dynamic Library Grouping (`GroupPage`) `[SY + KMK]`
- **Reference Files (Kotlin)**:
  - `TachiyomiSY/domain/src/main/java/tachiyomi/domain/library/model/LibraryGroup.kt` (`BY_DEFAULT = 0`, `BY_SOURCE = 1`, `BY_STATUS = 2`, `BY_TRACK_STATUS = 3`, `UNGROUPED = 4`)
  - `TachiyomiSY/app/src/main/java/eu/kanade/presentation/library/LibrarySettingsDialog.kt` (`GroupPage`, `GroupMode`)
  - `TachiyomiSY/app/src/main/java/eu/kanade/tachiyomi/ui/library/LibraryViewModel.kt` (`applyGrouping()`, `getGroupedMangaItems()`, lines 427–468, 1175–1255)
- **Target Files in `mihon-vue`**:
  - `src/core/utils/library.ts` *(MODIFY)*: Add `LibraryGroupMode` union, grouping constants, and `deriveVirtualCategories()` helper
  - `src/features/settings/stores/preferences.ts` *(MODIFY)*: Add `groupMode: ref<LibraryGroupMode>` (default `0`), key `mihon.library.groupMode`
  - `src/features/library/components/LibrarySettingsSheet.vue` *(MODIFY)*: Add 4th tab "Group" with radio options (Default, By Source, By Status, By Track Status, Ungrouped)
  - `src/features/library/views/LibraryView.vue` *(MODIFY)*: Swap real category tabs with virtual categories when `groupMode !== 0`
- **State & Data Contract**:
  - **Storage Key**: `localStorage['mihon.library.groupMode']` (`'0' | '1' | '2' | '3' | '4'`)
  - **TypeScript Interfaces**:
    ```typescript
    export type LibraryGroupMode = 0 | 1 | 2 | 3 | 4 // 0: Default, 1: Source, 2: Status, 3: Track, 4: Ungrouped
    export interface VirtualCategory {
      id: number
      name: string
      order: number
      isVirtual: boolean
    }
    ```
  - **Status Categories**: Ongoing, Completed, Cancelled, On Hiatus, Publishing Finished, Unknown.
  - **Backend Feasibility**: 100% Client-Side. Derived from cached `server.library`, `server.sources`, and track records.
- **Acceptance Criteria**:
  - [x] `LibrarySettingsSheet` displays 4 tabs: Filter, Sort, Display, Group.
  - [x] Selecting "By Source" groups library manga into tabs sorted alphabetically by source name.
  - [x] Selecting "By Status" groups manga into tabs by publication status (Ongoing, Completed, etc.).
  - [x] Selecting "By Track Status" groups manga by reading progress status across bound trackers.
  - [x] Selecting "Ungrouped" displays all library manga inside a single "Ungrouped" tab.
  - [x] Selecting "Default" restores the user's Suwayomi category tabs.
  - [x] Grouping selection persists across page reloads.

---

### 3.2 Tag Priority Sorting
- **Feature Name & Origin**: Tag Priority Sorting (`SortTagScreen`) `[SY + KMK]`
- **Reference Files (Kotlin)**:
  - `TachiyomiSY/domain/src/main/java/tachiyomi/domain/library/model/LibrarySortMode.kt` (`LibrarySort.Type.TagList`)
  - `TachiyomiSY/app/src/main/java/eu/kanade/domain/manga/interactor/GetSortTag.kt` (`mapSortTags`)
  - `TachiyomiSY/app/src/main/java/eu/kanade/presentation/category/SortTagScreen.kt` & `components/genre/SortTagContent.kt`
  - `TachiyomiSY/app/src/main/java/eu/kanade/tachiyomi/ui/library/LibraryViewModel.kt` (lines 563–573)
- **Target Files in `mihon-vue`**:
  - `src/core/utils/library.ts` *(MODIFY)*: Add `'tagList'` to `LibrarySortType`; implement priority tag comparison in `sortLibrary()`
  - `src/features/settings/stores/preferences.ts` *(MODIFY)*: Add `sortTags: ref<string[]>`, key `mihon.library.sortTags`
  - `src/features/library/components/LibrarySettingsSheet.vue` *(MODIFY)*: Conditionally display "Tag sorting" in Sort tab when `sortTags.length > 0`
  - `src/features/settings/views/SortTagView.vue` *(NEW)*: Reorderable tag priority screen with add/delete modals
  - `src/router/index.ts` *(MODIFY)*: Register `/settings/library/sort-tags`
- **State & Data Contract**:
  - **Storage Key**: `localStorage['mihon.library.sortTags']` (JSON string array, e.g. `["Action", "Romance", "Comedy"]`)
  - **Algorithm**: For each manga, find lowest index of `manga.genre` matching any entry in `sortTags`. Lower index ranks first. Breaks ties alphabetically by title.
- **Acceptance Criteria**:
  - [x] Settings > Library displays "Tag sorting" item showing count of configured tags and linking to `/settings/library/sort-tags`.
  - [x] In `SortTagView.vue`, users can add tags via dialog, drag or click to reorder priority, and delete tags.
  - [x] When 1+ tags exist, "Tag sorting" appears in Library Sort options.
  - [x] Selecting "Tag sorting" orders manga by their highest priority matching genre tag.

---

### 3.3 Hidden Categories Feature
- **Origin**: [Komikku]
- **Reference Files (Kotlin)**:
  - `komikku/domain/src/main/java/tachiyomi/domain/category/interactor/HideCategory.kt`
  - `komikku/app/src/main/java/eu/kanade/presentation/category/components/CategoryListItem.kt` (lines 60–87: 60% opacity, strikethrough, visibility toggle)
  - `komikku/app/src/main/java/eu/kanade/presentation/library/LibrarySettingsDialog.kt:402` (`showHiddenCategories`)
- **Target Files in `mihon-vue`**:
  - `src/features/settings/stores/preferences.ts` *(MODIFY)*: Add `hiddenCategories: ref<number[]>` and `showHiddenCategories: ref<boolean>`
  - `src/features/library/components/CategoryListItem.vue` *(MODIFY)*: Add eye toggle button; apply `opacity: 0.6; text-decoration: line-through;` when hidden
  - `src/features/library/views/LibraryView.vue` *(MODIFY)*: Filter out hidden categories from tabs unless `showHiddenCategories` is true
  - `src/features/library/components/LibrarySettingsSheet.vue` *(MODIFY)*: Add "Show hidden categories" switch
- **State & Data Contract**:
  - **Storage Keys**:
    - `mihon.library.hiddenCategories`: JSON array of category IDs (`number[]`)
    - `mihon.library.showHiddenCategories`: boolean (`'true' | 'false'`, default `'false'`)
- **Acceptance Criteria**:
  - [x] In "Edit categories" screen, each category row displays an eye visibility toggle button.
  - [x] Toggling a category to hidden applies 60% opacity and strikethrough text styling.
  - [x] Hidden categories are excluded from library category tabs and pager by default.
  - [x] Enabling "Show hidden categories" in Library settings restores hidden tabs to the library view.

---

### 3.4 Empty Categories During Search Preference
- **Origin**: [Komikku]
- **Reference Files (Kotlin)**:
  - `komikku/domain/src/main/java/tachiyomi/domain/library/service/LibraryPreferences.kt:234` (`showEmptyCategoriesSearch`)
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/library/LibraryScreenModel.kt:289`
- **Target Files in `mihon-vue`**:
  - `src/features/settings/stores/preferences.ts` *(MODIFY)*: Add `showEmptyCategoriesSearch: ref<boolean>` (default `false`)
  - `src/features/library/views/LibraryView.vue` *(MODIFY)*: Retain empty categories in tab bar during search when enabled
  - `src/features/settings/views/SettingsLibraryView.vue` *(MODIFY)*: Add "Show empty categories during search" checkbox
- **State & Data Contract**:
  - **Storage Key**: `mihon.library.showEmptyCategoriesSearch` (boolean, default: `false`)
- **Acceptance Criteria**:
  - [x] Searching in library with preference disabled hides tabs that have 0 matching results.
  - [x] Searching in library with preference enabled retains all category tabs.
  - [x] Clicking an empty tab during search displays the empty search placeholder without crashing.

---

### 3.5 Categories Tri-State Filter Dialog
- **Origin**: [Komikku]
- **Reference Files (Kotlin)**:
  - `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/TriStateListDialog.kt`
  - `komikku/app/src/main/java/eu/kanade/presentation/library/LibrarySettingsDialog.kt` (`CategoriesFilter`, lines 470–520)
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/library/LibraryScreenModel.kt` (lines 516–530)
- **Target Files in `mihon-vue`**:
  - `src/core/components/TriStateListDialog.vue` *(NEW)*: Reusable dialog cycling None -> Include -> Exclude -> None
  - `src/core/utils/library.ts` *(MODIFY)*: Evaluate `filterCategoriesInclude` and `filterCategoriesExclude` in `matchesLibrary()`
  - `src/features/settings/stores/preferences.ts` *(MODIFY)*: Add `filterCategories`, `filterCategoriesInclude`, `filterCategoriesExclude`
  - `src/features/library/components/LibrarySettingsSheet.vue` *(MODIFY)*: Add Categories filter row with "Edit" button opening dialog
- **State & Data Contract**:
  - **Storage Keys**:
    - `mihon.library.filterCategories`: boolean
    - `mihon.library.filterCategoriesInclude`: JSON array of IDs (`number[]`)
    - `mihon.library.filterCategoriesExclude`: JSON array of IDs (`number[]`)
- **Acceptance Criteria**:
  - [x] Checking "Categories" in Filter tab enables category filtering.
  - [x] Clicking "Edit" opens `TriStateListDialog` listing all categories.
  - [x] Tapping a category cycles: None -> Include (check) -> Exclude (crossed box) -> None.
  - [x] Excluded categories hide all manga belonging to them; included categories restrict library to entries belonging to those categories.

---

### 3.6 Panorama Comfortable Grid & Cover-Flow Modes
- **Origin**: [Komikku]
- **Reference Files (Kotlin)**:
  - `komikku/domain/src/main/java/tachiyomi/domain/library/model/LibraryDisplayMode.kt` (`ComfortableGridPanorama`)
  - `komikku/app/src/main/java/eu/kanade/presentation/manga/components/MangaCover.kt` (`RatioSwitchToPanorama = 0.75f`)
- **Target Files in `mihon-vue`**:
  - `src/features/settings/stores/preferences.ts` *(MODIFY)*: Add `'comfortable-panorama'` to `DisplayMode`
  - `src/features/library/components/LibraryDisplaySettings.vue` *(MODIFY)*: Add "Comfortable grid (panorama)" option
  - `src/features/library/components/LibraryComfortableGridItem.vue` *(MODIFY)*: Apply `aspect-ratio: 16 / 9; object-fit: cover;` when in panorama mode
  - `src/features/library/components/LibraryPager.vue` *(MODIFY)*: Allocate wider grid column min-width (220px..280px)
- **State & Data Contract**:
  - **Storage Key**: `mihon.library.display` (`'comfortable-panorama'`)
- **Acceptance Criteria**:
  - [x] User can select "Comfortable grid (panorama)" in Display tab.
  - [x] Library cards render 16:9 landscape aspect ratio covers with titles below.
  - [x] Grid column tracks expand to prevent horizontal squishing.

---

### 3.7 FlagKit Country Icons & Source Favicon Badges
- **Origin**: [Komikku]
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/presentation/library/components/LibraryBadges.kt` (`LanguageBadge`, `SourceIconBadge`, lines 45–115)
  - `komikku/domain/src/main/java/tachiyomi/domain/library/service/LibraryPreferences.kt` (`useLangIcon`, `sourceBadge`, lines 150–155)
- **Target Files in `mihon-vue`**:
  - `src/core/utils/flags.ts` *(NEW)*: Maps ISO language codes (`en`, `ja`, `ko`, `zh`, `ru`, `es`, `fr`, etc.) to SVG country flag assets
  - `src/features/settings/stores/preferences.ts` *(MODIFY)*: Add `useLangIcon: boolean` (default `true`) and `sourceBadge: boolean` (default `false`)
  - `src/features/manga/components/MangaBadges.vue` *(MODIFY)*: Render flag SVG when `useLangIcon` is true; render source favicon when `sourceBadge` is true
  - `src/features/library/components/LibraryDisplaySettings.vue` *(MODIFY)*: Add switches for both badges
- **State & Data Contract**:
  - **Storage Keys**: `mihon.library.useLangIcon` (boolean), `mihon.library.sourceBadge` (boolean)
  - **Favicon Endpoint**: `GET /api/v1/source/{sourceId}/icon`
- **Acceptance Criteria**:
  - [x] When "Show language flag icon" is enabled, language badges render national flag SVGs instead of plain text ("EN", "JA").
  - [x] When "Show source icon badge" is enabled, source favicon appears in the badge cluster.

---

### 3.8 Library Update Progress Banner & Update Errors Screen
- **Origin**: [Komikku]
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/presentation/components/Banners.kt` (`AppStateBanners: updating, progress`, lines 47–125)
  - `komikku/app/src/main/java/eu/kanade/presentation/libraryUpdateError/LibraryUpdateErrorScreen.kt`
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/libraryUpdateError/LibraryUpdateErrorScreenModel.kt`
- **Target Files in `mihon-vue`**:
  - `src/core/components/AppStateBanners.vue` *(NEW)*: Animated top banner displaying update progress percentage
  - `src/features/updates/stores/libraryUpdateErrors.ts` *(NEW)*: Store tracking failed update entries
  - `src/features/updates/views/LibraryUpdateErrorView.vue` *(NEW)*: Error review screen with retry, clear, and multi-migration handoff
  - `src/features/settings/views/MoreView.vue` *(MODIFY)*: Add "Library update errors" entry with red badge
  - `src/router/index.ts` *(MODIFY)*: Register `/updates/errors`
- **State & Data Contract**:
  - **Storage Key**: `localStorage['mihon.library.updateErrors']` (JSON array of `LibraryUpdateError`)
  - **TypeScript Interface**:
    ```typescript
    export interface LibraryUpdateError {
      id: string
      mangaId: number
      title: string
      sourceId: string
      sourceName: string
      message: string
      timestamp: number
    }
    ```
- **Acceptance Criteria**:
  - [x] Active library update displays a top banner: "Updating library (X%)" with a circular spinner.
  - [x] Failed manga checks during updates are recorded in `libraryUpdateErrors` store.
  - [x] More view displays "Library update errors" row with error count badge.
  - [x] Opening `LibraryUpdateErrorView.vue` groups failures by reason, allowing individual retries, batch clear, or multi-migration handoff.

---

### 3.9 Upcoming "To Be Updated" Queue Toggle
- **Origin**: [Komikku]
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/mihon/feature/upcoming/UpcomingScreenContent.kt` (`UpcomingToolbar: isShowingUpdatingMangas`, lines 130–175)
  - `komikku/app/src/main/java/mihon/feature/upcoming/UpcomingScreenModel.kt` (`updatingItems`, lines 50–62, 107–137)
- **Target Files in `mihon-vue`**:
  - `src/features/updates/views/UpcomingView.vue` *(MODIFY)*: Add toolbar toggle button (`new_releases`) and toggle ref `isShowingUpdatingMangas`
  - `src/core/utils/upcoming.ts` *(MODIFY)*: Compute list of manga whose update interval has elapsed and are pending background check
- **State & Data Contract**:
  - **State**: `const isShowingUpdatingMangas = ref(false)`
- **Acceptance Criteria**:
  - [x] Upcoming toolbar contains a toggle action button with `new_releases` icon.
  - [x] Clicking toggles title between "Upcoming" (predicted chapter releases) and "To be updated" (manga due for check).
  - [x] "To be updated" queue lists manga whose next scheduled update timestamp is in the past.

---

### 3.10 Granular History Filters, Multi-Select & Row Indicators
- **Origin**: [Komikku]
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/presentation/history/components/HistoryFilterDialog.kt`
  - `komikku/app/src/main/java/eu/kanade/presentation/history/HistoryScreen.kt` (`HistorySelectionToolbar`, lines 70–108)
  - `komikku/app/src/main/java/eu/kanade/presentation/history/components/HistoryItem.kt` (`hasUnread` dot, `readProgress` text, `usePanoramaCover`, lines 63–68, 173–211)
- **Target Files in `mihon-vue`**:
  - `src/features/history/components/HistoryFilterDialog.vue` *(NEW)*: TriState filters for "Unfinished manga", "Unfinished chapter", "Non-library entries", and "Wide cover" switch
  - `src/features/history/views/HistoryView.vue` *(MODIFY)*: Add filter button, multi-selection mode, Select All, Invert, batch delete
  - `src/features/history/components/HistoryItem.vue` *(MODIFY)*: Render unread blue dot (`hasUnread`), page progress ("• Page 14"), 16:9 wide cover toggle
- **State & Data Contract**:
  - **Storage Keys**:
    - `mihon.history.filterUnfinishedManga`: TriState (`'all' | 'include' | 'exclude'`)
    - `mihon.history.filterUnfinishedChapter`: TriState (`'all' | 'include' | 'exclude'`)
    - `mihon.history.filterNonLibrary`: TriState (`'all' | 'include' | 'exclude'`)
    - `mihon.history.wideCover`: boolean (`'true' | 'false'`)
- **Acceptance Criteria**:
  - [x] History toolbar features a filter icon opening `HistoryFilterDialog.vue`.
  - [x] Unfinished manga filter hides entries whose chapters are fully read.
  - [x] Unfinished chapter filter retains only entries where `lastPageRead > 0 && !isRead`.
  - [x] History rows render a primary dot if unread chapters remain, and display page progress ("• Page X").
  - [x] Long-pressing any row enters multi-selection mode with Select All, Invert, and batch delete confirmation.

---

## Phase 4: Browse Feeds, Saved Searches & Bulk Discovery

**Goal**: Deliver the Feed subsystem, drag-and-drop feed management, saved search presets, bulk library addition from catalogue, and related manga suggestions.

---

### 4.1 Saved Searches & Filter Integration
- **Feature Name & Origin**: Saved Searches `[SY + KMK]`
- **Reference Files (Kotlin)**:
  - `komikku/domain/src/main/java/tachiyomi/domain/source/model/SavedSearch.kt`
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/browse/source/browse/SavedSearchItem.kt` (chips, `onClick`, `onLongClick`)
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/browse/source/browse/SourceFilterDialog.kt` (lines 50–57, 86–97)
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/browse/source/feed/SourceFeedScreen.kt` (`onSavedSearchAddToFeed`, lines 247–254)
- **Target Files in `mihon-vue`**:
  - `src/features/browse/stores/savedSearches.ts` *(NEW)*: Pinia store for per-source saved searches
  - `src/features/browse/components/SourceFilterDialog.vue` *(MODIFY)*: Save icon in header; chip row of saved searches; left-click to apply; context menu (Add to Feed, Rename, Delete)
  - `src/features/browse/views/SourceView.vue` *(MODIFY)*: Receive applied query/filters and trigger catalogue search
- **State & Data Contract**:
  - **Storage Key**: `localStorage['mihon.savedSearches']` (JSON array of `SavedSearch`)
  - **TypeScript Interface**:
    ```typescript
    export interface SavedSearch {
      id: string
      sourceId: string
      name: string
      query: string | null
      filters: RawSourceFilterObject[]
      createdAt: number
    }
    ```
- **Acceptance Criteria**:
  - [ ] Save icon in `SourceFilterDialog.vue` header prompts for a search name and captures current query and filter state.
  - [ ] Saved search chips appear at the top of the filter dialog.
  - [ ] Left-clicking a chip closes the dialog and applies the query and filters to `SourceView.vue`.
  - [ ] Right-clicking (or long-pressing on touch) a chip opens a context menu with "Add to Feed" and "Delete".

---

### 4.2 Global & Per-Source Browse Feed Tab
- **Feature Name & Origin**: Browse Feed Tab (`FeedView.vue`) `[SY + KMK]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/browse/feed/FeedTab.kt`
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/browse/feed/FeedScreenModel.kt` (`MaxFeedItems = 20`, lines 271–315, 403)
  - `komikku/app/src/main/java/eu/kanade/presentation/browse/FeedScreen.kt` (lines 70–175)
- **Target Files in `mihon-vue`**:
  - `src/features/browse/stores/feed.ts` *(NEW)*: Pinia store managing feed lanes, requests, and 20-feed capacity guard
  - `src/features/browse/views/FeedView.vue` *(NEW)*: 4th tab in Browse featuring horizontal lane carousels, refresh, and empty state
  - `src/features/browse/components/FeedAddDialog.vue` *(NEW)*: Dialog to add Latest, Popular, or Saved Search lanes
  - `src/features/browse/views/BrowseView.vue` *(MODIFY)*: Add Feed tab button and route switch
- **State & Data Contract**:
  - **Storage Key**: `localStorage['mihon.feed_entries']` (JSON array of `FeedEntry`)
  - **Capacity Guard**: `MAX_FEED_ITEMS = 20`. Attempting to add >20 lanes displays an error snackbar.
  - **TypeScript Interfaces**:
    ```typescript
    export type FeedType = 'latest' | 'popular' | 'saved_search'

    export interface FeedEntry {
      id: string
      sourceId: string
      savedSearchId?: string
      feedType: FeedType
      order: number
      global: boolean
      title?: string
    }
    ```
  - **Endpoints**: `GET /api/v1/source/{sourceId}/latest/1`, `/popular/1`, or `/search`.
- **Acceptance Criteria**:
  - [ ] "Feed" tab is accessible in Browse alongside Sources, Extensions, and Migrate.
  - [ ] Empty state provides an "Add Feed" button opening `FeedAddDialog.vue`.
  - [ ] Feed lanes render horizontal scrolling cards (`GlobalSearchCardRow.vue`) with title and in-library badge.
  - [ ] Maximum limit of 20 feeds is strictly enforced with user feedback.

---

### 4.3 Feed Reorder & Removal Screen
- **Feature Name & Origin**: Feed Order Screen `[Komikku]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/presentation/browse/FeedOrderScreen.kt`
  - `komikku/app/src/main/java/eu/kanade/presentation/browse/components/FeedOrderListItem.kt` (lines 23–58)
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/browse/feed/FeedTab.kt` (lines 84–92)
- **Target Files in `mihon-vue`**:
  - `src/features/browse/components/FeedOrderScreen.vue` *(NEW)*: Drag-and-drop reorderable list of feeds with delete actions
  - `src/features/browse/views/FeedView.vue` *(MODIFY)*: Add Sort action (`mdi-swap-vertical`) toggling the reorder view
- **State & Data Contract**:
  - Reorders `order` property in `feedStore.feeds` and persists to `localStorage['mihon.feed_entries']`.
- **Acceptance Criteria**:
  - [ ] Clicking Sort icon in Feed toolbar switches to `FeedOrderScreen.vue`.
  - [ ] Cards display drag handles (`mdi-drag-handle`), feed title, source badge, and delete button.
  - [ ] Drag-and-drop immediately updates lane sequence in `FeedView.vue`.
  - [ ] Deleting a feed lane confirms via modal and removes it cleanly.

---

### 4.4 Bulk Favorite Mode & Selection Toolbar
- **Feature Name & Origin**: Bulk Favorite Mode `[Komikku]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/browse/BulkFavoriteScreenModel.kt` (lines 48–240)
  - `komikku/app/src/main/java/eu/kanade/presentation/components/BulkSelectionToolbar.kt` (lines 20–83)
- **Target Files in `mihon-vue`**:
  - `src/features/browse/composables/useBulkFavorite.ts` *(NEW)*: Selection state, duplicate check, and batch library addition
  - `src/features/browse/components/BulkSelectionToolbar.vue` *(NEW)*: Toolbar with count, Select All, Invert, Favorite button, and loader
  - `src/features/browse/views/SourceView.vue`, `GlobalSearchView.vue`, `FeedView.vue` *(MODIFY)*: Wire bulk selection mode
- **State & Data Contract**:
  - Concurrency-limited execution calling `POST /api/v1/manga/{id}/library` followed by category assignment.
- **Acceptance Criteria**:
  - [ ] Long-pressing any manga card (>500ms) or clicking Bulk Select toolbar icon enters selection mode.
  - [ ] Top bar switches to `BulkSelectionToolbar.vue` with selected count, Select All, Invert, and Favorite button.
  - [ ] Selected cards display checkmark overlay and primary selection border.
  - [ ] Clicking Favorite button executes duplicate check, assigns default category (or opens `ChangeCategoryDialog`), and adds all selected items in the background.

---

### 4.5 Related Manga / Suggestions Row & Screen
- **Feature Name & Origin**: Related Manga Suggestions `[Komikku]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/presentation/manga/components/RelatedMangasRow.kt`
  - `komikku/app/src/main/java/eu/kanade/presentation/browse/RelatedMangasScreen.kt`
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/ui/manga/RelatedMangasScreen.kt`
- **Target Files in `mihon-vue`**:
  - `src/features/manga/components/RelatedMangasRow.vue` *(NEW)*: Horizontally scrolling carousel of recommendations on manga page
  - `src/features/manga/views/RelatedMangasView.vue` *(NEW)*: Full grid view of suggestions with bulk selection
  - `src/features/manga/views/MangaView.vue` *(MODIFY)*: Embed `RelatedMangasRow` between synopsis and chapter list
  - `src/router/index.ts` *(MODIFY)*: Register `/manga/:id/suggestions`
- **State & Data Contract**:
  - Queries server suggestions endpoint or AniList GraphQL recommendation engine using title.
- **Acceptance Criteria**:
  - [ ] Manga details view renders a horizontal carousel of related manga suggestions.
  - [ ] Clicking a recommendation navigates to its entry (or executes global search if not in library).
  - [ ] "See all" header navigates to `RelatedMangasView.vue` rendering the complete grid.

---

## Phase 5: Advanced Manga Management & Tracking Automation

**Goal**: Deliver local metadata customization with tracker autofill, client-side merged manga with priority deduplication, namespaced color tags, bulk duplicate dialogs, and automated tracker synchronization.

---

### 5.1 Custom Manga Info & Cover Editing with Tracker Autofill
- **Feature Name & Origin**: Metadata Editor with Tracker Autofill `[SY + KMK]`
- **Reference Files (Kotlin)**:
  - `TachiyomiSY/app/src/main/java/eu/kanade/tachiyomi/ui/manga/EditMangaDialog.kt` (`EditMangaDialog`, `autofillFromTracker`)
  - `TachiyomiSY/app/src/main/java/eu/kanade/tachiyomi/data/track/TrackMangaMetadata.kt`
  - `TachiyomiSY/app/src/main/java/eu/kanade/tachiyomi/data/track/anilist/AnilistApi.kt` (`getMangaMetadata`)
- **Target Files in `mihon-vue`**:
  - `src/features/manga/components/EditMangaDialog.vue` *(NEW)*: Adaptive sheet editing Title, Author, Artist, Cover URL, Description, Status, and Tags
  - `src/features/manga/stores/mangaOverrides.ts` *(NEW)*: Store persisting local overrides in `localStorage`
  - `src/features/manga/views/MangaView.vue` *(MODIFY)*: Add "Edit info" item to toolbar overflow menu; apply overrides to displayed manga
  - `src/features/manga/components/MangaInfoHeader.vue` *(MODIFY)*: Display overridden fields with subtle override indicator
- **State & Data Contract**:
  - **Storage Key**: `localStorage['mihon.manga_overrides']` (keyed by `mangaId`)
  - **TypeScript Interface**:
    ```typescript
    export interface MangaMetadataOverride {
      title?: string
      author?: string
      artist?: string
      description?: string
      thumbnailUrl?: string
      genre?: string[]
      status?: number
      updatedAt: number
    }
    ```
  - **Tracker Autofill**: Queries bound AniList or MyAnimeList tracker records to fetch canonical title, cover, synopsis, staff, and status.
- **Acceptance Criteria**:
  - [ ] "Edit info" in `MangaToolbar.vue` opens `EditMangaDialog.vue`.
  - [ ] Form displays inputs for Title, Author, Artist, Cover URL, Description, Status dropdown, and Tag chips.
  - [ ] "Autofill from tracker" queries bound trackers, populating fields for user confirmation.
  - [ ] Individual "Reset" buttons restore field back to source values; "Reset all" clears all overrides.
  - [ ] Saving updates `localStorage` and immediately reflects across Manga details and Library views.

---

### 5.2 Client-Side Merged Manga & Chapter Deduplication
- **Feature Name & Origin**: Merged Manga Management `[SY + KMK]`
- **Reference Files (Kotlin)**:
  - `TachiyomiSY/app/src/main/java/eu/kanade/tachiyomi/ui/manga/merged/EditMergedSettingsDialog.kt`
  - `TachiyomiSY/domain/src/main/java/tachiyomi/domain/manga/model/MergedMangaReference.kt`
- **Target Files in `mihon-vue`**:
  - `src/features/manga/components/EditMergedSettingsDialog.vue` *(NEW)*: Priority reordering with drag handles, info manga selector, chapter update toggles
  - `src/features/manga/stores/mergedManga.ts` *(NEW)*: Store tracking merged groups in `localStorage`
  - `src/features/manga/views/MangaView.vue` *(MODIFY)*: Aggregate chapters from merged sources, deduplicate, and route reader to original IDs
  - `src/features/manga/components/MangaChapterListItem.vue` *(MODIFY)*: Render source origin chip (e.g. `[MangaDex]`)
- **State & Data Contract**:
  - **Storage Key**: `localStorage['mihon.merged_manga']` (keyed by `primaryMangaId`)
  - **TypeScript Interfaces**:
    ```typescript
    export interface MergedSourceReference {
      mangaId: number
      sourceId: string
      sourceName: string
      title: string
      coverUrl: string
      chapterPriority: number
      isInfoManga: boolean
      getChapterUpdates: boolean
      downloadChapters: boolean
    }

    export interface MergedMangaGroup {
      id: string
      primaryMangaId: number
      chapterSortMode: 'priority' | 'chapterNumber'
      references: MergedSourceReference[]
      createdAt: number
    }
    ```
  - **Deduplication**: Deduplicates chapters sharing identical `chapterNumber` floats, keeping the chapter from the higher priority source.
- **Acceptance Criteria**:
  - [ ] "Merge manga" option in toolbar opens `EditMergedSettingsDialog.vue`.
  - [ ] Dialog allows reordering merged sources, choosing the designated "Info Manga", and toggling chapter updates per source.
  - [ ] Merged chapter list deduplicates duplicate chapter numbers according to designated priority.
  - [ ] Chapter items display source origin chips.
  - [ ] Tapping a chapter opens the reader with correct backend `mangaId` and `chapterId`.

---

### 5.3 Namespaced Color Tags
- **Feature Name & Origin**: Namespaced Color Tags `[SY + KMK]`
- **Reference Files (Kotlin)**:
  - `TachiyomiSY/app/src/main/java/eu/kanade/presentation/manga/components/NamespaceTags.kt`
- **Target Files in `mihon-vue`**:
  - `src/features/manga/components/NamespaceTags.vue` *(NEW)*: Renders tags grouped by namespace with MD3 tonal container colors
  - `src/features/manga/components/MangaInfoHeader.vue` *(MODIFY)*: Use `NamespaceTags` instead of flat chips
- **State & Data Contract**:
  - Parses tags with format `namespace:tag` (e.g. `artist:murata`, `character:saitama`, `female:schoolgirl`).
  - Colors: Primary for artist, Secondary for character, Tertiary for group, Error for parody, Pastel pink for female, Teal for male.
- **Acceptance Criteria**:
  - [ ] Tags matching `namespace:value` render grouped by namespace with distinct MD3 tonal containers.
  - [ ] Clicking a tag searches for that specific tag; long-pressing copies tag to clipboard.
  - [ ] Text remains high-contrast across Light, Dark, and AMOLED modes.

---

### 5.4 Panorama Cover Card & Top Alignment in Details Header
- **Feature Name & Origin**: Panorama Cover & Top Alignment `[Komikku]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/presentation/manga/components/MangaInfoHeader.kt` (`RatioSwitchToPanorama = 0.75f`, `topAlignCover`)
  - `komikku/app/src/main/java/eu/kanade/domain/ui/UiPreferences.kt` (`usePanoramaCoverAlways`, `topAlignCover`)
- **Target Files in `mihon-vue`**:
  - `src/features/manga/components/MangaInfoHeader.vue` *(MODIFY)*: Apply wide 16:9 landscape card when `naturalHeight / naturalWidth <= 0.75`; apply top-align flex
  - `src/features/settings/stores/appearancePreferences.ts` *(MODIFY)*: Add `usePanoramaCover` and `topAlignCover`
  - `src/features/settings/views/SettingsAppearanceView.vue` *(MODIFY)*: Add switches under "Manga info"
- **State & Data Contract**:
  - **Storage Keys**: `mihon.ui.usePanoramaCover` (boolean, default: `true`), `mihon.ui.topAlignCover` (boolean, default: `false`)
- **Acceptance Criteria**:
  - [ ] Wide covers (`naturalHeight / naturalWidth <= 0.75`) dynamically render as 16:9 landscape cards.
  - [ ] Responsive layout adapts correctly on both single-column mobile view and two-column tablet view.
  - [ ] `topAlignCover` toggles alignment between centered and top-aligned with title.

---

### 5.5 Bulk Duplicate Manga Resolution
- **Feature Name & Origin**: Bulk Duplicate Resolution Dialog `[Komikku]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/presentation/manga/DuplicateMangaDialog.kt` (`onAllowAllDuplicate`, `onSkipAllDuplicate`, `onSkipDuplicate`)
- **Target Files in `mihon-vue`**:
  - `src/features/library/components/DuplicateMangaDialog.vue` *(MODIFY)*: Add "Allow all", "Skip it", "Skip all" buttons when in bulk mode
  - `src/core/utils/duplicates.ts` *(MODIFY)*: Support bulk queue state runner
- **State & Data Contract**:
  - Mode: `'prompt' | 'allow_all' | 'skip_all'`.
- **Acceptance Criteria**:
  - [ ] When adding multiple manga, encountering duplicates renders 4 buttons: "Add anyway", "Allow all", "Skip it", "Skip all".
  - [ ] Clicking "Allow all" resolves current item and automatically adds all remaining duplicates in the batch without prompting.
  - [ ] Clicking "Skip all" cancels all remaining duplicate additions in the queue.
  - [ ] Single additions retain standard "Add anyway" and "Cancel" buttons.

---

### 5.6 Tracker Auto-Sync on Refresh & Open Track Menu on Add-to-Library
- **Feature Name & Origin**: Tracker Auto-Sync & Prompt-on-Add `[Komikku]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/domain/track/service/TrackPreferences.kt` (`autoSyncProgressFromTrackers`, `trackOnAddingToLibrary`)
  - `komikku/app/src/main/java/eu/kanade/domain/track/interactor/RefreshTracks.kt` (`syncChapterProgressWithTrack`)
- **Target Files in `mihon-vue`**:
  - `src/features/settings/stores/preferences.ts` *(MODIFY)*: Add `autoSyncProgressFromTrackers: boolean` and `trackOnAddingToLibrary: boolean`
  - `src/features/settings/views/SettingsTrackingView.vue` *(MODIFY)*: Add switches
  - `src/features/manga/views/MangaView.vue` *(MODIFY)*: Hook refresh handler to sync chapter read progress up to tracker's last chapter read; open tracker dialog on add
- **State & Data Contract**:
  - **Storage Keys**: `pref_auto_sync_progress_from_trackers_key` (boolean, default: `true`), `track_on_adding_to_library` (boolean, default: `true`)
- **Acceptance Criteria**:
  - [ ] Refreshing a manga with bound trackers automatically marks local chapters as read up to the tracker's highest read chapter.
  - [ ] Snackbar confirms: "Progress synced from tracker up to chapter X".
  - [ ] Adding a manga to library automatically opens `TrackInfoDialog.vue` if user is logged into 1+ trackers.

---

## Phase 6: Theme Engine, Navbar Customization & WebDAV Sync

**Goal**: Complete the aesthetic and ecosystem parity by adding 19 new palettes, custom seed color picking, dynamic cover theming, customizable bottom navigation bar, and WebDAV cloud backup synchronization.

---

### 6.1 Custom Theme Seed Color Picker
- **Feature Name & Origin**: Custom Theme Color Picker `[Komikku]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/presentation/more/settings/screen/appearance/AppCustomThemeColorPickerScreen.kt`
  - `komikku/app/src/main/java/eu/kanade/presentation/more/settings/widget/ThemeColorPickerWidget.kt`
- **Target Files in `mihon-vue`**:
  - `src/features/settings/views/CustomThemeColorPickerView.vue` *(NEW)*: HSV spectrum picker, hex input, and live preview cards
  - `src/core/theme/dynamicTheme.ts` *(NEW)*: Palette generator using `@material/material-color-utilities`
  - `src/features/settings/views/SettingsAppearanceView.vue` *(MODIFY)*: Add "Custom color" entry navigating to picker
  - `src/features/settings/stores/appearancePreferences.ts` *(MODIFY)*: Add `customSeedColor: string`
- **State & Data Contract**:
  - **Storage Key**: `pref_color_theme` (hex string, e.g. `#DF0090`)
  - **Generation**: Takes seed hex and generates full M3 Light and Dark schemes (`primary`, `surfaceContainer`, `outline`, etc.).
- **Acceptance Criteria**:
  - [ ] "Custom color" in Settings > Appearance navigates to `CustomThemeColorPickerView.vue`.
  - [ ] Color picker provides HSV spectrum, brightness slider, and hex input.
  - [ ] Live preview updates buttons, chips, and cards in real time.
  - [ ] Saving immediately regenerates and applies the M3 color scheme to Vuetify without reloading.

---

### 6.2 Cover-Based Dynamic Theme
- **Feature Name & Origin**: Dynamic Cover-Based Color Theming `[Komikku]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/presentation/theme/TachiyomiTheme.kt` (`DynamicMaterialExpressiveTheme`)
  - `komikku/app/src/main/java/eu/kanade/domain/ui/UiPreferences.kt` (`themeCoverBased`)
- **Target Files in `mihon-vue`**:
  - `src/core/composables/useCoverDominantColor.ts` *(NEW)*: Offscreen Canvas quantization extracting dominant cover color
  - `src/features/manga/views/MangaView.vue` *(MODIFY)*: Apply scoped CSS theme variables to header backdrop and FAB
  - `src/features/reader/views/ReaderView.vue` *(MODIFY)*: Tint reader controls and sliders with cover seed
  - `src/features/settings/views/SettingsAppearanceView.vue` *(MODIFY)*: Add "Theme based on cover" switch
- **State & Data Contract**:
  - **Storage Key**: `pref_theme_cover_based` (boolean, default: `false`)
- **Acceptance Criteria**:
  - [ ] When enabled, opening manga details extracts dominant color from cover image.
  - [ ] Backdrop gradient, action buttons, chips, and FAB dynamically harmonize with cover color.
  - [ ] Reader controls adopt cover color tinting.
  - [ ] Disabling reverts cleanly to global theme.

---

### 6.3 19 New Themes & Preset Palettes
- **Feature Name & Origin**: 19 Built-in Themes & Palettes `[Komikku]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/domain/ui/model/AppTheme.kt` (`CLOUDFLARE`, `COTTONCANDY`, `DOOM`, `MATRIX`, `MOCHA`, `SAPPHIRE`)
  - `komikku/app/src/main/java/eu/kanade/presentation/more/settings/widget/ThemeColorPickerWidget.kt` (13 preset palettes)
- **Target Files in `mihon-vue`**:
  - `src/core/theme/appThemes.ts` *(MODIFY)*: Add the 6 Aniyomi full theme definitions (`cloudflare`, `cottonCandy`, `doom`, `matrix`, `mocha`, `sapphire`)
  - `src/core/theme/presetPalettes.ts` *(NEW)*: Export 13 Komikku curated palette hex arrays (Sunset, Outrun, Raspberry, Cathode, Bubblegum, Springfield, Spectral, Night at the beach, Casual, Patagonia, LCD, Pop, PICO-8)
  - `src/features/settings/views/SettingsAppearanceView.vue` *(MODIFY)*: Render theme selector with all 20 themes
- **State & Data Contract**:
  - All 6 Aniyomi themes export full Light and Dark M3 palettes compatible with pure black AMOLED mode.
- **Acceptance Criteria**:
  - [ ] Settings > Appearance lists Cloudflare, Cotton Candy, Doom, Matrix, Mocha, and Sapphire.
  - [ ] Pure black AMOLED mode functions properly across all new themes.
  - [ ] 13 preset palettes appear as one-click swatch rows in the Custom Theme Color Picker.

---

### 6.4 Dynamic Navbar Tab Customization & Hidden Tab Relocation
- **Feature Name & Origin**: Navbar Customization `[Mihon + SY + KMK]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/domain/ui/UiPreferences.kt` (`showNavUpdates`, `showNavHistory`, `bottomBarLabels`)
  - `komikku/app/src/main/java/eu/kanade/presentation/more/MoreScreen.kt` (relocates hidden tabs to More list)
- **Target Files in `mihon-vue`**:
  - `src/features/settings/stores/preferences.ts` *(MODIFY)*: Add `showNavUpdates`, `showNavHistory`, `bottomBarLabels`
  - `src/features/settings/views/SettingsAppearanceView.vue` *(MODIFY)*: Add switches under "Navigation"
  - `src/app/layouts/DefaultLayout.vue` *(MODIFY)*: Filter `navItems` array; toggle label visibility
  - `src/features/settings/views/MoreView.vue` *(MODIFY)*: Render Updates and/or History items when hidden from navbar
- **State & Data Contract**:
  - **Storage Keys**:
    - `pref_show_updates_button`: boolean (default: `true`)
    - `pref_show_history_button`: boolean (default: `true`)
    - `pref_show_bottom_bar_labels`: boolean (default: `true`)
- **Acceptance Criteria**:
  - [ ] Disabling `showNavUpdates` removes Updates from bottom bar and tablet rail, moving it into More screen.
  - [ ] Disabling `showNavHistory` removes History from bottom bar and tablet rail, moving it into More screen.
  - [ ] Disabling `bottomBarLabels` hides text labels on mobile bottom bar (icons only).
  - [ ] Direct routing and tab active states continue to function reliably.

---

### 6.5 Client-Side WebDAV Cloud Backup Sync Subsystem
- **Feature Name & Origin**: WebDAV Cloud Backup Sync `[Komikku]`
- **Reference Files (Kotlin)**:
  - `komikku/app/src/main/java/eu/kanade/tachiyomi/data/sync/service/WebDavSyncService.kt`
  - `komikku/app/src/main/java/eu/kanade/presentation/components/Banners.kt` (syncing banner)
  - `komikku/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsDataScreen.kt`
- **Target Files in `mihon-vue`**:
  - `src/features/settings/services/webdavSync.ts` *(NEW)*: WebDAV HTTP client (`PROPFIND`, `MKCOL`, `PUT`, `GET`) using `webdav` client library
  - `src/features/settings/components/WebDavSyncDialog.vue` *(NEW)*: Configuration and remote backup restore browser
  - `src/features/settings/views/SettingsDataView.vue` *(MODIFY)*: Add "WebDAV Cloud Sync" preference group
  - `src/features/settings/stores/preferences.ts` *(MODIFY)*: Add WebDAV URL, credentials, and auto-sync preferences
  - `src/core/components/AppStateBanners.vue` *(MODIFY)*: Render animated sync progress banner during transfer
- **State & Data Contract**:
  - **Storage Keys**: `pref_webdav_url`, `pref_webdav_folder`, `pref_webdav_username`, `pref_webdav_password`, `pref_webdav_auto_sync`, `pref_webdav_last_sync`
  - **Payload**: Serializes all client state (categories, manga notes, metadata overrides, merged groups, reader preferences, custom theme seed) to JSON.
- **Acceptance Criteria**:
  - [ ] WebDAV sync settings group rendered in Settings > Data and storage.
  - [ ] "Test Connection" button performs `PROPFIND` and confirms server accessibility.
  - [ ] "Backup to WebDAV" exports current backup directly to Nextcloud/WebDAV directory.
  - [ ] "Restore from WebDAV" queries folder, presents list of remote snapshots, and restores selected backup.
  - [ ] Syncing progress banner displays in `AppStateBanners.vue` during active transfer.

---

## 2. Sprint Execution Checklist & Summary Matrix

| Phase | Sprint Focus | Features Count | Dominant Paradigm | Zero Backend Schema Changes |
| :---: | :--- | :---: | :--- | :---: |
| **Phase 1** | Core Mihon 100% Parity & Suwayomi GraphQL Mutations | 5 | GraphQL Mutations & Client Orchestration | ✅ Yes |
| **Phase 2** | Pro Reader Engine Overhaul (Desktop & Mobile UX) | 9 | Canvas, CSS Grid, Aspect-Ratio & Image Preload | ✅ Yes |
| **Phase 3** | Power-User Library, Categories, Updates & History | 10 | Derived Virtual Groups & Pinia/LocalStorage | ✅ Yes |
| **Phase 4** | Browse Feeds, Saved Searches & Bulk Discovery | 5 | Concurrent Source Queries & Selection Toolbars | ✅ Yes |
| **Phase 5** | Advanced Manga Management & Tracking Automation | 6 | Local Overrides, Merged Deduplication, Track APIs | ✅ Yes |
| **Phase 6** | Theme Engine, Navbar Customization & WebDAV Sync | 5 | M3 Color Utilities, WebDAV Client, Layout Tabs | ✅ Yes |
| **TOTAL** | **Full Parity & Super-Set Roadmap** | **40 Features** | **100% Executable on `mihon-vue`** | **✅ 100% Safe** |

*(End of Roadmap)*
