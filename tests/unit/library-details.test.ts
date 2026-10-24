import { beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { chapter } from '../fixtures'
const api = vi.hoisted(() => ({ chapters: vi.fn() }))
vi.mock('@/core/api/client', async orig => ({ ...await orig<typeof import('@/core/api/client')>(), createSuwayomiApi: () => api }))
import { useLibraryDetails } from '../../src/stores/libraryDetails'
beforeEach(() => { setActivePinia(createPinia()); vi.resetAllMocks() })
it('loads at most four parallel chapter lists per batch and deduplicates requests', async () => {
  let active=0, peak=0
  api.chapters.mockImplementation(async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;return [chapter]})
  const store=useLibraryDetails(); await store.ensure('/api/v1',[1,1,2,3,4,5,6]); await store.ensure('/api/v1',[1,2])
  expect(peak).toBe(4); expect(api.chapters).toHaveBeenCalledTimes(6); expect(api.chapters).toHaveBeenCalledWith(1,false); expect(store.pendingCount).toBe(0)
})
it('discards old-server summaries rather than overwriting new-server data', async()=>{
  let resolve!: (c: typeof chapter[]) => void
  api.chapters.mockReturnValueOnce(new Promise(r=>{resolve=r})).mockResolvedValueOnce([{...chapter,bookmarked:true}])
  const store=useLibraryDetails(), stale=store.ensure('/old',[1]); await store.ensure('/new',[1]); resolve([chapter]); await stale
  expect(store.summaries[1]?.bookmarked).toBe(true); expect(store.pendingCount).toBe(0)
})
it('exposes failure as unknown, retries only explicitly, and clears errors after success', async()=>{
  api.chapters.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([chapter]); const store=useLibraryDetails()
  await store.ensure('/api/v1',[1]); expect(store.summaries[1]).toBeUndefined(); expect(store.errors[1]).toBeTruthy()
  await store.ensure('/api/v1',[1]); expect(api.chapters).toHaveBeenCalledTimes(1)
  await store.ensure('/api/v1',[1],true); expect(store.errors[1]).toBeUndefined(); expect(store.summaries[1]?.nextUnread).toBe(7)
})
