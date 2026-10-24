<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { useSuwayomiStore, type BatchDownloadAction } from '../stores/suwayomi'
import type { Manga } from '@/core/api/types'
import { useLibraryDetails } from '../stores/libraryDetails'
import { isLocal, matchesLibrary, sortLibrary } from '@/core/utils/library'
import { categoryVisualName, stateSelection, triSelection, type CategorySelection } from '@/core/utils/categorySelection'
import LibraryToolbar from '../components/LibraryToolbar.vue'
import LibraryCategoryTabs from '../components/LibraryCategoryTabs.vue'
import MihonEmptyScreen from '@/core/components/MihonEmptyScreen.vue'
import LibraryPager from '../components/LibraryPager.vue'
import LibrarySettingsSheet from '../components/LibrarySettingsSheet.vue'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import ServerSettingsDialog from '@/features/settings/components/ServerSettingsDialog.vue'
import MangaBottomActionMenu from '@/features/manga/components/MangaBottomActionMenu.vue'
import DeleteLibraryMangaDialog from '../components/DeleteLibraryMangaDialog.vue'
import ChangeCategoryDialog from '../components/ChangeCategoryDialog.vue'
import Md3CircularProgress from '@/core/components/Md3CircularProgress.vue'
import { useBottomNavVisibility } from '@/core/composables/useBottomNavVisibility'

/**
 * Pixel-parity port of Mihon's `ui/library/LibraryTab.kt`
 * (Mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1).
 *
 * ```kotlin
 * Scaffold(
 *     topBar = { LibraryToolbar(...) },
 *     bottomBar = {
 *         LibraryBottomActionMenu(
 *             visible = state.selectionMode,
 *             onChangeCategoryClicked = { viewModel.showChangeCategoryDialog() },
 *             onMarkAsReadClicked = { viewModel.markAsRead() },
 *             onMarkAsUnreadClicked = { viewModel.markAsUnread() },
 *             onDownloadClicked = viewModel::performDownloadAction.takeIf { … },
 *             onDeleteClicked = { viewModel.openDeleteMangaDialog() },
 *             onMigrateClicked = { viewModel.openMigrateDialog() },
 *         )
 *     },
 *     snackbarHost = { SnackbarHost(hostState) },
 * ) { padding ->
 *     when {
 *         state.isLoading -> LoadingScreen(Modifier.padding(padding))
 *         searchQuery.isNullOrEmpty() && !hasActiveFilters && isLibraryEmpty ->
 *             EmptyScreen(
 *                 message = stringResource(MR.strings.information_empty_library),
 *                 actions = listOf(
 *                     EmptyScreenAction(
 *                         stringRes = MR.strings.getting_started_guide,
 *                         icon = MaterialSymbols.AutoMirroredRounded.Help,
 *                         onClick = { openUri(GETTING_STARTED_URL) },
 *                     ),
 *                 ),
 *             )
 *         else -> LibraryContent(…)
 *     }
 * }
 * ```
 */
