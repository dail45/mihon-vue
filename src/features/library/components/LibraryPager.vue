<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Category, Manga } from '@/core/api/types'
import type { DisplayMode } from '@/features/settings/stores/preferences'
import type { ChapterSummary } from '@/core/utils/library'
import GlobalSearchItem from '@/features/browse/components/GlobalSearchItem.vue'
import MangaCollection from '@/features/browse/components/MangaCollection.vue'

/**
 * Port of Mihon's `presentation/library/components/LibraryPager.kt`
 * (Mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1).
 *
 * Reference:
 *
 * ```kotlin
 * @Composable
 * fun LibraryPager(
 *     state: PagerState,
 *     contentPadding: PaddingValues,
 *     hasActiveFilters: Boolean,
 *     selection: Set<Long>,
 *     searchQuery: String?,
 *     onGlobalSearchClicked: () -> Unit,
 *     getCategoryForPage: (Int) -> Category,
 *     getDisplayMode: (Int) -> PreferenceMutableState<LibraryDisplayMode>,
 *     getColumnsForOrientation: (Boolean) -> PreferenceMutableState<Int>,
 *     getItemsForCategory: (Category) -> List<LibraryItem>,
 *     onClickManga: (Category, LibraryManga) -> Unit,
 *     onLongClickManga: (Category, LibraryManga) -> Unit,
 *     onClickContinueReading: ((LibraryManga) -> Unit)?,
 * ) {
 *     HorizontalPager(
 *         modifier = Modifier.fillMaxSize(),
 *         state = state,
 *         verticalAlignment = Alignment.Top,
 *     ) { page ->
 *         if (page !in ((state.currentPage - 1)..(state.currentPage + 1))) {
 *             // To make sure only one offscreen page is being composed
 *             return@HorizontalPager
 *         }
 *         val category = getCategoryForPage(page)
 *         val items = getItemsForCategory(category)
 *
 *         if (items.isEmpty()) {
 *             LibraryPagerEmptyScreen(
 *                 searchQuery = searchQuery,
 *                 hasActiveFilters = hasActiveFilters,
 *                 contentPadding = contentPadding,
 *                 onGlobalSearchClicked = onGlobalSearchClicked,
 *             )
 *             return@HorizontalPager
 *         }
 *
 *         val displayMode by getDisplayMode(page)
 *         val columns by if (displayMode != LibraryDisplayMode.List) {
 *             val configuration = LocalConfiguration.current
 *             val isLandscape = configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
 *             remember(isLandscape) { getColumnsForOrientation(isLandscape) }
 *         } else {
 *             remember { mutableIntStateOf(0) }
 *         }
 *
 *         val onClickManga: (LibraryManga) -> Unit = { onClickManga(category, it) }
 *         val onLongClickManga: (LibraryManga) -> Unit = { onLongClickManga(category, it) }
 *
 *         when (displayMode) {
 *             LibraryDisplayMode.List -> LibraryList(...)
 *             LibraryDisplayMode.CompactGrid, LibraryDisplayMode.CoverOnlyGrid -> LibraryCompactGrid(...)
 *             LibraryDisplayMode.ComfortableGrid -> LibraryComfortableGrid(...)
 *         }
 *     }
 * }
 * ```
 */
const props = withDefaults(defineProps<{
  /** `getCategoryForPage` — one page per category. */
  categories: Category[]
  /** `state.currentPage` — the index of the visible page. */
  currentPage: number
  /** `getDisplayMode` — Mihon `LibraryDisplayMode` of the library. */
  display: DisplayMode
  /** `getItemsForCategory` — the already filtered and sorted items of every category. */
  itemsByCategory: Record<number, Manga[]>
  /** Chapter summaries for the badges and the resume button. */
  summaries?: Record<number, ChapterSummary>
  /** Mihon `searchQuery`. */
  searchQuery?: string
  /** Mihon `hasActiveFilters`. */
  hasActiveFilters?: boolean
  /** Mihon `selection: Set<Long>` — the selection is shared by every page. */
  selection?: number[]
  /** `contentPadding`: bottom inset padding (e.g. navigation bar / actions bar). */
  contentPaddingBottom?: number | string
}>(), {
  summaries: () => ({}),
  searchQuery: '',
  hasActiveFilters: false,
  selection: undefined,
  contentPaddingBottom: 0,
})

const emit = defineEmits<{
  'update:currentPage': [value: number]
  'update:selection': [value: number[]]
  'range-select': [id: number]
  'global-search': []
}>()

/* ------------------------------------------------------------------ *
 * Pages
 * ------------------------------------------------------------------ */
const pageCount = computed(() => props.categories.length)
const currentPage = computed(() => Math.min(Math.max(0, props.currentPage), Math.max(0, pageCount.value - 1)))

