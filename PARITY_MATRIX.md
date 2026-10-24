# Four-Way Parity Matrix: Mihon vs. TachiyomiSY vs. Komikku vs. mihon-vue

> **Architectural Assessment & Cross-Platform Parity Report**  
> **Prepared by:** Principal Cross-Platform Product & Frontend Architect  
> **Target Projects:**  
> 1. **Mihon** (Android Kotlin / Jetpack Compose — pinned commit `446f6df82c390ab760802c2fce3b677bce3f31c1`)  
> 2. **TachiyomiSY** (Android Kotlin / Jetpack Compose Fork — commit `87d8db2de`)  
> 3. **Komikku** (Android Kotlin / Jetpack Compose Fork — commit `1656575e8f`)  
> 4. **`mihon-vue`** (Vue 3 / TypeScript / Vuetify 4 Web & Desktop Client for Suwayomi-Server)  
> **Date:** October 2026

---

## 1. Executive Summary & High-Level Coverage

### 1.1 Scope & Methodology
This audit provides a comprehensive, code-level feature, screen, and architectural parity analysis comparing **upstream Mihon**, the **TachiyomiSY fork**, the **Komikku fork**, and the **`mihon-vue` web/desktop client**. Six autonomous sub-agents performed parallel AST, source code, and network contract inspections across all four repositories.

```
Total Screens & Sub-Screens Evaluated:       114
Total Granular Features & Actions Analyzed:  111
Total Checkpoints across 4 Codebases:        900+ matrix cells
```

### 1.2 Quantitative Coverage Summary

| Domain | Total Screens | Total Features | Parity with Mihon | Parity with TachiyomiSY | Parity with Komikku | Dominant Limitation Type |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Domain 1: Library & Categories** | 19 | 25 | **95%** | **70%** | **64%** | SY Grouping, KMK FlagKit/Panorama, REST Category Mutation |
| **Domain 2: Updates, Upcoming & History** | 14 | 20 | **93%** | **80%** | **68%** | KMK History Filters/Multi-select, Suwayomi History Table |
| **Domain 3: Browse, Sources, Feeds & Migration** | 22 | 16 | **91%** | **63%** | **56%** | SY/KMK Feed Tab & Reorder, Saved Searches, Migration mutation |
| **Domain 4: Manga Details, Merging & Tracking** | 16 | 17 | **94%** | **65%** | **59%** | KMK Panorama/Suggestions, SY Merged Manga, Metadata edit |
| **Domain 5: Reader Engine & Downloads** | 13 | 18 | **85%** | **56%** | **50%** | KMK Smart Scale/Tap zones, SY Double-Page Spread, Pagers |
| **Domain 6: More, Stats, Onboarding & Settings** | 30 | 15 | **89%** | **73%** | **61%** | KMK Discord RPC, WebDAV Sync, Dynamic Cover Theming |
| **Overall Weighted Parity** | **114** | **111** | **91.2%** | **67.8%** | **59.7%** | **Client-side adaptation vs Backend Suwayomi REST** |

