<script setup lang="ts">
/**
 * History screen — pixel parity target:
 *   mihon/app/src/main/java/eu/kanade/presentation/history/HistoryScreen.kt
 *   mihon/app/src/main/java/eu/kanade/tachiyomi/ui/history/HistoryTab.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/history/components/HistoryItem.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/history/components/HistoryDialogs.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/ListGroupHeader.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/VerticalFastScroller.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/screens/EmptyScreen.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/screens/LoadingScreen.kt
 *
 * Structure follows HistoryScreen.kt exactly:
 *   Scaffold(
 *     topBar = { SearchToolbar(titleContent = AppBarTitle("History"), searchQuery, actions = clear-history) },
 *     snackbarHost = { SnackbarHost(hostState) },
 *   ) { contentPadding ->
 *     list == null  -> LoadingScreen
 *     list empty    -> EmptyScreen("No results found" | "Nothing read recently")
 *     else          -> HistoryScreenContent(FastScrollLazyColumn)
 *   }
 */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import { createSuwayomiApi } from '@/core/api/client'
import type { Chapter, Manga } from '@/core/api/types'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { readPreference, writePreference } from '@/features/settings/stores/preferences'
import type { TriState } from '@/core/utils/library'
import { stringResource, MR } from '@/core/i18n'
import HistoryItem from '../components/HistoryItem.vue'
import HistoryFilterDialog from '../components/HistoryFilterDialog.vue'
import HistoryDeleteDialog from '../components/HistoryDeleteDialog.vue'
import HistoryDeleteAllDialog from '../components/HistoryDeleteAllDialog.vue'
import DuplicateMangaDialog from '@/features/library/components/DuplicateMangaDialog.vue'
import MihonEmptyScreen from '@/core/components/MihonEmptyScreen.vue'
import Md3CircularProgress from '@/core/components/Md3CircularProgress.vue'
import { findDuplicateManga } from '@/core/utils/duplicates'
import type { HistoryEntry } from '@/core/utils/history'
import { relativeDateText } from '@/core/utils/dates'

/** Mihon's `HistoryWithRelations` plus the chapter index needed to resume reading. */
interface Entry extends Omit<HistoryEntry, 'readAt'> {
  /** One-based source index of the last read chapter (Suwayomi `Chapter.index`). */
  chapterIndex: number
  /** Epoch milliseconds of the last read action; the list only keeps entries that have one. */
  readAt: number
  /** Whether the last read chapter was marked fully read. */
  read: boolean
  /** Last page read of the chapter. */
  lastPageRead: number
  /** Whether unread chapters remain in the manga. */
  hasUnread: boolean
  /** Page progress label ("Page X"). */
  readProgress?: string | null
}

interface HistoryGroup {
  key: string
  label: string
  items: Entry[]
}

const TOOLBAR_HEIGHT = 64
/** VerticalFastScroller: ThumbLength = 48.dp, ThumbThickness = 12.dp. */
const THUMB_LENGTH = 48

const server = useSuwayomiStore()
const router = useRouter()
const theme = useTheme()

const activeColor = computed(() => (theme.global.current.value.dark ? '#FFEB3B' : '#FFC107'))

/* ------------------------------------------------------------------ filter state -- */
const filterOpen = ref(false)
const filterUnfinishedManga = ref<TriState>(
  (readPreference('mihon.history.filterUnfinishedManga') as TriState) || 'all',
)
watch(filterUnfinishedManga, v => writePreference('mihon.history.filterUnfinishedManga', v))

const filterUnfinishedChapter = ref<TriState>(
  (readPreference('mihon.history.filterUnfinishedChapter') as TriState) || 'all',
)
watch(filterUnfinishedChapter, v => writePreference('mihon.history.filterUnfinishedChapter', v))

const filterNonLibrary = ref<TriState>(
  (readPreference('mihon.history.filterNonLibrary') as TriState) || 'all',
)
watch(filterNonLibrary, v => writePreference('mihon.history.filterNonLibrary', v))

const wideCover = ref<boolean>(readPreference('mihon.history.wideCover') === 'true')
watch(wideCover, v => writePreference('mihon.history.wideCover', String(v)))

const hasActiveFilters = computed(
  () =>
    filterUnfinishedManga.value !== 'all' ||
    filterUnfinishedChapter.value !== 'all' ||
    filterNonLibrary.value !== 'all',
)

/* ----------------------------------------------------------------- selection state -- */
const inSelectionMode = ref(false)
const selectedMangaIds = ref<number[]>([])
const selectionMode = computed(() => selectedMangaIds.value.length > 0 || inSelectionMode.value)
const selectedCount = computed(() => selectedMangaIds.value.length)
const batchDeleteOpen = ref(false)
const batchDeleting = ref(false)

