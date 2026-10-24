/**
 * Release-day estimation — a port of Mihon's local "smart update" schedule.
 *
 * Reference (Mihon @446f6df):
 *   domain/src/main/java/tachiyomi/domain/manga/interactor/ReleasePattern.kt
 *   domain/src/main/java/tachiyomi/domain/manga/interactor/ReleaseSchedule.kt
 *   domain/src/main/java/tachiyomi/domain/manga/interactor/FetchInterval.kt
 *
 * Mihon stores `state_chapter_next_update` per entry and derives it from the chapter
 * upload/fetch days with these classes. Suwayomi's REST v1 exposes no such field, so the
 * same estimate is recomputed in the client from the chapter dates the server does expose.
 *
 * Dates are handled as integer "epoch days" so that no time zone can shift a release day.
 */

/** Milliseconds in a day. */
const DAY_MS = 86_400_000
/** 1970-01-01 was a Thursday, so this offset maps an epoch day to a Monday-based weekday. */
const DOW_OFFSET = 3

export function toEpochDay(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS)
}
export function fromEpochDay(day: number): Date {
  const utc = new Date(day * DAY_MS)
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate())
}
/** Monday = 0 … Sunday = 6 (Kotlin's `DayOfWeek.isoDayNumber` is 1…7). */
export function weekdayIndex(day: number): number {
  return ((day + DOW_OFFSET) % 7 + 7) % 7
}
export function dayOfMonth(day: number): number {
  return fromEpochDay(day).getDate()
}
export function firstOfMonth(day: number): number {
  return day - (dayOfMonth(day) - 1)
}
export function daysInMonth(day: number): number {
  const date = fromEpochDay(firstOfMonth(day))
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}
export function lastOfMonth(day: number): number {
  return firstOfMonth(day) + daysInMonth(day) - 1
}
/** Kotlin's `Int.mod` for a positive modulus: always non-negative. */
function mod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}
function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0
}
function ceilDiv(a: number, b: number): number {
  return -Math.floor(-a / b)
}
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/* ------------------------------------------------------------------ patterns */

export type ReleasePattern =
  | { type: 'every'; days: number; onSchedule: number }
  | { type: 'weekdays'; days: number[] }
  | { type: 'batches'; every: number; onSchedule: number; length: number }
  | { type: 'daysOfMonth'; days: number[] }
  | { type: 'weekdayOfMonth'; week: number; dayOfWeek: number }

export const LAST_WEEK = -1

function nextAfter(pattern: ReleasePattern, day: number): number {
  switch (pattern.type) {
    case 'every': {
      const offset = mod(day - pattern.onSchedule, pattern.days)
      return day + (pattern.days - offset)
    }
    case 'weekdays': {
      let candidate = day + 1
      while (!pattern.days.includes(weekdayIndex(candidate))) candidate++
      return candidate
    }
    case 'batches': {
      const offset = mod(day - pattern.onSchedule, pattern.every)
      return day + (offset + 1 < pattern.length ? 1 : pattern.every - offset)
    }
    case 'daysOfMonth': {
      let month = firstOfMonth(day)
      for (let guard = 0; guard < 240; guard++) {
        const last = lastOfMonth(month)
        for (const dom of pattern.days.slice().sort((a, b) => a - b)) {
          const candidate = month + Math.min(dom, daysInMonth(month)) - 1
          if (candidate > day) return candidate
        }
        void last
        month = firstOfMonth(month + daysInMonth(month))
      }
      return day
    }
    case 'weekdayOfMonth': {
      let month = firstOfMonth(day)
      for (let guard = 0; guard < 240; guard++) {
        const candidate = weekdayOfMonthDay(month, pattern.week, pattern.dayOfWeek)
        if (candidate > day) return candidate
        month = firstOfMonth(month + daysInMonth(month))
      }
      return day
    }
  }
}

