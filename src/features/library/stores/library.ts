import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiErrorMessage, createSuwayomiApi } from '@/core/api/client'
import { deleteChapterDownload, enqueueChapterDownloadsBatch } from '@/core/api/chapterDownloads'
import { updateChaptersBatch } from '@/core/api/chaptersBatch'
import { updateMangasCategoriesBatch } from '@/core/api/categoriesBatch'
import { pLimit } from '@/core/utils/pLimit'
import type { Category, Manga } from '@/core/api/types'
import { useConnectionStore } from './connection'

export type BatchDownloadAction =
  | 'NEXT_1_CHAPTER'
  | 'NEXT_5_CHAPTERS'
  | 'NEXT_10_CHAPTERS'
  | 'NEXT_25_CHAPTERS'
  | 'UNREAD_CHAPTERS'
  | 'BOOKMARKED_CHAPTERS'

export const useLibraryStore = defineStore('library', () => {
  const connection = useConnectionStore()

  const categories = ref<Category[]>([])
  const libraryByCategory = ref<Record<number, Manga[]>>({})
  const activeCategoryId = ref<number | null>(null)
  const loadingLibrary = ref(false)
  const libraryError = ref<string | null>(null)
  const mutatingLibrary = ref(false)
  const mutationError = ref<string | null>(null)

  let libraryRequest = 0

  const library = computed(() =>
    activeCategoryId.value === null ? [] : libraryByCategory.value[activeCategoryId.value] || [],
  )

  const totalLibraryCount = computed(
    () => new Set(Object.values(libraryByCategory.value).flat().map(item => item.id)).size,
  )

  async function loadLibrary() {
    const request = ++libraryRequest
    const api = createSuwayomiApi(connection.apiUrl)
    loadingLibrary.value = true
    libraryError.value = null
    try {
      const fetchedCategories = (await api.categories()).sort((a, b) => a.order - b.order)
      const entries = await Promise.all(
        fetchedCategories.map(async c => [c.id, await api.categoryManga(c.id)] as const),
      )
      if (request !== libraryRequest) return
      categories.value = fetchedCategories
      libraryByCategory.value = Object.fromEntries(entries)
      if (!fetchedCategories.some(c => c.id === activeCategoryId.value)) {
        activeCategoryId.value = fetchedCategories[0]?.id ?? null
      }
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
    libraryRequest++
    categories.value = []
    libraryByCategory.value = {}
    activeCategoryId.value = null
    loadingLibrary.value = false
    libraryError.value = null
    mutatingLibrary.value = false
    mutationError.value = null
  }

  return {
    categories,
    libraryByCategory,
    activeCategoryId,
    loadingLibrary,
    libraryError,
    mutatingLibrary,
    mutationError,
    library,
    totalLibraryCount,
    loadLibrary,
    setLibraryMembership,
    removeMangas,
    markMangasRead,
    updateMangaCategoriesLocally,
    setMangaCategories,
    batchDownloadChapters,
    reset,
  }
})