function toggleSelection(mangaId: number) {
  if (selectedMangaIds.value.includes(mangaId)) {
    selectedMangaIds.value = selectedMangaIds.value.filter(id => id !== mangaId)
  } else {
    selectedMangaIds.value.push(mangaId)
  }
}

function onLongPress(mangaId: number) {
  if (!selectionMode.value) {
    inSelectionMode.value = true
    selectedMangaIds.value = [mangaId]
  } else {
    toggleSelection(mangaId)
  }
}

function selectAll() {
  selectedMangaIds.value = visible.value.map(e => e.mangaId)
}

function invertSelection() {
  const current = new Set(selectedMangaIds.value)
  selectedMangaIds.value = visible.value.filter(e => !current.has(e.mangaId)).map(e => e.mangaId)
}

function clearSelection() {
  selectedMangaIds.value = []
  inSelectionMode.value = false
}

const searchQuery = ref<string | null>(null)
const searchOpen = computed(() => searchQuery.value !== null)
const searchInput = ref<HTMLInputElement | null>(null)
const entries = ref<Entry[] | null>(null)
const loading = ref(false)
const snackbar = ref<string | null>(null)
const deleteAllOpen = ref(false)
const deleteTarget = ref<Entry | null>(null)
/** HistoryDeleteDialog visibility (the reference keeps the selected row in the view model). */
const deleteOpen = ref(false)
/** Dialog.DuplicateManga (HistoryViewModel.addFavorite). */
const duplicateOpen = ref(false)
const duplicateTarget = ref<Manga | null>(null)
const listElement = ref<HTMLElement | null>(null)

let generation = 0
let snackbarTimer: ReturnType<typeof setTimeout> | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined

function showSnackbar(message: string) {
  snackbar.value = message
  if (snackbarTimer) clearTimeout(snackbarTimer)
  snackbarTimer = setTimeout(() => { snackbar.value = null }, 4000)
}

/* ------------------------------------------------------------------ data -- */

/** Every library entry of the server, de-duplicated across the categories. */
const uniqueLibraryManga = computed<Manga[]>(() => {
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

/**
 * Suwayomi-Server exposes no history endpoint: the history rows are derived from the chapter
 * table. `Chapter.read` / `Chapter.lastReadAt` mark the read chapters of a title and
 * `Manga.lastReadAt` is the server side fallback. A title without any read timestamp cannot
 * appear in the history, and the Suwayomi REST contract keeps those fields deprecated, so the
 * list can legitimately be empty on a server that never hydrated the read state.
 *
 * In accordance with Mihon's `historyView.sq`, each manga appears at most once in history with
 * its latest read chapter.
 */
async function load() {
  const token = ++generation
  loading.value = true
  entries.value = null
  await server.loadLibrary()
  if (token !== generation) return
  if (server.libraryError) {
    entries.value = []
    loading.value = false
    showSnackbar(server.libraryError)
    return
  }
  const unique = uniqueLibraryManga.value
  const api = createSuwayomiApi(server.apiUrl)

  // Prioritize manga with known read timestamps, then any remaining library manga up to limit
  const withRead = unique.filter(m => m.lastReadAt && m.lastReadAt > 0).sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0))
  const withoutRead = unique.filter(m => !m.lastReadAt || m.lastReadAt <= 0)
  // Process up to 150 most recent read manga (or first 50 unread fallback if none marked)
  const candidates = withRead.length > 0 ? withRead.slice(0, 150) : withoutRead.slice(0, 50)

  const queue = [...candidates]
  const details: { manga: Manga; last: Chapter | null; readAt: number; hasUnread: boolean }[] = []
  const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length > 0) {
      if (token !== generation) return
      const manga = queue.shift()
      if (!manga) break
      try {
        const chapters = await api.chapters(manga.id).catch(() => [] as Chapter[])
        let last: Chapter | null = null
        for (const chapter of chapters) {
          if (!chapter.read && !(chapter.lastReadAt > 0)) continue
          if (!last || (chapter.lastReadAt || 0) > (last.lastReadAt || 0)) last = chapter
        }
        const rawReadAt = (last?.lastReadAt || 0) || (manga.lastReadAt || 0)
        // Suwayomi returns lastReadAt in epoch seconds; convert to epoch milliseconds
        const readAt = rawReadAt > 0 && rawReadAt < 100_000_000_000 ? rawReadAt * 1000 : rawReadAt
        const hasUnread = manga.unreadCount != null && manga.unreadCount > 0 ? true : chapters.some(c => !c.read)
        details.push({ manga, last, readAt, hasUnread })
      } catch {
        // Skip on fetch failure
      }
    }
  })
  await Promise.all(workers)
  if (token !== generation) return
  entries.value = details
    .filter(detail => detail.readAt > 0 && detail.last !== null)
    .map(detail => {
      const lastPageRead = detail.last!.lastPageRead || 0
      const isUnfinishedChapter = !detail.last!.read && lastPageRead > 0
      const readProgress = isUnfinishedChapter ? `Page ${lastPageRead + 1}` : null

      return {
        id: detail.last!.id,
        mangaId: detail.manga.id,
        chapterId: detail.last!.id,
        title: detail.manga.title,
        chapterNumber: detail.last!.chapterNumber,
        readAt: detail.readAt,
        inLibrary: detail.manga.inLibrary,
        chapterIndex: detail.last!.index,
        read: detail.last!.read,
        lastPageRead,
        hasUnread: detail.hasUnread,
        readProgress,
      }
    })
    .sort((a, b) => b.readAt - a.readAt)
  loading.value = false
}

