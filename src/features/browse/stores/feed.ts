import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createSuwayomiApi } from '@/core/api/client'
import type { Manga } from '@/core/api/types'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { useSavedSearchesStore } from './savedSearches'

export const MAX_FEED_ITEMS = 20
export const FEED_STORAGE_KEY = 'mihon.feed_entries'

export type FeedType = 'latest' | 'popular' | 'saved_search'

export interface FeedEntry {
  id: string
  sourceId: string
  savedSearchId?: string
  feedType: FeedType
  order: number
  global: boolean
  title?: string
}

export interface FeedLaneResult {
  loading: boolean
  error?: string
  items: Manga[]
}

function loadFeedsFromStorage(): FeedEntry[] {
  try {
    const raw = localStorage.getItem(FEED_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return (parsed as FeedEntry[]).sort((a, b) => a.order - b.order)
  } catch {
    return []
  }
}

function persistFeedsToStorage(feeds: FeedEntry[]) {
  try {
    localStorage.setItem(FEED_STORAGE_KEY, JSON.stringify(feeds))
  } catch (err) {
    console.error('Failed to persist feed entries:', err)
  }
}

export const useFeedStore = defineStore('feed', () => {
  const feeds = ref<FeedEntry[]>(loadFeedsFromStorage())
  const results = ref<Record<string, FeedLaneResult>>({})
  const initialLoaded = ref(false)

  const server = useSuwayomiStore()
  const savedSearchesStore = useSavedSearchesStore()

  const isFull = computed(() => feeds.value.length >= MAX_FEED_ITEMS)

  function addFeed(entry: Omit<FeedEntry, 'id' | 'order'>): { success: boolean; error?: string } {
    if (feeds.value.length >= MAX_FEED_ITEMS) {
      return {
        success: false,
        error: `Too many sources in your feed, cannot add more than ${MAX_FEED_ITEMS}`,
      }
    }

    const newFeed: FeedEntry = {
      ...entry,
      id: `feed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      order: feeds.value.length,
    }

    feeds.value = [...feeds.value, newFeed]
    persistFeedsToStorage(feeds.value)
    void fetchLane(newFeed)

    return { success: true }
  }

  function removeFeed(id: string) {
    feeds.value = feeds.value
      .filter(f => f.id !== id)
      .map((f, index) => ({ ...f, order: index }))

    delete results.value[id]
    persistFeedsToStorage(feeds.value)
  }

  function moveFeed(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= feeds.value.length || toIndex < 0 || toIndex >= feeds.value.length) {
      return
    }
    const updated = [...feeds.value]
    const [moved] = updated.splice(fromIndex, 1)
    if (!moved) return
    updated.splice(toIndex, 0, moved)
    feeds.value = updated.map((f, index) => ({ ...f, order: index }))
    persistFeedsToStorage(feeds.value)
  }

  function reorderFeeds(orderedIds: string[]) {
    const map = new Map(feeds.value.map(f => [f.id, f]))
    const reordered: FeedEntry[] = []
    orderedIds.forEach((id, index) => {
      const feed = map.get(id)
      if (feed) {
        reordered.push({ ...feed, order: index })
        map.delete(id)
      }
    })
    // Append any leftover feeds not in orderedIds
    for (const leftover of map.values()) {
      reordered.push({ ...leftover, order: reordered.length })
    }
    feeds.value = reordered
    persistFeedsToStorage(feeds.value)
  }

  async function fetchLane(feed: FeedEntry) {
    const api = createSuwayomiApi(server.apiUrl)
    results.value[feed.id] = { loading: true, items: results.value[feed.id]?.items ?? [] }

    try {
      let mangaList: Manga[] = []
      if (feed.feedType === 'latest') {
        const paged = await api.sourceCatalogue(feed.sourceId, 'latest', 1)
        mangaList = paged.mangaList || []
      } else if (feed.feedType === 'popular') {
        const paged = await api.sourceCatalogue(feed.sourceId, 'popular', 1)
        mangaList = paged.mangaList || []
      } else if (feed.feedType === 'saved_search') {
        const saved = feed.savedSearchId ? savedSearchesStore.getSearchById(feed.savedSearchId) : undefined
        if (!saved) {
          results.value[feed.id] = {
            loading: false,
            error: 'Saved search not found',
            items: [],
          }
          return
        }
        const paged = await api.sourceCatalogue(feed.sourceId, 'search', 1, saved.query ?? '', saved.filters)
        mangaList = paged.mangaList || []
      }

      results.value[feed.id] = {
        loading: false,
        items: mangaList,
      }
    } catch (err) {
      results.value[feed.id] = {
        loading: false,
        error: (err as Error)?.message || 'Failed to load feed',
        items: [],
      }
    }
  }

  async function loadAllFeeds() {
    feeds.value = loadFeedsFromStorage()
    initialLoaded.value = true
    await Promise.all(feeds.value.map(f => fetchLane(f)))
  }

  return {
    feeds,
    results,
    isFull,
    initialLoaded,
    addFeed,
    removeFeed,
    moveFeed,
    reorderFeeds,
    fetchLane,
    loadAllFeeds,
  }
})