const server = useSuwayomiStore()
const preferences = usePreferencesStore()
const router = useRouter()
const { showBottomNav } = useBottomNavVisibility()
/** Mihon `searchQuery`: null while the search field is closed, the text while it is open. */
const query = ref<string | null>(null)
const search = computed(() => query.value ?? '')
const filtersOpen = ref(false)
const settingsOpen = ref(false)
/** `LibraryViewModel.selection`: the entries picked in the library list. */
const selection = ref<number[]>([])
/** `LibraryViewModel.Dialog.DeleteManga` */
const deleteOpen = ref(false)
/** `LibraryViewModel.Dialog.ChangeCategory` */
const changeCategoryOpen = ref(false)
/** The snackbar host of the reference (`SnackbarHost(hostState)`). */
const snackbar = ref(false)
const snackbarText = ref('')
const details = useLibraryDetails()
const sort = computed(() => preferences.getLibrarySort(server.apiUrl, server.activeCategoryId))
const requiresDetails = computed(() => preferences.filters.bookmarked !== 'all' || preferences.showContinue || ['latestChapter', 'chapterFetched'].includes(sort.value.type) || (sort.value.type === 'lastRead' && server.library.some(m => m.lastReadAt == null)))
const matches = (m: Manga) => m.title.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()) && matchesLibrary(m, preferences.filters, preferences.downloadedOnly, details.summaries[m.id], server.sources)
const visibleManga = computed(() => sortLibrary(server.library.filter(matches), sort.value, details.summaries))
const hasFilters = computed(() => preferences.downloadedOnly || Object.values(preferences.filters).some(v => v !== 'all'))
const detailsIncomplete = computed(() => requiresDetails.value && server.library.some(m => !details.summaries[m.id]))
/** `LibraryViewModel.selectedManga`: the entries of the current selection. */
const selectedManga = computed(() => Object.values(server.libraryByCategory).flat().filter(m => selection.value.includes(m.id)))
/** `containsLocalManga = dialog.manga.any(Manga::isLocal)`. */
const containsLocalManga = computed(() => selectedManga.value.some(m => isLocal(m, server.sources)))
/** `LibraryBottomActionMenu(visible = state.selectionMode, onDeleteClicked = viewModel::openDeleteMangaDialog)`. */
function openDeleteDialog() { if (selectedManga.value.length) deleteOpen.value = true }

/** `state.isLibraryEmpty` — the whole library holds no entry. */
const isLibraryEmpty = computed(() => server.totalLibraryCount === 0)
/** `state.selectionMode` — the selection is not empty. */
const selectionMode = computed(() => selection.value.length > 0)

/** Mihon `GETTING_STARTED_URL` (presentation/more/onboarding/GuidesStep.kt:59). */
const GETTING_STARTED_URL = 'https://mihon.app/docs/guides/getting-started'

function notify(message: string) {
  snackbarText.value = message
  snackbar.value = true
}

/** `EmptyScreenAction(onClick = { openUri(GETTING_STARTED_URL) })`. */
function openGettingStartedGuide() {
  window.open(GETTING_STARTED_URL, '_blank', 'noopener')
}

/* ------------------------------------------------------------------ *
 * LibraryPager (`LibraryContent.kt` -> `LibraryPager.kt`)
 * ------------------------------------------------------------------ */
/**
 * `state.displayedCategories` — one page per category of the library.
 *
 * `LibraryViewModel.applyGrouping` keeps the system category (id 0, "Default") only when
 * a library entry belongs to it (`showSystemCategory = favorites.any { it.libraryManga.categories.contains(0) }`).
 */
const categories = computed(() => server.categories.filter(category => {
  if (category.id !== 0) return true
  return (server.libraryByCategory[category.id] || []).length > 0
}))
/** `state.coercedActiveCategoryIndex` — the index of the active page. */
const currentPage = computed(() => {
  const index = categories.value.findIndex(category => category.id === server.activeCategoryId)
  return index < 0 ? 0 : index
})
/** `getItemsForCategory` — the filtered and sorted items of every category. */
const itemsByCategory = computed(() => {
  const result: Record<number, Manga[]> = {}
  for (const category of categories.value) {
    const items = (server.libraryByCategory[category.id] || []).filter(matches)
    result[category.id] = sortLibrary(items, sort.value, details.summaries)
  }
  return result
})
const categoryScrollPositions = new Map<number, number>()

/** `onChangeCurrentPage(pagerState.currentPage)`. */
function onChangeCurrentPage(page: number) {
  const category = categories.value[page]
  if (category && category.id !== server.activeCategoryId) {
    if (server.activeCategoryId != null) {
      categoryScrollPositions.set(server.activeCategoryId, window.scrollY)
    }
    server.activeCategoryId = category.id
    const targetScroll = categoryScrollPositions.get(category.id) ?? 0
    nextTick(() => {
      window.scrollTo({ top: targetScroll, behavior: 'instant' as ScrollBehavior })
    })
  }
}

