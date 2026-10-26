import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { ofetch } from 'ofetch'
import { category, manga } from '../fixtures'
import { MR } from '@/core/i18n'
import en from '@/locales/en.json'
import ru from '@/locales/ru.json'

// API mocks
const api = vi.hoisted(() => ({
  categories: vi.fn(),
  categoryManga: vi.fn(),
  manga: vi.fn(),
  chapters: vi.fn(),
  sources: vi.fn(),
  addToLibrary: vi.fn(),
  removeFromLibrary: vi.fn(),
}))

vi.mock('@/core/api/client', async importOriginal => ({
  ...await importOriginal<typeof import('@/core/api/client')>(),
  createSuwayomiApi: () => api,
}))

import { triggerLibraryUpdate, getUpdateSummary, type UpdateSummary } from '@/core/api/updater'
import { useLibraryStore } from '@/features/library/stores/library'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { useLibraryUpdateErrorsStore } from '@/features/updates/stores/libraryUpdateErrors'

describe('Suwayomi Updater API client (src/core/api/updater.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('triggers library update without category query parameter', async () => {
    const rawSpy = vi.spyOn(ofetch, 'raw').mockResolvedValueOnce({
      status: 200,
      _data: null,
      headers: new Headers(),
      ok: true,
      redirected: false,
      statusText: 'OK',
      type: 'basic',
      url: 'http://localhost:4567/api/v1/update/fetch',
    } as any)

    const result = await triggerLibraryUpdate('http://localhost:4567/api/v1')
    expect(result).toBe(true)
    expect(rawSpy).toHaveBeenCalledWith(
      'http://localhost:4567/api/v1/update/fetch',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('triggers library update with category query parameter', async () => {
    const rawSpy = vi.spyOn(ofetch, 'raw').mockResolvedValueOnce({
      status: 204,
      _data: null,
      headers: new Headers(),
      ok: true,
      redirected: false,
      statusText: 'No Content',
      type: 'basic',
      url: 'http://localhost:4567/api/v1/update/fetch?category=42',
    } as any)

    const result = await triggerLibraryUpdate('http://localhost:4567/api/v1', 42)
    expect(result).toBe(true)
    expect(rawSpy).toHaveBeenCalledWith(
      'http://localhost:4567/api/v1/update/fetch?category=42',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('returns false when trigger update returns non-200/204 or throws', async () => {
    vi.spyOn(ofetch, 'raw').mockRejectedValueOnce(new Error('Network error'))

    const result = await triggerLibraryUpdate('http://localhost:4567/api/v1', 1)
    expect(result).toBe(false)
  })

  it('fetches update summary from GET /update/summary', async () => {
    const mockSummary: UpdateSummary = {
      running: true,
      categoryStatusMap: {
        RUNNING: [category(1, 'Reading')],
      },
      mangaStatusMap: {
        COMPLETE: [manga(10)],
        FAILED: [manga(20)],
      },
    }

    vi.spyOn(ofetch, 'raw').mockResolvedValueOnce({
      status: 200,
      _data: mockSummary,
      headers: new Headers(),
      ok: true,
      redirected: false,
      statusText: 'OK',
      type: 'basic',
      url: 'http://localhost:4567/api/v1/update/summary',
    } as any)

    const summary = await getUpdateSummary('http://localhost:4567/api/v1')
    expect(summary).toEqual(mockSummary)
    expect(summary.running).toBe(true)
  })
})

describe('silentRefreshLibrary in-place merging (src/features/library/stores/library.ts)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('updates category manga in-place without replacing item object instances or tearing down arrays', async () => {
    const initialCategories = [
      category(1, 'Reading', 0),
      category(2, 'Completed', 1),
    ]
    const initialManga101 = manga(101, 'Manga 101', 5)
    const initialManga102 = manga(102, 'Manga 102', 3)
    const initialManga201 = manga(201, 'Manga 201', 0)

    api.categories.mockResolvedValueOnce(initialCategories)
    api.categoryManga.mockImplementation(async (catId: number) => {
      if (catId === 1) return [initialManga101, initialManga102]
      if (catId === 2) return [initialManga201]
      return []
    })

    const libraryStore = useLibraryStore()
    await libraryStore.loadLibrary()

    // Capture initial references
    const cat1Obj = libraryStore.categories[0]!
    const cat1Array = libraryStore.rawLibraryByCategory[1]!
    const manga101Obj = cat1Array[0]!
    const initialSyncTime = libraryStore.lastSyncedAt

    expect(cat1Array.length).toBe(2)
    expect(manga101Obj.unreadCount).toBe(5)
    expect(libraryStore.loadingLibrary).toBe(false)

    // Prepare updated data for silent refresh:
    // - Category 1 name changed to 'Reading Updated'
    // - Manga 101 has unreadCount changed from 5 -> 1
    // - Manga 102 is removed from category 1
    // - Manga 103 is newly added to category 1
    const updatedCategories = [
      category(1, 'Reading Updated', 0),
      category(2, 'Completed', 1),
    ]
    const updatedManga101 = { ...manga(101, 'Manga 101 Renamed', 1) }
    const newManga103 = manga(103, 'Manga 103 New', 10)

    api.categories.mockResolvedValueOnce(updatedCategories)
    api.categoryManga.mockImplementation(async (catId: number) => {
      if (catId === 1) return [updatedManga101, newManga103]
      if (catId === 2) return [initialManga201]
      return []
    })

    // Perform silent background refresh
    await libraryStore.silentRefreshLibrary()

    // 1. loadingLibrary must stay false
    expect(libraryStore.loadingLibrary).toBe(false)

    // 2. Category object reference stability
    expect(libraryStore.categories[0]).toBe(cat1Obj)
    expect(cat1Obj.name).toBe('Reading Updated')

    // 3. Category array reference stability
    expect(libraryStore.rawLibraryByCategory[1]).toBe(cat1Array)

    // 4. Manga item object reference stability (in-place Object.assign)
    expect(cat1Array[0]).toBe(manga101Obj)
    expect(manga101Obj.title).toBe('Manga 101 Renamed')
    expect(manga101Obj.unreadCount).toBe(1)

    // 5. Deleted manga removed from category array
    expect(cat1Array.some(m => m.id === 102)).toBe(false)

    // 6. Newly added manga appended to category array
    expect(cat1Array.some(m => m.id === 103)).toBe(true)
    expect(cat1Array.length).toBe(2)

    // 7. Timestamps updated
    expect(libraryStore.lastSyncedAt).toBeGreaterThanOrEqual(initialSyncTime)
    expect(libraryStore.lastFetched).not.toBeNull()
    expect(libraryStore.isInitialized).toBe(true)
  })

  it('suwayomi store forwards lastSyncedAt, silentRefreshLibrary and triggerUpdate', async () => {
    api.categories.mockResolvedValue([category(1, 'Default', 0)])
    api.categoryManga.mockResolvedValue([manga(1)])

    const suwayomiStore = useSuwayomiStore()
    const libraryStore = useLibraryStore()

    expect(suwayomiStore.lastSyncedAt).toBe(libraryStore.lastSyncedAt)
    expect(typeof suwayomiStore.silentRefreshLibrary).toBe('function')
    expect(typeof suwayomiStore.triggerUpdate).toBe('function')

    await suwayomiStore.silentRefreshLibrary()
    expect(suwayomiStore.categories.length).toBe(1)
  })
})

