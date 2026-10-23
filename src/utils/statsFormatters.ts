/**
 * Statistics formatting utilities.
 *
 * References:
 *   - eu/kanade/presentation/util/TimeUtils.kt (`toDurationString`)
 *   - eu/kanade/presentation/more/stats/StatsScreenContent.kt (`meanScoreStr`)
 */

/**
 * Formats duration in milliseconds into a localized string matching
 * `eu/kanade/presentation/util/TimeUtils.kt:toDurationString`:
 * - days: %dd
 * - hours: %dh
 * - minutes: %dm (if days == 0 || hours == 0)
 * - seconds: %ds (if days == 0 && hours == 0)
 * - fallback: MR.strings.none ("None")
 */
export function formatDuration(ms: number, fallback = 'None'): string {
  if (ms <= 0) return fallback
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (days !== 0) parts.push(`${days}d`)
  if (hours !== 0) parts.push(`${hours}h`)
  if (minutes !== 0 && (days === 0 || hours === 0)) parts.push(`${minutes}m`)
  if (seconds !== 0 && days === 0 && hours === 0) parts.push(`${seconds}s`)

  return parts.length > 0 ? parts.join(' ') : fallback
}

/**
 * Formats tracker mean score matching `StatsScreenContent.kt`:
 * `if (data.trackedTitleCount > 0 && !data.meanScore.isNaN()) "%.2f ★".format(Locale.ENGLISH, data.meanScore) else "N/A"`
 */
export function formatMeanScore(trackedTitleCount: number, meanScore: number | null): string {
  if (trackedTitleCount > 0 && meanScore !== null && !Number.isNaN(meanScore)) {
    return `${meanScore.toFixed(2)} ★`
  }
  return 'N/A'
}