onBeforeRouteLeave((to) => {
  if (to.path.startsWith('/manga/')) {
    sessionStorage.setItem('mihon.library.scrollY', String(window.scrollY))
    sessionStorage.setItem('mihon.library.activeCategory', String(server.activeCategoryId))
  }
})

/**
 * `LibraryContent.kt`:
 * LaunchedEffect(categories) {
 *     if (categories.size <= pagerState.currentPage) {
 *         pagerState.scrollToPage(categories.size - 1)
 *     }
 * }
 */
watch(categories, newCategories => {
  if (newCategories.length > 0 && currentPage.value >= newCategories.length) {
    onChangeCurrentPage(newCategories.length - 1)
  }
})

/**
 * `LibraryViewModel.getItemCountForCategory(category)`:
 * `if (showMangaCount || !searchQuery.isNullOrEmpty()) groupedFavorites[category]?.size else null`.
 */
function getItemCountForCategory(id: number): number | null {
  if (!preferences.categoryCounts && !search.value) return null
  const items = server.libraryByCategory[id] || []
  return items.filter(matches).length
}

/**
 * `LibraryTabs.kt`: the tab row uses `TabText(text = category.visualName, badgeCount = …)`,
 * where the visual name of the system category is "Default".
 */
const tabCategories = computed(() => categories.value.map(category => ({
  id: category.id,
  visualName: categoryVisualName(category),
  count: getItemCountForCategory(category.id),
})))
/** `showPageTabs = state.showCategoryTabs || !state.searchQuery.isNullOrEmpty()`. */
const showPageTabs = computed(() => preferences.categoryTabs || search.value.length > 0)

/**
 * `LibraryViewModel.getToolbarTitle(defaultTitle, defaultCategoryTitle, page)`:
 * the title is the category name while the category tabs are hidden, otherwise the
 * default title ("Library"); the count is the whole library while the tabs are shown.
 */
const toolbarTitle = computed(() => {
  const category = categories.value[currentPage.value]
  if (!category) return 'Library'
  if (preferences.categoryTabs) return 'Library'
  return categoryVisualName(category)
})
const toolbarCount = computed(() => {
  if (!preferences.categoryCounts) return null
  if (preferences.categoryTabs) {
    // `libraryData.favorites.size` — the whole library after the filters and the search.
    const ids = new Set<number>()
    for (const category of categories.value) {
      for (const manga of itemsByCategory.value[category.id] || []) ids.add(manga.id)
    }
    return ids.size
  }
  const category = categories.value[currentPage.value]
  return category ? getItemCountForCategory(category.id) : null
})

/* ------------------------------------------------------------------ *
 * Selection actions
 * ------------------------------------------------------------------ */
/** `viewModel.removeMangas(dialog.manga, deleteManga, deleteChapter); viewModel.clearSelection()`. */
async function onDeleteConfirmed(deleteManga: boolean, deleteChapters: boolean) {
  const targets = [...selectedManga.value]
  await server.removeMangas(targets, deleteManga, deleteChapters)
  selection.value = []
}
/** `viewModel.markAsRead()` / `viewModel.markAsUnread()`. */
async function onMarkAsRead() {
  const targets = [...selectedManga.value]
  await server.markMangasRead(targets, true)
  notify('Marked as read')
}
async function onMarkAsUnread() {
  const targets = [...selectedManga.value]
  await server.markMangasRead(targets, false)
  notify('Marked as unread')
}
/**
 * `ChangeCategoryDialog(initialSelection, …)`.
 * Mihon: LibraryViewModel.openChangeCategoryDialog()
 * - Hide default category (id 0)
 * - Map common categories (in all selected manga) to Checked
 * - Map mix categories (in some selected manga) to TriState.Exclude (Indeterminate)
 * - Map remaining categories to None (Unchecked)
 */
