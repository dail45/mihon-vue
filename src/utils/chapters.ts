import type { Chapter } from '../api/types'
import { matchesTriState, type TriState } from './library'
export type ChapterSortType = 'source' | 'number' | 'uploaded' | 'title'
export interface ChapterSettings { downloaded: TriState; unread: TriState; bookmarked: TriState; sort: ChapterSortType; descending: boolean; display: 'title' | 'number' }
export const defaultChapterSettings = (): ChapterSettings => ({ downloaded: 'all', unread: 'all', bookmarked: 'all', sort: 'source', descending: true, display: 'title' })
export const chapterSortOptions = [{ value: 'source', label: 'By source' }, { value: 'number', label: 'By chapter number' }, { value: 'uploaded', label: 'By upload date' }, { value: 'title', label: 'Alphabetically' }] as const
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: false })
export function sortChapters(chapters: Chapter[], settings: ChapterSettings, downloadedOnly = false, query = '') {
  return chapters.filter(c => c.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && matchesTriState(c.downloaded, downloadedOnly ? 'include' : settings.downloaded) && matchesTriState(!c.read, settings.unread) && matchesTriState(c.bookmarked, settings.bookmarked))
    .sort((a, b) => {
      const result = settings.sort === 'source' ? a.index - b.index : settings.sort === 'number' ? a.chapterNumber - b.chapterNumber : settings.sort === 'uploaded' ? a.uploadDate - b.uploadDate : collator.compare(a.name, b.name)
      return settings.descending ? -result : result
    })
}
export function chapterTitle(chapter: Chapter, display: ChapterSettings['display']) { return display === 'title' ? chapter.name : chapter.chapterNumber >= 0 ? `Chapter ${chapter.chapterNumber}` : 'Chapter number unknown' }
