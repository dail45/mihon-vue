# Cross-Platform Screen and Feature Parity Audit: Mihon vs. TachiyomiSY vs. Komikku vs. mihon-vue

> **Target Version**: `mihon-vue` (Vue 3, TypeScript, Vuetify 4 with native MD3 tokens, Pinia, Vite)  
> **Backend Reference**: Suwayomi-Server (REST API v1 / GraphQL, commit `e2ce828abb81f0f5ce1a3fb86194a2746b519c85`, observed runtime `v2.4.2366-r2366`)  
> **Upstream Reference**: Mihon (commit `446f6df82c390ab760802c2fce3b677bce3f31c1`)  
> **Fork References**: TachiyomiSY (`eu.kanade.tachiyomi`), Komikku (`komikku`)  
> **Exclusions**: NSFW/Hentai-specific scrapers (e.g. E-Hentai/ExHentai screens, `filterLewd`). Focus strictly on core, general-purpose manga features.

---

## Executive Summary

This parity comparison document provides a screen-by-screen and feature-by-feature architectural audit comparing `mihon-vue` against the upstream Android flagship (`Mihon`) and two leading feature-rich Android forks (`TachiyomiSY` and `Komikku`).

### Quantitative Parity Overview

| Primary Screen Category | % vs Mihon | % vs TachiyomiSY | % vs Komikku | Category Assessment |
| :--- | :---: | :---: | :---: | :--- |
| **1. Library** | **98.4%** | **95.9%** | **94.3%** | Complete MD3 scaffold, dynamic grouping (source, status, tracker), tag sorting, FlagKit language flags, source badges, panorama grid. |
| **2. Updates** | **96.0%** | **92.0%** | **85.0%** | Feed with relative dates, Tri-state filters, selection mode, upcoming calendar, Komikku update errors screen and update banner. |
| **3. History** | **85.0%** | **86.0%** | **82.0%** | Relative date headers, search, delete item dialog, Komikku filter dialog, wide covers, selection toolbar, and batch operations. |
| **4. Browse** | **96.0%** | **84.0%** | **88.0%** | Sources list, dynamic filter sheet, saved searches, global/per-source feeds, feed reordering, 5-worker global search, bulk favorites, and transactional migration. |
| **5. Manga Details** | **98.5%** | **93.2%** | **90.5%** | Hero cover header, metadata editor, merged manga, namespaced tags, personal notes, chapter settings, scanlator exclusion, and 7-service GraphQL tracker wheel pickers. |
| **6. Reader** | **97.0%** | **95.0%** | **96.0%** | Paged (LTR/RTL/Vert), Continuous Webtoon, double-page spread pairing (single/double/auto), shift cover, gutter margin, webtoon smart scale, color filters, e-ink flashing, and canvas dual-page stitched export. |
| **7. More** | **96.0%** | **94.0%** | **93.0%** | Centered logo header, download queue (GraphQL reordering/sorting), statistics overview, full 4-step onboarding wizard, about/licenses, and support us. |
| **8. Settings** | **92.0%** | **88.0%** | **84.0%** | TwoPanelBox master-detail layout, global preference search, 20+ theme palettes, custom seed color picker, WebDAV cloud sync, CSV export, and debug inspector. |
| **Overall Parity Average** | **94.9%** | **91.0%** | **89.1%** | **High Parity**: Production-ready web client implementing nearly the entire functional matrix of Mihon, TachiyomiSY, and Komikku. |

---

## 1. Library

