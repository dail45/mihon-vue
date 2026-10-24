import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUpdatesStore } from '../../src/stores/updates'
import { fetchedDateKey, fetchedDateLabel, latestFetchedAt, relativeTimeSpanString } from '../../src/utils/dates'
import { chapter, manga } from '../fixtures'
const recent = vi.hoisted(() => vi.fn())
vi.mock('@/core/api/client', () => ({ createSuwayomiApi: () => ({ recentChapters: recent }), apiErrorMessage: () => 'Server error' }))
const entry = (id: number) => ({ manga: manga(id), chapter: { ...chapter, id } })
beforeEach(() => { setActivePinia(createPinia()); recent.mockReset() })
describe('recent chapter feed', () => {
  it('starts at page zero, deduplicates and stops at end', async () => {
    const store = useUpdatesStore()
    recent.mockResolvedValueOnce({ page: [entry(1)], hasNextPage: true }).mockResolvedValueOnce({ page: [entry(1), entry(2), entry(2)], hasNextPage: false })
    await store.refresh('/api/v1'); await store.loadMore(); await store.loadMore()
    expect(recent.mock.calls.map(c => c[0])).toEqual([0, 1]); expect(store.entries.map(e => e.manga.id)).toEqual([1, 2])
  })
  it('retains data on failure and retries the same next page', async () => {
    const store = useUpdatesStore()
    recent.mockResolvedValueOnce({ page: [entry(1)], hasNextPage: true }).mockRejectedValueOnce(Error()).mockResolvedValueOnce({ page: [entry(2)], hasNextPage: false })
    await store.refresh('/api/v1'); await store.loadMore()
    expect(store.error).toBe('Server error'); expect(store.entries).toHaveLength(1)
    await store.loadMore(); expect(recent.mock.calls.map(c => c[0])).toEqual([0, 1, 1]); expect(store.entries).toHaveLength(2)
  })
  it('drops stale responses on server change and clears previous-server entries', async () => {
    const store = useUpdatesStore(); let resolve!: (v: unknown) => void
    recent.mockImplementationOnce(() => new Promise(r => { resolve = r })).mockResolvedValueOnce({ page: [entry(2)], hasNextPage: false })
    const old = store.refresh('/old'); await store.refresh('/new'); resolve({ page: [entry(1)], hasNextPage: true }); await old
    expect(store.entries[0]!.manga.id).toBe(2)
    recent.mockRejectedValueOnce(Error()); await store.refresh('/third'); expect(store.entries).toHaveLength(0)
  })
  it('blocks concurrent pagination and ignores responses after unmount', async () => {
    const store = useUpdatesStore(); let resolve!: (v: unknown) => void
    recent.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const pending = store.refresh('/api'); await store.loadMore(); expect(recent).toHaveBeenCalledTimes(1)
    store.dispose(); resolve({ page: [entry(1)], hasNextPage: false }); await pending
    expect(store.entries).toHaveLength(0); expect(store.loading).toBe(false)
  })
  it('uses seconds for fetched dates and labels missing or invalid dates honestly', () => {
    const today = Math.floor(Date.now() / 1000)
    expect(fetchedDateLabel(today)).toBe('Today'); expect(fetchedDateKey(today)).not.toBe('unknown')
    for (const n of [0, -1, NaN, Infinity, 1e20]) { expect(fetchedDateKey(n)).toBe('unknown'); expect(fetchedDateLabel(n)).toBe('Date unknown') }
  })
})

describe('last updated header text', () => {
  it('mirrors Mihon relativeTimeSpanString: Never, Just now, then a relative span', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(relativeTimeSpanString(0)).toBe('Never')
    expect(relativeTimeSpanString(-1)).toBe('Never')
    expect(relativeTimeSpanString(now)).toBe('Just now')
    expect(relativeTimeSpanString(now - 30)).toBe('Just now')
    expect(relativeTimeSpanString(now - 60 * 5)).toBe('5 minutes ago')
    expect(relativeTimeSpanString(now - 3600 * 3)).toBe('3 hours ago')
    expect(relativeTimeSpanString(now - 86400 * 2)).toBe('2 days ago')
  })
  it('picks the newest fetch time and ignores invalid values', () => {
    expect(latestFetchedAt([])).toBe(0)
    expect(latestFetchedAt([10, 50, 0, -5, NaN])).toBe(50)
  })
})
