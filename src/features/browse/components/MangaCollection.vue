<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import type { Manga } from '@/core/api/types'
import type { DisplayMode } from '@/features/settings/stores/preferences'
import type { ChapterSummary } from '@/core/utils/library'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import MangaCard from './MangaCard.vue'
import LibraryListItem from '@/features/library/components/LibraryListItem.vue'
import LibraryCompactGridItem from '@/features/library/components/LibraryCompactGridItem.vue'
import LibraryComfortableGridItem from '@/features/library/components/LibraryComfortableGridItem.vue'
import GlobalSearchItem from './GlobalSearchItem.vue'
import BrowseSourceLoadingItem from './BrowseSourceLoadingItem.vue'
import { useResponsiveGridRows } from '@/core/composables/useResponsiveGridRows'

const props = withDefaults(defineProps<{
  items: Manga[]
  display?: DisplayMode
  variant?: DisplayMode
  catalogue?: boolean
  summaries?: Record<number, ChapterSummary>
  /** Controlled multi-selection (Mihon `selection: Set<Long>`). Undefined keeps it local to the list. */
  selection?: number[]
  /** Mihon `searchQuery`; drives the "Search for … globally" row. */
  searchQuery?: string
  /**
   * Mihon `mangaList.loadState.refresh/append is LoadState.Loading`: the catalogue list and
   * grid render `BrowseSourceLoadingItem()` as a full-width row (`maxLineSpan` in the grid).
   */
  loading?: boolean
  /** Override columns count (0 for adaptive 128dp, >0 for fixed columns). Defaults to orientation preference. */
  columns?: number
  /** Additional bottom padding (e.g. navigation bar / actions bar) for `contentPadding + PaddingValues(8.dp)`. */
  contentPaddingBottom?: number | string
  /** Whether this collection is on the active pager page (in library). */
  isActivePage?: boolean
}>(), {
  display: 'compact',
  variant: undefined,
  catalogue: false,
  summaries: () => ({}),
  selection: undefined,
  searchQuery: '',
  loading: false,
  columns: undefined,
  contentPaddingBottom: 0,
  isActivePage: true,
})

const emit = defineEmits<{
  'update:selection': [value: number[]]
  'range-select': [id: number]
  'global-search': []
}>()

const server = useSuwayomiStore()
const prefs = usePreferencesStore()
const broken = ref(new Set<number>())
const viewport = useDisplay()
const columns = computed(() => props.columns !== undefined
  ? props.columns
  : (viewport.width.value > viewport.height.value ? prefs.landscapeColumns : prefs.portraitColumns)
)
const gridStyle = computed(() => {
  const style: Record<string, string> = {}
  if (columns.value) {
    style.gridTemplateColumns = `repeat(${columns.value}, minmax(0, 1fr))`
  } else if (activeDisplay.value === 'comfortable-panorama') {
    style.gridTemplateColumns = 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))'
  }
  if (props.contentPaddingBottom) {
    style.paddingBottom = typeof props.contentPaddingBottom === 'number'
      ? `${props.contentPaddingBottom + 8}px`
      : `calc(${props.contentPaddingBottom} + 8px)`
  }
  return style
})
const listStyle = computed(() => {
  if (!props.contentPaddingBottom) return {}
  return {
    paddingBottom: typeof props.contentPaddingBottom === 'number'
      ? `${props.contentPaddingBottom + 8}px`
      : `calc(${props.contentPaddingBottom} + 8px)`,
  }
})
const activeDisplay = computed(() => props.variant ?? props.display)
// `LibraryPager.kt`: the compact grid and the cover-only grid both use `LibraryCompactGrid`.
const libraryCompact = computed(() => !props.catalogue && (activeDisplay.value === 'compact' || activeDisplay.value === 'covers'))
// `LibraryPager.kt`: the comfortable grid uses `LibraryComfortableGrid`.
const libraryComfortable = computed(() => !props.catalogue && props.display === 'comfortable')
watch(() => server.apiUrl, () => { broken.value = new Set() })