const categorySelection = computed<CategorySelection[]>(() => {
  const mangaList = selectedManga.value
  if (mangaList.length === 0) return []
  const cats = categories.value.filter(c => c.id !== 0)

  if (mangaList.length === 1) {
    const single = mangaList[0]!
    return cats.map(category => {
      const checked = (server.libraryByCategory[category.id] || []).some(m => m.id === single.id)
      return stateSelection(category, checked)
    })
  }

  const mangaCategoryIds = mangaList.map(m => {
    const ids = new Set<number>()
    for (const cat of cats) {
      if ((server.libraryByCategory[cat.id] || []).some(item => item.id === m.id)) {
        ids.add(cat.id)
      }
    }
    return ids
  })

  const common = mangaCategoryIds.reduce<Set<number>>((acc, curr) => {
    return new Set([...acc].filter(x => curr.has(x)))
  }, mangaCategoryIds[0] ? new Set(mangaCategoryIds[0]) : new Set<number>())

  const allIds = new Set(mangaCategoryIds.flatMap(s => [...s]))
  const mix = new Set([...allIds].filter(x => !common.has(x)))

  return cats.map(category => {
    if (common.has(category.id)) {
      return triSelection(category, 'include')
    }
    if (mix.has(category.id)) {
      return triSelection(category, 'exclude')
    }
    return triSelection(category, 'none')
  })
})

async function onChangeCategoryConfirmed(include: number[], exclude: number[]) {
  const targets = [...selectedManga.value]
  const targetIds = targets.map(m => m.id)
  clearSelection()

  const success = await server.setMangaCategories(targetIds, include, exclude)
  if (success) {
    notify('Categories updated')
  } else {
    notify('Failed to update categories')
  }
}

async function onBatchDownload(action?: string) {
  if (!action) return
  const targets = [...selectedManga.value]
  clearSelection()

  try {
    const count = await server.batchDownloadChapters(targets, action as BatchDownloadAction)
    if (count > 0) {
      notify(`Queued ${count} chapter${count === 1 ? '' : 's'} for download`)
    } else {
      notify('No eligible chapters to download')
    }
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Failed to queue chapters for download')
  }
}
/** `onClickSelectAll` — every entry of the current page is selected. */
function selectAll() {
  const ids = itemsByCategory.value[categories.value[currentPage.value]?.id ?? -1]?.map(m => m.id) ?? []
  selection.value = [...new Set([...selection.value, ...ids])]
}
/** `onClickInvertSelection` — the selection of the current page is inverted. */
function invertSelection() {
  const ids = itemsByCategory.value[categories.value[currentPage.value]?.id ?? -1]?.map(m => m.id) ?? []
  selection.value = ids.filter(id => !selection.value.includes(id))
}
function clearSelection() { selection.value = [] }
function onEditCategories() {
  clearSelection()
  void router.push('/categories')
}

/* ------------------------------------------------------------------ *
 * Pull to refresh (`LibraryContent.kt` -> `PullRefresh`)
 * ------------------------------------------------------------------ */
const refreshing = ref(false)
const pullOffset = ref(0)
let pullStartY = 0
let pulling = false
function onTouchStart(event: TouchEvent) {
  // `PullRefresh(enabled = selection.isEmpty())`.
  if (selectionMode.value) return
  if (window.scrollY > 0) return
  pullStartY = event.touches[0]!.clientY
  pulling = true
}
function onTouchMove(event: TouchEvent) {
  if (!pulling) return
  const delta = event.touches[0]!.clientY - pullStartY
  if (delta <= 0 || window.scrollY > 0) { pullOffset.value = 0; return }
  pullOffset.value = Math.min(delta * 0.5, 96)
}
function onTouchEnd() {
  if (!pulling) return
  pulling = false
  if (pullOffset.value >= 64) void onRefresh()
  pullOffset.value = 0
}
/**
 * `LibraryContent.kt`: the refresh indicator is shown for one second after the refresh
 * started (`isRefreshing = true; delay(1.seconds); isRefreshing = false`).
 */
