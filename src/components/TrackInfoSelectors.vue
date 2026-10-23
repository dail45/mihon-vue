<script setup lang="ts">
/**
 * Track info — status / chapter / score / date selectors.
 *
 * Port of Mihon's TrackInfoDialogSelector.kt
 *   app/src/main/java/eu/kanade/presentation/track/TrackInfoDialogSelector.kt
 * (Mihon commit 446f6df82c390ab760802c2fce3b677bce3f31c1), on top of
 * presentation-core's AlertDialogContent.kt and WheelPicker.kt.
 *
 * Reference structure:
 *  - TrackStatusSelector  : title "Status", scrollable radio list
 *  - TrackChapterSelector : title "Chapters", WheelNumberPicker (0..endRange)
 *  - TrackScoreSelector   : title "Score", WheelTextPicker
 *  - TrackDateSelector    : title (started/finished reading date),
 *                           MD3 DatePicker (no title, no headline and no
 *                           mode toggle) + Remove/Cancel/OK row
 *  - BaseSelector         : AlertDialogContent(title, text, buttons)
 *                           buttons = Row(spacedBy(8.dp), End) { Cancel, OK }
 *
 * Geometry taken from the reference:
 *  - AlertDialogContent: DialogPadding 24dp, TitlePadding bottom 16dp,
 *    TextPadding bottom 24dp, min width 280dp / max width 560dp.
 *  - Title = headlineSmall (24sp / 32sp) in onSurface, start aligned.
 *  - Text = bodyMedium (14sp / 20sp) in onSurfaceVariant, horizontal 24dp inset.
 *  - Buttons = labelLarge (14sp / 500) in primary, 8dp gap, end aligned.
 *  - Status row: clip(RoundedCornerShape(8.dp)), selectable, RadioButton +
 *    Text(bodyLarge, start padding 24dp), minimum interactive size 48dp.
 *  - WheelPicker: 128x128dp box, 3 rows, band = primary 20% + 1dp primary border,
 *    16dp radius, items titleMedium (16sp / 24sp), snapped row alpha 1.2 -> 0.2.
 *  - Date selector buttons row: padding(start 12, top 8, end 12, bottom 24).
 *
 * The web build has no Android date-picker widget, so the calendar below is a
 * faithful MD3 rendering of the same picker (no title, no headline, no mode
 * toggle) built from plain HTML/CSS.
 */
import { computed, nextTick, ref, watch } from 'vue'

export type TrackSelectorMode = 'status' | 'chapter' | 'score' | 'date'

export interface TrackStatusOption {
  key: number
  label: string
}

const props = withDefaults(
  defineProps<{
    /** Which selector is shown. */
    mode: TrackSelectorMode
    /** Status options (status mode): key is the tracker status id. */
    statusOptions?: TrackStatusOption[]
    /** Selected status id. */
    statusSelection?: number | null
    /** Chapter numbers (chapter mode). */
    chapterOptions?: number[]
    /** Selected chapter number. */
    chapterSelection?: number
    /** Score labels (score mode). */
    scoreOptions?: string[]
    /** Selected score label. */
    scoreSelection?: string
    /** Selected date, epoch milliseconds (date mode). */
    dateSelection?: number | null
    /** Dialog title (date mode). Defaults to "Start date" / "Finish date". */
    dateTitle?: string
    /** Which date is edited (date mode): start or finish. */
    dateKind?: 'start' | 'finish'
    /** Tracker service name, used by the "Remove date?" confirmation text. */
    dateServiceName?: string
    /** Whether the "Remove" button is offered (date mode). */
    dateRemovable?: boolean
    /** Earliest selectable date, epoch milliseconds (date mode). */
    dateMin?: number | null
    /** Latest selectable date, epoch milliseconds (date mode). */
    dateMax?: number | null
    /**
     * The other stored date of the track (finish date when editing the start
     * date and vice versa). The reference disables dates that would break the
     * start <= finish ordering.
     */
    dateCounterpart?: number | null
  }>(),
  {
    statusOptions: () => [],
    statusSelection: null,
    chapterOptions: () => [],
    chapterSelection: 0,
    scoreOptions: () => [],
    scoreSelection: '',
    dateSelection: null,
    dateTitle: '',
    dateKind: 'start',
    dateServiceName: '',
    dateRemovable: false,
    dateMin: null,
    dateMax: null,
    dateCounterpart: null,
  },
)

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  (event: 'confirm', value: number | string): void
  (event: 'remove'): void
}>()

/* ------------------------------------------------------------------ titles */

