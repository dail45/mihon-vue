import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiErrorMessage, createSuwayomiApi, DEFAULT_API_URL, normalizeApiUrl } from '../api/client'
import { deleteChapterDownload } from '../api/chapterDownloads'
import type { Category, Chapter, Manga, Source } from '../api/types'
import { readPreference, writePreference } from './preferences'
export const useSuwayomiStore = defineStore('suwayomi', () => {
  let initialUrl = DEFAULT_API_URL
  try { initialUrl = normalizeApiUrl(readPreference('mihon.apiUrl') || DEFAULT_API_URL) } catch { /* invalid saved setting */ }
  const apiUrl = ref(initialUrl)
  const categories = ref<Category[]>([])
  const libraryByCategory = ref<Record<number, Manga[]>>({})
  const activeCategoryId = ref<number | null>(null)
  const loadingLibrary = ref(false)
  const libraryError = ref<string | null>(null)
  const connected = ref(false)
  const manga = ref<Manga | null>(null)
  const chapters = ref<Chapter[]>([])
  const loadingManga = ref(false)
  const mangaError = ref<string | null>(null)
  const mutatingLibrary = ref(false)
  const mutationError = ref<string | null>(null)
  const sources = ref<Source[]>([])
  const loadingSources = ref(false)
  /** True once a `/source/list` request settled (successfully or not). */
  const sourcesLoaded = ref(false)
  const sourcesError = ref<string | null>(null)
  let libraryRequest = 0, mangaRequest = 0, sourceRequest = 0, serverGeneration = 0
  const library = computed(() => activeCategoryId.value === null ? [] : libraryByCategory.value[activeCategoryId.value] || [])
  const totalLibraryCount = computed(() => new Set(Object.values(libraryByCategory.value).flat().map(item => item.id)).size)
  function setApiUrl(value: string) {
    const url = normalizeApiUrl(value)
    if (url === apiUrl.value) return
    apiUrl.value = url
    writePreference('mihon.apiUrl', url)
    serverGeneration++; libraryRequest++; mangaRequest++; sourceRequest++
    connected.value = false; categories.value = []; libraryByCategory.value = {}; activeCategoryId.value = null
    manga.value = null; chapters.value = []; sources.value = []
    loadingLibrary.value = false; loadingManga.value = false; loadingSources.value = false
    sourcesLoaded.value = false
    libraryError.value = null; mangaError.value = null; sourcesError.value = null; mutationError.value = null
  }
  async function loadLibrary() {
    const request = ++libraryRequest
    const api = createSuwayomiApi(apiUrl.value)
    loadingLibrary.value = true; libraryError.value = null
    try {
      const fetchedCategories = (await api.categories()).sort((a, b) => a.order - b.order)
      // Default category is uncategorized only. Load EVERY category, never assume category 0 = whole library.
      const entries = await Promise.all(fetchedCategories.map(async c => [c.id, await api.categoryManga(c.id)] as const))
      if (request !== libraryRequest) return
      categories.value = fetchedCategories; libraryByCategory.value = Object.fromEntries(entries)
      if (!fetchedCategories.some(c => c.id === activeCategoryId.value)) activeCategoryId.value = fetchedCategories[0]?.id ?? null
      connected.value = true
    } catch (error) {
      if (request === libraryRequest) { libraryError.value = apiErrorMessage(error); connected.value = false }
    } finally { if (request === libraryRequest) loadingLibrary.value = false }
  }
  async function loadManga(id: number, onlineFetch = false, silent = false) {
    const request = ++mangaRequest
    const api = createSuwayomiApi(apiUrl.value)
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
      const [detail, list] = await Promise.all([api.manga(id, onlineFetch), api.chapters(id, onlineFetch)])
      if (request !== mangaRequest) return
      manga.value = detail; chapters.value = list; connected.value = true
    } catch (error) {
      if (request === mangaRequest) {
        if (!isSameManga) mangaError.value = apiErrorMessage(error)
        else mutationError.value = apiErrorMessage(error)
      }
    }
    finally { if (request === mangaRequest) loadingManga.value = false }
  }
  function updateChapterLocally(index: number, patch: { read?: boolean; bookmarked?: boolean; markPrevRead?: boolean; lastPageRead?: number; downloaded?: boolean }) {
    chapters.value = chapters.value.map(c => {
      if (c.index === index) {
        return {
          ...c,
          ...(patch.bookmarked !== undefined ? { bookmarked: patch.bookmarked } : {}),
          ...(patch.read !== undefined ? { read: patch.read } : {}),
          ...(patch.downloaded !== undefined ? { downloaded: patch.downloaded } : {}),
          ...(patch.lastPageRead !== undefined ? { lastPageRead: patch.lastPageRead } : (patch.read === false ? { lastPageRead: 0 } : {})),
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
  async function setLibraryMembership(inLibrary: boolean) {
    if (!manga.value || mutatingLibrary.value) return
    const current = manga.value, generation = serverGeneration
    mutatingLibrary.value = true; mutationError.value = null
    try {
      const api = createSuwayomiApi(apiUrl.value)
      await (inLibrary ? api.addToLibrary(current.id) : api.removeFromLibrary(current.id))
      if (generation !== serverGeneration) return
      if (manga.value?.id === current.id) manga.value = { ...manga.value, inLibrary }
      await loadLibrary()
    } catch (error) {
      if (generation === serverGeneration) mutationError.value = `${apiErrorMessage(error)} Membership may be unchanged; refresh before retrying.`
    } finally { mutatingLibrary.value = false }
  }
  /**
   * Mihon `LibraryViewModel.removeMangas(mangas, deleteFromLibrary, deleteChapters)`:
   * the library membership is dropped and the downloaded chapters are deleted.
   * Suwayomi models the membership with `DELETE /manga/{id}/library` and the downloaded
   * chapters with `DELETE /manga/{id}/chapter/{chapterIndex}`.
   */
  async function removeMangas(mangas: Manga[], deleteFromLibrary: boolean, deleteChapters: boolean) {
    if (!mangas.length || mutatingLibrary.value) return
    const generation = serverGeneration
    mutatingLibrary.value = true; mutationError.value = null
    try {
      const api = createSuwayomiApi(apiUrl.value)
      for (const manga of mangas) {
        if (deleteFromLibrary) await api.removeFromLibrary(manga.id)
        if (deleteChapters) {
          const chapters = await api.chapters(manga.id)
          for (const chapter of chapters) {
            if (chapter.downloaded) await deleteChapterDownload(apiUrl.value, manga.id, chapter.index)
          }
        }
      }
      if (generation !== serverGeneration) return
      await loadLibrary()
    } catch (error) {
      if (generation === serverGeneration) mutationError.value = `${apiErrorMessage(error)} The library may be unchanged; refresh before retrying.`
    } finally { mutatingLibrary.value = false }
  }
  /**
   * Mihon `LibraryViewModel.markAsRead` / `markAsUnread` of the selected library entries:
   * every chapter of the selected manga is marked as read (or unread).
   *
   * Suwayomi models a chapter state with
   * `PATCH /manga/{mangaId}/chapter/{chapterIndex}` (`read`, `lastPageRead`).
   */
  async function markMangasRead(mangas: Manga[], read: boolean) {
    if (!mangas.length || mutatingLibrary.value) return
    const generation = serverGeneration
    mutatingLibrary.value = true; mutationError.value = null
    try {
      const api = createSuwayomiApi(apiUrl.value)
      for (const manga of mangas) {
        const chapters = await api.chapters(manga.id)
        for (const chapter of chapters) {
          if (read) {
            if (!chapter.read) await api.modifyChapter(manga.id, chapter.index, { read: true })
          } else if (chapter.read || chapter.lastPageRead > 0) {
            await api.modifyChapter(manga.id, chapter.index, { read: false, lastPageRead: 0 })
          }
        }
      }
      if (generation !== serverGeneration) return
    } catch (error) {
      if (generation === serverGeneration) mutationError.value = `${apiErrorMessage(error)} The chapter states may be unchanged; refresh before retrying.`
    } finally { mutatingLibrary.value = false }
  }
  async function loadSources() {
    const request = ++sourceRequest, api = createSuwayomiApi(apiUrl.value)
    loadingSources.value = true; sourcesError.value = null
    try {
      const list = await api.sources()
      if (request === sourceRequest) { sources.value = list; connected.value = true }
    } catch (error) { if (request === sourceRequest) sourcesError.value = apiErrorMessage(error) }
    finally { if (request === sourceRequest) { loadingSources.value = false; sourcesLoaded.value = true } }
  }
  function thumbnailUrl(id: number) { return `${apiUrl.value}/manga/${id}/thumbnail` }
  return { apiUrl, categories, libraryByCategory, activeCategoryId, library, totalLibraryCount,
    loadingLibrary, libraryError, connected, manga, chapters, loadingManga, mangaError,
    mutatingLibrary, mutationError, sources, loadingSources, sourcesLoaded, sourcesError,
    setApiUrl, loadLibrary, loadManga, updateChapterLocally, updateChapterByIdLocally, setLibraryMembership, removeMangas, markMangasRead, loadSources, thumbnailUrl }
})