const pages = computed(() => props.categories.map((category, index) => ({
  index,
  category,
  items: props.itemsByCategory[category.id] || [],
})))

/**
 * `LibraryPager.kt`:
 * `if (page !in ((state.currentPage - 1)..(state.currentPage + 1))) return@HorizontalPager`
 *
 * Every page has its geometric slot in the pager track so that page `i` is at `i * 100%`.
 * We only compose components for the current page and its direct neighbours (including the
 * target pages during active swipe/fling). Offscreen pages return empty and do not instantiate
 * collections, watchers, or card items.
 */
const renderedPages = computed(() => {
  const set = new Set<number>()
  const cur = currentPage.value
  set.add(cur)
  if (cur > 0) set.add(cur - 1)
  if (cur < pageCount.value - 1) set.add(cur + 1)

  // Floating position while dragging or animating
  const posRound = Math.round(position.value)
  const posFloor = Math.floor(position.value)
  const posCeil = Math.ceil(position.value)
  set.add(posRound)
  set.add(posFloor)
  set.add(posCeil)
  if (posFloor > 0) set.add(posFloor - 1)
  if (posCeil < pageCount.value - 1) set.add(posCeil + 1)

  return set
})

function shouldRender(index: number) {
  return renderedPages.value.has(index)
}

/* ------------------------------------------------------------------ *
 * Empty screen (`LibraryPagerEmptyScreen`)
 * ------------------------------------------------------------------ */
/** `tachiyomi/presentation/core/screens/EmptyScreen.kt` -> `ErrorFaces`. */
const ERROR_FACES = [
  '(･o･;)',
  'Σ(ಠ_ಠ)',
  'ಥ_ಥ',
  '(˘･_･˘)',
  '(；￣Д￣)',
  '(･Д･。',
  '(╬ಠ益ಠ)',
  '(╥﹏╥)',
  '(⋟﹏⋞)',
  'Ò︵Ó',
  ' ˙ᯅ˙)',
  '(¬_¬)',
]
const faces = new Map<number, string>()
function faceFor(categoryId: number) {
  let face = faces.get(categoryId)
  if (!face) {
    face = ERROR_FACES[Math.floor(Math.random() * ERROR_FACES.length)]
    faces.set(categoryId, face)
  }
  return face
}

/**
 * `LibraryPagerEmptyScreen` picks the message from the search query, then from the
 * active filters, and falls back to the empty category message:
 *
 * val msg = when {
 *     !searchQuery.isNullOrEmpty() -> MR.strings.no_results_found
 *     hasActiveFilters -> MR.strings.error_no_match
 *     else -> MR.strings.information_no_manga_category
 * }
 */
const emptyMessage = computed(() => {
  if (props.searchQuery.length > 0) return 'No results found'
  if (props.hasActiveFilters) return 'No match found'
  return 'Category is empty'
})

/* ------------------------------------------------------------------ *
 * Swipe
 *
 * The track is moved with `left` instead of a transform: a transform would make
 * the track the containing block of the fixed positioned fast scroller of the
 * library list (Mihon `FastScrollLazyColumn`), which would break its placement.
 * ------------------------------------------------------------------ */
const container = ref<HTMLElement | null>(null)
const width = ref(0)
/** The floating page position; `1.5` means the pager is half way between two pages. */
const position = ref(0)
const dragging = ref(false)
const isAnimating = ref(false)
let animateTimer: number | undefined

let pointerId: number | null = null
let startX = 0
let startY = 0
let startPosition = 0
let axis: 'x' | 'y' | null = null
let lastX = 0
let lastTime = 0
let velocity = 0

function measure() {
  const element = container.value
  if (!element) return
  width.value = element.clientWidth
}

let observer: ResizeObserver | null = null
onMounted(() => {
  measure()
  position.value = currentPage.value
  if (container.value && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => measure())
    observer.observe(container.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  window.clearTimeout(animateTimer)
  stopListening()
})

function stopListening() {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
}

function onPointerDown(event: PointerEvent) {
  if (pageCount.value < 2) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  pointerId = event.pointerId
  startX = event.clientX
  startY = event.clientY
  lastX = event.clientX
  lastTime = event.timeStamp
  startPosition = position.value
  velocity = 0
  axis = null
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
}

function onPointerMove(event: PointerEvent) {
  if (pointerId === null || event.pointerId !== pointerId) return
  const dx = event.clientX - startX
  const dy = event.clientY - startY
  const now = event.timeStamp
  if (now > lastTime) velocity = (event.clientX - lastX) / (now - lastTime)
  lastX = event.clientX
  lastTime = now

  if (axis === null) {
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      axis = 'x'
      dragging.value = true
    } else if (Math.abs(dy) > 8) {
      axis = 'y'
      pointerId = null
      stopListening()
      return
    } else {
      return
    }
  }

  if (axis !== 'x') return
  // A horizontal drag must not select the text of the page.
  event.preventDefault()
  const pageWidth = width.value || container.value?.clientWidth || 1
  let next = startPosition - dx / pageWidth

  // Resistance when dragging beyond the pager boundaries (overscroll stretch feel)
  const last = pageCount.value - 1
  if (next < 0) {
    next = next * 0.2
  } else if (next > last) {
    next = last + (next - last) * 0.2
  }
  position.value = next
}