const STATUS_TITLE = 'Status'
const CHAPTERS_TITLE = 'Chapters'
const SCORE_TITLE = 'Score'
/** MR.strings.track_started_reading_date / track_finished_reading_date. */
const START_DATE_TITLE = 'Start date'
const FINISH_DATE_TITLE = 'Finish date'

const dialogTitle = computed(() => {
  if (props.mode === 'status') return STATUS_TITLE
  if (props.mode === 'chapter') return CHAPTERS_TITLE
  if (props.mode === 'score') return SCORE_TITLE
  if (props.dateTitle) return props.dateTitle
  return props.dateKind === 'finish' ? FINISH_DATE_TITLE : START_DATE_TITLE
})

/* ------------------------------------------------------------------ status */

const statusSelected = ref<number | null>(null)
const statusList = ref<HTMLElement | null>(null)
const statusScrollable = ref({ top: false, bottom: false })
/** Floating scrollbar geometry: thumb size and offset over the list viewport. */
const statusThumb = ref({ top: 0, height: 0, visible: false })

function onStatusScroll() {
  const el = statusList.value
  if (!el) return
  const scrollable = el.scrollHeight > el.clientHeight + 1
  statusScrollable.value = {
    top: el.scrollTop > 0,
    bottom: scrollable && el.scrollTop + el.clientHeight < el.scrollHeight - 1,
  }
  // Scrollbar.kt: thumbSize = viewport / total * viewport, startOffset from the scroll ratio.
  const viewport = el.clientHeight
  const total = el.scrollHeight
  statusThumb.value = {
    top: scrollable ? (el.scrollTop / Math.max(1, total - viewport)) * (viewport - (viewport / total) * viewport) : 0,
    height: (viewport / Math.max(1, total)) * viewport,
    visible: scrollable,
  }
}

function selectStatus(key: number) {
  statusSelected.value = key
}

/* ------------------------------------------------------------------ wheel */

const PICKER_HEIGHT = 128
const ROW_COUNT = 3
const ROW_HEIGHT = PICKER_HEIGHT / ROW_COUNT

const wheelSelected = ref(0)
const wheelScrollTop = ref(0)
const wheelEl = ref<HTMLElement | null>(null)
const manualInput = ref(false)
const manualText = ref('')

/**
 * TrackInfoDialog.kt -> TrackChapterSelectorScreen.Model.getRange():
 * `0..totalChapters`, or `0..10000` when the total chapter count is unknown.
 * The caller only knows the total, so a single-element list means "unknown".
 */
const effectiveChapterOptions = computed<number[]>(() => {
  if (props.mode !== 'chapter') return []
  if (props.chapterOptions.length > 1) return props.chapterOptions
  return Array.from({ length: 10001 }, (_, index) => index)
})

const wheelItems = computed<string[]>(() => {
  if (props.mode === 'chapter') return effectiveChapterOptions.value.map(value => String(value))
  return props.scoreOptions
})

/** WheelPicker `startIndex`. */
function wheelStartIndex(): number {
  if (props.mode === 'chapter') {
    const index = effectiveChapterOptions.value.indexOf(props.chapterSelection)
    return index >= 0 ? index : 0
  }
  // TrackScoreSelector: selections.indexOf(selection).takeIf { it > 0 } ?: (selections.size / 2)
  const index = props.scoreOptions.indexOf(props.scoreSelection)
  return index > 0 ? index : Math.floor(props.scoreOptions.length / 2)
}

function scrollWheelTo(index: number) {
  const el = wheelEl.value
  if (el) el.scrollTop = index * ROW_HEIGHT
}

function onWheelScroll() {
  const el = wheelEl.value
  if (!el) return
  wheelScrollTop.value = el.scrollTop
  const index = Math.min(wheelItems.value.length - 1, Math.max(0, Math.round(el.scrollTop / ROW_HEIGHT)))
  if (index !== wheelSelected.value) wheelSelected.value = index
}

/** WheelPickerDefaults.calculateAnimatedAlpha: 1.2 at the snapped row, 0.2 off row. */
function wheelRowAlpha(index: number) {
  const distance = Math.abs(index * ROW_HEIGHT - wheelScrollTop.value)
  return Math.min(1, Math.max(0.2, 1.2 - distance / ROW_HEIGHT))
}

function selectWheelIndex(index: number) {
  const next = Math.min(wheelItems.value.length - 1, Math.max(0, index))
  wheelSelected.value = next
  scrollWheelTo(next)
}