describe('Server updater monitoring and triggerUpdate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('calculates progress percentage and sets updating state while running', async () => {
    const libraryStore = useLibraryStore()
    const errorsStore = useLibraryUpdateErrorsStore()

    // Mock summary with running = true and 1 completed out of 2 total
    const mockRunningSummary: UpdateSummary = {
      running: true,
      mangaStatusMap: {
        COMPLETE: [manga(10)],
        RUNNING: [manga(20)],
      },
    }

    vi.spyOn(ofetch, 'raw').mockResolvedValue({
      status: 200,
      _data: null,
    } as any)

    const updaterModule = await import('@/core/api/updater')
    vi.spyOn(updaterModule, 'getUpdateSummary').mockResolvedValue(mockRunningSummary)

    // Check status
    await libraryStore.checkUpdateStatus()

    expect(errorsStore.updating).toBe(true)
    expect(errorsStore.progress).toBe(50) // 1/2 = 50%
  })

  it('stops monitoring, resets updating, runs silent refresh and records failed manga on finish', async () => {
    const libraryStore = useLibraryStore()
    const errorsStore = useLibraryUpdateErrorsStore()

    api.categories.mockResolvedValue([category(1, 'All', 0)])
    api.categoryManga.mockResolvedValue([])

    const failedManga = manga(99, 'Broken manga')
    const mockFinishedSummary: UpdateSummary = {
      running: false,
      mangaStatusMap: {
        COMPLETE: [manga(10)],
        FAILED: [failedManga],
      },
    }

    const updaterModule = await import('@/core/api/updater')
    vi.spyOn(updaterModule, 'getUpdateSummary').mockResolvedValue(mockFinishedSummary)

    await libraryStore.checkUpdateStatus()

    expect(errorsStore.updating).toBe(false)
    expect(errorsStore.progress).toBeNull()
    expect(errorsStore.errors.some(e => e.mangaId === 99)).toBe(true)
  })
})

