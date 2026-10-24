import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { readFileSync } from 'node:fs'
import {
  deriveVirtualCategories,
  sortLibrary,
  LIBRARY_GROUP,
} from '../../src/core/utils/library'
import type { Manga, Source } from '../../src/core/api/types'
import { usePreferencesStore } from '../../src/features/settings/stores/preferences'

function makeSource(id: string, name: string, lang = 'en'): Source {
  return {
    id,
    name,
    lang,
    iconUrl: '',
    supportsLatest: true,
    isConfigurable: false,
    isNsfw: false,
    displayName: name,
    baseUrl: null,
  }
}

function makeManga(id: number, title: string, overrides: Partial<Manga> = {}): Manga {
  return {
    id,
    title,
    sourceId: '1',
    url: `/manga/${id}`,
    thumbnailUrl: null,
    thumbnailUrlLastFetched: 0,
    initialized: true,
    artist: null,
    author: null,
    description: null,
    genre: [],
    status: 'UNKNOWN',
    inLibrary: true,
    inLibraryAt: 0,
    source: null,
    realUrl: null,
    lastFetchedAt: null,
    chaptersLastFetchedAt: null,
    updateStrategy: 'ALWAYS_UPDATE',
    freshData: false,
    unreadCount: 0,
    downloadCount: 0,
    chapterCount: 10,
    lastReadAt: null,
    lastChapterRead: null,
    age: null,
    chaptersAge: null,
    trackers: null,
    lastModifiedAt: 0,
    version: 1,
    ...overrides,
  }
}

describe('3.1 Dynamic Library Grouping', () => {
  const sources: Source[] = [
    makeSource('1', 'MangaDex', 'en'),
    makeSource('2', 'Asura Scans', 'en'),
    makeSource('0', 'Local source', 'localsourcelang'),
  ]

  it('groups library as UNGROUPED with a single virtual category', () => {
    const mangas = [
      makeManga(1, 'Berserk'),
      makeManga(2, 'Claymore'),
    ]
    const result = deriveVirtualCategories(mangas, LIBRARY_GROUP.UNGROUPED)
    expect(result.categories).toHaveLength(1)
    expect(result.categories[0]!.name).toBe('Ungrouped')
    expect(result.categories[0]!.isVirtual).toBe(true)
    expect(result.itemsByCategory[0]).toHaveLength(2)
  })

  it('groups library BY_SOURCE sorted alphabetically by source name', () => {
    const mangas = [
      makeManga(1, 'MangaDex Title', { sourceId: '1' }),
      makeManga(2, 'Asura Title', { sourceId: '2' }),
      makeManga(3, 'Local Title', { sourceId: '0' }),
    ]
    const result = deriveVirtualCategories(mangas, LIBRARY_GROUP.BY_SOURCE, { sources })
    expect(result.categories).toHaveLength(3)

    // Sorted alphabetically: Asura Scans, Local source, MangaDex
    const names = result.categories.map(c => c.name)
    expect(names).toEqual(['Asura Scans', 'Local source', 'MangaDex'])

    // Check items partitioning
    const asuraCat = result.categories.find(c => c.name === 'Asura Scans')!
    const localCat = result.categories.find(c => c.name === 'Local source')!
    const dexCat = result.categories.find(c => c.name === 'MangaDex')!

    expect(result.itemsByCategory[asuraCat.id]!.map(m => m.id)).toEqual([2])
    expect(result.itemsByCategory[localCat.id]!.map(m => m.id)).toEqual([3])
    expect(result.itemsByCategory[dexCat.id]!.map(m => m.id)).toEqual([1])
  })

  it('groups library BY_STATUS in reference order', () => {
    const mangas = [
      makeManga(1, 'Completed One', { status: 'COMPLETED' }),
      makeManga(2, 'Ongoing One', { status: 'ONGOING' }),
      makeManga(3, 'Hiatus One', { status: 'ON_HIATUS' }),
    ]
    const result = deriveVirtualCategories(mangas, LIBRARY_GROUP.BY_STATUS)
    // Order: Ongoing (1), Cancelled (3), On Hiatus (4), Completed (6)
    const categoryNames = result.categories.map(c => c.name)
    expect(categoryNames).toEqual(['Ongoing', 'On hiatus', 'Completed'])

    const ongoingCat = result.categories.find(c => c.name === 'Ongoing')!
    expect(result.itemsByCategory[ongoingCat.id]!.map(m => m.id)).toEqual([2])
  })

  it('groups library BY_TRACK_STATUS based on bound trackers', () => {
    const mangas = [
      makeManga(1, 'Reading Manga', {
        trackers: [{
          id: 1,
          name: 'MyAnimeList',
          icon: '',
          statusList: [1, 2, 3],
          statusTextMap: { '1': 'Reading', '2': 'Completed' },
          scoreList: [],
          record: {
            id: 10, mangaId: 1, trackerId: 1, remoteId: 10, libraryId: 1,
            title: 'Reading Manga', lastChapterRead: 5, totalChapters: 10, status: 1,
            score: 8, scoreString: '8', remoteUrl: '', startDate: 0, finishDate: 0, private: false,
          },
        }],
      }),
      makeManga(2, 'Completed Manga', {
        trackers: [{
          id: 1,
          name: 'MyAnimeList',
          icon: '',
          statusList: [1, 2, 3],
          statusTextMap: { '1': 'Reading', '2': 'Completed' },
          scoreList: [],
          record: {
            id: 11, mangaId: 2, trackerId: 1, remoteId: 11, libraryId: 2,
            title: 'Completed Manga', lastChapterRead: 10, totalChapters: 10, status: 2,
            score: 9, scoreString: '9', remoteUrl: '', startDate: 0, finishDate: 0, private: false,
          },
        }],
      }),
      makeManga(3, 'Untracked Manga', {
        trackers: [],
      }),
    ]

    const result = deriveVirtualCategories(mangas, LIBRARY_GROUP.BY_TRACK_STATUS)
    const categoryNames = result.categories.map(c => c.name)
    expect(categoryNames).toEqual(['Reading', 'Completed', 'Not tracked'])

    const readingCat = result.categories.find(c => c.name === 'Reading')!
    const completedCat = result.categories.find(c => c.name === 'Completed')!
    const untrackedCat = result.categories.find(c => c.name === 'Not tracked')!

    expect(result.itemsByCategory[readingCat.id]!.map(m => m.id)).toEqual([1])
    expect(result.itemsByCategory[completedCat.id]!.map(m => m.id)).toEqual([2])
    expect(result.itemsByCategory[untrackedCat.id]!.map(m => m.id)).toEqual([3])
  })
})

