# Architectural Audit & Refactoring Roadmap: `mihon-vue`

**Role:** Principal Frontend Architect (Vue 3 / Nuxt Ecosystems)  
**Date:** October 2026  
**Target:** `src/` (309 total source files: 161 `.vue` SFCs, 77 `.ts` modules, 68 locales, 2 SCSS stylesheets)  
**Status:** Brutal Architectural Assessment & Actionable Roadmap

---

## 1. Executive Summary

A comprehensive architectural audit of the `mihon-vue` codebase was executed across four parallel domains: (1) Directory Structure & Routing Boundaries, (2) Component Health & SFC Anti-Patterns, (3) State Management & Data Flow, and (4) Types, Dead Code & Asset Hygiene.

While the application achieves functional execution as a headless REST/GraphQL client for Suwayomi-Server, its internal architecture suffers from **critical structural entropy, inverted data flow, and pervasive single-responsibility violations**. Nearly two-thirds of the component tree consists of monolithic "god components" combining DOM hacking, manual layout physics, cryptographic hashing, and direct network querying.

```
Total Vue Components: 161
├── God Components (>= 300 LOC):   102 (63.4%)
├── Mega God Components (>= 1,000 LOC): 14 (8.7%)
├── Unscoped <style> Tags (CSS Leaks): 44 (27.3%)
├── Views Mutating document.body DOM:  15 (9.3%)
└── Dead Code & Abandoned Modules:     2,002 LOC (+ 1,049 LOC duplicate theme data)
```

### The Top 3 Most Critical Architectural Bottlenecks

1. **Severe Component Bloat & Responsibility Smuggling (The "Mega God" Phenomenon)**  
   14 components exceed 1,000 lines (peaking at `MangaView.vue` at 1,455 lines and 55.6 KB). Views are not merely view controllers; they encapsulate complex background polling loops, unbatched REST/GraphQL calls, manual touch gesture math, and custom CSS engines. For example, `TrackerSearchView.vue` contains 698 lines of bespoke CSS reinventing Vuetify buttons and text fields from scratch, while `SourceView.vue` executes chunked MD5 hashing in the UI thread across 100,000 permutations to resolve stub source identities.
2. **Inverted Data Flow, Bypassed State & Sequential HTTP Flooding**  
   The state architecture oscillates between chaotic bypasses and monolithic store bloat. Over 25 `.vue` views and components execute direct network calls, with `DebugInfoView.vue` importing `ofetch` directly. State synchronization frequently abandons Vue's reactivity system entirely, resorting to browser-level custom DOM events (`window.dispatchEvent(new CustomEvent('mihon:notes-updated'))`) or module-level singleton pseudo-stores with interval memory leaks (`useDownloadQueue.ts`). Bulk actions trigger catastrophic sequential N+1 HTTP loops (e.g., `suwayomiStore.markMangasRead` fires up to 255 unbatched sequential REST requests instead of utilizing Suwayomi's native GraphQL batch mutations). Furthermore, there is no distinction between **Global App State** and **Local Screen State**, leading to proposals that inadvertently bloat Pinia with transient query caches.
3. **Total Structural Boundary Failure & Monolithic Pseudo-Routing**  
   The application possesses **zero layout abstraction** (`src/layouts/` does not exist). Instead, `App.vue` (278 lines) acts as a god-layout containing navigation rails, bottom bars, banner states, and a brittle 12-branch `back()` router logic state machine. Screen-level views are arbitrarily split down the middle: 6 full settings screens live in `src/components/settings/*Screen.vue`, while 3 live in `src/views/Settings*View.vue`. Furthermore, 19 distinct routes funnel into `SettingsView.vue`, which simulates an ad-hoc router outlet via a 17-branch `v-if`/`v-else-if` cascade, manipulating child component instances via template `ref`s.

---

## 2. Structural & Boundary Violations

### 2.1 Misplaced Components & Inverted Boundaries

The distinction between **Views/Pages** (routable entry points), **Layouts** (structural shells), and **Components** (isolated, reusable UI units) is broken across the project:

#### 1. Screen-Level Views Buried in `src/components/`
Six full-page settings screens—complete with route parameters, toolbar management, and business logic—are hidden inside `src/components/settings/`:
- [`src/components/settings/ReaderSettingsScreen.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/components/settings/ReaderSettingsScreen.vue) (625 lines)
- [`src/components/settings/SettingsBrowseScreen.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/components/settings/SettingsBrowseScreen.vue) (491 lines — imports and uses `useRouter` directly)
- [`src/components/settings/SettingsDataScreen.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/components/settings/SettingsDataScreen.vue) (578 lines — imports and uses `useRouter` directly)
- [`src/components/settings/SettingsDownloadScreen.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/components/settings/SettingsDownloadScreen.vue) (807 lines)
- [`src/components/settings/SettingsSecurityScreen.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/components/settings/SettingsSecurityScreen.vue) (545 lines)
- [`src/components/settings/SettingsTrackingScreen.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/components/settings/SettingsTrackingScreen.vue) (451 lines)

Meanwhile, the other three settings screens live in `src/views/`:
- `src/views/SettingsAdvancedView.vue` (405 lines)
- `src/views/SettingsAppearanceView.vue` (733 lines)
- `src/views/SettingsLibraryView.vue` (442 lines)

There is zero architectural rationale for this split; it is purely accidental file placement.