async function onRefresh() {
  await reload()
  refreshing.value = true
  window.setTimeout(() => { refreshing.value = false }, 1000)
}

/**
 * `PullToRefreshDefaults.Indicator`:
 * Moves down smoothly with pull gesture, centers at top of content, stays at 16px when refreshing.
 */
const pullIndicatorStyle = computed(() => {
  if (refreshing.value) {
    return {
      transform: 'translate(-50%, 16px)',
      opacity: '1',
    }
  }
  if (pullOffset.value > 0) {
    return {
      transform: `translate(-50%, ${Math.min(pullOffset.value, 64)}px)`,
      opacity: `${Math.min(pullOffset.value / 40, 1)}`,
    }
  }
  return {
    transform: 'translate(-50%, 0px)',
    opacity: '0',
  }
})

/* ------------------------------------------------------------------ *
 * Overflow actions
 * ------------------------------------------------------------------ */
/**
 * `onClickGlobalUpdate` / `onClickRefresh` — Mihon asks the sources to fetch the
 * library again. Suwayomi's REST surface exposes no library-update trigger, so the
 * action reloads the library from the server and says so.
 */
async function onUpdateLibrary() {
  await reload()
  notify('Library reloaded from the server (the server API exposes no library-update trigger).')
}
async function onUpdateCategory() {
  await reload()
  notify('Category reloaded from the server (the server API exposes no category-update trigger).')
}
/** `onClickOpenRandomManga` — a random entry of the library is opened. */
function onOpenRandom() {
  const entries = Object.values(server.libraryByCategory).flat()
  if (!entries.length) { notify('The library is empty.'); return }
  const pick = entries[Math.floor(Math.random() * entries.length)]!
  void router.push(`/manga/${pick.id}`)
}

/* ------------------------------------------------------------------ *
 * Back handling (`BackHandler(enabled = selectionMode || searchQuery != null)`)
 * ------------------------------------------------------------------ */
function onPopState() {
  if (selectionMode.value) { clearSelection(); return }
  if (query.value !== null) { query.value = null; return }
}
watch(selectionMode, value => {
  // Mihon hides the bottom navigation while the selection mode is active.
  showBottomNav(!value)
})
onMounted(() => window.addEventListener('popstate', onPopState))
onBeforeUnmount(() => {
  window.removeEventListener('popstate', onPopState)
  showBottomNav(true)
})

function loadDetails(retry = false) {
  if (requiresDetails.value) {
    const items = preferences.categoryCounts && preferences.filters.bookmarked !== 'all' ? Object.values(server.libraryByCategory).flat() : server.library
    void details.ensure(server.apiUrl, items.map(m => m.id), retry)
  }
}
async function reload() { details.clear(); await server.loadLibrary(); loadDetails() }
watch(() => [server.apiUrl, server.library, requiresDetails.value, preferences.categoryCounts], () => loadDetails(), { immediate: true })
watch(() => [preferences.localBadge, preferences.languageBadge, server.apiUrl], () => { if ((preferences.localBadge || preferences.languageBadge) && !server.sources.length) void server.loadSources() }, { immediate: true })
onMounted(() => {
  void reload()
  const savedScroll = sessionStorage.getItem('mihon.library.scrollY')
  if (savedScroll) {
    sessionStorage.removeItem('mihon.library.scrollY')
    const y = parseInt(savedScroll, 10)
    if (!isNaN(y) && y > 0) {
      nextTick(() => {
        window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior })
      })
    }
  }
})
</script>