function onWheelKeydown(event: KeyboardEvent) {
  const keys: Record<string, number> = {
    ArrowUp: wheelSelected.value - 1,
    ArrowDown: wheelSelected.value + 1,
    PageUp: wheelSelected.value - 5,
    PageDown: wheelSelected.value + 5,
    Home: 0,
    End: wheelItems.value.length - 1,
  }
  const target = keys[event.key]
  if (target == null) return
  event.preventDefault()
  selectWheelIndex(target)
}

function onWheelScrollEnd() {
  selectWheelIndex(Math.round(wheelScrollTop.value / ROW_HEIGHT))
}

const manualInputRef = ref<HTMLInputElement | null>(null)

/* WheelNumberPicker allows typing the value directly. */
function openManualInput() {
  if (props.mode !== 'chapter') return
  manualText.value = wheelItems.value[wheelSelected.value] ?? ''
  manualInput.value = true
  nextTick(() => {
    manualInputRef.value?.focus()
    manualInputRef.value?.select()
  })
}

function commitManualInput() {
  const index = wheelItems.value.indexOf(manualText.value.trim())
  if (index >= 0) {
    selectWheelIndex(index)
  }
  manualInput.value = false
}

/* ------------------------------------------------------------------ date */

const dateMonth = ref(new Date())
const locale = computed(() => (typeof navigator !== 'undefined' && navigator.language) || 'en-US')

