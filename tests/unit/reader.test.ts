import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { chapter, manga } from '../fixtures'
const api = vi.hoisted(() => ({ manga: vi.fn(), chapters: vi.fn(), chapter: vi.fn(), modifyChapter: vi.fn() }))
vi.mock('../../src/api/client', async original => ({ ...await original<typeof import('../../src/api/client')>(), createSuwayomiApi: () => api }))
import { useReaderStore } from '../../src/stores/reader'
beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks()
  api.manga.mockResolvedValue(manga(1)); api.chapters.mockResolvedValue([chapter, { ...chapter, id: 999, index: 9 }])
  api.chapter.mockResolvedValue({ ...chapter, pageCount: 3, lastPageRead: 1 })
  api.modifyChapter.mockResolvedValue(undefined)
})
describe('reader session', () => {
  it('loads chapter by source index, not chapter ID, and resumes within bounds', async () => {
    const r = useReaderStore(); await r.open('/api/v1', 1, 7)
    expect(api.chapter).toHaveBeenCalledWith(1, 7); expect(r.pageIndex).toBe(1)
    expect(r.pageUrl(2)).toBe('/api/v1/manga/1/chapter/7/page/2?updateProgress=false')
    expect(r.nextChapter?.index).toBe(9); expect(r.previousChapter).toBeNull()
    r.setPage(200); expect(r.pageIndex).toBe(2); r.setPage(-9); expect(r.pageIndex).toBe(0)
  })
  it('does not write merely because a chapter was opened', async () => {
    const r = useReaderStore(); await r.open('/api/v1', 1, 7)
    expect(api.modifyChapter).not.toHaveBeenCalled()
  })
  it('marks read only when explicitly saving the last zero-based page', async () => {
    const r = useReaderStore(); await r.open('/api/v1', 1, 7)
    await r.savePage(0); await r.savePage(2)
    expect(api.modifyChapter.mock.calls.map(c => c[2])).toEqual([{ lastPageRead: 0 }, { lastPageRead: 2, read: true }])
    expect(r.lastSavedPage).toBe(2)
  })
  it('pauses after an uncertain write and never blindly retries', async () => {
    const r = useReaderStore(); await r.open('/api/v1', 1, 7)
    api.modifyChapter.mockRejectedValueOnce(new Error('connection dropped'))
    expect(await r.savePage(1)).toBe(false); expect(await r.savePage(2)).toBe(false)
    expect(api.modifyChapter).toHaveBeenCalledTimes(1); expect(r.lastSavedPage).toBeNull()
    expect(r.saveError).toContain('may have reached')
    expect(await r.savePage(2, true)).toBe(true); expect(r.lastSavedPage).toBe(2)
  })
  it('serializes progress writes and deduplicates the same in-flight page', async () => {
    const r = useReaderStore(); await r.open('/api/v1', 1, 7)
    let resolve!: () => void
    api.modifyChapter.mockImplementationOnce(() => new Promise<void>(r => { resolve = r }))
    const a = r.savePage(0), duplicate = r.savePage(0), b = r.savePage(1)
    await vi.waitFor(() => expect(api.modifyChapter).toHaveBeenCalledTimes(1))
    resolve(); await Promise.all([a, duplicate, b])
    expect(api.modifyChapter).toHaveBeenCalledTimes(2); expect(r.lastSavedPage).toBe(1)
  })
  it('cancels queued writes and ignores in-flight completions after closing', async () => {
    const r = useReaderStore(); await r.open('/api/v1', 1, 7)
    let resolve!: () => void
    api.modifyChapter.mockImplementationOnce(() => new Promise<void>(r => { resolve = r }))
    const a = r.savePage(0), b = r.savePage(1)
    await vi.waitFor(() => expect(api.modifyChapter).toHaveBeenCalledTimes(1))
    r.close(); resolve(); await Promise.all([a, b])
    expect(api.modifyChapter).toHaveBeenCalledTimes(1); expect(r.chapter).toBeNull(); expect(r.lastSavedPage).toBeNull()
  })
  it('reports confirmed explicit bookmark commands without inferring legacy bookmark state', async () => {
    const r = useReaderStore(); await r.open('/api/v1', 1, 7); await r.bookmark(true)
    expect(api.modifyChapter).toHaveBeenCalledWith(1, 7, { bookmarked: true })
    expect(r.notice).toContain('added on server')
  })
  it('ignores a stale open response after switching chapters', async () => {
    const r = useReaderStore(); let resolve!: (v: typeof chapter) => void
    api.chapter.mockReturnValueOnce(new Promise(v => { resolve = v }))
    const first = r.open('/api/v1', 1, 7)
    api.chapter.mockResolvedValueOnce({ ...chapter, index: 9, pageCount: 2 })
    await r.open('/api/v1', 1, 9); resolve(chapter); await first
    expect(r.chapter?.index).toBe(9)
  })
})
