import type { Category, Chapter, Manga, Source } from '../src/api/types'
// Synthetic test data only. Never shipped or used as an offline fallback.
export const source: Source = { id: '9223372036854775806', name: 'Test source', displayName: 'Test source', lang: 'en', iconUrl: '', supportsLatest: true, isConfigurable: false, isNsfw: false, baseUrl: 'https://example.invalid' }
export function category(id: number, name: string, order = 0): Category { return { id, name, order, default: false, includeInUpdate: -1, includeInDownload: -1, isDefaultCategory: id === 4, version: 0, uid: id, lastModifiedAt: 0 } }
export function manga(id: number, title = 'Sample title', unreadCount = 3): Manga { return {
  id, sourceId: source.id, title, url: '/test', thumbnailUrl: null, thumbnailUrlLastFetched: 0,
  initialized: true, artist: null, author: 'Sample author', description: 'Synthetic test description. This is not a real manga.',
  genre: ['Adventure', 'Fantasy'], status: 'ONGOING', inLibrary: true, inLibraryAt: 0, source,
  realUrl: 'https://example.invalid', lastFetchedAt: 0, chaptersLastFetchedAt: 0,
  updateStrategy: 'ALWAYS_UPDATE', freshData: false, unreadCount, downloadCount: 1,
  chapterCount: 8, lastReadAt: null, lastChapterRead: null, age: 0, chaptersAge: 0,
  trackers: null, lastModifiedAt: 0, version: 0,
} }
export const chapter: Chapter = { id: 109, url: '/chapter', name: 'Chapter 1', uploadDate: 1700000000000, chapterNumber: 1, scanlator: 'Test group', mangaId: 1, read: false, bookmarked: false, lastPageRead: 0, lastReadAt: 0, index: 7, fetchedAt: 0, realUrl: null, downloaded: false, pageCount: 10, lastModifiedAt: 0, version: 0, chapterCount: 1 }
