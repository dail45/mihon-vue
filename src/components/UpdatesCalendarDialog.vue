<script setup lang="ts">
/**
 * Upcoming release calendar — parity with Mihon's Upcoming screen.
 *
 * Reference (Mihon @446f6df):
 *   app/src/main/java/mihon/feature/upcoming/UpcomingScreen.kt
 *   app/src/main/java/mihon/feature/upcoming/UpcomingScreenContent.kt
 *   app/src/main/java/mihon/feature/upcoming/components/calendar/Calendar.kt
 *   app/src/main/java/mihon/feature/upcoming/components/calendar/CalendarHeader.kt
 *   app/src/main/java/mihon/feature/upcoming/components/calendar/CalendarDay.kt
 *   app/src/main/java/mihon/feature/upcoming/components/calendar/CalendarIndicator.kt
 *   app/src/main/java/mihon/feature/upcoming/components/UpcomingItem.kt
 *   app/src/main/java/eu/kanade/presentation/components/TabbedDialog.kt
 *   app/src/main/java/eu/kanade/presentation/components/AppBar.kt
 *   presentation-core/.../components/SettingsItems.kt (TriStateItem)
 *   presentation-core/.../components/material/Constants.kt (Padding, DISABLED_ALPHA)
 *   presentation-core/.../components/TwoPanelBox.kt
 *
 * Suwayomi's REST v1 (e2ce828) exposes no `expectedNextUpdate` / `nextUpdate` field on the manga
 * table, so the release days themselves cannot be computed by this client. The calendar chrome is
 * reproduced exactly and the release list states plainly that the schedule is unavailable in the
 * web version.
 */
import { computed, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { VBottomSheet, VDialog } from 'vuetify/components'
import { createSuwayomiApi } from '../api/client'
import type { Category, Manga } from '../api/types'
import { useTabletUi } from '../composables/useTabletUi'
import { readPreference, writePreference } from '../stores/preferences'
import { useSuwayomiStore } from '../stores/suwayomi'
import { nextTriState, type TriState } from '../utils/library'
import AdaptiveSettingsSheet from './AdaptiveSettingsSheet.vue'

const props = withDefaults(defineProps<{
  /** Release counts per ISO day (YYYY-MM-DD). */
  events?: Record<string, number>
  /** Upcoming releases with their expected update day. */
  releases?: { date: string; manga: Manga }[]
}>(), { events: () => ({}), releases: () => [] })

const open = defineModel<boolean>({ required: true })

const server = useSuwayomiStore()
const theme = useTheme()
const tablet = useTabletUi()

/** Constants.URL_HELP_UPCOMING (mihon/core/common/.../Constants.kt). */
const GUIDE_URL = 'https://mihon.app/docs/faq/updates/upcoming'
/** MaterialTheme.colorScheme.active (presentation-core/.../theme/Color.kt). */
const activeColor = computed(() => (theme.global.current.value.dark ? '#FFEB3B' : '#FFC107'))
const locale = computed(() => (typeof navigator !== 'undefined' && navigator.language) || 'en-US')

/* ------------------------------------------------------------------ calendar state */

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
    const info = new Intl.Locale(lang).getWeekInfo?.()
    if (info?.firstDay) return info.firstDay
  } catch { /* engines without Intl.Locale.getWeekInfo fall back to the table */ }
  return MONDAY_FIRST_LOCALES.includes(lang) ? 1 : 7
}
/** DayOfWeek.of((firstDayOfWeek - 1 + index) % 7 + 1) mapped to JS weeks (0 = Sunday). */
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

interface CalendarDayCell {
  key: string
  number: number
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
    cells.push({ key, number: day, isToday: date.getTime() === today.getTime(), isPast: date.getTime() < today.getTime(), count: props.events[key] ?? 0 })
  }
  return cells
})

/* ------------------------------------------------------------------ release list */

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
  return new Intl.DateTimeFormat(locale.value, { year: '2-digit', month: 'numeric', day: 'numeric' }).format(date)
}

interface ReleaseGroup {
  key: string
  label: string
  count: number
  items: { date: string; manga: Manga }[]
}