const MONTH_FIRST_LOCALES = ['ru', 'uk', 'be', 'bg', 'cs', 'da', 'de', 'el', 'es', 'et', 'fi', 'fr', 'hu', 'it', 'lt', 'lv', 'nl', 'no', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv', 'tr', 'zh', 'ja', 'ko', 'id', 'vi', 'th', 'he', 'ar']
function firstDayOfWeek(lang: string): number {
  try {
    const info = (new Intl.Locale(lang) as unknown as { getWeekInfo?: () => { firstDay: number } }).getWeekInfo?.()
    if (info?.firstDay) return info.firstDay
  } catch { /* engines without Intl.Locale.getWeekInfo fall back to the table */ }
  return MONTH_FIRST_LOCALES.includes(lang) ? 1 : 7
}
const weekStartIndex = computed(() => (((firstDayOfWeek(locale.value.split('-')[0]!) - 1) % 7) + 1) % 7)
const weekdayNames = computed(() => {
  const formatter = new Intl.DateTimeFormat(locale.value, { weekday: 'narrow' })
  return Array.from({ length: 7 }, (_, index) => {
    const weekday = ((weekStartIndex.value + index) % 7 + 1) % 7
    return formatter.format(new Date(Date.UTC(2023, 0, 1 + weekday)))
  })
})

const monthTitle = computed(() => new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(dateMonth.value))

interface DateCell {
  key: string
  day: number
  month: number
  date: Date
  inMonth: boolean
  selectable: boolean
  selected: boolean
  today: boolean
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

const datePicked = ref<number | null>(null)

const selectedDate = computed(() => (datePicked.value == null ? null : new Date(datePicked.value)))

/**
 * MD3 Month layout: empty cells are real spacers (no adjacent-month days are
 * rendered), each day sits in a 48dp cell with a 40dp circular container.
 */
const dateRows = computed<(DateCell | null)[][]>(() => {
  const year = dateMonth.value.getFullYear()
  const month = dateMonth.value.getMonth()
  const first = new Date(year, month, 1)
  const days = new Date(year, month + 1, 0).getDate()
  const leading = (first.getDay() - weekStartIndex.value + 7) % 7
  const today = startOfDay(new Date())
  const cells: (DateCell | null)[] = []
  const push = (date: Date) => {
    const time = startOfDay(date)
    // TrackInfoDialog.kt -> TrackDateSelectorScreen.selectableDates:
    //  - future dates are never selectable
    //  - the start date may not be after the finish date, and the finish date
    //    may not be before the start date
    const counterpart = props.dateCounterpart == null ? null : startOfDay(new Date(props.dateCounterpart))
    let selectable = time <= today
    if (selectable && counterpart != null) {
      selectable = props.dateKind === 'finish' ? time >= counterpart : time <= counterpart
    }
    if (selectable && props.dateMax != null) selectable = time <= startOfDay(new Date(props.dateMax))
    if (selectable && props.dateMin != null) selectable = time >= startOfDay(new Date(props.dateMin))
    cells.push({
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      day: date.getDate(),
      month: date.getMonth(),
      date,
      inMonth: true,
      selectable,
      selected: selectedDate.value != null && startOfDay(selectedDate.value) === time,
      today: time === today,
    })
  }
  for (let index = 0; index < leading; index++) cells.push(null)
  for (let day = 1; day <= days; day++) push(new Date(year, month, day))
  while (cells.length % 7 !== 0) cells.push(null)
  const rows: (DateCell | null)[][] = []
  for (let index = 0; index < cells.length; index += 7) rows.push(cells.slice(index, index + 7))
  // MD3 Month always occupies MaxCalendarRows (6) rows of 48dp.
  while (rows.length < 6) rows.push([null, null, null, null, null, null, null])
  return rows
})

/** Year picker (MD3 YearPicker): 3 columns (YearsInRow), 36dp high, 72dp wide items. */
const yearPickerOpen = ref(false)
const YEAR_MIN = 1900
const YEAR_MAX = 2100

/**
 * TrackInfoDialog.kt -> TrackDateSelectorScreen.selectableDates.isSelectableYear:
 * future years are disabled, and the start year may not be after the finish
 * year (and vice versa).
 */
function isSelectableYear(year: number): boolean {
  if (year > new Date().getFullYear()) return false
  const counterpart = props.dateCounterpart == null ? null : new Date(props.dateCounterpart)
  if (counterpart == null) return true
  return props.dateKind === 'finish'
    ? counterpart.getFullYear() <= year
    : year <= counterpart.getFullYear()
}

const selectedYearRef = ref<HTMLElement | null>(null)

const yearRows = computed(() => {
  const years: number[] = []
  for (let year = YEAR_MIN; year <= YEAR_MAX; year++) years.push(year)
  const rows: number[][] = []
  for (let index = 0; index < years.length; index += 3) rows.push(years.slice(index, index + 3))
  return rows
})

watch(yearPickerOpen, async isOpen => {
  if (isOpen) {
    await nextTick()
    selectedYearRef.value?.scrollIntoView({ block: 'center' })
  }
})

function selectYear(year: number) {
  dateMonth.value = new Date(year, dateMonth.value.getMonth(), 1)
  yearPickerOpen.value = false
}

function shiftMonth(delta: number) {
  dateMonth.value = new Date(dateMonth.value.getFullYear(), dateMonth.value.getMonth() + delta, 1)
}

function pickDate(cell: DateCell) {
  if (!cell.selectable) return
  datePicked.value = startOfDay(cell.date)
}

/* ------------------------------------------------------------------ lifecycle */

watch(open, async value => {
  if (!value) return
  if (props.mode === 'status') {
    statusSelected.value = props.statusSelection ?? null
    await nextTick()
    onStatusScroll()
  }
  if (props.mode === 'chapter' || props.mode === 'score') {
    manualInput.value = false
    wheelSelected.value = wheelStartIndex()
    wheelScrollTop.value = wheelSelected.value * ROW_HEIGHT
    await nextTick()
    scrollWheelTo(wheelSelected.value)
  }
  if (props.mode === 'date') {
    yearPickerOpen.value = false
    const today = startOfDay(new Date())
    const counterpart = props.dateCounterpart == null ? null : startOfDay(new Date(props.dateCounterpart))
    let defaultDate = today
    if (counterpart != null) {
      if (props.dateKind === 'start' && today > counterpart) {
        defaultDate = counterpart
      } else if (props.dateKind === 'finish' && today < counterpart) {
        defaultDate = counterpart
      }
    }
    datePicked.value = props.dateSelection ?? defaultDate
    const base = new Date(datePicked.value)
    dateMonth.value = new Date(base.getFullYear(), base.getMonth(), 1)
  }
})

function confirm() {
  if (props.mode === 'status') {
    if (statusSelected.value != null) emit('confirm', statusSelected.value)
  } else if (props.mode === 'chapter') {
    emit('confirm', Number(wheelItems.value[wheelSelected.value] ?? props.chapterSelection))
  } else if (props.mode === 'score') {
    emit('confirm', wheelItems.value[wheelSelected.value] ?? props.scoreSelection)
  } else if (props.mode === 'date') {
    if (datePicked.value != null) emit('confirm', datePicked.value)
  }
  open.value = false
}

function cancel() {
  open.value = false
}

/* ------------------------------------------- TrackDateRemoverScreen (confirm) */

/**
 * TrackInfoDialog.kt -> TrackDateRemoverScreen: the "Remove" action does not
 * delete the date right away, it opens a confirmation dialog with a delete
 * icon, the "Remove date?" title and an error-container filled tonal button.
 */
const removeConfirmOpen = ref(false)

const removeConfirmText = computed(() => {
  const name = props.dateServiceName || 'the tracker'
  return props.dateKind === 'finish'
    ? `This will remove your previously selected finish date from ${name}`
    : `This will remove your previously selected start date from ${name}`
})

function requestRemove() {
  removeConfirmOpen.value = true
}

function confirmRemove() {
  removeConfirmOpen.value = false
  open.value = false
  emit('remove')
}
</script>

<template>
  <v-dialog v-model="open" :width="mode === 'date' ? 360 : 320" max-width="560" :aria-label="dialogTitle">
    <v-card class="track-dialog" rounded="28px" color="surface-container-high">
      <h2 class="track-dialog-title">{{ dialogTitle }}</h2>

      <!--
        AlertDialogContent has two overloads. BaseSelector (status / chapter / score)
        uses the `text` one: the body is inset by DialogPadding (24dp) on the sides and
        padded 24dp at the bottom. TrackDateSelector uses the `content` one, so its
        DatePicker spans the dialog edge to edge and only its own button row is inset.
      -->

      <div v-if="mode === 'status'" class="track-dialog-text track-status">
        <div class="track-status-list" ref="statusList" role="radiogroup" :aria-label="dialogTitle" @scroll.passive="onStatusScroll">
          <button
            v-for="option in statusOptions"
            :key="option.key"
            type="button"
            class="track-status-row"
            role="radio"
            :aria-checked="statusSelected === option.key"
            @click="selectStatus(option.key)"
          >
            <span class="track-radio" :class="{ 'is-selected': statusSelected === option.key }"><span v-if="statusSelected === option.key" class="track-radio-dot" /></span>
            <span class="track-status-label">{{ option.label }}</span>
          </button>
        </div>
        <div v-if="statusScrollable.top" class="track-divider track-divider-top" aria-hidden="true" />
        <div v-if="statusScrollable.bottom" class="track-divider track-divider-bottom" aria-hidden="true" />
        <div
          v-if="statusThumb.visible"
          class="track-status-thumb"
          aria-hidden="true"
          :style="{ top: `${statusThumb.top}px`, height: `${statusThumb.height}px` }"
        />
      </div>

      <!-- TrackChapterSelector / TrackScoreSelector: wheel picker. -->
      <div v-else-if="mode === 'chapter' || mode === 'score'" class="track-dialog-text track-wheel-wrap">
        <div class="track-wheel">
          <div class="track-wheel-band" aria-hidden="true" />
          <input
            v-if="manualInput"
            ref="manualInputRef"
            v-model="manualText"
            class="track-wheel-input"
            type="number"
            inputmode="numeric"
            :aria-label="dialogTitle"
            @keydown.enter.prevent="commitManualInput"
            @keydown.esc.prevent="manualInput = false"
            @blur="commitManualInput"
          >
          <ul
            v-else
            ref="wheelEl"
            class="track-wheel-list"
            role="listbox"
            tabindex="0"
            :aria-activedescendant="`track-wheel-option-${wheelSelected}`"
            :aria-label="dialogTitle"
            @scroll.passive="onWheelScroll"
            @scrollend="onWheelScrollEnd"
            @keydown="onWheelKeydown"
            @click="openManualInput"
          >
            <li
              v-for="(item, index) in wheelItems"
              :id="`track-wheel-option-${index}`"
              :key="index"
              class="track-wheel-item"
              role="option"
              :aria-selected="index === wheelSelected"
              :style="{ opacity: wheelRowAlpha(index) }"
              @click="mode === 'score' ? selectWheelIndex(index) : undefined"
            >
              {{ item }}
            </li>
          </ul>
        </div>
      </div>

      <!-- TrackDateSelector: MD3 DatePicker without title/headline and without mode toggle. -->
      <div v-else class="track-date">
        <div class="track-date-calendar">
          <!-- MonthsNavigation: month/year TextButton + previous/next IconButtons. -->
          <div class="track-date-header">
            <button
              type="button"
              class="track-date-month-btn"
              :aria-expanded="yearPickerOpen"
              @click="yearPickerOpen = !yearPickerOpen"
            >
              <span class="track-date-month">{{ monthTitle }}</span>
              <span class="material-symbols-rounded track-date-month-caret" aria-hidden="true">arrow_drop_down</span>
            </button>
            <span class="track-date-nav" :style="{ visibility: yearPickerOpen ? 'hidden' : 'visible' }">
              <button type="button" class="track-date-nav-btn" aria-label="Previous month" @click="shiftMonth(-1)">
                <span class="material-symbols-rounded" aria-hidden="true">chevron_left</span>
              </button>
              <button type="button" class="track-date-nav-btn" aria-label="Next month" @click="shiftMonth(1)">
                <span class="material-symbols-rounded" aria-hidden="true">chevron_right</span>
              </button>
            </span>
          </div>

          <!-- YearPicker: shown instead of the month grid while the year button is open. -->
          <div v-if="yearPickerOpen" class="track-date-years" role="grid">
            <div v-for="(row, rowIndex) in yearRows" :key="`yr-${rowIndex}`" class="track-date-year-row" role="row">
              <button
                v-for="year in row"
                :key="`y-${year}`"
                :ref="el => { if (year === dateMonth.getFullYear()) selectedYearRef = el as HTMLElement }"
                type="button"
                class="track-date-year"
                :class="{ 'is-selected': year === dateMonth.getFullYear(), 'is-current': year === new Date().getFullYear() }"
                :disabled="!isSelectableYear(year)"
                role="gridcell"
                :aria-selected="year === dateMonth.getFullYear()"
                @click="selectYear(year)"
              >
                {{ year }}
              </button>
            </div>
          </div>

          <template v-else>
            <!-- WeekDays: bodyLarge labels in on-surface, evenly spread. -->
            <div class="track-date-weekdays" role="row">
              <span v-for="(name, index) in weekdayNames" :key="`wd-${index}`" class="track-date-weekday" role="columnheader">{{ name }}</span>
            </div>
            <!-- Month: 48dp rows, days in 40dp circles. -->
            <div class="track-date-grid" role="grid">
              <div v-for="(row, rowIndex) in dateRows" :key="`r-${rowIndex}`" class="track-date-row" role="row">
                <span v-for="(cell, cellIndex) in row" :key="cell ? cell.key : `e-${rowIndex}-${cellIndex}`" class="track-date-cell" role="gridcell">
                  <button
                    v-if="cell"
                    type="button"
                    class="track-date-day"
                    :class="{ 'is-selected': datePicked != null && cell.selected, 'is-today': cell.today, 'is-disabled': !cell.selectable }"
                    :aria-selected="datePicked != null && cell.selected"
                    :aria-label="cell.date.toDateString()"
                    :disabled="!cell.selectable"
                    @click="pickDate(cell)"
                  >
                    <span class="track-date-day-number">{{ cell.day }}</span>
                  </button>
                </span>
              </div>
            </div>
          </template>
        </div>
        <div class="track-date-actions">
          <button v-if="dateRemovable" type="button" class="track-dialog-button" @click="requestRemove">Remove</button>
          <span v-if="dateRemovable" class="track-date-spacer" />
          <button type="button" class="track-dialog-button" @click="cancel">Cancel</button>
          <button type="button" class="track-dialog-button" @click="confirm">OK</button>
        </div>
      </div>

      <!-- BaseSelector buttons: Cancel, OK (end aligned, 8dp apart). -->
      <div v-if="mode !== 'date'" class="track-dialog-actions">
        <button type="button" class="track-dialog-button" @click="cancel">Cancel</button>
        <button type="button" class="track-dialog-button" @click="confirm">OK</button>
      </div>
    </v-card>
  </v-dialog>

  <!-- TrackInfoDialog.kt -> TrackDateRemoverScreen: "Remove date?" confirmation -->
  <v-dialog v-model="removeConfirmOpen" width="320" max-width="560">
    <div class="track-dialog track-confirm" role="dialog" aria-modal="true">
      <span class="material-symbols-rounded track-confirm-icon" aria-hidden="true">delete</span>
      <h2 class="track-confirm-title">Remove date?</h2>
      <p class="track-confirm-text">{{ removeConfirmText }}</p>
      <div class="track-dialog-actions">
        <button type="button" class="track-dialog-button" @click="removeConfirmOpen = false">Cancel</button>
        <button type="button" class="track-dialog-button track-confirm-button--danger" @click="confirmRemove">Remove</button>
      </div>
    </div>
  </v-dialog>
</template>

<style scoped>
/* MD3 AlertDialog geometry (AlertDialogContent.kt + androidx AlertDialog):
   container shape = CornerExtraLarge (28dp), container color = surfaceContainerHigh,
   min width 280dp / max width 560dp.
   AlertDialogContent pads per section, not the whole dialog:
   title  = start/top/end DialogPadding (24dp), bottom TitlePadding (16dp)
   text   = horizontal DialogPadding (24dp), bottom TextPadding (24dp)
   buttons= start/end/bottom DialogPadding (24dp) */
.track-dialog {
  border-radius: 28px !important;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 4px 8px 3px rgba(0, 0, 0, 0.15) !important;
  padding: 0;
  min-width: 280px;
  max-width: 560px;
  width: 100%;
  background-color: rgb(var(--v-theme-surface-container-high)) !important;
  color: rgb(var(--v-theme-on-surface));
}
/* Title: headlineSmall (24sp / 32sp) in on-surface, TitlePadding bottom 16dp. */
.track-dialog-title {
  font-family: var(--v-font-heading, var(--v-font-body, Roboto, sans-serif));
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
  margin: 24px 24px 16px;
}
/* Text: bodyMedium (14sp / 20sp) in on-surface-variant, horizontal DialogPadding 24dp,
   TextPadding bottom 24dp. */
.track-dialog-text {
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
  margin: 0 24px 24px;
}

/* ------------------------------------------------------- status radio list */
/* ScrollbarLazyColumn: a floating scrollbar drawn over the list at the end. */
.track-status { position: relative; }
.track-status-list {
  max-height: 320px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}
.track-status-list::-webkit-scrollbar { display: none; }
.track-status-thumb {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  border-radius: 2px;
  background: rgb(var(--v-theme-on-surface) / 0.364);
  pointer-events: none;
}
/* Row: clip(RoundedCornerShape(8.dp)) + selectable + minimumInteractiveComponentSize. */
.track-status-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 48px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-family: var(--v-font-body, Roboto, sans-serif);
  text-align: left;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface));
}
.track-status-row:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 6%, transparent); }
.track-status-row:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
/* MD3 RadioButton: Canvas = padding(RadioButtonPadding 2dp) + requiredSize(IconSize 20dp),
   so the element is 24x24dp with a 20dp ring (2dp stroke) centred in it; the
   selected dot is RadioButtonDotSize 12dp minus the stroke = 10dp.
   onClick is null in the reference, so no 48dp touch-target slot is added. */
