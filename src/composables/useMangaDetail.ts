import { ref } from 'vue'
import { apiErrorMessage, createSuwayomiApi } from '../api/client'
import type { Chapter, Manga } from '../api/types'
import { useConnectionStore } from '../stores/connection'

/**
 * useMangaDetail — Tier 2 Local Screen State composable.
 *
 * Encapsulates ephemeral single-entity manga details and chapter list fetching.
 */
export function useMangaDetail() {
  const connection = useConnectionStore()

  const manga = ref<Manga | null>(null)
  const chapters = ref<Chapter[]>([])
  const loadingManga = ref(false)
  const mangaError = ref<string | null>(null)
  const mutationError = ref<string | null>(null)

  let mangaRequest = 0

  async function loadManga(id: number, onlineFetch = false, silent = false) {
    const request = ++mangaRequest
    const api = createSuwayomiApi(connection.apiUrl)
    const isSameManga = manga.value?.id === id

    if (!isSameManga) {
      loadingManga.value = true
      mangaError.value = null
      mutationError.value = null
      manga.value = null
      chapters.value = []
    } else if (!silent) {
      loadingManga.value = true
    }

    try {
      const [detail, list] = await Promise.all([
        api.manga(id, onlineFetch),
        api.chapters(id, onlineFetch),
      ])
      if (request !== mangaRequest) return
      manga.value = detail
      chapters.value = list
      connection.connected = true
    } catch (error) {
      if (request === mangaRequest) {
        if (!isSameManga) mangaError.value = apiErrorMessage(error)
        else mutationError.value = apiErrorMessage(error)
      }
    } finally {
      if (request === mangaRequest) loadingManga.value = false
    }
  }

  function updateChapterLocally(
    index: number,
    patch: {
      read?: boolean
      bookmarked?: boolean
      markPrevRead?: boolean
      lastPageRead?: number
      downloaded?: boolean
    },
  ) {
    chapters.value = chapters.value.map(c => {
      if (c.index === index) {
        return {
          ...c,
          ...(patch.bookmarked !== undefined ? { bookmarked: patch.bookmarked } : {}),
          ...(patch.read !== undefined ? { read: patch.read } : {}),
          ...(patch.downloaded !== undefined ? { downloaded: patch.downloaded } : {}),
          ...(patch.lastPageRead !== undefined
            ? { lastPageRead: patch.lastPageRead }
            : (patch.read === false ? { lastPageRead: 0 } : {})),
        }
      }
      if (patch.markPrevRead && c.index < index) {
        return { ...c, read: true }
      }
      return c
    })
  }

  function updateChapterByIdLocally(id: number, patch: Partial<Chapter>) {
    chapters.value = chapters.value.map(c => {
      if (c.id === id) {
        return { ...c, ...patch }
      }
      return c
    })
  }

  function reset() {
    mangaRequest++
    manga.value = null
    chapters.value = []
    loadingManga.value = false
    mangaError.value = null
    mutationError.value = null
  }

  return {
    manga,
    chapters,
    loadingManga,
    mangaError,
    mutationError,
    loadManga,
    updateChapterLocally,
    updateChapterByIdLocally,
    reset,
  }
}