### Table A: Screens, Modals & Sub-Views
| Screen / Dialog / Sub-View | Mihon | TachiyomiSY | Komikku | mihon-vue (`src/` path) | Notes & Parity Details |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **Main Library View** (`LibraryTab` / `LibraryView`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/library/views/LibraryView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/library/views/LibraryView.vue) | Full scaffold with MD3 TopAppBar, category pager, pull-to-refresh spinner, empty states with "Getting started guide", and bottom navigation hiding during selection mode. |
| **Library Toolbar** (`LibraryToolbar` / `LibraryRegularToolbar`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/library/components/LibraryToolbar.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/library/components/LibraryToolbar.vue) | Title with manga count pill (`Pill.kt`), collapsible search input, filter icon with active tint (`colorScheme.active`), and overflow menu (Update library, Update category, Open random). |
| **Library Selection Toolbar** (`LibrarySelectionToolbar`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/library/components/LibraryToolbar.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/library/components/LibraryToolbar.vue#L48-L55) | Action mode app bar: displays selected count, cancel action, "Select all", and "Select inverse" actions. |
| **Category Tabs Bar** (`LibraryTabs`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/library/components/LibraryCategoryTabs.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/library/components/LibraryCategoryTabs.vue) | MD3 Primary Tabs with animated indicator, category visual names ("Default" for ID 0), and badge item counts. |
| **Library Settings Dialog / Sheet** (`LibrarySettingsDialog`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/library/components/LibrarySettingsSheet.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/library/components/LibrarySettingsSheet.vue) | Tabbed modal/sheet: Filter, Sort, Display, and SY/Komikku Group tabs with horizontal touch swipe switching. |
| **Library Display Settings Page** (`DisplayPage`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/library/components/LibraryDisplaySettings.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/library/components/LibraryDisplaySettings.vue) | Display mode chip row, portrait/landscape column sliders, badge toggles (download, unread, local, language, flag icon, source icon, continue reading button), and category tabs options. |
| **Category Manager Screen** (`CategoryScreen` / `CategoriesView`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/library/views/CategoriesView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/library/views/CategoriesView.vue), [`CategoryManagerPanel.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/library/components/CategoryManagerPanel.vue) | Routed page & embeddable panel with drag-and-drop / touch reordering, FAB create, rename, delete, and Komikku hide toggle. |
| **Category Create Dialog** (`CategoryCreateDialog`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/library/components/CategoryCreateDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/library/components/CategoryCreateDialog.vue) | Text input dialog with auto-focus, required validation, and duplicate category name check. |
| **Category Rename Dialog** (`CategoryRenameDialog`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/library/components/CategoryRenameDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/library/components/CategoryRenameDialog.vue) | Prefilled text input dialog with duplicate name check and change detection. |
| **Category Delete Dialog** (`CategoryDeleteDialog`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/library/components/CategoryDeleteDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/library/components/CategoryDeleteDialog.vue) | Confirmation dialog for category deletion. |
| **Change Category Dialog** (`ChangeCategoryDialog`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/library/components/ChangeCategoryDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/library/components/ChangeCategoryDialog.vue) | Multi-manga category assignment modal with tri-state checkboxes (checked = in all selected, indeterminate = in some selected, unchecked = in none). |
| **Delete Library Manga Dialog** (`DeleteLibraryMangaDialog`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/library/components/DeleteLibraryMangaDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/library/components/DeleteLibraryMangaDialog.vue) | Checkbox dialog allowing user to remove selected manga from library and/or delete downloaded chapter files. |
| **Library Bottom Action Menu** (`LibraryBottomActionMenu`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/manga/components/MangaBottomActionMenu.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/manga/components/MangaBottomActionMenu.vue) | Bottom surface with haptic long-press confirmation labels; options: Set categories, Mark as read, Mark as unread, Download dropdown, Delete, and Migrate. |
| **Tag Priority Sorting Screen** (`SortTagScreen` / `SortTagView`) | ➖ N/A | ✅ Full | ✅ Full | [`src/features/settings/views/SortTagView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/SortTagView.vue) | TachiyomiSY/Komikku screen for managing global genre/tag sort priority: add tag modal, delete dialog, Up/Down buttons, and drag-and-drop reordering. |
| **Categories Tri-State Filter Dialog** (`TriStateListDialog`) | ➖ N/A | ➖ N/A | ✅ Full | [`src/core/components/TriStateListDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/core/components/TriStateListDialog.vue) | Komikku feature: dialog in Filter sheet allowing tri-state selection (include / exclude / ignore) across categories. |
| **Global Search Item** (`GlobalSearchItem`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/browse/components/GlobalSearchItem.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/components/GlobalSearchItem.vue) | Appears as first item in pager / empty results to trigger global search across all installed sources. |
| **Source Category Screen** (`SourceCategoryScreen`) | ➖ N/A | ✅ Full | ✅ Full | ❌ Missing | SY/Komikku screen for organizing sources into categories (`eu/kanade/presentation/category/SourceCategoryScreen.kt`). Not present in `mihon-vue`. |
| **Biometric Category Times Screen** (`BiometricTimesScreen`) | ➖ N/A | ➖ N/A | ✅ Full | ❌ Missing | Komikku screen for category biometric unlock time windows. Platform-constrained (Android BiometricPrompt). |

### Table B: Granular Features, Controls & Actions
| Feature / Action | Mihon | TachiyomiSY | Komikku | mihon-vue | Implementation / Gap Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Scaffold & Layout Structure** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | M3 Scaffold with sticky header, `surfaceContainerHigh` bottom bar, and bottom navigation hiding during selection. |
| **Pull to Refresh** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Pull gesture with M3 circular progress indicator (40dp circle, 24dp spinner) disabled during active selection. |
| **Category Tab Header & Counts** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Category tabs with item count pills; title switches to category name when tabs are hidden (`categoryTabs = false`). |
| **Horizontal Swipe Pager** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Smooth swipe track with offscreen pruning (only current ±1 neighbor instantiated), keyboard navigation (Left/Right arrows), and per-category scroll restoration. |
| **Empty Category States** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Contextual empty messages ("No results found", "No match found", "Category is empty") with randomized error faces (`ERROR_FACES`). |
| **Display Mode: Compact Grid** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | 2:3 aspect ratio cover, bottom 33% vertical gradient overlay, 12sp title, badges, and small play button. |
| **Display Mode: Comfortable Grid** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | 2:3 cover with 2-line clamped title below, badges, and large bottom-end play button. |
| **Display Mode: List View** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | 56dp row height, 1:1 square thumbnail (40x40px), 2-line title, badge group, resume button, and fast scroller thumb. |
| **Display Mode: Cover-Only Grid** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | 2:3 cover without title overlay; large bottom-end resume button. |
| **Display Mode: Comfortable Grid (Panorama)** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | Komikku 16:9 widescreen cover aspect ratio in comfortable grid mode (`display="comfortable-panorama"`). |
| **Items Per Row (Columns Slider)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | 0..10 slider (0 = auto 128dp minimum), distinct portrait and landscape preferences. |
| **Filter: Tri-State Downloaded** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Include / Exclude / Ignore states; disabled and forced to 'include' when global `downloadedOnly` is active. |
| **Filter: Tri-State Reading Progress** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Unread, Started, and Completed tri-state filters. |
| **Filter: Tri-State Bookmarked** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Tri-state filter for manga with bookmarked chapters. |
| **Filter: Tri-State Tracked Status** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Dynamically rendered tri-state rows for each logged-in tracker service. |
| **Filter: Tri-State Category Filter** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | Komikku feature: include/exclude categories in Filter sheet via `TriStateListDialog`. |
| **Filter: Show Hidden Categories Toggle** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | Komikku toggle switch in Filter sheet to show/hide hidden categories from tabs and queries. |
| **Sort: Core Options** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Alphabetical, Total chapters, Last read, Last update, Unread count, Latest chapter, Chapter fetch date, Date added, and Random (with refresh icon). |
| **Sort: Ascending / Descending Toggle** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Clicking active sort mode toggles arrow direction (`arrow_upward` / `arrow_downward`). |
| **Sort: Tracker Mean Score** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Sort by average tracker score across logged-in trackers. |
| **Sort: Tag Priority Sorting** | ➖ N/A | ✅ Full | ✅ Full | ✅ Full | TachiyomiSY/Komikku `tagList` sorting mode using user-ordered tags from `SortTagView`. |
| **Dynamic Grouping: Ungrouped** | ➖ N/A | ✅ Full | ✅ Full | ✅ Full | SY/Komikku dynamic grouping: flat list of all library manga in a single "Ungrouped" tab. |
| **Dynamic Grouping: By Source** | ➖ N/A | ✅ Full | ✅ Full | ✅ Full | SY/Komikku dynamic grouping: virtual category tabs per manga source. |
| **Dynamic Grouping: By Status** | ➖ N/A | ✅ Full | ✅ Full | ✅ Full | SY/Komikku dynamic grouping: virtual category tabs by status (Ongoing, Completed, Licensed, Hiatus, Cancelled, Publishing Finished). |
| **Dynamic Grouping: By Track Status** | ➖ N/A | ✅ Full | ✅ Full | ✅ Full | SY/Komikku dynamic grouping: virtual category tabs by tracker status (Reading, Rereading, Plan to read, On hold, Completed, Dropped). |
| **Category Management: Reorder** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Drag-and-drop, touch handle dragging, and Alt+Arrow keyboard shortcuts with server persist via `categoryReorder` API. |
| **Category Management: CRUD Dialogs** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Create with name uniqueness validation, Rename with duplicate check, Delete confirmation dialog. |
| **Category Management: Hide / Unhide** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | Komikku feature: eye toggle icon, strikethrough name decoration, and persistent hidden categories set. |
| **Tag Sorting Screen Actions** | ➖ N/A | ✅ Full | ✅ Full | ✅ Full | Add tag modal with duplicate validation, delete confirmation, Up/Down button ordering, and drag-and-drop reordering. |
| **Card Badge: Unread Count** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Secondary color container with chapter unread count. |
| **Card Badge: Download Count** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Tertiary color container with downloaded chapter count. |
| **Card Badge: Local Manga** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Folder glyph badge in tertiary container for local manga entries. |
| **Card Badge: Source Language** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | 2-letter uppercase source language badge (or "OTHER" for local). |
| **Card Badge: FlagKit Country Flags** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | Komikku `useLangIcon`: renders high-res SVG flag icons for language badges. |
| **Card Badge: Source Favicon / Icon** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | Komikku `sourceBadge`: loads and displays remote source favicon image on top-end cover corner. |
| **Card Continue Reading Button** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Quick resume play button on cover with navigation to next unread chapter or snackbar if none remain. |
| **Batch Selection Mode & Gestures** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | 500ms long-press or right-click to enter selection; range selection between last touched item; select all and invert selection in toolbar. |
| **Batch Action: Change Category** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Opens `ChangeCategoryDialog` with TriStateCheckbox mapping for common vs mixed category memberships. |
| **Batch Action: Mark as Read / Unread** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Batch marks selected titles as read or unread via Suwayomi batch API with snackbar confirmation. |
| **Batch Action: Batch Download** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Batch download dropdown menu: Next 1, 5, 10, Unread, All chapters. |
| **Batch Action: Delete from Library** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Opens `DeleteLibraryMangaDialog` allowing deletion from library and/or downloaded chapter removal. |
| **Batch Action: Migrate Selection** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | `MangaBottomActionMenu.vue` provides migration option; triggers migration wizard handoff with server REST limitations noted. |
| **Toolbar: Library Global Update** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Triggers batch chapter update for all manga with progress bar and failure error collection. |
| **Toolbar: Category Update** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Triggers batch chapter update for titles in the active category with progress bar. |
| **Toolbar: Open Random Entry** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Randomly selects a manga from the active category / library and navigates to its detail view. |

#### Category 1 Delta Summary
- **Frontend-Implementable**: Wire `@migrate` on `<MangaBottomActionMenu>` in `LibraryView.vue` to directly push selected manga IDs into `MigrationConfigView.vue`. Implement `SourceCategoryScreen.vue` and route `/settings/browse/source-categories` for SY source grouping.
- **Backend/Platform-Constrained**: Autonomous background batch migration worker execution on Suwayomi-Server. Biometric category lock windows (`BiometricTimesScreen`) cannot be enforced via standard Web APIs without native OS hardware biometric schedule hooks.

---

## 2. Updates

### Table A: Screens, Modals & Sub-Views
| Screen / Dialog / Sub-View | Mihon | TachiyomiSY | Komikku | mihon-vue (`src/` path) | Notes & Parity Details |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **Updates Feed Screen** (`UpdatesScreen`, `UpdatesView`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/updates/views/UpdatesView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/updates/views/UpdatesView.vue) | Date-ordered feed of recently fetched chapters. Includes fast scroller drag handle, empty state, and client-side title/chapter search. |
| **Updates Filter Dialog** (`UpdatesFilterDialog`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/updates/components/UpdatesFilterDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/updates/components/UpdatesFilterDialog.vue) | Tabbed dialog ("Filter" & "Categories"). Tri-state filters for Downloaded, Unread, Started, Bookmarked; Excluded scanlators switch; Tri-state Category include/exclude list. |
| **Delete Confirmation Dialog** (`UpdatesDeleteConfirmationDialog`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/updates/components/UpdatesDeleteDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/updates/components/UpdatesDeleteDialog.vue) | Material 3 flat alert dialog for bulk chapter deletion. Respects bookmarked chapter protection. |
| **Upcoming Release Calendar** (`UpcomingScreen`, `UpcomingView`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/updates/views/UpcomingView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/updates/views/UpcomingView.vue) | Calendar month grid navigation, event dots per date, date group headers with relative dates, category filters, two-panel responsive tablet layout. |
| **Library Update Errors Screen** (`LibraryUpdateErrorScreen`) | ❌ Missing | ❌ Missing | ✅ Full | [`src/features/updates/views/LibraryUpdateErrorView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/updates/views/LibraryUpdateErrorView.vue) | Komikku-origin screen (`/updates/errors`). Groups errors by message, batch selection, delete/clear, retry chapter fetch, batch migrate handoff, group jump navigation. |
| **New Version / What's New Dialog** (`NewUpdateScreen`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/updates/views/NewUpdateView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/updates/views/NewUpdateView.vue) | Release changelog viewer and update prompt (`/about/update`, `/new-update`). |

### Table B: Granular Features, Controls & Actions
| Feature / Action | Mihon | TachiyomiSY | Komikku | mihon-vue | Implementation / Gap Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Relative Date Grouping** (`relativeDateText`) | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Groups by "Today", "Yesterday", "X days ago" (< 7 days), and short localized date format (identical to `LocalDate.toRelativeString`). |
| **Library Last Updated Header** (`updatesLastUpdatedItem`) | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Italicized subtitle showing relative time elapsed since the newest library update. |
| **Tri-State Downloaded / Unread / Started / Bookmarked Filters** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Complete parity with `updatesView.sq` SQL logic and `UpdatesViewModel.applyFilters` Kotlin predicates. |
| **Filter Excluded Scanlators Switch** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Toggles exclusion of chapters matching manga-specific blacklisted scanlator names. |
| **Category Include / Exclude Filter** | ✅ Full | ✅ Full | 🟡 Partial | ✅ Full | Tri-state cycle (`all` -> `include` -> `exclude`). In Komikku this is omitted from the dialog in favor of global library categories. |
| **Multi-Selection Action Mode** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Triggered by long press; switches app bar to action mode with counter, Select All (`select_all`), Invert Selection (`flip_to_back`), and Cancel (`close`). Supports shift/long-press range selection. |
| **Bottom Action Menu Visibility Guards** (`takeIf`) | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Strict parity with Kotlin `fastAny` / `fastAll` guards: Bookmark / Remove Bookmark, Mark as Read / Unread, Download, Delete. |
| **Pull-to-Refresh Gesture** (`PullRefresh`) | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Touch gesture implemented with visual drag threshold. Due to Suwayomi REST v1 lack of a library update mutation, opens informative stub dialog. |
| **Library Update Progress Banner** (`UpdatingBanner`) | ❌ Missing | ❌ Missing | ✅ Full | ✅ Full | Komikku feature: App-level tertiary progress banner showing animated spinner and percentage progress (`Updating library (X%)`). |
| **Upcoming "To be updated" Queue Toggle** (`toBeUpdated`) | ❌ Missing | ❌ Missing | ✅ Full | ✅ Full | Komikku feature (`KMR.strings.label_to_be_updated`): Toolbar button (`new_releases`) toggles between predictive upcoming releases and overdue/pending update queue. |
| **Swipe Actions on Update Items** (`SwipeableActionsBox`) | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | Komikku feature: Left/right swipe gestures on update rows to mark as read or download. |
| **Collapsible Manga Clusters in Feed** (`UpdatesUiModel.Leader`) | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | Komikku feature: Consecutive chapters from the same manga are grouped under an expandable leader row. |
| **Panorama Cover Support in Updates** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | Komikku feature: Wide cover switch in filter dialog and landscape aspect ratio rendering. |
| **Preserve Reading Position on Update** | ❌ Missing | ✅ Full | 🟡 Partial | ❌ Missing | TachiyomiSY feature (`preserveReadingPosition`): Prevents jump on chapters with alternate uploads or split releases. |
| **Original Manga Title Display** (`ogMangaTitle`) | ❌ Missing | ✅ Full | ❌ Missing | ❌ Missing | TachiyomiSY feature: Shows original title alongside localized title. |

#### Category 2 Delta Summary
- **Frontend-Implementable**: Add touch swipe actions to `UpdatesItemRow.vue` (mark as read / download); collapsible manga chapter clusters (`Leader` item grouping); panorama cover rendering option in the update feed.
- **Backend/Platform-Constrained**: Triggering background server-side library refresh mutations via pull-to-refresh requires backend job triggers (`POST /api/v1/update`). Prediction timestamps are re-derived client-side using `releaseSchedule.ts`.

---

## 3. History

### Table A: Screens, Modals & Sub-Views
| Screen / Dialog / Sub-View | Mihon | TachiyomiSY | Komikku | mihon-vue (`src/` path) | Notes & Parity Details |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **History Main Screen (`HistoryScreen` / `HistoryView`)** | ✅ Full | ✅ Full | ✅ Full | [`src/features/history/views/HistoryView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/history/views/HistoryView.vue) | Full MD3 Scaffold with 64dp sticky `SearchToolbar`, relative date group headers, fast scroller thumb, empty states (`MihonEmptyScreen`), and loading indicator (`Md3CircularProgress`). |
| **History Delete Item Dialog (`HistoryDeleteDialog`)** | ✅ Full | ✅ Full | ✅ Full | [`src/features/history/components/HistoryDeleteDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/history/components/HistoryDeleteDialog.vue) | Exact MD3 AlertDialog (28dp corners, `surface-container-high`, 24dp padding) with "Reset all chapters for this entry" checkbox. Clears chapter read status and lastPageRead via Suwayomi `PATCH /api/v1/manga/{mangaId}/chapter/{chapterIndex}`. |
| **History Clear All Dialog (`HistoryDeleteAllDialog`)** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | UI dialog is 100% pixel-parity MD3 AlertDialog with strings "Remove everything" and "Are you sure? All history will be lost." In native apps it deletes the local SQLite `history` table. In Suwayomi-Server, there is no history table/endpoint; clearing all history would require destructively marking every chapter on the server unread. Shows informative snackbar explaining backend limitation. |
| **History Filter Sheet / Dialog (`HistoryFilterDialog`)** | ➖ N/A | ➖ N/A | ✅ Full | [`src/features/history/components/HistoryFilterDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/history/components/HistoryFilterDialog.vue) | Komikku feature ported using `AdaptiveSettingsSheet.vue` + `TriStateRow.vue` + `Md3Switch.vue`. Controls: "Unfinished manga" (TriState), "Unfinished chapter" (TriState), "Non-library entries" (TriState), and "Panorama cover" (Switch). Persisted to preferences. |
| **History Multi-Select Contextual Toolbar (`HistorySelectionToolbar`)** | ➖ N/A | ➖ N/A | ✅ Full | [`src/features/history/views/HistoryView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/history/views/HistoryView.vue) | Komikku feature ported into `HistoryView.vue`. Switches top app bar in selection mode to display selected item count, cancel/close button, Select All, Invert Selection, and Delete Selected actions. |
| **Batch Delete Confirmation Dialog** | ➖ N/A | ➖ N/A | ✅ Full | [`src/features/history/views/HistoryView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/history/views/HistoryView.vue) | Komikku multi-selection batch deletion dialog: confirms removal of selected entries from history, then resets chapter read progress in batch via Suwayomi REST API. |
| **Duplicate Manga Warning Dialog (`DuplicateMangaDialog`)** | ✅ Full | ✅ Full | ✅ Full | [`src/features/library/components/DuplicateMangaDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/library/components/DuplicateMangaDialog.vue) | Triggered when adding an entry to library from history if duplicate titles/sources already exist in library. Supports Add anyway, Open manga, and Migrate. |
| **Category Selection Dialog on Add (`ChangeCategoryDialog`)** | ✅ Full | ✅ Full | ✅ Full | ❌ Missing | In native apps, quick-adding a non-library manga to favorites from History opens `ChangeCategoryDialog` when user categories exist and no default category is set. In `mihon-vue` (`HistoryView.vue:384`), it adds directly to the default/uncategorized library without prompting. |

### Table B: Granular Features, Controls & Actions
| Feature / Action | Mihon | TachiyomiSY | Komikku | mihon-vue | Implementation / Gap Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Search History (SearchToolbar integration)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Search action transitions top bar to input with Back button, clear/reset button, Esc key listener, and live client filtering. |
| **Relative Date Group Headers** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Implemented via `relativeDateText` in `src/core/utils/dates.ts`: Today, Yesterday, X days ago (<7d), or short localized date. |
| **Vertical Fast Scroller** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | 48dp thumb height, 12dp width, draggable pointer capture with 2-second auto-hide matching Android `VerticalFastScroller`. |
| **Cover Navigation (Open Manga Details)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Clicking cover thumbnail navigates to `/manga/:id`. Broken covers render Mihon's placeholder SVG. |
| **Resume Reading Action (Row Click)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Clicking row resumes unfinished chapter or opens the next unread chapter in reader (`/manga/:id/read/:chapterIndex`); shows "Next chapter not found" snackbar if finished. |
| **Tab Reselect Resumes Last Read Manga** | ✅ Full | ✅ Full | ✅ Full | ❌ Missing | In native apps, tapping the History nav icon while already on History resumes the most recently read manga. Web navigation bar does not trigger `onReselect` resume logic. |
| **Conditional Nav Tab (`showNavHistory`)** | ➖ N/A | ✅ Full | ✅ Full | ✅ Full | Ported from TachiyomiSY/Komikku in `src/app/layouts/DefaultLayout.vue:45`: controlled by `preferences.showNavHistory`. |
| **Unread Dot Indicator on Item** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | Komikku feature ported: 8px primary circular dot before subtitle when `entry.hasUnread` is true. |
| **Page Progress Indicator ("• Page X")** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | Komikku feature ported: subtitle displays `• Page ${lastPageRead + 1}` for in-progress chapters. |
| **Dimmed Text Alpha for Read Entries** | ➖ N/A | ➖ N/A | ✅ Full | ❌ Missing | Komikku dims title and subtitle with `DISABLED_ALPHA` (0.38) when `history.read` is true. In `mihon-vue`, text opacity remains 1.0. |
| **Panorama / Wide Cover Support** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | Komikku feature ported: toggled via `HistoryFilterDialog`; applies `history-item__cover--wide` (142px width vs 53px). |
| **TriState History Filtering** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | Komikku feature ported: Unfinished manga, Unfinished chapter, and Non-library filters apply reactively. Filter icon tints with theme accent color when active. |
| **Multi-Select: Long-Press Activation** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | 500ms pointerdown timer or contextmenu activates selection mode and checks the item. |
| **Multi-Select: Contiguous Range Selection** | ➖ N/A | ➖ N/A | ✅ Full | ❌ Missing | Komikku calculates `selectedPositions` to select in-between items on secondary long-press. In `mihon-vue`, long-press only toggles that individual item. |
| **Multi-Select: Select All & Invert** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | Contextual toolbar provides Select All (`select_all`) and Invert Selection (`flip_to_back`). |
| **Multi-Select: Batch Delete Chapters** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | Batch delete resets `read: false` and `lastPageRead: 0` for all selected entries via concurrent API PATCH calls. |
| **Toolbar Checklist Button for Multi-Select** | ➖ N/A | ➖ N/A | ✅ Full | ❌ Missing | Komikku provides an explicit checklist icon button in the normal toolbar to toggle selection mode; `mihon-vue` enters selection mode solely through item long-press. |
| **Single Item Delete from History** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Delete icon button on row opens `HistoryDeleteDialog`. |
| **Quick Add to Library (Favorite Icon)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Favorite icon displayed on non-library rows; invokes `requestFavorite()` and checks for duplicates. |
| **Suwayomi Backend History Derivation** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Suwayomi REST API lacks `/api/v1/history`. `mihon-vue` derives history client-side by polling library manga chapters and sorting by `lastReadAt` (up to 150 candidates with 6 concurrent workers). |

#### Category 3 Delta Summary
- **Frontend-Implementable**: Invoke `ChangeCategoryDialog` in `HistoryView.vue:requestFavorite` when user categories exist and no default category is configured. Add toolbar checklist button for multi-selection mode. Implement contiguous range selection. Apply `opacity: 0.38` dimming for finished chapter rows.
- **Backend/Platform-Constrained**: Suwayomi-Server REST API (v1 / v2.4.x) lacks a dedicated `/api/v1/history` endpoint or standalone history database table. `mihon-vue` dynamically derives history from chapter read timestamps. Clearing all history without marking all chapters unread is impossible on Suwayomi backend.

---

## 4. Browse

### Table A: Screens, Modals & Sub-Views
| Screen / Dialog / Sub-View | Mihon | TachiyomiSY | Komikku | mihon-vue (`src/` path) | Notes & Parity Details |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **Sources Tab / Screen** (`SourcesScreen`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/browse/views/BrowseView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/views/BrowseView.vue) | Grouped by Last Used, Pinned, and Languages; icon with fallback/local glyphs, language tag, "Latest" quick button, pin toggle, empty & loading states. |
| **Source Options Dialog** (`SourceOptionsDialog`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/browse/components/SourceOptionsDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/components/SourceOptionsDialog.vue) | Long-press dialog from Sources list. Pin/Unpin supported. "Disable" provides an informative notice as Suwayomi-Server manages enabled extensions on the backend. |
| **Source Categories Dialog** (`SourceCategoriesDialog`) | ➖ N/A | ✅ Full | ✅ Full | ❌ Missing | Fork-specific dialog to organize sources into custom categories. Backend platform constrained (Suwayomi has no source category entity). |
| **Sources Filter Screen** (`SourcesFilterScreen`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/browse/views/SourcesFilterView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/views/SourcesFilterView.vue) | Filter enabled languages and individual sources. Persisted to browser storage; full MD3 list layout, animated items, search/empty states. |
| **Source Catalogue Screen** (`BrowseSourceScreen` / `SourceView`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/browse/views/SourceView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/views/SourceView.vue) | Catalogue browsing for a single source. Supports Popular, Latest, and Filter/Search modes, Compact/Comfortable/List display modes, infinite pagination, missing source stub resolution, and web view. |
| **Source Filter Sheet / Dialog** (`SourceFilterDialog`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/browse/components/SourceFilterDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/components/SourceFilterDialog.vue)<br>[`src/features/browse/components/SourceFilterItems.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/components/SourceFilterItems.vue) | Adaptive sheet (bottom sheet on mobile, dialog on desktop) with Reset, Filter buttons, all dynamic form controls, and saved search chips integration. |
| **Saved Searches Dialogs** (`SavedSearchCreateDialog`, `SavedSearchDeleteDialog`) | ➖ N/A | ✅ Full | ✅ Full | [`src/features/browse/components/SourceFilterDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/components/SourceFilterDialog.vue)<br>[`src/features/browse/stores/savedSearches.ts`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/stores/savedSearches.ts) | Save current query/filter state with custom name, chip list in filter sheet, rename dialog, delete dialog, and context menu ("Add to Feed"). |
| **Source Preferences Screen** (`SourcePreferencesScreen`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/browse/views/SourcePreferencesView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/views/SourcePreferencesView.vue)<br>[`src/core/api/sourcePreferences.ts`](file:///c:/Users/dail45/Desktop/mihon-vue/src/core/api/sourcePreferences.ts) | Per-source settings supporting Switch, CheckBox, List (radio dialog), MultiSelectList (checkbox dialog), EditText dialog, Info widget, and Category headers. |
| **Feed Tab / Screen** (`FeedScreen` / `FeedTab`) | ➖ N/A | ✅ Full | ✅ Full | [`src/features/browse/views/FeedView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/views/FeedView.vue)<br>[`src/features/browse/stores/feed.ts`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/stores/feed.ts) | Multi-source feed tab with horizontal card carousels for Popular, Latest, and Saved Searches across sources, per-lane loading/error states, and click-through. |
| **Per-Source Feed Screen** (`SourceFeedScreen`) | ➖ N/A | ✅ Full | ✅ Full | ❌ Missing | SY/Komikku alternative source navigation (`useNewSourceNavigation`) rendering multi-lane feed for a single source instead of catalogue grid. |
| **Feed Order Screen** (`FeedOrderScreen`) | ➖ N/A | ➖ N/A | ✅ Full | [`src/features/browse/components/FeedOrderScreen.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/components/FeedOrderScreen.vue) | Komikku drag-and-drop feed lane reordering, HTML5 drag handles, arrow up/down fallback buttons, feed deletion with confirmation dialog. |
| **Feed Add Dialog** (`FeedAddDialog`) | ➖ N/A | 🟡 Partial | ✅ Full | [`src/features/browse/components/FeedAddDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/components/FeedAddDialog.vue) | Modal dialog allowing user to choose source, feed type (Popular, Latest, Saved Search), and custom title to append to feed. |
| **Global Search Screen** (`GlobalSearchScreen`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/browse/views/GlobalSearchView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/views/GlobalSearchView.vue)<br>[`src/features/browse/components/GlobalSearchToolbar.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/components/GlobalSearchToolbar.vue) | Multi-source search with 5-worker parallel pool, LinearProgressIndicator, Komikku 3-way cycle filter (`PinnedOnly` -> `Unpinned` -> `All`), `onlyShowHasResults` filter chip, and bulk favorite support. |
| **Extensions Tab / Screen** (`ExtensionsScreen`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/browse/components/BrowseExtensionsTab.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/components/BrowseExtensionsTab.vue)<br>[`src/core/api/extensions.ts`](file:///c:/Users/dail45/Desktop/mihon-vue/src/core/api/extensions.ts) | 4 groupings: Updates, Installed, Untrusted, Available. Search filter, pills (NSFW, 18+, Obsolete), fast scroller. Install/Update/Uninstall actions are informative stubs (Suwayomi REST API is read-only). |
| **Extension Details Screen** (`ExtensionDetailsScreen`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/browse/views/ExtensionDetailsView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/views/ExtensionDetailsView.vue) | Displays version, package name, store name, warning pills, list of extension sources with toggles, debug info copy. Uninstall/clear cookies stubbed with server limitation notice. |
| **Extension Filter Screen** (`ExtensionFilterScreen`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/browse/views/ExtensionFilterView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/views/ExtensionFilterView.vue) | Filter available extensions by language, switches persist to local storage. |
| **Extension Stores Screen / Panel** (`ExtensionStoresScreen`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/browse/views/ExtensionStoresView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/views/ExtensionStoresView.vue)<br>[`src/features/browse/components/ExtensionStoresPanel.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/components/ExtensionStoresPanel.vue) | Lists repository cards derived from catalogue with external website links and copy URL. Add/delete store dialogs present in UI (read-only backend constraint). |
| **Extension Trust / Not Loaded Dialogs** (`ExtensionTrustDialog`, `ExtensionNotLoadedDialog`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/browse/components/ExtensionTrustDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/components/ExtensionTrustDialog.vue)<br>[`src/features/browse/components/ExtensionNotLoadedDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/components/ExtensionNotLoadedDialog.vue) | Trust confirmation dialog and explanation dialog for untrusted or not-loaded extensions. |
| **Bulk Favorite Mode** (`BulkFavoriteScreenModel`, `BulkFavoriteDialogs`) | ➖ N/A | ➖ N/A | ✅ Full | [`src/features/browse/composables/useBulkFavorite.ts`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/composables/useBulkFavorite.ts)<br>[`src/features/browse/components/BulkSelectionToolbar.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/components/BulkSelectionToolbar.vue) | Bulk selection toolbar and batch favoriting in Catalogue, Global Search, and Feed. Supports multi-selection, select all, invert, duplicate resolution, category assignment, concurrency-limited API additions. |
| **Migrate Source List** (`MigrateSourceScreen` / `MigrateSourceTab`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/migration/components/MigrateSourceList.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/migration/components/MigrateSourceList.vue) | Lists sources holding library manga with favorite counts, sorting (alphabetical vs count) and direction toggle, stub source ("Not installed") indicator, long-press copy source ID. |
| **Migration Config Screen & Sheet** (`MigrationConfigScreen`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/migration/views/MigrationConfigView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/migration/views/MigrationConfigView.vue) | Selected vs Available source lists, drag-and-drop order, select all/none/pinned/enabled, scroll-responsive FAB, AdaptiveSheet with migration flags (Chapters, Categories, Custom cover, Notes) and preference switches. |
| **Migration List Screen** (`MigrationListScreen`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/migration/views/MigrationListView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/migration/views/MigrationListView.vue) | Batch migration screen with source manga vs alternative result cards, automated search runner, manual search action, overflow menu (Migrate now, Copy now, Don't migrate), and Copy/Migrate actions. |
| **Migrate Search Screen** (`MigrateSearchScreen`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/migration/views/MigrateSearchView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/migration/views/MigrateSearchView.vue) | Single-entry destination manga search across migration sources. Marks source entry ("● "), shows per-source result rows, and triggers `MigrateMangaDialog`. |
| **Migrate Manga Dialog** (`MigrateMangaDialog`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/migration/components/MigrateMangaDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/migration/components/MigrateMangaDialog.vue) | MD3 dialog with plural title ("Migrate 1 entry?" / "Copy 1 entry?"), skipped entries notice, and Copy / Migrate / Cancel actions. |
| **Migration Progress & Exit Dialogs** (`MigrationProgressDialog`, `MigrationExitDialog`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/migration/components/MigrationProgressDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/migration/components/MigrationProgressDialog.vue)<br>[`src/features/migration/components/MigrationExitDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/migration/components/MigrationExitDialog.vue) | Exit confirmation on route leave / aborting migration, and progress dialog displaying live step status and progress bar. |

### Table B: Granular Features, Controls & Actions
| Feature / Action | Mihon | TachiyomiSY | Komikku | mihon-vue | Implementation / Gap Notes |
| :--- | :---: | :---: | :---: | :---: | --- |
| **Sources: Section Grouping** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Grouped by Last Used, Pinned, and Language alphabetical sections. |
| **Sources: Item Badges & Buttons** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Source icon, name, language tag, "Latest" quick button, and Pin/Unpin icon button. |
| **Sources: Long-Press Options Dialog** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Mihon options (Pin/Unpin, Disable notice). SY/Komikku source categorization and data saver toggles not implemented. |
| **Sources Filter: Language Switches** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Toggle display of language groups; persisted in localStorage. |
| **Sources Filter: Source Checkboxes** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Toggle individual source visibility; persisted in localStorage. |
| **Sources Filter: Bulk Toggle Sources** | ➖ N/A | ✅ Full | ✅ Full | ❌ Missing | SY/Komikku `onClickSources` header toggle to turn all sources in a language on/off in one click. |
| **Sources Filter: Flag Emojis & Sticky Headers** | ➖ N/A | ➖ N/A | ✅ Full | ❌ Missing | Komikku country flag emojis on language labels and sticky group headers. |
| **Catalogue: Display Modes** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Comfortable Grid, Compact Grid, List view mode selector; persists in preferences. |
| **Catalogue: Listing Chips** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Horizontally scrollable chips: Popular (favorite icon), Latest (verified icon), Filter (filter_list icon). |
| **Catalogue: Search Toolbar & Navigation** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Search input with clear button, query debouncing, Esc/Back resets search mode to previous listing. |
| **Catalogue: Missing / Stub Source** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | `MissingSourceScreen` with reverse name/language identity lookup from extension catalogue. |
| **Catalogue: Long-Press Item Actions** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Add/remove from library, duplicate check dialog, change category dialog, migrate action. |
| **Catalogue: Overflow Menu** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Open in WebView (dialog/tab), Source settings (`SourcePreferencesView`), and Help guide link. |
| **Filter Sheet: Dynamic Form Controls** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Complete support for Tri-state (0/1/2), Checkbox, Select (dropdown), Text, Group (CollapsibleBox), Sort (direction arrow), Header, and Separator. |
| **Filter Sheet: Reset & Apply** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Reset to source default filters and Apply filter buttons with sticky sheet header. |
| **Saved Searches: Save Current Filters** | ➖ N/A | ✅ Full | ✅ Full | ✅ Full | Bookmark save icon in filter sheet header, name prompt modal, saved search store. |
| **Saved Searches: Chips & Application** | ➖ N/A | ✅ Full | ✅ Full | ✅ Full | Saved search chips in filter sheet; clicking applies search query and filter states. |
| **Saved Searches: Context Menu & Management** | ➖ N/A | ✅ Full | ✅ Full | ✅ Full | Long-press / context menu to Rename, Delete (with confirmation), or Add to Feed. |
| **Feed: Multi-Source Lanes** | ➖ N/A | ✅ Full | ✅ Full | ✅ Full | Horizontal manga card lanes for Popular, Latest, and Saved Searches across sources. |
| **Feed: Add Lane Dialog** | ➖ N/A | 🟡 Partial | ✅ Full | ✅ Full | `FeedAddDialog` to pick source, feed type, and saved search. |
| **Feed: Drag-and-Drop Reorder** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | `FeedOrderScreen` with HTML5 drag handles, arrow up/down fallback buttons, and lane deletion. |
| **Feed: Per-Lane Loading & Retry** | ➖ N/A | ✅ Full | ✅ Full | ✅ Full | Individual lane loading spinner and error card with retry button. |
| **Per-Source Feed View** | ➖ N/A | ✅ Full | ✅ Full | ❌ Missing | Dedicated `SourceFeedScreen` when opening a source (instead of catalogue grid). |
| **Global Search: Parallel Execution** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | 5-worker concurrent pool matching Mihon's `limitedParallelism(5)`. |
| **Global Search: Progress Tracking** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | MD3 `LinearProgressIndicator` tracking completed vs total sources. |
| **Global Search: Pinned Filter Cycle** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | Komikku 3-way cycle filter button (`PinnedOnly` -> `Unpinned` -> `All`). |
| **Global Search: "Has Results" Filter** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Filter chip hiding sources with no matching manga; persisted in preferences. |
| **Global Search: Single Source Deep Link** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Deep link support (`?source=<id>` or `?q=...`) to search a specific source directly. |
| **Bulk Favorite: Multi-Select Mode** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | Card selection checkmark overlays, selected counter, and selection mode toggle. |
| **Bulk Favorite: Select All & Invert** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | Select all items in current view or reverse selection. |
| **Bulk Favorite: Duplicate Pre-Check** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | Duplicate detection against library with Prompt, Allow All, Skip, Skip All options. |
| **Bulk Favorite: Category Assignment** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | Tri-state category assignment dialog and concurrent library additions via REST/GraphQL. |
| **Extensions: 4 Section Categorization** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Updates, Installed, Untrusted, Available sections with counts and group headers. |
| **Extensions: Search & Filter** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Debounced search query filtering across name and package identifier. |
| **Extensions: Metadata Pills** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | NSFW, 18+, Obsolete, Redundant, Private, and Repository pills. |
| **Extensions: Update All Action** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Button visible in header when updates exist; action shows platform limitation notice. |
| **Extensions: Install / Update / Uninstall** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Buttons rendered in MD3 style; informative notice that APK management is server-side. |
| **Extensions: Trust Untrusted Extension** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | `ExtensionTrustDialog` confirms trusting untrusted repositories/extensions. |
| **Extension Details: Package Info & Metrics** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Version, package name, store name, warning pills, and copy debug info to clipboard. |
| **Extension Details: Source Switch Toggles** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Individual source enable/disable switches, Enable All, Disable All overflow actions. |
| **Extension Stores: Card List & Repos** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Displays stores derived from extension catalogue; website links, copy index URL; Add/delete store dialogs present in UI (read-only backend constraint). |
| **Migration: Favorite Counts & Stubs** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Lists sources holding library manga with counts, badges, and stub ("Not installed") markers. |
| **Migration: Sorting & Direction** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Alphabetical vs Total count sorting, ascending/descending toggle. |
| **Migration: Config & Reordering** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Selected vs Available sources, drag-and-drop reorder, Select All / None / Pinned / Enabled. |
| **Migration: Flags Sheet** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | AdaptiveSheet with Chapters, Categories, Custom cover, Notes chips, and preference switches. |
| **Migration: Single-Entry Smart Search** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Direct navigation to `MigrateSearchView` (or `MigrationListView` with smart search preference). |
| **Migration: Bulk Batch Migration** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Multi-entry automated search runner matching alternatives with chapter count and confidence. |
| **Migration: Transactional Engine & Rollback** | ➖ N/A | ➖ N/A | ➖ N/A | ✅ Full | `useMigrationOrchestrator` client-side transactional migration (library addition -> chapter progress sync via GraphQL batch -> category transfer -> notes copy -> source removal) with automatic rollback on error. |
| **Source Preferences: Dynamic UI Widgets** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Switch, Checkbox, List (radio dialog), MultiSelectList (checkbox dialog), EditText dialog, Info widget, and Category headers. |

#### Category 4 Delta Summary
- **Frontend-Implementable**: Sources filter language group bulk toggle (`onClickSources`); Komikku flag emojis on language labels and sticky group headers; Per-source feed screen (`SourceFeedScreen`).
- **Backend/Platform-Constrained**: Suwayomi-Server REST API is a headless daemon with no write endpoints for installing/updating Android APK extensions; repo store URLs and source categories cannot be persisted to server database.

---

## 5. Manga Details (Chapters, Merging & Tracking)

### Table A: Screens, Modals & Sub-Views
| Screen / Dialog / Sub-View | Mihon | TachiyomiSY | Komikku | mihon-vue (`src/` path) | Notes & Parity Details |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **Manga Details Main Screen** | ✅ Full | ✅ Full | ✅ Full | [`src/features/manga/views/MangaView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/manga/views/MangaView.vue) | Complete two-panel large tablet layout (`LargeImpl`) & phone layout, cover backdrop blur, sticky/collapsible toolbar, hero info header, action row, description, tags, suggestions row, chapter header, and chapter virtualized list. |
| **Manga Cover Viewer Dialog** | ✅ Full | ✅ Full | ✅ Full | [`src/features/manga/components/MangaCoverDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/manga/components/MangaCoverDialog.vue) | Exact port of `MangaCoverDialog.kt`: full-screen dialog, transparent scaffold, bottom ActionPills with Close, Share (Web Share API), Save (blob download), Edit/Delete dropdown menu, double-click zoom & drag-to-pan. |
| **Chapter Settings Sheet / Dialog** | ✅ Full | ✅ Full | ✅ Full | [`src/features/manga/components/ChapterSettingsSheet.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/manga/components/ChapterSettingsSheet.vue) | Exact port of `ChapterSettingsDialog.kt`: TabbedDialog with 3 tabs (Filter, Sort, Display), overflow menu ("Set as default", "Reset"), TriState items, and nested `SetAsDefaultDialog`. |
| **Scanlator Filter Dialog** | ✅ Full | ✅ Full | ✅ Full | [`src/features/manga/components/ScanlatorFilterDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/manga/components/ScanlatorFilterDialog.vue) | Exact port of `ScanlatorFilterDialog.kt`: MD3 AlertDialog with scanlator list, exclusion checkboxes, scroll edge dividers, "Select all" / "Reset", and "OK" / "Cancel". |
| **Manga Notes Screen** | ✅ Full | ✅ Full | ✅ Full | [`src/features/manga/views/MangaNotesView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/manga/views/MangaNotesView.vue) | Exact port of `MangaNotesScreen.kt` and `MangaNotesTextArea.kt`: TopAppBar with marquee title, 5 rich-text format buttons (bold, italic, underline, unordered/ordered lists), character counter, 250ms debounce autosave. |
| **Metadata Editor Dialog** | ❌ Missing | ✅ Full | ✅ Full | [`src/features/manga/components/EditMangaDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/manga/components/EditMangaDialog.vue) | Exact port of `EditMangaDialog.kt` from TachiyomiSY/Komikku: editing title, author, artist, cover URL, description, status, tags, reset individual/all fields, and Tracker Autofill. |
| **Merged Manga Settings Dialog** | ❌ Missing | ✅ Full | ✅ Full | [`src/features/manga/components/EditMergedSettingsDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/manga/components/EditMergedSettingsDialog.vue) | Exact port of `EditMergedSettingsDialog.kt` from TachiyomiSY/Komikku: deduplication mode selection, designating Info Manga, drag/button priority reordering, toggling downloads/updates per source, adding from library. |
| **Related Manga / Suggestions Screen** | ❌ Missing | 🟡 Partial | ✅ Full | [`src/features/manga/views/RelatedMangasView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/manga/views/RelatedMangasView.vue) | Exact port of Komikku's `RelatedMangasScreen.kt`: grouped relations (Sequel, Prequel, Spin-off) and recommendations fetched via AniList GraphQL, matching library manga or leading to global search. |
| **Page Preview Screen** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | Not implemented in web client. TachiyomiSY/Komikku `PagePreviewScreen.kt` requires backend `PagePreviewSource` extension hooks, which Suwayomi-Server does not expose. |
| **Tracker Info Sheet / Dialog** | ✅ Full | ✅ Full | ✅ Full | [`src/features/trackers/components/TrackInfoDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/trackers/components/TrackInfoDialog.vue) | Exact port of `TrackInfoDialogHome.kt`: 460dp adaptive sheet with bound & unbound tracker cards, brand logos/badges, private tracking indicator, status/chapter/score/dates, overflow menu, and unbind confirmation. |
| **Tracker Search Screen / Dialog** | ✅ Full | ✅ Full | ✅ Full | [`src/features/trackers/views/TrackerSearchView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/trackers/views/TrackerSearchView.vue) | Port of `TrackerSearch.kt`: queries remote tracker by title, cards with 2:3 cover, type, publishing status, score, start date, and summary text. |
| **Tracker Login Dialog / View** | ✅ Full | ✅ Full | ✅ Full | [`src/features/trackers/views/TrackerLoginView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/trackers/views/TrackerLoginView.vue), [`TrackingLoginDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/trackers/components/TrackingLoginDialog.vue) | Credential login dialog (username/password) and OAuth external URL authentication flows. |
| **Tracker Wheel & Date Selectors** | ✅ Full | ✅ Full | ✅ Full | [`src/features/trackers/components/TrackInfoSelectors.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/trackers/components/TrackInfoSelectors.vue) | Ports of `TrackInfoDialogSelector.kt`: Status selector modal, `TrackNumberWheelPicker` (3-row scrolling wheel), `TrackScoreWheelPicker` (scoring formats), and `TrackDatePicker`. |
| **Change Category Dialog** | ✅ Full | ✅ Full | ✅ Full | [`src/features/library/components/ChangeCategoryDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/library/components/ChangeCategoryDialog.vue) | Multiselect category dialog opened on long-clicking "In library" or from toolbar action menu. |
| **Set Custom Update Interval Dialog** | ✅ Full | ✅ Full | ✅ Full | [`src/features/manga/components/SetIntervalDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/manga/components/SetIntervalDialog.vue) | Dialog to configure smart update interval in days for library manga. |
| **Delete Chapters Dialog** | ✅ Full | ✅ Full | ✅ Full | [`src/features/manga/components/DeleteChaptersDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/manga/components/DeleteChaptersDialog.vue) | MD3 confirmation dialog when deleting downloaded chapters during batch action mode. |
| **Remove Manga Dialog** | ✅ Full | ✅ Full | ✅ Full | [`src/features/library/components/RemoveMangaDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/library/components/RemoveMangaDialog.vue) | Confirmation modal to remove manga from library with option to delete downloaded chapters. |
| **Duplicate Manga Warning Dialog** | ✅ Full | ✅ Full | ✅ Full | [`src/features/library/components/DuplicateMangaDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/library/components/DuplicateMangaDialog.vue) | Shown when adding manga that already exists in library under a different source or title. |
| **Dynamic Palette Debug Screen** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | Komikku's `PaletteScreen.kt` displays theme palette swatches derived from cover seed color. In `mihon-vue`, dominant color is applied dynamically via CSS variables, but no standalone debug screen is provided. |

### Table B: Granular Features, Controls & Actions
| Feature / Action | Mihon | TachiyomiSY | Komikku | mihon-vue | Implementation / Gap Notes |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **Cover Art Display & Blurred Backdrop** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | 2:3 book cover display with blurred cover image backdrop (8px blur, 20% opacity, gradient fade). |
| **Komikku Panorama Cover** | ❌ Missing | ❌ Missing | ✅ Full | ✅ Full | Configurable `usePanoramaCover` setting: dynamically renders 16:9 widescreen panorama cover when aspect ratio <= 0.75. |
| **Komikku Top-Align Cover** | ❌ Missing | ❌ Missing | ✅ Full | ✅ Full | Configurable `topAlignCover` setting: aligns cover to top of header rather than vertical centering. |
| **Cover Dynamic Palette Theming** | ❌ Missing | ❌ Missing | ✅ Full | ✅ Full | Extracted dominant cover color via `useCoverDominantColor` and injected into container CSS variables. |
| **Cover Viewer: Zoom & Pan** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Double-click toggle between 1x and 2.5x zoom, pointer dragging when zoomed in, Esc/click dismissal. |
| **Cover Viewer: Save & Share** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Save triggers direct browser blob download; Share utilizes native `navigator.share` with fallback. |
| **Cover Viewer: Edit / Delete Cover** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Dropdown menu present; custom covers supported via metadata override URL, but Suwayomi-Server REST has no custom cover binary upload endpoint. |
| **Manga Info: Title, Author, Artist** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Displays title, author, and artist (artist cleanly hidden if identical to author). |
| **Manga Info: Source & Status Icons** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Dot separator text with status icon (schedule, done_all, attach_money, block, paused) and localized status string. |
| **Manga Info: Expandable Synopsis** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Collapsed summary truncates with caret icon; clicking toggles full expansion with smooth animation. |
| **Standard Genre Chips** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | SuggestionChip styling: horizontal scroll row when collapsed, wrapped FlowRow when expanded. |
| **Namespaced Tags (SY/Komikku)** | ❌ Missing | ✅ Full | ✅ Full | ✅ Full | Parses `namespace:tag` (artist, character, group, parody, female, male, etc.) into distinct tonal container chips with dark/AMOLED theme styling. |
| **Namespaced Tags: Search & Copy** | ❌ Missing | ✅ Full | ✅ Full | ✅ Full | Clicking chip executes global search (`src/browse/global-search`); long-press copies full tag to clipboard with snackbar feedback. |
| **Local Metadata Override Badges** | ❌ Missing | ✅ Full | ✅ Full | ✅ Full | Small pencil icon badges indicating when title, author, artist, cover, description, or status have been customized. |
| **Metadata Editor: Form Fields** | ❌ Missing | ✅ Full | ✅ Full | ✅ Full | Edit title, author, artist, cover URL, description, status (Default, Ongoing, Completed, Licensed, Finished, Cancelled, Hiatus). |
| **Metadata Editor: Tag Management** | ❌ Missing | ✅ Full | ✅ Full | ✅ Full | Closable tag chips with comma-separated batch tag entry dialog. |
| **Metadata Editor: Tracker Autofill** | ❌ Missing | ✅ Full | ✅ Full | ✅ Full | Queries bound trackers (AniList, MAL, Kitsu) and populates title, authors, artists, cover, and description. |
| **Metadata Editor: Reset Overrides** | ❌ Missing | ✅ Full | ✅ Full | ✅ Full | Per-field revert button to restore source value (`ogTitle`, etc.) plus header overflow action to "Reset all". |
| **Personal Manga Notes Editor** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Full-screen rich text editor with bold, italic, underline, bullet list, ordered list, character counter, and 250ms debounce autosave. |
| **Personal Manga Notes Embedding** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Rendered Markdown card placed above the synopsis with an "Edit notes" button. |
| **Merged Manga: Deduplication Modes** | ❌ Missing | ✅ Full | ✅ Full | ✅ Full | Deduplication options: Priority (drag order) and Chapter Number sorting. |
| **Merged Manga: Designate Info Manga** | ❌ Missing | ✅ Full | ✅ Full | ✅ Full | Radio option to select which merged source provides cover, title, author, and description metadata. |
| **Merged Manga: Priority Reordering** | ❌ Missing | ✅ Full | ✅ Full | ✅ Full | HTML5 drag-and-drop handles and fallback move up / move down buttons. |
| **Merged Manga: Per-Source Toggles** | ❌ Missing | ✅ Full | ✅ Full | ✅ Full | Individual toggles for Download New Chapters and Fetch Chapter Updates. |
| **Merged Manga: Add & Remove Sources** | ❌ Missing | ✅ Full | ✅ Full | ✅ Full | Search library manga dialog to add secondary merged sources; individual delete and unmerge all options. |
| **Page Previews (Grid / Carousel)** | ❌ Missing | ✅ Full | ✅ Full | ❌ Missing | Not supported by Suwayomi-Server REST API (requires Kotlin source `PagePreviewSource` interface). |
| **Related Manga: Recommendations Row** | ❌ Missing | 🟡 Partial | ✅ Full | ✅ Full | Horizontal carousel of cards with cover (2:3), in-library heart badge, relation badge, and title. |
| **Related Manga: Full Suggestions View** | ❌ Missing | 🟡 Partial | ✅ Full | ✅ Full | Categorized tabs/sections (Relations, Recommendations, Library Matches) with search fallback. |
| **Chapter List: Ordering & Display Format** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Formatted chapter title/number, relative upload date (`relativeDateText`), scanlator string, and read progress. |
| **Chapter List: Sorting Options** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Sort by Source index, Chapter number, Upload date, Alphabetical; Ascending / Descending toggle. |
| **Chapter List: Display Mode** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Toggle between Source title (`CHAPTER_DISPLAY_NAME`) and Chapter number (`CHAPTER_DISPLAY_NUMBER`). |
| **Chapter List: TriState Filters** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | TriState checkboxes for Downloaded (disabled if global Downloaded-only active), Unread, and Bookmarked. |
| **Chapter List: Scanlator Filter** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Exclude specific scanlator groups via `ScanlatorFilterDialog`; active state amber icon tint. |
| **Chapter List: Set as Default & Reset** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Save current sorting/filtering as default; option to apply to all library manga; reset to global defaults. |
| **Chapter List: Missing Sequence Warning** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Banner indicating count of missing chapters based on non-consecutive chapter numbering sequence. |
| **Chapter List: Swipe Actions** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Touch swipeable actions box: configurable swipe-to-start (toggle read) and swipe-to-end (toggle bookmark/download). |
| **Chapter List: Download Indicators** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Download state indicator: Not downloaded, Queued, Downloading spinner, Downloaded checkmark. |
| **Resume / Start Reading FAB** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Extended Floating Action Button at bottom right: "Start" for new manga, "Resume" for in-progress manga. |
| **Chapter Multi-Select Action Mode** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Long-press chapter row to enter action mode: header with selected count, Select all, Invert selection, Cancel. |
| **Batch Operation: Mark Read / Unread** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Batch mark selected chapters as read or unread via Suwayomi batch API (`/api/v1/chapter/batch`). |
| **Batch Operation: Mark Previous Read** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Mark all previous chronological chapters as read. |
| **Batch Operation: Bookmark / Unbookmark**| ✅ Full | ✅ Full | ✅ Full | ✅ Full | Toggle bookmark status for all selected chapters in one batch call. |
| **Batch Operation: Download Selected** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Enqueue selected chapters to Suwayomi download queue. |
| **Batch Operation: Delete Downloads** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Delete selected chapter downloads with confirmation dialog. |
| **Tracker Sheet: Service Integration** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Supports MyAnimeList, AniList, Kitsu, MangaUpdates, Shikimori, Bangumi, and Komga via GraphQL endpoints. |
| **Tracker Sheet: Status Selector** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Standard tracking statuses: Plan to read, Reading, Completed, On hold, Dropped, Rereading. |
| **Tracker Sheet: Chapter Wheel Picker** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | 3-row wheel number picker for sync of last chapter read up to total chapters. |
| **Tracker Sheet: Score Wheel Picker** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Formatted score pickers matching tracker preferences (10-point, 100-point, 5-star). |
| **Tracker Sheet: Date Selectors** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Start date and finish date pickers with calendar date picker dialog. |
| **Tracker Sheet: Private Tracking** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Private tracking toggle for trackers supporting privacy settings (AniList). |
| **Tracker Sheet: Unbind / Remove** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Unbinds remote tracker with confirmation dialog. |
| **Tracker Search: Remote Query** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Search remote tracker catalog with title, synopsis, status, score, cover thumbnail, and binding confirmation. |
| **Tracker Auth: Login & OAuth** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Credential login dialog (username/password) and OAuth URL redirect. |
| **Tracker Auto-Sync Progress** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | When opening manga, detects higher chapter read on remote trackers and syncs local chapter progress. |
| **Tracker Auto-Track on Library Add** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Preference to automatically open tracking dialog when an entry is added to the library. |

#### Category 5 Delta Summary
- **Frontend-Implementable**: Standalone dominant color palette visualizer screen (`PaletteScreen`).
- **Backend/Platform-Constrained**: `PagePreviewScreen` requires source extensions implementing Kotlin `PagePreviewSource`, which Suwayomi-Server REST API does not expose; server lacks custom cover binary upload endpoints.

---

## 6. Reader

### Table A: Screens, Modals & Sub-Views
| Screen / Dialog / Sub-View | Mihon | TachiyomiSY | Komikku | mihon-vue (`src/` path) | Notes & Parity Details |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **Reader Viewport & Base Shell** | ✅ Full | ✅ Full | ✅ Full | [`src/features/reader/views/ReaderView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/reader/views/ReaderView.vue) | Fullscreen reader canvas, gesture listeners, keyboard routing, background theme classes (`reader-background-black/gray/paper/white`), cover-based dynamic color scheme integration. |
| **Reader Top Bar** | ✅ Full | ✅ Full | ✅ Full | [`src/features/reader/components/ReaderTopBar.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/reader/components/ReaderTopBar.vue) | Top app bar with back navigation, manga title, subtitle with marquee animation on overflow, bookmark toggle with optimistic write status, and overflow actions (open webview, open browser, share). |
| **Reader Bottom Bar** | ✅ Full | ✅ Full | ✅ Full | [`src/features/reader/components/ReaderBottomBar.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/reader/components/ReaderBottomBar.vue) | Bottom app bar with reading mode, orientation, crop borders toggle, and settings triggers. In SY/Komikku bottom buttons are customizable; `mihon-vue` adheres to Mihon's primary 4-button MD3 layout while exposing chapter list via sheet. |
| **Chapter Navigator (Seekbar & Slider)** | ✅ Full | ✅ Full | ✅ Full | [`src/features/reader/components/ChapterNavigator.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/reader/components/ChapterNavigator.vue) | Jetpack Compose slider parity: supports Horizontal (LTR/RTL), Vertical (Left/Right) with configurable height %, discrete tick calculations, slider dragging, and prev/next chapter buttons. |
| **Reader Settings Sheet (Tabbed Dialog)** | ✅ Full | ✅ Full | ✅ Full | [`src/features/reader/components/ReaderSettingsDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/reader/components/ReaderSettingsDialog.vue) | Adaptive dialog (bottom sheet on phone, modal on tablet) hosting 3 tabs: Reading mode, General, and Custom filter. |
| **Reading Mode Settings Page** | ✅ Full | ✅ Full | ✅ Full | [`src/features/reader/components/ReadingModePage.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/reader/components/ReadingModePage.vue) | Reading mode & orientation chips, tap zones, invert tap zones, webtoon smart scale (Komikku), padding, double-page spread options (SY), wide zoom modes (Komikku), and zoom locks. |
| **General Settings Page** | ✅ Full | ✅ Full | ✅ Full | [`src/features/reader/components/GeneralSettingsPage.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/reader/components/GeneralSettingsPage.vue) | Background theme (Black/Gray/White/Auto), page numbers, vertical navigator modes/position/height, fullscreen, keep screen on (Wake Lock), long tap actions, transitions, and E-Ink flash settings. |
| **Color Filter Settings Page** | ✅ Full | ✅ Full | ✅ Full | [`src/features/reader/components/ColorFilterPage.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/reader/components/ColorFilterPage.vue) | Custom brightness (-75..100) slider, RGBA sliders (0..255), 6 blend mode filter chips (Default, Multiply, Screen, Overlay, Dodge, Burn), grayscale, and inverted color checkboxes. |
| **Reading Mode Quick Picker Dialog** | ✅ Full | ✅ Full | ✅ Full | [`src/features/reader/components/ReadingModeSelectDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/reader/components/ReadingModeSelectDialog.vue) | Quick adaptive icon grid picker for reading modes (LTR, RTL, Vertical, Long Strip, Long Strip with gaps) with Revert to default and Apply buttons. |
| **Orientation Quick Picker Dialog** | ✅ Full | ✅ Full | ✅ Full | [`src/features/reader/components/OrientationSelectDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/reader/components/OrientationSelectDialog.vue) | Quick adaptive icon grid picker for Free, Portrait, Landscape, Locked Portrait, Locked Landscape, Reverse Portrait. |
| **Page Actions Dialog (Single & Dual)** | ✅ Full | ✅ Full | ✅ Full | [`src/features/reader/components/ReaderPageActionsDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/reader/components/ReaderPageActionsDialog.vue) | Adaptive sheet for page actions. Includes Mihon single page actions (Cover, Copy, Share, Save) plus SY/Komikku dual-page spread actions (First page, Second page, and Stitched Combined page export). |
| **Set as Cover Dialog** | ✅ Full | ✅ Full | ✅ Full | [`src/features/reader/components/SetCoverDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/reader/components/SetCoverDialog.vue) | Confirmation dialog for setting page as manga cover (reports REST limitation on Suwayomi server gracefully). |
| **Chapter Transition Screen / Card** | ✅ Full | ✅ Full | ✅ Full | [`src/features/reader/components/ChapterTransition.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/reader/components/ChapterTransition.vue) | Pager (centered, 64dp horizontal pad) and Webtoon (32dp horizontal pad, 128dp vertical pad) transitions with previous/current/finished/next labels, missing chapter gap detection banner, downloaded badges, and retry. |
| **Chapter List Modal / Bottom Sheet** | ❌ Missing | ✅ Full | ✅ Full | [`src/features/reader/views/ReaderView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/reader/views/ReaderView.vue) (`v-bottom-sheet`) | TachiyomiSY/Komikku introduced quick in-reader chapter list selection; `mihon-vue` includes a scrollable bottom sheet with active chapter indicator and instant jump. |
| **Reader Content Overlay & Filters** | ✅ Full | ✅ Full | ✅ Full | [`src/features/reader/components/ReaderContentOverlay.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/reader/components/ReaderContentOverlay.vue) | Fullscreen non-interactive canvas layers for brightness dimming, RGBA tint blending (`mix-blend-mode`), and CSS grayscale/invert filters. |
| **Reader Page Number Indicator** | ✅ Full | ✅ Full | ✅ Full | [`src/features/reader/components/ReaderPageIndicator.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/reader/components/ReaderPageIndicator.vue) | Bottom-center overlay indicator with 12sp bold font, filled `#EBEBEB` with 2px `#2D2D2D` stroke halo; respects menu visibility and user preference. |
| **Settings -> Reader Preference Screen** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/SettingsReaderView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/SettingsReaderView.vue) | Global Reader preferences categorized into Display, E-Ink, Reading, Paged, Long strip, Navigation, and Actions matching Mihon `SettingsReaderScreen.kt`. |

### Table B: Granular Features, Controls & Actions
| Feature / Action | Mihon | TachiyomiSY | Komikku | mihon-vue | Implementation / Gap Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Paged: Left to Right (LTR)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Supported with slide/fade transitions, click/touch/keyboard page turns (`ReaderView.vue`). |
| **Paged: Right to Left (RTL)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Japanese manga order: inverted page turns, reversed seekbar fraction, RTL spread layout order. |
| **Paged: Vertical** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Listed in mode selectors and preferences; navigates vertically per page. |
| **Webtoon / Long Strip (Continuous)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Continuous vertical scroll with scroll position tracking, RAF-based active page calculation, and resume on reload. |
| **Continuous Strip with Gaps** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Configurable gap spacing (`--reader-strip-gap`, 0..32px) in continuous mode. |
| **Double-Page Spread: Single / Double / Auto** | ❌ Missing | ✅ Full | ✅ Full | ✅ Full | Implemented via `spreadLayout.ts`: pairs consecutive portrait pages, isolates landscape scans; auto activates on landscape viewports. |
| **Double-Page Spread: Shift Cover Page** | ❌ Missing | ✅ Full | ✅ Full | ✅ Full | Isolates page 0 (cover) solo so subsequent pages [1, 2], [3, 4] remain paired correctly. |
| **Double-Page Spread: Invert Pages** | ❌ Missing | ✅ Full | ✅ Full | ✅ Full | Flips secondary and primary page positions across LTR and RTL orientations. |
| **Double-Page Spread: Center Gutter Margin** | ❌ Missing | ✅ Full | ✅ Full | ✅ Full | Configurable divider gap between paired pages (`getCenterMarginGap`, `--reader-spread-gap`). |
| **Komikku Webtoon Smart Scale** | ❌ Missing | ❌ Missing | ✅ Full | ✅ Full | Supports Fit, 4:3, 3:2, 16:9, 20:9 aspect ratio constraints (`--reader-webtoon-max-width`) on widescreen monitors. |
| **Auto-Webtoon Heuristic Detection** | ❌ Missing | ✅ Full | ✅ Full | ✅ Full | `autoWebtoon.ts` inspects manga genres/tags (`webtoon`, `long strip`, `manhwa`, `manhua`) and source names to automatically apply webtoon mode. |
| **Reader Top Bar & Overflow Actions** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Title marquee, bookmark toggle with Suwayomi REST sync, webview notice, browser link, and share action. |
| **Chapter Seekbar & Skip Buttons** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Horizontal LTR/RTL and Vertical Left/Right with exact MD3 tick geometry and skip chapter buttons. |
| **Brightness Adjustment Slider** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Custom brightness (-75..100) dimming layer in `ReaderContentOverlay.vue`. |
| **RGBA Color Tint & Blend Modes** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Red, Green, Blue, Alpha sliders with all 6 blend modes (Default/SrcOver, Multiply, Screen, Overlay, Dodge, Burn). |
| **Grayscale & Inverted Colors** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | CSS filter shaders `grayscale(1)` and `invert(1)` with blend layering. |
| **Crop Borders (Pager & Webtoon)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Toggled from bottom bar or settings; separate preferences for pager and webtoon. |
| **Display Cutout / Notch Padding** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Preference supported; CSS `env(safe-area-inset-*)` used. Web browsers cannot directly toggle OS window cutout attributes beyond viewport meta. |
| **E-Ink Display Refresh Flash** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Fullscreen canvas flash on page change (`flashOnPageChange`, duration, interval, black/white/white_black). |
| **Tap Zones & Inversion** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Left (33%), Right (33%), Menu (center 34% or top 5%), smaller tap zones (25%/75%), and horizontal/vertical inversion. |
| **Hardware Volume Keys Navigation** | ✅ Full | ✅ Full | ✅ Full | ➖ N/A | Preferences present in Settings; browsers cannot capture hardware volume keys due to OS-level interception. |
| **Keyboard Navigation Shortcuts** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Arrow keys, A/D, PageUp/PageDown, Space/Shift+Space, N/P (chapters), Home/End, M (menu), Escape. |
| **Zoom Controls & Locks** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | `pagedDisableZoomIn`, `pagedDoubleTapZoom`, `webtoonPinchToZoom`, and 2x wide image double zoom (`reader-page--scale-2x`). |
| **Page Actions: Single Page** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Set as cover (with dialog), clipboard copy via `ClipboardItem`, native share (`navigator.share`), save file to disk. |
| **Page Actions: Dual-Page Stitched** | ❌ Missing | ✅ Full | ✅ Full | ✅ Full | `canvasStitch.ts` stitches paired pages side-by-side with LTR/RTL reading order into a PNG Blob for copy, share, and save. |
| **Page Preloading & Buffer Cache** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | `usePagePreloader.ts` prefetches ahead (+2) and behind (-1) into memory with LRU-style distance pruning. |
| **Progress Saving & Synchronization** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Syncs `lastPageRead` to Suwayomi backend `/manga/:id/chapter/:index` with queue deduplication and optimistic state. |
| **Keep Screen On (Wake Lock)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Browser Screen Wake Lock API (`navigator.wakeLock.request('screen')`) automatically held while reading. |
| **Dynamic Manga Cover Theming** | ❌ Missing | ❌ Missing | ❌ Missing | ✅ Full | Extracts dominant color from manga cover and applies dynamic MD3 color tokens to reader chrome when enabled. |

#### Category 6 Delta Summary
- **Frontend-Implementable Highlights**: Double-page spread pairing (Single, Double, Auto), cover page shifting, double-page inversion, center gutter margin, and dual-page canvas image stitching for clipboard/save/share are fully operational in `mihon-vue`. Webtoon smart scale (4:3, 3:2, 16:9, 20:9) and auto-webtoon heuristics match Komikku.
- **Backend/Platform-Constrained**: Hardware volume rocker keys cannot be captured in modern browsers due to OS security sandboxing. Cutout attributes are governed by browser viewport meta rather than Android window layout APIs.

---

## 7. More (Download Queue, Stats & Onboarding)

### Table A: Screens, Modals & Sub-Views
| Screen / Dialog / Sub-View | Mihon | TachiyomiSY | Komikku | mihon-vue (`src/` path) | Notes & Parity Details |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **More Main Screen** (`MoreScreen`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/MoreView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/MoreView.vue) | Exact M3 layout with centered 64dp Mihon logo header, outline-variant dividers, preference widgets with 56dp min-height, and sub-screen routing. Includes conditional Updates/History rows when hidden from bottom navigation (SY/KMK parity) and Komikku update errors badge. |
| **Download Queue Screen** (`DownloadQueueScreen`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/downloads/views/DownloadQueueView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/downloads/views/DownloadQueueView.vue) | M3 top app bar with back navigation, queue title, count badge `Pill`, nested sort menus, overflow cancel-all, small extended FAB with pause/resume and scroll auto-collapse, M3 item rows grouped by source/manga with drag-drop and progress bar. |
| **Download Queue Sort Dropdown** | ✅ Full | ✅ Full | ✅ Full | [`src/features/downloads/views/DownloadQueueView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/downloads/views/DownloadQueueView.vue) | Dropdown menu with nested sub-menus: "By upload date" (Newest, Oldest) and "By chapter number" (Ascending, Descending). Reorders queue via GraphQL mutations. |
| **Download Queue Item Action Menu** | ✅ Full | ✅ Full | ✅ Full | [`src/features/downloads/views/DownloadQueueView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/downloads/views/DownloadQueueView.vue) | 3-dot overflow menu per download item: "Move to top", "Move series to top", "Move to bottom", "Move series to bottom", "Cancel", "Cancel all for this series". Context-sensitive (hides top/bottom when at boundary). |
| **Statistics Screen** (`StatsScreen`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/StatsView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/StatsView.vue) | Top app bar with back navigation and scrolled elevation tint; 4 M3 `SectionCard` containers in exact Mihon order: Overview, Entries, Chapters, Trackers. Computes stats from Suwayomi library data and tracker endpoints. |
| **Data and Storage Info Sub-View** (`StorageInfo`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/SettingsDataView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/SettingsDataView.vue) | Storage disk space gauge with total/available space progress bar and breakdown per storage location. |
| **Onboarding Wizard Shell** (`OnboardingScreen` / `InfoScreen`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/onboarding/views/OnboardingView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/onboarding/views/OnboardingView.vue) | M3 InfoScreen shell with 48dp `rocket_launch` icon, headlineLarge heading, 0.78 alpha subtitle, `surfaceVariant` step box, animated horizontal transitions (`materialSharedAxisX` equivalent), full-width action button with step validation gating, and browser back/history support. |
| **Onboarding: Theme Step** (`ThemeStep`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/onboarding/components/ThemeStep.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/onboarding/components/ThemeStep.vue) | Segmented button row for Theme mode (System / Light / Dark) with check indicator + horizontal palette card preview list with simulated toolbar/cover/dock colors matching Mihon color schemes. |
| **Onboarding: Storage Step** (`StorageStep`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/onboarding/components/StorageStep.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/onboarding/components/StorageStep.vue) | Storage folder picker using File System Access API (`showDirectoryPicker`) with `webkitdirectory` fallback, storage guide link, and validation gating that disables the Next button until a location is chosen. |
| **Onboarding: Permission Step** (`PermissionStep`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/onboarding/components/PermissionStep.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/onboarding/components/PermissionStep.vue) | M3 ListItems for Android package install permission, Notification permission (browser `Notification.requestPermission`), battery optimization exemption, and Crashlytics/Analytics telemetry switches with local storage persistence. |
| **Onboarding: Guides Step** (`GuidesStep`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/onboarding/components/GuidesStep.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/onboarding/components/GuidesStep.vue) | "Getting started guide" button (external URL) and "Restore backup" button (finishes onboarding and routes to data/backup restore with explanatory dialog). |
| **About Screen** (`AboutScreen`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/AboutView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/AboutView.vue) | Top app bar with back navigation; 64dp logo header; Version row with formatted build date and click-to-copy debug info; "Check for updates" with circular spinner querying GitHub releases; "What's new" navigation; "Open source licenses" navigation; "Privacy policy" link; and centered 6-icon social bar (Website, Discord, X, Facebook, Reddit, GitHub). |
| **What's New / New Update Screen** (`NewUpdateScreen` / `WhatsNewScreen` / `ComingUpdatesScreen`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/updates/views/NewUpdateView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/updates/views/NewUpdateView.vue) | InfoScreen with verified/update icon, version header, GFM Markdown changelog rendering, "Open on GitHub" link button, Skip version dialog, and update action buttons. |
| **Open Source Licenses Screen** (`OpenSourceLicensesScreen`) | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/OpenSourceLicensesView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/OpenSourceLicensesView.vue) | AboutLibraries M3 Traditional layout with Cozy density, Chip badges (version, author, SPDX license badge with license-specific hue), and interactive Modal Bottom Sheet displaying full license text and website link. |
| **Support Us Screen** (`SupportUsScreen` / Sponsor) | ✅ Full | 🟡 Partial | ✅ Full | [`src/features/settings/views/SupportUsView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/SupportUsView.vue) | M3 card items with SimpleIcons SVG brands for Patreon, OpenCollective, and Discord, accompanied by thank-you copy and external donation links. |
| **App State Banners** (`Banners.kt`) | ✅ Full | ✅ Full | ✅ Full | [`src/core/components/AppStateBanners.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/core/components/AppStateBanners.vue) | Pinned top banners above app bar for Downloaded-only mode (tertiary container), Incognito mode (primary container), Library updating progress, WebDAV syncing, and Download cache indexing. |

### Table B: Granular Features, Controls & Actions
| Feature / Action | Mihon | TachiyomiSY | Komikku | mihon-vue | Implementation / Gap Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **LogoHeader** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Centered 64dp Mihon vector logo with 32dp vertical padding on More screen and 56dp on About screen, followed by outline-variant divider. |
| **Downloaded-Only Toggle** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Switch preference widget that sets global `preferences.downloadedOnly`; filters library display and shows persistent tertiary top banner. |
| **Incognito Mode Toggle** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Switch preference widget with glasses icon. Pauses client-side reading tracking and displays primary top banner. Explanatory toast/dialog notes that headless Suwayomi backend continues recording history server-side. |
| **Conditional Updates / History Rows** | ➖ N/A | ✅ Full | ✅ Full | ✅ Full | `MoreView.vue` renders Updates and History navigation rows when user preferences hide them from the primary bottom navigation bar. |
| **Download Queue Summary Subtitle** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Displays null for stopped queue, "Paused" for paused queue without entries, "Paused • N remaining" for paused queue with items, and "N remaining" while actively downloading. |
| **Download Queue Badge** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Number of pending chapter downloads displayed as a badge on the More screen item. |
| **Library Update Errors Navigation** | ➖ N/A | ➖ N/A | ✅ Full | ✅ Full | Komikku feature: badge showing number of failed library updates, linking to `/updates/errors`. |
| **Help Navigation Link** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | External link opening Mihon troubleshooting guide (`https://mihon.app/docs/guides/troubleshooting/`). |
| **Download Queue: Counter Pill** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Pill badge in top app bar showing total downloads count with M3 alpha container. |
| **Download Queue: Pause / Resume FAB** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Extended FAB showing Pause (when downloading) or Resume (when stopped/paused). Auto-collapses label to icon-only on downward scroll, expands on upward scroll. Triggers Suwayomi GraphQL mutations. |
| **Download Queue: Cancel All** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Overflow top-bar action that empties the entire downloader queue via Suwayomi GraphQL mutation. |
| **Download Queue: Sort by Upload Date** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Reorders all items within each series by upload date (Newest or Oldest) and pushes new order to server. |
| **Download Queue: Sort by Chapter Number** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Reorders all items within each series by chapter number (Ascending or Descending) and pushes new order to server. |
| **Download Queue: Series/Source Headers** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Downloads grouped by source/manga with header showing title and count of queued chapters. |
| **Download Queue: Section Drag-and-Drop Reorder** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Header drag handle allows drag-and-drop reordering of entire manga sections across the queue. |
| **Download Queue: Item Drag-and-Drop Reorder** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Item drag handle enables dragging chapters to swap positions within their series section. |
| **Download Queue: Move Item to Top / Bottom** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Contextual item menu moves individual chapter to start or end of its series section. |
| **Download Queue: Move Series to Top / Bottom** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Contextual item menu shifts all chapters of selected series to the very top or bottom of the queue. |
| **Download Queue: Cancel Single Chapter** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Dequeues specific chapter from downloader via GraphQL `dequeueChapterDownloads`. |
| **Download Queue: Cancel All for Series** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Dequeues all queued chapters belonging to the selected manga. |
| **Download Queue: Progress Bar & Page Fraction** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Displays `downloadedPages / pageCount` text and animated 4dp M3 `LinearProgressIndicator`. |
| **Download Queue: Empty Screen State** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Shows centered `MihonEmptyScreen` with "No downloads" copy when queue has 0 items. |
| **Stats: Library Manga Count** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Displays count of distinct manga in user library with `collections_bookmark` icon. |
| **Stats: Read Duration** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Formats read duration with `formatDuration` matching Mihon `toDurationString`. Defaults to "None" fallback because headless Suwayomi-Server records no per-second reading timestamps. |
| **Stats: Completed Titles** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Displays count of manga where status is COMPLETED and unreadCount is 0, with `local_library` icon. |
| **Stats: In Global Update Count** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Evaluates category update restrictions (explicitly included/excluded categories, completed/unread/not-started exclusions) matching `StatsViewModel.kt`. |
| **Stats: Started Manga Count** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Counts manga where reading has started (`lastReadAt > 0`, unread < total, or lastChapterRead exists). |
| **Stats: Local Manga Count** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Counts local source manga (`sourceId === '0'`). |
| **Stats: Chapter Total / Read / Downloaded** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Computes sum of all chapters, read chapters (`chapterCount - unreadCount`), and downloaded chapters. |
| **Stats: Tracked Titles & Trackers Used** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Queries tracker endpoints for number of tracked entries and count of logged-in tracking services. |
| **Stats: Mean Tracker Score** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Formats average tracker score to two decimal places with star (`"X.XX ★"`) or `"N/A"` when zero/untracked. |
| **Stats: Download Storage Gauge** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Available and total storage breakdown in Data and storage settings (`SettingsDataView.vue` / `StorageInfoItem.vue`), matching Mihon `StorageInfo.kt`. |
| **Onboarding: Step Progression & Wizard Flow** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Linear 4-step wizard (Theme -> Storage -> Permissions -> Guides) with Next / Get started button, back button, popstate listener, and finish callback to `/library`. |
| **Onboarding: Theme Mode Switcher** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | 3-button segmented control (System / Light / Dark) with animated checkmark and immediate theme application. |
| **Onboarding: App Theme Palette Picker** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Horizontal scroll list of app themes (Default, Monet/Dynamic, Green Apple, Lavender, Midnight Dusk, Strawberry Daiquiri, Tako, Tealturquoise, Tidal Wave, Yin & Yang, Yotsuba) with color cards. |
| **Onboarding: Storage Folder Picker** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Uses web File System Access API (`window.showDirectoryPicker()`) with fallback input. Persists directory name and unlocks step gating. Notice explains that server storage is managed on Suwayomi backend. |
| **Onboarding: Storage Guide Link** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Opens Mihon storage documentation in new browser tab. |
| **Onboarding: App Install Permission** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Android APK installer permission; web client shows an M3 dialog explaining that extensions are handled server-side by Suwayomi. |
| **Onboarding: Notification Permission** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Calls browser standard `Notification.requestPermission()`. Updates checkmark button state once granted. |
| **Onboarding: Battery Optimization Exemption** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Android OS battery setting; web client displays informative dialog that browser tabs are managed by the host browser. |
| **Onboarding: Crashlytics & Analytics Toggles** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | M3 switches for crash reports and analytics; stored locally in localStorage (telemetry defaults to disabled/mocked). |
| **Onboarding: Getting Started Guide** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | External link opening `https://mihon.app/docs/guides/getting-started`. |
| **Onboarding: Restore Backup Navigation** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Completes onboarding and directs user to `/settings/data` backup restore view. |
| **About: Version & Build Date** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Renders `"Stable vX.Y.Z (M/D/YYYY, H:MM:SS)"` matching Mihon's `getVersionName(withBuildDate = true)`. |
| **About: Copy Debug Info** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Clicking Version preference copies app version, channel, server address, user agent, and timestamp to clipboard with snackbar feedback. |
| **About: Check for Updates** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Async check against GitHub repository release API with 28dp circular spinner; navigates to `NewUpdateView` when update exists or shows toast when current. |
| **About: What's New Link** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Navigates to `/new-update` to view release highlights and changelog. |
| **About: Open Source Licenses** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Navigates to `/about/licenses` with full library inventory. |
| **About: Privacy Policy** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Opens `https://mihon.app/privacy/` in a new tab. |
| **About: Social Media Icons** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Row of 6 48dp circular icon buttons: Website, Discord, X, Facebook, Reddit, GitHub with exact SimpleIcons SVG paths. |
| **New Update: Changelog Markdown** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Renders GitHub-flavored Markdown for release notes using `MarkdownRender.vue`. |
| **New Update: Open on GitHub & Skip** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | "Open on GitHub" link button, "Not now" button, and "Skip this version" dialog. |
| **Support Us: Patronage Options** | ✅ Full | 🟡 Partial | ✅ Full | ✅ Full | Cards for Patreon, OpenCollective, and Discord with brand vectors, perks text, and patron count acknowledgment. |

#### Category 7 Delta Summary
- **Frontend-Implementable Highlights**: 100% UI layout and widget parity achieved across all 8 screens and dialogs. Download queue reordering (drag-and-drop items & manga sections, upload date & chapter number sorting) is operational via GraphQL. Onboarding wizard matches Mihon's `InfoScreen` shell with validation gating and directory picking.
- **Backend/Platform-Constrained**: Suwayomi-Server records no cumulative reading duration seconds (defaults to "None" fallback). Browser environment cannot execute native Android APK installs or manipulate battery management.

---

## 8. Settings

### Table A: Screens, Modals & Sub-Views
| Screen / Dialog / Sub-View | Mihon | TachiyomiSY | Komikku | mihon-vue (`src/` path) | Notes & Parity Details |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **Settings Main Screen** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/SettingsView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/SettingsView.vue) | Master navigation list for all 10 settings sections + Server connection entry; handles two-pane vs single-pane push. |
| **Settings TwoPanelBox Layout** | ✅ Full | ✅ Full | ✅ Full | [`src/app/layouts/SettingsLayout.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/app/layouts/SettingsLayout.vue) | Adaptive master-detail scaffold matching Mihon's `TwoPanelBox` (width >= 600px or `tabletUiMode: always`, 450px left pane with paler surface, right pane detail). |
| **Settings Search Screen** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/SettingsSearchView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/SettingsSearchView.vue) | Full in-memory index search across all preference screens via [`settingsIndex.ts`](file:///c:/Users/dail45/Desktop/mihon-vue/src/data/settingsIndex.ts), query match highlighting, breadcrumbs, target scroll/highlight via [`settingsHighlight.ts`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/stores/settingsHighlight.ts). |
| **Appearance Settings** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/SettingsAppearanceView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/SettingsAppearanceView.vue) | Theme mode segmented buttons (System/Light/Dark), theme preview horizontal carousel, pure black dark mode, app language, date/time formats, relative timestamps. |
| **App Language Selection** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/AppLanguageView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/AppLanguageView.vue) | Dedicated language picker screen / sub-view with search and checkmark indicator matching `AppLanguageScreen.kt`. |
| **Custom Theme Color Picker** | ❌ Missing | ❌ Missing | ✅ Full | [`src/features/settings/views/CustomThemeColorPickerView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/CustomThemeColorPickerView.vue) | Parity with Komikku `AppCustomThemeColorPickerScreen.kt`: custom seed color picker with HSL/Hex, color presets, and dynamic theme palette generation. |
| **Library Settings** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/SettingsLibraryView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/SettingsLibraryView.vue) | Global update intervals, device restrictions, default category, category tri-state picker, metadata refresh, smart update rules, chapter swipe actions, duplicate chapter handling. |
| **Edit Categories Screen** | ✅ Full | ✅ Full | ✅ Full | [`src/features/library/views/CategoriesView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/library/views/CategoriesView.vue) | Full category management (create, rename, delete, reorder) embedded or linked from Library settings. |
| **Tag Sorting Screen** | ❌ Missing | ✅ Full | ❌ Missing | [`src/features/settings/views/SortTagView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/SortTagView.vue) | Parity with TachiyomiSY `SortTagScreen.kt`: reorderable tag priority list with drag handles and search filter for manga genre sorting. |
| **Reader Settings** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/SettingsReaderView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/SettingsReaderView.vue) | Reading modes (LTR, RTL, Vertical, Webtoon), background themes (Black, Gray, White, Paper), dual-page split/rotate, tap zones & inversion, page transitions, cutout padding, e-ink flashing. |
| **Downloads Settings** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/SettingsDownloadView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/SettingsDownloadView.vue) | Concurrent downloads slider (parallel sources & pages), auto-download new chapters, auto-download while reading, remove after read slots, remove bookmarked exclusion. |
| **Tracking Settings** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/SettingsTrackingView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/SettingsTrackingView.vue) | Tracker list in exact Mihon order (MangaBaka, MAL, AniList, Kitsu, MangaUpdates, Shikimori, Bangumi, Hikka), auto-update after reading toggle, auto-update on mark read dialog, enhanced trackers list. |
| **Tracker Login / Logout Dialogs** | ✅ Full | ✅ Full | ✅ Full | [`src/features/trackers/components/TrackingLoginDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/trackers/components/TrackingLoginDialog.vue), [`TrackingLogoutDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/trackers/components/TrackingLogoutDialog.vue) | MD3 dialogs for credential-based tracker logins and confirmation logout prompts. |
| **Browse Settings** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/SettingsBrowseView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/SettingsBrowseView.vue) | "Hide entries already in library", extension store count & link to stores screen, "Allowed content warnings" (Safe, Mixed, 18+) dialog, apply to installed toggle. |
| **Extension Stores Screen** | ✅ Full | ✅ Full | ✅ Full | [`src/features/browse/views/ExtensionStoresView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/browse/views/ExtensionStoresView.vue) | Parity with Mihon `ExtensionStoresScreen.kt`: repository management list (add, edit, delete repo URLs) at `/settings/browse/stores`. |
| **Data & Storage Settings** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/SettingsDataView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/SettingsDataView.vue) | Storage breakdown bar (`StorageInfoItem`), backup creation/restoration links, automatic backup interval, library CSV export, WebDAV sync dialog, cache clearing. |
| **Create Backup Screen** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/CreateBackupView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/CreateBackupView.vue) | Parity with Mihon `CreateBackupScreen.kt`: section cards for Library and Settings backup toggles with select all and Create button. |
| **Restore Backup Screen** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/RestoreBackupView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/RestoreBackupView.vue) | Parity with Mihon `RestoreBackupScreen.kt`: file picker, `.tachibk` validation (checks missing sources & logged-in trackers), restore option checkboxes. |
| **WebDAV Cloud Sync Dialog** | ❌ Missing | ❌ Missing | ✅ Full | [`src/features/settings/components/WebDavSyncDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/components/WebDavSyncDialog.vue) | Parity with Komikku: remote WebDAV snapshot browser, list remote backups with timestamps/sizes, restore client state from WebDAV remote. |
| **SyncYomi / Google Drive Sync** | ❌ Missing | ✅ Full | ✅ Full | 🟡 Partial | TachiyomiSY `SyncSettingsSelector.kt` / Komikku sync triggers. `mihon-vue` uses direct Suwayomi server sync + client WebDAV cloud sync, but lacks standalone SyncYomi client protocol. |
| **Security & Privacy Settings** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/SettingsSecurityView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/SettingsSecurityView.vue) | Require unlock toggle, "Lock when idle" timeout dialog (Always, 1m, 2m, 5m, 10m, Never), "Secure screen" mode (Always, Incognito, Never), hide notification content, telemetry toggles. |
| **Connections Settings (Discord RPC)** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | Komikku `SettingsConnectionScreen.kt` & `SettingsDiscordScreen.kt` for Discord Rich Presence / Discord login. `mihon-vue` does not feature Discord RPC. |
| **Server Connection Dialog & Config** | ➖ N/A | ➖ N/A | ➖ N/A | [`src/features/settings/components/ServerSettingsDialog.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/components/ServerSettingsDialog.vue), [`ServerConfiguration.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/components/ServerConfiguration.vue) | Suwayomi-Server specific connection settings: REST API URL configuration, connection test, live server-side download/update configuration editor. |
| **Advanced Settings** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/SettingsAdvancedView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/SettingsAdvancedView.vue) | Clear cookies, clear WebView data, DoH provider selection dialog (13 DNS providers), custom user agent string editing/reset, verbose logging, redact headers, extension installer options. |
| **Clear Database Screen** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/ClearDatabaseView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/ClearDatabaseView.vue) | Parity with Mihon `ClearDatabaseScreen.kt`: non-library source list with counts, multi-selection actions (Select All/Inverse), delete confirmation dialog. |
| **About Screen** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/AboutView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/AboutView.vue) | App logo header, version string with build date/commit, update check spinner, "What's new" link, "Open source licenses" link, social link icons. |
| **Open Source Licenses Screen** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/OpenSourceLicensesView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/OpenSourceLicensesView.vue) | Dedicated license view listing open source dependencies with expandable license bodies matching Mihon. |
| **Debug Info Screen** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/DebugInfoView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/DebugInfoView.vue) | Parity with Mihon `DebugInfoScreen.kt`: App info, Device info, Server info, Memory & storage stats, Share & copy to clipboard actions. |
| **Worker Info Screen** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/WorkerInfoView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/WorkerInfoView.vue) | Parity with Mihon `WorkerInfoScreen.kt`: Enqueued, Finished, Running sections with copy-to-clipboard action (displays empty marker `-` with WorkManager web constraint note). |
| **Backup Schema Screen** | ✅ Full | ✅ Full | ✅ Full | [`src/features/settings/views/BackupSchemaView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/BackupSchemaView.vue) | Parity with Mihon `BackupSchemaScreen.kt`: monospaced Protobuf proto2 schema definition of Mihon backup model with copy-to-clipboard top bar action. |

### Table B: Granular Features, Controls & Actions
| Feature / Action | Mihon | TachiyomiSY | Komikku | mihon-vue | Implementation / Gap Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Master-Detail TwoPanelBox** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Master list pane (<= 450px, paler surface) and detail pane; switches to single-pane navigation on phone screen widths (< 600px). |
| **Global Preference Search** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Full index of all 9 preference screens with group hierarchy breadcrumbs, case-insensitive query substring matching, autofocus, and target highlighting. |
| **Theme Mode (System/Light/Dark)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Segmented button selector with instant theme mode switching and localStorage persistence. |
| **Built-in Theme Palettes** | ✅ Full (12) | ✅ Full (12) | ✅ Full (20+) | ✅ Full (20+) | Supports 20+ themes: Default, Catppuccin, Green Apple, Lavender, Midnight Dusk, Nord, Strawberry Daiquiri, Tako, Teal Turquoise, Tidal Wave, Yin-Yang, Yotsuba, Tokyo Night, Monochrome, Cloudflare, Cotton Candy, Doom, Matrix, Mocha, Sapphire, Custom. |
| **Custom Seed Color Picker** | ❌ Missing | ❌ Missing | ✅ Full | ✅ Full | [`CustomThemeColorPickerView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/settings/views/CustomThemeColorPickerView.vue) with HSL/Hex sliders and presets. |
| **Dynamic / Monet Theming** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Dynamic color palette generator based on seed color or manga cover image. |
| **Pure Black Dark Mode** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | AMOLED pure black background switch when theme mode is Dark or System. |
| **Navbar Tab Customization** | ❌ Missing | 🟡 Partial | ✅ Full | 🟡 Partial | Toggles for showing/hiding Updates & History tabs, bottom bar labels; drag-and-drop tab reordering is not implemented. |
| **App Language Selection** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Shipped translations list with locale switching and instant reload. |
| **Date & Time Formats** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Date format radio dialog (6 format options), time format radio dialog (12h/24h), relative timestamps switch. |
| **Library Update Interval** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Radio dialog for Off, 12h, 24h, 48h, 72h, weekly intervals. |
| **Library Update Restrictions** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | UI multi-select preference for Wi-Fi only, charging, and unmetered network. Charging state cannot be verified in standard web contexts. |
| **Default Category on Add** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Radio list of user categories + "Always ask" option. |
| **Library Tri-State Category Filter** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Tri-state include/exclude/neutral dialog for library update categories. |
| **Smart Update Rules** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Multi-select for skipping unread, unstarted, completed, or predicting next release; UI persisted, server-side execution depends on Suwayomi build. |
| **Chapter Swipe Actions** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Custom actions for swipe left/right: Mark Read, Bookmark, Download, Disabled. |
| **Tag Priority Sorting** | ❌ Missing | ✅ Full | ❌ Missing | ✅ Full | Reorderable tag priority list with drag handles and search filter for manga genre sorting. |
| **Reader Default Viewer Mode** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | LTR, RTL, Vertical, Webtoon, Continuous Vertical selection. |
| **Reader Background Theme** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Black, Gray, White, Paper options synced with reader store. |
| **Dual Page Split & Rotate** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Paged and Webtoon dual-page split, invert, and rotate-to-fit options. 3D page curl/flip transition from Komikku is not implemented. |
| **Tap Zones & Inversion** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Tap zone layouts for Paged and Webtoon with horizontal/vertical inversion options. |
| **Display Cutout / Safe Areas** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | `drawUnderCutout` switch present; web version utilizes CSS `env(safe-area-inset-*)`. |
| **Volume Keys Navigation** | ✅ Full | ✅ Full | ✅ Full | ➖ N/A | Row rendered with platform notice; web browsers cannot capture hardware volume rocker keys. |
| **E-Ink Refresh / Flash Settings** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Flash on page change, duration slider, page interval slider, flash color selection. |
| **Auto-Download New Chapters** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Toggled both in client UI and directly in Suwayomi-Server download settings. |
| **Delete Chapters When Read** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Remove after marked as read, slots slider, exclude bookmarked, exclude categories tri-state. |
| **Concurrent Downloads Limit** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Parallel sources slider (1..10) and parallel pages slider (1..15) mapped to server config. |
| **Download Ahead While Reading** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Slider from 0 (disabled) to 10 chapters ahead. |
| **Download Storage Directory** | ✅ Full | ✅ Full | ✅ Full | ➖ N/A | Android SAF folder picker; in Suwayomi architecture, download folder is configured server-side. |
| **Tracker Authentication** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | OAuth and username/password logins for 8 trackers handled via Suwayomi tracker API endpoints. |
| **Tracker Auto-Sync Progress** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Auto-sync progress on chapter read and on mark as read (Always, Ask, Never). |
| **Enhanced Trackers** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Dedicated group for Komga, Kavita, and Suwayomi enhanced tracking. |
| **Extension Stores Manager** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Add, edit, and delete third-party extension repository URLs. |
| **Allowed Content Warnings (NSFW)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Multi-select dialog for Safe, Mixed, 18+ content warnings and toggle to apply to installed. |
| **Backup Creation** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Full UI with Library and Settings checkboxes; backup execution requires server support (client reports limitation). |
| **Backup Validation & Restoration** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Parses `.tachibk` files in browser, validates missing sources and unauthenticated trackers; actual database restore is backend-constrained. |
| **Library CSV Export** | ❌ Missing | ✅ Full | ✅ Full | ✅ Full | Exports manga library to CSV with options for title, author, and artist. |
| **WebDAV Cloud Backup Sync** | ❌ Missing | ❌ Missing | ✅ Full | ✅ Full | Configures WebDAV URL and credentials, tests connection, uploads client state snapshots, browses remote backups, and restores state. |
| **Cache Clearing** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Clears chapter cache and cover cache with confirmation alerts. |
| **Storage Breakdown Bar** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Visual storage distribution bar for manga, downloads, cache, and free space. |
| **App Lock / Biometrics** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | "Require unlock" toggle and "Lock when idle" timeout options; browser lacks native OS biometric prompt without WebAuthn credentials. |
| **Incognito Mode** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Pauses reading history, displays incognito app banner across all views. |
| **Secure Screen / Obscure Preview** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | `useSecureScreen.ts` blurs and hides tab content when window/tab loses focus; browser cannot intercept OS-level screenshots. |
| **Discord Rich Presence (RPC)** | ❌ Missing | ❌ Missing | ✅ Full | ❌ Missing | Komikku Discord RPC service is missing; web client has no local IPC connection to Discord desktop. |
| **Suwayomi Server Settings** | ➖ N/A | ➖ N/A | ➖ N/A | ✅ Full | Configure REST API endpoint, test connectivity, live-edit server-side download limits and update jobs. |
| **DNS over HTTPS (DoH)** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Radio dialog with 13 DNS providers (Cloudflare, Google, AdGuard, Quad9, etc.). |
| **User Agent String Customization** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Custom user agent text field dialog with reset to default row. |
| **Clear Non-Library Database** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Full UI with per-source unread counts, Select All/Inverse, confirmation dialog; server lacks API to purge non-library rows. |
| **Crash & Verbose Logging** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Dump logs view, verbose logging switch, redact sensitive headers toggle. |
| **Debug Info Inspector** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Displays App info, Device info, Server info, and Memory/Storage stats with Share and Copy actions. |
| **Worker Info Status** | ✅ Full | ✅ Full | ✅ Full | 🟡 Partial | Displays Enqueued, Finished, and Running worker sections; shows empty marker `-` with WorkManager browser constraint note. |
| **Backup Schema Viewer** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Full monospaced Protobuf schema specification with copy action. |