.track-radio {
  position: relative;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.track-radio::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
}
.track-radio.is-selected::before { border-color: rgb(var(--v-theme-primary)); }
.track-radio-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
}
/* Text: bodyLarge (16sp / 24sp); the AlertDialogContent `text` block provides
   onSurfaceVariant as the content color, so the label uses on-surface-variant. */
.track-status-label {
  margin-left: 24px;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.03125em;
  color: rgb(var(--v-theme-on-surface-variant));
}
/* HorizontalDivider: 1dp outline-variant, centered on the list edges. */
.track-divider {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: rgb(var(--v-theme-outline-variant));
  pointer-events: none;
}
.track-divider-top { top: 0; }
.track-divider-bottom { bottom: 0; }

/* ------------------------------------------------------------- wheel picker */
/* WheelPicker: 128dp box, 3 rows, band = primary 20% + 1dp primary border,
   16dp radius (MaterialTheme.padding.medium), items titleMedium. */
.track-wheel-wrap { display: flex; justify-content: center; }
.track-wheel { position: relative; width: 128px; height: 128px; }
.track-wheel-band {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 42.6667px;
  transform: translateY(-50%);
  border-radius: 16px;
  background: rgba(var(--v-theme-primary), 0.2);
  border: 1px solid rgb(var(--v-theme-primary));
  pointer-events: none;
}
.track-wheel-list {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 42.6667px 0;
  list-style: none;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  overscroll-behavior: contain;
  scrollbar-width: none;
  cursor: pointer;
}
.track-wheel-list::-webkit-scrollbar { display: none; }
.track-wheel-item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 42.6667px;
  scroll-snap-align: center;
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  letter-spacing: 0.009375em;
  color: rgb(var(--v-theme-on-surface-variant));
}
.track-wheel-input::-webkit-outer-spin-button,
.track-wheel-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.track-wheel-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  text-align: center;
  font-family: var(--v-font-body, Roboto, sans-serif);
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  caret-color: rgb(var(--v-theme-primary));
  -moz-appearance: textfield;
  appearance: textfield;
}

