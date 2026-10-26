import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'
import { apiErrorMessage, createSuwayomiApi } from '@/core/api/client'
import { deleteChapterDownload, enqueueChapterDownloadsBatch } from '@/core/api/chapterDownloads'
import { updateChaptersBatch } from '@/core/api/chaptersBatch'
import { updateMangasCategoriesBatch } from '@/core/api/categoriesBatch'
import { getUpdateSummary, triggerLibraryUpdate, type UpdateSummary } from '@/core/api/updater'
import { pLimit } from '@/core/utils/pLimit'
import type { Category, Manga } from '@/core/api/types'
import { useConnectionStore } from './connection'
import { useMangaOverridesStore } from '@/features/manga/stores/mangaOverrides'
import { useLibraryUpdateErrorsStore } from '@/features/updates/stores/libraryUpdateErrors'

export type BatchDownloadAction =
  | 'NEXT_1_CHAPTER'
  | 'NEXT_5_CHAPTERS'
  | 'NEXT_10_CHAPTERS'
  | 'NEXT_25_CHAPTERS'
  | 'UNREAD_CHAPTERS'
  | 'BOOKMARKED_CHAPTERS'

export const useLibraryStore = defineStore('library', () => {
  const connection = useConnectionStore()
  const overridesStore = useMangaOverridesStore()
  const updateErrorsStore = useLibraryUpdateErrorsStore()

  const categories = ref<Category[]>([])
  const rawLibraryByCategory = ref<Record<number, Manga[]>>({})
  const activeCategoryId = ref<number | null>(null)
  const loadingLibrary = ref(false)
  const libraryError = ref<string | null>(null)
  const mutatingLibrary = ref(false)
  const mutationError = ref<string | null>(null)
  const isInitialized = ref(false)
  const isLoaded = computed(() => isInitialized.value && categories.value.length > 0)
  const lastFetched = ref<number | null>(null)
  const lastSyncedAt = ref<number>(Date.now())
  const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

  let libraryRequest = 0

  const libraryByCategory = computed({
    get: () => {
      const result: Record<number, Manga[]> = {}
      for (const [k, v] of Object.entries(rawLibraryByCategory.value)) {
        result[Number(k)] = v.map(m => overridesStore.applyOverride(m))
      }
      return result
    },
    set: (val: Record<number, Manga[]>) => {
      rawLibraryByCategory.value = val
    },
  })

  const library = computed(() =>
    activeCategoryId.value === null ? [] : libraryByCategory.value[activeCategoryId.value] || [],
  )

  const totalLibraryCount = computed(
    () => new Set(Object.values(libraryByCategory.value).flat().map(item => item.id)).size,
  )

  async function loadLibrary(force = true) {
    if (!force && isInitialized.value && categories.value.length > 0) {
      const isExpired = lastFetched.value ? (Date.now() - lastFetched.value > CACHE_TTL_MS) : false
      if (!isExpired) {
        return
      }
      return silentRefreshLibrary()
    }

    const request = ++libraryRequest
    const api = createSuwayomiApi(connection.apiUrl)
    if (!isInitialized.value) {
      loadingLibrary.value = true
    }
    libraryError.value = null
    try {
      const fetchedCategories = (await api.categories()).sort((a, b) => a.order - b.order)
      const entries = await Promise.all(
        fetchedCategories.map(async c => [c.id, await api.categoryManga(c.id)] as const),
      )
      if (request !== libraryRequest) return
      categories.value = fetchedCategories
      rawLibraryByCategory.value = Object.fromEntries(entries)
      if (!fetchedCategories.some(c => c.id === activeCategoryId.value)) {
        activeCategoryId.value = fetchedCategories[0]?.id ?? null
      }
      isInitialized.value = true
      lastFetched.value = Date.now()
      lastSyncedAt.value = Date.now()
      connection.connected = true
    } catch (error) {
      if (request === libraryRequest) {
        libraryError.value = apiErrorMessage(error)
        connection.connected = false
      }
    } finally {
      if (request === libraryRequest) loadingLibrary.value = false
    }
  }

  async function ensureLibraryLoaded() {
    return loadLibrary(false)
  }

  /**
   * Performs an in-place merge of categories and category manga from the server,
   * preserving object identities and avoiding full list replacements so that
   * virtual scrollers (RecycleScroller) do not unmount or lose scroll position.
   */
  async function silentRefreshLibrary(): Promise<void> {
    const request = ++libraryRequest
    const gen = connection.serverGeneration
    const api = createSuwayomiApi(connection.apiUrl)
    try {
      const fetchedCategories = (await api.categories()).sort((a, b) => a.order - b.order)
      const entries = await Promise.all(
        fetchedCategories.map(async c => [c.id, await api.categoryManga(c.id)] as const),
      )
      if (request !== libraryRequest || gen !== connection.serverGeneration) return

      // 1. Update categories.value preserving existing Category objects if unchanged
      const currentCatsMap = new Map(categories.value.map(c => [c.id, c]))
      const nextCategories: Category[] = fetchedCategories.map(cat => {
        const existing = currentCatsMap.get(cat.id)
        if (existing) {
          Object.assign(existing, cat)
          return existing
        }
        return cat
      })
      categories.value = nextCategories

      if (!nextCategories.some(c => c.id === activeCategoryId.value)) {
        activeCategoryId.value = nextCategories[0]?.id ?? null
      }

      // 2. In-place merge of rawLibraryByCategory
      const fetchedCatIds = new Set(fetchedCategories.map(c => c.id))

      // Clean up categories no longer on server
      for (const key of Object.keys(rawLibraryByCategory.value)) {
        const numKey = Number(key)
        if (!fetchedCatIds.has(numKey)) {
          delete rawLibraryByCategory.value[numKey]
        }
      }

      for (const [catId, fetchedMangaList] of entries) {
        if (!rawLibraryByCategory.value[catId]) {
          rawLibraryByCategory.value[catId] = [...fetchedMangaList]
          continue
        }

        const currentList = rawLibraryByCategory.value[catId]!
        const newMangaMap = new Map<number, Manga>(fetchedMangaList.map(m => [m.id, m]))
        const currentIds = new Set<number>()

        // Update existing items in-place and remove deleted items
        for (let i = currentList.length - 1; i >= 0; i--) {
          const item = currentList[i]!
          const updated = newMangaMap.get(item.id)
          if (!updated) {
            currentList.splice(i, 1)
          } else {
            Object.assign(item, updated)
            currentIds.add(item.id)
          }
        }

        // Add newly added items to category
        for (const item of fetchedMangaList) {
          if (!currentIds.has(item.id)) {
            currentList.push(item)
          }
        }
      }

      isInitialized.value = true
      lastFetched.value = Date.now()
      lastSyncedAt.value = Date.now()
      connection.connected = true
    } catch {
      // Background re-fetch failed; retain current cached memory state
    }
  }

  // Tab visibility listener: silently refresh when returning to tab after > 60s
  if (typeof document !== 'undefined') {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (Date.now() - lastSyncedAt.value > 60 * 1000 && isInitialized.value) {
          void silentRefreshLibrary()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    onScopeDispose(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    })
  }

  // Server updater monitoring
  let updateMonitorTimer: ReturnType<typeof setInterval> | null = null
  let lastMonitorCompletedCount = -1
  let lastMonitorSilentRefresh = 0

  function stopUpdateMonitor() {
    if (updateMonitorTimer !== null) {
      clearInterval(updateMonitorTimer)
      updateMonitorTimer = null
    }
    lastMonitorCompletedCount = -1
    lastMonitorSilentRefresh = 0
  }

  async function checkUpdateStatus(): Promise<UpdateSummary | null> {
    try {
      const summary = await getUpdateSummary(connection.apiUrl)

      let total = 0
      let completed = 0
      if (summary.mangaStatusMap) {
        for (const [status, list] of Object.entries(summary.mangaStatusMap)) {
          const count = Array.isArray(list) ? list.length : 0
          total += count
          if (['COMPLETE', 'FAILED', 'SKIPPED'].includes(status.toUpperCase())) {
            completed += count
          }
        }
      }
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0

      if (summary.running) {
        updateErrorsStore.setUpdating(true, pct)

        const now = Date.now()
        if (completed !== lastMonitorCompletedCount || now - lastMonitorSilentRefresh >= 4000) {
          lastMonitorCompletedCount = completed
          lastMonitorSilentRefresh = now
          void silentRefreshLibrary()
        }
      } else {
        stopUpdateMonitor()
        updateErrorsStore.setUpdating(false, null)
        await silentRefreshLibrary()

        if (summary.mangaStatusMap?.FAILED && summary.mangaStatusMap.FAILED.length > 0) {
          for (const manga of summary.mangaStatusMap.FAILED) {
            updateErrorsStore.addError({
              mangaId: manga.id,
              title: manga.title,
              sourceId: String(manga.sourceId || ''),
              sourceName: typeof manga.source === 'string' ? manga.source : manga.source?.name || 'Unknown source',
              message: (manga as any).errorMessage || (manga as any).message || 'Failed to update manga',
            })
          }
        }
      }

      return summary
    } catch {
      return null
    }
  }

  function startUpdateMonitor() {
    stopUpdateMonitor()
    void checkUpdateStatus()
    updateMonitorTimer = setInterval(() => {
      void checkUpdateStatus()
    }, 2500)
  }

  async function triggerUpdate(categoryId?: number | null): Promise<{ started: boolean; categoryId?: number | null }> {
    const started = await triggerLibraryUpdate(connection.apiUrl, categoryId)
    if (started) {
      updateErrorsStore.setUpdating(true, 0)
      startUpdateMonitor()
    }
    return { started, categoryId }
  }

  onScopeDispose(() => {
    stopUpdateMonitor()
  })

  async function setLibraryMembership(mangaId: number, inLibrary: boolean): Promise<boolean> {
    if (mutatingLibrary.value) return false
    const gen = connection.serverGeneration
    mutatingLibrary.value = true
    mutationError.value = null
    try {
      const api = createSuwayomiApi(connection.apiUrl)
      await (inLibrary ? api.addToLibrary(mangaId) : api.removeFromLibrary(mangaId))
      if (gen !== connection.serverGeneration) return false
      await loadLibrary()
      return true
    } catch (error) {
      if (gen === connection.serverGeneration) {
        mutationError.value = `${apiErrorMessage(error)} Membership may be unchanged; refresh before retrying.`
      }
      return false
    } finally {
      mutatingLibrary.value = false
    }
  }

  async function removeMangas(mangas: Manga[], deleteFromLibrary: boolean, deleteChapters: boolean) {
    if (!mangas.length || mutatingLibrary.value) return
    const gen = connection.serverGeneration
    mutatingLibrary.value = true
    mutationError.value = null
    try {
      const api = createSuwayomiApi(connection.apiUrl)
      for (const manga of mangas) {
        if (deleteFromLibrary) await api.removeFromLibrary(manga.id)
        if (deleteChapters) {
          const chapters = await api.chapters(manga.id)
          for (const chapter of chapters) {
            if (chapter.downloaded) await deleteChapterDownload(connection.apiUrl, manga.id, chapter.index)
          }
        }
      }
      if (gen !== connection.serverGeneration) return
      await loadLibrary()
    } catch (error) {
      if (gen === connection.serverGeneration) {
        mutationError.value = `${apiErrorMessage(error)} The library may be unchanged; refresh before retrying.`
      }
    } finally {
      mutatingLibrary.value = false
    }
  }

  async function markMangasRead(mangas: Manga[], read: boolean) {
    if (!mangas.length || mutatingLibrary.value) return
    const gen = connection.serverGeneration
    mutatingLibrary.value = true
    mutationError.value = null
    try {
      const api = createSuwayomiApi(connection.apiUrl)
      const chaptersToUpdate: { mangaId: number; id: number; index: number }[] = []

      for (const manga of mangas) {
        const chapters = await api.chapters(manga.id)
        for (const chapter of chapters) {
          if (read) {
            if (!chapter.read) chaptersToUpdate.push({ mangaId: manga.id, id: chapter.id, index: chapter.index })
          } else if (chapter.read || chapter.lastPageRead > 0) {
            chaptersToUpdate.push({ mangaId: manga.id, id: chapter.id, index: chapter.index })
          }
        }
      }

      if (chaptersToUpdate.length > 0) {
        // Strategy 1: Attempt Suwayomi GraphQL native batch mutation in 1 roundtrip
        const ids = chaptersToUpdate.map(c => c.id)
        const batchSuccess = await updateChaptersBatch(connection.apiUrl, ids, {
          isRead: read,
          ...(read ? {} : { lastPageRead: 0 }),
        })

        // Strategy 2: If GraphQL batch fails or unsupported, fall back to concurrency-limited REST requests
        if (!batchSuccess) {
          const limit = pLimit(6)
          await Promise.all(
            chaptersToUpdate.map(ch =>
              limit(() =>
                api.modifyChapter(ch.mangaId, ch.index, read ? { read: true } : { read: false, lastPageRead: 0 }),
              ),
            ),
          )
        }
      }

      if (gen !== connection.serverGeneration) return
    } catch (error) {
      if (gen === connection.serverGeneration) {
        mutationError.value = `${apiErrorMessage(error)} The chapter states may be unchanged; refresh before retrying.`
      }
    } finally {
      mutatingLibrary.value = false
    }
  }

  /**
   * Optimistically updates the reactive libraryByCategory map.
   */
  function updateMangaCategoriesLocally(
    mangaIds: number[],
    addToCategories: number[],
    removeFromCategories: number[],
  ) {
    const next: Record<number, Manga[]> = {}
    for (const [k, v] of Object.entries(libraryByCategory.value)) {
      next[Number(k)] = [...v]
    }

    const mangaMap = new Map<number, Manga>()
    for (const list of Object.values(next)) {
      for (const m of list) {
        if (mangaIds.includes(m.id)) {
          mangaMap.set(m.id, m)
        }
      }
    }

    for (const catId of removeFromCategories) {
      if (next[catId]) {
        next[catId] = next[catId].filter(m => !mangaIds.includes(m.id))
      }
    }

    for (const catId of addToCategories) {
      if (!next[catId]) next[catId] = []
      const existingIds = new Set(next[catId].map(m => m.id))
      for (const id of mangaIds) {
        const m = mangaMap.get(id)
        if (m && !existingIds.has(id)) {
          next[catId].push(m)
        }
      }
    }

    // Default category (id 0) maintenance
    const nonDefaultCats = categories.value.filter(c => c.id !== 0).map(c => c.id)
    if (next[0]) {
      next[0] = next[0].filter(m => {
        if (!mangaIds.includes(m.id)) return true
        const inCustom = nonDefaultCats.some(cid => (next[cid] || []).some(item => item.id === m.id))
        return !inCustom
      })
      for (const id of mangaIds) {
        const inCustom = nonDefaultCats.some(cid => (next[cid] || []).some(item => item.id === id))
        if (!inCustom) {
          const m = mangaMap.get(id)
          if (m && !next[0].some(item => item.id === id)) {
            next[0].push(m)
          }
        }
      }
    }

    libraryByCategory.value = next
  }

  /**
   * Sets categories for multiple manga entries with optimistic update,
   * GraphQL batch mutation, and fallback to single-entry mutations.
   */
  async function setMangaCategories(
    mangaIds: number[],
    addToCategories: number[],
    removeFromCategories: number[],
  ): Promise<boolean> {
    if (!mangaIds.length || mutatingLibrary.value) return false
    const gen = connection.serverGeneration
    mutatingLibrary.value = true
    mutationError.value = null

    const currentCategoriesByManga: Record<number, number[]> = {}
    for (const id of mangaIds) {
      currentCategoriesByManga[id] = categories.value
        .filter(c => (libraryByCategory.value[c.id] || []).some(m => m.id === id))
        .map(c => c.id)
    }

    updateMangaCategoriesLocally(mangaIds, addToCategories, removeFromCategories)

    try {
      const success = await updateMangasCategoriesBatch(
        connection.apiUrl,
        mangaIds,
        { addToCategories, removeFromCategories },
        currentCategoriesByManga,
      )

      if (!success) {
        throw new Error('Failed to update manga categories.')
      }

      if (gen === connection.serverGeneration) {
        await loadLibrary()
      }
      return true
    } catch (error) {
      if (gen === connection.serverGeneration) {
        mutationError.value = `${apiErrorMessage(error)} Category changes may not have persisted; refreshing.`
        await loadLibrary()
      }
      return false
    } finally {
      mutatingLibrary.value = false
    }
  }

  /**
   * Batch queues chapters for download across selected manga.
   */
  async function batchDownloadChapters(mangaList: Manga[], action: BatchDownloadAction): Promise<number> {
    if (!mangaList.length) return 0
    const api = createSuwayomiApi(connection.apiUrl)
    const chapterIdsToQueue: number[] = []

    for (const manga of mangaList) {
      try {
        const chapters = await api.chapters(manga.id)
        const sorted = [...chapters].sort((a, b) => {
          if (a.chapterNumber >= 0 && b.chapterNumber >= 0) {
            return a.chapterNumber - b.chapterNumber
          }
          return a.index - b.index
        })

        const eligible = sorted.filter(c => !c.downloaded)

        let targets: typeof eligible = []
        if (action === 'NEXT_1_CHAPTER') {
          targets = eligible.filter(c => !c.read).slice(0, 1)
        } else if (action === 'NEXT_5_CHAPTERS') {
          targets = eligible.filter(c => !c.read).slice(0, 5)
        } else if (action === 'NEXT_10_CHAPTERS') {
          targets = eligible.filter(c => !c.read).slice(0, 10)
        } else if (action === 'NEXT_25_CHAPTERS') {
          targets = eligible.filter(c => !c.read).slice(0, 25)
        } else if (action === 'UNREAD_CHAPTERS') {
          targets = eligible.filter(c => !c.read)
        } else if (action === 'BOOKMARKED_CHAPTERS') {
          targets = eligible.filter(c => c.bookmarked)
        }

        for (const ch of targets) {
          chapterIdsToQueue.push(ch.id)
        }
      } catch (e) {
        console.warn(`Failed to retrieve chapters for manga ${manga.id}:`, e)
      }
    }

    if (chapterIdsToQueue.length > 0) {
      await enqueueChapterDownloadsBatch(connection.apiUrl, chapterIdsToQueue)
    }

    return chapterIdsToQueue.length
  }

  function reset() {
    stopUpdateMonitor()
    libraryRequest++
    categories.value = []
    rawLibraryByCategory.value = {}
    activeCategoryId.value = null
    loadingLibrary.value = false
    libraryError.value = null
    mutatingLibrary.value = false
    mutationError.value = null
    isInitialized.value = false
    lastFetched.value = null
    lastSyncedAt.value = Date.now()
  }

  return {
    categories,
    rawLibraryByCategory,
    libraryByCategory,
    activeCategoryId,
    loadingLibrary,
    libraryError,
    mutatingLibrary,
    mutationError,
    isInitialized,
    isLoaded,
    lastFetched,
    lastSyncedAt,
    library,
    totalLibraryCount,
    loadLibrary,
    ensureLibraryLoaded,
    silentRefreshLibrary,
    triggerUpdate,
    startUpdateMonitor,
    checkUpdateStatus,
    stopUpdateMonitor,
    setLibraryMembership,
    removeMangas,
    markMangasRead,
    updateMangaCategoriesLocally,
    setMangaCategories,
    batchDownloadChapters,
    reset,
  }
})
