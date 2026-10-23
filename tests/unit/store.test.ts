import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { category, chapter, manga } from '../fixtures'
const api = vi.hoisted(() => ({ categories: vi.fn(), categoryManga: vi.fn(), manga: vi.fn(), chapters: vi.fn(), sources: vi.fn(), addToLibrary: vi.fn(), removeFromLibrary: vi.fn() }))
vi.mock('../../src/api/client', async importOriginal => ({ ...await importOriginal<typeof import('../../src/api/client')>(), createSuwayomiApi: () => api }))
import { useSuwayomiStore } from '../../src/stores/suwayomi'
beforeEach(() => { setActivePinia(createPinia()); vi.resetAllMocks() })
describe('useSuwayomiStore', () => {
  it('fetches all real category IDs and deduplicates total count', async () => {
    api.categories.mockResolvedValue([category(19, 'Reading', 2), category(4, 'Default', 0)])
    api.categoryManga.mockImplementation(async (id: number) => id === 4 ? [manga(1)] : [manga(1), manga(2)])
    const store = useSuwayomiStore(); await store.loadLibrary()
    expect(store.categories.map(c => c.id)).toEqual([4, 19]); expect(store.totalLibraryCount).toBe(2)
    expect(api.categoryManga.mock.calls.map(args => args[0])).toEqual([4, 19]); expect(store.library.length).toBe(1)
    store.activeCategoryId = 19; expect(store.library.length).toBe(2)
  })
  it('retains previous library on failed refresh, but reports disconnection', async () => {
    api.categories.mockResolvedValue([category(4, 'Default')]); api.categoryManga.mockResolvedValue([manga(1)])
    const store = useSuwayomiStore(); await store.loadLibrary()
    api.categories.mockRejectedValue(new Error('offline')); await store.loadLibrary()
    expect(store.library.length).toBe(1); expect(store.libraryError).toContain('Cannot reach'); expect(store.connected).toBe(false)
  })
  it('ignores stale library responses after a server switch', async () => {
    let resolve!: (value: ReturnType<typeof category>[]) => void
    api.categories.mockReturnValue(new Promise(r => { resolve = r }))
    const store = useSuwayomiStore(); const pending = store.loadLibrary()
    store.setApiUrl('https://another.invalid/api/v1'); resolve([category(4, 'Old server')]); api.categoryManga.mockResolvedValue([manga(99)])
    await pending
    expect(store.categories).toEqual([]); expect(store.connected).toBe(false)
  })
  it('does not combine category successes with an unreported failed category', async () => {
    api.categories.mockResolvedValue([category(4, 'Default'), category(19, 'Other')])
    api.categoryManga.mockImplementation(async (id: number) => { if (id === 19) throw new Error(); return [manga(1)] })
    const store = useSuwayomiStore(); await store.loadLibrary()
    expect(store.libraryError).not.toBeNull(); expect(store.totalLibraryCount).toBe(0)
  })
  it('loads full manga and chapter list', async () => {
    api.manga.mockResolvedValue(manga(1)); api.chapters.mockResolvedValue([chapter])
    const store = useSuwayomiStore(); await store.loadManga(1)
    expect(store.manga?.sourceId).toBe('9223372036854775806'); expect(store.chapters[0]?.index).toBe(7)
  })
  it('does not optimistically remove membership when server write fails', async () => {
    api.manga.mockResolvedValue(manga(1)); api.chapters.mockResolvedValue([]); api.removeFromLibrary.mockRejectedValue(new Error())
    const store = useSuwayomiStore(); await store.loadManga(1); await store.setLibraryMembership(false)
    expect(store.manga?.inLibrary).toBe(true); expect(api.removeFromLibrary).toHaveBeenCalledTimes(1); expect(store.mutationError).toContain('refresh before retrying')
  })
  it('clears private manga data on server change', async () => {
    api.manga.mockResolvedValue(manga(1)); api.chapters.mockResolvedValue([chapter])
    const store = useSuwayomiStore(); await store.loadManga(1); store.setApiUrl('/proxy/api/v1')
    expect(store.manga).toBeNull(); expect(store.chapters).toEqual([])
  })
  it('preserves existing manga and chapters during silent reload of same manga without flicker', async () => {
    api.manga.mockResolvedValue(manga(1)); api.chapters.mockResolvedValue([chapter])
    const store = useSuwayomiStore()
    await store.loadManga(1)
    expect(store.manga?.id).toBe(1)
    expect(store.chapters.length).toBe(1)

    // Second call for the same manga with silent = true
    let resolveManga!: (val: unknown) => void
    api.manga.mockReturnValue(new Promise(r => { resolveManga = r }))
    const reloadPromise = store.loadManga(1, false, true)
    // loadingManga should NOT be true when silent, and manga / chapters should NOT be wiped to null/empty
    expect(store.loadingManga).toBe(false)
    expect(store.manga?.id).toBe(1)
    expect(store.chapters.length).toBe(1)
    resolveManga(manga(1))
    await reloadPromise
    expect(store.manga?.id).toBe(1)
  })
  it('updates chapters locally and handles markPrevRead', () => {
    const store = useSuwayomiStore()
    store.chapters = [
      { ...chapter, id: 10, index: 1, read: false, bookmarked: false },
      { ...chapter, id: 20, index: 2, read: false, bookmarked: false },
      { ...chapter, id: 30, index: 3, read: false, bookmarked: false },
    ]
    store.updateChapterLocally(2, { bookmarked: true, read: true })
    expect(store.chapters[1]?.bookmarked).toBe(true)
    expect(store.chapters[1]?.read).toBe(true)

    store.updateChapterLocally(3, { markPrevRead: true })
    expect(store.chapters[0]?.read).toBe(true)
    expect(store.chapters[1]?.read).toBe(true)

    store.updateChapterByIdLocally(30, { downloaded: true })
    expect(store.chapters[2]?.downloaded).toBe(true)
  })
})