/* ------------------------------------------------------------------ *
 * Multi-selection (LibraryList.kt `selection: Set<Long>`)
 * ------------------------------------------------------------------ */
const localSelection = ref<number[]>([])
const selection = computed(() => props.selection ?? localSelection.value)
const selectionActive = computed(() => selection.value.length > 0)
const lastSelected = ref<number | null>(null)

function commitSelection(next: number[]) {
  if (props.selection === undefined) localSelection.value = next
  else emit('update:selection', next)
}
function isSelected(id: number) { return selection.value.includes(id) }

/** Mihon `toggleSelection`: a tap toggles a single entry while a selection exists. */
function toggleSelection(id: number) {
  const next = selection.value.includes(id) ? selection.value.filter(value => value !== id) : [...selection.value, id]
  lastSelected.value = next.includes(id) ? id : null
  commitSelection(next)
}

/** Mihon `toggleRangeSelection`: a long press selects the range up to the last touched entry. */
function rangeSelect(id: number) {
  const index = props.items.findIndex(item => item.id === id)
  const lastIndex = lastSelected.value === null ? -1 : props.items.findIndex(item => item.id === lastSelected.value)
  const next = [...selection.value]
  if (index >= 0 && lastIndex >= 0) {
    const [from, to] = lastIndex < index ? [lastIndex, index] : [index, lastIndex]
    for (let i = from; i <= to; i++) {
      const rangeId = props.items[i]!.id
      if (!next.includes(rangeId)) next.push(rangeId)
    }
  } else if (index >= 0 && !next.includes(id)) {
    next.push(id)
  }
  lastSelected.value = id
  commitSelection(next)
  emit('range-select', id)
}

/* ------------------------------------------------------------------ *
 * Continue reading snackbar (LibraryTab.kt)
 * ------------------------------------------------------------------ */
const noNextChapter = ref(false)
let noNextChapterTimer: number | undefined
function onContinueReading(item: Manga, event?: Event) {
  const summary = props.summaries[item.id]
  if (!summary) {
    event?.preventDefault()
    return
  }
  if (summary.nextUnread == null) {
    event?.preventDefault()
    noNextChapter.value = true
    window.clearTimeout(noNextChapterTimer)
    noNextChapterTimer = window.setTimeout(() => { noNextChapter.value = false }, 4000)
  }
}

/* ------------------------------------------------------------------ *
 * Global search row (Mihon `GlobalSearchItem`)
 * ------------------------------------------------------------------ */
const showGlobalSearch = computed(() => !props.catalogue && props.searchQuery.length > 0)

/* ------------------------------------------------------------------ *
 * Fast scroll (Mihon `FastScrollLazyColumn` → `VerticalFastScroller`)
 * ------------------------------------------------------------------ */
const listRef = ref<HTMLElement | null>(null)
const gridRef = ref<HTMLElement | null>(null)
const activeContainer = computed(() => activeDisplay.value === 'list' ? listRef.value : gridRef.value)

const itemsRef = computed(() => props.items)
const {
  rows,
  rowHeight,
  columnsCount,
} = useResponsiveGridRows({
  items: itemsRef,
  containerRef: activeContainer,
  displayMode: activeDisplay,
  columnsPreference: columns,
})

const fastScrollVisible = ref(false)
const fastScrollTop = ref(0)
const fastScrollRight = ref(0)
const THUMB_LENGTH = 48
let hideTimer: number | undefined
let dragging = false

function scrollMetrics() {
  const element = listRef.value ?? gridRef.value
  if (!element) return null
  const topBarHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--v-layout-top')) || 64
  const tabsEl = document.querySelector('.library-tabs-container') as HTMLElement | null
  const tabsHeight = tabsEl ? tabsEl.getBoundingClientRect().height : 0
  const top = topBarHeight + tabsHeight
  const bottomNav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--v-layout-bottom')) || 0
  const bottom = window.innerHeight - bottomNav
  const height = Math.max(120, bottom - top)
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  const endPadding = listRef.value ? 8 : 0
  const rect = element.getBoundingClientRect()
  const right = Math.max(0, window.innerWidth - rect.right) + endPadding
  return { top, height, max, right }
}
function updateFastScroll() {
  const metrics = scrollMetrics()
  if (!metrics || metrics.height < 120 || metrics.max < 8) { fastScrollVisible.value = false; return }
  const ratio = Math.min(1, Math.max(0, window.scrollY / metrics.max))
  fastScrollTop.value = metrics.top + ratio * (metrics.height - THUMB_LENGTH)
  fastScrollRight.value = metrics.right
  fastScrollVisible.value = true
}

