import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCatalogueStore } from '../../src/stores/catalogue'
import { manga } from '../fixtures'
const fetchPage = vi.hoisted(() => vi.fn())
vi.mock('../../src/api/client', () => ({ createSuwayomiApi: () => ({ sourceCatalogue: fetchPage }), apiErrorMessage: () => 'Server error' }))
beforeEach(() => { setActivePinia(createPinia()); fetchPage.mockReset() })
describe('source catalogue', () => {
  it('uses string source IDs, deduplicates pages and stops at the end', async () => {
    const store = useCatalogueStore()
    fetchPage.mockResolvedValueOnce({ mangaList: [manga(1)], hasNextPage: true }).mockResolvedValueOnce({ mangaList: [manga(1), manga(2), manga(2)], hasNextPage: false })
    await store.open('/api/v1', '9223372036854775806', 'search', 'stars & moon')
    expect(fetchPage).toHaveBeenCalledWith('9223372036854775806', 'search', 1, 'stars & moon')
    await store.loadMore(); await store.loadMore()
    expect(store.items.map(m => m.id)).toEqual([1, 2]); expect(store.page).toBe(2)
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })
  it('keeps previous items and retries the same failed next page', async () => {
    const store = useCatalogueStore()
    fetchPage.mockResolvedValueOnce({ mangaList: [manga(1)], hasNextPage: true }).mockRejectedValueOnce(Error()).mockResolvedValueOnce({ mangaList: [manga(2)], hasNextPage: false })
    await store.open('/api/v1', '123', 'popular'); await store.loadMore()
    expect(store.error).toBe('Server error'); expect(store.page).toBe(1); expect(store.items).toHaveLength(1)
    await store.loadMore(); expect(store.items).toHaveLength(2)
    expect(fetchPage.mock.calls.slice(1).map(c => c[2])).toEqual([2, 2])
  })
  it('ignores a stale response after changing source or query', async () => {
    const store = useCatalogueStore()
    let resolve!: (value: unknown) => void
    fetchPage.mockImplementationOnce(() => new Promise(r => { resolve = r })).mockResolvedValueOnce({ mangaList: [manga(2)], hasNextPage: false })
    const first = store.open('/api/v1', '123', 'popular')
    await store.open('/api/v1', '456', 'latest')
    resolve({ mangaList: [manga(1)], hasNextPage: true }); await first
    expect(store.items.map(m => m.id)).toEqual([2]); expect(store.loading).toBe(false)
  })
  it('ignores closed requests and prevents duplicate pagination requests', async () => {
    const store = useCatalogueStore()
    let resolve!: (value: unknown) => void
    fetchPage.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const pending = store.open('/api/v1', '123', 'popular'); await store.loadMore()
    expect(fetchPage).toHaveBeenCalledTimes(1); store.close()
    resolve({ mangaList: [manga(1)], hasNextPage: true }); await pending
    expect(store.items).toHaveLength(0); expect(store.loading).toBe(false)
  })
})
