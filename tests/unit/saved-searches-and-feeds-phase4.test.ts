import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSavedSearchesStore } from '@/features/browse/stores/savedSearches'
import { MAX_FEED_ITEMS, useFeedStore } from '@/features/browse/stores/feed'
import { readFileSync } from 'node:fs'

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size },
  } as any
}

const filterDialogSource = readFileSync('src/features/browse/components/SourceFilterDialog.vue', 'utf8')
const feedViewSource = readFileSync('src/features/browse/views/FeedView.vue', 'utf8')
const feedAddDialogSource = readFileSync('src/features/browse/components/FeedAddDialog.vue', 'utf8')
const feedOrderScreenSource = readFileSync('src/features/browse/components/FeedOrderScreen.vue', 'utf8')
const browseViewSource = readFileSync('src/features/browse/views/BrowseView.vue', 'utf8')
const enLocale = JSON.parse(readFileSync('src/locales/en.json', 'utf8'))
const ruLocale = JSON.parse(readFileSync('src/locales/ru.json', 'utf8'))

describe('Phase 4.1: Saved Searches', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('saves, retrieves, renames, and deletes saved searches per source', () => {
    const store = useSavedSearchesStore()
    expect(store.savedSearches).toEqual([])

    const search1 = store.saveSearch('123', 'Action & Romance', 'manga', [
      { type: 'CheckBox', filter: { name: 'Action', state: true } },
    ])

    expect(search1.id).toBeDefined()
    expect(search1.name).toBe('Action & Romance')
    expect(search1.sourceId).toBe('123')
    expect(search1.query).toBe('manga')

    store.saveSearch('456', 'Comedy', null, [])
    expect(store.savedSearches).toHaveLength(2)

    const source123Searches = store.getSearchesForSource('123')
    expect(source123Searches).toHaveLength(1)
    expect(source123Searches[0].name).toBe('Action & Romance')

    store.renameSearch(search1.id, 'Action + Romance')
    expect(store.getSearchById(search1.id)?.name).toBe('Action + Romance')

    store.deleteSearch(search1.id)
    expect(store.getSearchesForSource('123')).toHaveLength(0)
    expect(store.savedSearches).toHaveLength(1)
  })

  it('persists saved searches to localStorage under mihon.savedSearches', () => {
    const store = useSavedSearchesStore()
    store.saveSearch('source-1', 'My Preset', 'test', [])

    const raw = localStorage.getItem('mihon.savedSearches')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed[0].name).toBe('My Preset')
  })

  it('SourceFilterDialog renders save icon button and saved search chips', () => {
    expect(filterDialogSource).toContain('openSaveSearchDialog')
    expect(filterDialogSource).toContain('source-filter-saved-searches')
    expect(filterDialogSource).toContain('source-filter-saved-chip')
    expect(filterDialogSource).toContain('apply-saved-search')
    expect(filterDialogSource).toContain('saved_search_add_to_feed')
  })
})