function onWindowScroll() {
  if (!dragging) {
    updateFastScroll()
  }
  scheduleFastScrollHide()
}
function scheduleFastScrollHide() {
  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => { if (!dragging) fastScrollVisible.value = false }, 2000)
}
function startFastScrollDrag(event: PointerEvent) {
  const metrics = scrollMetrics()
  if (!metrics || metrics.max < 8) return
  dragging = true
  window.clearTimeout(hideTimer)
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture?.(event.pointerId)
  const startClientY = event.clientY
  const startThumbTop = fastScrollTop.value

  const move = (moveEvent: PointerEvent) => {
    const current = scrollMetrics()
    if (!current) return
    const trackHeight = Math.max(1, current.height - THUMB_LENGTH)
    const deltaY = moveEvent.clientY - startClientY
    const newTop = Math.min(current.top + trackHeight, Math.max(current.top, startThumbTop + deltaY))
    fastScrollTop.value = newTop
    const ratio = Math.min(1, Math.max(0, (newTop - current.top) / trackHeight))
    window.scrollTo({ top: ratio * current.max })
  }
  const up = (upEvent: PointerEvent) => {
    dragging = false
    try {
      target.releasePointerCapture?.(upEvent.pointerId)
    } catch {}
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    scheduleFastScrollHide()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}
const fastScrollEnabled = computed(() => !props.catalogue)
const fastScrollActive = computed(() => fastScrollEnabled.value && props.isActivePage)
watch(fastScrollActive, (enabled, was) => {
  if (enabled && !was) {
    window.addEventListener('scroll', onWindowScroll, { passive: true })
    window.addEventListener('resize', onWindowScroll)
  } else if (!enabled && was) {
    window.removeEventListener('scroll', onWindowScroll)
    window.removeEventListener('resize', onWindowScroll)
    fastScrollVisible.value = false
  }
}, { immediate: true })
onMounted(() => { if (fastScrollActive.value) updateFastScroll() })
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onWindowScroll)
  window.removeEventListener('resize', onWindowScroll)
  window.clearTimeout(hideTimer)
  window.clearTimeout(noNextChapterTimer)
})
</script>