### 1.3 Architectural Archetypes Comparison

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       FOUR-WAY ARCHITECTURAL COMPARISON                                │
├───────────────────────┬───────────────────────┬───────────────────────┬────────────────────────────────┤
│ 1. Mihon (Upstream)   │ 2. TachiyomiSY (Fork) │ 3. Komikku (Fork)     │ 4. mihon-vue (Web Client)      │
├───────────────────────┼───────────────────────┼───────────────────────┼────────────────────────────────┤
│ • Native Android / JVM│ • Native Android / JVM│ • Native Android / JVM│ • Web / Desktop (SPA)          │
│ • Jetpack Compose + M3│ • Jetpack Compose + M3│ • Jetpack Compose + M3│ • Vue 3 + Vuetify 4 (MD3)      │
│ • Embedded SQLite DB  │ • Extended SQLite DB  │ • Extended SQLite DB  │ • Headless REST + GraphQL      │
│ • Local File System   │ • Local FS + SyncYomi │ • Local FS + WebDAV   │ • Suwayomi-Server + Storage    │
│ • In-Process Scrapers │ • In-Process Scrapers │ • In-Process Scrapers │ • Remote Scraper Sandboxing    │
│ • Stock Features Only │ • ExHentai, Merged,   │ • Discord RPC, FlagKit│ • Near 100% Core Mihon Parity; │
│                       │   Dynamic Grouping    │   Cover Theme, Scale  │   Adapts Fork Wins on Client   │
└───────────────────────┴───────────────────────┴───────────────────────┴────────────────────────────────┘
```

1. **Local SQLite vs. Remote Headless Server**:
   - *Mihon / SY / Komikku*: Own the entire data model directly in an on-device SQLite database via SQLDelight. Schema additions, table joins (e.g. `history`, `updatesView`, `merged`, `libraryUpdateError`), and atomic transactional writes are trivial.
   - *`mihon-vue`*: Acts strictly as a headless client communicating with **Suwayomi-Server** via REST (`/api/v1`) and GraphQL (`/api/graphql`). Where Suwayomi-Server lacks endpoints (e.g. library update triggers, history tables, per-manga category assignments in REST v1), `mihon-vue` either implements sophisticated client-side calculations (`releaseSchedule.ts`), utilizes browser `localStorage` namespaces, or displays honest, non-blocking explanatory dialogs.
2. **Extensions & Sandboxing**:
   - *Mihon / SY / Komikku*: Install `.apk` extensions directly on Android with dynamic DEX class loading.
   - *`mihon-vue`*: Cannot execute DEX code in a web browser. Extensions run server-side in Suwayomi-Server; the web UI acts as an extension explorer and source preferences configurator.
3. **Android Hardware vs. Browser Sandboxing**:
   - Volume key page navigation, lock screen obscuring via `FLAG_SECURE`, hardware biometric prompts, and E-Ink display refresh waveforms are native Android APIs. `mihon-vue` replaces these with desktop keyboard shortcuts, Web Share API, Canvas obscuring on tab blur, and pure CSS flash effects.

---

## 2. Domain 1: Library & Categories

### 2.1 Screen & Sub-Screen Inventory Table

| Screen / Sub-View | Mihon | TachiyomiSY | Komikku | mihon-vue | Implementation Notes & File Paths |
|---|:---:|:---:|:---:|:---:|---|
| **Library Main Scaffold / Screen** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • **Mihon**: `eu/kanade/tachiyomi/ui/library/LibraryTab.kt`, `LibraryViewModel.kt`, `LibraryContent.kt`<br>• **SY**: `TachiyomiSY/.../LibraryTab.kt`, `LibraryViewModel.kt`<br>• **KMK**: `komikku/.../LibraryTab.kt`, `LibraryScreenModel.kt`<br>• **mihon-vue**: `src/features/library/views/LibraryView.vue` (TopBar, tabs, horizontal swipe pager, pull-to-refresh, selection mode bar). |
| **Category Tabs Bar** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • **Mihon**: `presentation/library/components/LibraryTabs.kt`<br>• **SY**: `LibraryTabs.kt` (integrates dynamic grouping categories)<br>• **KMK**: `LibraryTabs.kt` (integrates hidden categories & empty categories search prefs)<br>• **mihon-vue**: `src/features/library/components/LibraryCategoryTabs.vue` (uses `Md3PrimaryTabs.vue`). |
| **Category Content Host / Pager** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • **Mihon**: `presentation/library/components/LibraryPager.kt`<br>• **SY**: `LibraryPager.kt`<br>• **KMK**: `LibraryPager.kt` (adds `ComfortableGridPanorama` branch with `usePanoramaCover = true`)<br>• **mihon-vue**: `src/features/library/components/LibraryPager.vue`. |
| **Display Mode: Compact Grid** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • **Mihon/SY/KMK**: `presentation/library/components/LibraryCompactGrid.kt`, `CommonMangaItem.kt`<br>• **mihon-vue**: `src/features/library/components/LibraryCompactGridItem.vue` (Title overlaid in gradient at bottom of cover; badges in top corners). |
| **Display Mode: Comfortable Grid** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • **Mihon/SY/KMK**: `presentation/library/components/LibraryComfortableGrid.kt`<br>• **mihon-vue**: `src/features/library/components/LibraryComfortableGridItem.vue` (Title placed below cover image). |
| **Display Mode: List View** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • **Mihon/SY/KMK**: `presentation/library/components/LibraryList.kt`, `MangaListItem.kt`<br>• **mihon-vue**: `src/features/library/components/LibraryListItem.vue` (56dp row height with thumbnail, 2-line title, badges inline). |
| **Display Mode: Cover-Only Grid** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • **Mihon/SY/KMK**: `LibraryCompactGrid.kt` with cover-only flag<br>• **mihon-vue**: `LibraryCompactGridItem.vue` (`prefs.libraryDisplay === 'covers'`). |
| **Display Mode: Comfortable Grid Panorama** | ➖ N/A | ➖ N/A | ✅ Full | ❌ Missing | • **KMK Exclusive**: `LibraryDisplayMode.ComfortableGridPanorama` (`action_display_comfortable_grid_panorama`), `LibraryComfortableGrid.kt:122` (`usePanoramaCover = true`), `CommonMangaItem.kt:248`, `MangaCover.Panorama`<br>• **mihon-vue**: Not implemented. |
| **Library Settings Sheet / Dialog** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | • **Mihon**: `presentation/library/LibrarySettingsDialog.kt` (3 tabs: Filter, Sort, Display)<br>• **SY**: `LibrarySettingsDialog.kt` (4 tabs: Filter, Sort, Display, Group)<br>• **KMK**: `LibrarySettingsDialog.kt` (4 tabs + `CategoriesFilter` in Filter page)<br>• **mihon-vue**: `src/features/library/components/LibrarySettingsSheet.vue` (3 tabs; lacks Group tab, lewd filter, and category include/exclude filter). |
| **Dynamic Grouping Sub-View (`GroupPage`)** | ➖ N/A | ✅ Full | ✅ Full | ❌ Missing | • **SY & KMK**: `LibrarySettingsDialog.kt:GroupPage`, `LibraryGroup.kt` (`BY_DEFAULT`, `BY_SOURCE`, `BY_STATUS`, `BY_TRACK_STATUS`, `UNGROUPED`), `LibraryViewModel.getGroupedMangaItems`<br>• **mihon-vue**: Missing dynamic group tab and grouping engine. |
| **Selection Mode Bottom Action Bar** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • **Mihon/SY/KMK**: `presentation/library/components/LibraryBottomActionMenu.kt`<br>• **mihon-vue**: `src/features/manga/components/MangaBottomActionMenu.vue`, `LibraryView.vue` (Change category, mark read/unread, download, delete, migrate). |
| **Change Category Dialog** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | • **Mihon/SY/KMK**: `presentation/category/components/CategoryDialogs.kt:ChangeCategoryDialog`<br>• **mihon-vue**: `src/features/library/components/ChangeCategoryDialog.vue` (UI implemented; Suwayomi REST v1 lacks per-manga category endpoints, so action displays informative notification). |
| **Delete Library Manga Dialog** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • **Mihon/SY/KMK**: `presentation/library/DeleteLibraryMangaDialog.kt`<br>• **mihon-vue**: `src/features/library/components/DeleteLibraryMangaDialog.vue` (Prompts deletion from library and optional deletion of downloaded chapters). |
| **Duplicate Manga Dialog** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • **Mihon/SY**: `presentation/manga/DuplicateMangaDialog.kt`<br>• **KMK**: `DuplicateMangaDialog.kt` (adds panorama cover support)<br>• **mihon-vue**: `src/features/library/components/DuplicateMangaDialog.vue`. |
| **Categories Management Screen ("Edit categories")** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • **Mihon/SY**: `presentation/category/CategoryScreen.kt`, `CategoryViewModel.kt`<br>• **KMK**: `CategoryScreen.kt`, `CategoryListItem.kt` (adds visibility toggle `action_hide`)<br>• **mihon-vue**: `src/features/library/views/CategoriesView.vue`, `CategoryManagerPanel.vue`, `CategoryListItem.vue`. |
| **Category CRUD Dialogs (Create, Rename, Delete)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • **Mihon/SY/KMK**: `presentation/category/components/CategoryDialogs.kt`<br>• **mihon-vue**: `CategoryCreateDialog.vue`, `CategoryRenameDialog.vue`, `CategoryDeleteDialog.vue`. |
| **Tag Sorting Configuration Screen** | ➖ N/A | ✅ Full | ✅ Full | ❌ Missing | • **SY & KMK**: `presentation/category/SortTagScreen.kt`, `SortTagViewModel.kt`, `SortTagContent.kt`<br>• **mihon-vue**: Missing. |
| **Library Update Errors Screen** | ➖ N/A | ➖ N/A | ✅ Full | ❌ Missing | • **KMK Exclusive**: `presentation/libraryUpdateError/LibraryUpdateErrorScreen.kt`, `LibraryUpdateErrorScreenModel.kt`, `LibraryUpdateErrorRepositoryImpl.kt`<br>• **mihon-vue**: Missing. |
| **Categories Tri-State Filter Dialog** | ➖ N/A | ➖ N/A | ✅ Full | ❌ Missing | • **KMK Exclusive**: `LibrarySettingsDialog.kt:CategoriesFilter`, `TriStateListDialog.kt`<br>• **mihon-vue**: Missing. |

### 2.2 Feature & Action Breakdown Table

| Feature / Action | Mihon | TachiyomiSY | Komikku | mihon-vue | Gap / Adaptation Notes |
|---|:---:|:---:|:---:|:---:|---|
| **Display Modes (Grid & List)** | ✅ Full (4) | ✅ Full (4) | ✅ Full (5) | 🟡 Partial (4) | Mihon & SY have Compact, Comfortable, List, Cover-Only. Komikku adds `ComfortableGridPanorama`. `mihon-vue` implements the 4 standard modes; missing panorama mode. |
| **Items Per Row / Columns Slider** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Slider 0..10 / Auto with separate portrait and landscape preferences in `LibraryDisplaySettings.vue`. |
| **Downloaded Chapters Badge** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Numeric count in `colorScheme.tertiary` on `MangaBadges.vue`. |
| **Unread Chapters Badge** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Numeric count in `colorScheme.secondary` on `MangaBadges.vue`. |
| **Local Source Badge** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Folder icon glyph (`MaterialSymbols.Rounded.Folder`) in `MangaBadges.vue`. |
| **Language Badge (Text ISO code)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Uppercase 2-letter ISO code (e.g. "EN", "JA") in `MangaBadges.vue`. |
| **FlagKit Country Language Icon Badge** | ➖ N/A | ➖ N/A | ✅ Full | ❌ Missing | **KMK Feature**: `action_display_language_icon`. Maps source language to country vector drawable via `GetExtensionLanguages.getLanguageIconID` using 250+ FlagKit drawables. `mihon-vue` only displays text ISO badges. |
| **Source Icon Badge on Manga Cards** | ➖ N/A | ➖ N/A | ✅ Full | ❌ Missing | **KMK Feature**: `action_display_source_badge`. Renders source favicon / icon badge directly on cover cards (`LibraryBadges.kt:SourceIconBadge`). Missing in `mihon-vue`. |
| **Continue Reading Overlay Button** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Quick-resume play button overlay on manga cover cards in `LibraryCompactGridItem.vue` & `LibraryComfortableGridItem.vue`. |
| **Show Category Tabs Toggle** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | When disabled, top app bar displays current category title instead of "Library". Implemented in `LibraryView.vue:202-207`. |
| **Show Number of Items / Badges** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Displays item count badges on tabs and toolbar. Implemented in `LibraryView.vue`. |
| **Hidden Categories Feature** | ➖ N/A | ➖ N/A | ✅ Full | ❌ Missing | **KMK Feature**: Category model property `hidden: Boolean`. Strikethrough text + 60% opacity with visibility toggle (`action_hide`) in `CategoryListItem.kt`. Excluded from tabs unless `action_show_hidden_categories` is checked. |
| **Show Empty Categories During Search** | ➖ N/A | ➖ N/A | ✅ Full | ❌ Missing | **KMK Feature**: `pref_show_empty_categories_search`. Keeps empty categories visible in tab bar during search/filter (`LibraryScreenModel.kt:289`). In `mihon-vue`, empty categories are always hidden when filtering. |
| **Dynamic Grouping (`LibraryGroup`)** | ➖ N/A | ✅ Full | ✅ Full | ❌ Missing | **SY & KMK Feature**: Settings Tab 4 (`GroupPage`). Allows grouping library dynamically by: Default (Categories), By Source, By Status, By Tracking Status, Ungrouped. In `mihon-vue`, only category tabs exist. |
| **Tri-State Filters** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | TriState (Downloaded, Unread, Started, Bookmarked, Completed) handled in `src/core/utils/library.ts` and `TriStateRow.vue`. |
| **Lewd / 18+ Tri-State Filter** | ➖ N/A | ✅ Full | ✅ Full | ❌ Missing | **SY & KMK Feature**: `filterLewd` (`SYMR.strings.lewd`). Tri-state filter for NSFW / 18+ content in `FilterPage`. Missing in `mihon-vue`. |
| **Categories Tri-State Filter** | ➖ N/A | ➖ N/A | ✅ Full | ❌ Missing | **KMK Feature**: `CategoriesFilter` in `FilterPage` (`filterCategoriesInclude`, `filterCategoriesExclude`). Opens `TriStateListDialog` to include (+) or exclude (-) categories. Missing in `mihon-vue`. |
| **Tracking Service Tri-State Filter** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Dynamic TriState per logged-in tracking service in `LibrarySettingsSheet.vue:loggedInTrackers`. |
| **Standard Sorting (10 Sorts)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Alphabetical, Total Chapters, Last Read, Last Update, Unread Count, Latest Chapter, Chapter Fetch Date, Date Added, Tracker Score, Random. |
| **Tag Sorting Mode (`TagList`)** | ➖ N/A | ✅ Full | ✅ Full | ❌ Missing | **SY & KMK Feature**: `LibrarySort.Type.TagList`. Sorts manga based on an ordered list of priority genre tags (`sortTagsForLibrary`). Missing in `mihon-vue`. |
| **Preload Library Cover Color** | ➖ N/A | ➖ N/A | ✅ Full | ❌ Missing | **KMK Feature**: `preload_library_cover_color`. Uses Palette on cached covers to extract dominant/vibrant colors, caching them for card backgrounds and contrast elements. Missing in `mihon-vue`. |
| **Fetch Metadata & Chapters on Add** | ➖ N/A | ➖ N/A | ✅ Full | ❌ Missing | **KMK Feature**: `pref_fetch_manga_metadata_on_add` and `pref_fetch_manga_chapters_on_add`. Immediately triggers background fetch when manga is added to library. Missing in `mihon-vue`. |
| **Library Update Errors Review** | ➖ N/A | ➖ N/A | ✅ Full | ❌ Missing | **KMK Feature**: Dedicated SQLite table `libraryUpdateError` and screen `LibraryUpdateErrorScreen`. Records failed updates, enables batch selection, retry, deletion, and multi-migration. Missing in `mihon-vue`. |
| **Category Reordering via Drag-and-Drop** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Drag handle reordering in `CategoryListItem.vue` connected to `/api/v1/category/{id}/reorder`. |
| **Batch Selection Actions** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Select All, Invert Selection, Clear, Delete, Mark Read/Unread (with GraphQL batch optimization in `chaptersBatch.ts`). Change Category is restricted due to Suwayomi REST v1. |

### 2.3 Fork-Exclusive Delta & Vue Strategy

#### TachiyomiSY & Komikku Shared Features
- **Dynamic Library Grouping (`LibraryGroup`)**:
  - `BY_DEFAULT` (0), `BY_SOURCE` (1), `BY_STATUS` (2), `BY_TRACK_STATUS` (3), `UNGROUPED` (4).
  - *Vue Strategy*: **100% Client-Side Implementable**. Add `groupMode` to `preferences.ts` and a 4th "Group" tab in `LibrarySettingsSheet.vue`. In `LibraryView.vue`, derive virtual categories from `server.library` by grouping on `manga.sourceId`, status enum, or tracking status. When grouped, bind sort to `preferences.globalSort`.
- **Tag-Based Priority Sorting (`TagList` & `SortTagScreen`)**:
  - Sorts manga based on an ordered user list of genre tags.
  - *Vue Strategy*: Store `sortTagsForLibrary: string[]` in `preferences.ts` (`localStorage`) and add case `'tagList'` in `library.ts:sortLibrary`.
- **Lewd (18+) Tri-State Filter**:
  - *Vue Strategy*: Add `lewd: TriState` to `preferences.filters` and evaluate against manga `genre` containing NSFW keywords.

#### Komikku Exclusive Features
- **FlagKit Country Language Icon Badges (`useLangIcon`)**:
  - Replaces 2-letter uppercase text badges ("EN", "JA") with crisp national flag SVG badges.
  - *Vue Strategy*: Add SVG flag icons in `public/flags/` mapping ISO codes (`en` -> US/GB, `ja` -> JP, `ko` -> KR, `zh` -> CN, `es` -> ES, `ru` -> RU). Add "Use language icon" toggle in `LibraryDisplaySettings.vue` and render flag badge in `MangaBadges.vue`.
- **Source Icon Badges on Manga Cards (`sourceBadge`)**:
  - *Vue Strategy*: Add `sourceBadge` toggle in `LibraryDisplaySettings.vue`. Render source favicon from `/api/v1/source/{sourceId}/icon` in `MangaBadges.vue`.
- **Panorama Comfortable Grid Mode (`ComfortableGridPanorama`)**:
  - Expands grid cards to 16:9 landscape aspect ratio when covers are wide (`coverRatio <= 0.9`).
  - *Vue Strategy*: Add `'comfortable-panorama'` display mode in `LibraryDisplaySettings.vue`. Apply `aspect-ratio: 16 / 9` and `object-fit: cover` in `LibraryComfortableGridItem.vue`.
- **Hidden Categories Feature (`action_hide`, `showHiddenCategories`)**:
  - *Vue Strategy*: Store `hiddenCategoryIds: number[]` in `localStorage`. In `CategoryListItem.vue`, add an eye toggle button and apply `opacity: 0.6; text-decoration: line-through`. Add "Show hidden categories" checkbox in `LibraryDisplaySettings.vue`.
- **Categories Tri-State Filter Dialog**:
  - *Vue Strategy*: Add `filterCategoriesInclude: number[]` and `filterCategoriesExclude: number[]` in `preferences.filters`. Add an "Include/Exclude Categories" button in `LibrarySettingsSheet.vue` Filter tab.
- **Library Update Errors Screen & Multi-Migration**:
  - *Vue Strategy*: Store failed update entries in Pinia (`useLibraryUpdateErrorsStore`). Add route `/library/update-errors` with multi-select retry, clear, and multi-migration handoff.

---

## 3. Domain 2: Updates, Upcoming & History

### 3.1 Screen & Sub-Screen Inventory Table

| Screen / Sub-View | Mihon | TachiyomiSY | Komikku | mihon-vue | Implementation Notes & Exact File Paths |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Updates Feed (Main View)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/SY**: `eu.kanade.presentation.updates.UpdatesScreen.kt`, `UpdatesTab.kt`<br>**Komikku**: `UpdatesScreen.kt` (adds item swipe gestures & panorama cover toggle)<br>**mihon-vue**: `src/features/updates/views/UpdatesView.vue`, `updates.ts`. |
| **Updates Filter Dialog** | ✅ Full | ✅ Full | 🟡 Partial | ✅ Full | **Mihon/SY**: `UpdatesFilterDialog.kt` (2 tabs: TriState filters + Categories TriState)<br>**Komikku**: `UpdatesFilterDialog.kt` (Omitted categories tab; added `usePanoramaCover` switch)<br>**mihon-vue**: `src/features/updates/components/UpdatesFilterDialog.vue`. |
| **Updates Selection / Action Bottom Bar** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/SY**: `UpdatesBottomBar` in `UpdatesScreen.kt:217`<br>**Komikku**: `UpdatesBottomBar` in `UpdatesScreen.kt:231`<br>**mihon-vue**: `src/features/updates/components/UpdatesBottomBar.vue` with `updatesBottomActions.ts`. |
| **Updates Delete Confirmation Dialog** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/SY/Komikku**: `UpdatesDeleteConfirmationDialog.kt`<br>**mihon-vue**: `src/features/updates/components/UpdatesDeleteDialog.vue`. |
| **Library Update Progress Banner** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **Komikku Exclusive**: `eu.kanade.presentation.components.AppStateBanners` (`Banners.kt:80`), `MainActivity.kt:232`, `LibraryPreferences.kt:41` (`showUpdatingProgressBanner`)<br>**mihon-vue**: Missing. |
| **Library Update Errors Screen** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **Komikku Exclusive**: `presentation/libraryUpdateError/LibraryUpdateErrorScreen.kt`, `LibraryUpdateErrorScreenModel.kt`<br>**mihon-vue**: Missing. |
| **Upcoming / Release Calendar (Screen)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/SY**: `mihon.feature.upcoming.UpcomingScreen.kt`, `UpcomingViewModel.kt`<br>**Komikku**: `UpcomingScreen.kt` (adds "To be updated" queue toggle)<br>**mihon-vue**: `src/features/updates/views/UpcomingView.vue`, `releaseSchedule.ts`. |
| **Upcoming Filter Dialog** | ✅ Full | ✅ Full | ❌ Missing | ✅ Full | **Mihon/SY**: `UpcomingFilterDialog` in `UpcomingScreen.kt:67`<br>**Komikku**: Omitted dialog; replaced with toolbar toggle<br>**mihon-vue**: Integrated sheet in `UpcomingView.vue:370`. |
| **Upcoming Calendar Dialog (Inline)** | ➖ N/A | ➖ N/A | ➖ N/A | ✅ Full | **mihon-vue Exclusive**: `src/features/updates/components/UpdatesCalendarDialog.vue` (allows accessing upcoming calendar from a dialog directly inside Updates feed). |
| **History Screen (Main View)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/SY**: `presentation/history/HistoryScreen.kt`, `HistoryTab.kt`<br>**Komikku**: `HistoryScreen.kt` (adds multi-select mode & action toolbar)<br>**mihon-vue**: `src/features/history/views/HistoryView.vue`. |
| **History Filter Dialog** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **Komikku Exclusive**: `eu.kanade.presentation.history.components.HistoryFilterDialog.kt`<br>**mihon-vue**: Missing. |
| **History Multi-Select Action Mode** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **Komikku Exclusive**: `HistorySelectionToolbar` in `HistoryScreen.kt:251`, `selection: Set<Long>`<br>**mihon-vue**: Single item delete or delete-all only. |
| **History Delete Dialogs (Single / All)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/SY**: `HistoryDialogs.kt` (`HistoryDeleteDialog`, `HistoryDeleteAllDialog`)<br>**Komikku**: `HistoryDialogs.kt` (Delete dialog takes `List<HistoryWithRelations>`)<br>**mihon-vue**: `HistoryDeleteDialog.vue`, `HistoryDeleteAllDialog.vue`. |
| **History Duplicate Manga Dialog** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/SY/Komikku**: `Dialog.DuplicateManga`<br>**mihon-vue**: `src/features/library/components/DuplicateMangaDialog.vue` wired in `HistoryView.vue:71`. |

### 3.2 Feature & Action Breakdown Table

| Feature / Action | Mihon | TachiyomiSY | Komikku | mihon-vue | Gap / Adaptation Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Updates Relative Date Grouping** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Grouped by Today, Yesterday, or formatted date. Implemented in `UpdatesView.vue:150`. |
| **Updates Selection Mode & Invert** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Long-press or click enters selection mode; top bar has Select All and Invert Selection (`UpdatesAppBar.vue`). |
| **Updates Bottom Bar Action Guards** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Exact Kotlin `takeIf` predicates for Bookmark, Unbookmark, Read, Unread, Download, Delete ported in `updatesBottomActions.ts`. |
| **Updates Feed Swipe Gestures** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **Komikku Exclusive**: `updateSwipeStartAction` & `updateSwipeEndAction` in `UpdatesScreen.kt:66`. Can be adapted via touch swipe in `UpdatesItemRow.vue`. |
| **Updates Feed Panorama / Wide Cover** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **Komikku Exclusive**: `UpdatesFilterDialog.kt:117` toggle `usePanoramaCover`; renders 108dp wide cover (`UpdatesUiItem.kt:474`). |
| **Library Update Last Updated Header** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Displays relative time since last library check (`UpdatesLastUpdatedHeader.vue`). |
| **Library Update Progress App-Banner** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **Komikku Exclusive**: `AppStateBanners` displays top-bar banner with dynamic `%` (`notification_updating_progress`). |
| **Library Update Error Logging & Screen** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **Komikku Exclusive**: `LibraryUpdateErrorScreen` tracks failed updates, displays error clusters, and provides 1-click multi-migration! |
| **Upcoming Calendar Jump Navigation** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Tapping calendar day scrolls list to that target date (`UpcomingView.vue:229`). |
| **Upcoming Responsive Two-Panel Layout** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Mihon's `UpcomingScreenLargeImpl` (side-by-side calendar and list on tablet/desktop) implemented via `useTabletUi()` in `UpcomingView.vue:497`. |
| **Upcoming "To be updated" Queue View** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **Komikku Exclusive**: Toolbar toggle (`Icons.Outlined.NewReleases`) switches between predicted chapter releases and manga queue pending background update (`UpcomingScreenContent.kt:80`). |
| **Upcoming Release Prediction Algorithm** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Mihon native uses `ReleaseSchedule.kt`. Suwayomi REST v1 has no backend release date column; `mihon-vue` re-computes `estimateSchedule` client-side in `releaseSchedule.ts`. |
| **History Granular TriState Filtering** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **Komikku Exclusive**: `HistoryFilterDialog.kt` provides TriState filters: Unfinished manga, Unfinished chapter, Non-library entries. |
| **History Panorama / Wide Cover Toggle** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **Komikku Exclusive**: Toggle in `HistoryFilterDialog.kt:81`; renders wide cover in `HistoryItem.kt:103`. |
| **History Multi-Select & Batch Clear** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **Komikku Exclusive**: `HistorySelectionToolbar` in `HistoryScreen.kt:251` supports Select All, Invert, and batch `Delete(selected)`! |
| **History Unread Badge & Read Progress** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **Komikku Exclusive**: `HistoryItem.kt:173` renders primary unread dot badge (`hasUnread`) and `readProgress` text ("Page 14"). |
| **History Quick Favorite / Delete Buttons** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Favorite icon displayed if manga is not in library; delete icon displayed on row (`HistoryItem.vue`). |
| **Dynamic Navbar Tab Customization** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | **TachiyomiSY/Komikku Feature**: `uiPreferences.showNavUpdates` and `showNavHistory` allow hiding Updates/History from navbar, relocating them into More tab (`MoreScreen.kt:87`). |
| **Navbar Label Visibility Preference** | ❌ Missing | ✅ Full | ❌ Missing | ❌ Missing | **TachiyomiSY Feature**: `uiPreferences.bottomBarLabels` toggles persistent labels vs show-when-selected (`HomeScreen.kt:84`). |
| **Navbar Reselect Opens Download Queue** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Re-selecting Updates tab in Mihon/SY/Komikku pushes `DownloadQueueScreen`. In `mihon-vue`, download queue is accessed via router or header. |

### 3.3 Fork-Exclusive Delta & Vue Strategy

#### Komikku Exclusive Features
- **Granular History Filters (`HistoryFilterDialog.kt`)**:
  - Filters history feed by:
    * `filterUnfinishedManga` (TriState: All, Unfinished, Finished)
    * `filterUnfinishedChapter` (TriState: All, Unfinished, Finished)
    * `filterNonLibraryManga` (TriState: All, Non-library, Library)
    * `usePanoramaCover` (Boolean switch for wide covers)
  - *Vue Strategy*: Create `src/features/history/components/HistoryFilterDialog.vue` using `AdaptiveSettingsSheet.vue` and `TriStateRow.vue`. Apply predicates client-side in `HistoryView.vue:computed(filteredEntries)`.
- **History Multi-Select & Batch Delete (`HistorySelectionToolbar`)**:
  - Long-pressing in History enables selection mode, Select All, Invert, and batch deletion.
  - *Vue Strategy*: Add `selectionMode` in `HistoryView.vue` and an action toolbar similar to `UpdatesAppBar.vue`. Enhance `HistoryDeleteDialog.vue` to accept multiple items and batch delete via Suwayomi REST `DELETE /api/v1/chapter/{id}`.
- **History Row Enhancements (`hasUnread` dot & `readProgress`)**:
  - *Vue Strategy*: In `HistoryItem.vue`, add an 8dp primary dot indicator when the manga has unread chapters and render "Page X" if unfinished.
- **Library Update Progress Banner (`AppStateBanners`)**:
  - *Vue Strategy*: Add `LibraryUpdateBanner.vue` in the top slot of `App.vue`, polling Suwayomi status to display scan progress.

#### TachiyomiSY & Komikku Shared Features
- **Customizable Bottom Nav / Navigation Rail (`showNavUpdates` & `showNavHistory`)**:
  - *Vue Strategy*: In `preferences.ts`, add `showNavUpdates` and `showNavHistory`. Filter navigation tabs in `DefaultLayout.vue` and render fallback rows in `MoreView.vue`.

---

## 4. Domain 3: Browse, Sources, Extensions, Feeds & Migration

### 4.1 Screen & Sub-Screen Inventory Table

| Screen / Sub-View | Mihon | TachiyomiSY | Komikku | mihon-vue | Implementation Notes & File Paths |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Browse Root & Tabs** | `✅ Full` (3 tabs) | `✅ Full` (3-4 tabs) | `✅ Full` (3-4 tabs + Bulk) | `✅ Full` (3 tabs) | **Mihon**: `BrowseTab.kt` (Sources, Extensions, Migrate).<br>**SY**: `BrowseTab.kt` (`hideFeedTab`, `feedTabInFront`).<br>**KMK**: `BrowseTab.kt` adds `BulkFavoriteScreenModel`.<br>**mihon-vue**: `src/features/browse/views/BrowseView.vue:144` (`VALID_TABS = ['sources', 'extensions', 'migrate']`). |
| **Sources Tab / Screen** | `✅ Full` | `✅ Full` | `✅ Full` | `✅ Full` | **Mihon**: `presentation/browse/SourcesScreen.kt`, `SourcesTab.kt`.<br>**SY**: Same.<br>**KMK**: `presentation/browse/SourcesScreen.kt` + `FlagEmoji.getEmojiLangFlag`.<br>**mihon-vue**: `BrowseView.vue:451-724` (`sources-pane`, source list, pinning, last used). |
| **Sources Filter Screen** | `✅ Full` | `✅ Full` | `✅ Full` (FlagKit) | `✅ Full` | **Mihon/SY**: `presentation/browse/SourcesFilterScreen.kt`.<br>**KMK**: With `FlagEmoji.kt`.<br>**mihon-vue**: `src/features/browse/views/SourcesFilterView.vue:1-611` (local preferences). |
| **Source Catalogue Screen** | `✅ Full` | `✅ Full` (+EHentai List) | `✅ Full` (+Bulk Favorite) | `✅ Full` | **Mihon**: `presentation/browse/BrowseSourceScreen.kt`.<br>**SY**: `BrowseSourceEHentaiList.kt`, `MangaDexFilterHeader.kt`.<br>**KMK**: `BrowseSourceScreen.kt:415-423` (+MangaDex random, bulk select).<br>**mihon-vue**: `src/features/browse/views/SourceView.vue:1-1267` (compact, comfortable, list). |
| **Source Filter Dialog & Saved Searches** | `🟡 Partial` (Filter only) | `✅ Full` (+Saved Searches) | `✅ Full` (+Hold actions) | `🟡 Partial` (Filter only) | **Mihon**: `BrowseSourceDialogs.kt` (no saved searches).<br>**SY**: `SourceFilterDialog.kt`, `SavedSearchItem.kt`.<br>**KMK**: `SavedSearchItem.kt:50-51` (`onClick` search, `onLongClick` press).<br>**mihon-vue**: `SourceFilterDialog.vue:1-358`. No saved search persistence. |
| **Global Feed Tab / Screen** | `❌ Missing` | `✅ Full` (Max 10) | `✅ Full` (Max 20 + Sort) | `❌ Missing` | **Mihon**: Not present.<br>**SY**: `FeedTab.kt`, `FeedViewModel.kt` (limit 10).<br>**KMK**: `FeedTab.kt`, `FeedScreenModel.kt` (`MaxFeedItems = 20`).<br>**mihon-vue**: Feed tab not implemented. |
| **Feed Reorder Screen (`action_sort_feed`)** | `❌ Missing` | `❌ Missing` | `✅ Full` | `❌ Missing` | **Komikku exclusive**: `eu/kanade/presentation/browse/FeedOrderScreen.kt:1-81` (reorderable list with drag handle using `sh.calvin.reorderable`, item deletion).<br>**SY/Mihon/Vue**: No drag-and-drop feed order screen. |
| **Source Feed Screen (Per-Source)** | `❌ Missing` | `✅ Full` (Max 10) | `✅ Full` (Max 20 + Hold) | `❌ Missing` | **SY**: `SourceFeedScreen.kt` (limit 10).<br>**KMK**: `SourceFeedScreen.kt:247-255` (`saved_searches_add_feed`), limit 20.<br>**mihon-vue**: Not implemented. |
| **Source Feed Reorder Screen** | `❌ Missing` | `❌ Missing` | `✅ Full` | `❌ Missing` | **Komikku exclusive**: `eu/kanade/presentation/browse/SourceFeedOrderScreen.kt:1-102`. |
| **Global Search Screen** | `✅ Full` | `✅ Full` | `✅ Full` (+Cycle filter) | `✅ Full` | **Mihon/SY**: `GlobalSearchScreen.kt`.<br>**KMK**: `GlobalSearchScreenModel.kt:92` (`globalSearchPinnedState` cycle toggle), bulk favorite.<br>**mihon-vue**: `src/features/browse/views/GlobalSearchView.vue:1-403` (5-worker pool). |
| **Extensions Tab / Screen** | `✅ Full` | `✅ Full` | `✅ Full` (FlagKit) | `✅ Full` | **Mihon/SY**: `ExtensionsScreen.kt`.<br>**KMK**: `ExtensionsScreen.kt:73` (with `FlagEmoji`).<br>**mihon-vue**: `BrowseExtensionsTab.vue:1-1253` (GET `/api/v1/extension/list`). |
| **Extension Details Screen** | `✅ Full` | `✅ Full` | `✅ Full` | `✅ Full` | **Mihon/SY/KMK**: `ExtensionDetailsScreen.kt`.<br>**mihon-vue**: `src/features/browse/views/ExtensionDetailsView.vue:1-1011`. |
| **Extension Filter Screen** | `✅ Full` | `✅ Full` | `✅ Full` (FlagKit drawables) | `✅ Full` | **Mihon/SY**: `ExtensionFilterScreen.kt`.<br>**KMK**: `ExtensionFilterScreen.kt:83` (`GetExtensionLanguages.getLanguageIconID`).<br>**mihon-vue**: `src/features/browse/views/ExtensionFilterView.vue:1-397`. |
| **Extension Repositories Screen** | `✅ Full` | `✅ Full` | `✅ Full` | `✅ Full` | **Mihon/SY/KMK**: `ExtensionReposScreen.kt`.<br>**mihon-vue**: `ExtensionStoresView.vue:1-93`, `ExtensionStoresPanel.vue`. |
| **Source Preferences Screen** | `✅ Full` | `✅ Full` | `✅ Full` | `✅ Full` | **Mihon/SY/KMK**: `SourcePreferencesScreen.kt`.<br>**mihon-vue**: `SourcePreferencesView.vue:1-1032`. |
| **Migration: Sources List (Tab)** | `✅ Full` | `✅ Full` | `✅ Full` | `✅ Full` | **Mihon/SY**: `MigrateSourceScreen.kt`.<br>**KMK**: With `FlagEmoji`.<br>**mihon-vue**: `MigrateSourceList.vue:1-406`. |
| **Migration: Manga List (Per-Source)** | `✅ Full` | `✅ Full` | `✅ Full` | `🟡 Partial` | **Mihon/SY/KMK**: `MigrateMangaScreen.kt` (multi-select list).<br>**mihon-vue**: Skips intermediate cherry-pick; routes straight to `MigrationConfigView.vue`. |
| **Migration: Config Screen & Sheet** | `✅ Full` | `✅ Full` | `✅ Full` (+Smart single) | `✅ Full` | **Mihon/SY**: `MigrationConfigScreen.kt`.<br>**KMK**: `MigrationConfigScreenSheet.kt:166-175` (`migrationSmartSearchSingleEntryPref`).<br>**mihon-vue**: `src/features/migration/views/MigrationConfigView.vue:1-1191`. |
| **Migration: Smart Search List** | `✅ Full` | `✅ Full` | `✅ Full` (+Single Entry) | `🟡 Partial` | **Mihon/SY**: `MigrationListScreen.kt`.<br>**KMK**: Same.<br>**mihon-vue**: `MigrationListView.vue:1-888` (client smart search; mutate stubs report Suwayomi REST limitation). |
| **Migration: Manual Search Screen** | `✅ Full` | `✅ Full` | `✅ Full` | `🟡 Partial` | **Mihon/SY/KMK**: `MigrateSearchScreen.kt`.<br>**mihon-vue**: `src/features/migration/views/MigrateSearchView.vue:1-740`. |
| **Batch Add Screen** | `❌ Missing` | `✅ Full` | `✅ Full` (+Explicit domains) | `❌ Missing` | **SY**: `exh/ui/batchadd/BatchAddScreen.kt`.<br>**KMK**: `exh/ui/batchadd/BatchAddScreen.kt:79-103` (`batch_add_description`, `isHentaiEnabled` gate).<br>**mihon-vue**: Not implemented. |
| **Related Mangas / Suggestions Screen** | `❌ Missing` | `❌ Missing` | `✅ Full` | `❌ Missing` | **Komikku exclusive**: `eu/kanade/presentation/browse/RelatedMangasScreen.kt:1-126`, `RelatedMangasCompactGrid.kt`, `RelatedMangasComfortableGrid.kt`.<br>**SY/Mihon/Vue**: Not implemented. |

### 4.2 Feature & Action Breakdown Table

| Feature / Action | Mihon | TachiyomiSY | Komikku | mihon-vue | Gap / Adaptation Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Feed System (Aggregated Saved Searches)** | `❌ Missing` | `✅ Full` | `✅ Full` | `❌ Missing` | Aggregates latest/popular or custom saved searches into horizontal lanes. In `mihon-vue`, can be implemented via `localStorage` feed definitions + Suwayomi search endpoints. |
| **Feed Source Capacity Limit** | `➖ N/A` | `🟡 Partial` (Hardcoded 10) | `✅ Full` (Guard at 20) | `❌ Missing` | **SY**: `countFeedSavedSearchGlobal > 10`.<br>**Komikku**: `MaxFeedItems = 20`.<br>**Vue**: Adopt Komikku's 20-source limit. |
| **Feed Sorting / Reordering (`action_sort_feed`)** | `❌ Missing` | `❌ Missing` | `✅ Full` (Drag/Delete) | `❌ Missing` | **Komikku exclusive**: `FeedOrderScreen.kt` & `SourceFeedOrderScreen.kt` let users reorder feeds via drag handles (`sh.calvin.reorderable`) or delete items. |
| **Saved Searches Hold-to-Add to Feed** | `❌ Missing` | `❌ Missing` | `✅ Full` | `❌ Missing` | **Komikku exclusive**: `SourceFeedScreen.kt:253` (`saved_searches_add_feed`). Long-pressing a chip in per-source feed adds it directly to the feed list. |
| **Saved Searches Hold-to-Delete** | `❌ Missing` | `🟡 Partial` | `✅ Full` (Dedicated hold) | `❌ Missing` | **Komikku**: `BrowseSourceScreen.kt:420` (`saved_searches_delete`). Long press triggers delete dialog. |
| **Bulk Favorite Mode in Browse / Feed** | `❌ Missing` | `❌ Missing` | `✅ Full` | `❌ Missing` | **Komikku exclusive**: `BulkFavoriteScreenModel.kt:48-60`, `BulkSelectionToolbar.kt`. Allows batch-adding manga from catalog or feeds into library categories. |
| **Migration Smart Search Single Entry** | `❌ Missing` | `❌ Missing` | `✅ Full` | `❌ Missing` | **Komikku exclusive**: `migrationSmartSearchSingleEntryPref`. If enabled, single-manga migration automatically scores and picks best match in `MigrationListScreen`. |
| **Migration Source & Target Configuration** | `✅ Full` | `✅ Full` | `✅ Full` | `✅ Full` | `MigrationConfigScreen` (reorder target sources, toggle flags). Exact parity in `mihon-vue`'s `MigrationConfigView.vue`. |
| **Migration Backend Execution** | `✅ Full` (Local DB) | `✅ Full` (Local DB) | `✅ Full` (Local DB) | `🟡 Partial` (Client search works; mutation stubbed) | Suwayomi REST v1 has no migration endpoint. Web client can orchestrate: 1) add target to library, 2) copy chapter progress, 3) copy categories, 4) delete source manga. |
| **Website Suggestions & Related Manga** | `❌ Missing` | `❌ Missing` | `✅ Full` | `❌ Missing` | **Komikku exclusive**: `Source.getRelatedMangaListByExtension` fetches recommendations from source websites (`related_mangas_website_suggestions`). |
| **Batch Add Domain Parsing** | `❌ Missing` | `🟡 Partial` | `✅ Full` (5 domains + Hentai gate) | `❌ Missing` | **Komikku**: `BatchAddScreen.kt:79-103` (`batch_add_description`: MangaDex, E-H, ExH, nH, 8Muses; hides E-H if hentai disabled). |
| **FlagKit & Emoji Country Flags** | `❌ Missing` | `❌ Missing` | `✅ Full` (Vectors + Emojis) | `🟡 Partial` (Text names) | **Komikku exclusive**: Vector flags module `:flagkit` + `FlagEmoji.kt` (Unicode regional indicator pairs). In Vue, can use FlagKit SVG icons or Unicode emojis. |
| **MangaDex Source Enhancements** | `❌ Missing` | `✅ Full` | `✅ Full` | `❌ Missing` | Custom MangaDex filter header, "Random Manga", "Follows", tag autocompletion. |
| **EHentai List Presentation** | `❌ Missing` | `✅ Full` | `✅ Full` | `❌ Missing` | `BrowseSourceEHentaiList.kt` renders gallery metadata (uploader, pages, rating stars, language tags). |
| **Extension Store Repositories** | `✅ Full` | `✅ Full` | `✅ Full` | `✅ Full` | Extension repository JSON management. Implemented in `ExtensionStoresView.vue` / `ExtensionStoresPanel.vue`. |
| **Extension Lifecycle (Install/Uninstall)** | `✅ Full` (OS PackageMgr) | `✅ Full` (OS PackageMgr) | `✅ Full` (OS PackageMgr) | `🟡 Partial` (Read-only listing) | Android manages APKs. In `mihon-vue`, Suwayomi server manages APKs; web UI provides informative modals. |

### 4.3 Fork-Exclusive Delta & Vue Strategy

#### Komikku Exclusive Features
- **Feed Reorder Screen (`action_sort_feed`)**:
  - `FeedOrderScreen.kt` and `SourceFeedOrderScreen.kt` allow drag-and-drop reordering of feeds and individual feed deletion.
  - Guard against feed explosion increased to 20 (`MaxFeedItems = 20`, string `too_many_in_feed`).
  - *Vue Strategy*: Implement `FeedView.vue` with feed lane cards. Add a reorder modal using HTML5 drag-and-drop or sortable list, persisting order in `localStorage` under `mihon.browse.feedOrder`. Guard feed addition to 20 maximum.
- **Saved Searches Gestures (Hold-to-Add to Feed & Hold-to-Delete)**:
  - *Vue Strategy*: Store saved searches locally in `localStorage` (`mihon.savedSearches.{sourceId}`). In `SourceFilterDialog.vue`, add saved search chips with click (apply search) and right-click / long-press menu ("Add to Feed" or "Delete").
- **Smart Search for Single Entry Migration (`migrationConfigScreen_smartSearchSingleEntryTitle`)**:
  - *Vue Strategy*: Add a switch in `MigrationConfigView.vue` sheet: "Use smart search for single entry". When checked, route single manga directly to `MigrationListView.vue?ids={id}`.
- **Website Suggestions & Related Manga (`pref_source_related_mangas`)**:
  - *Vue Strategy*: In `MangaView.vue`, show a "Suggestions" horizontal carousel row.
- **FlagKit Integration & Language Flag Visuals**:
  - *Vue Strategy*: Add utility `sourceFlag.ts` mapping ISO codes to flag icons. Render SVG flag icons or native Unicode flag emojis next to language headers in `BrowseView.vue`, `BrowseExtensionsTab.vue`, and `SourcesFilterView.vue`.
- **Client-Side Migration Orchestration without Backend Route**:
  - Add target to library (`POST /api/v1/manga/{id}/library`).
  - Copy chapter read/bookmark state (`PATCH /api/v1/chapter/{id}`).
  - Copy categories (`PUT /api/v1/manga/{id}/category`).
  - Delete old manga (`DELETE /api/v1/manga/{id}/library`).

---

## 5. Domain 4: Manga Details, Merging, Previews & Tracking

### 5.1 Screen & Sub-Screen Inventory Table

| Screen / Sub-View | Mihon | TachiyomiSY | Komikku | mihon-vue | Implementation Notes & File Paths |
|---|:---:|:---:|:---:|:---:|---|
| **Manga Details Screen (Main)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • `mihon`: `MangaScreen.kt`<br>• `TachiyomiSY`: `MangaScreen.kt` (+ previews, namespace tags, merge, recs)<br>• `komikku`: `MangaScreen.kt` (+ panorama cover, top align, website suggestions, bulk actions)<br>• `mihon-vue`: `src/features/manga/views/MangaView.vue` (single-col + 2-col tablet layout). |
| **Manga Info Header** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | • `mihon`: `MangaInfoHeader.kt`<br>• `TachiyomiSY`: `MangaInfoHeader.kt`, `NamespaceTags.kt`<br>• `komikku`: `MangaInfoHeader.kt` (`usePanoramaCover` ratio ≤ 0.75f, `topAlignCover` alignment)<br>• `mihon-vue`: `MangaInfoHeader.vue` (backdrop blur, cover modal, tracking count badge, tags; missing: panorama cover toggle, top-align toggle, namespace badges). |
| **Chapter List & Chapter Header** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • `mihon`: `ChapterHeader.kt`, `MangaChapterListItem.kt`, `ChapterDownloadIndicator.kt`, `MissingChapterCountListItem.kt`<br>• `TachiyomiSY`: Same + SY chapter swipe actions<br>• `komikku`: Same + download animated indicators<br>• `mihon-vue`: `ChapterHeader.vue`, `MangaChapterListItem.vue` (swipe with 56dp threshold, unread dot, bookmark, progress), `ChapterDownloadIndicator.vue`, `MissingChapterCountListItem.vue`, `MangaResumeFab.vue`. |
| **Chapter Settings Sheet (Filter/Sort/Display)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • `mihon/SY/KMK`: `ChapterSettingsDialog.kt`<br>• `mihon-vue`: `ChapterSettingsSheet.vue` (AdaptiveSheet tabs, unread/downloaded/bookmarked tri-state filters, sort mode & direction, chapter number vs source title, scanlator navigation). |
| **Scanlator Filter Dialog** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • `mihon/SY/KMK`: `ScanlatorFilterDialog.kt`<br>• `mihon-vue`: `ScanlatorFilterDialog.vue` (checkboxes per scanlator, select all, invert, reactive chapter filtering). |
| **Manga Notes Screen & Display** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • `mihon/SY/KMK`: `MangaNotesScreen.kt`, `MangaNotesSection.kt`<br>• `mihon-vue`: `MangaNotesView.vue`, `MangaNotesSection.vue`, `mangaNotes.ts` (Client-side Pinia/localStorage store; edit/preview tabs with markdown rendering). |
| **Cover Dialog (Full-size Viewer)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • `mihon/SY/KMK`: `MangaCoverDialog.kt`<br>• `mihon-vue`: `MangaCoverDialog.vue` (fullscreen dialog, cover download, copy URL). |
| **Set Update Interval Dialog** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • `mihon/SY/KMK`: `SetIntervalDialog.kt`<br>• `mihon-vue`: `SetIntervalDialog.vue`. |
| **Duplicate Manga Dialog** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | • `mihon/SY`: `DuplicateMangaDialog.kt` ("Add anyway", "Show entry", "Cancel")<br>• `komikku`: `DuplicateMangaDialog.kt` (Adds bulk resolution: "Allow it", "Allow all", "Skip it", "Skip all", panorama cover)<br>• `mihon-vue`: `DuplicateMangaDialog.vue` (Single duplicate handling; missing Komikku's bulk "Allow all" / "Skip all"). |
| **Merged Manga Management Dialog** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | • `mihon`: ❌ Not supported<br>• `TachiyomiSY`: `EditMergedSettingsDialog.kt` (reorder priority via drag handle, toggle info manga, toggle chapter updates, chapter sort mode)<br>• `komikku`: `EditMergedSettingsDialog.kt` + `LibraryTab.kt` batch merge & prompt `action_remove_merged`<br>• `mihon-vue`: ❌ No merged manga dialog/API in Suwayomi client. |
| **Metadata Editing (Edit Manga Dialog)** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | • `mihon`: ❌ Not supported<br>• `TachiyomiSY`: `EditMangaDialog.kt` (AdaptiveSheet editing title, author, artist, thumbnail URL, description, genre tags, status; reset buttons; autofill metadata from trackers!)<br>• `komikku`: `EditMangaDialog.kt`<br>• `mihon-vue`: ❌ Missing. |
| **Page Preview (Thumbnails Strip & Gallery)** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | • `mihon`: ❌ Not supported<br>• `TachiyomiSY`: `PagePreviews.kt` (preview thumbnail row on manga screen, "More Previews" opens gallery, tap preview opens reader directly at page)<br>• `komikku`: `PagePreviews.kt`<br>• `mihon-vue`: ❌ Missing. |
| **Recommendations / Suggestions Screen & Row** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | • `mihon`: ❌ Not supported<br>• `TachiyomiSY`: `exh/recs/*` (AniList, MangaUpdates, MyAnimeList, Comick paging sources)<br>• `komikku`: `RelatedMangasRow.kt`, `RelatedMangasScreen.kt`, `pref_source_related_mangas`<br>• `mihon-vue`: ❌ Missing. |
| **Tracking Sheet (Track Info Dialog)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • `mihon`: `TrackInfoDialogHome.kt`<br>• `SY`: Tracker metadata resolution<br>• `KMK`: Auto sync & track-on-add-library<br>• `mihon-vue`: `TrackInfoDialog.vue`, `TrackInfoSelectors.vue` (Status, score wheel, chapter wheel, date pickers; full GraphQL Suwayomi integration via `trackers.ts`). |
| **Tracker Search Screen / Dialog** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • `mihon/SY/KMK`: `TrackerSearchScreen.kt`<br>• `mihon-vue`: `TrackerSearchView.vue`, `TrackerSearchResultCard.vue`, `useTrackerSearch.ts`. |
| **Tracker Login / Logout Dialog** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | • `mihon/SY/KMK`: `SettingsTrackingScreen.kt`<br>• `mihon-vue`: `TrackingLoginDialog.vue`, `TrackingLogoutDialog.vue`, `TrackerLoginView.vue`. |

### 5.2 Feature & Action Breakdown Table

| Feature / Action | Mihon | TachiyomiSY | Komikku | mihon-vue | Gap / Adaptation Notes |
|---|:---:|:---:|:---:|:---:|---|
| **Panorama Cover (`pref_panorama_cover`)** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | In `komikku` (`UiPreferences.kt:66`), if cover ratio (h/w) ≤ 0.75, render wide landscape image. Also toggleable in history/update filter dialogs (`action_panorama_cover`). |
| **Top Align Cover (`pref_top_align_cover`)** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | In `komikku` (`MangaInfoHeader.kt:586`), toggles whether cover thumbnail is aligned to `Alignment.Top` alongside title/author or centered vertically. |
| **Panorama Cover Flow (`pref_panorama_cover_flow`)** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | In `komikku` (`GlobalSearchCardRow.kt:82`), displays wide cards for wide covers in global search & suggestions. |
| **Website Suggestions / Related Manga** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | In `komikku` (`MangaScreen.kt:700`, `RelatedMangasRow.kt`), fetches `source.getRelatedMangaList()`. If `expandRelatedMangas` is true, displays inline carousel; if false, button; if `put_related_mangas_in_overflow`, in 3-dot menu. |
| **Show Home on Related Manga** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | In `komikku` (`RelatedMangasScreen.kt`), adds app-bar button in related manga screen to pop directly back to home. |
| **Duplicate Manga Handling (Bulk Actions)** | 🟡 Partial | 🟡 Partial | ✅ Full | 🟡 Partial | `komikku` adds bulk favorite options: `action_allow_duplicate_manga`, `action_allow_all_duplicate_manga`, `action_skip_duplicate_manga`, `action_skip_all_duplicate_manga`. |
| **Remove Original Entries on Merge** | ❌ Missing | 🟡 Partial | ✅ Full | ❌ Missing | In `komikku` (`LibraryTab.kt:222`), after merging entries, displays snackbar with action `action_remove_merged` ("Remove original entries from library?"). |
| **Auto Sync Progress from Trackers** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | In `komikku` (`TrackPreferences.kt:56`), when manga is refreshed, automatically queries logged-in trackers and updates local chapters read status up to tracker progress (`sync_progress_from_trackers_up_to_chapter`). |
| **Open Track Menu on Adding to Library** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | In `komikku` (`TrackPreferences.kt:41`), when user adds a manga to library and has logged-in trackers, immediately opens `TrackInfoDialog`. |
| **Namespaced Tags (`NamespaceTags.kt`)** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | In `TachiyomiSY` & `komikku`, parses tags with colon (`artist:foo`, `female:bar`) and renders distinct color-coded chips with search action. |
| **Page Previews Strip (`PagePreviews.kt`)** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | Renders thumbnail carousel of chapter pages on manga screen; clicking one opens reader directly to that page. |
| **Recommendations Engine (`exh/recs/*`)** | ❌ Missing | ✅ Full | ❌ Missing | ❌ Missing | `TachiyomiSY` multi-service recommendation engine (AniList, MangaUpdates, MyAnimeList, Comick) with batch search sheet. |
| **Metadata Editing (`EditMangaDialog.kt`)** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | `TachiyomiSY` & `komikku` allow overriding title, author, artist, cover URL, synopsis, tags, status, with "Autofill from tracker" button. |
| **Chapter Swipe Actions** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Toggle read, Toggle bookmark, Download with 56dp threshold in `MangaChapterListItem.vue`. |
| **Chapter Multi-selection & Batch Actions** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Select all, invert, range select, batch bookmark, mark read, download, delete in `MangaBottomActionMenu.vue`. |
| **Missing Chapter Gap Indicators** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Highlights missing chapters with a count pill via `MissingChapterCountListItem.vue`. |
| **Scanlator Filtering** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Scanlator multi-select filter dialog in `ScanlatorFilterDialog.vue`. |

### 5.3 Fork-Exclusive Delta & Vue Strategy

#### Komikku Exclusive Features
- **Panorama Cover & Top Align Cover**:
  - Dynamically switches to 16:9 panorama card when image aspect ratio `naturalHeight / naturalWidth <= 0.75`.
  - *Vue Strategy*: In `MangaInfoHeader.vue`, detect image dimensions on `@load` and apply `.manga-info-cover--panorama` class. Add preference setting for `pref_top_align_cover` (`align-items: flex-start` vs `center`).
- **Website Suggestions / Related Manga on Entry Page**:
  - Exposes source suggestions via `RelatedMangasRow` between synopsis and chapter header.
  - *Vue Strategy*: Create `RelatedMangasRow.vue` as a horizontal scrolling list of manga cards.
- **Bulk Duplicate Manga Dialog**:
  - *Vue Strategy*: Extend `DuplicateMangaDialog.vue` with `allow-all` and `skip-all` buttons.
- **Tracker Auto-Sync & Prompt on Add**:
  - `pref_auto_sync_progress_from_trackers`: Pulls tracker progress automatically on manga refresh, updating local read status up to tracker's last chapter read (`sync_progress_from_trackers_up_to_chapter`).
  - `pref_track_on_add_library`: Opens tracker sheet immediately when favoriting.
  - *Vue Strategy*: In `MangaView.vue` refresh handler, query `fetchMangaTrackRecords()` and batch update `updateChapter({ read: true })`. In `onToggleFavorite()`, if favorited, set `trackingOpen.value = true`.

#### TachiyomiSY & Komikku Shared Features
- **Merged Manga Management (`EditMergedSettingsDialog.kt`)**:
  - Reorder merged sources with drag-and-drop, designate info manga, toggle chapter updates.
  - *Vue Strategy*: Implement `EditMergedSettingsDialog.vue` using HTML5 drag-and-drop and client-side merged manga store.
- **Metadata Editing with Tracker Autofill (`EditMangaDialog.kt`)**:
  - *Vue Strategy*: Build `EditMangaDialog.vue` with form fields, tag chips, and "Fetch from Tracker" action that populates fields from AniList/MAL. Store overrides in `localStorage` under `mihon.manga_overrides`.
- **Namespaced Color Tags (`NamespaceTags.kt`)**:
  - *Vue Strategy*: Parse tag strings matching `^([a-zA-Z0-9_-]+):(.*)$` and assign MD3 tonal palette classes.

---

## 6. Domain 5: Reader Engine & Downloads

### 6.1 Screen & Sub-Screen Inventory Table

| Screen / Sub-View | Mihon | TachiyomiSY | Komikku | mihon-vue | Implementation Notes & File Paths |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Reader Activity / View Host** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon**: `ReaderActivity.kt`, `ReaderViewModel.kt`<br>**SY**: `ReaderActivity.kt` (double-page reload, shift spread, auto-webtoon)<br>**KMK**: `ReaderActivity.kt`<br>**mihon-vue**: `ReaderView.vue`, `reader.ts`. |
| **Paged Reader Engine (LTR / RTL)** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | **Mihon**: `PagerViewer.kt`, `ReaderPageImageView.kt`.<br>**SY**: Adds `PageLayout` (Single, Double, Auto) & spread layout.<br>**KMK**: Adds `DOUBLE` wide zoom & `pagedDisableZoomIn`.<br>**mihon-vue**: `ReaderView.vue` (Single-page LTR/RTL with transitions; lacks dual-page spread). |
| **Webtoon / Long Strip Engine** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | **Mihon**: `WebtoonViewer.kt`, `WebtoonRecyclerView.kt`.<br>**SY**: Adds smooth auto-scroll & auto-webtoon.<br>**KMK**: Adds `webtoonScaleType` (smart ratio: 4:3, 3:2, 16:9, 20:9) & `pinchToZoom` toggle.<br>**mihon-vue**: `ReaderView.vue` (Continuous strip; lacks smart aspect ratio constraints for ultrawide desktop monitors and strip-with-gaps mode). |
| **Double-Page Spread View** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | **Mihon**: None.<br>**SY & KMK**: `PagerConfig.PageLayout` (`SINGLE_PAGE`, `DOUBLE_PAGES`, `AUTOMATIC`), `PagerViewerAdapter.splitDoublePages()`.<br>**mihon-vue**: Not implemented. |
| **Reader Top Bar & Bottom Bar** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon**: `ReaderTopBar.kt`, `ReaderBottomBar.kt`.<br>**SY & KMK**: Page layout shift/toggle buttons in bottom bar.<br>**mihon-vue**: `ReaderTopBar.vue`, `ReaderBottomBar.vue` (1:1 MD3 bottom bar). |
| **Chapter Navigator (Seekbar & Jump)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon**: `ChapterNavigator.kt`.<br>**SY & KMK**: Vertical seekbar on landscape options.<br>**mihon-vue**: `ChapterNavigator.vue` (Horizontal LTR/RTL and vertical left/right sliders). |
| **Reading Mode Settings Sheet** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon**: `ReadingModePage.kt`.<br>**SY**: Double-page spread chips, invert, center margins.<br>**KMK**: Smaller tap zone, wide images zoom type, disable zoom in, webtoon smart scale, pinch toggle.<br>**mihon-vue**: `ReadingModePage.vue`. |
| **Color Filter & E-Ink Sheet** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/SY/KMK**: `ColorFilterPage.kt` (RGB+A sliders, BlendModes, grayscale, inverted).<br>**mihon-vue**: `ColorFilterPage.vue`, `useColorFilter.ts`, `ReaderContentOverlay.vue` (CSS mix-blend-mode / backdrop-filter and DisplayRefreshHost flash). |
| **General Reader Settings Sheet** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/SY/KMK**: `GeneralSettingsPage.kt`.<br>**mihon-vue**: `GeneralSettingsPage.vue`. |
| **Reader Page Actions Dialog (Sheet)** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | **Mihon**: Single page actions.<br>**SY**: 3 rows for spreads.<br>**KMK**: Dedicated strings `action_copy_to_clipboard_first_page / second / combined`.<br>**mihon-vue**: `ReaderPageActionsDialog.vue` (Single-page Copy, Share, Save; lacks dual-page/combined actions). |
| **Download Queue Screen** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/SY/KMK**: `DownloadQueueScreen.kt`, `DownloadQueueList.kt`.<br>**mihon-vue**: `DownloadQueueView.vue`, `useDownloadQueue.ts` (Full GraphQL bridge to Suwayomi-Server). |
| **Download Cleanup Dialog** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | **SY**: `SettingsAdvancedScreen.kt:CleanupDownloadsDialog`.<br>**KMK**: Same + `pref_clean_invalid_downloads`.<br>**mihon-vue**: Stubs reindexing as unsupported on client. |
| **Download Settings Screen** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/SY**: `SettingsDownloadScreen.kt`.<br>**KMK**: Adds `download_cache_renew_interval` (Manual, 1h, 2h, 6h, 12h, 24h).<br>**mihon-vue**: `SettingsDownloadView.vue`. |

### 6.2 Feature & Action Breakdown Table

| Feature / Action | Mihon | TachiyomiSY | Komikku | mihon-vue | Gap / Adaptation Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Copy to Clipboard (Single Page)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | `mihon-vue` writes PNG Blob to `navigator.clipboard.write([new ClipboardItem(...)])`. |
| **Copy to Clipboard (Dual / First / Second / Combined)** | ❌ Missing | 🟡 Partial | ✅ Full | ❌ Missing | **Komikku exclusive string refinement**: `action_copy_to_clipboard_first_page / second / combined`. `mihon-vue` lacks spread canvas stitching. |
| **Smaller Tap Zones (`smallerTapZone`)** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **Komikku exclusive**: Reduces outer tap zones from 33% to 25%, enlarging center menu zone from 34% to 50%. `mihon-vue` hardcodes 33%/66%. |
| **Pinch-to-Zoom Toggle in Webtoon** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **Komikku exclusive**: `WebtoonRecyclerView.kt:193`. Disables multi-touch pinch zoom to eliminate accidental zoom jumping during scrolling. |
| **Disable Zoom In for Paged Reader** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **Komikku exclusive**: `ReaderPageImageView.kt:301`. Disables all zoom-in gestures and double-tap zoom for fixed page framing. |
| **Wide Images Zoom Mode (`landscapeZoomType`)** | 🟡 Partial | 🟡 Partial | ✅ Full (DOUBLE `2x`) | ❌ Missing | **Komikku exclusive**: Adds 2x scale option (`DOUBLE`). `mihon-vue` does not zoom wide landscape pages in paged mode. |
| **Smart Scale on Wide Screens (`webtoonScaleType`)** | ❌ Missing | ❌ Missing | ✅ Full (4:3, 3:2, 16:9, 20:9) | ❌ Missing | **Komikku exclusive**: `WebtoonViewer.kt:181`. Restricts webtoon strip column width to realistic aspect ratios on desktop/tablet screens! Critical for desktop web browsers! |
| **Smart Scale for Strip With Gaps** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **Komikku exclusive**: Extends `webtoonScaleType` ratio constraints to continuous vertical mode with gaps. |
| **Download Cache Renew Interval** | ❌ Missing (1h) | ❌ Missing (1h) | ✅ Full (Manual, 1..24h) | ➖ N/A (Server-side) | **Komikku exclusive**: Configures local download index rebuild frequency. In `mihon-vue`, downloads exist on Suwayomi-Server. |
| **Clean Invalid / Orphaned Downloads** | ❌ Missing | 🟡 Partial | ✅ Full | ❌ Missing | **SY & Komikku**: Deletes orphaned disk folders, read chapters, and non-library downloads. |
| **Double-Page Spread Layout** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | **SY & Komikku**: Pagers pair pages (Single, Double, Auto landscape). `mihon-vue` only displays single-page. |
| **Shift Double Pages** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | **SY & Komikku**: Shifts page pairing so cover (p. 1) stays solo and subsequent pages (2-3, 4-5) spread together. |
| **Invert Double Pages** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | **SY & Komikku**: Inverts spread orientation for Western vs Manga reading order. |
| **Center Margin for Spread** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | **SY & Komikku**: Injects a gutter/spine separator between paired pages. |
| **Auto-Webtoon Detection** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | **SY & Komikku**: Inspects manga genre/tag/source ("Manhwa", "Webtoon") to auto-switch reading mode to Webtoon. |
| **Smooth Auto-Scroll for Webtoon** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | **SY & Komikku**: Smooth continuous auto-scrolling with configurable speed. |
| **Download Queue Management & Reorder** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Reorder queue, pause/start, move to top/bottom, cancel single / cancel series / clear all via Suwayomi GraphQL + HTML5 drag-and-drop. |
| **Auto-Download Ahead While Reading** | ✅ Full (2, 3, 5, 10) | ✅ Full | ✅ Full | 🟡 Partial | Preferences exist in `readerPreferences.ts`, but automated background queueing of upcoming chapters during live reading is not active in `ReaderView.vue`. |

### 6.3 Fork-Exclusive Delta & Vue Strategy

#### Komikku Exclusive Features
- **Webtoon Smart Scale on Wide Screens (`webtoonScaleType`)**:
  - Options: `FIT` (100%), `4:3` (0.75), `3:2` (0.667), `16:9` (0.5625), `20:9` (0.45).
  - *Vue Strategy*: **High Priority for Desktop Web**. Add `webtoonScaleType` in `useReaderPreferences()`. When `modeIsWebtoon` is true, constrain column width via CSS `max-width: calc(100vh * (ratio)); margin: 0 auto;`.
- **Smaller Tap Zones (`smallerTapZone`)**:
  - Reduces navigation hot-zones from 33% to 25% on viewport edges, granting 50% safe middle menu area.
  - *Vue Strategy*: Add `smallerTapZone: boolean` in `useReaderPreferences()` and calculate `x < 0.25` / `x > 0.75` in `ReaderView.vue`.
- **Disable Zoom In for Paged Reader & Pinch-to-Zoom Toggle**:
  - *Vue Strategy*: Add `pagedDisableZoomIn` and `webtoonPinchToZoom` toggles controlling gesture listeners.

#### TachiyomiSY & Komikku Shared Features
- **Double-Page Spread in Paged Mode (Desktop / Landscape)**:
  - *Vue Strategy*: In `useReaderPreferences`, implement `pageLayout: 'single' | 'double' | 'auto'`. On landscape viewports (`width > height`), render two consecutive pages side-by-side using CSS flex/grid. Support `shiftDoublePages` to keep page 0 (cover) displayed solo.
- **Auto-Webtoon Detection**:
  - *Vue Strategy*: When opening manga in `reader.ts`, if reading mode is `default` and preference `autoWebtoon` is enabled, check `manga.genre` array for keywords (`manhwa`, `webtoon`, `long strip`). If found, dynamically switch viewer mode to `webtoon`.

---

## 7. Domain 6: More, Statistics, Onboarding & Settings Ecosystem

### 7.1 Screen & Sub-Screen Inventory Table

| Screen / Sub-View | Mihon | TachiyomiSY | Komikku | mihon-vue | Implementation Notes & File Paths |
|---|:---:|:---:|:---:|:---:|---|
| **More Screen (Main)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon**: `MoreScreen.kt`<br>**SY**: Adds Updates/History if hidden from nav, Batch Add<br>**KMK**: Adds Library Update Errors, Sponsor, animated incognito icon<br>**Vue**: `src/features/settings/views/MoreView.vue` (LogoHeader, Downloaded Only, Incognito, Queue summary, Categories, Stats, Data, Settings, Support Us, About, Help). |
| **Statistics Screen** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/KMK**: `StatsScreenContent.kt`<br>**Vue**: `src/features/settings/views/StatsView.vue` (computes OverviewStats, TitleStats, ChapterStats, TrackerStats from Suwayomi REST endpoints; read duration gracefully shows "None"). |
| **Onboarding Wizard** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/KMK**: `OnboardingScreen.kt` (Theme, Storage, Permission, Guides steps)<br>**Vue**: `src/features/onboarding/views/OnboardingView.vue` + `ThemeStep.vue`, `StorageStep.vue`, `PermissionStep.vue`, `GuidesStep.vue` (browser folder picker via File System Access API). |
| **Settings Navigation Scaffold** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon**: `SettingsMainScreen.kt`<br>**SY**: Adds EH, MangaDex<br>**KMK**: Adds Connections<br>**Vue**: `src/features/settings/views/SettingsView.vue` (single-pane + TwoPanelBox 2-pane tablet/desktop layout). |
| **Settings: Appearance** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon**: `SettingsAppearanceScreen.kt`<br>**SY**: Adds navbar/fork options<br>**KMK**: Adds Custom Color, Custom Palette Style (9 styles), Cover-based theme, Panorama & Top-align covers<br>**Vue**: `src/features/settings/views/SettingsAppearanceView.vue`, `useAppearancePreferences.ts`. |
| **Custom Palette Color Picker** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **KMK**: `AppCustomThemeColorPickerScreen.kt`, `ThemeColorPickerWidget.kt` (HSV color wheel, brightness slider, hex indicator, 13 custom color palettes)<br>**Vue**: Needs porting with Vuetify `v-color-picker`. |
| **Settings: Library** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/KMK**: `SettingsLibraryScreen.kt`<br>**Vue**: `src/features/settings/views/SettingsLibraryView.vue` (Categories, Global update interval, smart update restrictions, swipe actions). |
| **Settings: Reader** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/KMK**: `SettingsReaderScreen.kt`<br>**Vue**: `src/features/settings/views/SettingsReaderView.vue`. |
| **Settings: Downloads** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/KMK**: `SettingsDownloadScreen.kt`<br>**Vue**: `src/features/settings/views/SettingsDownloadView.vue`. |
| **Settings: Tracking** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/KMK**: `SettingsTrackingScreen.kt`<br>**Vue**: `src/features/settings/views/SettingsTrackingView.vue` (Auto-update progress, OAuth / credential tracker login dialogs connected to Suwayomi). |
| **Settings: Connections** | ❌ Missing | ❌ Missing | ✅ Full | 🟡 Partial | **KMK**: `SettingsConnectionScreen.kt` (Special services: Discord RPC)<br>**Vue**: Routes `/settings/connection` to `ServerSettingsDialog.vue` (Suwayomi host configuration) rather than external client connections. |
| **Settings: Discord RPC** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **KMK**: `SettingsDiscordScreen.kt`, `DiscordLoginScreen.kt`<br>**Vue**: Missing. |
| **Settings: Browse** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/KMK**: `SettingsBrowseScreen.kt`<br>**Vue**: `src/features/settings/views/SettingsBrowseView.vue`. |
| **Settings: Data & Storage** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon**: `SettingsDataScreen.kt`<br>**SY**: Sync settings (SyncYomi, GDrive)<br>**KMK**: WebDAV sync service & progress banners<br>**Vue**: `src/features/settings/views/SettingsDataView.vue` (Storage info, backup interval, CSV export). |
| **Settings: Security & Privacy** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/KMK**: `SettingsSecurityScreen.kt`<br>**Vue**: `src/features/settings/views/SettingsSecurityView.vue`. |
| **Settings: E-Hentai (EH)** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | **SY & KMK**: `SettingsEhScreen.kt`<br>**Vue**: Handled in source preferences `/browse/source/:id/preferences`. |
| **Settings: MangaDex** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | **SY & KMK**: `SettingsMangadexScreen.kt`<br>**Vue**: Managed in extension-specific source preferences. |
| **Settings: Advanced** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon/KMK**: `SettingsAdvancedScreen.kt`<br>**Vue**: `src/features/settings/views/SettingsAdvancedView.vue`. |
| **Settings: Search** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | **Mihon**: `SettingsSearchScreen.kt`<br>**Vue**: `src/features/settings/views/SettingsSearchView.vue` + `settingsIndex.ts`. |
| **Sub-Screen: Categories** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | `CategoriesView.vue`. |
| **Sub-Screen: Extension Stores** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | `ExtensionStoresView.vue`. |
| **Sub-Screen: Create / Restore Backup** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | `CreateBackupView.vue`, `RestoreBackupView.vue` (UI and `.tachibk` Protobuf validator implemented; server lacks restore endpoint). |
| **Sub-Screen: Clear Database** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | `ClearDatabaseView.vue`. |
| **Sub-Screen: Debug Info & Worker Info** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | `DebugInfoView.vue`, `WorkerInfoView.vue`, `BackupSchemaView.vue`. |
| **Sub-Screen: Open Source Licenses** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | `OpenSourceLicensesView.vue`. |
| **Sub-Screen: Support Us** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | `SupportUsView.vue`. |
| **Sub-Screen: New Update / What's New** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | `NewUpdateView.vue`. |
| **Sub-Screen: Coming Updates (Preview)** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **KMK**: `ComingUpdatesScreen.kt` (`whats_coming` in `AboutScreen.kt`). |
| **Sub-Screen: Library Update Errors** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **KMK**: `MoreScreen.kt: onClickLibraryUpdateErrors`. |

### 7.2 Feature & Action Breakdown Table

| Feature / Action | Mihon | TachiyomiSY | Komikku | mihon-vue | Gap / Adaptation Notes |
|---|:---:|:---:|:---:|:---:|---|
| **Discord Rich Presence (RPC)** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **KMK:** `DiscordRPCManager.kt`, `DiscordLoginScreen.kt`. Authenticates via Discord WebView token extraction, connects to gateway, sends rich presence status.<br>**Vue Gap:** Web browsers cannot bypass CORS for local IPC (`127.0.0.1:6463`). Needs Electron IPC wrapper, local companion bridge, or Discord Gateway WebSocket. |
| **Discord RPC Customization** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **KMK:** Status selector (Online, Idle, DND), custom message, chapter titles toggle, reading progress toggle, elapsed timestamp toggle, Action buttons. |
| **Discord RPC Incognito Categories** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **KMK:** Multi-select category picker to suppress Discord presence when reading manga in selected sensitive categories (`discord_rpc_incognito_categories`). |
| **WebDAV Sync Subsystem** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **KMK:** `WebDavSyncService.kt` (URL, username, password, folder). Executes MKCOL, PUT, GET for backup synchronization.<br>**Vue Gap:** Vue can implement full WebDAV sync via `webdav` npm library directly from the browser! |
| **SyncYomi / Tachiyomi Sync** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | **SY & KMK:** Client-to-server sync engine syncing library, history, categories, tracks, settings.<br>**Vue Gap:** Suwayomi itself acts as the central sync server for library and tracking. |
| **Syncing & Restoring Progress Banners** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **KMK:** `Banners.kt`: Animated banners with progress percentages (`SyncingBannerBackgroundColor`, `RestoringBannerBackgroundColor`). |
| **Theme Based on Cover (Dynamic Palette)** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **KMK:** `UiPreferences.themeCoverBased()`, 9 `PaletteStyle` styles (Tonal Spot, Neutral, Vibrant, Expressive, Rainbow, Fruit Salad, Monochrome, Fidelity, Content).<br>**Vue Gap:** Can be adapted in `mihon-vue` using `@material/material-color-utilities` extracting dominant color from `manga.thumbnailUrl`. |
| **Custom Palette Personalizer (Seed Color)** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **KMK:** `AppCustomThemeColorPickerScreen.kt`, `ThemeColorPickerWidget.kt`. Custom HSV wheel, brightness slider, hex input.<br>**Vue Gap:** Can be added to `SettingsAppearanceView.vue` using Vuetify's `v-color-picker`. |
| **13 Custom Preset Color Palettes** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **KMK:** Casual, Sunset, Outrun, Raspberry, Pop, Cathode, Bubblegum, Night at the beach, Spectral, Patagonia, Springfield, LCD, PICO-8. |
| **6 Aniyomi Built-in Themes** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **KMK:** Cloudflare, Cotton Candy, Doom, Matrix, Mocha, Sapphire added to `AppTheme.kt`.<br>**Vue Gap:** Can be added directly to `src/core/theme/appThemes.ts`. |
| **Coming Updates Screen (`whats_coming`)** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **KMK:** Dedicated screen in `AboutScreen.kt` checking preview/beta release channel changelogs with markdown viewer. |
| **Clean Invalid Downloads** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **KMK:** `DownloadCache.cleanInvalidDownloads()` deletes orphaned download disk cache not linked to any library entries. |
| **Library Update Errors Review** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | **KMK:** `onClickLibraryUpdateErrors` in `MoreScreen.kt` showing a list of mangas that failed during background update. |
| **Batch Add Manga** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | **SY & KMK:** `BatchAddScreen.kt` allowing users to paste batches of manga URLs or IDs to add to library. |
| **E-Hentai & MangaDex Dedicated Settings** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | **SY & KMK:** `SettingsEhScreen.kt`, `SettingsMangadexScreen.kt`. |

### 7.3 Fork-Exclusive Delta & Vue Strategy

#### Komikku Exclusive Features
1. **Theme Expansion & Dynamic Cover-Based Color**:
   - Add the 6 Aniyomi color schemes (`cloudflare`, `cottonCandy`, `doom`, `matrix`, `mocha`, `sapphire`) directly into `src/core/theme/appThemes.ts`.
   - Implement the **Custom Palette Personalizer**: add a seed color picker using Vuetify's `v-color-picker`, generating a Material 3 palette via `@material/material-color-utilities` into CSS variables.
   - Implement **Cover-Based Dynamic Theme**: In `MangaView.vue`, extract dominant colors from the cover image to dynamically tint the reader and details header.
2. **WebDAV Client-Side Sync**:
   - In web environments, a WebDAV client using the `webdav` npm package can directly export and restore local JSON backups to/from Nextcloud or any WebDAV server without needing backend server changes.
   - Add the syncing/restoring progress banner from `Banners.kt` into the `App.vue` app shell.
3. **Discord Rich Presence (RPC)**:
   - For web builds: Browsers cannot connect to local RPC (`127.0.0.1:6463`). Support Discord Gateway WebSocket connection using user token with incognito category protection.
   - For desktop (Electron / Tauri) builds: Use `@discord-rpc/client` over IPC to broadcast reader presence (manga title, chapter, cover art) with Komikku customization options.
4. **Coming Updates Screen (`whats_coming`)**:
   - Add `/about/coming-updates` route in `mihon-vue` rendering preview changelogs.

---

## 8. Prioritized Backlog of Missing Features

### 8.1 Tier 1: Upstream Mihon Core Gaps to Complete in `mihon-vue`
*Target: Bring core Mihon parity from 91.2% to ~98%.*

1. **GraphQL Batch Category Assignment (`updateMangaCategories`)**:
   - Persist category assignment changes via Suwayomi GraphQL mutation `updateManga(input: { id, categoryIds })`.
2. **Download Next X Batch in Library Selection Bar**:
   - Add the "Download" button dropdown to `LibraryBottomActionMenu` (Next 1, 5, 10, Unread, All).
3. **Reader Continuous Strip Margins & Single Pager (Vertical)**:
   - Add CSS gap spacing options to `ReaderView.vue` for Webtoon mode (`reader-strip--gaps`).
   - Implement vertical paging mode with CSS scroll snap.
4. **Reader Dual-Page Split & Landscape Rotation**:
   - Split wide landscape scans in Pager mode into two sequential sub-pages using canvas or CSS clip-path.
5. **Anticipatory Page Preloading Buffer**:
   - Instantiate hidden `new Image()` preloads for `currentPage + 1`, `currentPage + 2`, and `currentPage - 1` to eliminate loading spinners.
6. **Manga Scanlator Filter in Updates Feed**:
   - Extend `UpdatesFilterDialog.vue` with an excluded scanlators checklist dynamically extracted from recent updates.

---

### 8.2 Tier 2: High-Value Fork Features (TachiyomiSY & Komikku) Implementable on Frontend
*Target: Features exclusive to TachiyomiSY & Komikku that require ZERO backend changes and can run 100% on the frontend or with existing Suwayomi APIs.*

1. **Dynamic Library Grouping (`LibraryGroup`) [SY & KMK]**:
   - *Feasibility*: 100% Client-Side.
   - *Implementation*: Add `groupingMode` (`'default' | 'source' | 'status' | 'track' | 'ungrouped'`) to `preferences.ts`. Derive virtual categories in `LibraryView.vue` by grouping cached library manga by source name, reading status, or tracker status.
2. **Webtoon Smart Scale on Wide Screens (`webtoonScaleType`) [Komikku]**:
   - *Feasibility*: 100% Client-Side.
   - *Implementation*: Constrain webtoon strip width on desktop monitors via CSS `max-width: calc(100vh * ratio)` for ratios 4:3, 3:2, 16:9, 20:9.
3. **Double-Page Spread in Reader (Desktop / Tablet Optimization) [SY & KMK]**:
   - *Feasibility*: 100% Client-Side.
   - *Implementation*: Pair sequential portrait pages side-by-side using CSS grid in `ReaderView.vue`. Support `shiftCover` offset toggle and Right-to-Left spread inversion.
4. **FlagKit National Country Icons for Languages [Komikku]**:
   - *Feasibility*: 100% Client-Side.
   - *Implementation*: Add SVG flag icons in `public/flags/` mapping ISO codes to flag icons. Render SVG badges next to language headers in Browse, Extensions, and Library.
5. **Auto-Webtoon Heuristic Mode [SY & KMK]**:
   - *Feasibility*: 100% Client-Side.
   - *Implementation*: Check `manga.genre` for keywords (`webtoon`, `manhwa`, `long strip`) upon opening; auto-default reader mode to `webtoon`.
6. **Granular History Filters & Multi-Select [Komikku]**:
   - *Feasibility*: 100% Client-Side.
   - *Implementation*: Add `HistoryFilterDialog.vue` (Unfinished manga, Unfinished chapter, Non-library entries) and multi-select deletion in `HistoryView.vue`.
7. **Panorama Cover & Cover Flow [Komikku]**:
   - *Feasibility*: 100% Client-Side.
   - *Implementation*: Detect cover aspect ratio `height / width <= 0.75` and apply 16:9 landscape card layout in `MangaInfoHeader.vue` and `LibraryComfortableGridItem.vue`.
8. **Saved Searches & Quick Filter Presets [SY & KMK]**:
   - *Feasibility*: 100% Client-Side.
   - *Implementation*: Add `useSavedSearchesStore` persisting named filter configurations to `localStorage`. Display saved search pills in `SourceFilterDialog.vue`.
9. **Browse Feed Tab & Reordering (`action_sort_feed`) [SY & KMK]**:
   - *Feasibility*: 100% Client-Side using existing Suwayomi endpoints.
   - *Implementation*: Add a 4th tab to `BrowseView.vue`. Query `/source/{id}/latest/1` and `/popular/1` across pinned sources concurrently, with a drag-and-drop feed reordering modal (guarding at max 20 sources).
10. **Custom Manga Info & Cover Editing with Tracker Autofill [SY & KMK]**:
    - *Feasibility*: 100% Client-Side.
    - *Implementation*: Add `localStorage` metadata override store (`mihon.manga_overrides`). Layer custom title, author, artist, synopsis, and thumbnail URL in `MangaInfoHeader.vue`. Allow one-click autofill from bound MyAnimeList/AniList metadata.
11. **Cover-Based Dynamic Theme & Palette Personalizer [Komikku]**:
    - *Feasibility*: 100% Client-Side.
    - *Implementation*: Extract dominant colors via Canvas / `@material/material-color-utilities` to tint manga details and reader. Add seed color picker and 13 curated themes in `SettingsAppearanceView.vue`.
12. **WebDAV Backup Synchronization [Komikku]**:
    - *Feasibility*: 100% Client-Side.
    - *Implementation*: Integrate `webdav` client to export/import JSON backups to Nextcloud/WebDAV endpoints directly from the browser.
13. **Smaller Tap Zones Toggle [Komikku]**:
    - *Feasibility*: 100% Client-Side.
    - *Implementation*: Adjust tap boundary to 25% outer edges in `ReaderView.vue`.

---

### 8.3 Tier 3: Blocked by Backend / Android OS Constraints
*Target: Features that require upstream Suwayomi-Server enhancements or are inapplicable to a browser client.*

1. **Backend Manga Migration & Copy Mutation**:
   - Blocked until Suwayomi-Server adds a transactional migration route (`POST /api/v1/manga/{id}/migrate`). Client-side multi-step fallback (add target, copy chapters, copy categories, delete source) can mitigate this.
2. **Backend Merged Manga (`MergedSource`)**:
   - Merging sources at the server level requires Suwayomi-Server database schema support for composite manga entries and unified chapter deduplication.
3. **Full Chapter Page Preview Thumbnails**:
   - Requires Suwayomi-Server thumbnail caching to avoid hammering source CDNs.
4. **Discord Local IPC Rich Presence in Web**:
   - Browsers sandbox local port access; requires desktop wrapper (Electron/Tauri) or Discord Gateway WebSocket token bridge.
5. **Syncyomi Client-to-Client Sync**:
   - Architecturally redundant for `mihon-vue` because Suwayomi-Server is already the centralized multi-client database.
6. **Native Android Platform Integrations**:
   - Android APK package installer, BiometricPrompt hardware cryptography, and Storage Access Framework (SAF) tree permissions cannot run in standard browser environments.

---

## 9. Four-Way Architectural Parity Dashboard

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                     FOUR-WAY FEATURE PARITY DASHBOARD (MIHON-VUE)                      │
├─────────────────────────────────────────────────┬──────────────────────────────────────┤
│ CORE NAVIGATION DOMAINS                         │ PARITY STATUS                        │
├─────────────────────────────────────────────────┼──────────────────────────────────────┤
│ Domain 1: Library & Categories                  │ ████████████████████░░ 95% (Mihon)   │
│                                                 │ ██████████████░░░░░░░░ 70% (SY)      │
│                                                 │ █████████████░░░░░░░░░ 64% (KMK)     │
├─────────────────────────────────────────────────┼──────────────────────────────────────┤
│ Domain 2: Updates, Upcoming & History           │ ██████████████████░░░░ 93% (Mihon)   │
│                                                 │ ████████████████░░░░░░ 80% (SY)      │
│                                                 │ ██████████████░░░░░░░░ 68% (KMK)     │
├─────────────────────────────────────────────────┼──────────────────────────────────────┤
│ Domain 3: Browse, Sources, Feeds & Migration    │ ██████████████████░░░░ 91% (Mihon)   │
│                                                 │ ████████████░░░░░░░░░░ 63% (SY)      │
│                                                 │ ███████████░░░░░░░░░░░ 56% (KMK)     │
├─────────────────────────────────────────────────┼──────────────────────────────────────┤
│ Domain 4: Manga Details, Merging & Tracking     │ ███████████████████░░░ 94% (Mihon)   │
│                                                 │ █████████████░░░░░░░░░ 65% (SY)      │
│                                                 │ ████████████░░░░░░░░░░ 59% (KMK)     │
├─────────────────────────────────────────────────┼──────────────────────────────────────┤
│ Domain 5: Reader Engine & Downloads             │ █████████████████░░░░░ 85% (Mihon)   │
│                                                 │ ███████████░░░░░░░░░░░ 56% (SY)      │
│                                                 │ ██████████░░░░░░░░░░░░ 50% (KMK)     │
├─────────────────────────────────────────────────┼──────────────────────────────────────┤
│ Domain 6: More, Statistics & Settings Ecosystem │ ██████████████████░░░░ 89% (Mihon)   │
│                                                 │ ███████████████░░░░░░░ 73% (SY)      │
│                                                 │ ████████████░░░░░░░░░░ 61% (KMK)     │
├─────────────────────────────────────────────────┼──────────────────────────────────────┤
│ TOTAL WEIGHTED PARITY                           │ 91.2% MIHON  │  67.8% TACHIYOMI SY   │
│                                                 │ 59.7% KOMIKKU                        │
└─────────────────────────────────────────────────┴──────────────────────────────────────┘
```

*(End of Matrix)*