const groups = computed<ReleaseGroup[]>(() => {
  const result: ReleaseGroup[] = []
  for (const release of props.releases) {
    const last = result[result.length - 1]
    if (last && last.key === release.date) { last.items.push(release); last.count++ }
    else result.push({ key: release.date, label: relativeDateText(release.date), count: 1, items: [release] })
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
  const target = scroller.value?.querySelector<HTMLElement>(`[data-date="${cell.key}"]`)
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function openGuide() {
  window.open(GUIDE_URL, '_blank', 'noopener')
}

/* ------------------------------------------------------------------ fast scroll */

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
  handleTop.value = Math.min(Math.max(ratio, 0), 1) * (element.clientHeight - 48)
  handleVisible.value = true
  if (handleTimer) window.clearTimeout(handleTimer)
  handleTimer = window.setTimeout(() => { handleVisible.value = false }, 1200)
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

/* ------------------------------------------------------------------ filter sheet */

const filterOpen = ref(false)
const filterTab = ref('categories')
const filterCategories = ref<Category[]>([])
const loadingCategories = ref(false)
const categoriesError = ref<string | null>(null)

function readIds(key: string): number[] {
  try {
    const raw = JSON.parse(readPreference(key) || '[]')
    return Array.isArray(raw) ? raw.filter((value): value is number => typeof value === 'number') : []
  } catch { return [] }
}
const includedIds = ref<number[]>(readIds('mihon.upcoming.includedCategories'))
const excludedIds = ref<number[]>(readIds('mihon.upcoming.excludedCategories'))
const hasActiveFilters = computed(() => includedIds.value.length > 0 || excludedIds.value.length > 0)

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

function categoryState(id: number): TriState {
  if (includedIds.value.includes(id)) return 'include'
  if (excludedIds.value.includes(id)) return 'exclude'
  return 'all'
}
function cycleCategory(id: number) {
  const next = nextTriState(categoryState(id))
  includedIds.value = next === 'include' ? [...includedIds.value, id] : includedIds.value.filter(value => value !== id)
  excludedIds.value = next === 'exclude' ? [...excludedIds.value, id] : excludedIds.value.filter(value => value !== id)
  writePreference('mihon.upcoming.includedCategories', JSON.stringify(includedIds.value))
  writePreference('mihon.upcoming.excludedCategories', JSON.stringify(excludedIds.value))
}
/** Category.visualName (eu/kanade/presentation/category/CategoryExtensions.kt). */
function categoryName(category: Category) {
  return category.default || category.isDefaultCategory ? 'Default' : category.name
}
function triStateIcon(state: TriState) {
  if (state === 'include') return 'check_box'
  if (state === 'exclude') return 'disabled_by_default'
  return 'check_box_outline_blank'
}
</script>

<template>
  <component :is="tablet ? VDialog : VBottomSheet" v-model="open" :max-width="tablet ? 900 : 460" aria-label="Upcoming" scrollable>
    <v-card class="updates-calendar-card" :class="{ 'mobile-settings-card': !tablet }" color="surface-container-high">
      <!-- UpcomingToolbar.kt: AppBar(title = "Upcoming", navigateUp, actions = FilterList, Help). -->
      <header class="updates-calendar-app-bar">
        <v-btn icon="arrow_back" variant="text" class="updates-icon-btn" aria-label="Back" @click="open = false" />
        <h2 class="updates-calendar-title text-title-large font-weight-regular">Upcoming</h2>
        <v-btn icon="filter_list" variant="text" class="updates-icon-btn" aria-label="Filter" :style="hasActiveFilters ? { color: activeColor } : undefined" @click="filterOpen = true" />
        <v-btn icon="help" variant="text" class="updates-icon-btn" aria-label="Upcoming Guide" @click="openGuide" />
      </header>

      <div class="updates-calendar-panels" :class="{ 'is-tablet': tablet }" ref="panelsRef" @scroll.passive="onScrolled">
        <!-- Calendar.kt -->
        <section class="calendar" aria-label="Release calendar">
          <!-- CalenderHeader.kt -->
          <div class="calendar-header">
            <span class="calendar-title-wrap">
              <Transition :name="`month-${monthDirection}`">
                <span :key="monthTitle" class="calendar-title text-title-large">{{ monthTitle }}</span>
              </Transition>
            </span>
            <span class="calendar-nav">
              <v-btn icon="keyboard_arrow_left" variant="text" class="updates-icon-btn" aria-label="Previous Month" @click="shiftMonth(-1)" />
              <v-btn icon="keyboard_arrow_right" variant="text" class="updates-icon-btn" aria-label="Next Month" @click="shiftMonth(1)" />
            </span>
          </div>

          <!-- CalendarGrid.kt: Fixed(7) columns; the weekday names are the first grid row. -->
          <div class="calendar-grid" role="grid">
            <span v-for="(name, index) in weekdayNames" :key="`weekday-${index}`" class="calendar-weekday" role="columnheader">{{ name }}</span>
            <div v-for="cell in calendarDays" :key="cell.key" class="calendar-cell" role="gridcell">
              <template v-if="cell.number">
                <!-- CalendarDay.kt: circleLayout() -> a 24dp square, clipped to a circle. -->
                <button type="button" class="calendar-day" :class="{ 'is-today': cell.isToday, 'is-past': cell.isPast }" :aria-label="`${relativeDateText(cell.key)}${cell.count ? `, ${cell.count} releases` : ''}`" @click="selectDay(cell)">
                  <span class="calendar-day-number">{{ cell.number }}</span>
                  <span v-if="cell.count" class="calendar-dots" aria-hidden="true">
                    <i v-for="dot in Math.min(cell.count, 3)" :key="dot" class="calendar-dot" :style="{ '--dot-alpha': dot * 0.3 }" />
                  </span>
                </button>
              </template>
            </div>
          </div>
        </section>

        <!-- DateHeading.kt + UpcomingItem.kt -->
        <section ref="releasesRef" class="calendar-releases" aria-label="Upcoming releases">
          <template v-if="groups.length">
            <div v-for="group in groups" :key="group.key" class="release-group">
              <div class="release-heading" :data-date="group.key">
                <span class="release-heading-label text-body-medium">{{ group.label }}</span>
                <span class="release-badge">{{ group.count }}</span>
              </div>
              <router-link v-for="release in group.items" :key="`${group.key}-${release.manga.id}`" :to="`/manga/${release.manga.id}`" class="release-item" :aria-label="release.manga.title">
                <span class="release-cover">
                  <v-img :src="server.thumbnailUrl(release.manga.id)" :aspect-ratio="2 / 3" cover alt="" />
                </span>
                <span class="release-title text-body-medium">{{ release.manga.title }}</span>
              </router-link>
            </div>
          </template>

          <div v-else class="calendar-stub">
            <v-icon icon="event_busy" size="48" color="on-surface-variant" />
            <h3 class="text-title-large">Release calendar not available in the web version</h3>
            <p class="text-body-medium text-on-surface-variant">
              Mihon plots a local “smart update” schedule. Suwayomi’s REST API exposes no expected-next-update field,
              so release days cannot be computed here. The calendar above mirrors the Upcoming screen; day markers appear
              once the server provides update dates.
            </p>
            <v-btn variant="text" color="primary" prepend-icon="help" @click="openGuide">Upcoming Guide</v-btn>
          </div>
        </section>
      </div>

      <!-- FastScrollLazyColumn handle. -->
      <button
        type="button"
        class="updates-fast-scroll"
        :class="{ 'is-visible': handleVisible }"
        :style="{ transform: `translateY(${handleTop}px)` }"
        aria-label="Fast scroll"
        @pointerdown="onHandlePointerDown"
        @pointermove="onHandlePointerMove"
        @pointerup="onHandlePointerUp"
        @pointercancel="onHandlePointerUp"
      />
    </v-card>
  </component>

  <!-- UpcomingFilterDialog.kt: TabbedDialog(tabTitles = ["Categories"]). -->
  <AdaptiveSettingsSheet v-model="filterOpen" v-model:tab="filterTab" title="Filter" :tabs="['Categories']" class="updates-filter-sheet">
    <div class="filter-sheet">
      <!-- UpcomingScreen.kt: pref_filter_upcoming_categories_details, SettingsItemsPaddings. -->
      <p class="filter-description">
        Titles in excluded categories are not shown, even if they are also in any of the included categories.
      </p>
      <!-- UpcomingScreen.kt: HorizontalDivider(padding(MaterialTheme.padding.extraSmall)). -->
      <hr class="filter-divider" />
      <div v-if="loadingCategories" class="filter-loading" aria-label="Loading categories">
        <v-progress-circular indeterminate color="primary" size="32" width="3" />
      </div>
      <p v-else-if="categoriesError" class="filter-error text-body-medium">{{ categoriesError }}</p>
      <div v-else-if="!filterCategories.length" class="filter-loading" aria-label="Loading categories">
        <v-progress-circular indeterminate color="primary" size="32" width="3" />
      </div>
      <div v-else>
        <!-- TriStateItem.kt -->
        <div
          v-for="category in filterCategories"
          :key="category.id"
          class="tri-state-item"
          role="checkbox"
          :aria-checked="categoryState(category.id) === 'include' ? 'true' : categoryState(category.id) === 'exclude' ? 'mixed' : 'false'"
          tabindex="0"
          @click="cycleCategory(category.id)"
          @keydown.enter.prevent="cycleCategory(category.id)"
          @keydown.space.prevent="cycleCategory(category.id)"
        >
          <v-icon
            :icon="triStateIcon(categoryState(category.id))"
            size="24"
            :class="{ 'filled-symbol': categoryState(category.id) !== 'all' }"
            :color="categoryState(category.id) === 'all' ? 'on-surface-variant' : 'primary'"
          />
          <span class="tri-state-label text-body-medium">{{ categoryName(category) }}</span>
        </div>
      </div>
    </div>
  </AdaptiveSettingsSheet>
</template>

<style scoped>
@layer app-components {
.updates-calendar-card { border-radius: 28px; max-height: 85dvh; display: flex; flex-direction: column; overflow: hidden; position: relative; }
/* TopAppBar: 64dp tall, navigation icon and action buttons are 48dp. */
.updates-calendar-app-bar { display: flex; align-items: center; flex-shrink: 0; gap: 4px; height: 64px; padding-right: 4px; }
.updates-calendar-title { flex: 1; min-width: 0; margin: 0; padding-left: 8px; }
.updates-icon-btn { width: 48px; height: 48px; flex: 0 0 48px; }
.updates-icon-btn :deep(.v-icon) { font-size: 24px; }

/* Calendar.kt: Column(spacedBy(4.dp)) with a padded header row. */
.updates-calendar-panels { flex: 1; min-height: 0; display: block; overflow-y: auto; padding-bottom: 16px; }
.updates-calendar-panels.is-tablet { display: flex; align-items: stretch; overflow: hidden; padding-bottom: 0; }
.calendar { display: flex; flex-direction: column; gap: 4px; width: 100%; }
.calendar-header { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 8px 0 8px 16px; }
.calendar-title-wrap { position: relative; display: block; min-height: 28px; }
.calendar-title { display: block; }
.calendar-nav { display: flex; align-items: center; }
/* CalendarHeader.kt: 200ms slide + fade when the month changes. */
.month-forward-enter-active, .month-forward-leave-active, .month-backward-enter-active, .month-backward-leave-active { transition: transform 200ms, opacity 200ms; }
.month-forward-enter-from { transform: translateY(100%); opacity: 0; }
.month-forward-leave-to { transform: translateY(-100%); opacity: 0; }
.month-backward-enter-from { transform: translateY(-100%); opacity: 0; }
.month-backward-leave-to { transform: translateY(100%); opacity: 0; }

/* CalendarGrid.kt: Fixed(7) columns; weekday names are the first grid row (16sp SemiBold, 24sp line). */
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); align-items: start; }
.calendar-weekday { text-align: center; font-size: 16px; line-height: 24px; font-weight: 600; }
/* CalendarDay.kt: the day box is a 24dp square (circleLayout) clipped to a circle. */
.calendar-cell { display: flex; justify-content: center; align-items: flex-start; height: 24px; position: relative; }
.calendar-day { position: relative; width: 24px; height: 24px; border-radius: 50%; border: 1px solid transparent; background: transparent; padding: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; color: rgb(var(--v-theme-on-background)); }
.calendar-day.is-today { border-color: rgb(var(--v-theme-on-background)); }
.calendar-day.is-past { color: rgb(var(--v-theme-on-background) / 0.38); }
.calendar-day-number { font-size: 16px; line-height: 24px; font-weight: 600; }
/* CalendarDay.kt: the indicator Row is offset 12dp below the day center, so the dots sit on the
   lower rim of the circle; CalendarIndicator.kt: 56/12 dp dots, alpha 0.3 / 0.6 / 0.9. */
.calendar-dots { position: absolute; top: 50%; left: 50%; transform: translate(-50%, 5px); display: flex; }
.calendar-dot { width: 4.667px; height: 4.667px; border-radius: 50%; background: rgb(var(--v-theme-primary) / var(--dot-alpha)); margin: 0 1px; }

.calendar-releases { display: flex; flex-direction: column; }
/* DateHeading.kt: 8dp padding, 8dp extra start inset, primary Badge. */
.release-heading { display: flex; align-items: center; width: 100%; padding: 8px 8px 8px 16px; }
.release-heading-label { color: rgb(var(--v-theme-on-surface-variant)); font-weight: 600; }
/* MD3 Badge: 16dp height, 8dp radius, labelSmall (11sp, Medium, 0.5sp tracking). */
.release-badge { margin-left: 8px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-on-primary)); font-size: 11px; line-height: 16px; font-weight: 500; letter-spacing: 0.5px; }
/* UpcomingItem.kt: 96dp row, 16dp horizontal padding, 8dp vertical, 24dp gap, 2/3 cover. */
.release-item { display: flex; align-items: center; gap: 24px; height: 96px; padding: 8px 16px; color: inherit; text-decoration: none; }
.release-item:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 4%, transparent); }
/* MangaCover.Book: aspectRatio 2/3, MaterialTheme.shapes.extraSmall (4dp). */
.release-cover { flex: 0 0 auto; height: 80px; width: 53.333px; border-radius: 4px; overflow: hidden; display: block; background: #8888881f; }
.release-cover :deep(.v-img) { width: 100%; height: 100%; }
.release-title { flex: 1; min-width: 0; font-weight: 600; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.calendar-stub { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; padding: 32px 24px 24px; }
.calendar-stub h3 { margin: 0; }
.calendar-stub p { margin: 0; max-width: 360px; }

/* TwoPanelBox.kt: on tablet the calendar and the list are two panels. */
@media (min-width: 601px) {
  .updates-calendar-panels.is-tablet .calendar { flex: 0 0 min(50%, 450px); overflow-y: auto; }
  .updates-calendar-panels.is-tablet .calendar-releases { flex: 1 1 auto; min-width: 0; overflow-y: auto; }
}

/* FastScrollLazyColumn handle. */
.updates-fast-scroll { position: absolute; right: 2px; top: 0; width: 6px; min-height: 48px; border-radius: 3px; border: 0; padding: 0; background: rgb(var(--v-theme-primary)); opacity: 0; transition: opacity 200ms ease-out; pointer-events: none; cursor: pointer; }
.updates-fast-scroll.is-visible { opacity: 0.6; pointer-events: auto; }

/* UpcomingFilterDialog.kt: TabbedDialog(vertical padding 8dp) + SettingsItemsPaddings. */
.updates-filter-sheet :deep(.v-card) { border-radius: 28px; }
/* UpcomingFilterDialog.kt: Column(padding(vertical = TabbedDialogPaddings.Vertical)). */
/* .settings-scroll of AdaptiveSettingsSheet already provides the 8dp vertical dialog padding. */
.filter-sheet { padding: 0; }
/* UpcomingScreen.kt: plain Text -> bodyLarge (16sp / 24sp). */
.filter-description { margin: 0; padding: 10px 24px; font-size: 16px; line-height: 24px; }
/* HorizontalDivider(Modifier.padding(MaterialTheme.padding.extraSmall)). */
.filter-divider { margin: 4px; border: 0; border-top: 1px solid rgb(var(--v-theme-outline-variant)); }
.filter-loading { display: flex; align-items: center; justify-content: center; padding: 16px; }
.filter-error { margin: 0; padding: 16px 0; color: rgb(var(--v-theme-error)); }
/* TriStateItem.kt: 24dp horizontal, 10dp vertical padding, 24dp gap, 24dp icon. */
.tri-state-item { display: flex; align-items: center; gap: 24px; width: 100%; min-height: 44px; padding: 10px 24px; cursor: pointer; color: rgb(var(--v-theme-on-surface)); }
.tri-state-item:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 6%, transparent); }
.tri-state-label { min-width: 0; }

@media (min-width: 601px) and (max-width: 840px) {
  /* Calendar.kt: widthIn(max = 360.dp) on medium-width, non-expanded windows. */
  .calendar-grid { max-width: 360px; margin: 0 auto; }
}
}
</style>