#### Category 8 Delta Summary
- **Frontend-Implementable Highlights**: Responsive `TwoPanelBox` master-detail layout; instant preference search with breadcrumb matching and jump highlighting; 20+ theme palettes + Komikku Custom Seed Color Picker; WebDAV cloud synchronization; CSV library export; Tag priority sorting view.
- **Backend/Platform-Constrained**: Discord RPC requires native desktop IPC. Android `BiometricPrompt` and `FLAG_SECURE` window screenshot protection cannot be enforced in standard web browsers. Suwayomi REST v1 does not support restoring `.tachibk` databases directly into the server database.

---

## Remaining Gaps Summary & Roadmap

### 1. Frontend-Implementable Gaps (Directly Actionable in `mihon-vue`)

| Screen Category | Feature Gap | Description & Implementation Path |
| :--- | :--- | :--- |
| **1. Library** | **Batch Migration Action Handoff** | Wire `@migrate` in [`MangaBottomActionMenu.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/manga/components/MangaBottomActionMenu.vue) to navigate directly into [`MigrationConfigView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/features/migration/views/MigrationConfigView.vue) with preselected manga IDs. |
| **1. Library** | **Source Categories Management** | Create `SourceCategoryScreen.vue` and route `/settings/browse/source-categories` to support TachiyomiSY/Komikku source custom folders. |
| **2. Updates** | **Swipe Actions on Update Rows** | Wrap `UpdatesItemRow.vue` with `v-touch` or touch gesture composable to provide swipe-to-mark-read and swipe-to-download matching Komikku. |
| **2. Updates** | **Collapsible Manga Clusters** | Group consecutive chapters belonging to the same manga under an expandable `Leader` header row (`UpdatesUiModel.Leader`). |
| **2. Updates** | **Panorama Cover Option** | Add wide cover toggle in `UpdatesFilterDialog.vue` and render 16:9 banner thumbnail in update rows. |
| **3. History** | **Category Prompt on Quick-Add** | Invoke `ChangeCategoryDialog` when quick-favoriting a non-library history row when categories exist and no default category is configured. |
| **3. History** | **Toolbar Checklist Mode Button** | Add explicit checklist icon button (`checklist`) to `SearchToolbar` actions to toggle selection mode without requiring long-press. |
| **3. History** | **Contiguous Range Selection** | Compute index ranges on secondary long-press to batch select contiguous history items (Komikku parity). |
| **3. History** | **Finished Chapter Opacity Dimming** | Apply `opacity: 0.38` (`text-medium-emphasis`) to history entries where `entry.read === true`. |
| **3. History** | **Nav Reselect Resume** | Listen to navigation re-selection on `/history` to immediately resume the most recently read chapter. |
| **4. Browse** | **Sources Filter Bulk Language Toggle** | Add click handler to language headers (`onClickSources`) in `SourcesFilterView.vue` to toggle all sources in that language group simultaneously. |
| **4. Browse** | **FlagKit Emojis on Language Headers** | Render country flag emojis or SVG flags alongside language section headers in the sources filter. |
| **4. Browse** | **Per-Source Feed View** | Implement `SourceFeedScreen.vue` (`/browse/source/:id/feed`) as an alternative navigation mode to browse a source's latest and saved search lanes. |
| **5. Manga Details** | **Palette Debug Screen** | Implement `PaletteScreen.vue` (`/manga/:id/palette`) to preview extracted color tokens and theme swatches derived from cover art. |
| **8. Settings** | **Drag-and-Drop Navbar Reordering** | Add drag handles in Appearance settings to allow reordering navigation bar items beyond simple visibility toggling. |

