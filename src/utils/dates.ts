/** Chapter.fetchedAt uses epoch seconds, unlike uploadDate's milliseconds. */
export function fetchedDateKey(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'unknown'
  const date = new Date(seconds * 1000)
  if (!Number.isFinite(date.getTime())) return 'unknown'
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}
/**
 * Mihon's `relativeTimeSpanString` (eu/kanade/presentation/util/TimeUtils.kt):
 * "Never" for a non-positive timestamp, "Just now" under a minute, else the
 * Android `DateUtils.getRelativeTimeSpanString(epochMillis, now, DateUtils.MINUTE_IN_MILLIS)`.
 *
 * Supports both epoch seconds (~1.7e9) and epoch milliseconds (~1.7e12).
 */
export function relativeTimeSpanString(epochSecondsOrMillis: number, now = Date.now()): string {
  if (!Number.isFinite(epochSecondsOrMillis) || epochSecondsOrMillis <= 0) return 'Never'
  const timeMillis = epochSecondsOrMillis > 1e11 ? epochSecondsOrMillis : epochSecondsOrMillis * 1000
  const diff = now - timeMillis
  const elapsed = Math.abs(diff)
  if (elapsed < 60_000) return 'Just now'
  if (elapsed < 3_600_000) {
    const minutes = Math.floor(elapsed / 60_000)
    const noun = minutes === 1 ? 'minute' : 'minutes'
    return diff >= 0 ? `${minutes} ${noun} ago` : `in ${minutes} ${noun}`
  }
  if (elapsed < 86_400_000) {
    const hours = Math.floor(elapsed / 3_600_000)
    const noun = hours === 1 ? 'hour' : 'hours'
    return diff >= 0 ? `${hours} ${noun} ago` : `in ${hours} ${noun}`
  }
  if (elapsed < 604_800_000) {
    const days = Math.floor(elapsed / 86_400_000)
    const noun = days === 1 ? 'day' : 'days'
    return diff >= 0 ? `${days} ${noun} ago` : `in ${days} ${noun}`
  }
  // Android DateUtils.getRelativeTimeSpanString falls back to formatDateRange
  // with FORMAT_SHOW_DATE | FORMAT_SHOW_YEAR | FORMAT_ABBREV_MONTH for spans >= 1 week.
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(timeMillis))
}

/** Most recent chapter fetch in the feed, in epoch seconds; 0 when unknown. */
export function latestFetchedAt(secondsList: number[]): number {
  let latest = 0
  for (const value of secondsList) if (Number.isFinite(value) && value > latest) latest = value
  return latest
}

/** Local calendar day of a date, as YYYY-MM-DD. */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** DateTimeFormatter.ofLocalizedDate(SHORT) (eu/kanade/domain/ui/UiPreferences.kt). */
export function shortDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { year: '2-digit', month: 'numeric', day: 'numeric' }).format(date)
}

/**
 * Mihon's `relativeDateText` (eu/kanade/presentation/components/DateText.kt) ->
 * `LocalDate.toRelativeString` (eu/kanade/tachiyomi/util/lang/DateExtensions.kt):
 *   difference = this.daysUntil(today)
 *   difference < -7 -> short date format
 *   difference <  0 -> plurals.upcoming_relative_time ("Tomorrow" / "In %1$d days")
 *   difference <  1 -> strings.relative_time_today ("Today")
 *   difference <  7 -> plurals.relative_time ("Yesterday" / "%1$d days ago")
 *   else            -> short date format
 */
export function relativeDateText(date: Date, today = new Date()): string {
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const difference = Math.round((midnight.getTime() - todayMidnight.getTime()) / 86400000)
  if (difference < -7) return shortDate(date)
  if (difference < 0) return difference === -1 ? 'Tomorrow' : `In ${-difference} days`
  if (difference < 1) return 'Today'
  if (difference < 7) return difference === 1 ? 'Yesterday' : `${difference} days ago`
  return shortDate(date)
}

export function fetchedDateLabel(seconds: number): string {
  if (fetchedDateKey(seconds) === 'unknown') return 'Date unknown'
  return relativeDateText(new Date(seconds * 1000))
}