watch(() => server.apiUrl, () => { void load() }, { immediate: true })

const visible = computed<Entry[]>(() => {
  let list = entries.value ?? []

  const needle = searchQuery.value?.trim().toLocaleLowerCase()
  if (needle) {
    list = list.filter(entry => entry.title.toLocaleLowerCase().includes(needle))
  }

  // Unfinished manga filter: hides entries whose chapters are fully read
  if (filterUnfinishedManga.value === 'include') {
    list = list.filter(entry => entry.hasUnread)
  } else if (filterUnfinishedManga.value === 'exclude') {
    list = list.filter(entry => !entry.hasUnread)
  }

  // Unfinished chapter filter: retains only entries where lastPageRead > 0 && !read
  if (filterUnfinishedChapter.value === 'include') {
    list = list.filter(entry => entry.lastPageRead > 0 && !entry.read)
  } else if (filterUnfinishedChapter.value === 'exclude') {
    list = list.filter(entry => !(entry.lastPageRead > 0 && !entry.read))
  }

  // Non-library entries filter
  if (filterNonLibrary.value === 'include') {
    list = list.filter(entry => !entry.inLibrary)
  } else if (filterNonLibrary.value === 'exclude') {
    list = list.filter(entry => entry.inLibrary)
  }

  return list
})