<template>
  <div v-if="activeDisplay === 'list'" ref="listRef" class="manga-list" :style="listStyle" aria-label="Manga list">
    <!--
      `LibraryList.kt`: the global search row is the first item of the column and it gets
      the raw `searchQuery` — the reference never trims it.
    -->
    <GlobalSearchItem v-if="showGlobalSearch" :search-query="searchQuery" variant="list" @click="emit('global-search')" />
    <!-- v-for="item in items" -->
    <RecycleScroller
      v-if="rows.length > 0"
      class="manga-recycle-scroller"
      :items="rows"
      :item-size="rowHeight"
      :buffer="1200"
      key-field="id"
      :page-mode="true"
      #default="{ item: rowItem }"
    >
      <div class="manga-scroller-list-row">
        <LibraryListItem
          v-if="rowItem.items[0]"
          :manga="rowItem.items[0]"
          :catalogue="catalogue"
          :next-unread="summaries?.[rowItem.items[0].id]?.nextUnread"
          :selected="isSelected(rowItem.items[0].id)"
          :selection-mode="selectionActive"
          @toggle="toggleSelection"
          @range="rangeSelect"
          @no-next-chapter="onContinueReading(rowItem.items[0])"
        />
      </div>
    </RecycleScroller>
    <BrowseSourceLoadingItem v-if="loading" label="Loading more titles" />
    <Transition name="fast-scroll-fade">
      <div v-if="fastScrollVisible" class="fast-scroll-thumb" :style="{ top: `${fastScrollTop}px`, right: `${fastScrollRight}px` }" aria-hidden="true" @pointerdown="startFastScrollDrag" />
    </Transition>
  </div>
  <div v-else ref="gridRef" class="library-grid" :class="{ 'library-grid-compact': libraryCompact, 'library-grid-panorama': activeDisplay === 'comfortable-panorama' }" :style="gridStyle" :aria-label="`${activeDisplay} manga grid`">
    <!--
      `LazyLibraryGrid.kt`: `globalSearchItem` spans the whole line (`GridItemSpan(maxLineSpan)`)
      and keeps the content width of the button at the start of the row.
    -->
    <GlobalSearchItem v-if="showGlobalSearch" :search-query="searchQuery" variant="grid" class="library-grid-global-search" @click="emit('global-search')" />
    <!-- v-for="item in items" -->
    <RecycleScroller
      v-if="rows.length > 0"
      class="manga-recycle-scroller"
      :items="rows"
      :item-size="rowHeight"
      :buffer="1200"
      key-field="id"
      :page-mode="true"
      #default="{ item: rowItem }"
    >
      <div
        class="manga-scroller-grid-row"
        :style="{
          display: 'grid',
          gap: '4px',
          padding: '0',
          width: '100%',
          boxSizing: 'border-box',
          gridTemplateColumns: `repeat(${columnsCount}, minmax(0, 1fr))`
        }"
      >
        <template v-for="item in rowItem.items" :key="item.id">
          <LibraryCompactGridItem
            v-if="libraryCompact"
            :manga="item"
            :display="activeDisplay === 'covers' ? 'covers' : 'compact'"
            :next-unread="summaries?.[item.id]?.nextUnread"
            :selected="isSelected(item.id)"
            :selection-mode="selectionActive"
            @toggle="toggleSelection"
            @range="rangeSelect"
            @no-next-chapter="onContinueReading(item)"
          />
          <LibraryComfortableGridItem
            v-else-if="libraryComfortable || activeDisplay === 'comfortable-panorama'"
            :manga="item"
            :panorama="activeDisplay === 'comfortable-panorama'"
            :next-unread="summaries?.[item.id]?.nextUnread"
            :selected="isSelected(item.id)"
            :selection-mode="selectionActive"
            @toggle="toggleSelection"
            @range="rangeSelect"
            @no-next-chapter="onContinueReading(item)"
          />
          <MangaCard
            v-else
            :manga="item"
            :display="activeDisplay"
            :catalogue="catalogue"
            :next-unread="summaries?.[item.id]?.nextUnread"
            :selected="isSelected(item.id)"
            :selection-mode="selectionActive"
            @toggle="toggleSelection"
            @range="rangeSelect"
            @no-next-chapter="onContinueReading(item)"
          />
        </template>
      </div>
    </RecycleScroller>
    <BrowseSourceLoadingItem v-if="loading" class="library-grid-loading" label="Loading titles" />
    <Transition name="fast-scroll-fade">
      <div
        v-if="fastScrollVisible"
        class="fast-scroll-thumb"
        :style="{ top: `${fastScrollTop}px`, right: `${fastScrollRight}px` }"
        aria-hidden="true"
        @pointerdown="startFastScrollDrag"
      />
    </Transition>
  </div>
  <!-- `LibraryTab.kt`: the `no_next_chapter` snackbar of the `SnackbarHost`. -->
  <v-snackbar v-model="noNextChapter" :timeout="4000" color="inverse-surface" location="bottom">
    Next chapter not found
  </v-snackbar>
</template>

<style scoped>
.manga-recycle-scroller {
  grid-column: 1 / -1;
  width: 100%;
}

.manga-scroller-list-row {
  width: 100%;
}

.manga-scroller-grid-row {
  display: grid;
  gap: 4px;
  padding: 0;
  width: 100%;
  box-sizing: border-box;
}
</style>
