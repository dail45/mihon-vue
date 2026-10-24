<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDisplay, useTheme } from 'vuetify'
import { useTabletUi } from '@/core/composables/useTabletUi'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import ChapterSettingsSheet from '../components/ChapterSettingsSheet.vue'
import ChapterHeader from '../components/ChapterHeader.vue'
import type { DownloadAction } from '../components/DownloadDropdownMenu.vue'
import MangaToolbar from '../components/MangaToolbar.vue'
import MangaResumeFab from '../components/MangaResumeFab.vue'
import MangaBottomActionMenu from '../components/MangaBottomActionMenu.vue'
import { mangaBottomActionFlags } from '@/core/utils/mangaBottomActions'
import MangaCoverDialog from '../components/MangaCoverDialog.vue'
import MangaInfoHeader from '../components/MangaInfoHeader.vue'
import RelatedMangasRow from '../components/RelatedMangasRow.vue'
import MissingChapterCountListItem from '../components/MissingChapterCountListItem.vue'
import MangaChapterListItem, { type ChapterSwipeAction } from '../components/MangaChapterListItem.vue'
import RemoveMangaDialog from '@/features/library/components/RemoveMangaDialog.vue'
import DeleteChaptersDialog from '../components/DeleteChaptersDialog.vue'
import ChangeCategoryDialog from '@/features/library/components/ChangeCategoryDialog.vue'
import SetIntervalDialog from '../components/SetIntervalDialog.vue'
import DuplicateMangaDialog from '@/features/library/components/DuplicateMangaDialog.vue'
import MihonEmptyScreen from '@/core/components/MihonEmptyScreen.vue'
import TrackInfoDialog from '@/features/trackers/components/TrackInfoDialog.vue'
import { useChapterSettings } from '../stores/chapterSettings'
import { usePreferencesStore, readPreference } from '@/features/settings/stores/preferences'
import { chapterTitle, sortChapters } from '@/core/utils/chapters'
import { buildChapterListItems, missingChaptersCount } from '@/core/utils/missingChapters'
import { relativeDateText } from '@/core/utils/dates'
import { createSuwayomiApi } from '@/core/api/client'
import type { Chapter, Manga } from '@/core/api/types'
import { isLocal } from '@/core/utils/library'
import { useChapterSelection } from '../composables/useChapterSelection'
import { useMangaDownloads } from '../composables/useMangaDownloads'
import { stateSelection, type CategorySelection } from '@/core/utils/categorySelection'
import { findDuplicateManga, type DuplicateManga } from '@/core/utils/duplicates'
import { availableScanlators, loadExcludedScanlators } from '@/core/utils/scanlatorFilter'

/**
 * Manga detail screen.
 *
 * Pixel-parity port of `eu.kanade.presentation.manga.MangaScreen.kt`
 * (Mihon, pinned commit 446f6df82c390ab760802c2fce3b677bce3f31c1) and of the components it
 * composes:
 *
 *  - `MangaScreenSmallImpl` — one scrolling column with the blocks
 *    INFO_BOX (`MangaInfoHeader`) -> ACTION_ROW -> DESCRIPTION_WITH_TAG -> CHAPTER_HEADER
 *    (`ChapterHeader`) -> the chapter rows (`MangaChapterListItem`).
 *  - `MangaScreenLargeImpl` — `TwoPanelBox`: start panel fixed to `(width / 2).coerceAtMost(450.dp)`
 *    with vertically scrollable `MangaInfoHeader`, end panel with independent scroll for `ChapterHeader`
 *    and chapters.
 *  - `MangaToolbar` — MD3 `TopAppBar` 64dp: Navigate up / cancel action mode, title with
 *    `titleAlphaProvider` (always 1f on tablet, fade on phone), download action (if not local/stub),
 *    filter action (tinted when filters active), and overflow menu.
 *  - `SharedMangaBottomActionMenu` — the chapter selection menu (`MangaBottomActionMenu.vue`).
 *    On wide screens it occupies half the width aligned to the end (`fillFraction = 0.5f`).
 *  - `SmallExtendedFloatingActionButton` — 56dp height, CornerLarge (16dp), primaryContainer,
 *    "Start" / "Resume", shown when unread chapters exist and nothing is selected, collapsing
 *    on scroll down and expanding on scroll up (`shouldExpandFAB()`).
 *  - Confirmation & support dialogs: `RemoveMangaDialog`, `DeleteChaptersDialog`, `ChangeCategoryDialog`,
 *    `SetIntervalDialog`, `DuplicateMangaDialog`, `MangaCoverDialog`, `ChapterSettingsDialog`.
 *  - `LoadingScreen`: centered M3 CircularProgressIndicator (40dp, 4dp stroke).
 *  - `EmptyScreen`: MihonEmptyScreen with kaomoji face and retry action.
 */
const route = useRoute(), router = useRouter(), server = useSuwayomiStore()
const chapterSettingsOpen = ref(false), coverOpen = ref(false)
const removeOpen = ref(false), deleteChaptersOpen = ref(false)
const changeCategoryOpen = ref(false), setIntervalOpen = ref(false)
const duplicateOpen = ref(false), duplicateEntries = ref<DuplicateManga[]>([])

const preferences = usePreferencesStore(), chapterPreferences = useChapterSettings()
const chapterSettings = computed(() => chapterPreferences.forManga(server.apiUrl, Number(route.params.id)))
const detail = computed(() => server.manga)

const STORAGE_KEY_INTERVAL = 'mihon-vue:manga-interval'
const storedFetchInterval = ref(0)

