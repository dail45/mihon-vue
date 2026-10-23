<script setup lang="ts">
/**
 * Upcoming — release calendar.
 *
 * Pixel-parity target (Mihon @446f6df):
 *   app/src/main/java/mihon/feature/upcoming/UpcomingScreen.kt
 *   app/src/main/java/mihon/feature/upcoming/UpcomingScreenContent.kt
 *   app/src/main/java/mihon/feature/upcoming/UpcomingViewModel.kt
 *   app/src/main/java/mihon/feature/upcoming/components/UpcomingItem.kt
 *   app/src/main/java/mihon/feature/upcoming/components/calendar/Calendar.kt
 *   app/src/main/java/mihon/feature/upcoming/components/calendar/CalendarHeader.kt
 *   app/src/main/java/mihon/feature/upcoming/components/calendar/CalendarDay.kt
 *   app/src/main/java/mihon/feature/upcoming/components/calendar/CalendarIndicator.kt
 *   app/src/main/java/eu/kanade/presentation/components/AppBar.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/components/TabbedDialog.kt
 *   mihon/presentation-core/.../components/SettingsItems.kt (TriStateItem)
 *   mihon/presentation-core/.../components/TwoPanelBox.kt
 *   mihon/presentation-core/.../components/material/Constants.kt (Padding, DISABLED_ALPHA)
 *   mihon/domain/.../manga/interactor/{ReleaseSchedule,ReleasePattern,FetchInterval}.kt
 *
 * Suwayomi's REST v1 exposes no `expectedNextUpdate` / `nextUpdate` column, so the release day
 * is re-derived in the client with the same "smart update" algorithm Mihon uses locally
 * (see src/utils/releaseSchedule.ts).
 *
 * The screen owns its own top bar (Mihon's UpcomingScreen renders UpcomingToolbar in the
 * Scaffold topBar slot), so the shared shell bar is hidden while this screen is mounted.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import { createSuwayomiApi } from '../api/client'
import type { Category, Manga } from '../api/types'
import { useTabletUi } from '../composables/useTabletUi'
import { readPreference, writePreference } from '../stores/preferences'
import { useSuwayomiStore } from '../stores/suwayomi'
import { estimateSchedule, fromEpochDay, nextCheck, toEpochDay } from '../utils/releaseSchedule'
import AdaptiveSettingsSheet from '../components/AdaptiveSettingsSheet.vue'
import Md3CircularProgress from '../components/Md3CircularProgress.vue'
import MihonEmptyScreen from '../components/MihonEmptyScreen.vue'
import TriStateRow from '../components/TriStateRow.vue'

/** Constants.URL_HELP_UPCOMING (mihon/core/common/.../Constants.kt). */
const GUIDE_URL = 'https://mihon.app/docs/faq/updates/upcoming'
/** TopAppBar.kt: 64dp. */
const TOOLBAR_HEIGHT = 64


const server = useSuwayomiStore()
const router = useRouter()
const theme = useTheme()
const tablet = useTabletUi()

/** MaterialTheme.colorScheme.active (presentation-core/.../theme/Color.kt). */
const activeColor = computed(() => (theme.global.current.value.dark ? '#FFEB3B' : '#FFC107'))
const locale = computed(() => (typeof navigator !== 'undefined' && navigator.language) || 'en-US')

/* ------------------------------------------------------------------ filter state -- */

function readIds(key: string): number[] {
  try {
    const raw = JSON.parse(readPreference(key) || '[]')
    return Array.isArray(raw) ? raw.filter((value): value is number => typeof value === 'number') : []
  } catch { return [] }
}
const includedIds = ref<number[]>(readIds('mihon.upcoming.includedCategories'))
const excludedIds = ref<number[]>(readIds('mihon.upcoming.excludedCategories'))
const hasActiveFilters = computed(() => includedIds.value.length > 0 || excludedIds.value.length > 0)

/* ------------------------------------------------------------------ data -- */

interface Release {
  manga: Manga
  /** Epoch day of the expected next update. */
  day: number
  /** The library categories the title belongs to. */
  categories: number[]
}

const releases = ref<Release[] | null>(null)
const loading = ref(false)
const errorMessage = ref<string | null>(null)
let generation = 0

/** GetUpcomingManga.kt: includedStatuses = { ONGOING, PUBLISHING_FINISHED }. */
function isUpcomingStatus(manga: Manga) {
  return manga.status === 'ONGOING' || manga.status === 'PUBLISHING_FINISHED'
}

