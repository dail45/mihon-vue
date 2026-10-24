/**
 * Bulk Favorite composable for Browse sources and Global Search.
 *
 * Implements Komikku-style bulk favorite mode:
 * - Multi-selection tracking and range/all/inverse toggling
 * - Duplicate library entry pre-check
 * - Category assignment prompt (or automatic default category)
 * - Concurrency-limited POST /api/v1/manga/{id}/library addition (fallback GET)
 * - Server category synchronization via GraphQL batch / REST mutations
 */
import { computed, ref } from 'vue'
import { ofetch } from 'ofetch'
import { createSuwayomiApi, normalizeApiUrl } from '@/core/api/client'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { findDuplicateManga, type DuplicateManga } from '@/core/utils/duplicates'
import { stateSelection, triSelection, type CategorySelection } from '@/core/utils/categorySelection'
import { pLimit } from '@/core/utils/pLimit'
import type { Manga } from '@/core/api/types'

export function useBulkFavorite() {
  const server = useSuwayomiStore()

  const selection = ref<Manga[]>([])
  const selectionMode = ref(false)
  const isRunning = ref(false)
  const lastError = ref<string | null>(null)

  // Duplicate prompt dialog state
  const duplicateDialogOpen = ref(false)
  const duplicateManga = ref<Manga | null>(null)
  const duplicateEntries = ref<DuplicateManga[]>([])
  const duplicateIndex = ref(0)

  // Category selection dialog state
  const changeCategoryOpen = ref(false)
  const progress = ref({ current: 0, total: 0 })

  const selectedIds = computed(() => selection.value.map(m => m.id))
  const selectedCount = computed(() => selection.value.length)

  function isSelected(id: number): boolean {
    return selection.value.some(m => m.id === id)
  }

  function select(manga: Manga) {
    if (!isSelected(manga.id)) {
      selection.value = [...selection.value, manga]
    }
    selectionMode.value = true
  }

  function toggleSelection(manga: Manga, toSelectedState?: boolean) {
    const alreadySelected = isSelected(manga.id)
    const shouldSelect = toSelectedState !== undefined ? toSelectedState : !alreadySelected

    if (shouldSelect && !alreadySelected) {
      selection.value = [...selection.value, manga]
    } else if (!shouldSelect && alreadySelected) {
      selection.value = selection.value.filter(m => m.id !== manga.id)
    }

    selectionMode.value = selection.value.length > 0
  }

  function selectAll(mangas: Manga[]) {
    const map = new Map<number, Manga>()
    for (const m of selection.value) map.set(m.id, m)
    for (const m of mangas) map.set(m.id, m)
    selection.value = [...map.values()]
    selectionMode.value = selection.value.length > 0
  }

  function reverseSelection(mangas: Manga[]) {
    const currentIdSet = new Set(selectedIds.value)
    const inverted = mangas.filter(m => !currentIdSet.has(m.id))
    const seen = new Set<number>()
    const unique: Manga[] = []
    for (const m of inverted) {
      if (!seen.has(m.id)) {
        seen.add(m.id)
        unique.push(m)
      }
    }
    selection.value = unique
    selectionMode.value = unique.length > 0
  }

  function clearSelection() {
    selection.value = []
    selectionMode.value = false
    isRunning.value = false
    duplicateIndex.value = 0
    duplicateDialogOpen.value = false
    duplicateManga.value = null
    duplicateEntries.value = []
  }

  function toggleSelectionMode(newMode?: boolean) {
    const mode = newMode !== undefined ? newMode : !selectionMode.value
    selectionMode.value = mode
    if (!mode) {
      clearSelection()
    }
  }

  const categorySelection = computed<CategorySelection[]>(() => {
    const nonSystem = server.categories.filter(c => c.id !== 0 && c.id !== -1)
    const selected = selection.value
    if (!selected.length) {
      return nonSystem.map(c => stateSelection(c, false))
    }
    return nonSystem.map(cat => {
      const inCat = (server.libraryByCategory[cat.id] || []).map(m => m.id)
      const count = selected.filter(m => inCat.includes(m.id)).length
      if (count === selected.length) {
        return triSelection(cat, 'include')
      } else if (count > 0) {
        return triSelection(cat, 'exclude')
      } else {
        return triSelection(cat, 'none')
      }
    })
  })

  async function addSingleMangaToLibrary(apiUrl: string, mangaId: number): Promise<boolean> {
    const baseUrl = normalizeApiUrl(apiUrl)
    try {
      await ofetch(`${baseUrl}/manga/${mangaId}/library`, {
        method: 'POST',
        credentials: 'include',
        timeout: 15000,
        retry: 0,
      })
      return true
    } catch {
      try {
        await createSuwayomiApi(apiUrl).addToLibrary(mangaId)
        return true
      } catch (err) {
        console.warn(`Failed to add manga ${mangaId} to library:`, err)
        return false
      }
    }
  }

  async function checkDuplicates(startIdx: number): Promise<boolean> {
    const library = [...new Map(Object.values(server.libraryByCategory).flat().map(item => [item.id, item])).values()]
    for (let i = startIdx; i < selection.value.length; i++) {
      const manga = selection.value[i]!
      if (manga.inLibrary || library.some(l => l.id === manga.id)) continue
      const duplicates = findDuplicateManga(manga, library)
      if (duplicates.length > 0) {
        duplicateIndex.value = i
        duplicateManga.value = manga
        duplicateEntries.value = duplicates
        duplicateDialogOpen.value = true
        return true
      }
    }
    return false
  }

  async function promptCategoriesOrAdd() {
    const nonSystem = server.categories.filter(c => c.id !== 0 && c.id !== -1)
    if (nonSystem.length > 0) {
      changeCategoryOpen.value = true
    } else {
      await executeBatchAdd([])
    }
  }

  async function startAddFavorite(_availableMangas?: Manga[]) {
    if (!selection.value.length || isRunning.value) return
    isRunning.value = true
    lastError.value = null
    try {
      if (!server.loadingLibrary && !server.totalLibraryCount) {
        await server.loadLibrary()
      }
      duplicateIndex.value = 0
      const hasDuplicate = await checkDuplicates(0)
      if (!hasDuplicate) {
        await promptCategoriesOrAdd()
      }
    } catch (e: any) {
      lastError.value = e?.message || 'Error initiating bulk favorite'
      isRunning.value = false
    }
  }

  async function confirmDuplicateAndContinue() {
    duplicateDialogOpen.value = false
    const nextIdx = duplicateIndex.value + 1
    const hasMoreDuplicates = await checkDuplicates(nextIdx)
    if (!hasMoreDuplicates) {
      await promptCategoriesOrAdd()
    }
  }

  async function skipDuplicateAndContinue() {
    duplicateDialogOpen.value = false
    selection.value = selection.value.filter((_, idx) => idx !== duplicateIndex.value)
    if (selection.value.length === 0) {
      clearSelection()
      return
    }
    const hasMoreDuplicates = await checkDuplicates(duplicateIndex.value)
    if (!hasMoreDuplicates) {
      await promptCategoriesOrAdd()
    }
  }

  function cancelAdd() {
    duplicateDialogOpen.value = false
    changeCategoryOpen.value = false
    isRunning.value = false
  }

  async function confirmCategories(include: number[], exclude: number[]) {
    changeCategoryOpen.value = false
    await executeBatchAdd(include, exclude)
  }

  async function executeBatchAdd(categoriesToAdd: number[] = [], categoriesToRemove: number[] = []) {
    isRunning.value = true
    const targets = [...selection.value]
    progress.value = { current: 0, total: targets.length }
    const limit = pLimit(4)
    const successIds: number[] = []

    try {
      await Promise.all(
        targets.map(manga =>
          limit(async () => {
            const ok = await addSingleMangaToLibrary(server.apiUrl, manga.id)
            if (ok) {
              manga.inLibrary = true
              manga.favorite = true
              successIds.push(manga.id)
            }
            progress.value = {
              current: progress.value.current + 1,
              total: targets.length,
            }
          })
        )
      )

      if (categoriesToAdd.length > 0 && successIds.length > 0) {
        await server.setMangaCategories(successIds, categoriesToAdd, categoriesToRemove)
      }

      await server.loadLibrary().catch(() => {})
    } catch (err: any) {
      lastError.value = err?.message || 'Failed to complete bulk library addition'
    } finally {
      clearSelection()
    }
  }

  return {
    selection,
    selectionMode,
    isRunning,
    selectedIds,
    selectedCount,
    lastError,
    progress,
    duplicateDialogOpen,
    duplicateManga,
    duplicateEntries,
    changeCategoryOpen,
    categorySelection,
    isSelected,
    select,
    toggleSelection,
    selectAll,
    reverseSelection,
    clearSelection,
    toggleSelectionMode,
    startAddFavorite,
    confirmDuplicateAndContinue,
    skipDuplicateAndContinue,
    cancelAdd,
    confirmCategories,
    executeBatchAdd,
  }
}