function previousBefore(pattern: ReleasePattern, day: number): number {
  switch (pattern.type) {
    case 'every': {
      const x = mod(day - pattern.onSchedule, pattern.days)
      return day - ((x - 1 + pattern.days) % pattern.days + 1)
    }
    case 'weekdays': {
      let candidate = day - 1
      while (!pattern.days.includes(weekdayIndex(candidate))) candidate--
      return candidate
    }
    case 'batches': {
      const dayBefore = day - 1
      const offset = mod(dayBefore - pattern.onSchedule, pattern.every)
      return dayBefore - Math.max(0, offset - pattern.length + 1)
    }
    case 'daysOfMonth': {
      let month = firstOfMonth(day)
      for (let guard = 0; guard < 240; guard++) {
        for (const dom of pattern.days.slice().sort((a, b) => b - a)) {
          const candidate = month + Math.min(dom, daysInMonth(month)) - 1
          if (candidate < day) return candidate
        }
        month = firstOfMonth(month - 1)
      }
      return day
    }
    case 'weekdayOfMonth': {
      let month = firstOfMonth(day)
      for (let guard = 0; guard < 240; month = firstOfMonth(month - 1)) {
        const candidate = weekdayOfMonthDay(month, pattern.week, pattern.dayOfWeek)
        if (candidate < day) return candidate
      }
      return day
    }
  }
}

/** WeekdayOfMonth.daysIn: the nth weekday of the month, or its last week. */
function weekdayOfMonthDay(month: number, week: number, dayOfWeek: number): number {
  if (week === LAST_WEEK) {
    const last = lastOfMonth(month)
    return last - mod(weekdayIndex(last) - dayOfWeek, 7)
  }
  const daysAhead = mod(dayOfWeek - weekdayIndex(month), 7)
  return month + daysAhead + (week - 1) * 7
}

/** The expected release day closest to `day`; a halfway release counts as late. */
function nearest(pattern: ReleasePattern, day: number): number {
  if (pattern.type === 'weekdays') return day
  const before = previousBefore(pattern, day + 1)
  const after = nextAfter(pattern, day - 1)
  return day - before <= after - day ? before : after
}

/* ------------------------------------------------------------------ detection */

const MIN_RELEASES = 4
const MAX_WEEKDAYS = 3
const COVERAGE = 0.8
const DAY_OF_MONTH_TOLERANCE = 3
const MONTHLY_GAPS = [26, 35]
const TWICE_MONTHLY_GAPS = [12, 18]
const BATCH_HISTORY = 40
const BATCH_GAP = 2
const BATCHES = 6
const MIN_BATCHES = 3

