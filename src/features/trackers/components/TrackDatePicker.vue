<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    selection?: number | null
    title?: string
    kind?: 'start' | 'finish'
    serviceName?: string
    removable?: boolean
    min?: number | null
    max?: number | null
    counterpart?: number | null
  }>(),
  {
    selection: null,
    title: '',
    kind: 'start',
    serviceName: '',
    removable: false,
    min: null,
    max: null,
    counterpart: null,
  },
)

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'confirm', value: number): void
  (event: 'remove'): void
}>()

const dateMonth = ref(new Date())
const locale = computed(() => (typeof navigator !== 'undefined' && navigator.language) || 'en-US')

const MONTH_FIRST_LOCALES = ['ru', 'uk', 'be', 'bg', 'cs', 'da', 'de', 'el', 'es', 'et', 'fi', 'fr', 'hu', 'it', 'lt', 'lv', 'nl', 'no', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv', 'tr', 'zh', 'ja', 'ko', 'id', 'vi', 'th', 'he', 'ar']
function firstDayOfWeek(lang: string): number {
  try {
    const info = new Intl.Locale(lang).getWeekInfo?.()
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
    const counterpart = props.counterpart == null ? null : startOfDay(new Date(props.counterpart))
    let selectable = time <= today
    if (selectable && counterpart != null) {
      selectable = props.kind === 'finish' ? time >= counterpart : time <= counterpart
    }
    if (selectable && props.max != null) selectable = time <= startOfDay(new Date(props.max))
    if (selectable && props.min != null) selectable = time >= startOfDay(new Date(props.min))
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
  while (rows.length < 6) rows.push([null, null, null, null, null, null, null])
  return rows
})

const yearPickerOpen = ref(false)
const YEAR_MIN = 1900
const YEAR_MAX = 2100

function isSelectableYear(year: number): boolean {
  if (year > new Date().getFullYear()) return false
  const counterpart = props.counterpart == null ? null : new Date(props.counterpart)
  if (counterpart == null) return true
  return props.kind === 'finish'
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

watch(() => props.open, isOpen => {
  if (isOpen) {
    yearPickerOpen.value = false
    const today = startOfDay(new Date())
    const counterpart = props.counterpart == null ? null : startOfDay(new Date(props.counterpart))
    let defaultDate = today
    if (counterpart != null) {
      if (props.kind === 'start' && today > counterpart) {
        defaultDate = counterpart
      } else if (props.kind === 'finish' && today < counterpart) {
        defaultDate = counterpart
      }
    }
    datePicked.value = props.selection ?? defaultDate
    const base = new Date(datePicked.value)
    dateMonth.value = new Date(base.getFullYear(), base.getMonth(), 1)
  }
})

function confirm() {
  if (datePicked.value != null) {
    emit('confirm', datePicked.value)
  }
  emit('update:open', false)
}

function cancel() {
  emit('update:open', false)
}

const removeConfirmOpen = ref(false)

const removeConfirmText = computed(() => {
  const name = props.serviceName || 'the tracker'
  return props.kind === 'finish'
    ? `This will remove your previously selected finish date from ${name}`
    : `This will remove your previously selected start date from ${name}`
})

function requestRemove() {
  removeConfirmOpen.value = true
}

function confirmRemove() {
  removeConfirmOpen.value = false
  emit('update:open', false)
  emit('remove')
}

const computedTitle = computed(() => {
  if (props.title) return props.title
  return props.kind === 'finish' ? 'Finish date' : 'Start date'
})
</script>

<template>
  <v-dialog :model-value="open" width="360" max-width="560" :aria-label="computedTitle" @update:model-value="emit('update:open', $event)">
    <v-card class="track-dialog" rounded="28px" color="surface-container-high">
      <h2 class="track-dialog-title">{{ computedTitle }}</h2>

      <div class="track-date">
        <div class="track-date-calendar">
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
            <div class="track-date-nav">
              <button
                type="button"
                class="track-date-nav-btn"
                aria-label="Previous month"
                @click="shiftMonth(-1)"
              >
                <span class="material-symbols-rounded" aria-hidden="true">chevron_left</span>
              </button>
              <button
                type="button"
                class="track-date-nav-btn"
                aria-label="Next month"
                @click="shiftMonth(1)"
              >
                <span class="material-symbols-rounded" aria-hidden="true">chevron_right</span>
              </button>
            </div>
          </div>

          <div v-if="yearPickerOpen" class="track-date-years" role="grid">
            <div v-for="(row, rIdx) in yearRows" :key="rIdx" class="track-date-year-row">
              <button
                v-for="year in row"
                :key="year"
                :ref="year === dateMonth.getFullYear() ? (el) => { selectedYearRef = el as HTMLElement } : undefined"
                type="button"
                class="track-date-year"
                :class="{
                  'is-selected': year === dateMonth.getFullYear(),
                  'is-current': year === new Date().getFullYear(),
                }"
                :disabled="!isSelectableYear(year)"
                @click="selectYear(year)"
              >
                {{ year }}
              </button>
            </div>
          </div>

          <template v-else>
            <div class="track-date-weekdays" aria-hidden="true">
              <span v-for="(name, index) in weekdayNames" :key="index" class="track-date-weekday">
                {{ name }}
              </span>
            </div>

            <div class="track-date-grid" role="grid">
              <div v-for="(row, rIdx) in dateRows" :key="rIdx" class="track-date-row" role="row">
                <div v-for="(cell, cIdx) in row" :key="cIdx" class="track-date-cell" role="gridcell">
                  <button
                    v-if="cell"
                    type="button"
                    class="track-date-day"
                    :class="{
                      'is-selected': cell.selected,
                      'is-today': cell.today,
                      'is-disabled': !cell.selectable,
                    }"
                    :disabled="!cell.selectable"
                    :aria-label="`${cell.day}`"
                    @click="pickDate(cell)"
                  >
                    <span class="track-date-day-number">{{ cell.day }}</span>
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>

        <div class="track-date-actions">
          <button v-if="removable" type="button" class="track-dialog-button" @click="requestRemove">Remove</button>
          <span v-if="removable" class="track-date-spacer" />
          <button type="button" class="track-dialog-button" @click="cancel">Cancel</button>
          <button type="button" class="track-dialog-button" @click="confirm">OK</button>
        </div>
      </div>
    </v-card>
  </v-dialog>

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
.track-dialog-title {
  font-family: var(--v-font-heading, var(--v-font-body, Roboto, sans-serif));
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
  margin: 24px 24px 16px;
}
.track-date { display: flex; flex-direction: column; }
.track-date-calendar { display: flex; flex-direction: column; padding: 0 12px; }
.track-date-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 56px;
}
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
.track-date-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin: 8px 12px 24px;
}
.track-date-spacer { flex: 1 1 auto; }
.track-dialog-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin: 0 24px 24px;
}
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
