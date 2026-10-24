/**
 * Helpers backing `ReaderPageIndicator.vue`.
 *
 * Direct port of the logic in
 * `mihon/app/src/main/java/eu/kanade/presentation/reader/ReaderPageIndicator.kt`
 * (Mihon 446f6df8):
 *
 *   if (currentPage <= 0 || totalPages <= 0) return
 *   val text = "$currentPage / $totalPages"
 *
 * The composable draws two copies of that text — a stroked one behind and a filled one
 * in front — inside a centred `Box`. The visual constants (12sp bold, 1sp letter
 * spacing, `#EBEBEB` fill, `#2D2D2D` 4px stroke) live in the component stylesheet.
 */

/**
 * Whether the indicator is drawn at all.
 * Kotlin: `if (currentPage <= 0 || totalPages <= 0) return`.
 */
export function isPageIndicatorVisible(currentPage: number, totalPages: number): boolean {
  return currentPage > 0 && totalPages > 0
}

/**
 * The indicator label.
 * Kotlin: `val text = "$currentPage / $totalPages"`.
 */
export function pageIndicatorLabel(currentPage: number, totalPages: number): string {
  return `${currentPage} / ${totalPages}`
}

/** Fill colour of the foreground text: `Color(235, 235, 235)`. */
export const PAGE_INDICATOR_FILL_COLOR = '#ebebeb'

/** Colour of the outline stroke: `Color(45, 45, 45)`. */
export const PAGE_INDICATOR_STROKE_COLOR = '#2d2d2d'

/** Outline width in pixels: `Stroke(width = 4f)`. */
export const PAGE_INDICATOR_STROKE_WIDTH = 4

/** Font size in sp: `MaterialTheme.typography.bodySmall.fontSize`. */
export const PAGE_INDICATOR_FONT_SIZE = 12

/** Letter spacing in sp: `letterSpacing = 1.sp`. */
export const PAGE_INDICATOR_LETTER_SPACING = 1

/**
 * Local preference key backing the `pref_show_page_number_key` switch.
 * Kotlin: `eu/kanade/tachiyomi/ui/reader/setting/ReaderPreferences.kt:42`
 * (`preferenceStore.getBoolean("pref_show_page_number_key", true)`).
 * The web build stores it as the string `'true'`/`'false'`.
 */
export const SHOW_PAGE_NUMBER_PREF_KEY = 'mihon.reader.showPageNumber'

/**
 * Whether the page indicator may be drawn.
 *
 * Kotlin: `ReaderActivity.kt:261` draws the indicator only when
 * `!state.menuVisible && showPageNumber`. The menu visibility is owned by the reader
 * view; this helper covers the preference half.
 */
export function isPageNumberEnabled(stored: string | null): boolean {
  return stored === null ? true : stored === 'true'
}