async function load() {
  const token = ++generation
  loading.value = true
  errorMessage.value = null
  releases.value = null
  await server.loadLibrary()
  if (token !== generation) return
  if (server.libraryError) {
    releases.value = []
    errorMessage.value = server.libraryError
    loading.value = false
    return
  }

  const unique = new Map<number, Manga>()
  for (const manga of Object.values(server.libraryByCategory).flat()) if (!unique.has(manga.id)) unique.set(manga.id, manga)

  // GetUpcomingManga.kt keeps library titles with an ongoing or finished-publishing status.
  const candidates = [...unique.values()].filter(manga => isUpcomingStatus(manga))

  // The category membership of every library title, for the include/exclude filters.
  const categoriesByManga = new Map<number, number[]>()
  for (const [categoryId, entries] of Object.entries(server.libraryByCategory)) {
    for (const entry of entries) {
      const list = categoriesByManga.get(entry.id) ?? []
      list.push(Number(categoryId))
      categoriesByManga.set(entry.id, list)
    }
  }

  const api = createSuwayomiApi(server.apiUrl)
  const today = toEpochDay(new Date())
  const result: Release[] = []
  // A modest concurrency keeps a large library from opening hundreds of sockets at once.
  const queue = [...candidates]
  const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
    for (;;) {
      const manga = queue.shift()
      if (!manga) return
      try {
        const chapters = await api.chapters(manga.id)
        // A title without any chapter has no release history, so it has no release day
        // (Mihon keeps `state_chapter_next_update` empty for it and omits it from the list).
        if (!chapters.length) return
        const schedule = estimateSchedule(
          chapters.map(chapter => ({ uploadDate: chapter.uploadDate, fetchedAt: chapter.fetchedAt * 1000 })),
          today,
        )
        result.push({ manga, day: nextCheck(schedule, today), categories: categoriesByManga.get(manga.id) ?? [] })
      } catch {
        // A title without readable chapters has no release day; it is simply skipped.
      }
    }
  })
  await Promise.all(workers)
  if (token !== generation) return

  result.sort((a, b) => a.day - b.day || a.manga.title.localeCompare(b.manga.title))
  releases.value = result
  loading.value = false
}

watch(() => server.apiUrl, () => { void load() }, { immediate: true })

/**
 * The category filters of `getUpcomingManga` (manga.sq): a title in an excluded category is
 * dropped, and with included categories only the titles in one of them are kept.
 */
const visibleReleases = computed<Release[]>(() => {
  const included = new Set(includedIds.value)
  const excluded = new Set(excludedIds.value)
  return (releases.value ?? []).filter(release => {
    if (release.categories.some(category => excluded.has(category))) return false
    if (included.size && !release.categories.some(category => included.has(category))) return false
    return true
  })
})

/* ------------------------------------------------------------------ calendar state -- */

const today = new Date()
today.setHours(0, 0, 0, 0)
const selectedMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const monthDirection = ref<'forward' | 'backward'>('forward')

function shiftMonth(delta: number) {
  monthDirection.value = delta > 0 ? 'forward' : 'backward'
  selectedMonth.value = new Date(selectedMonth.value.getFullYear(), selectedMonth.value.getMonth() + delta, 1)
}
/** CalendarHeader.kt: DateTimeFormatter.ofPattern("MMMM yyyy", locale). */
const monthTitle = computed(() => new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(selectedMonth.value))

