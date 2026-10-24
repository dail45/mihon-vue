import type { Category, Chapter, Manga, Source } from '../api/types'

export type TriState = 'all' | 'include' | 'exclude'
export type LibraryGroupMode = 0 | 1 | 2 | 3 | 4 // 0: Default, 1: Source, 2: Status, 3: Track, 4: Ungrouped

export const LIBRARY_GROUP = {
  BY_DEFAULT: 0,
  BY_SOURCE: 1,
  BY_STATUS: 2,
  BY_TRACK_STATUS: 3,
  UNGROUPED: 4,
} as const

export interface VirtualCategory extends Category {
  isVirtual: boolean
}

export type LibrarySortType =
  | 'title'
  | 'total'
  | 'lastRead'
  | 'lastUpdate'
  | 'unread'
  | 'latestChapter'
  | 'chapterFetched'
  | 'added'
  | 'trackerScore'
  | 'random'
  | 'tagList'

export interface LibrarySort {
  type: LibrarySortType
  descending: boolean
  seed: number
}

export interface LibraryFilters {
  downloaded: TriState
  unread: TriState
  started: TriState
  bookmarked: TriState
  completed: TriState
  tracking?: Record<number, TriState>
  filterCategories?: boolean
  filterCategoriesInclude?: number[]
  filterCategoriesExclude?: number[]
  categories?: boolean
  categoriesInclude?: number[]
  categoriesExclude?: number[]
}

export interface ChapterSummary {
  bookmarked: boolean
  started: boolean
  latestUpload: number
  fetchedAt: number
  lastRead: number
  nextUnread: number | null
}

export const defaultFilters = (): LibraryFilters => ({
  downloaded: 'all',
  unread: 'all',
  started: 'all',
  bookmarked: 'all',
  completed: 'all',
})

export const defaultSort = (): LibrarySort => ({ type: 'title', descending: false, seed: 0 })

export const librarySortOptions: { value: LibrarySortType; label: string }[] = [
  { value: 'title', label: 'Alphabetically' },
  { value: 'total', label: 'Total chapters' },
  { value: 'lastRead', label: 'Last read' },
  { value: 'lastUpdate', label: 'Last update check' },
  { value: 'unread', label: 'Unread count' },
  { value: 'latestChapter', label: 'Latest chapter' },
  { value: 'chapterFetched', label: 'Chapter fetch date' },
  { value: 'added', label: 'Date added' },
  { value: 'random', label: 'Random' },
]

export const nextTriState = (value: TriState): TriState =>
  value === 'all' ? 'include' : value === 'include' ? 'exclude' : 'all'

export function matchesTriState(value: boolean | null, state: TriState) {
  return state === 'all' || (value !== null && value === (state === 'include'))
}

export function summarizeChapters(chapters: Chapter[]): ChapterSummary {
  const summary: ChapterSummary = {
    bookmarked: false,
    started: false,
    latestUpload: 0,
    fetchedAt: 0,
    lastRead: 0,
    nextUnread: null,
  }
  // No argument spreading or full sort: large libraries may have thousands of chapters.
  for (const c of chapters) {
    summary.bookmarked ||= c.bookmarked
    summary.started ||= c.read
    summary.latestUpload = Math.max(summary.latestUpload, c.uploadDate || 0)
    summary.fetchedAt = Math.max(summary.fetchedAt, c.fetchedAt || 0)
    summary.lastRead = Math.max(summary.lastRead, c.lastReadAt || 0)
    if (!c.read && (summary.nextUnread === null || c.index < summary.nextUnread)) {
      summary.nextUnread = c.index
    }
  }
  return summary
}

export function sourceOf(manga: Manga, sources: Source[]) {
  return manga.source || sources.find(s => s.id === manga.sourceId)
}

/** Mihon: `Manga.isLocal()` is `source == LocalSource.ID` (0). Suwayomi's local source is id "0", lang "localsourcelang". */
export function isLocal(manga: Manga, sources: Source[]) {
  const source = sourceOf(manga, sources)
  return !!source && (source.id === '0' || source.lang === 'localsourcelang')
}

const finite = (n: unknown): number | null =>
  typeof n === 'number' && Number.isFinite(n) ? n : null

