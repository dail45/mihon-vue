import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useConnectionStore } from './connection'
import { useLibraryStore, type BatchDownloadAction } from './library'
import { useSourcesStore } from '@/features/browse/stores/sources'
import { useMangaDetail } from '@/features/manga/composables/useMangaDetail'
import type { Category, Chapter, Manga, Source } from '@/core/api/types'

export type { BatchDownloadAction }

/**
 * Composite store facade maintaining full backwards compatibility.
 * Decomposes internal responsibilities across:
 * - `useConnectionStore` (server connection & API base URL)
 * - `useLibraryStore` (categories, library items, chapter batch mutations)
 * - `useSourcesStore` (installed source catalogue)
 * - `useMangaDetail` (ephemeral single manga & chapter list state)
 */
export const useSuwayomiStore = defineStore('suwayomi', () => {
  const connection = useConnectionStore()
  const libraryStore = useLibraryStore()
  const sourcesStore = useSourcesStore()
  const mangaDetail = useMangaDetail()

  const apiUrl = computed({
    get: () => connection.apiUrl,
    set: (val: string) => setApiUrl(val),
  })

  const connected = computed({
    get: () => connection.connected,
    set: (val: boolean) => { connection.connected = val },
  })

  function setApiUrl(value: string) {
    connection.setApiUrl(value)
    libraryStore.reset()
    sourcesStore.reset()
    mangaDetail.reset()
  }

  function thumbnailUrl(id: number) {
    return connection.thumbnailUrl(id)
  }

  // Library state & actions
  const categories = computed({
    get: () => libraryStore.categories,
    set: (val: Category[]) => { libraryStore.categories = val },
  })
  const libraryByCategory = computed({
    get: () => libraryStore.libraryByCategory,
    set: (val: Record<number, Manga[]>) => { libraryStore.libraryByCategory = val },
  })
  const activeCategoryId = computed({
    get: () => libraryStore.activeCategoryId,
    set: (val: number | null) => { libraryStore.activeCategoryId = val },
  })
  const loadingLibrary = computed({
    get: () => libraryStore.loadingLibrary,
    set: (val: boolean) => { libraryStore.loadingLibrary = val },
  })
  const libraryError = computed({
    get: () => libraryStore.libraryError,
    set: (val: string | null) => { libraryStore.libraryError = val },
  })
  const mutatingLibrary = computed({
    get: () => libraryStore.mutatingLibrary,
    set: (val: boolean) => { libraryStore.mutatingLibrary = val },
  })
  const mutationError = computed({
    get: () => libraryStore.mutationError || mangaDetail.mutationError.value,
    set: (val: string | null) => {
      libraryStore.mutationError = val
      mangaDetail.mutationError.value = val
    },
  })
  const library = computed(() => libraryStore.library)
  const totalLibraryCount = computed(() => libraryStore.totalLibraryCount)
  const isInitialized = computed(() => libraryStore.isInitialized)
  const isLoaded = computed(() => libraryStore.isLoaded)
  const lastSyncedAt = computed({
    get: () => libraryStore.lastSyncedAt,
    set: (val: number) => { libraryStore.lastSyncedAt = val },
  })

  async function silentRefreshLibrary() {
    return libraryStore.silentRefreshLibrary()
  }

  async function triggerUpdate(categoryId?: number | null) {
    return libraryStore.triggerUpdate(categoryId)
  }

  async function ensureLibraryLoaded() {
    return libraryStore.ensureLibraryLoaded()
  }

  async function loadLibrary(force = true) {
    return libraryStore.loadLibrary(force)
  }

  async function setLibraryMembership(inLibrary: boolean) {
    if (!mangaDetail.manga.value) return
    const current = mangaDetail.manga.value
    const success = await libraryStore.setLibraryMembership(current.id, inLibrary)
    if (success && mangaDetail.manga.value?.id === current.id) {
      mangaDetail.manga.value = { ...mangaDetail.manga.value, inLibrary }
    }
  }

  async function removeMangas(mangas: Manga[], deleteFromLibrary: boolean, deleteChapters: boolean) {
    return libraryStore.removeMangas(mangas, deleteFromLibrary, deleteChapters)
  }

  async function markMangasRead(mangas: Manga[], read: boolean) {
    return libraryStore.markMangasRead(mangas, read)
  }

  function updateMangaCategoriesLocally(
    mangaIds: number[],
    addToCategories: number[],
    removeFromCategories: number[],
  ) {
    libraryStore.updateMangaCategoriesLocally(mangaIds, addToCategories, removeFromCategories)
  }

  async function setMangaCategories(
    mangaIds: number[],
    addToCategories: number[],
    removeFromCategories: number[],
  ) {
    return libraryStore.setMangaCategories(mangaIds, addToCategories, removeFromCategories)
  }

  async function batchDownloadChapters(mangaList: Manga[], action: BatchDownloadAction) {
    return libraryStore.batchDownloadChapters(mangaList, action)
  }

  // Sources state & actions
  const sources = computed({
    get: () => sourcesStore.sources,
    set: (val: Source[]) => { sourcesStore.sources = val },
  })
  const loadingSources = computed({
    get: () => sourcesStore.loadingSources,
    set: (val: boolean) => { sourcesStore.loadingSources = val },
  })
  const sourcesLoaded = computed({
    get: () => sourcesStore.sourcesLoaded,
    set: (val: boolean) => { sourcesStore.sourcesLoaded = val },
  })
  const sourcesError = computed({
    get: () => sourcesStore.sourcesError,
    set: (val: string | null) => { sourcesStore.sourcesError = val },
  })

  async function loadSources() {
    return sourcesStore.loadSources()
  }

  // Manga detail state & actions
  const manga = computed({
    get: () => mangaDetail.manga.value,
    set: (val: Manga | null) => { mangaDetail.manga.value = val },
  })
  const chapters = computed({
    get: () => mangaDetail.chapters.value,
    set: (val: Chapter[]) => { mangaDetail.chapters.value = val },
  })
  const loadingManga = computed({
    get: () => mangaDetail.loadingManga.value,
    set: (val: boolean) => { mangaDetail.loadingManga.value = val },
  })
  const mangaError = computed({
    get: () => mangaDetail.mangaError.value,
    set: (val: string | null) => { mangaDetail.mangaError.value = val },
  })

  async function loadManga(id: number, onlineFetch = false, silent = false) {
    return mangaDetail.loadManga(id, onlineFetch, silent)
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
    mangaDetail.updateChapterLocally(index, patch)
  }

  function updateChapterByIdLocally(id: number, patch: Partial<Chapter>) {
    mangaDetail.updateChapterByIdLocally(id, patch)
  }

  return {
    apiUrl,
    connected,
    setApiUrl,
    thumbnailUrl,
    categories,
    libraryByCategory,
    activeCategoryId,
    loadingLibrary,
    libraryError,
    mutatingLibrary,
    mutationError,
    library,
    totalLibraryCount,
    isInitialized,
    isLoaded,
    lastSyncedAt,
    ensureLibraryLoaded,
    silentRefreshLibrary,
    triggerUpdate,
    loadLibrary,
    setLibraryMembership,
    removeMangas,
    markMangasRead,
    updateMangaCategoriesLocally,
    setMangaCategories,
    batchDownloadChapters,
    sources,
    loadingSources,
    sourcesLoaded,
    sourcesError,
    loadSources,
    manga,
    chapters,
    loadingManga,
    mangaError,
    loadManga,
    updateChapterLocally,
    updateChapterByIdLocally,
  }
})
