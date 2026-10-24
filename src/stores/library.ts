import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiErrorMessage, createSuwayomiApi } from '../api/client'
import { deleteChapterDownload } from '../api/chapterDownloads'
import { updateChaptersBatch } from '../api/chaptersBatch'
import { pLimit } from '../utils/pLimit'
import type { Category, Manga } from '../api/types'
import { useConnectionStore } from './connection'

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
    reset,
  }
})
