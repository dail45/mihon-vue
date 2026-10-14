import type { Chapter, Manga, Source } from '../api/types'
export type TriState = 'all' | 'include' | 'exclude'
export type LibrarySortType = 'title' | 'total' | 'lastRead' | 'unread' | 'latestChapter' | 'chapterFetched' | 'added' | 'random'
export interface LibrarySort { type: LibrarySortType; descending: boolean; seed: number }
export interface LibraryFilters { downloaded: TriState; unread: TriState; started: TriState; bookmarked: TriState; completed: TriState }
export interface ChapterSummary { bookmarked: boolean; started: boolean; latestUpload: number; fetchedAt: number; lastRead: number; nextUnread: number | null }
export const defaultFilters = (): LibraryFilters => ({ downloaded: 'all', unread: 'all', started: 'all', bookmarked: 'all', completed: 'all' })
export const defaultSort = (): LibrarySort => ({ type: 'title', descending: false, seed: 0 })
export const librarySortOptions: { value: LibrarySortType; label: string }[] = [
  { value: 'title', label: 'Alphabetically' }, { value: 'total', label: 'Total chapters' }, { value: 'lastRead', label: 'Last read' },
  { value: 'unread', label: 'Unread chapters' }, { value: 'latestChapter', label: 'Latest chapter' },
  { value: 'chapterFetched', label: 'Chapter fetch date' }, { value: 'added', label: 'Date added' }, { value: 'random', label: 'Random' },
]
export const nextTriState = (value: TriState): TriState => value === 'all' ? 'include' : value === 'include' ? 'exclude' : 'all'
export function matchesTriState(value: boolean | null, state: TriState) { return state === 'all' || (value !== null && value === (state === 'include')) }
export function summarizeChapters(chapters: Chapter[]): ChapterSummary {
  const summary: ChapterSummary = { bookmarked: false, started: false, latestUpload: 0, fetchedAt: 0, lastRead: 0, nextUnread: null }
  // No argument spreading or full sort: large libraries may have thousands of chapters.
  for (const c of chapters) {
    summary.bookmarked ||= c.bookmarked; summary.started ||= c.read
    summary.latestUpload = Math.max(summary.latestUpload, c.uploadDate || 0)
    summary.fetchedAt = Math.max(summary.fetchedAt, c.fetchedAt || 0)
    summary.lastRead = Math.max(summary.lastRead, c.lastReadAt || 0)
    if (!c.read && (summary.nextUnread === null || c.index < summary.nextUnread)) summary.nextUnread = c.index
  }
  return summary
}
export function sourceOf(manga: Manga, sources: Source[]) { return manga.source || sources.find(s => s.id === manga.sourceId) }
export function isLocal(manga: Manga, sources: Source[]) { return sourceOf(manga, sources)?.lang === 'localsourcelang' }
const finite = (n: unknown): number | null => typeof n === 'number' && Number.isFinite(n) ? n : null
export function matchesLibrary(manga: Manga, filters: LibraryFilters, downloadedOnly: boolean, summary?: ChapterSummary, sources: Source[] = []) {
  const unread = finite(manga.unreadCount), total = finite(manga.chapterCount), downloads = finite(manga.downloadCount)
  const started = summary?.started ?? (unread !== null && total !== null ? total > unread : null)
  const downloaded = isLocal(manga, sources) ? true : downloads === null ? null : downloads > 0
  return matchesTriState(downloaded, downloadedOnly ? 'include' : filters.downloaded)
    && matchesTriState(unread === null ? null : unread > 0, filters.unread)
    && matchesTriState(started, filters.started) && matchesTriState(summary?.bookmarked ?? null, filters.bookmarked)
    // PUBLISHING_FINISHED is a separate upstream status, not COMPLETED.
    && matchesTriState(manga.status === 'COMPLETED', filters.completed)
}
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: false })
export const compareTitles = (a: Manga, b: Manga) => collator.compare(a.title, b.title)
function randomRank(id: number, seed: number) { let n = (id ^ seed) | 0; n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return (n ^ (n >>> 16)) >>> 0 }
/** Mihon reverses the PRIMARY comparator only, then breaks ties alphabetically ascending. */
export function sortLibrary(items: Manga[], sort: LibrarySort, summaries: Record<number, ChapterSummary> = {}): Manga[] {
  const value = (m: Manga) => {
    switch (sort.type) {
      case 'total': return finite(m.chapterCount)
      case 'unread': return finite(m.unreadCount)
      case 'lastRead': return finite(m.lastReadAt) ?? summaries[m.id]?.lastRead ?? null
      case 'latestChapter': return summaries[m.id]?.latestUpload ?? null
      case 'chapterFetched': return summaries[m.id]?.fetchedAt ?? null
      case 'added': return finite(m.inLibraryAt)
      default: return null
    }
  }
  return items.slice().sort((a, b) => {
    if (sort.type === 'random') return randomRank(a.id, sort.seed) - randomRank(b.id, sort.seed) || compareTitles(a, b)
    if (sort.type === 'title') return (sort.descending ? -1 : 1) * compareTitles(a, b)
    const av = value(a), bv = value(b)
    // REST nullable values are unknown, not zeros; keep them last in BOTH directions.
    if (av === null || bv === null) return av === bv ? compareTitles(a, b) : av === null ? 1 : -1
    // Mihon keeps fully-read titles after unread titles in BOTH directions.
    if (sort.type === 'unread' && (av === 0 || bv === 0) && av !== bv) return av === 0 ? 1 : -1
    return (sort.descending ? bv - av : av - bv) || compareTitles(a, b)
  })
}
