import type { Chapter } from '../api/types'
import { matchesTriState, type TriState } from './library'
import { isChapterExcluded, loadExcludedScanlators, saveExcludedScanlators } from './scanlatorFilter'
export type ChapterSortType = 'source' | 'number' | 'uploaded' | 'title'
export interface ChapterSettings { downloaded: TriState; unread: TriState; bookmarked: TriState; sort: ChapterSortType; descending: boolean; display: 'title' | 'number' }
export const defaultChapterSettings = (): ChapterSettings => ({ downloaded: 'all', unread: 'all', bookmarked: 'all', sort: 'source', descending: true, display: 'title' })
export const chapterSortOptions = [{ value: 'source', label: 'By source' }, { value: 'number', label: 'By chapter number' }, { value: 'uploaded', label: 'By upload date' }, { value: 'title', label: 'Alphabetically' }] as const
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: false })

/**
 * Mihon applies the scanlator filter of the opened manga to its chapter list
 * (`MangaViewModel` -> `getMangaWithChapters.applyScanlatorFilter = true`).
 *
 * The excluded set is a per-manga setting of the Mihon database; the Suwayomi REST contract has
 * no such field, so the web client keeps it in browser storage (utils/scanlatorFilter.ts) and
 * remembers which manga is currently open, so that the chapter list can apply it.
 */
let scanlatorContext: { apiUrl: string; mangaId: number } | null = null

/** Points the chapter list at the manga whose excluded scanlator set applies. */
export function setChapterScanlatorContext(apiUrl: string, mangaId: number) {
  scanlatorContext = { apiUrl, mangaId }
}

/** The excluded scanlator set of the manga that is currently open. */
export function excludedScanlators(): string[] {
  return scanlatorContext ? loadExcludedScanlators(scanlatorContext.apiUrl, scanlatorContext.mangaId) : []
}

/** Stores the excluded scanlator set of a manga in browser storage. */
export function setExcludedScanlators(apiUrl: string, mangaId: number, excluded: readonly string[]) {
  saveExcludedScanlators(apiUrl, mangaId, excluded)
}

export function sortChapters(chapters: Chapter[], settings: ChapterSettings, downloadedOnly = false, query = '') {
  const excluded = scanlatorContext ? loadExcludedScanlators(scanlatorContext.apiUrl, scanlatorContext.mangaId) : []
  return chapters.filter(c => c.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && matchesTriState(c.downloaded, downloadedOnly ? 'include' : settings.downloaded) && matchesTriState(!c.read, settings.unread) && matchesTriState(c.bookmarked, settings.bookmarked) && !isChapterExcluded(c, excluded))
    .sort((a, b) => {
      const result = settings.sort === 'source' ? a.index - b.index : settings.sort === 'number' ? a.chapterNumber - b.chapterNumber : settings.sort === 'uploaded' ? a.uploadDate - b.uploadDate : collator.compare(a.name, b.name)
      return settings.descending ? -result : result
    })
}
/**
 * Mihon's `ChapterNumberFormatter.formatChapterNumber` = `DecimalFormat("#.###")`:
 * at most three decimals, no trailing zeros ("1.5", "2", "1.25").
 */
export function formatChapterNumber(chapterNumber: number): string {
  if (!Number.isFinite(chapterNumber)) return '0'
  return new Intl.NumberFormat('en-US', { useGrouping: false, minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(chapterNumber)
}

/** Mihon: `stringResource(MR.strings.display_mode_chapter, formatChapterNumber(chapterNumber))`. */
export function chapterTitle(chapter: Chapter, display: ChapterSettings['display']) {
  if (display === 'title') return chapter.name
  if (chapter.chapterNumber === -1) return 'Chapter number unknown'
  return `Chapter ${formatChapterNumber(chapter.chapterNumber)}`
}