/* --------------------------------------------------------------- date picker */
/* TrackDateSelector uses the AlertDialogContent `content` overload, so the
   DatePicker spans the dialog edge to edge; only the button row is inset.
   DatePicker internals: DatePickerHorizontalPadding 12dp, MonthYearHeight 56dp,
   RecommendedSizeForAccessibility 48dp, DateContainerWidth/Height 40dp,
   DateTodayContainerOutlineWidth 1dp. */
.track-date { display: flex; flex-direction: column; }
.track-date-calendar { display: flex; flex-direction: column; padding: 0 12px; }
.track-date-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 56px;
}
/* YearPickerMenuButton: TextButton with CircleShape, label + drop-down caret. */
.track-date-month-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 12px;
  border: none;
  border-radius: 20px;
  background: transparent;
  font-family: var(--v-font-body, Roboto, sans-serif);
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface-variant));
}
.track-date-month-btn:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.track-date-month-btn:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.track-date-month {
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.0071428571em;
  color: rgb(var(--v-theme-on-surface-variant));
}
.track-date-month-caret {
  font-size: 24px;
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.track-date-month-btn[aria-expanded="true"] .track-date-month-caret {
  transform: rotate(180deg);
}
.track-date-nav { display: flex; align-items: center; }
.track-date-nav-btn {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  cursor: pointer;
}
.track-date-nav-btn:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.track-date-nav-btn:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.track-date-nav-btn .material-symbols-rounded { font-size: 24px; }
/* Weekday header: bodyLarge (16sp / 24sp) in on-surface, evenly spread. */
.track-date-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  justify-items: center;
  min-height: 48px;
  align-items: center;
}
.track-date-weekday {
  text-align: center;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.03125em;
  color: rgb(var(--v-theme-on-surface));
}
/* Month grid: rows are 48dp high, cells 48dp wide with a 40dp day circle. */
.track-date-grid { display: flex; flex-direction: column; }
.track-date-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  justify-items: center;
  height: 48px;
}
.track-date-cell {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
}
.track-date-day {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}
.track-date-day:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }
/* Day container: 40dp circle, bodyLarge label. */
.track-date-day-number {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.03125em;
  color: rgb(var(--v-theme-on-surface));
}
.track-date-day.is-disabled { cursor: not-allowed; }
.track-date-day.is-disabled .track-date-day-number { color: rgb(var(--v-theme-on-surface) / 0.38); }
.track-date-day.is-today .track-date-day-number {
  box-shadow: inset 0 0 0 1px rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-primary));
}
.track-date-day.is-selected .track-date-day-number { background: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-on-primary)); }
.track-date-day:hover:not(.is-disabled):not(.is-selected) .track-date-day-number { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
/* YearPicker: rows of 3 items, 36dp high, 72dp wide. */
.track-date-years {
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 336px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  padding: 8px 0;
}
.track-date-year-row { display: flex; gap: 4px; justify-content: center; }
.track-date-year {
  width: 72px;
  height: 36px;
  border: none;
  border-radius: 18px;
  background: transparent;
  font-family: var(--v-font-body, Roboto, sans-serif);
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
}
.track-date-year:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.track-date-year.is-current:not(.is-selected) {
  box-shadow: inset 0 0 0 1px rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-primary));
}
.track-date-year.is-selected { background: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-on-primary)); }
.track-date-year:disabled {
  color: rgb(var(--v-theme-on-surface) / 0.38);
  cursor: not-allowed;
}
/* Buttons row: padding(start 12, top 8, end 12, bottom 24), 8dp gap, end aligned. */
.track-date-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin: 8px 12px 24px;
}
.track-date-spacer { flex: 1 1 auto; }