/** Compose `Compose Foundation` `PagerSnapDistance` thresholds. */
const SNAP_FRACTION = 0.5
const FLING_VELOCITY = 0.4

function onPointerUp(event: PointerEvent) {
  if (pointerId === null || event.pointerId !== pointerId) return
  const dx = event.clientX - startX
  const pageWidth = width.value || container.value?.clientWidth || 1
  const wasDragging = dragging.value
  const flung = Math.abs(velocity) > FLING_VELOCITY
  dragging.value = false
  pointerId = null
  axis = null
  stopListening()
  if (!wasDragging) return

  let target = currentPage.value
  // A slow drag needs half of the page width, a fling only needs the velocity.
  if (dx <= -pageWidth * SNAP_FRACTION || (flung && dx < -24)) {
    if (currentPage.value < pageCount.value - 1) target = currentPage.value + 1
  } else if (dx >= pageWidth * SNAP_FRACTION || (flung && dx > 24)) {
    if (currentPage.value > 0) target = currentPage.value - 1
  }

  // The swipe must not open the item that was touched.
  suppressNextClick()
  position.value = target
  if (target !== currentPage.value) {
    isAnimating.value = true
    window.clearTimeout(animateTimer)
    animateTimer = window.setTimeout(() => {
      isAnimating.value = false
    }, 280)
    emit('update:currentPage', target)
  }
}

function onPointerCancel(event: PointerEvent) {
  if (pointerId === null || event.pointerId !== pointerId) return
  const wasDragging = dragging.value
  dragging.value = false
  pointerId = null
  axis = null
  stopListening()
  if (!wasDragging) return
  position.value = currentPage.value
}

/** A finished swipe must not trigger the click of the touched item. */
let clickGuard = 0
function suppressNextClick() {
  window.clearTimeout(clickGuard)
  const swallow = (event: MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
    window.removeEventListener('click', swallow, true)
  }
  window.addEventListener('click', swallow, true)
  clickGuard = window.setTimeout(() => window.removeEventListener('click', swallow, true), 400)
}

watch(currentPage, (page, previous) => {
  if (previous === undefined) {
    position.value = page
    return
  }
  if (dragging.value) return
  position.value = page
  isAnimating.value = true
  window.clearTimeout(animateTimer)
  animateTimer = window.setTimeout(() => {
    isAnimating.value = false
  }, 280)
})

watch(pageCount, count => {
  const clamped = Math.min(currentPage.value, Math.max(0, count - 1))
  position.value = clamped
})

/** The horizontal offset of the track as a percentage of page width. */
const trackOffset = computed(() => `${-position.value * 100}%`)

/* ------------------------------------------------------------------ *
 * Selection (`LibraryPager` passes `selection` to every page)
 * ------------------------------------------------------------------ */
function onSelectionUpdate(value: number[]) {
  if (props.selection === undefined) return
  emit('update:selection', value)
}

function onKeyDown(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
  if (event.key === 'ArrowLeft') {
    if (currentPage.value > 0) {
      emit('update:currentPage', currentPage.value - 1)
    }
  } else if (event.key === 'ArrowRight') {
    if (currentPage.value < pageCount.value - 1) {
      emit('update:currentPage', currentPage.value + 1)
    }
  }
}

const emptyPaddingBottom = computed(() => {
  if (typeof props.contentPaddingBottom === 'number') return `${props.contentPaddingBottom + 8}px`
  return `calc(${props.contentPaddingBottom} + 8px)`
})
</script>