function dayKey(milliseconds: number) {
  const date = new Date(milliseconds)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** HistoryViewModel.toHistoryUiModels(): a header is inserted whenever the day changes. */
const groups = computed<HistoryGroup[]>(() => {
  const result: HistoryGroup[] = []
  for (const entry of visible.value) {
    const key = dayKey(entry.readAt)
    let group = result.find(item => item.key === key)
    if (!group) {
      group = { key, label: relativeDateText(new Date(entry.readAt)), items: [] }
      result.push(group)
    }
    group.items.push(entry)
  }
  return result
})

const isEmpty = computed(() => !loading.value && entries.value !== null && visible.value.length === 0)
/* HistoryScreen.kt: `if (!state.searchQuery.isNullOrEmpty()) no_results_found else information_no_recent_manga` */
const emptyMessage = computed(() => (searchQuery.value ? 'No results found' : 'Nothing read recently'))

/* --------------------------------------------------------------- actions -- */

async function openSearch() {
  searchQuery.value = ''
  await nextTick()
  searchInput.value?.focus()
}

function closeSearch() {
  searchQuery.value = null
}

function resetSearch() {
  searchQuery.value = ''
  void nextTick(() => searchInput.value?.focus())
}

function onSearchSubmit() {
  searchInput.value?.blur()
}

function entryOf(mangaId: number) {
  return (entries.value ?? []).find(entry => entry.mangaId === mangaId) ?? null
}

/**
 * HistoryTab.kt & GetNextChapters.kt:
 * - If the last read chapter is not finished (!entry.read), resume reading that chapter.
 * - If that chapter is finished, open the next chapter in source order (index > last.index).
 * - If no next chapter exists, show MR.strings.no_next_chapter ("Next chapter not found").
 */
async function resume(mangaId: number) {
  const entry = entryOf(mangaId)
  if (!entry) return
  try {
    const api = createSuwayomiApi(server.apiUrl)
    const chapters = await api.chapters(mangaId)
    let target: Chapter | undefined
    if (!entry.read) {
      target = chapters.find(c => c.index === entry.chapterIndex)
    }
    if (!target) {
      target = chapters
        .filter(c => c.index > entry.chapterIndex)
        .sort((a, b) => a.index - b.index)[0]
    }
    if (!target) {
      /* MR.strings.no_next_chapter */
      showSnackbar('Next chapter not found')
      return
    }
    await router.push(`/manga/${mangaId}/read/${target.index}`)
  } catch {
    await router.push(`/manga/${mangaId}`)
  }
}

function openManga(mangaId: number) {
  void router.push(`/manga/${mangaId}`)
}

async function addToLibrary(mangaId: number) {
  try {
    const api = createSuwayomiApi(server.apiUrl)
    await api.addToLibrary(mangaId)
    const entry = entryOf(mangaId)
    if (entry) entry.inLibrary = true
    await server.loadLibrary()
  } catch {
    showSnackbar('Suwayomi denied the library change. Check your server access.')
  }
}

/** `HistoryViewModel.Dialog.Delete(item)`: the row is kept in the view model for the dialog. */
function askDelete(entry: HistoryEntry) {
  deleteTarget.value = entries.value?.find(item => item.mangaId === entry.mangaId) ?? null
  deleteOpen.value = true
}

/**
 * `HistoryViewModel.removeFromHistory`.
 *
 * The removal itself is done by HistoryDeleteDialog (it owns the Suwayomi mutation and reports
 * the outcome through the `deleted` / `error` events). The screen only refreshes the list.
 */
async function onDeleted() {
  deleteTarget.value = null
  await server.loadLibrary()
  await load()
}

async function confirmBatchDelete() {
  if (!selectedMangaIds.value.length) return
  batchDeleting.value = true
  try {
    const api = createSuwayomiApi(server.apiUrl)
    const targets = entries.value?.filter(e => selectedMangaIds.value.includes(e.mangaId)) ?? []
    for (const item of targets) {
      try {
        await api.modifyChapter(item.mangaId, item.chapterIndex, { read: false, lastPageRead: 0 })
      } catch {
        // Continue with others
      }
    }
    clearSelection()
    await server.loadLibrary()
    await load()
    showSnackbar('Selected entries removed from history')
  } finally {
    batchDeleting.value = false
    batchDeleteOpen.value = false
  }
}

/**
 * `HistoryViewModel.removeAllHistory`.
 *
 * Mihon deletes the rows of its own history table. Suwayomi has no history table: the history is
 * derived from the chapter read state, so "remove everything" would mean un-reading every
 * chapter of every title - a different (and destructive) operation than the reference one, which
 * keeps the reading progress. The dialog therefore reports the limitation instead of pretending.
 */
function confirmDeleteAll() {
  deleteAllOpen.value = false
}

/**
 * `HistoryViewModel.addFavorite(mangaId)`: duplicates are looked up first and the
 * DuplicateMangaDialog is shown if duplicates exist in library.
 */
async function requestFavorite(mangaId: number) {
  let manga = uniqueLibraryManga.value.find(item => item.id === mangaId) ?? null
  if (!manga) {
    try {
      manga = await createSuwayomiApi(server.apiUrl).manga(mangaId)
    } catch {
      /* Fallback to direct library addition if manga detail fetch fails */
    }
  }
  if (!manga) {
    void addToLibrary(mangaId)
    return
  }
  if (findDuplicateManga(manga, uniqueLibraryManga.value).length) {
    duplicateTarget.value = manga
    duplicateOpen.value = true
    return
  }
  void addToLibrary(mangaId)
}

/* ------------------------------------------------------------ fast scroll -- */
/* FastScrollLazyColumn draws a draggable thumb on the right edge of the list. */

const fastScroll = reactive({ visible: false, dragging: false, top: 0 })

interface ScrollMetrics {
  /** Document offset of the first list pixel. */
  listTop: number
  /** Scrollable distance of the list content. */
  scrollable: number
  /** Height of the list viewport below the toolbar. */
  viewport: number
}

function metrics(): ScrollMetrics {
  const list = listElement.value
  const viewport = Math.max(window.innerHeight - TOOLBAR_HEIGHT, 120)
  if (!list) return { listTop: TOOLBAR_HEIGHT, scrollable: 0, viewport }
  const listTop = list.getBoundingClientRect().top + window.scrollY
  return { listTop, scrollable: Math.max(list.scrollHeight - viewport, 0), viewport }
}

function updateFastScroll() {
  const { listTop, scrollable, viewport } = metrics()
  if (scrollable <= 0) { fastScroll.visible = false; return }
  /* The thumb keeps the fixed ThumbLength (48dp); only its offset follows the scroll ratio. */
  const progress = Math.min(Math.max((window.scrollY - (listTop - TOOLBAR_HEIGHT)) / scrollable, 0), 1)
  fastScroll.top = (viewport - THUMB_LENGTH) * progress
  fastScroll.visible = true
  if (hideTimer) clearTimeout(hideTimer)
  /* ScrollBarVisibilityDuration = 2.seconds */
  hideTimer = setTimeout(() => { if (!fastScroll.dragging) fastScroll.visible = false }, 2000)
}

function startFastScroll(event: PointerEvent) {
  fastScroll.dragging = true
  fastScroll.visible = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  moveFastScroll(event)
}

function moveFastScroll(event: PointerEvent) {
  if (!fastScroll.dragging) return
  const { listTop, scrollable, viewport } = metrics()
  if (scrollable <= 0) return
  const ratio = Math.min(Math.max((event.clientY - (TOOLBAR_HEIGHT + 8)) / Math.max(viewport - THUMB_LENGTH, 1), 0), 1)
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight
  const target = Math.min(Math.max(listTop - TOOLBAR_HEIGHT + ratio * scrollable, 0), Math.max(maxScroll, 0))
  window.scrollTo({ top: target })
}

function stopFastScroll() {
  fastScroll.dragging = false
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { fastScroll.visible = false }, 2000)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && searchOpen.value) {
    closeSearch()
  }
}