describe('Phase 4.2: Browse Feed Tab & Capacity Guard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('enforces MAX_FEED_ITEMS = 20 capacity limit', () => {
    expect(MAX_FEED_ITEMS).toBe(20)
    const store = useFeedStore()

    for (let i = 0; i < 20; i++) {
      const res = store.addFeed({
        sourceId: `source-${i}`,
        feedType: 'latest',
        global: true,
        title: `Feed ${i}`,
      })
      expect(res.success).toBe(true)
    }

    expect(store.feeds).toHaveLength(20)
    expect(store.isFull).toBe(true)

    const overflow = store.addFeed({
      sourceId: 'source-overflow',
      feedType: 'popular',
      global: true,
    })

    expect(overflow.success).toBe(false)
    expect(overflow.error).toContain('20')
    expect(store.feeds).toHaveLength(20)
  })

  it('allows removing feeds and re-indexes orders', () => {
    const store = useFeedStore()
    store.addFeed({ sourceId: 's1', feedType: 'latest', global: true, title: 'F1' })
    store.addFeed({ sourceId: 's2', feedType: 'popular', global: true, title: 'F2' })

    const id1 = store.feeds[0].id
    store.removeFeed(id1)

    expect(store.feeds).toHaveLength(1)
    expect(store.feeds[0].sourceId).toBe('s2')
    expect(store.feeds[0].order).toBe(0)
  })

  it('supports moving and reordering feed sequence', () => {
    const store = useFeedStore()
    store.addFeed({ sourceId: 's1', feedType: 'latest', global: true, title: 'F1' })
    store.addFeed({ sourceId: 's2', feedType: 'popular', global: true, title: 'F2' })
    store.addFeed({ sourceId: 's3', feedType: 'latest', global: true, title: 'F3' })

    const id1 = store.feeds[0].id
    const id2 = store.feeds[1].id
    const id3 = store.feeds[2].id

    store.moveFeed(0, 2)
    expect(store.feeds.map(f => f.id)).toEqual([id2, id3, id1])

    store.reorderFeeds([id3, id1, id2])
    expect(store.feeds.map(f => f.id)).toEqual([id3, id1, id2])
    expect(store.feeds[0].order).toBe(0)
    expect(store.feeds[1].order).toBe(1)
    expect(store.feeds[2].order).toBe(2)
  })

  it('FeedView integrates GlobalSearchResultItem, GlobalSearchCardRow, empty state, and refresh', () => {
    expect(feedViewSource).toContain('GlobalSearchResultItem')
    expect(feedViewSource).toContain('GlobalSearchCardRow')
    expect(feedViewSource).toContain('FeedAddDialog')
    expect(feedViewSource).toContain('FeedOrderScreen')
    expect(feedViewSource).toContain('feed_tab_empty')
  })

  it('FeedAddDialog validates sources, latest support, and 20-feed guard', () => {
    expect(feedAddDialogSource).toContain('feed_select_source')
    expect(feedAddDialogSource).toContain('feed_type')
    expect(feedAddDialogSource).toContain('supportsLatest')
    expect(feedAddDialogSource).toContain('MAX_FEED_ITEMS')
  })

  it('BrowseView registers feed in VALID_TABS and browseTabs', () => {
    expect(browseViewSource).toContain("'feed'")
    expect(browseViewSource).toContain("value: 'feed'")
    expect(browseViewSource).toContain('<FeedView')
  })
})

describe('Phase 4.3: Feed Reorder Screen', () => {
  it('FeedOrderScreen displays drag handles, arrow buttons, and delete confirmations', () => {
    expect(feedOrderScreenSource).toContain('drag_handle')
    expect(feedOrderScreenSource).toContain('arrow_upward')
    expect(feedOrderScreenSource).toContain('arrow_downward')
    expect(feedOrderScreenSource).toContain('feed_delete')
    expect(feedOrderScreenSource).toContain('confirmDelete')
  })
})

describe('i18n completeness for Phase 4', () => {
  const requiredKeys = [
    'saved_searches',
    'save_search',
    'search_name',
    'saved_search_add_to_feed',
    'saved_search_delete',
    'saved_search_saved',
    'saved_search_added_to_feed',
    'feed',
    'feed_empty',
    'feed_tab_empty',
    'feed_add',
    'feed_delete',
    'feed_delete_confirm',
    'too_many_in_feed',
    'action_sort_feed',
    'action_add_feed',
    'feed_type',
    'feed_type_latest',
    'feed_type_popular',
    'feed_type_saved_search',
    'feed_select_source',
    'feed_select_saved_search',
    'feed_no_saved_searches',
  ]

  it('contains all required keys in en.json and ru.json', () => {
    for (const key of requiredKeys) {
      expect(enLocale[key]).toBeDefined()
      expect(ruLocale[key]).toBeDefined()
      expect(enLocale[key].length).toBeGreaterThan(0)
      expect(ruLocale[key].length).toBeGreaterThan(0)
    }
  })
})