<template>
  <section>
    <!--
      LibraryToolbar.kt: the regular toolbar shows the title with the count pill and the
      filter/overflow actions; the selection toolbar shows the number of selected entries
      with "Select all" and "Select inverse".
    -->
    <LibraryToolbar
      :title="toolbarTitle"
      :count="toolbarCount"
      :has-filters="hasFilters"
      :selected-count="selection.length"
      :search-query="query"
      @update:search-query="query = $event"
      @filter="filtersOpen = true"
      @update-library="onUpdateLibrary"
      @update-category="onUpdateCategory"
      @open-random="onOpenRandom"
      @select-all="selectAll"
      @invert-selection="invertSelection"
      @cancel-selection="clearSelection"
    />
    <v-progress-linear v-if="details.pendingCount" indeterminate color="primary" aria-label="Loading chapter sorting data" />
    <v-alert v-if="requiresDetails && Object.keys(details.errors).length" type="warning" variant="tonal" class="ma-4">Some chapter data could not be loaded. Missing data is not treated as zero or false.<v-btn variant="text" @click="loadDetails(true)">Retry chapter data</v-btn></v-alert>
    <v-progress-linear v-if="server.loadingLibrary" indeterminate color="primary" aria-label="Loading library" />
    <v-alert v-if="server.libraryError && server.library.length" type="warning" variant="tonal" class="ma-4">Showing previously loaded data. {{ server.libraryError }}</v-alert>

    <!-- LoadingScreen.kt: `Box(fillMaxSize, Center) { CircularProgressIndicator() }`. -->
    <div v-if="server.loadingLibrary && !server.library.length" class="library-loading" role="status" aria-label="Loading library">
      <Md3CircularProgress label="Loading library" />
    </div>

    <!--
      The reference reports a connection failure with its own error screen. The web
      client keeps the honest server error and offers the connection settings.
    -->
    <MihonEmptyScreen
      v-else-if="server.libraryError && !server.library.length"
      message="Your library, on your server"
    >
      <v-btn color="primary" rounded="pill" @click="settingsOpen = true">Connect to Suwayomi</v-btn>
    </MihonEmptyScreen>

    <!--
      EmptyScreen(MR.strings.information_empty_library) with the "Getting started guide"
      action of the reference.

      `ActionButton` is a `TextButton` whose content is a `Column` with the icon above
      the title (`Column(verticalArrangement = spacedBy(extraSmall = 4.dp),
      horizontalAlignment = CenterHorizontally)`).
    -->
    <MihonEmptyScreen
      v-else-if="!search && !hasFilters && isLibraryEmpty"
      message="Your library is empty"
    >
      <button type="button" class="library-empty-action" @click="openGettingStartedGuide">
        <span class="library-empty-action-icon" aria-hidden="true"><v-icon icon="help" size="24" /></span>
        <span class="library-empty-action-label">Getting started guide</span>
      </button>
    </MihonEmptyScreen>

    <MihonEmptyScreen
      v-else-if="detailsIncomplete && details.pendingCount && !visibleManga.length"
      message="Loading chapter data"
    />

    <!--
      LibraryContent.kt (LibraryTab.kt:181-218):
      Column(contentPadding) {
          if (showPageTabs && categories.isNotEmpty() && (categories.size > 1 || !categories.first().isSystemCategory)) {
              LibraryTabs(...)
          }
          PullRefresh(refreshing = isRefreshing, enabled = selection.isEmpty(), onRefresh = ...) {
              LibraryPager(...)
          }
      }
    -->
    <div v-else class="library-content">
      <LibraryCategoryTabs
        v-if="showPageTabs && categories.length && (categories.length > 1 || categories[0]!.id !== 0)"
        :categories="tabCategories"
        :current-page="currentPage"
        @update:current-page="onChangeCurrentPage"
      />

      <!--
        PullRefresh(refreshing, enabled = selection.isEmpty()):
        Indicator container is a 40dp circle (surfaceContainerHigh / surfaceVariant)
        with elevation shadow and centered onSurfaceVariant spinner.
      -->
      <div
        class="library-pull-refresh"
        @touchstart.passive="onTouchStart"
        @touchmove.passive="onTouchMove"
        @touchend.passive="onTouchEnd"
      >
        <div
          v-if="refreshing || pullOffset > 0"
          class="library-pull-indicator"
          :style="pullIndicatorStyle"
          aria-hidden="true"
        >
          <v-progress-circular indeterminate size="24" width="2.5" class="library-pull-spinner" />
        </div>
        <LibraryPager
          :categories="categories"
          :current-page="currentPage"
          :display="preferences.libraryDisplay"
          :items-by-category="itemsByCategory"
          :summaries="details.summaries"
          :search-query="search"
          :has-active-filters="hasFilters"
          :selection="selection"
          @update:current-page="onChangeCurrentPage"
          @update:selection="selection = $event"
          @global-search="router.push({ path: '/browse/global-search', query: { q: search } })"
        />
      </div>
    </div>

    <LibrarySettingsSheet v-model="filtersOpen" />
    <ServerSettingsDialog v-model="settingsOpen" />
    <!-- SnackbarHost(hostState) of the reference. -->
    <v-snackbar v-model="snackbar" timeout="4000" color="inverse-surface">{{ snackbarText }}</v-snackbar>
    <!-- LibraryBottomActionMenu: the action bar of the library selection mode. -->
    <MangaBottomActionMenu
      variant="library"
      :visible="selection.length > 0"
      :can-download="true"
      @set-categories="changeCategoryOpen = true"
      @mark-as-read="onMarkAsRead"
      @mark-as-unread="onMarkAsUnread"
      @download="onBatchDownload"
      @delete="openDeleteDialog"
    />
    <!-- DeleteLibraryMangaDialog.kt -->
    <DeleteLibraryMangaDialog v-model="deleteOpen" :manga="selectedManga" :contains-local-manga="containsLocalManga" @confirm="onDeleteConfirmed" />
    <!-- ChangeCategoryDialog.kt (eu.kanade.presentation.category.components.CategoryDialogs.kt) -->
    <ChangeCategoryDialog v-model="changeCategoryOpen" :initial-selection="categorySelection" @confirm="onChangeCategoryConfirmed" @edit-categories="onEditCategories" />
  </section>
