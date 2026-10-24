/**
 * Auto-Webtoon heuristic detection helper.
 *
 * References:
 * - Komikku: exh/util/MangaType.kt (isWebtoonTag, isManhwaTag, isManhuaTag, mangaType)
 * - Komikku: eu/kanade/tachiyomi/ui/reader/ReaderViewModel.kt (getMangaReadingMode)
 * - TachiyomiSY: MangaType.kt
 *
 * Checks if a manga's genres or tags contain common webtoon / continuous strip keywords
 * so the reader can automatically activate Long strip mode when reading mode is 'default'.
 */
import type { Manga } from '@/core/api/types'

export const WEBTOON_GENRE_KEYWORDS = [
  'webtoon',
  'long strip',
  'manhwa',
  'manhua',
  'манхва',
  'маньхуа',
] as const

/**
 * Checks if a single genre or tag matches any of the webtoon keywords (case-insensitive).
 */
export function isWebtoonGenre(genre: string): boolean {
  if (!genre || typeof genre !== 'string') return false
  const lower = genre.toLowerCase().trim()
  return WEBTOON_GENRE_KEYWORDS.some(keyword => lower.includes(keyword))
}

/**
 * Checks if any genre or tag of the manga matches any webtoon keyword.
 */
export function isWebtoonManga(manga?: Manga | null): boolean {
  if (!manga) return false

  if (Array.isArray(manga.genre)) {
    if (manga.genre.some(tag => isWebtoonGenre(tag))) {
      return true
    }
  } else if (typeof (manga as unknown as { genre?: string }).genre === 'string') {
    const raw = (manga as unknown as { genre: string }).genre
    if (isWebtoonGenre(raw)) {
      return true
    }
  }

  // Also check source name if available (as in Komikku MangaType.isWebtoonSource)
  const sourceName = manga.source?.name
  if (sourceName && typeof sourceName === 'string') {
    const sLower = sourceName.toLowerCase()
    if (
      sLower.includes('webtoon') ||
      sLower.includes('manhwa') ||
      sLower.includes('manhua') ||
      sLower.includes('toomics') ||
      sLower.includes('mangatoon')
    ) {
      return true
    }
  }

  return false
}

/**
 * Evaluates whether auto-webtoon heuristic should apply.
 */
export function shouldAutoWebtoon(manga?: Manga | null, userAutoWebtoonPref = true): boolean {
  if (!userAutoWebtoonPref) return false
  return isWebtoonManga(manga)
}