onMounted(() => {
  window.addEventListener('scroll', updateFastScroll, { passive: true })
  window.addEventListener('resize', updateFastScroll)
  window.addEventListener('keydown', onKeydown)
  updateFastScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateFastScroll)
  window.removeEventListener('resize', updateFastScroll)
  window.removeEventListener('keydown', onKeydown)
  if (snackbarTimer) clearTimeout(snackbarTimer)
  if (hideTimer) clearTimeout(hideTimer)
})
</script>

<template>
  <section class="history-screen">
    <!--
      SearchToolbar (AppBar.kt:268-418):
      TopAppBar 64dp, surface container (elevation 0).
      - In regular mode: title "History" (titleLarge 22/28 w400), actions: Search, Clear history.
      - In search mode: UpIcon (ArrowBack), BasicTextField (titleMedium 18/24 w400), actions: Reset (if non-empty), Clear history.
    -->
    <header class="history-toolbar" :class="{ 'is-selection': selectionMode }">
      <!-- Selection Mode Toolbar (HistorySelectionToolbar) -->
      <template v-if="selectionMode">
        <div class="history-toolbar-nav-wrap">
          <button
            type="button"
            class="history-toolbar-action history-toolbar-action--nav"
            aria-label="Cancel selection"
            title="Cancel selection"
            @click="clearSelection"
          >
            <span class="material-symbols-rounded history-toolbar-action-icon" aria-hidden="true">close</span>
          </button>
          <span class="history-plain-tooltip" role="tooltip">Cancel selection</span>
        </div>

        <h1 class="history-toolbar-title">{{ selectedCount }}</h1>

        <div class="history-toolbar-actions">
          <div class="history-toolbar-action-wrap">
            <button
              type="button"
              class="history-toolbar-action"
              aria-label="Select all"
              title="Select all"
              @click="selectAll"
            >
              <span class="material-symbols-rounded history-toolbar-action-icon" aria-hidden="true">select_all</span>
            </button>
            <span class="history-plain-tooltip" role="tooltip">Select all</span>
          </div>

          <div class="history-toolbar-action-wrap">
            <button
              type="button"
              class="history-toolbar-action"
              aria-label="Invert selection"
              title="Invert selection"
              @click="invertSelection"
            >
              <span class="material-symbols-rounded history-toolbar-action-icon" aria-hidden="true">flip_to_back</span>
            </button>
            <span class="history-plain-tooltip" role="tooltip">Invert selection</span>
          </div>

          <div class="history-toolbar-action-wrap">
            <button
              type="button"
              class="history-toolbar-action"
              aria-label="Delete selected"
              title="Delete selected"
              @click="batchDeleteOpen = true"
            >
              <span class="material-symbols-rounded history-toolbar-action-icon" aria-hidden="true">delete</span>
            </button>
            <span class="history-plain-tooltip" role="tooltip">Delete selected</span>
          </div>
        </div>
      </template>

      <!-- Regular / Search Mode Toolbar -->
      <template v-else>
        <!-- Search Mode Navigation Icon (AppBar.kt: UpIcon -> ArrowBack) -->
        <div v-if="searchOpen" class="history-toolbar-nav-wrap">
          <button
            type="button"
            class="history-toolbar-action history-toolbar-action--nav"
            aria-label="Navigate up"
            title="Navigate up"
            @click="closeSearch"
          >
            <span class="material-symbols-rounded history-toolbar-action-icon" aria-hidden="true">arrow_back</span>
          </button>
          <span class="history-plain-tooltip" role="tooltip">Navigate up</span>
        </div>

        <!-- Regular Title: AppBarTitle(stringResource(MR.strings.history)) -->
        <h1 v-if="!searchOpen" class="history-toolbar-title">History</h1>

        <!-- Search Mode: BasicTextField in title slot (titleMedium 18sp w400, "Search…", secondaryItemAlpha 0.78) -->
        <form v-else class="history-search-form" role="search" @submit.prevent="onSearchSubmit">
          <input
            ref="searchInput"
            :value="searchQuery ?? ''"
            type="search"
            class="history-search-input"
            placeholder="Search…"
            aria-label="Search history"
            autocomplete="off"
            enterkeyhint="search"
            @input="searchQuery = ($event.target as HTMLInputElement).value"
            @keydown.esc="closeSearch"
          >
        </form>

        <!-- Actions slot -->
        <div class="history-toolbar-actions">
          <!-- Search action (only when search is closed) -->
          <div v-if="!searchOpen" class="history-toolbar-action-wrap">
            <button
              type="button"
              class="history-toolbar-action"
              aria-label="Search"
              title="Search"
              @click="openSearch"
            >
              <span class="material-symbols-rounded history-toolbar-action-icon" aria-hidden="true">search</span>
            </button>
            <span class="history-plain-tooltip" role="tooltip">Search</span>
          </div>

          <!-- Reset action (only when search is open and query is not empty) -->
          <div v-else-if="searchQuery" class="history-toolbar-action-wrap">
            <button
              type="button"
              class="history-toolbar-action"
              aria-label="Reset"
              title="Reset"
              @click="resetSearch"
            >
              <span class="material-symbols-rounded history-toolbar-action-icon" aria-hidden="true">close</span>
            </button>
            <span class="history-plain-tooltip" role="tooltip">Reset</span>
          </div>

          <!-- Filter action (opens HistoryFilterDialog) -->
          <div class="history-toolbar-action-wrap">
            <button
              type="button"
              class="history-toolbar-action"
              :style="hasActiveFilters ? { color: activeColor } : undefined"
              aria-label="Filter"
              title="Filter"
              @click="filterOpen = true"
            >
              <span class="material-symbols-rounded history-toolbar-action-icon" aria-hidden="true">filter_list</span>
            </button>
            <span class="history-plain-tooltip" role="tooltip">Filter</span>
          </div>

          <!-- Clear history action (always visible) -->
          <div class="history-toolbar-action-wrap">
            <button
              type="button"
              class="history-toolbar-action"
              aria-label="Clear history"
              title="Clear history"
              @click="deleteAllOpen = true"
            >
              <span class="material-symbols-rounded history-toolbar-action-icon" aria-hidden="true">delete_sweep</span>
            </button>
            <span class="history-plain-tooltip" role="tooltip">Clear history</span>
          </div>
        </div>
      </template>
    </header>

    <!-- LoadingScreen.kt: Box(fillMaxSize, contentAlignment = Center) { CircularProgressIndicator() } -->
    <div v-if="loading" class="history-loading" role="status" aria-label="Loading history">
      <Md3CircularProgress :size="40" :stroke="4" />
    </div>

    <!-- EmptyScreen.kt: EmptyScreen(stringRes = if (!searchQuery.isNullOrEmpty()) no_results_found else information_no_recent_manga) -->
    <div v-else-if="isEmpty" class="history-empty">
      <MihonEmptyScreen :message="emptyMessage" />
    </div>

    <!-- HistoryScreenContent.kt: FastScrollLazyColumn -->
    <div v-else ref="listElement" class="history-list">
      <section v-for="group in groups" :key="group.key" :aria-label="group.label">
        <!-- ListGroupHeader.kt: padding(horizontal = 16dp, vertical = 8dp), onSurfaceVariant, SemiBold, bodyMedium -->
        <h2 class="history-header">{{ group.label }}</h2>
        <HistoryItem
          v-for="entry in group.items"
          :key="`${entry.mangaId}:${entry.chapterId}`"
          :entry="entry"
          :selected="selectedMangaIds.includes(entry.mangaId)"
          :selection-mode="selectionMode"
          :wide-cover="wideCover"
          @cover="openManga"
          @resume="resume"
          @favorite="requestFavorite"
          @delete="askDelete"
          @select="toggleSelection(entry.mangaId)"
          @longpress="onLongPress(entry.mangaId)"
        />
      </section>
    </div>

    <!-- VerticalFastScroller handle: 12dp wide, 48dp long, primary colour, right edge. -->
    <div
      class="history-fast-scroll"
      :class="{ 'history-fast-scroll--visible': fastScroll.visible }"
      @pointerdown="startFastScroll"
      @pointermove="moveFastScroll"
      @pointerup="stopFastScroll"
      @pointercancel="stopFastScroll"
    >
      <span class="history-fast-scroll-thumb" :style="{ transform: `translateY(${fastScroll.top}px)` }" />
    </div>

    <!-- HistoryDeleteAllDialog.kt: Suwayomi has no history table, so the dialog reports the
         limitation itself (the reference deletes the rows of its own history table). -->
    <HistoryDeleteAllDialog v-model="deleteAllOpen" @delete="confirmDeleteAll" />

    <!-- HistoryDeleteDialog.kt: the dialog owns the Suwayomi mutation (un-read the chapter),
         the screen only refreshes the list afterwards. -->
    <HistoryDeleteDialog
      v-model="deleteOpen"
      :manga-id="deleteTarget?.mangaId ?? 0"
      :chapter-index="deleteTarget?.chapterIndex ?? null"
      @deleted="onDeleted"
      @error="showSnackbar"
    />

    <!-- Dialog.DuplicateManga (HistoryViewModel.addFavorite) -->
    <DuplicateMangaDialog
      v-model="duplicateOpen"
      :manga="duplicateTarget"
      @confirm="duplicateTarget && addToLibrary(duplicateTarget.id)"
      @open-manga="manga => openManga(manga.id)"
      @migrate="manga => openManga(manga.id)"
    />

    <!-- HistoryFilterDialog (Section 3.10) -->
    <HistoryFilterDialog
      v-model:opened="filterOpen"
      v-model:filter-unfinished-manga="filterUnfinishedManga"
      v-model:filter-unfinished-chapter="filterUnfinishedChapter"
      v-model:filter-non-library="filterNonLibrary"
      v-model:wide-cover="wideCover"
    />

    <!-- Batch Delete Confirmation Dialog (Section 3.10) -->
    <v-dialog v-model="batchDeleteOpen" max-width="360">
      <v-card rounded="xl" color="surface-container-high" class="pa-4">
        <v-card-title class="text-headline-small px-2 pt-2">
          {{ stringResource(MR.strings.history_delete_selected) || 'Delete selected' }}
        </v-card-title>
        <v-card-text class="text-body-medium px-2 py-3 text-medium-emphasis">
          {{ stringResource(MR.strings.history_delete_selected_confirmation) || 'Are you sure you want to remove the selected entries from history?' }}
        </v-card-text>
        <v-card-actions class="px-2 pb-2 justify-end">
          <v-btn variant="text" :disabled="batchDeleting" @click="batchDeleteOpen = false">
            {{ stringResource(MR.strings.action_cancel) || 'Cancel' }}
          </v-btn>
          <v-btn color="error" variant="text" :loading="batchDeleting" @click="confirmBatchDelete">
            {{ stringResource(MR.strings.action_remove) || 'Remove' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- SnackbarHost.kt: Material 3 Snackbar -->
    <Transition name="history-snackbar-fade">
      <div v-if="snackbar" class="history-snackbar" role="status" aria-live="polite">{{ snackbar }}</div>
    </Transition>
  </section>
</template>

<style scoped>
.history-screen {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  padding-bottom: 16px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
}

.history-list {
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
}

/*
 * TopAppBar (AppBar.kt / SearchToolbar.kt):
 * Height = 64dp, surface container color, elevation 0dp, horizontal padding = 4dp.
 */
.history-toolbar {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  height: 64px;
  padding: 0 4px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

.history-toolbar.is-selection {
  background: rgb(var(--v-theme-surface-container-high));
}

/* Nav button wrapper */
.history-toolbar-nav-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/*
 * AppBarTitle: titleLarge (22sp / 28sp w400), onSurface, maxLines = 1, ellipsis.
 * When there is no navigation button, starts with 12px margin-left (16dp keyline from container start).
 */
.history-toolbar-title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0 0 0 12px;
  padding: 0;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/*
 * BasicTextField in SearchToolbar: titleMedium 18sp w400, onBackground color.
 * TopAppBarTitleInsetWithStart = 4dp after nav icon, TopAppBarTitleInset = 16dp before actions.
 */
.history-search-form {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0 16px 0 4px;
  display: flex;
  align-items: center;
}

.history-search-input {
  width: 100%;
  min-width: 0;
  height: 24px;
  margin: 0;
  padding: 0;
  border: none;
  outline: none;
  background: transparent;
  color: rgb(var(--v-theme-on-background));
  caret-color: rgb(var(--v-theme-on-background));
  font-family: inherit;
  font-size: 18px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.15px;
}

.history-search-input::placeholder {
  color: rgb(var(--v-theme-on-background));
  opacity: 0.78;
}

.history-search-input::-webkit-search-cancel-button {
  display: none;
}

/* Toolbar actions container */
.history-toolbar-actions {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

.history-toolbar-action-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/*
 * MD3 IconButton (IconButtonTokens.kt):
 * 48dp interactive touch target, 40dp circular state layer, 24dp icon.
 */
.history-toolbar-action {
  position: relative;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: none;
  border-radius: 24px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.history-toolbar-action::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40px;
  height: 40px;
  transform: translate(-50%, -50%);
  border-radius: 20px;
  background: rgb(var(--v-theme-on-surface));
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms ease;
}

.history-toolbar-action:hover::before { opacity: 0.08; }
.history-toolbar-action:active::before { opacity: 0.12; }
.history-toolbar-action:focus-visible { outline: 2px solid rgb(var(--v-theme-on-surface)); outline-offset: 2px; }

.history-toolbar-action-icon {
  position: relative;
  font-size: 24px;
  line-height: 1;
  width: 24px;
  height: 24px;
}

/*
 * PlainTooltip (M3):
 * Background inverseSurface, text inverseOnSurface, shape CornerExtraSmall (4dp),
 * padding 4dp 8dp, typography labelSmall (12sp/16sp w400).
 */
.history-plain-tooltip {
  position: absolute;
  bottom: -28px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: none;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.4px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 150ms ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
.history-toolbar-action-wrap:last-child .history-plain-tooltip {
  left: auto;
  right: 0;
  transform: none;
}

.history-toolbar-action-wrap:hover .history-plain-tooltip,
.history-toolbar-action-wrap:focus-within .history-plain-tooltip,
.history-toolbar-nav-wrap:hover .history-plain-tooltip,
.history-toolbar-nav-wrap:focus-within .history-plain-tooltip {
  display: inline-block;
  opacity: 1;
  visibility: visible;
}

/* LoadingScreen.kt: Box(fillMaxSize, contentAlignment = Center) */
.history-loading {
  flex: 1 1 auto;
  display: grid;
  place-items: center;
  min-height: 0;
}

/* EmptyScreen.kt: Column(fillMaxSize, center) with padding(horizontal = 24dp) */
.history-empty {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 0 24px;
  text-align: center;
}

/* ListGroupHeader.kt: padding(horizontal = 16dp, vertical = 8dp), onSurfaceVariant, SemiBold, bodyMedium */
.history-header {
  margin: 0;
  padding: 8px 16px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}

/*
 * VerticalFastScroller (VerticalFastScroller.kt: ThumbLength = 48dp, ThumbThickness = 12dp,
 * ThumbShape = RoundedCornerShape(6dp), thumbColor = MaterialTheme.colorScheme.primary,
 * ScrollBarVisibilityDuration = 2.seconds).
 */
.history-fast-scroll {
  position: fixed;
  top: 64px;
  right: 0;
  width: 28px;
  height: calc(100dvh - var(--v-layout-bottom, 0px) - 64px);
  z-index: 4;
  opacity: 0;
  transition: opacity 0.2s ease;
  touch-action: none;
}

.history-fast-scroll--visible {
  opacity: 1;
}

.history-fast-scroll-thumb {
  position: absolute;
  top: 0;
  right: 8px;
  width: 12px;
  height: 48px;
  border-radius: 6px;
  background: rgb(var(--v-theme-primary));
  cursor: pointer;
}

/* Material 3 snackbar: inverseSurface container, 4dp radius, bodyMedium (14sp/20sp) */
.history-snackbar {
  position: fixed;
  left: 50%;
  bottom: calc(var(--v-layout-bottom, 0px) + 16px);
  transform: translateX(-50%);
  z-index: 100;
  max-width: min(560px, calc(100vw - 32px));
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  box-shadow: 0 3px 5px -1px rgba(0, 0, 0, 0.2), 0 6px 10px 0 rgba(0, 0, 0, 0.14), 0 1px 18px 0 rgba(0, 0, 0, 0.12);
}

.history-snackbar-fade-enter-active,
.history-snackbar-fade-leave-active {
  transition: opacity 0.15s ease;
}

.history-snackbar-fade-enter-from,
.history-snackbar-fade-leave-to {
  opacity: 0;
}
</style>