describe('LibraryToolbar.vue overflow menu & localization', () => {
  const toolbarSource = readFileSync('src/features/library/components/LibraryToolbar.vue', 'utf8')

  it('defines sync-library in emits and updates overflow menu with localized strings in exact order', () => {
    // 1. Emit declaration
    expect(toolbarSource).toContain("(event: 'sync-library'): void")

    // 2. Resource keys in template
    expect(toolbarSource).toContain('MR.strings.action_update_category')
    expect(toolbarSource).toContain('MR.strings.action_update_library')
    expect(toolbarSource).toContain('MR.strings.action_sync_library')
    expect(toolbarSource).toContain('MR.strings.action_open_random_manga')

    // 3. Exact order of menu items: Update category -> Update library -> Sync with server -> Open random entry
    const catIdx = toolbarSource.indexOf('MR.strings.action_update_category')
    const libIdx = toolbarSource.indexOf('MR.strings.action_update_library')
    const syncIdx = toolbarSource.indexOf('MR.strings.action_sync_library')
    const randIdx = toolbarSource.indexOf('MR.strings.action_open_random_manga')

    expect(catIdx).toBeGreaterThan(-1)
    expect(libIdx).toBeGreaterThan(catIdx)
    expect(syncIdx).toBeGreaterThan(libIdx)
    expect(randIdx).toBeGreaterThan(syncIdx)

    // 4. Click event handlers
    expect(toolbarSource).toContain("@click=\"overflowOpen = false; emit('update-category')\"")
    expect(toolbarSource).toContain("@click=\"overflowOpen = false; emit('update-library')\"")
    expect(toolbarSource).toContain("@click=\"overflowOpen = false; emit('sync-library')\"")
    expect(toolbarSource).toContain("@click=\"overflowOpen = false; emit('open-random')\"")
  })

  it('provides English and Russian translations for action_sync_library and library_synced_with_server', () => {
    expect(MR.strings.action_sync_library).toBe('action_sync_library')
    expect(MR.strings.library_synced_with_server).toBe('library_synced_with_server')

    expect(en.action_sync_library).toBe('Sync with server')
    expect(en.library_synced_with_server).toBe('Library synced with server')

    expect(ru.action_sync_library).toBe('Синхронизировать с сервером')
    expect(ru.library_synced_with_server).toBe('Библиотека синхронизирована с сервером')
  })
})