export function matchesLibrary(
  manga: Manga,
  filters: LibraryFilters,
  downloadedOnly: boolean,
  summary?: ChapterSummary,
  sources: Source[] = [],
  mangaCategories?: number[],
) {
  const unread = finite(manga.unreadCount),
    total = finite(manga.chapterCount),
    downloads = finite(manga.downloadCount)
  const started = summary?.started ?? (unread !== null && total !== null ? total > unread : null)
  const downloaded = isLocal(manga, sources) ? true : downloads === null ? null : downloads > 0
  if (filters.tracking) {
    for (const [trackerIdStr, state] of Object.entries(filters.tracking)) {
      if (state === 'all') continue
      const trackerId = Number(trackerIdStr)
      const hasTracker = manga.trackers?.some(t => t.id === trackerId && t.record !== null) ?? false
      if (!matchesTriState(hasTracker, state)) return false
    }
  }

  // 3.5 Categories Tri-State Filter Dialog (Komikku LibraryScreenModel.kt:516-530)
  const isCategoryFilterActive = filters.filterCategories ?? filters.categories ?? false
  if (isCategoryFilterActive) {
    const included = filters.filterCategoriesInclude ?? filters.categoriesInclude ?? []
    const excluded = filters.filterCategoriesExclude ?? filters.categoriesExclude ?? []
    const catList = mangaCategories ?? (manga as { categories?: number[] }).categories ?? []
    const catSet = new Set(catList)

    if (catSet.size === 0) {
      if (included.length > 0) return false
    } else {
      if (excluded.some(id => catSet.has(id))) return false
      if (included.length > 0 && !included.every(id => catSet.has(id))) return false
    }
  }

  return (
    matchesTriState(downloaded, downloadedOnly ? 'include' : filters.downloaded) &&
    matchesTriState(unread === null ? null : unread > 0, filters.unread) &&
    matchesTriState(started, filters.started) &&
    matchesTriState(summary?.bookmarked ?? null, filters.bookmarked) &&
    matchesTriState(manga.status === 'COMPLETED', filters.completed)
  )
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: false })
export const compareTitles = (a: Manga, b: Manga) => collator.compare(a.title, b.title)

function randomRank(id: number, seed: number) {
  let n = (id ^ seed) | 0
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  return (n ^ (n >>> 16)) >>> 0
}

/** Mihon reverses the PRIMARY comparator only, then breaks ties alphabetically ascending. */
export function sortLibrary(
  items: Manga[],
  sort: LibrarySort,
  summaries: Record<number, ChapterSummary> = {},
  sortTags: string[] = [],
): Manga[] {
  const value = (m: Manga) => {
    switch (sort.type) {
      case 'total':
        return finite(m.chapterCount)
      case 'unread':
        return finite(m.unreadCount)
      case 'lastRead':
        return finite(m.lastReadAt) ?? summaries[m.id]?.lastRead ?? null
      case 'lastUpdate':
        return finite(m.lastFetchedAt) ?? finite(m.chaptersLastFetchedAt) ?? finite(m.lastModifiedAt)
      case 'latestChapter':
        return summaries[m.id]?.latestUpload ?? null
      case 'chapterFetched':
        return summaries[m.id]?.fetchedAt ?? null
      case 'added':
        return finite(m.inLibraryAt)
      case 'trackerScore': {
        if (!m.trackers || m.trackers.length === 0) return null
        const scores = m.trackers
          .map(t => t.record?.score)
          .filter((s): s is number => typeof s === 'number' && s > 0)
        return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
      }
      case 'tagList': {
        if (!sortTags || sortTags.length === 0 || !m.genre || m.genre.length === 0) return null
        const normalizedGenres = m.genre.map(g => g.trim().toLowerCase())
        for (let i = 0; i < sortTags.length; i++) {
          const targetTag = sortTags[i]!.trim().toLowerCase()
          if (normalizedGenres.includes(targetTag)) {
            return i
          }
        }
        return null
      }
      default:
        return null
    }
  }
  return items.slice().sort((a, b) => {
    if (sort.type === 'random') {
      return randomRank(a.id, sort.seed) - randomRank(b.id, sort.seed) || compareTitles(a, b)
    }
    if (sort.type === 'title') {
      return (sort.descending ? -1 : 1) * compareTitles(a, b)
    }
    const av = value(a),
      bv = value(b)
    // REST nullable values are unknown, not zeros; keep them last in BOTH directions.
    if (av === null || bv === null) {
      return av === bv ? compareTitles(a, b) : av === null ? 1 : -1
    }
    // Mihon keeps fully-read titles after unread titles in BOTH directions.
    if (sort.type === 'unread' && (av === 0 || bv === 0) && av !== bv) {
      return av === 0 ? 1 : -1
    }
    return (sort.descending ? bv - av : av - bv) || compareTitles(a, b)
  })
}

function deterministicHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash) || 1
}

function makeVirtualCategory(id: number, name: string, order: number): VirtualCategory {
  return {
    id,
    name,
    order,
    default: false,
    includeInUpdate: 0,
    includeInDownload: 0,
    version: 1,
    uid: 0,
    lastModifiedAt: 0,
    isVirtual: true,
  }
}

export function deriveVirtualCategories(
  mangas: Manga[],
  groupMode: LibraryGroupMode,
  options?: {
    sources?: Source[]
    t?: (key: string) => string
  },
): {
  categories: VirtualCategory[]
  itemsByCategory: Record<number, Manga[]>
} {
  const t = options?.t ?? ((k: string) => k)
  const sources = options?.sources ?? []

  if (groupMode === LIBRARY_GROUP.UNGROUPED) {
    const ungroupedName = t('ungrouped') !== 'ungrouped' ? t('ungrouped') : 'Ungrouped'
    return {
      categories: [
        makeVirtualCategory(0, ungroupedName, 0),
      ],
      itemsByCategory: {
        0: [...mangas],
      },
    }
  }

  if (groupMode === LIBRARY_GROUP.BY_SOURCE) {
    const groups = new Map<string, Manga[]>()
    for (const manga of mangas) {
      const srcId = String(manga.sourceId || manga.source?.id || '0')
      const list = groups.get(srcId)
      if (list) {
        list.push(manga)
      } else {
        groups.set(srcId, [manga])
      }
    }

    const localSourceLabel = t('local_source') !== 'local_source' ? t('local_source') : 'Local source'

    const sortedSourceKeys = Array.from(groups.keys()).sort((a, b) => {
      const aIsLocal = a === '0'
      const bIsLocal = b === '0'
      const aSource = sources.find(s => String(s.id) === a)
      const bSource = sources.find(s => String(s.id) === b)
      const aName = aIsLocal ? localSourceLabel : (aSource?.name || a)
      const bName = bIsLocal ? localSourceLabel : (bSource?.name || b)
      return aName.localeCompare(bName, undefined, { sensitivity: 'base' })
    })

    const categories: VirtualCategory[] = []
    const itemsByCategory: Record<number, Manga[]> = {}

    sortedSourceKeys.forEach((srcKey, idx) => {
      const isLocalSrc = srcKey === '0'
      const sourceObj = sources.find(s => String(s.id) === srcKey)
      const name = isLocalSrc ? localSourceLabel : (sourceObj?.name || srcKey)
      const catId = isLocalSrc ? 0 : deterministicHash(`source_${srcKey}`)
      categories.push(makeVirtualCategory(catId, name, idx))
      itemsByCategory[catId] = groups.get(srcKey) || []
    })

    return { categories, itemsByCategory }
  }

  if (groupMode === LIBRARY_GROUP.BY_STATUS) {
    const statusConfig: { key: string; order: number; id: number; labelKey: string; fallback: string }[] = [
      { key: 'ONGOING', order: 1, id: 1, labelKey: 'ongoing', fallback: 'Ongoing' },
      { key: 'LICENSED', order: 2, id: 2, labelKey: 'licensed', fallback: 'Licensed' },
      { key: 'CANCELLED', order: 3, id: 3, labelKey: 'cancelled', fallback: 'Cancelled' },
      { key: 'ON_HIATUS', order: 4, id: 4, labelKey: 'on_hiatus', fallback: 'On hiatus' },
      { key: 'PUBLISHING_FINISHED', order: 5, id: 5, labelKey: 'publishing_finished', fallback: 'Publishing finished' },
      { key: 'COMPLETED', order: 6, id: 6, labelKey: 'completed', fallback: 'Completed' },
      { key: 'UNKNOWN', order: 7, id: 7, labelKey: 'unknown', fallback: 'Unknown' },
    ]

    const groups = new Map<string, Manga[]>()
    for (const manga of mangas) {
      const status = (manga.status || 'UNKNOWN').toUpperCase()
      const list = groups.get(status)
      if (list) {
        list.push(manga)
      } else {
        groups.set(status, [manga])
      }
    }

    const categories: VirtualCategory[] = []
    const itemsByCategory: Record<number, Manga[]> = {}

    for (const cfg of statusConfig) {
      const list = groups.get(cfg.key)
      if (list && list.length > 0) {
        const name = t(cfg.labelKey) !== cfg.labelKey ? t(cfg.labelKey) : cfg.fallback
        categories.push(makeVirtualCategory(cfg.id, name, cfg.order))
        itemsByCategory[cfg.id] = list
      }
    }

    return { categories, itemsByCategory }
  }

  if (groupMode === LIBRARY_GROUP.BY_TRACK_STATUS) {
    const trackStatusConfig: { key: string; order: number; id: number; labelKey: string; fallback: string }[] = [
      { key: 'reading', order: 1, id: 101, labelKey: 'reading', fallback: 'Reading' },
      { key: 'repeating', order: 2, id: 102, labelKey: 'repeating', fallback: 'Rereading' },
      { key: 'plan_to_read', order: 3, id: 103, labelKey: 'plan_to_read', fallback: 'Plan to read' },
      { key: 'on_hold', order: 4, id: 104, labelKey: 'on_hold', fallback: 'On hold' },
      { key: 'completed', order: 5, id: 105, labelKey: 'completed', fallback: 'Completed' },
      { key: 'dropped', order: 6, id: 106, labelKey: 'dropped', fallback: 'Dropped' },
      { key: 'not_tracked', order: 7, id: 107, labelKey: 'not_tracked', fallback: 'Not tracked' },
    ]

    function resolveTrackStatusKey(manga: Manga): string {
      if (!manga.trackers || manga.trackers.length === 0) return 'not_tracked'
      for (const tracker of manga.trackers) {
        if (!tracker.record) continue
        const statusVal = tracker.record.status
        const statusText = (tracker.statusTextMap?.[String(statusVal)] || '').toLowerCase()

        if (statusText.includes('reread') || statusText.includes('re-read') || statusText.includes('repeat')) return 'repeating'
        if (statusText.includes('reading') || statusText === 'current') return 'reading'
        if (statusText.includes('plan')) return 'plan_to_read'
        if (statusText.includes('hold') || statusText.includes('pause')) return 'on_hold'
        if (statusText.includes('complet')) return 'completed'
        if (statusText.includes('drop')) return 'dropped'

        if (statusVal === 1) return 'reading'
        if (statusVal === 2) return 'completed'
        if (statusVal === 3) return 'on_hold'
        if (statusVal === 4) return 'dropped'
        if (statusVal === 6) return 'plan_to_read'
        if (statusVal === 5) return 'repeating'

        return 'reading'
      }
      return 'not_tracked'
    }

    const groups = new Map<string, Manga[]>()
    for (const manga of mangas) {
      const key = resolveTrackStatusKey(manga)
      const list = groups.get(key)
      if (list) {
        list.push(manga)
      } else {
        groups.set(key, [manga])
      }
    }

    const categories: VirtualCategory[] = []
    const itemsByCategory: Record<number, Manga[]> = {}

    for (const cfg of trackStatusConfig) {
      const list = groups.get(cfg.key)
      if (list && list.length > 0) {
        const name = t(cfg.labelKey) !== cfg.labelKey ? t(cfg.labelKey) : cfg.fallback
        categories.push(makeVirtualCategory(cfg.id, name, cfg.order))
        itemsByCategory[cfg.id] = list
      }
    }

    return { categories, itemsByCategory }
  }

  return {
    categories: [],
    itemsByCategory: {},
  }
}