/** WeekFields.of(locale).firstDayOfWeek — Sunday (7) or Monday (1). */
const MONDAY_FIRST_LOCALES = ['ru', 'uk', 'be', 'bg', 'cs', 'da', 'de', 'el', 'es', 'et', 'fi', 'fr', 'hu', 'it', 'lt', 'lv', 'nl', 'no', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv', 'tr', 'zh', 'ja', 'ko', 'id', 'vi', 'th', 'he', 'ar']
function firstDayOfWeek(lang: string): number {
  try {
    const info = (new Intl.Locale(lang) as unknown as { getWeekInfo?: () => { firstDay: number } }).getWeekInfo?.()
    if (info?.firstDay) return info.firstDay
  } catch { /* engines without Intl.Locale.getWeekInfo fall back to the table */ }
  return MONDAY_FIRST_LOCALES.includes(lang) ? 1 : 7
}
const weekStartIndex = computed(() => (((firstDayOfWeek(locale.value.split('-')[0]!) - 1) % 7) + 1) % 7)
const weekdayNames = computed(() => {
  const formatter = new Intl.DateTimeFormat(locale.value, { weekday: 'narrow' })
  return Array.from({ length: 7 }, (_, index) => {
    const weekday = ((weekStartIndex.value + index) % 7 + 1) % 7
    return formatter.format(new Date(Date.UTC(2023, 0, 1 + weekday)))
  })
})

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function epochDayToKey(day: number) {
  const date = fromEpochDay(day)
  return dateKey(date)
}

/** UpcomingViewModel.toEvents(): the release count per day. */
const events = computed<Record<string, number>>(() => {
  const result: Record<string, number> = {}
  for (const release of visibleReleases.value) {
    const key = epochDayToKey(release.day)
    result[key] = (result[key] ?? 0) + 1
  }
  return result
})

interface CalendarDayCell {
  key: string
  number: number
  date?: Date
  isToday: boolean
  isPast: boolean
  count: number
}

const calendarDays = computed<CalendarDayCell[]>(() => {
  const year = selectedMonth.value.getFullYear(), month = selectedMonth.value.getMonth()
  const days = new Date(year, month + 1, 0).getDate()
  const leading = (new Date(year, month, 1).getDay() - weekStartIndex.value + 7) % 7
  const cells: CalendarDayCell[] = []
  for (let index = 0; index < leading; index++) cells.push({ key: `blank-${index}`, number: 0, isToday: false, isPast: false, count: 0 })
  for (let day = 1; day <= days; day++) {
    const date = new Date(year, month, day)
    const key = dateKey(date)
    cells.push({
      key,
      number: day,
      date,
      isToday: date.getTime() === today.getTime(),
      isPast: date.getTime() < today.getTime(),
      count: events.value[key] ?? 0,
    })
  }
  return cells
})

/* ------------------------------------------------------------------ release list -- */

/** Mihon's `relativeDateText` (eu/kanade/presentation/components/DateText.kt). */
function relativeDateText(key: string): string {
  const date = new Date(`${key}T00:00:00`)
  if (Number.isNaN(date.getTime())) return key
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const difference = Math.round((today.getTime() - midnight.getTime()) / 86400000)
  if (difference < -7) return shortDate(date)
  if (difference < 0) return difference === -1 ? 'Tomorrow' : `In ${-difference} days`
  if (difference < 1) return 'Today'
  if (difference < 7) return difference === 1 ? 'Yesterday' : `${difference} days ago`
  return shortDate(date)
}
/** DateTimeFormatter.ofLocalizedDate(SHORT) (eu/kanade/domain/ui/UiPreferences.kt). */
function shortDate(date: Date) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'short' }).format(date)
}

interface ReleaseGroup {
  key: string
  label: string
  count: number
  items: Release[]
}

/** UpcomingViewModel.toUpcomingUIModels(): a header is inserted whenever the day changes. */
const groups = computed<ReleaseGroup[]>(() => {
  const result: ReleaseGroup[] = []
  for (const release of visibleReleases.value) {
    const key = epochDayToKey(release.day)
    const last = result[result.length - 1]
    if (last && last.key === key) { last.items.push(release); last.count++ }
    else result.push({ key, label: relativeDateText(key), count: 1, items: [release] })
  }
  return result
})

/**
 * UpcomingScreenContent.kt: `onClickDay` scrolls the list to the header of the clicked day
 * (`listState.animateScrollToItem(state.headerIndexes[date] + offset)`).
 */
const panelsRef = ref<HTMLElement | null>(null)
const releasesRef = ref<HTMLElement | null>(null)
const scroller = computed(() => (tablet.value ? releasesRef.value : panelsRef.value))