#### 2. Views Doubling as Embedded UI Widgets (`embedded?: boolean`) & The Container/Panel Pattern
At least **8 views** currently accept an `embedded?: boolean` or `standalone?: boolean` prop so they can be conditionally inlined inside other views (such as `SettingsView.vue` or modal dialogs):
- [`src/views/CategoriesView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/views/CategoriesView.vue)
- [`src/views/ClearDatabaseView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/views/ClearDatabaseView.vue)
- [`src/views/CreateBackupView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/views/CreateBackupView.vue)
- [`src/views/DebugInfoView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/views/DebugInfoView.vue)
- [`src/views/ExtensionStoresView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/views/ExtensionStoresView.vue)
- [`src/views/ExtensionsView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/views/ExtensionsView.vue) (936 lines — has **no route** at all; exclusively rendered as a tab in `BrowseView.vue`)
- [`src/views/OpenSourceLicensesView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/views/OpenSourceLicensesView.vue)
- [`src/views/RestoreBackupView.vue`](file:///c:/Users/dail45/Desktop/mihon-vue/src/views/RestoreBackupView.vue)

**Architectural Strategy:**
1. **Master-Detail Layouts (`SettingsLayout.vue`):** In desktop/tablet viewports, settings sub-screens should be rendered natively via nested `<router-view>` child routes rather than manual `v-if` embedding. This allows Vue Router to manage history, URL synchronization, and scroll restoration natively.
2. **Dual-Purpose Screens via the Container/Panel Pattern:** Certain screens legitimately need to open **both** as standalone routed views (with full app bar and URL history) **and** as in-situ modal dialogs or bottom sheets without mutating the browser URL (e.g., managing categories while browsing a manga or editing extension stores from browse).
   - **Anti-Pattern to eliminate:** Forcing route views to accept an `embedded` boolean and branch internal header/toolbar/scrolling logic.
   - **Enforced Solution (Container/Panel Pattern):** Extract the core presentation and interaction logic into a pure domain panel component (e.g., `CategoryManagerPanel.vue`, `ExtensionStoresPanel.vue`). Then instantiate this panel inside:
     - A lightweight routed view (`CategoriesView.vue`) that provides the standard top app bar and page scaffold.
     - A modal/sheet wrapper component (e.g., `CategoryManagerSheet.vue` or `AppDialog.vue`) when invoked without route navigation.
   - For components that are *exclusively* embedded (such as `ExtensionsView.vue`), demote them completely to domain components (e.g., `BrowseExtensionsTab.vue`).

#### 3. Flat Component Junkyard
`src/components/` contains **85 components dumped completely flat** in its root directory, mixing atomic UI controls (`Md3Switch.vue`), dialog modals (`CategoryDeleteDialog.vue`), complex composite headers (`MangaInfoHeader.vue`), and full toolbar definitions (`LibraryToolbar.vue`).

#### 4. Non-UI Code Dumped in `src/components/`
- **Domain API Client:** [`src/components/category/categoryApi.ts`](file:///c:/Users/dail45/Desktop/mihon-vue/src/components/category/categoryApi.ts) (44 lines) establishes its own `ofetch` client and duplicates endpoints already handled by `src/api/`.
- **Domain Serialization Logic:** [`src/components/sourceFilter.ts`](file:///c:/Users/dail45/Desktop/mihon-vue/src/components/sourceFilter.ts) (108 lines) defines backend filter serialization and cloning logic.
- **Stateful Composable:** [`src/components/reader/useColorFilter.ts`](file:///c:/Users/dail45/Desktop/mihon-vue/src/components/reader/useColorFilter.ts) (127 lines) creates module-scoped reactive singletons with persistence watchers inside `components/reader/`.
- **Raw SVG Vector Dataset:** [`src/components/moreIcons.ts`](file:///c:/Users/dail45/Desktop/mihon-vue/src/components/moreIcons.ts) (31 lines) and `src/components/reader/readerIcons.ts` store SVG strings in UI folders.
- **Theme Data Duplication:** [`src/components/onboarding/appThemeSchemes.ts`](file:///c:/Users/dail45/Desktop/mihon-vue/src/components/onboarding/appThemeSchemes.ts) (1,049 lines) duplicates [`src/theme/appThemes.ts`](file:///c:/Users/dail45/Desktop/mihon-vue/src/theme/appThemes.ts) (1,012 lines) almost verbatim.

#### 5. Dynamic Side-Effect Route Injection in `views/`
[`src/views/aboutLicensesRoute.ts`](file:///c:/Users/dail45/Desktop/mihon-vue/src/views/aboutLicensesRoute.ts) and [`src/views/aboutUpdateRoute.ts`](file:///c:/Users/dail45/Desktop/mihon-vue/src/views/aboutUpdateRoute.ts) call `router.addRoute()` dynamically upon module evaluation when imported by `AboutView.vue`, despite these identical routes being statically registered in `src/router/index.ts:166-167`.

#### 6. Route Bloat & Route Shadowing Bug
- **Silent Route Shadowing:** [`src/router/index.ts:8-9`](file:///c:/Users/dail45/Desktop/mihon-vue/src/router/index.ts#L8-L9) declares `{ path: '/manga/:id(\\d+)/notes' }` twice consecutively. The second entry silently overwrites the first, stripping the `meta.manga: true` flag.
- **Settings Route Sprawl:** 19 distinct route definitions ([`router/index.ts:49-150`](file:///c:/Users/dail45/Desktop/mihon-vue/src/router/index.ts#L49-L150)) resolve to `SettingsView.vue`, which acts as a manual router outlet via 17 cascading `v-if`/`v-else-if` statements.

---

### 2.2 Target Architecture: Domain-Driven Modular (Feature-Based)

#### Architectural Justification
- **Why not Layer-Based (`views/`, `components/`, `stores/`)?**  
  A pure layer-based structure is precisely what caused this codebase to degrade. As the application grew to 160+ components and 10 features, flat layer folders became dumping grounds where domain cohesion was lost.
- **Why not Feature-Sliced Design (FSD)?**  
  FSD introduces heavy formal overhead (`app/`, `processes/`, `pages/`, `widgets/`, `features/`, `entities/`, `shared/`) with rigid cross-import rules that are overengineered for a client-side reader application.
- **The Ideal Choice: Domain-Driven Modular Layout**  
  Mihon has clear, bounded functional domains: **Library, Browse, Manga, Reader, Updates, History, Migration, Settings, Trackers, Downloads**. Grouping views, components, composables, and feature-specific utilities by domain while providing clear global abstractions (`app/layouts/`, `core/`) achieves high cohesion, low coupling, and natural code-splitting boundaries.

#### Target Directory Tree
```text
src/
├── app/                          # Application shell & initialization
│   ├── App.vue                   # Root component (theme provider & layout host ONLY)
│   ├── layouts/                  # True layout wrappers with <router-view>
│   │   ├── DefaultLayout.vue     # Nav rail / bottom bar + responsive top bar
│   │   ├── ReaderLayout.vue      # Pure black, zero chrome, immersive viewport
│   │   ├── SettingsLayout.vue    # TwoPanelBox master-detail split layout
│   │   └── FullscreenLayout.vue  # Onboarding, crash, unlock
│   └── main.ts
├── core/                         # Cross-domain primitives & design system
│   ├── api/                      # Unified Suwayomi API client & HTTP interceptors
│   │   ├── client.ts             # Base client with AbortSignal & deduping
│   │   ├── endpoints/            # Domain endpoint modules
│   │   └── types.ts              # Canonical DTO models (Manga, Chapter, Category)
│   ├── assets/                   # Vector assets, fonts, brand SVGs
│   ├── components/               # Pure design-system primitives (no domain knowledge)
│   │   ├── Md3Switch.vue
│   │   ├── Md3Slider.vue
│   │   ├── Md3CircularProgress.vue
│   │   └── AppDialog.vue         # Standardized M3 modal with centralized constraints
│   ├── composables/              # Cross-cutting composables (responsive, theme, layout)
│   ├── i18n/                     # Localization catalog & formatters
│   ├── theme/                    # Single source of truth for MD3 color schemes
│   └── utils/                    # Pure utility functions (dates, markdown, formatting)
├── features/                     # Domain modules (Feature-Driven)
│   ├── library/                  # Library & Category Management
│   │   ├── components/           # LibraryToolbar, CategoryTabs, LibraryListItem, etc.
│   │   ├── stores/               # useLibraryStore (categories, items, selection)
│   │   └── views/
│   │       ├── LibraryView.vue
│   │       └── CategoriesView.vue
│   ├── browse/                   # Sources, Extensions & Global Search
│   │   ├── components/           # SourceFilterDialog, ExtensionPill, GlobalSearchToolbar
│   │   ├── stores/               # useSourcesStore, useExtensionsStore
│   │   ├── utils/                # sourceFilter.ts, sourceLanguage.ts
│   │   └── views/
│   │       ├── BrowseView.vue
│   │       ├── SourceView.vue
│   │       ├── SourcePreferencesView.vue
│   │       ├── SourcesFilterView.vue
│   │       ├── GlobalSearchView.vue
│   │       ├── ExtensionDetailsView.vue
│   │       └── ExtensionStoresView.vue
│   ├── manga/                    # Manga Detail & Chapter Management
│   │   ├── components/           # MangaInfoHeader, ChapterListItem, MangaCoverDialog
│   │   ├── composables/          # useMangaDetail, useChapterSelection, useMangaDownloads
│   │   └── views/
│   │       ├── MangaView.vue
│   │       └── MangaNotesView.vue
│   ├── reader/                   # Manga Reading Engine
│   │   ├── components/           # ChapterNavigator, ReaderTopBar, ReaderBottomBar
│   │   ├── composables/          # useReaderKeybindings, useColorFilter, useReaderFlash
│   │   ├── stores/               # useReaderStore, useReaderPreferencesStore
│   │   └── views/
│   │       └── ReaderView.vue
│   ├── updates/                  # Updates Feed & Upcoming Releases
│   │   ├── components/           # UpdatesAppBar, UpdatesItemRow, UpdatesBottomBar
│   │   ├── stores/               # useUpdatesStore
│   │   └── views/
│   │       ├── UpdatesView.vue
│   │       └── UpcomingView.vue
│   ├── history/                  # Reading History
│   │   ├── components/           # HistoryItem, HistoryDeleteDialog
│   │   └── views/
│   │       └── HistoryView.vue   # (Corrected name from PlannedView.vue)
│   ├── migration/                # Source & Library Migration
│   │   ├── components/           # MigrateMangaDialog, MigrationSourceCard
│   │   └── views/
│   │       ├── MigrationListView.vue
│   │       ├── MigrationConfigView.vue
│   │       └── MigrateSearchView.vue
│   ├── settings/                 # Application Configuration
│   │   ├── components/           # PreferenceCheckbox, AdaptiveSettingsSheet
│   │   ├── stores/               # usePreferencesStore, useSettingsHighlightStore
│   │   └── views/                # Unified settings views (*View.vue convention)
│   │       ├── SettingsMainView.vue
│   │       ├── SettingsAppearanceView.vue
│   │       ├── SettingsLibraryView.vue
│   │       ├── SettingsReaderView.vue    (was ReaderSettingsScreen.vue)
│   │       ├── SettingsDownloadView.vue  (was SettingsDownloadScreen.vue)
│   │       ├── SettingsTrackingView.vue  (was SettingsTrackingScreen.vue)
│   │       ├── SettingsBrowseView.vue    (was SettingsBrowseScreen.vue)
│   │       ├── SettingsDataView.vue      (was SettingsDataScreen.vue)
│   │       ├── SettingsSecurityView.vue  (was SettingsSecurityScreen.vue)
│   │       ├── SettingsAdvancedView.vue
│   │       ├── SettingsSearchView.vue
│   │       ├── ClearDatabaseView.vue
│   │       ├── CreateBackupView.vue
│   │       ├── RestoreBackupView.vue
│   │       └── DebugInfoView.vue
│   ├── downloads/                # Download Queue Manager
│   │   ├── composables/          # useDownloadQueue
│   │   └── views/
│   │       └── DownloadQueueView.vue
│   ├── trackers/                 # External Tracker Integrations
│   │   ├── components/           # TrackInfoDialog, TrackStatusSelector, TrackDatePicker
│   │   ├── composables/          # useTracking
│   │   └── views/
│   │       ├── TrackerSearchView.vue
│   │       └── TrackerLoginView.vue
│   └── onboarding/               # First-Run Experience
│       ├── components/           # GuidesStep, PermissionStep, StorageStep, ThemeStep
│       └── views/
│           └── OnboardingView.vue
└── router/                       # Modular route configuration
    ├── index.ts                  # Master router instance
    └── routes/                   # Feature-specific route tables
```

---

### 2.3 Migration Mapping (`Current Path -> Target Path`)

#### Misplaced & Misnamed Views
| Current Path | Target Path | Reason & Architectural Action |
| :--- | :--- | :--- |
| `src/views/PlannedView.vue` | `src/features/history/views/HistoryView.vue` | **Misnomer**: Component is actually the History screen (`HistoryScreen.kt`). Rename to match route and domain. |
| `src/components/settings/ReaderSettingsScreen.vue` | `src/features/settings/views/SettingsReaderView.vue` | **Misplaced Screen**: Elevate from components to settings feature views. Enforce `*View` naming. |
| `src/components/settings/SettingsBrowseScreen.vue` | `src/features/settings/views/SettingsBrowseView.vue` | **Misplaced Screen**: Elevate from components to settings feature views. |
| `src/components/settings/SettingsDataScreen.vue` | `src/features/settings/views/SettingsDataView.vue` | **Misplaced Screen**: Elevate from components to settings feature views. |
| `src/components/settings/SettingsDownloadScreen.vue` | `src/features/settings/views/SettingsDownloadView.vue` | **Misplaced Screen**: Elevate from components to settings feature views. |
| `src/components/settings/SettingsSecurityScreen.vue` | `src/features/settings/views/SettingsSecurityView.vue` | **Misplaced Screen**: Elevate from components to settings feature views. |
| `src/components/settings/SettingsTrackingScreen.vue` | `src/features/settings/views/SettingsTrackingView.vue` | **Misplaced Screen**: Elevate from components to settings feature views. |
| `src/views/ExtensionsView.vue` | `src/features/browse/components/BrowseExtensionsTab.vue` | **Demote View**: Unrouted component; acts purely as a child tab inside `BrowseView.vue`. |
| `src/views/aboutLicensesRoute.ts` | **Delete** | Eliminate side-effect router mutation; register statically in `routes/about.routes.ts`. |
| `src/views/aboutUpdateRoute.ts` | **Delete** | Eliminate side-effect router mutation; register statically in `routes/about.routes.ts`. |

#### Non-UI Files inside `src/components/`
| Current Path | Target Path | Reason & Architectural Action |
| :--- | :--- | :--- |
| `src/components/category/categoryApi.ts` | **Delete** | Dead duplicated API code. Endpoint exists in `src/api/categories.ts`. |
| `src/components/sourceFilter.ts` | `src/features/browse/utils/sourceFilter.ts` | Domain data transformation; move out of UI components root. |
| `src/components/moreIcons.ts` | `src/core/assets/moreIcons.ts` | Static SVG vector data; move to core assets. |
| `src/components/onboarding/appThemeSchemes.ts` | **Delete** | 1,049 lines of 100% duplicated palette data; use `src/theme/appThemes.ts`. |
| `src/components/reader/useColorFilter.ts` | `src/features/reader/composables/useColorFilter.ts` | Move stateful composable out of components folder. |
| `src/components/reader/readerContentOverlay.ts` | `src/features/reader/utils/readerContentOverlay.ts` | Extract helper logic from SFC directory. |
| `src/components/reader/chapterTransition.ts` | `src/features/reader/utils/chapterTransition.ts` | Extract transition math from SFC directory. |
| `src/components/reader/readerPageIndicator.ts` | `src/features/reader/utils/readerPageIndicator.ts` | Extract geometry helper from SFC directory. |
| `src/components/reader/readerIcons.ts` | `src/features/reader/assets/readerIcons.ts` | Move SVG dataset to feature assets. |

#### Dead Code Files to Safely Delete (~2,002 LOC)
| Dead File Path | LOC | Reason for Immediate Deletion |
| :--- | :--- | :--- |
| `src/views/ExtensionInstallView.vue` | 739 | Unrouted, unimported standalone stub; extensions install in-situ. |
| `src/views/WebViewView.vue` | 404 | Unrouted, unimported stub; external URLs open via `window.open`. |
| `src/components/HomeNavigation.vue` | 244 | Abandoned navigation drawer; `App.vue` hardcodes its own navigation. |
| `src/views/AppMigratingView.vue` | 202 | Unrouted, unimported database migration screen; client is headless REST. |
| `src/views/UnlockView.vue` | 176 | Unrouted, unimported biometric screen; no web biometric API wired. |
| `src/components/ContentWarningEntry.vue` | 82 | Never imported; `ExtensionDetailsView.vue` inlined its own warning row. |
| `src/stores/librarySelection.ts` | 48 | **Zero usages in repo**; `LibraryView.vue` rewrote selection in local state. |
| `src/components/HomeTabTransition.vue` | 40 | Abandoned transition component; never imported. |
| `src/components/EmptyState.vue` | 12 | Generic stub; replaced by `MihonEmptyScreen.vue`. |
| `src/components/PreferenceChoice.vue` | 11 | Unused stub; settings screens use inline dialogs. |

---

## 3. Component & Logic Refactoring

### 3.1 The "God Components" Decomposition Guide

The following table breaks down the top god components, their architectural antipatterns, and the exact extraction blueprint:

```
Top God Components:
1. MangaView.vue (1,455 lines) ────────► Polling + Direct API + Touch Math + 8 Modals
2. TrackerSearchView.vue (1,307 lines) ─► 698 Lines of Raw CSS + Manual Touch Gestures
3. SourceView.vue (1,279 lines) ────────► 100k MD5 Hashes on UI Thread + Filter DTO Logic
4. ExtensionsView.vue (1,254 lines) ────► FastScroller Drag Physics + Storage Watchers
5. TrackInfoSelectors.vue (1,105 lines) ─► 4 Pickers (Status, Number, Score, Custom Calendar)
```

#### Detailed Breakdown of Key Hotspots

#### 1. `src/views/MangaView.vue` (1,455 lines, 55.6 KB)
- **Pathologies:**
  - **Inline Polling Engine:** Lines 554–680 manage `window.setInterval` loops, queue parsing, cancelled download sets, and percentage math directly in the component.
  - **Direct REST API Calls:** Lines 445–504 instantiate `createSuwayomiApi` and execute bulk `modifyChapter` loops, bypassing Pinia stores.
  - **Selection Mode Controller:** Lines 134–170 and 524–543 implement range selection, long-press handlers, and route-leave guards.
  - **Scroll Physics & Alpha Calculations:** Lines 178–191 and 685–750 imperatively track `window` scroll, computing `getBoundingClientRect().bottom > 64` to toggle toolbar opacity and FAB expansion.
  - **Modal Nesting:** Directly inlines 8 separate dialogs and bottom sheets.
  - **DOM Mutation & CSS Leak:** Line 214 calls `document.body.classList.add('manga-detail-screen')` paired with 232 lines of unscoped CSS to hide the app toolbar.
- **Extraction Target:**
  - `useMangaDownloads(mangaId)`: Download queue polling, enqueue/dequeue/cancel actions.
  - `useChapterSelection(chapters)`: Selection set, range selection, action mode state machine.
  - `useScrollAlpha(targetRef)`: Scroll tracking and header alpha interpolation.
  - `MangaToolbar.vue`: 64dp contextual top bar and action menu.
  - `MangaResumeFab.vue`: FAB button with expansion physics and next-unread chapter resolver.

#### 2. `src/views/TrackerSearchView.vue` (1,307 lines, 39.2 KB)
- **Pathologies:**
  - **698 Lines of Bespoke CSS (Lines 609–1306):** Rebuilds buttons, state layers, text inputs, cards, and bottom action bars from scratch instead of using Vuetify 4 components.
  - **Reinventing Touch Gestures (Lines 105–120):** Implements manual `setTimeout` timers to detect long-press events.
  - **Direct GraphQL Operations:** Runs tracker search and bind queries directly inside the component.
- **Extraction Target:**
  - Refactor template to use native Vuetify 4 components (`<v-app-bar>`, `<v-text-field>`, `<v-card>`, `<v-btn>`), eliminating ~600 lines of CSS.
  - `TrackerSearchResultCard.vue`: Card UI, metadata presentation, contextual menu.
  - `useTrackerSearch(trackerId, mangaId)`: Search debounce, query execution, bind mutation.

#### 3. `src/views/SourceView.vue` (1,279 lines, 47.2 KB)
- **Pathologies:**
  - **CPU-Blocking Cryptographic Calculations (Lines 105–120):** Runs synchronous cross-product permutations (1,500 extension names × 67 language codes) computing MD5 hashes directly on the browser main thread to resolve stub source IDs.
  - **Filter Tree Transformation (Lines 55–57):** Complex serialization, deep-cloning, and diffing of nested filter objects inside the view.
- **Extraction Target:**
  - `resolveStubSourceIdentity`: Move cryptographic hashing to a Web Worker or memoized background service map.
  - `SourceFilterSheet.vue`: Bottom sheet managing source filter cloning and serialization.
  - `SourceToolbar.vue`: Search bar, display mode dropdown, and filter chips.
  - `useSourceCatalogue(sourceId)`: Pagination, infinite scrolling, query state.

#### 4. `src/views/ExtensionsView.vue` (1,254 lines, 45.5 KB)
- **Pathologies:**
  - **Global Window Listeners (Lines 106–116):** Attaches `storage` and `focus` event listeners to `window` for manual cross-tab updates.
  - **FastScroller Physics Engine (Lines 547–552):** Manual pointer drag, scroll position interpolation, and thumb coordinates math.
- **Extraction Target:**
  - `useExtensionsStore`: Pinia store holding installed, available, and untrusted extension lists.
  - `useFastScroller(containerRef)`: Reusable composable for touch/pointer drag scroller mechanics.
  - Demote file to `BrowseExtensionsTab.vue` inside `src/features/browse/components/`.

#### 5. `src/components/TrackInfoSelectors.vue` (1,105 lines, 39.8 KB)
- **Pathologies:**
  - **Four Independent Modal Widgets Crammed into One File:** Status radio selector, chapter number vertical wheel picker, score wheel picker, and a complete custom MD3 Calendar / DatePicker with leap-year algorithms, day grids, and month navigation (Lines 350–700+).
- **Extraction Target & UX Preservation Rule:**
  - Split into 4 focused single-responsibility components:
    - `TrackStatusSelector.vue` (radio list selection)
    - `TrackNumberWheelPicker.vue` (vertical scroll wheel picker)
    - `TrackScoreWheelPicker.vue` (score scroll wheel picker)
    - `TrackDatePicker.vue` (custom MD3 calendar date picker)
  - **CRITICAL UX RULE — DO NOT REPLACE WITH GENERIC VUETIFY INPUTS:**  
    Do **NOT** replace the custom vertical wheel pickers or the custom MD3 calendar with generic Vuetify components (such as `<v-date-picker>` or `<v-text-field>`). Preserving the authentic, mobile-first Mihon Material 3 wheel-picker and calendar UX is mandatory. The refactoring here is strictly an **architectural decomposition** of a 1,100-line god-component into 4 isolated, testable child components—not a UX redesign. (Note: Replacing raw bespoke CSS buttons/appbars in `TrackerSearchView.vue` with Vuetify remains fully approved, as that merely standardizes standard controls).

#### 6. `src/views/ReaderView.vue` (965 lines, 40.3 KB)
- **Pathologies:**
  - **Reactivity Hack via `prefTick` (Lines 75–110):** `const prefTick = ref(0)` is injected into 5 separate `computed` properties (`void prefTick.value`) to force manual cache invalidation because preferences are read from non-reactive `localStorage`.
  - **Fullscreen Flash Timer (Lines 254–285):** Imperative timer managing page-turn flash colors.
  - **Keyboard Event Dispatcher (Lines 336–390):** 60-line imperative key listener handling N, P, Home, End, Space, Escape, etc.
- **Extraction Target:**
  - Eliminate `prefTick`; drive reader settings from the reactive `useReaderPreferencesStore`.
  - `useReaderKeybindings(actions)`: Dedicated keyboard navigation composable.
  - `useReaderFullscreen(containerRef)`: Fullscreen API management composable.

---

### 3.2 State Management & Data Flow Remediation

#### 1. The Two-Tier State Rule (Pragmatic Data Flow)
A common architectural antipattern is forcing all server data into global Pinia stores. This causes state pollution, memory leaks, stale caches across route changes, and quickly recreates monolithic God Stores. 

We establish a strict **Two-Tier State Rule**:
- **Tier 1: Global App State (`API Client -> Pinia Store -> View/Component`)**
  - **Scope:** State that outlives the active screen and is shared across multiple unrelated features.
  - **Entities:**
    - Server Connection & Authentication (`useConnectionStore`)
    - Library Collection & Categories (`useLibraryStore`)
    - Installed & Available Extensions (`useExtensionsStore`)
    - Active Download Queue (`useDownloadQueueStore` / Pinia)
    - User Preferences & Theme Configuration (`usePreferencesStore`, `useAppearanceStore`)
- **Tier 2: Local Screen State (`API Client -> Domain Composable -> View`)**
  - **Scope:** Ephemeral queries, transient search results, pagination cursors, and single-entity detail screens.
  - **Lifecycle:** Bound to the mounting component; automatically cleaned up on unmount or `onScopeDispose()`. Never stored in Pinia.
  - **Entities:**
    - Single Manga Details & Chapters (`useMangaDetail(mangaId)`)
    - Tracker Search Queries & Bind Dialogs (`useTrackerSearch()`)
    - Source Catalogue Filtering & Infinite Scrolling (`useSourceCatalogue(sourceId)`)
    - Migration Search Results (`useMigrateSearch()`)

#### 2. Eliminate Monolithic God Store (`src/stores/suwayomi.ts`)
`useSuwayomiStore` currently conglomerates server connectivity, library structure, active manga details, sources catalog, and 8 pairs of transient loading/error booleans.
- **Refactoring Blueprint:**
  - `useConnectionStore`: `apiUrl`, server version, connection status, auth headers.
  - `useLibraryStore`: Categories, manga-by-category mappings, library loading/mutating state.
  - `useSourcesStore`: Source catalog, pinned sources, extension repositories.
  - Active manga and transient catalogue state are moved to **Tier 2 Domain Composables** (`useMangaDetail`, `useSourceCatalogue`).

#### 3. Fix Computed Mutation Anti-Pattern in `src/stores/chapterSettings.ts`
In [`src/stores/chapterSettings.ts:20`](file:///c:/Users/dail45/Desktop/mihon-vue/src/stores/chapterSettings.ts#L20):
```typescript
function forManga(apiUrl: string, id: number) { 
  const key = `${apiUrl}::${id}`
  return items.value[key] ||= { ...defaults.value } // <-- MUTATION INSIDE COMPUTED GETTER!
}
```
When consumed via `computed(() => chapterPreferences.forManga(...))` in `MangaView.vue`, reading the computed property triggers a state mutation, which activates a deep watcher that executes a synchronous `JSON.stringify` write to `localStorage`.
- **Fix:** Return `{ ...(items.value[key] ?? defaults.value) }` without mutating `items.value`. Only initialize the key when a write action is explicitly called.

#### 4. Resolve Stale Closure Bug & Memory Leaks in `useDownloadQueue.ts`
- **Bug 1 (Stale Closure):** `useDownloadQueue(apiUrl: string)` takes a primitive string. When `server.apiUrl` changes in `DownloadQueueView.vue`, the composable closure retains the old URL.
  - **Fix:** Accept `MaybeRefOrGetter<string>` and resolve with `toValue(apiUrl)`.
- **Bug 2 (Interval Leak):** `poll()` sets `window.setInterval` but the composable has no `onScopeDispose` cleanup.
  - **Fix:** Register `onScopeDispose(() => { if (timer) clearInterval(timer) })`.

#### 5. Eradicate Module-Scope Pseudo-Stores & Global Event Buses
- **`useAppearancePreferences.ts`**: Contains 7 module-scope `ref`s and 8 top-level `watch`ers. Every time the composable is called, a duplicate watcher on `themeMode` is added.
  - **Fix:** Convert to a standard Pinia store `useAppearanceStore`.
- **`src/utils/browsePreferences.ts` & `src/utils/sourcePins.ts`**: Contain module-scope `ref`s and persistence watchers inside pure utility files.
  - **Fix:** Move into `useBrowsePreferencesStore`.
- **`window.dispatchEvent('mihon:notes-updated')`**: Notes are synchronized across components via DOM events.
  - **Fix:** Store notes in `useMangaNotesStore` or reactive Pinia state.

#### 6. Eradicate Sequential N+1 HTTP Request Floods
In [`src/stores/suwayomi.ts:163-172`](file:///c:/Users/dail45/Desktop/mihon-vue/src/stores/suwayomi.ts#L163-L172) (`markMangasRead`):
```typescript
for (const manga of mangas) {
  const chapters = await api.chapters(manga.id)
  for (const chapter of chapters) {
    await api.modifyChapter(manga.id, chapter.index, { read }) // Up to 255 sequential calls!
  }
}
```
- **Prioritized Fix:**
  1. **Primary Strategy (Suwayomi GraphQL Batch Mutation):** Utilize Suwayomi-Server's native GraphQL batch mutation (`updateChapters(input: { ids, patch: { isRead } })`) to update all chapters across selected manga in a single HTTP request roundtrip.
  2. **Fallback Strategy (Concurrency-Limited Batching):** For legacy REST endpoints lacking native batch mutations, enforce client-side concurrency control via `p-limit` (concurrency 5-6) rather than unbounded sequential execution:
```typescript
import pLimit from 'p-limit'
const limit = pLimit(6)
await Promise.all(chapters.map(ch => limit(() => api.modifyChapter(manga.id, ch.index, { read }))))
```

---

## 4. Code Quality & Standardization

### 4.1 Naming & Organization Conventions

| Target | Convention | Rule & Examples |
| :--- | :--- | :--- |
| **Routed Views** | `PascalCase` + `*View.vue` | All routable page components must end with `View.vue` (e.g. `LibraryView.vue`, `HistoryView.vue`). Never use `*Screen.vue` or `*Page.vue`. |
| **Layout Components** | `PascalCase` + `*Layout.vue` | Structural shell components must end with `Layout.vue` (e.g. `DefaultLayout.vue`, `SettingsLayout.vue`). |
| **Dialog Modals** | `PascalCase` + `*Dialog.vue` | Modals must end with `Dialog.vue` (e.g. `CategoryDeleteDialog.vue`). |
| **Bottom Sheets** | `PascalCase` + `*Sheet.vue` | Slide-up sheets must end with `Sheet.vue` (e.g. `AdaptiveSettingsSheet.vue`). |
| **List/Grid Items** | `PascalCase` + `*Item.vue` | Row/grid presentation items must end with `Item.vue` (e.g. `HistoryItem.vue`). |
| **Composables** | `camelCase` + `use*` prefix | Must begin with `use` and live in `composables/` (e.g. `useMangaDownloads.ts`). Pure scripts must never use the `use*` prefix (e.g. rename `useSecureScreen.ts` to `secureScreen.ts`). |
| **Domain Utilities** | `camelCase` + `.ts` | Pure helper functions (e.g. `sourceFilter.ts`). Never place `.ts` files inside `components/`. |

---

### 4.2 TypeScript Quality & Reactivity Standards

#### 1. Configure Path Aliases (`@/`)
Add `@/` to `tsconfig.json` and `vite.config.ts`, replacing all 40 fragile relative `../../` imports:
```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

#### 2. Eliminate `any` and `as unknown as` Casts
- **Missing `Manga` Model Properties:** Add `favorite?: boolean`, `readerOrientation?: number | null`, and `viewer?: number | null` to `Manga` in [`src/api/types.ts:29`](file:///c:/Users/dail45/Desktop/mihon-vue/src/api/types.ts#L29). This immediately eliminates `(manga as any).favorite` in `MangaCard.vue` and `MangaBadges.vue`, as well as `as unknown as` assertions in `OrientationSelectDialog.vue`.
- **Intl Week Info Triplication:** Declare the standard extension in `src/vite-env.d.ts`:
  ```typescript
  interface LocaleWeekInfo { firstDay: number }
  interface IntlLocale { getWeekInfo?: () => LocaleWeekInfo }
  ```
  This eliminates duplicate double-casts in `TrackInfoSelectors.vue`, `UpdatesCalendarDialog.vue`, and `UpcomingView.vue`.
- **Centralize `GraphQLResponse<T>`:** Consolidate the definition repeated across 7 API files into `src/core/api/types.ts`.

#### 3. Eliminate Dual `<script>` Blocks
Remove the `<script lang="ts">` + `<script setup lang="ts">` pattern from the 7 affected components (`MangaBottomActionMenu.vue`, `ChapterNavigator.vue`, `UpdatesBottomBar.vue`, etc.) by moving exported interfaces to dedicated `types.ts` files or using Vue 3.3+ type export syntax.

---

### 4.3 Styling & Vuetify 4 Integration

#### 1. Eradicate Imperative Toolbar Hijacking (15 Views)
**The Anti-Pattern:**
```typescript
// Found across 15 views (MangaView, ClearDatabaseView, UpcomingView, etc.)
onMounted(() => document.body.classList.add('<screen>-active'))
onBeforeUnmount(() => document.body.classList.remove('<screen>-active'))
```
Paired with unscoped global CSS:
```css
body.<screen>-active .app-toolbar { display: none; }
```
If a view fails during teardown or transition, the class stays on `document.body`, permanently hiding navigation.
- **Architectural Fix:** Remove all 15 DOM mutations. Declare toolbar visibility cleanly in route metadata (`meta: { hideToolbar: true }`), and bind visibility in `App.vue` or `DefaultLayout.vue` via `v-if="!route.meta.hideToolbar"`.

#### 2. Centralize M3 Dialog Constraints (21 Components)
21 components inject unscoped `<style>` tags targeting `.v-dialog > ...` to force M3 widths (`min-width: min(280px, calc(100% - 48px)); max-width: min(560px, ...)`).
- **Architectural Fix:** Move these rules into `src/styles/dialogs.scss` or configure Vuetify component defaults in `src/plugins/vuetify.ts`:
  ```typescript
  defaults: {
    VDialog: { maxWidth: 560, width: 'fit-content' }
  }
  ```

#### 3. Eliminate 301 `!important` Rules
301 CSS rules across the codebase use `!important` to fight Vuetify 4 specificity (e.g. `border-radius: 28px !important;`, ripple overlay overrides, padding overrides).
- **Architectural Fix:** Leverage Vuetify 4's `defaults` configuration in `src/plugins/vuetify.ts` to globally enforce rounded corners (`VCard: { rounded: 'xl' }`, `VDialog: { rounded: 'xl' }`), eliminating manual CSS overrides.

---

## 5. Prioritized Action Plan (Phased Roadmap)

> [!CAUTION]
> ### Strict Execution Guardrail: Separation of Logic Refactoring vs. Structural Relocations
> **Never mix internal component logic refactoring with mass file relocations in the same step or Git commit.**  
> - **Phases 1 and 2** must be executed entirely within the **current directory structure**. All dead code deletions, bug fixes, store/composable sanitization, and god-component decompositions into child components must be completed, type-checked (`vue-tsc -b`), and verified with tests in-place.
> - **Phase 3** represents the structural transition to `src/features/*` and `src/app/layouts/`. It must be executed as an isolated structural migration step (file moves + import path updates) only after the components and logic have already been decoupled and stabilized. This prevents catastrophic import breakage, protects Git blame history (`git log --follow`), and ensures regressions can be isolated immediately.

```mermaid
flowchart TD
    subgraph Phase 1: Quick Wins & Dead Code (In-Place)
        P1_1[Delete 2,002 LOC Dead Code] --> P1_2[Deduplicate 1,049 LOC Theme Data]
        P1_2 --> P1_3[Fix Duplicate Route Bug in router/index.ts]
        P1_3 --> P1_4[Configure @/ Path Alias in tsconfig & vite]
        P1_4 --> P1_5[Eliminate 15 body.classList Toolbar Mutations]
    end

    subgraph Phase 2: Logic Extraction & Decoupling (In-Place)
        P2_1[Extract useMangaDownloads & useChapterSelection from MangaView]
        P2_2[Decompose TrackInfoSelectors into 4 Wheel/Calendar Pickers preserving MD3 UX]
        P2_3[Refactor TrackerSearchView to Native Vuetify Components]
        P2_4[Fix computed Mutation in chapterSettings.ts]
        P2_5[Fix Stale Closure & Interval Leak in useDownloadQueue.ts]
        P2_6[Add favorite & orientation to Manga DTO in types.ts]
    end

    subgraph Phase 3: Deep Architectural Overhaul (Structural Move)
        P3_1[Create src/app/layouts/ Default, Reader, Settings]
        P3_2[Settings Nested Routes & Container/Panel Pattern for Dual-Purpose Screens]
        P3_3[Isolated File Move into Domain-Driven src/features/]
        P3_4[Unified suwayomiClient with GraphQL Batching & Two-Tier State Rules]
        P3_5[Split suwayomiStore into Connection, Library, Sources]
    end

    Phase 1 --> Phase 2 --> Phase 3
```

---

### Phase 1: Quick Wins & Structural Cleanup (Low Risk — In-Place)
*Goal: Remove technical debt, dead weight, and global side-effects within the current directory structure without altering application functionality.*

1. **[x] Purge Abandoned Dead Code (~2,002 LOC):**
   - [x] Delete `src/views/ExtensionInstallView.vue`
   - [x] Delete `src/views/WebViewView.vue`
   - [x] Delete `src/components/HomeNavigation.vue`
   - [x] Delete `src/views/AppMigratingView.vue`
   - [x] Delete `src/views/UnlockView.vue`
   - [x] Delete `src/components/ContentWarningEntry.vue`
   - [x] Delete `src/stores/librarySelection.ts`
   - [x] Delete `src/components/category/categoryApi.ts`
   - [x] Delete `src/components/HomeTabTransition.vue`
   - [x] Delete `src/components/EmptyState.vue`
   - [x] Delete `src/components/PreferenceChoice.vue`
2. **[x] Deduplicate Theme Schemes (~1,049 LOC):**
   - [x] In `src/components/onboarding/ThemeStep.vue`, replace import of `appThemeSchemes.ts` with `src/theme/appThemes.ts`.
   - [x] Delete `src/components/onboarding/appThemeSchemes.ts`.
3. **[x] Fix Critical Route Bugs in `src/router/index.ts`:**
   - [x] Remove duplicate line 8: `{ path: '/manga/:id(\\d+)/notes' }` and unify route metadata.
   - [x] Statically declare `/about/licenses`, `/about/update`, and `/new-update`.
   - [x] Remove side-effect route injection scripts `aboutLicensesRoute.ts` and `aboutUpdateRoute.ts` and delete files.
4. **[x] Configure `@/` Path Alias:**
   - [x] Add alias to `tsconfig.json`, `vite.config.ts`, and `vitest.config.ts`.
5. **[x] Eliminate Body Class DOM Mutations (15 Views):**
   - [x] Add declarative support in `src/App.vue` (`!route.meta.ownToolbar && !route.meta.hideToolbar`).
   - [x] Remove `document.body.classList.add/remove` and unscoped `.app-toolbar` `<style>` blocks from all 14 active views + deleted `WebViewView`.

---

### Phase 2: Logic Extraction & Decoupling (Medium Risk — In-Place)
*Goal: Decompose top god components, sanitize reactivity bugs, and clean the type system entirely within existing directories before any file relocations.*

1. **[x] Deconstruct Top God Components:**
   - [x] **`MangaView.vue`:** Extract `useMangaDownloads.ts`, `useChapterSelection.ts`, `MangaToolbar.vue`, and `MangaResumeFab.vue`.
   - [x] **`TrackInfoSelectors.vue`:** Decompose the 1,105-line file into 4 focused single-responsibility components:
     - `TrackStatusSelector.vue`
     - `TrackNumberWheelPicker.vue`
     - `TrackScoreWheelPicker.vue`
     - `TrackDatePicker.vue`
     - *Mandatory UX Guardrail:* **DO NOT** replace the vertical wheel pickers or custom MD3 calendar with generic Vuetify inputs or standard date pickers. The authentic Mihon mobile-first Material 3 wheel-picker and calendar UX must be strictly preserved; only the internal component architecture is decomposed.
   - [x] **`TrackerSearchView.vue`:** Decompose card rendering into `TrackerSearchResultCard.vue` and extract search logic into `useTrackerSearch.ts`.
   - [x] **`SourceView.vue`:** Move MD5 source resolution logic to memoized utility `src/utils/sourceIdentity.ts`; extract `useSourceCatalogue.ts`.
2. **[x] Sanitize Reactivity & Composables:**
   - [x] **`chapterSettings.ts`:** Remove state mutation inside `forManga()` computed getter.
   - [x] **`useDownloadQueue.ts`:** Accept `MaybeRefOrGetter<string>` and add `onScopeDispose` timer cleanup.
   - [x] **`ReaderView.vue`:** Remove `prefTick` manual invalidation hack; bind directly to reactive Pinia state (`useReaderPreferencesStore`); extract `useReaderKeybindings.ts` and `useReaderFullscreen.ts`.
   - [x] **`MangaInfoHeader.vue`:** Replace `window.dispatchEvent('mihon:notes-updated')` with reactive store state (`useMangaNotesStore`).
3. **[x] TypeScript & Model Hardening:**
   - [x] Add missing properties (`favorite`, `readerOrientation`, `viewer`) to `Manga` in `src/api/types.ts`.
   - [x] Centralize `GraphQLResponse<T>` into `src/api/types.ts`.
   - [x] Declare `Intl.Locale.prototype.getWeekInfo` in `src/vite-env.d.ts`.
   - [x] Eliminate dual `<script>` tags across the 7 affected components.

---

### Phase 3: Deep Architectural Overhaul (High Effort — Structural Move)
*Goal: Establish layout abstractions, transition to Domain-Driven feature architecture, and enforce Two-Tier state boundaries.*

1. **Introduce True Layout Abstraction (`src/app/layouts/`):**
   - Implement `DefaultLayout.vue`, `ReaderLayout.vue`, `SettingsLayout.vue`, and `FullscreenLayout.vue`.
   - Strip navigation rails, bottom bars, and banner handling out of `App.vue`, reducing it to a clean root wrapper.
2. **Overhaul Settings Routing & Container/Panel Pattern:**
   - Move the 6 misplaced `*Screen.vue` components from `src/components/settings/` into `src/features/settings/views/`.
   - Replace the 19 redundant routes and the monolithic 17 `v-if` cascade in `SettingsView.vue` with native nested `<router-view>` child routes inside `SettingsLayout.vue`.
   - **Implement the Container/Panel Pattern for Dual-Purpose Screens:** For features that open both as standalone routes and as modal sheets/dialogs without changing URLs (`CategoriesView`, `ExtensionStoresView`), extract core logic into domain panels (`CategoryManagerPanel.vue`, `ExtensionStoresPanel.vue`) and embed them in both route views and modal wrappers.
3. **Migrate to Domain-Driven Feature Directory Structure (Clean Move Commit):**
   - Execute the migration mapping defined in Section 2.3 as an isolated Git commit, grouping code by domain (`features/library/`, `features/browse/`, `features/manga/`, `features/reader/`, etc.).
   - Rename `PlannedView.vue` to `HistoryView.vue`.
   - Demote `ExtensionsView.vue` from `views/` to a tab component in `features/browse/components/BrowseExtensionsTab.vue`.
4. **Construct Unified API Client & Enforce Two-Tier State Rules:**
   - Consolidate all 18 fragmented API modules into a unified client (`src/core/api/`).
   - Forbid raw `ofetch` and direct API imports in `.vue` files.
   - **Enforce Two-Tier State Separation:**
     - **Global App State:** Bound to Pinia stores (`useConnectionStore`, `useLibraryStore`, `useExtensionsStore`, `usePreferencesStore`).
     - **Local Screen State:** Bound to domain composables (`useMangaDetail`, `useTrackerSearch`, `useSourceCatalogue`) and cleaned up with component lifecycle. Do NOT bloat Pinia with transient query results.
   - Implement `AbortController` cancellation across all endpoints.
   - **Batching:** Prioritize Suwayomi's native GraphQL batch mutation (`updateChapters(input: { ids, patch })`) for bulk chapter updates, keeping client-side `p-limit` loops only as a fallback for REST endpoints that lack batching.
5. **Split the `suwayomiStore` God Store:**
   - Decompose into `useConnectionStore`, `useLibraryStore`, and `useSourcesStore`.
   - Migrate pseudo-stores (`useAppearancePreferences`, `browsePreferences`, `sourcePins`) into proper Pinia stores.