function loadStoredInterval() {
  const id = detail.value?.id ?? Number(route.params.id)
  if (!id) return
  const rawInterval = (detail.value && 'fetchInterval' in detail.value)
    ? ((detail.value as { fetchInterval?: number }).fetchInterval ?? 0)
    : 0
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_INTERVAL}:${id}`)
    storedFetchInterval.value = raw ? Number.parseInt(raw, 10) || 0 : rawInterval
  } catch {
    storedFetchInterval.value = rawInterval
  }
}

watch(() => [route.params.id, server.apiUrl], () => {
  coverOpen.value = false
  void server.loadManga(Number(route.params.id))
  loadStoredInterval()
}, { immediate: true })

const tabletUi = useTabletUi(), { width } = useDisplay()
/** `MangaScreenLargeImpl` is the expanded (tablet) layout. */
const twoPane = computed(() => preferences.tabletUiMode === 'always' || (tabletUi.value && width.value >= 600))

watch(() => server.apiUrl, () => { if (!server.sources.length) void server.loadSources() }, { immediate: true })
const sourceName = computed(() => detail.value?.source?.displayName
  || server.sources.find(s => s.id === detail.value?.sourceId)?.displayName
  || (server.loadingSources ? 'Loading source…' : 'Source unavailable'))
const isStubSource = computed(() => {
  if (server.loadingSources || !detail.value) return false
  return !detail.value.source && !server.sources.some(s => s.id === detail.value?.sourceId)
})
const isLocalSource = computed(() => (detail.value ? isLocal(detail.value, server.sources) : false))
const canDownload = computed(() => !isLocalSource.value && !isStubSource.value)
const canShare = computed(() => !isLocalSource.value)
const isInLibrary = computed(() => Boolean(detail.value?.inLibrary))

// --- MangaToolbar -----------------------------------------------------------------------------------

const theme = useTheme()
/** Mihon: `ColorScheme.active` = Color(255,193,7) in light, Color(255,235,59) in dark. */
const activeColor = computed(() => (theme.current.value.dark ? 'rgb(255, 235, 59)' : 'rgb(255, 193, 7)'))

const isScanlatorFilterActive = computed(() => {
  const mangaId = detail.value?.id ?? Number(route.params.id)
  if (!mangaId) return false
  const excluded = loadExcludedScanlators(server.apiUrl, mangaId)
  if (!excluded.length) return false
  const avail = availableScanlators(server.chapters)
  return avail.some(s => excluded.includes(s))
})

/** Mihon: `state.filterActive` — an active chapter filter tints the filter icon. */
const hasFilters = computed(() => chapterSettings.value.unread !== 'all'
  || chapterSettings.value.downloaded !== 'all'
  || chapterSettings.value.bookmarked !== 'all'
  || preferences.downloadedOnly
  || isScanlatorFilterActive.value)

/** Mihon: `actionModeCounter = state.selectedChapters.size`. */
const {
  selectedChapters,
  isActionMode,
  selectedCount,
  toggleChapterSelection,
  cancelSelection,
  selectAllChapters,
  invertChapterSelection,
  handleLongPressSelect,
} = useChapterSelection()

/**
 * Mihon: `BackHandler(enabled = isAnySelected) { onAllChapterSelected(false) }` — the back
 * gesture cancels the selection before it leaves the screen.
 */
onBeforeRouteLeave((_to, _from, next) => {
  if (isActionMode.value) { cancelSelection(); next(false); return }
  next()
})

// Title / background alpha follow the list scroll (Mihon: `titleAlphaProvider`,
// `backgroundAlphaProvider`): the title appears once the first item is not fully visible.
// In MangaScreenLargeImpl: both are always 1f.
const scrolled = ref(false)
const infoPane = ref<HTMLElement | null>(null)
const firstItemVisible = ref(true)

function onWindowScroll() {
  const top = window.scrollY
  scrolled.value = top > 4
  const pane = infoPane.value
  if (pane) firstItemVisible.value = pane.getBoundingClientRect().bottom > 64
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
  updateFabExpansion(top, maxScroll)
}

function onEndPaneScroll(e: Event) {
  const el = e.target as HTMLElement
  if (!el) return
  updateFabExpansion(el.scrollTop, Math.max(1, el.scrollHeight - el.clientHeight))
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isActionMode.value) {
    cancelSelection()
  }
}

/**
 * Mihon: In small layout, titleAlpha = if (!isFirstItemVisible) 1f else 0f.
 * In large layout (MangaScreenLargeImpl:534), titleAlpha = 1f.
 */
const titleAlpha = computed(() => (isActionMode.value || twoPane.value ? 1 : firstItemVisible.value ? 0 : 1))
/**
 * Mihon: In small layout, backgroundAlpha = if (!isFirstItemVisible || isFirstItemScrolled) 1f else 0f.
 * In large layout (MangaScreenLargeImpl:535), backgroundAlpha = 1f.
 */
const backgroundAlpha = computed(() => (isActionMode.value || twoPane.value ? 1 : (scrolled.value || !firstItemVisible.value) ? 1 : 0))

onMounted(() => {
  window.addEventListener('scroll', onWindowScroll, { passive: true })
  window.addEventListener('keydown', onKeydown)
  onWindowScroll()
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onWindowScroll)
  window.removeEventListener('keydown', onKeydown)
})

// --- Toolbar actions -------------------------------------------------------------------------------

const snackbar = ref(false), snackbarText = ref('')

function notify(text: string) {
  snackbarText.value = text
  snackbar.value = true
}

const {
  downloadInfo,
  onDownload,
  onDownloadAction,
  refreshDownloadInfos,
  startDownloadPolling,
} = useMangaDownloads({
  apiUrl: () => server.apiUrl,
  mangaId: () => detail.value?.id ?? Number(route.params.id),
  updateChapterByIdLocally: (id, patch) => server.updateChapterByIdLocally(id, patch),
  onMangaReloadNeeded: async () => { await server.loadManga(Number(route.params.id), false, true) },
  notify,
})

watch(() => [route.params.id, server.apiUrl], startDownloadPolling, { immediate: true })

function handleDownload(action: DownloadAction) {
  void onDownload(action, orderedChapters.value)
}
function onRefresh() { void server.loadManga(detail.value?.id ?? Number(route.params.id), true) }

function onMigrate() {
  const id = detail.value?.id ?? Number(route.params.id)
  if (id && Number.isFinite(id)) {
    void router.push(`/migrate/config/${id}`)
  }
}
async function onShare() {
  const url = window.location.href
  try {
    if (navigator.share) await navigator.share({ title: detail.value?.title || 'Manga', url })
    else { await navigator.clipboard.writeText(url); notify('Link copied to clipboard') }
  } catch { /* the user dismissed the share sheet */ }
}
function onEditNotes() { void router.push(`/manga/${Number(route.params.id)}/notes`) }

// --- MangaInfoHeader actions -------------------------------------------------------------------------

/** Every library entry of the server, de-duplicated across categories. */
const allLibraryManga = computed<Manga[]>(() => {
  const seen = new Set<number>()
  const all: Manga[] = []
  for (const list of Object.values(server.libraryByCategory)) {
    for (const item of list) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      all.push(item)
    }
  }
  return all
})

/** Mihon `MangaActionRow` library button: checks duplicates or asks before removing. */
function onToggleLibrary() {
  if (detail.value?.inLibrary) {
    removeOpen.value = true
    return
  }
  if (detail.value) {
    const duplicates = findDuplicateManga(detail.value, allLibraryManga.value)
    if (duplicates.length > 0) {
      duplicateEntries.value = duplicates
      duplicateOpen.value = true
      return
    }
  }
  void server.setLibraryMembership(true)
}

function onConfirmDuplicate() {
  duplicateOpen.value = false
  void server.setLibraryMembership(true)
}

function onMigrateDuplicate(target: Manga) {
  duplicateOpen.value = false
  void router.push(`/migrate/config/${target.id}`)
}

async function onMangaRemoved() {
  await server.loadManga(Number(route.params.id))
  notify('Removed from library')
}

// --- Categories Dialog (ChangeCategoryDialog) -------------------------------------------------------

const categorySelection = computed<CategorySelection[]>(() => {
  const mangaId = detail.value?.id ?? Number(route.params.id)
  return server.categories.map(category => {
    const inCategory = (server.libraryByCategory[category.id] || []).some(item => item.id === mangaId)
    return stateSelection(category, inCategory)
  })
})

function onEditCategories() {
  if (!server.categories.length) void server.loadLibrary()
  changeCategoryOpen.value = true
}

function onChangeCategoryConfirmed() {
  notify('Category updated.')
}

// --- Smart update (SetIntervalDialog) ---------------------------------------------------------------

function onIntervalChanged(interval: number) {
  const id = detail.value?.id ?? Number(route.params.id)
  if (!id) return
  storedFetchInterval.value = interval === 0 ? 0 : -interval
  try {
    if (interval === 0) window.localStorage.removeItem(`${STORAGE_KEY_INTERVAL}:${id}`)
    else window.localStorage.setItem(`${STORAGE_KEY_INTERVAL}:${id}`, String(-interval))
  } catch { /* storage quota */ }
}

const isUserInterval = computed(() => storedFetchInterval.value < 0)
const intervalLabel = computed(() => {
  if (storedFetchInterval.value < 0) {
    const days = Math.abs(storedFetchInterval.value)
    return `${days} ${days === 1 ? 'day' : 'days'}`
  }
  return 'N/A'
})

function onEditInterval() {
  setIntervalOpen.value = true
}

// --- Tracking Dialog --------------------------------------------------------------------------------

const trackingOpen = ref(false)

function onOpenTracking() {
  trackingOpen.value = true
}

function onTrackerSearch(trackerId: number, searchQuery: string) {
  trackingOpen.value = false
  void router.push({
    path: '/tracker-search',
    query: {
      mangaId: String(route.params.id),
      trackerId: String(trackerId),
      q: searchQuery,
    },
  })
}

function onOpenWebView() {
  const url = detail.value?.realUrl || detail.value?.url
  if (!url) {
    notify('The source page of this title is unknown.')
    return
  }
  window.open(url, '_blank', 'noopener')
}

// --- Chapter list ----------------------------------------------------------------------------------

const visibleChapters = computed(() => sortChapters(server.chapters, chapterSettings.value, preferences.downloadedOnly, ''))
/** The chapters in reading order (oldest first), used by download actions and resume logic. */
const orderedChapters = computed(() => server.chapters.slice().sort((a, b) => a.index - b.index))
/**
 * Mihon: `libraryPreferences.hideMissingChapters` (`MangaViewModel.kt:1134`).
 */
const hideMissingChapters = computed(() => readPreference('mihon.library.hideMissingChapters') === 'true')
/** Mihon: `state.missingChapterCount` — gaps between known chapter numbers. */
const missingChapterCount = computed(() => {
  if (hideMissingChapters.value) return 0
  return missingChaptersCount(visibleChapters.value.map(c => c.chapterNumber))
})
/**
 * The chapter rows with `ChapterList.MissingCount` separators of the reference.
 */
const chapterEntries = computed(() => {
  if (hideMissingChapters.value) {
    return visibleChapters.value.map(c => ({ kind: 'chapter' as const, chapter: { id: c.id, chapterNumber: c.chapterNumber } }))
  }
  return buildChapterListItems(
    visibleChapters.value.map(c => ({ id: c.id, chapterNumber: c.chapterNumber })),
    chapterSettings.value.descending,
  )
})
const chapterById = computed(() => new Map<number, Chapter>(visibleChapters.value.map(c => [c.id, c])))
function chapterOf(entry: { kind: string, chapter?: { id: string | number }, id?: string }): Chapter | undefined {
  return entry.kind === 'chapter' ? chapterById.value.get(Number(entry.chapter?.id)) : undefined
}
function chapterDate(value: number) {
  if (!value) return null
  return relativeDateText(new Date(value))
}
function chapterProgress(chapter: { read: boolean, lastPageRead: number }) {
  if (chapter.read || chapter.lastPageRead <= 0) return null
  return `Page: ${chapter.lastPageRead + 1}`
}
function chapterScanlator(chapter: { scanlator: string | null }) {
  return chapter.scanlator && chapter.scanlator.trim() ? chapter.scanlator : null
}

// --- Chapter selection and mutations ----------------------------------------------------------------

const api = computed(() => createSuwayomiApi(server.apiUrl))
async function patchChapter(index: number, patch: { read?: boolean, bookmarked?: boolean, markPrevRead?: boolean, lastPageRead?: number }) {
  const mangaId = detail.value?.id ?? Number(route.params.id)
  server.updateChapterLocally(index, patch)
  try {
    await api.value.modifyChapter(mangaId, index, patch)
    void server.loadManga(mangaId, false, true)
  } catch (error) {
    notify(error instanceof Error ? error.message : 'The server rejected the request.')
    void server.loadManga(mangaId, false, true)
  }
}
const selectedChapterList = computed(() => visibleChapters.value.filter(c => selectedChapters.value.has(c.id)))
const bottomFlags = computed(() => mangaBottomActionFlags(selectedChapterList.value))

async function onBulkBookmark(bookmarked: boolean) {
  const chaptersToUpdate = [...selectedChapterList.value]
  const mangaId = detail.value?.id ?? Number(route.params.id)
  cancelSelection()
  for (const chapter of chaptersToUpdate) {
    server.updateChapterLocally(chapter.index, { bookmarked })
  }
  try {
    await Promise.all(chaptersToUpdate.map(c => api.value.modifyChapter(mangaId, c.index, { bookmarked })))
    void server.loadManga(mangaId, false, true)
  } catch (error) {
    notify(error instanceof Error ? error.message : 'The server rejected the request.')
    void server.loadManga(mangaId, false, true)
  }
}
async function onBulkRead(read: boolean) {
  const chaptersToUpdate = [...selectedChapterList.value]
  const mangaId = detail.value?.id ?? Number(route.params.id)
  cancelSelection()
  const patch = read ? { read: true } : { read: false, lastPageRead: 0 }
  for (const chapter of chaptersToUpdate) {
    server.updateChapterLocally(chapter.index, patch)
  }
  try {
    await Promise.all(chaptersToUpdate.map(c => api.value.modifyChapter(mangaId, c.index, patch)))
    void server.loadManga(mangaId, false, true)
  } catch (error) {
    notify(error instanceof Error ? error.message : 'The server rejected the request.')
    void server.loadManga(mangaId, false, true)
  }
}
async function onBulkMarkPreviousRead() {
  const chapter = selectedChapterList.value[0]
  if (!chapter) return
  const mangaId = detail.value?.id ?? Number(route.params.id)
  cancelSelection()
  server.updateChapterLocally(chapter.index, { markPrevRead: true })
  try {
    await api.value.modifyChapter(mangaId, chapter.index, { markPrevRead: true })
    void server.loadManga(mangaId, false, true)
  } catch (error) {
    notify(error instanceof Error ? error.message : 'The server rejected the request.')
    void server.loadManga(mangaId, false, true)
  }
}

function onChaptersDeleted() {
  cancelSelection()
  void server.loadManga(Number(route.params.id), false, true)
  void refreshDownloadInfos()
  notify('Chapters deleted.')
}

function onChapterDeleteError(message: string) {
  notify(message)
}

/** Mihon `onChapterItemClick` (MangaScreen.kt:797-808). */
function onChapterClick(chapter: { id: number, index: number }) {
  if (selectedChapters.value.has(chapter.id)) { toggleChapterSelection(chapter.id); return }
  if (isActionMode.value) { toggleChapterSelection(chapter.id); return }
  void router.push(`/manga/${detail.value?.id ?? Number(route.params.id)}/read/${chapter.index}`)
}

/** Mihon: `onLongClick = { onChapterSelected(item, !item.selected, true) }` with range selection. */
function onChapterLongPress(chapter: { id: number }) {
  handleLongPressSelect(chapter, visibleChapters.value)
}

/** Mihon `executeChapterSwipeAction` (MangaViewModel.kt:619-646). */
async function onChapterSwipe(chapter: { id: number, index: number, read: boolean, bookmarked: boolean }, action: ChapterSwipeAction) {
  if (action === 'toggle-read') await patchChapter(chapter.index, { read: !chapter.read })
  else if (action === 'toggle-bookmark') await patchChapter(chapter.index, { bookmarked: !chapter.bookmarked })
  else if (action === 'download') await onDownloadAction(chapter, 'start')
}

// --- Floating action button & shouldExpandFAB() ----------------------------------------------------

const hasUnreadChapters = computed(() => server.chapters.some(c => !c.read))
const hasReadChapters = computed(() => server.chapters.some(c => c.read))
const fabVisible = computed(() => hasUnreadChapters.value && !isActionMode.value)

/**
 * Mihon `shouldExpandFAB()`:
 *   lastScrolledBackward || !canScrollForward || !canScrollBackward
 */
const fabExpanded = ref(true)
let lastScrollTop = 0
let lastScrolledBackward = false

function updateFabExpansion(currentTop: number, maxScroll: number) {
  if (currentTop < lastScrollTop) {
    lastScrolledBackward = true
  } else if (currentTop > lastScrollTop) {
    lastScrolledBackward = false
  }
  lastScrollTop = currentTop
  const canScrollForward = currentTop < maxScroll - 1
  const canScrollBackward = currentTop > 1
  fabExpanded.value = lastScrolledBackward || !canScrollForward || !canScrollBackward
}

/**
 * Mihon: `ChapterGetNextUnread.kt`:
 *   if (manga.sortDescending()) chapters.findLast { !it.read } else chapters.find { !it.read }
 */
function getNextUnreadChapter(): Chapter | undefined {
  const chapters = visibleChapters.value.length ? visibleChapters.value : server.chapters
  if (chapterSettings.value.descending) {
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (!chapters[i]!.read) return chapters[i]
    }
  } else {
    for (let i = 0; i < chapters.length; i++) {
      if (!chapters[i]!.read) return chapters[i]
    }
  }
  return chapters[0]
}

function continueReading() {
  const mangaId = detail.value?.id ?? Number(route.params.id)
  const target = getNextUnreadChapter()
  if (target) void router.push(`/manga/${mangaId}/read/${target.index}`)
}

// --- Pull to refresh (PullRefresh.kt) ---------------------------------------------------------------

const PULL_THRESHOLD = 72
let pullStart = 0
let pullDistance = 0
const pullOffset = ref(0)

function onTouchStart(event: TouchEvent) {
  if (isActionMode.value) return
  const top = window.scrollY
  if (top > 0) return
  pullStart = event.touches[0]?.clientY ?? 0
  pullDistance = 0
}
function onTouchMove(event: TouchEvent) {
  if (isActionMode.value || !pullStart) return
  if (window.scrollY > 0) { pullStart = 0; pullDistance = 0; pullOffset.value = 0; return }
  const delta = (event.touches[0]?.clientY ?? 0) - pullStart
  if (delta <= 0) { pullDistance = 0; pullOffset.value = 0; return }
  pullDistance = Math.min(delta, PULL_THRESHOLD * 1.5)
  pullOffset.value = Math.min(pullDistance, PULL_THRESHOLD)
}
function onTouchEnd() {
  if (isActionMode.value || !pullStart) { pullStart = 0; return }
  const triggered = pullDistance >= PULL_THRESHOLD
  pullStart = 0
  pullDistance = 0
  pullOffset.value = 0
  if (triggered) onRefresh()
}
</script>

<template>
  <!-- Loading state: LoadingScreen.kt (Box fillMaxSize Alignment.Center CircularProgressIndicator) -->
  <div v-if="server.loadingManga && !detail" class="manga-loading" role="status" aria-label="Loading">
    <v-progress-circular indeterminate size="40" width="4" color="primary" />
  </div>

  <!-- Error state: EmptyScreen.kt (MihonEmptyScreen with kaomoji face and Retry action) -->
  <MihonEmptyScreen v-else-if="server.mangaError && !detail" :message="server.mangaError">
    <button type="button" class="manga-retry-btn" @click="server.loadManga(Number(route.params.id))">
      Try again
    </button>
  </MihonEmptyScreen>

  <div
    v-else-if="detail"
    class="manga-page manga-detail"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend.passive="onTouchEnd"
    @touchcancel.passive="onTouchEnd"
  >
    <!-- Floating pull indicator matching Compose PullRefreshIndicator -->
    <div
      v-if="pullOffset || (server.loadingManga && detail)"
      class="manga-pull-indicator"
      :style="{ transform: `translate(-50%, ${pullOffset ? pullOffset : 72}px)` }"
      aria-hidden="true"
    >
      <v-progress-circular indeterminate color="primary" size="24" width="2.5" />
    </div>

    <!--
      Mihon: MangaToolbar -> AppBar -> TopAppBar (64dp, navigation icon, title, actions).
      The background is `surfaceColorAtElevation(3.dp)` with the scroll driven alpha.
      In tablet two-pane mode, title and background are always 1f.
    -->
    <MangaToolbar
      :detail="detail"
      :is-action-mode="isActionMode"
      :selected-count="selectedCount"
      :can-download="canDownload"
      :has-filters="hasFilters"
      :active-color="activeColor"
      :is-in-library="isInLibrary"
      :can-share="canShare"
      :title-alpha="titleAlpha"
      :background-alpha="backgroundAlpha"
      @navigate-up="router.back()"
      @cancel-selection="cancelSelection"
      @select-all="selectAllChapters(visibleChapters.map(c => c.id))"
      @invert-selection="invertChapterSelection(visibleChapters.map(c => c.id))"
      @download="handleDownload"
      @open-filters="chapterSettingsOpen = true"
      @refresh="onRefresh"
      @edit-categories="onEditCategories"
      @migrate="onMigrate"
      @share="onShare"
      @edit-notes="onEditNotes"
    />

    <!--
      Mihon: `Scaffold` content -> `PullRefresh` -> `LazyColumn` with the items INFO_BOX,
      ACTION_ROW, DESCRIPTION_WITH_TAG, CHAPTER_HEADER and the chapters. The expanded layout
      uses `TwoPanelBox` (start content: (width / 2).coerceAtMost(450.dp) | end content: remainder).
    -->
    <div class="manga-body" :class="{ 'manga-body--two-pane': twoPane, 'manga-two-pane': twoPane }">
      <section ref="infoPane" class="manga-start-pane" aria-label="Manga information">
        <MangaInfoHeader
          :manga="detail"
          :cover-url="server.thumbnailUrl(detail.id)"
          :api-url="server.apiUrl"
          :source-name="sourceName"
          :source-id="detail.sourceId"
          :is-stub-source="isStubSource"
          :large="twoPane"
          :user-interval="isUserInterval"
          :interval-label="intervalLabel"
          :tracking-count="detail.trackers?.length ?? 0"
          @toggle-library="onToggleLibrary"
          @edit-category="onEditCategories"
          @edit-interval="onEditInterval"
          @open-tracking="onOpenTracking"
          @open-web-view="onOpenWebView"
          @open-cover="coverOpen = true"
        />
        <v-alert v-if="server.mutationError" type="error" variant="tonal" class="manga-mutation-error">{{ server.mutationError }}</v-alert>
        <RelatedMangasRow
          v-if="detail && !isStubSource"
          :manga="detail"
          :api-url="server.apiUrl"
        />
      </section>

      <section class="manga-end-pane" aria-label="Chapters" @scroll.passive="onEndPaneScroll">
        <ChapterHeader
          :chapter-count="visibleChapters.length"
          :missing-chapter-count="missingChapterCount"
          :enabled="!isActionMode"
          @click="chapterSettingsOpen = true"
        />

        <div class="manga-chapter-list">
          <template v-for="entry in chapterEntries" :key="entry.kind === 'chapter' ? `c-${entry.chapter.id}` : `m-${entry.id}`">
            <MissingChapterCountListItem v-if="entry.kind === 'missing'" :count="entry.count" />
            <MangaChapterListItem
              v-else-if="chapterOf(entry)!"
              :chapter="chapterOf(entry)!"
              :title="chapterTitle(chapterOf(entry)!, chapterSettings.display)"
              :date="chapterDate(chapterOf(entry)!.uploadDate)"
              :read-progress="chapterProgress(chapterOf(entry)!)"
              :scanlator="chapterScanlator(chapterOf(entry)!)"
              :read="chapterOf(entry)!.read"
              :bookmark="chapterOf(entry)!.bookmarked"
              :selected="selectedChapters.has(chapterOf(entry)!.id)"
              :download-indicator-enabled="!isActionMode && !isLocalSource"
              :download-state="downloadInfo(chapterOf(entry)!).state"
              :download-progress="downloadInfo(chapterOf(entry)!).progress"
              :swipe-start-action="preferences.chapterSwipeStartAction"
              :swipe-end-action="preferences.chapterSwipeEndAction"
              :href="`/manga/${detail.id}/read/${chapterOf(entry)!.index}`"
              :intercept="isActionMode"
              @click="onChapterClick(chapterOf(entry)!)"
              @longpress="onChapterLongPress(chapterOf(entry)!)"
              @swipe="onChapterSwipe(chapterOf(entry)!, $event)"
              @download="onDownloadAction(chapterOf(entry)!, $event)"
            />
          </template>
        </div>

        <p v-if="!server.chapters.length" class="manga-body-medium manga-empty-chapters">No chapters returned by the server.</p>
        <p v-else-if="!visibleChapters.length" class="manga-body-medium manga-empty-chapters">No matching chapters.</p>
      </section>
    </div>

    <!--
      Mihon: SmallExtendedFloatingActionButton (PlayArrow, "Start" / "Resume").
      ContainerHeight 56dp, CornerLarge 16dp, primaryContainer/onPrimaryContainer.
      Expands on scroll up, collapses on scroll down (shouldExpandFAB()).
    -->
    <MangaResumeFab
      :visible="fabVisible"
      :expanded="fabExpanded"
      :has-read-chapters="hasReadChapters"
      @click="continueReading"
    />

    <!--
      Mihon: SharedMangaBottomActionMenu (the chapter selection menu).
      On large screens, fillFraction = 0.5f and wrapContentWidth(Alignment.End).
    -->
    <div class="manga-bottom-menu-wrapper" :class="{ 'manga-bottom-menu-wrapper--two-pane': twoPane }">
      <MangaBottomActionMenu
        variant="manga"
        :visible="isActionMode"
        :fill-fraction="twoPane ? 0.5 : 1"
        :can-bookmark="bottomFlags.canBookmark"
        :can-remove-bookmark="bottomFlags.canRemoveBookmark"
        :can-mark-as-read="bottomFlags.canMarkAsRead"
        :can-mark-as-unread="bottomFlags.canMarkAsUnread"
        :can-mark-previous-as-read="bottomFlags.canMarkPreviousAsRead"
        :can-download="bottomFlags.canDownload"
        :can-delete="bottomFlags.canDelete"
        @bookmark="onBulkBookmark(true)"
        @remove-bookmark="onBulkBookmark(false)"
        @mark-as-read="onBulkRead(true)"
        @mark-as-unread="onBulkRead(false)"
        @mark-previous-as-read="onBulkMarkPreviousRead"
        @delete="deleteChaptersOpen = true"
      />
    </div>
  </div>

  <!-- Full dialog parity with MangaScreen.kt -->
  <RemoveMangaDialog
    v-model="removeOpen"
    :manga="detail"
    @removed="onMangaRemoved"
  />

  <DeleteChaptersDialog
    v-model="deleteChaptersOpen"
    :manga-id="Number(route.params.id)"
    :chapters="selectedChapterList"
    :api-url="server.apiUrl"
    @deleted="onChaptersDeleted"
    @delete-error="onChapterDeleteError"
  />

  <ChangeCategoryDialog
    v-model="changeCategoryOpen"
    :initial-selection="categorySelection"
    @confirm="onChangeCategoryConfirmed"
    @edit-categories="router.push('/categories')"
  />

  <SetIntervalDialog
    v-model="setIntervalOpen"
    :interval="storedFetchInterval"
    :manga-id="Number(route.params.id)"
    @change="onIntervalChanged"
  />

  <DuplicateMangaDialog
    v-model="duplicateOpen"
    :manga="detail"
    :duplicates="duplicateEntries"
    @confirm="onConfirmDuplicate"
    @open-manga="m => router.push(`/manga/${m.id}`)"
    @migrate="onMigrateDuplicate"
  />

  <MangaCoverDialog
    v-if="detail"
    v-model="coverOpen"
    :src="server.thumbnailUrl(detail.id)"
    :title="detail.title"
    :in-library="detail.inLibrary"
    :is-local="isLocalSource"
  />

  <ChapterSettingsSheet
    v-model="chapterSettingsOpen"
    :manga-id="Number(route.params.id)"
    :api-url="server.apiUrl"
  />

  <TrackInfoDialog
    v-if="detail"
    v-model="trackingOpen"
    :manga-id="Number(route.params.id)"
    :manga-title="detail.title"
    @search="onTrackerSearch"
  />

  <v-snackbar v-model="snackbar" timeout="3000">{{ snackbarText }}</v-snackbar>
</template>

<style scoped>
@layer app-components {
/* --------------------------------------------------------------------------------------------- *
 * LoadingScreen.kt parity
 * --------------------------------------------------------------------------------------------- */
.manga-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
}

.manga-retry-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 80px;
  height: 40px;
  padding: 0 24px;
  border-radius: 9999px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  border: 0;
  cursor: pointer;
  transition: opacity 150ms ease;
}
.manga-retry-btn:hover { opacity: 0.92; }
.manga-retry-btn:active { opacity: 0.88; }

/* --------------------------------------------------------------------------------------------- *
 * PullRefresh floating indicator
 * --------------------------------------------------------------------------------------------- */
.manga-pull-indicator {
  position: fixed;
  top: 0;
  left: 50%;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgb(var(--v-theme-surface-container-high));
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  pointer-events: none;
  transition: transform 100ms ease-out;
}

/* --------------------------------------------------------------------------------------------- *
 * Layout — TwoPanelBox: (width / 2).coerceAtMost(450.dp) for startContent, remainder for endContent
 * --------------------------------------------------------------------------------------------- */
.manga-page {
  min-height: 100%;
  position: relative;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: hidden;
  box-sizing: border-box;
}
.manga-body {
  display: block;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
.manga-body--two-pane {
  display: grid;
  grid-template-columns: min(50%, 450px) minmax(0, 1fr);
  align-items: start;
  height: calc(100dvh - 64px);
  overflow: hidden;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
.manga-body--two-pane > .manga-start-pane {
  height: 100%;
  overflow-y: auto;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  padding-bottom: 24px;
}
.manga-body--two-pane > .manga-end-pane {
  height: 100%;
  overflow-y: auto;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  padding-bottom: 24px;
}
.manga-mutation-error { margin: 8px 16px 0; }

/* --------------------------------------------------------------------------------------------- *
 * Chapter rows
 * --------------------------------------------------------------------------------------------- */
.manga-body-medium { font-size: 14px; line-height: 20px; font-weight: 400; letter-spacing: .0178571429em; }
.manga-empty-chapters { padding: 24px 16px; color: rgb(var(--v-theme-on-surface-variant)); }

/* --------------------------------------------------------------------------------------------- *
 * SmallExtendedFloatingActionButton (ExtendedFabSmallTokens)
 * ContainerHeight 56dp, CornerLarge 16dp, TitleMedium 16/24 w500, primaryContainer
 * --------------------------------------------------------------------------------------------- */
.manga-fab {
  position: fixed;
  right: calc(16px + env(safe-area-inset-right));
  bottom: calc(16px + env(safe-area-inset-bottom));
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 56px;
  min-width: 56px;
  padding: 0 16px;
  border: 0;
  border-radius: 16px;
  background: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
  cursor: pointer;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, .3), 0 4px 8px 3px rgba(0, 0, 0, .15);
  transition: width 200ms ease, padding 200ms ease, box-shadow 150ms ease, background-color 150ms ease;
}
.manga-fab:not(.manga-fab--expanded) {
  width: 56px;
  padding: 0;
  justify-content: center;
}
.manga-fab:hover {
  box-shadow: 0 2px 3px 0 rgba(0, 0, 0, .3), 0 6px 10px 4px rgba(0, 0, 0, .15);
}
.manga-fab__icon {
  font-variation-settings: 'FILL' 1;
}
.manga-fab__label {
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  letter-spacing: .15px;
  white-space: nowrap;
}
.manga-fab-enter-active, .manga-fab-leave-active { transition: opacity 200ms ease, transform 200ms ease; }
.manga-fab-enter-from, .manga-fab-leave-to { opacity: 0; transform: scale(.6); }

/* --------------------------------------------------------------------------------------------- *
 * Bottom action menu wrapper
 * --------------------------------------------------------------------------------------------- */
.manga-bottom-menu-wrapper {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 6;
  pointer-events: none;
}
.manga-bottom-menu-wrapper > * {
  pointer-events: auto;
}
.manga-bottom-menu-wrapper--two-pane {
  display: flex;
  justify-content: flex-end;
}
}
</style>

<style>
/*
 * Mihon: `eu.kanade.presentation.manga.components.MangaToolbar` wraps
 * `eu.kanade.presentation.components.AppBar` with Material 3 `TopAppBar`:
 *   - Height: 64dp (TopAppBarDefaults.SmallTopAppBarHeight)
 *   - Background: MaterialTheme.colorScheme.surfaceColorAtElevation(3.dp) with
 *     backgroundAlphaProvider() (0f -> 1f on scroll, always 1f on large/tablet or action mode)
 *   - Content padding: 4dp horizontal (start & end)
 *   - Navigation icon: 48x48dp target, 40dp circular state layer, 24dp icon:
 *       * Normal mode: ArrowBack 24dp, M3 PlainTooltip "Navigate up"
 *       * Action mode: Close 24dp, M3 PlainTooltip "Cancel"
 *   - Title: titleLarge (22sp / 28sp w400), maxLines = 1, ellipsis, 56dp keyline from start.
 *       * Normal mode: title string, titleAlphaProvider() (0f -> 1f, always 1f on tablet)
 *       * Action mode: counter string (selectedCount), alpha = 1f
 *   - Actions:
 *       * Action mode: "Select all" (select_all 24dp), "Invert selection" (flip_to_back 24dp)
 *       * Normal mode:
 *           1. Download (download 24dp) with DownloadDropdownMenu (takeIf { !source.isLocalOrStub() })
 *           2. Filter (filter_list 24dp) with ColorScheme.active tint when hasFilters
 *           3. More options (more_vert 24dp) with M3 DropdownMenu (196dp, 4dp shape):
 *              Refresh, Edit categories (inLibrary), Migrate (inLibrary), Share (!isLocal), Notes
 */
.manga-toolbar {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 4px;
  color: rgb(var(--v-theme-on-surface));
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
}

.manga-toolbar__background {
  position: absolute;
  inset: 0;
  /* MaterialTheme.colorScheme.surfaceColorAtElevation(3.dp) -> surfaceContainer */
  background: rgb(var(--v-theme-surface-container));
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}

.manga-toolbar__nav-wrap,
.manga-toolbar__action-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

/* Material 3 IconButton: 48x48dp target, 40dp circular state layer (CornerFull) */
.manga-toolbar__nav,
.manga-toolbar__icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 48px;
  height: 48px;
  min-width: 48px;
  min-height: 48px;
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

.manga-toolbar__nav::before,
.manga-toolbar__icon::before {
  content: '';
  position: absolute;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: transparent;
  transition: background-color 0.15s ease;
  pointer-events: none;
}

.manga-toolbar__nav:hover::before,
.manga-toolbar__icon:hover::before {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.manga-toolbar__nav:active::before,
.manga-toolbar__icon:active::before {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}

.manga-toolbar__nav:focus-visible,
.manga-toolbar__icon:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.manga-toolbar__nav .v-icon,
.manga-toolbar__icon .v-icon {
  font-size: 24px;
  width: 24px;
  height: 24px;
}

/*
 * M3 PlainTooltip:
 * Container: inverseSurface, text: inverseOnSurface, 4dp shape (CornerExtraSmall),
 * labelSmall typography (12sp / 16sp w400), 4dp vertical / 8dp horizontal padding.
 */
.manga-toolbar__tooltip {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-family: Roboto, sans-serif;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  white-space: nowrap;
  pointer-events: none;
  display: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.1s linear;
  z-index: 1000;
}

.manga-toolbar__nav-wrap .manga-toolbar__tooltip {
  left: 0;
  transform: none;
}

.manga-toolbar__action-wrap:last-child .manga-toolbar__tooltip {
  left: auto;
  right: 0;
  transform: none;
}

.manga-toolbar__nav-wrap:hover .manga-toolbar__tooltip,
.manga-toolbar__nav-wrap:focus-within .manga-toolbar__tooltip,
.manga-toolbar__action-wrap:hover .manga-toolbar__tooltip,
.manga-toolbar__action-wrap:focus-within .manga-toolbar__tooltip {
  display: inline-block;
  opacity: 1;
  visibility: visible;
}

/*
 * Title: titleLarge (22sp / 28sp w400, onSurface).
 * Starts 4dp after 48dp nav button (+4dp content padding = 56dp keyline).
 */
.manga-toolbar__title {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  margin-inline-start: 4px;
  padding: 0 4px;
  overflow: hidden;
  font-family: Roboto, sans-serif;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  letter-spacing: 0;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: rgb(var(--v-theme-on-surface));
  transition: opacity 0.2s ease-in-out;
}

.manga-toolbar__actions {
  position: relative;
  display: flex;
  align-items: center;
  flex: none;
}

/*
 * M3 DropdownMenu (DropdownMenu.kt):
 * Fixed 196dp width, CornerExtraSmall 4dp, surfaceContainer, Level 2 shadow.
 */
.manga-overflow-menu {
  border-radius: 4px !important;
  box-shadow: 0px 2px 6px 2px rgba(0, 0, 0, 0.15), 0px 1px 2px 0px rgba(0, 0, 0, 0.3) !important;
}

.manga-overflow-list {
  width: 196px !important;
  min-width: 196px !important;
  max-width: 196px !important;
  border-radius: 4px !important;
  background-color: rgb(var(--v-theme-surface-container)) !important;
  color: rgb(var(--v-theme-on-surface)) !important;
  padding: 8px 0 !important;
}

.manga-overflow-list .v-list-item {
  min-height: 48px !important;
  padding: 0 12px !important;
  cursor: pointer;
}

.manga-overflow-list .v-list-item:hover {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent) !important;
}

.manga-overflow-list .v-list-item:active {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent) !important;
}

.manga-overflow-list .v-list-item-title {
  font-family: Roboto, sans-serif !important;
  font-size: 16px !important;
  line-height: 24px !important;
  font-weight: 400 !important;
  letter-spacing: 0.5px !important;
  color: rgb(var(--v-theme-on-surface)) !important;
}
</style>