function selectDay(cell: CalendarDayCell) {
  if (!cell.number) return
  const selector = `[data-date="${cell.key}"]`
  const target = scroller.value?.querySelector<HTMLElement>(selector)
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function openGuide() {
  window.open(GUIDE_URL, '_blank', 'noopener')
}

function openManga(manga: Manga) {
  void router.push(`/manga/${manga.id}`)
}

/* ------------------------------------------------------------------ fast scroll -- */

/** FastScrollLazyColumn (presentation-core/.../components/LazyList.kt) — a drag handle on the right. */
const handleVisible = ref(false)
const handleTop = ref(0)
let handleTimer: number | undefined
let dragStartY = 0
let dragStartScroll = 0
let dragging = false

function onScrolled() {
  const element = scroller.value
  if (!element) return
  const ratio = element.scrollTop / Math.max(1, element.scrollHeight - element.clientHeight)
  handleTop.value = Math.min(Math.max(ratio, 0), 1) * Math.max(0, element.clientHeight - 48)
  handleVisible.value = true
  if (handleTimer) window.clearTimeout(handleTimer)
  handleTimer = window.setTimeout(() => { handleVisible.value = false }, 2000)
}

function onHandlePointerDown(event: PointerEvent) {
  const element = scroller.value
  if (!element) return
  dragging = true
  dragStartY = event.clientY
  dragStartScroll = element.scrollTop
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onHandlePointerMove(event: PointerEvent) {
  const element = scroller.value
  if (!element || !dragging) return
  const span = Math.max(1, element.clientHeight - 48)
  const scale = (element.scrollHeight - element.clientHeight) / span
  element.scrollTop = dragStartScroll + (event.clientY - dragStartY) * scale
}

function onHandlePointerUp(event: PointerEvent) {
  dragging = false
  ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
}

/* ------------------------------------------------------------------ filter sheet -- */

const filterOpen = ref(false)
const filterTab = ref('categories')
const filterCategories = ref<Category[]>([])
const loadingCategories = ref(false)
const categoriesError = ref<string | null>(null)

watch(filterOpen, async value => {
  if (!value) return
  loadingCategories.value = true
  categoriesError.value = null
  try {
    filterCategories.value = (await createSuwayomiApi(server.apiUrl).categories()).sort((a, b) => a.order - b.order)
  } catch (error) {
    filterCategories.value = server.categories
    categoriesError.value = error instanceof Error ? error.message : 'Cannot reach Suwayomi.'
  } finally {
    loadingCategories.value = false
  }
})

function categoryState(id: number) {
  if (includedIds.value.includes(id)) return 'include' as const
  if (excludedIds.value.includes(id)) return 'exclude' as const
  return 'all' as const
}
/** UpcomingViewModel.cycleCategory: all → included → excluded → all. */
function cycleCategory(id: number) {
  const state = categoryState(id)
  if (state === 'all') {
    includedIds.value = [...includedIds.value, id]
    excludedIds.value = excludedIds.value.filter(value => value !== id)
  } else if (state === 'include') {
    includedIds.value = includedIds.value.filter(value => value !== id)
    excludedIds.value = [...excludedIds.value, id]
  } else {
    excludedIds.value = excludedIds.value.filter(value => value !== id)
  }
  writePreference('mihon.upcoming.includedCategories', JSON.stringify(includedIds.value))
  writePreference('mihon.upcoming.excludedCategories', JSON.stringify(excludedIds.value))
}
/** Category.visualName (eu/kanade/presentation/category/CategoryExtensions.kt). */
function categoryName(category: Category) {
  return category.default || category.isDefaultCategory ? 'Default' : category.name
}

onMounted(() => {
  document.body.classList.add('upcoming-screen-active')
})

onBeforeUnmount(() => {
  document.body.classList.remove('upcoming-screen-active')
  if (handleTimer) window.clearTimeout(handleTimer)
})
</script>

<template>
  <section class="upcoming-screen">
    <!-- UpcomingToolbar.kt: AppBar(title = "Upcoming", navigateUp, actions = FilterList, Help). -->
    <header class="upcoming-toolbar">
      <v-btn icon="arrow_back" variant="text" class="upcoming-icon-btn" aria-label="Navigate up" title="Navigate up" @click="router.back()" />
      <h1 class="upcoming-toolbar-title">Upcoming</h1>
      <v-btn
        icon="filter_list"
        variant="text"
        class="upcoming-icon-btn"
        aria-label="Filter"
        title="Filter"
        :style="hasActiveFilters ? { color: activeColor } : undefined"
        @click="filterOpen = true"
      />
      <v-btn icon="help" variant="text" class="upcoming-icon-btn" aria-label="Upcoming guide" title="Upcoming guide" @click="openGuide" />
    </header>

    <!-- LoadingScreen.kt: Box(fillMaxSize, contentAlignment = Center) { CircularProgressIndicator() } -->
    <div v-if="loading" class="upcoming-loading" role="status" aria-label="Loading upcoming releases">
      <Md3CircularProgress />
    </div>

    <div v-else class="upcoming-panels" :class="{ 'is-tablet': tablet }" :style="{ paddingTop: `${TOOLBAR_HEIGHT}px` }" ref="panelsRef" @scroll.passive="onScrolled">
      <!-- Calendar.kt -->
      <section class="calendar" aria-label="Release calendar">
        <!-- CalenderHeader.kt: padding(vertical = 8.dp).padding(start = 16.dp) -->
        <div class="calendar-header">
          <span class="calendar-title-wrap">
            <Transition :name="`month-${monthDirection}`">
              <span :key="monthTitle" class="calendar-title">{{ monthTitle }}</span>
            </Transition>
          </span>
          <span class="calendar-nav">
            <v-btn
              icon="keyboard_arrow_left"
              variant="text"
              class="upcoming-icon-btn"
              aria-label="Previous month"
              title="Previous month"
              @click="shiftMonth(-1)"
            />
            <v-btn
              icon="keyboard_arrow_right"
              variant="text"
              class="upcoming-icon-btn"
              aria-label="Next month"
              title="Next month"
              @click="shiftMonth(1)"
            />
          </span>
        </div>

        <!-- CalendarGrid.kt: SimpleGridCells.Fixed(7) -->
        <div class="calendar-grid" role="grid">
          <span
            v-for="(name, index) in weekdayNames"
            :key="`weekday-${index}`"
            class="calendar-weekday"
            role="columnheader"
          >{{ name }}</span>
          <div
            v-for="cell in calendarDays"
            :key="cell.key"
            class="calendar-cell"
            role="gridcell"
          >
            <template v-if="cell.number">
              <!-- CalendarDay.kt: circleLayout() -> circle of diameter equal to cell, centered -->
              <button
                type="button"
                class="calendar-day"
                :class="{ 'is-today': cell.isToday, 'is-past': cell.isPast }"
                :aria-label="`${relativeDateText(cell.key)}${cell.count ? `, ${cell.count} releases` : ''}`"
                @click="selectDay(cell)"
              >
                <span class="calendar-day-number">{{ cell.number }}</span>
                <span v-if="cell.count" class="calendar-dots" aria-hidden="true">
                  <i
                    v-for="dot in Math.min(cell.count, 3)"
                    :key="dot"
                    class="calendar-dot"
                    :style="{ '--dot-alpha': dot * 0.3 }"
                  />
                </span>
              </button>
            </template>
          </div>
        </div>
      </section>

      <!-- DateHeading.kt + UpcomingItem.kt / MihonEmptyScreen -->
      <section ref="releasesRef" class="calendar-releases" aria-label="Upcoming releases" @scroll.passive="onScrolled">
        <template v-if="groups.length">
          <div v-for="group in groups" :key="group.key" class="release-group">
            <div class="release-heading" :data-date="group.key">
              <span class="release-heading-label">{{ group.label }}</span>
              <span class="release-badge">{{ group.count }}</span>
            </div>
            <button
              v-for="release in group.items"
              :key="release.manga.id"
              type="button"
              class="release-item"
              :aria-label="release.manga.title"
              @click="openManga(release.manga)"
            >
              <span class="release-cover">
                <v-img :src="server.thumbnailUrl(release.manga.id)" :aspect-ratio="2 / 3" cover alt="" />
              </span>
              <span class="release-title">{{ release.manga.title }}</span>
            </button>
          </div>
        </template>

        <MihonEmptyScreen v-else-if="errorMessage" :message="errorMessage" />
        <MihonEmptyScreen v-else message="No upcoming releases" />
      </section>
    </div>

    <!-- FastScrollLazyColumn handle (VerticalFastScroller.kt: 48dp height, 12dp thickness, primary color, 2s visibility) -->
    <button
      type="button"
      class="upcoming-fast-scroll"
      :class="{ 'is-visible': handleVisible }"
      :style="{ transform: `translateY(${handleTop}px)` }"
      aria-label="Fast scroll"
      @pointerdown="onHandlePointerDown"
      @pointermove="onHandlePointerMove"
      @pointerup="onHandlePointerUp"
      @pointercancel="onHandlePointerUp"
    />

    <!-- UpcomingFilterDialog.kt: TabbedDialog(tabTitles = ["Categories"]) -->
    <AdaptiveSettingsSheet
      v-model="filterOpen"
      v-model:tab="filterTab"
      title="Filter"
      :tabs="['Categories']"
      :flat-tabs="true"
      class="upcoming-filter-sheet"
    >
      <div class="filter-sheet">
        <!-- UpcomingScreen.kt: pref_filter_upcoming_categories_details, SettingsItemsPaddings -->
        <p class="filter-description">
          Titles in excluded categories are not shown, even if they are also in any of the included categories.
        </p>
        <!-- UpcomingScreen.kt: HorizontalDivider(padding(MaterialTheme.padding.extraSmall)) -->
        <hr class="filter-divider">
        <div v-if="loadingCategories" class="filter-loading" aria-label="Loading categories">
          <Md3CircularProgress />
        </div>
        <p v-else-if="categoriesError" class="filter-error">{{ categoriesError }}</p>
        <div v-else-if="!filterCategories.length" class="filter-loading" aria-label="Loading categories">
          <Md3CircularProgress />
        </div>
        <div v-else class="filter-list">
          <!-- TriStateItem.kt: SettingsItems.kt -->
          <TriStateRow
            v-for="category in filterCategories"
            :key="category.id"
            :label="categoryName(category)"
            :model-value="categoryState(category.id)"
            @update:model-value="cycleCategory(category.id)"
          />
        </div>
      </div>
    </AdaptiveSettingsSheet>
  </section>
</template>

<style>
/* The shared shell bar is hidden while this screen provides its own top bar (see UpcomingScreen.kt). */
body.upcoming-screen-active .app-toolbar { display: none; }
/* The screen owns the area below its own top bar; the shell must not reserve space for its bar. */
body.upcoming-screen-active .v-main { padding-top: 0; }
</style>

<style scoped>
.upcoming-screen {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

/* AppBar.kt / UpcomingToolbar.kt: TopAppBar, 64dp tall, flat surface. */
.upcoming-toolbar {
  position: fixed;
  top: 0;
  left: var(--v-layout-left);
  right: var(--v-layout-right);
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 64px;
  padding-right: 4px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

/* TitleLarge: 22sp / 28sp. */
.upcoming-toolbar-title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding-left: 8px;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* IconButton: 48dp. */
.upcoming-icon-btn {
  flex: 0 0 48px;
  width: 48px;
  height: 48px;
}

.upcoming-icon-btn :deep(.v-icon) {
  font-size: 24px;
}

/* LoadingScreen.kt: Box(fillMaxSize, contentAlignment = Center). */
.upcoming-loading {
  flex: 1 1 auto;
  display: grid;
  place-items: center;
  min-height: calc(100dvh - 160px);
}

.upcoming-panels {
  flex: 1 1 auto;
  min-height: 0;
  display: block;
  overflow-y: auto;
  padding-top: 64px;
  padding-bottom: 16px;
}

.upcoming-panels.is-tablet {
  display: flex;
  align-items: stretch;
  overflow: hidden;
  padding-bottom: 0;
}

/* Calendar.kt: Column(spacedBy(4.dp)) with a padded header row. */
.calendar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

/* CalendarHeader.kt: padding(vertical = 8dp), padding(start = 16dp). */
.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 0 8px 16px;
}

.calendar-title-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  overflow: hidden;
}

.calendar-title {
  display: inline-block;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}

.calendar-nav {
  display: inline-flex;
  align-items: center;
}

/* CalendarHeader.kt: 200ms slide + fade when the month changes. */
.month-forward-enter-active,
.month-forward-leave-active,
.month-backward-enter-active,
.month-backward-leave-active {
  transition: transform 200ms ease, opacity 200ms ease;
}

.month-forward-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.month-forward-leave-to {
  transform: translateY(-100%);
  opacity: 0;
  position: absolute;
  left: 0;
}

.month-backward-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}

.month-backward-leave-to {
  transform: translateY(100%);
  opacity: 0;
  position: absolute;
  left: 0;
}

/* CalendarGrid.kt: Fixed(7) columns; weekday names are the first grid row (16sp SemiBold, 24sp line). */
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  align-items: center;
  justify-items: center;
  width: 100%;
  box-sizing: border-box;
  padding: 0 8px;
}