</template>

<style scoped>
/* LoadingScreen.kt: `Box(fillMaxSize, Center) { CircularProgressIndicator() }`. */
.library-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  min-height: 200px;
}

/*
 * `LibraryContent.kt`:
 * Column layout with tabs at top and scrollable pager below.
 */
.library-content {
  display: flex;
  flex-direction: column;
  width: 100%;
}

/*
 * `PullRefresh.kt`: Box with PullToRefreshDefaults.Indicator centered at TopCenter.
 * M3 indicator: 40dp circular container in surfaceVariant / surfaceContainerHigh with elevation shadow,
 * containing 24dp spinner in onSurfaceVariant.
 */
.library-pull-refresh {
  position: relative;
  flex: 1 1 auto;
}
.library-pull-indicator {
  position: absolute;
  top: 0;
  left: 50%;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgb(var(--v-theme-surface-container-high, var(--v-theme-surface-variant)));
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2), 0 1px 10px rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  pointer-events: none;
  transition: transform 0.2s cubic-bezier(0, 0, 0.2, 1), opacity 0.2s ease-in-out;
}
.library-pull-spinner {
  color: rgb(var(--v-theme-on-surface-variant));
}

/*
 * `ActionButton` of the reference: a `TextButton` whose content is a `Column` with the
 * icon above the title. The button is transparent with the primary content colour and
 * the `labelLarge` typography (14sp / 20sp / weight 500).
 */
.library-empty-action {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 64px;
  min-height: 40px;
  padding: 8px 12px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  text-align: center;
  cursor: pointer;
}
.library-empty-action::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: rgb(var(--v-theme-primary));
  opacity: 0;
  transition: opacity 0.12s ease-in-out;
  pointer-events: none;
}
.library-empty-action:hover::before { opacity: 0.08; }
.library-empty-action:active::before { opacity: 0.12; }
.library-empty-action:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.library-empty-action-icon,
.library-empty-action-label { position: relative; z-index: 1; }
.library-empty-action-label { white-space: nowrap; }
</style>