<template>
  <div
    ref="container"
    class="library-pager"
    :class="{
      'library-pager-dragging': dragging,
      'library-pager-panorama': display === 'comfortable-panorama'
    }"
    tabindex="-1"
    @pointerdown="onPointerDown"
    @keydown="onKeyDown"
  >
    <div
      ref="track"
      class="library-pager-track"
      :style="{ left: trackOffset }"
    >
      <section
        v-for="page in pages"
        :key="page.category.id"
        class="library-pager-page"
        :class="{
          'library-pager-page--active': page.index === currentPage,
          'library-pager-page--inactive': page.index !== currentPage && !dragging && !isAnimating,
        }"
        :data-page="page.index"
        :aria-label="page.category.name"
      >
        <template v-if="shouldRender(page.index)">
          <MangaCollection
            v-if="page.items.length"
            :items="page.items"
            :display="display"
            :summaries="summaries"
            :search-query="searchQuery"
            :selection="selection"
            :content-padding-bottom="contentPaddingBottom"
            :is-active-page="page.index === currentPage"
            @update:selection="onSelectionUpdate"
            @range-select="emit('range-select', $event)"
            @global-search="emit('global-search')"
          />
          <!--
            LibraryPagerEmptyScreen(
                searchQuery = searchQuery,
                hasActiveFilters = hasActiveFilters,
                contentPadding = contentPadding,
                onGlobalSearchClicked = onGlobalSearchClicked,
            )
          -->
          <div
            v-else
            class="library-pager-empty"
            :style="{ paddingBottom: emptyPaddingBottom }"
          >
            <!-- GlobalSearchItem(modifier = Modifier.fillMaxWidth().align(Alignment.CenterHorizontally), searchQuery = searchQuery, onClick = onGlobalSearchClicked) -->
            <GlobalSearchItem
              v-if="searchQuery.length > 0"
              class="library-pager-empty-search"
              :search-query="searchQuery"
              variant="list"
              @click="emit('global-search')"
            />
            <!-- EmptyScreen(stringRes = msg, modifier = Modifier.weight(1f)) -->
            <div class="library-pager-empty-body">
              <span class="library-pager-empty-face" aria-hidden="true">{{ faceFor(page.category.id) }}</span>
              <p class="library-pager-empty-message" role="status">{{ emptyMessage }}</p>
            </div>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
@layer app-components {
/*
 * `HorizontalPager(modifier = Modifier.fillMaxSize(), verticalAlignment = Alignment.Top)`.
 * The track holds the pages side by side and is moved with `left`; `overflow-x: clip`
 * hides offscreen pages without creating a scroll container, preserving the document
 * scroll for fast scroller placement.
 */
.library-pager {
  position: relative;
  overflow-x: clip;
  overflow-y: visible;
  touch-action: pan-y;
  outline: none;
}

.library-pager-panorama :deep(.library-grid) {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
}

.library-pager-dragging {
  user-select: none;
}

.library-pager-track {
  position: relative;
  display: flex;
  align-items: flex-start;
  width: 100%;
  transition: left 260ms cubic-bezier(0.2, 0, 0, 1);
}

.library-pager-dragging .library-pager-track {
  transition: none;
}

.library-pager-page {
  box-sizing: border-box;
  flex: 0 0 100%;
  width: 100%;
  min-width: 0;
  /* `Modifier.fillMaxSize()` of the pager: page spans available content area */
  min-height: calc(100dvh - 192px);
  display: flex;
  flex-direction: column;
}

.library-pager-page--inactive {
  height: 0 !important;
  max-height: 0 !important;
  min-height: 0 !important;
  overflow: hidden !important;
  visibility: hidden;
}

/*
 * `LibraryPagerEmptyScreen`:
 * Column(modifier = Modifier.padding(contentPadding + PaddingValues(8.dp)).fillMaxSize().verticalScroll(rememberScrollState()))
 */
.library-pager-empty {
  box-sizing: border-box;
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 8px;
  min-height: 100%;
}

/* `GlobalSearchItem(Modifier.fillMaxWidth().align(CenterHorizontally), …)`. */
.library-pager-empty-search {
  display: block;
  width: 100%;
}

.library-pager-empty-search :deep(.global-search-item) {
  width: 100%;
  justify-content: center;
}

/*
 * `EmptyScreen.kt`:
 * Column(modifier = modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp),
 *        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center)
 *
 * Face: MaterialTheme.typography.displayMedium (45sp / 52sp, w400), secondaryItemAlpha (0.78), LTR direction.
 * Message: MaterialTheme.typography.bodyMedium (14sp / 20sp, w400, ls 0.25px), secondaryItemAlpha (0.78),
 *          paddingFromBaseline(top = 24.dp), textAlign = TextAlign.Center.
 */
.library-pager-empty-body {
  box-sizing: border-box;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  overflow-y: auto;
  text-align: center;
}

.library-pager-empty-face {
  margin: 0;
  font-size: 45px;
  line-height: 52px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface) / 0.78);
  direction: ltr;
  user-select: none;
}

.library-pager-empty-message {
  margin: 24px 0 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  text-align: center;
  color: rgb(var(--v-theme-on-surface) / 0.78);
}
}
</style>