.calendar-weekday {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  text-align: center;
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-background));
}

/* CalendarDay.kt: circleLayout() -> square cell with centered circle button. */
.calendar-cell {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  aspect-ratio: 1 / 1;
  position: relative;
  box-sizing: border-box;
}

.calendar-day {
  position: relative;
  width: 100%;
  height: 100%;
  max-width: 48px;
  max-height: 48px;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  border: 1px solid transparent;
  background: transparent;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgb(var(--v-theme-on-background));
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 150ms ease;
}

.calendar-day:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-background)) 8%, transparent);
}

.calendar-day:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-background)) 12%, transparent);
}

.calendar-day:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.calendar-day.is-today {
  border-color: rgb(var(--v-theme-on-background));
}

.calendar-day.is-past {
  color: rgb(var(--v-theme-on-background) / 0.38);
}

.calendar-day-number {
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
  pointer-events: none;
}

/* CalendarIndicator.kt: 56/12 dp dots, alpha 0.3 / 0.6 / 0.9, offset 12dp below the day center. */
.calendar-dots {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, 12px);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.calendar-dot {
  width: 4.67px;
  height: 4.67px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary) / var(--dot-alpha));
  margin: 0 1px;
}

.calendar-releases {
  display: flex;
  flex-direction: column;
  min-height: 240px;
}