describe('3.2 Tag Priority Sorting', () => {
  const mangaAction = makeManga(1, 'Alpha Action', { genre: ['Action', 'Fantasy'] })
  const mangaRomance = makeManga(2, 'Beta Romance', { genre: ['Romance', 'Comedy'] })
  const mangaComedy = makeManga(3, 'Charlie Comedy', { genre: ['Comedy'] })
  const mangaNone = makeManga(4, 'Delta None', { genre: ['Drama'] })
  const mangaAction2 = makeManga(5, 'Zeta Action', { genre: ['Action'] })

  const items = [mangaNone, mangaRomance, mangaAction2, mangaAction, mangaComedy]

  it('sorts by priority tags ascending: lowest tag index first, ties broken alphabetically', () => {
    // Priority: 0: Romance, 1: Action, 2: Comedy
    const sortTags = ['Romance', 'Action', 'Comedy']
    const sorted = sortLibrary(items, { type: 'tagList', descending: false, seed: 0 }, {}, sortTags)

    // Tag 0 (Romance): Beta Romance
    // Tag 1 (Action): Alpha Action, Zeta Action
    // Tag 2 (Comedy): Charlie Comedy
    // Unmatched: Delta None (last)
    expect(sorted.map(m => m.title)).toEqual([
      'Beta Romance',
      'Alpha Action',
      'Zeta Action',
      'Charlie Comedy',
      'Delta None',
    ])
  })

  it('sorts by priority tags descending: higher tag index first, unmatched stays last', () => {
    const sortTags = ['Romance', 'Action', 'Comedy']
    const sorted = sortLibrary(items, { type: 'tagList', descending: true, seed: 0 }, {}, sortTags)

    // Descending order of tags: Tag 2 (Comedy), Tag 1 (Action), Tag 0 (Romance)
    // Unmatched still last!
    expect(sorted.map(m => m.title)).toEqual([
      'Charlie Comedy',
      'Alpha Action',
      'Zeta Action',
      'Beta Romance',
      'Delta None',
    ])
  })

  it('falls back cleanly if sortTags is empty or genres are missing', () => {
    const sorted = sortLibrary(items, { type: 'tagList', descending: false, seed: 0 }, {}, [])
    // All unmatched -> tie broken alphabetically
    expect(sorted.map(m => m.title)).toEqual([
      'Alpha Action',
      'Beta Romance',
      'Charlie Comedy',
      'Delta None',
      'Zeta Action',
    ])
  })
})

describe('Preferences Store Integration', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    })
    setActivePinia(createPinia())
  })

  it('persists groupMode in localStorage', async () => {
    const prefs = usePreferencesStore()
    expect(prefs.groupMode).toBe(0)

    prefs.groupMode = LIBRARY_GROUP.BY_STATUS
    await nextTick()
    expect(localStorage.getItem('mihon.library.groupMode')).toBe('2')
  })

  it('persists sortTags in localStorage', async () => {
    const prefs = usePreferencesStore()
    expect(prefs.sortTags).toEqual([])

    prefs.sortTags = ['Action', 'Romance']
    await nextTick()
    expect(localStorage.getItem('mihon.library.sortTags')).toBe(JSON.stringify(['Action', 'Romance']))
  })
})

describe('Template & Contract Verification', () => {
  it('SortTagView.vue exists and conforms to spec', () => {
    const source = readFileSync('src/features/settings/views/SortTagView.vue', 'utf8')
    expect(source).toContain('sort-tag-card')
    expect(source).toContain('moveTag')
    expect(source).toContain('openCreateDialog')
    expect(source).toContain('openDeleteDialog')
    expect(source).toContain('v-dialog')
  })

  it('LibrarySettingsSheet.vue contains Group tab and tag sorting', () => {
    const source = readFileSync('src/features/library/components/LibrarySettingsSheet.vue', 'utf8')
    expect(source).toContain(":tabs=\"['Filter', 'Sort', 'Display', 'Group']\"")
    expect(source).toContain("prefs.sortTags.length > 0")
    expect(source).toContain("value: 'tagList'")
    expect(source).toContain("groupOptions")
    expect(source).toContain("prefs.groupMode")
  })

  it('router/index.ts registers /settings/library/sort-tags', () => {
    const source = readFileSync('src/router/index.ts', 'utf8')
    expect(source).toContain("path: '/settings/library/sort-tags'")
  })

  it('SettingsLibraryView.vue links to /settings/library/sort-tags', () => {
    const source = readFileSync('src/features/settings/views/SettingsLibraryView.vue', 'utf8')
    expect(source).toContain("router.push('/settings/library/sort-tags')")
    expect(source).toContain("sortTagsCountLabel")
  })
})