function mostCommon<T>(items: number[], selector: (value: number) => T): T | null {
  const counts = new Map<T, number>()
  for (const item of items) {
    const key = selector(item)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best: T | null = null
  let bestCount = 0
  for (const [key, count] of counts) {
    if (count > bestCount) { best = key; bestCount = count }
  }
  return bestCount >= items.length * COVERAGE ? best : null
}

export function detectPattern(days: number[], history: number[], medianGap: number): ReleasePattern | null {
  if (days.length < MIN_RELEASES) return null
  return detectBatches(history) ?? (
    medianGap >= MONTHLY_GAPS[0] && medianGap <= MONTHLY_GAPS[1] ? detectMonthly(days)
      : medianGap >= TWICE_MONTHLY_GAPS[0] && medianGap <= TWICE_MONTHLY_GAPS[1] ? detectTwiceMonthly(days)
        : detectWeekdays(days, medianGap)
  )
}

function detectMonthly(days: number[]): ReleasePattern | null {
  const doms = days.map(dayOfMonth)
  const max = Math.max(...doms), min = Math.min(...doms)
  if (max - min <= DAY_OF_MONTH_TOLERANCE) return { type: 'daysOfMonth', days: [median(doms)] }
  if (doms.every(value => value >= 28)) return { type: 'daysOfMonth', days: [31] }
  return detectWeekdayOfMonth(days)
}

function detectWeekdayOfMonth(days: number[]): ReleasePattern | null {
  const dayOfWeek = mostCommon(days, weekdayIndex)
  if (dayOfWeek === null) return null
  const week = mostCommon(days, day => Math.floor((dayOfMonth(day) - 1) / 7) + 1)
  if (week !== null && week < 5) return { type: 'weekdayOfMonth', week, dayOfWeek }
  const isLastWeek = days.filter(day => dayOfMonth(day) + 7 > daysInMonth(day)).length >= days.length * COVERAGE
  return isLastWeek ? { type: 'weekdayOfMonth', week: LAST_WEEK, dayOfWeek } : null
}

function detectTwiceMonthly(days: number[]): ReleasePattern | null {
  const doms = days.map(dayOfMonth).sort((a, b) => a - b)
  // The biggest gap between two days of the month splits them into two halves.
  let split = 1
  let biggestGap = doms[1]! - doms[0]!
  for (let index = 2; index < doms.length; index++) {
    const gap = doms[index]! - doms[index - 1]!
    if (gap > biggestGap) { biggestGap = gap; split = index }
  }
  const halves = [doms.slice(0, split), doms.slice(split)]
  if (halves.some(half => half.length < 2 || half[half.length - 1]! - half[0]! > DAY_OF_MONTH_TOLERANCE)) return null
  return { type: 'daysOfMonth', days: halves.map(half => median(half)) }
}

function detectWeekdays(days: number[], medianGap: number): ReleasePattern | null {
  const counts = new Map<number, number>()
  for (const day of days) {
    const dow = weekdayIndex(day)
    counts.set(dow, (counts.get(dow) ?? 0) + 1)
  }
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const weekdays: number[] = []
  let covered = 0
  for (const [dow, count] of ordered) {
    if (covered >= days.length * COVERAGE) break
    weekdays.push(dow)
    covered += count
  }
  if (weekdays.length < 2 || weekdays.length > MAX_WEEKDAYS) return null
  if (covered < days.length * COVERAGE) return null
  if (medianGap > Math.floor(7 / weekdays.length) + 1) return null
  return { type: 'weekdays', days: weekdays.sort((a, b) => a - b) }
}

function detectBatches(history: number[]): ReleasePattern | null {
  const runs: number[][] = []
  for (const day of history.slice(0, BATCH_HISTORY).reverse()) {
    const run = runs[runs.length - 1]
    // The run is built oldest day first, so the gap to the day being added is positive.
    if (run && day - run[run.length - 1]! <= BATCH_GAP) run.push(day)
    else runs.push([day])
  }
  const recent = runs.slice(-BATCHES)
  if (recent.length < MIN_BATCHES) return null
  if (recent.filter(run => run.length > 1).length * 2 < recent.length) return null
  const gaps: number[] = []
  for (let index = 1; index < recent.length; index++) {
    gaps.push(recent[index]![0]! - recent[index - 1]![0]!)
  }
  const every = median(gaps)
  // A run spans from its oldest day to its newest, inclusive.
  const length = median(recent.map(run => run[run.length - 1]! - run[0]! + 1))
  if (every < length * 2) return null
  if (gaps.some(gap => Math.abs(gap - every) > every / 4)) return null
  return { type: 'batches', every, onSchedule: recent[recent.length - 1]![0]!, length }
}

/* ------------------------------------------------------------------ schedule */

export interface ReleaseSchedule {
  /** Days between releases. */
  interval: number
  /** The most recent release day. */
  lastRelease: number | null
  pattern: ReleasePattern
  /** How late a release may still come. */
  lateness: number
  /** Lengths of earlier breaks in the release run. */
  pastBreaks: number[]
}

const DEFAULT_INTERVAL = 7
const HIATUS_CYCLES = 4
const MIN_RELEASES_HISTORY = 3
const FEW_CHAPTERS = 8
const FEW_CHAPTERS_RELEASES = 3
const RECENT_RELEASES = 10
const PHASE_RELEASES = 5
export const MAX_INTERVAL = 28

export interface ChapterDates {
  /** Epoch milliseconds of the chapter upload. */
  uploadDate: number
  /** Epoch milliseconds of the chapter fetch. */
  fetchedAt: number
}

/** ReleaseSchedule.estimate: derives the schedule from the recent release days. */
export function estimateSchedule(chapters: ChapterDates[], today: number): ReleaseSchedule {
  const recentReleases = chapters.length <= FEW_CHAPTERS ? FEW_CHAPTERS_RELEASES : RECENT_RELEASES
  const latestPlausibleDay = today + 1
  const releaseDays = (dates: number[]) => {
    const days = dates
      .filter(value => Number.isFinite(value) && value > 0)
      // The reference reads the day in the system time zone, so the local date is used.
      .map(value => toEpochDay(new Date(value)))
      .filter(day => day <= latestPlausibleDay)
    return [...new Set(days)].sort((a, b) => b - a)
  }
  const uploadDays = releaseDays(chapters.map(chapter => chapter.uploadDate))
  const fetchDays = releaseDays(chapters.map(chapter => chapter.fetchedAt))

  const history = uploadDays.length >= MIN_RELEASES_HISTORY ? uploadDays
    : fetchDays.length >= MIN_RELEASES_HISTORY ? fetchDays
      : null
  if (!history) {
    const lastRelease = uploadDays[0] ?? fetchDays[0] ?? null
    return { interval: DEFAULT_INTERVAL, lastRelease, pattern: { type: 'every', days: DEFAULT_INTERVAL, onSchedule: lastRelease ?? today }, lateness: 0, pastBreaks: [] }
  }

  const days = history.slice(0, recentReleases)
  const gaps: number[] = []
  for (let index = 1; index < days.length; index++) gaps.push(days[index - 1]! - days[index]!)
  const sortedGaps = gaps.slice().sort((a, b) => a - b)
  const medianGap = sortedGaps[Math.floor((sortedGaps.length - 1) / 2)] ?? DEFAULT_INTERVAL
  const detected = detectPattern(days, history, medianGap)
  const interval = clamp(detected?.type === 'batches' ? detected.every : medianGap, 1, MAX_INTERVAL)
  const pastBreaks: number[] = []
  for (let index = 1; index < history.length; index++) {
    const gap = history[index - 1]! - history[index]!
    if (gap > interval * HIATUS_CYCLES) pastBreaks.push(gap)
  }
  return {
    interval,
    lastRelease: days[0] ?? null,
    pattern: detected ?? { type: 'every', days: interval, onSchedule: medianPhase(days.slice(0, PHASE_RELEASES), interval) },
    lateness: clamp((sortedGaps[sortedGaps.length - 1] ?? 0) - interval, 0, Math.floor(interval / 2)),
    pastBreaks,
  }
}

/** The release day in the run that the others land closest to. */
function medianPhase(days: number[], interval: number): number {
  if (!days.length) return 0
  const offset = (from: number, to: number) => {
    const raw = mod(to - from, interval)
    return Math.min(raw, interval - raw)
  }
  let phase = days[0]!
  let best = Infinity
  for (const candidate of days) {
    const sum = days.reduce((total, day) => total + offset(candidate, day), 0)
    if (sum < best) { best = sum; phase = candidate }
  }
  const onPhase = days.filter(day => offset(phase, day) === 0).length
  return onPhase * 5 >= days.length * 3 ? phase : days[0]!
}

/**
 * The next day to check for a release, as of `today`. Today counts, so a due release keeps
 * being checked for. This is the day the Upcoming screen plots.
 */
export function nextCheck(schedule: ReleaseSchedule, today: number): number {
  const { interval, lastRelease, pattern, lateness, pastBreaks } = schedule
  const anchor = lastRelease ?? today
  const daysSinceRelease = today - anchor
  if (daysSinceRelease > interval * HIATUS_CYCLES) {
    const nearBreak = pastBreaks.some(breakLength => daysSinceRelease >= breakLength - interval && daysSinceRelease <= breakLength + interval)
    if (!nearBreak) {
      const backedOff = backOff(daysSinceRelease, interval)
      const next = anchor + ceilDiv(daysSinceRelease, backedOff) * backedOff
      const breakEnd = pastBreaks
        .map(breakLength => anchor + breakLength - interval)
        .filter(value => value > today)
        .sort((a, b) => a - b)[0]
      return Math.min(next, breakEnd ?? next)
    }
  }
  const due = nextAfter(pattern, nearest(pattern, anchor))
  if (today >= due && today <= due + lateness) return today
  let candidate = due
  for (let guard = 0; guard < 400 && candidate < today; guard++) candidate = nextAfter(pattern, candidate)
  return Math.min(candidate, today + MAX_INTERVAL)
}

function backOff(daysSinceRelease: number, interval: number): number {
  let backedOff = interval
  while (backedOff < MAX_INTERVAL && daysSinceRelease > backedOff * HIATUS_CYCLES) backedOff *= 2
  return Math.min(backedOff, MAX_INTERVAL)
}