/* DateHeading.kt: 8dp padding, 8dp extra start inset, primary Badge. */
.release-heading {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 8px 8px 16px;
  box-sizing: border-box;
}

.release-heading-label {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
}

/* MD3 Badge: 16dp height, 8dp radius, labelSmall (11sp, Medium, 0.5sp tracking). */
.release-badge {
  margin-left: 8px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

/* UpcomingItem.kt: 96dp row, 16dp horizontal padding, 8dp vertical, 24dp gap, 2/3 cover. */
.release-item {
  display: flex;
  align-items: center;
  gap: 24px;
  height: 96px;
  padding: 8px 16px;
  border: none;
  background: none;
  text-align: start;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface));
  width: 100%;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 150ms ease;
}

.release-item:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.release-item:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}

/* MangaCover.Book: aspectRatio 2/3, MaterialTheme.shapes.extraSmall (4dp). */
.release-cover {
  flex: 0 0 53.333px;
  width: 53.333px;
  height: 80px;
  border-radius: 4px;
  overflow: hidden;
  display: block;
  background: #8888881f;
}

.release-cover :deep(.v-img),
.release-cover :deep(.v-responsive__content) {
  width: 100%;
  height: 100%;
}

.release-title {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  color: rgb(var(--v-theme-on-surface));
}