---

### 2. Backend & Platform-Constrained Gaps (Suwayomi-Server REST / Native Android Dependent)

| Screen Category | Feature Gap | Reason & Constraints |
| :--- | :--- | :--- |
| **1. Library** | **Biometric Category Lock Schedules** | Android uses Keystore and biometric hardware daemons (`BiometricPrompt`). Web browsers lack background timed biometric locks without WebAuthn prompts. |
| **2. Updates** | **Server-Side Library Refresh Trigger** | Suwayomi-Server REST v1 has no asynchronous library update mutation endpoint (`POST /api/v1/update`); refreshing triggers client-side re-polling. |
| **3. History** | **Dedicated History Table & Clear All** | Suwayomi-Server does not maintain an independent SQLite `history` table. Clearing history client-side requires destructively unreading chapters across the server. |
| **4. Browse** | **APK Extension Lifecycle Management** | Suwayomi-Server runs headlessly on JVM/Docker. Extension installation, updates, and removals are managed server-side and cannot be triggered via standard REST endpoints. |
| **4. Browse** | **Extension Repository Mutations** | Suwayomi-Server does not expose endpoints to commit third-party repository URLs to its configuration file. |
| **5. Manga Details** | **Page Previews (`PagePreviewScreen`)** | Requires Kotlin source extensions implementing the `PagePreviewSource` interface. Suwayomi does not expose page preview thumbnails via REST. |
| **5. Manga Details** | **Custom Cover Binary Upload** | Suwayomi-Server supports metadata editing but provides no REST endpoint to upload custom binary cover images. |
| **6. Reader** | **Hardware Volume Key Navigation** | Modern web browsers cannot intercept physical device volume rocker keys due to OS-level media control sandboxing. |
| **7. More** | **Cumulative Per-Second Read Timestamps** | Suwayomi-Server records `lastReadAt` dates but no elapsed duration timer per chapter. `StatsView` correctly displays Mihon's `"None"` fallback. |
| **7. More** | **Incognito Backend History Suppression** | Suwayomi-Server REST API has no incognito session mode; history suppression is enforced strictly client-side. |
| **8. Settings** | **Discord Rich Presence (RPC)** | Discord desktop RPC relies on local Unix domain sockets or IPC pipes, which are inaccessible from web browsers without a native daemon. |
| **8. Settings** | **`.tachibk` Database Full Restore** | Suwayomi-Server lacks an API to ingest and replace its internal database with `.tachibk` Protobuf files. The client validates backups in-browser and provides export. |
