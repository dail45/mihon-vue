/**
 * History entry model and formatting helpers.
 *
 * Mirrors Mihon's `tachiyomi.domain.history.model.HistoryWithRelations` and the
 * `formatChapterNumber` / `toTimestampString` helpers used by
 * `eu.kanade.presentation.history.components.HistoryItem`.
 *
 * The Suwayomi REST API exposes no history endpoint, so entries are derived by
 * the caller (recent chapters feed) — this module only holds the shape and the
 * presentation helpers, never credentials or server state.
 */
export interface HistoryEntry {
  /** History row id (Mihon: HistoryWithRelations.id). */
  id: number
  /** Manga the row belongs to (Mihon: HistoryWithRelations.mangaId). */
  mangaId: number
  /** Last read chapter (Mihon: HistoryWithRelations.chapterId). */
  chapterId: number
  /** Displayed manga title (Mihon: HistoryWithRelations.title). */
  title: string
  /** Last read chapter number; values below -1 hide the "Ch. n" prefix (Mihon: chapterNumber). */
  chapterNumber: number
  /** Read timestamp in epoch milliseconds, or null when unknown (Mihon: readAt). */
  readAt: number | null
  /** True when the manga is in the library (Mihon: coverData.isMangaFavorite). */
  inLibrary: boolean
}

/**
 * Mihon: `eu.kanade.presentation.util.formatChapterNumber` uses
 * `DecimalFormat("#.###", decimalSeparator '.')`, which drops the leading zero
 * of values below 1 ("0.5" -> ".5") and keeps at most three decimals.
 */
export function formatChapterNumber(chapterNumber: number): string {
  if (!Number.isFinite(chapterNumber)) return ''
  const rounded = Number(chapterNumber.toFixed(3))
  const negative = rounded < 0
  const [integerPart, fractionPart] = Math.abs(rounded).toString().split('.')
  const trimmedInteger = integerPart === '0' ? '' : integerPart
  const text = fractionPart ? `${trimmedInteger}.${fractionPart}` : trimmedInteger || '0'
  return negative ? `-${text}` : text
}

/**
 * Mihon: `eu.kanade.tachiyomi.util.lang.toTimestampString` renders the local
 * time with `DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT)`, which is
 * the same short localized time `Intl.DateTimeFormat` produces.
 */
export function formatReadAt(timestamp: number | null | undefined): string {
  if (timestamp == null || !Number.isFinite(timestamp)) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(date)
}

/**
 * Mihon: `MR.strings.recent_manga_time` = "Ch. %1$s - %2$s" (base locale).
 */
export function formatRecentMangaTime(chapterNumber: number, readAt: string): string {
  return chapterNumber > -1 ? `Ch. ${formatChapterNumber(chapterNumber)} - ${readAt}` : readAt
}