/* ------------------------------------------------------------------ buttons */
/* AlertDialogFlowRow: 8dp main axis spacing, buttons aligned to the end.
   The button Box is padded start/end/bottom by DialogPadding (24dp). */
.track-dialog-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin: 0 24px 24px;
}
/* MD3 TextButton: height 40dp, min width 58dp, content padding 12dp horizontal,
   shape = CornerFull (20dp), label = labelLarge in primary. */
.track-dialog-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  height: 40px;
  padding: 0 12px;
  border: none;
  border-radius: 20px;
  background: transparent;
  font-family: var(--v-font-body, Roboto, sans-serif);
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.0071428571em;
  text-transform: none;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  overflow: hidden;
}
.track-dialog-button::after {
  content: '';
  position: absolute;
  inset: 0;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}
.track-dialog-button:hover::after { opacity: 0.08; }
.track-dialog-button:active::after { opacity: 0.12; }
.track-dialog-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.track-confirm {
  padding: 24px;
}
.track-confirm-icon {
  display: block;
  margin: 0 auto 16px;
  font-size: 24px;
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  color: rgb(var(--v-theme-secondary));
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
.track-confirm-title {
  margin: 0 0 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  text-align: center;
}
.track-confirm-text {
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface-variant));
  text-align: center;
}
.track-confirm-button--danger {
  padding: 0 24px;
  background: rgb(var(--v-theme-error-container)) !important;
  color: rgb(var(--v-theme-on-error-container)) !important;
}
</style>