/* FastScrollLazyColumn handle (VerticalFastScroller.kt: 48dp height, 12dp thickness, primary color). */
.upcoming-fast-scroll {
  position: fixed;
  right: 2px;
  top: 72px;
  width: 12px;
  height: 48px;
  padding: 0 4px;
  background: transparent;
  border: 0;
  box-sizing: border-box;
  opacity: 0;
  transition: opacity 200ms ease-out;
  pointer-events: none;
  cursor: pointer;
  z-index: 4;
}

.upcoming-fast-scroll::after {
  content: '';
  display: block;
  width: 4px;
  height: 48px;
  border-radius: 2px;
  background: rgb(var(--v-theme-primary));
}

.upcoming-fast-scroll.is-visible {
  opacity: 1;
  pointer-events: auto;
}

/* UpcomingFilterDialog.kt: TabbedDialog(vertical padding 8dp) + SettingsItemsPaddings. */
.filter-sheet {
  padding: 8px 0;
  display: flex;
  flex-direction: column;
}

.filter-description {
  margin: 0;
  padding: 10px 24px;
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface-variant));
}

.filter-divider {
  margin: 4px 0;
  border: 0;
  border-top: 1px solid rgb(var(--v-theme-outline-variant));
}

.filter-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.filter-error {
  margin: 0;
  padding: 16px 24px;
  color: rgb(var(--v-theme-error));
  font-size: 14px;
  line-height: 20px;
}

.filter-list {
  display: flex;
  flex-direction: column;
}

/* TwoPanelBox.kt: on tablet the calendar and the list are two panels. */
@media (min-width: 601px) {
  .upcoming-panels.is-tablet .calendar {
    flex: 0 0 min(50%, 450px);
    overflow-y: auto;
  }

  .upcoming-panels.is-tablet .calendar-releases {
    flex: 1 1 auto;
    min-width: 0;
    overflow-y: auto;
  }
}

@media (min-width: 601px) and (max-width: 840px) {
  /* Calendar.kt: widthIn(max = 360.dp) on medium-width, non-expanded windows. */
  .calendar-grid {
    max-width: 360px;
    margin: 0 auto;
  }
}
</style>
