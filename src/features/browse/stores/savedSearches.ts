import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { RawSourceFilterObject } from '@/features/browse/utils/sourceFilter'

export interface SavedSearch {
  id: string
  sourceId: string
  name: string
  query: string | null
  filters: RawSourceFilterObject[]
  createdAt: number
}

const STORAGE_KEY = 'mihon.savedSearches'

function loadSavedSearches(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedSearch[]) : []
  } catch {
    return []
  }
}

function persistSavedSearches(items: SavedSearch[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch (err) {
    console.error('Failed to persist saved searches:', err)
  }
}

export const useSavedSearchesStore = defineStore('savedSearches', () => {
  const savedSearches = ref<SavedSearch[]>(loadSavedSearches())

  function getSearchesForSource(sourceId: string): SavedSearch[] {
    return savedSearches.value.filter(s => s.sourceId === String(sourceId))
  }

  function getSearchById(id: string): SavedSearch | undefined {
    return savedSearches.value.find(s => s.id === id)
  }

  function saveSearch(
    sourceId: string,
    name: string,
    query: string | null,
    filters: RawSourceFilterObject[],
  ): SavedSearch {
    const newSearch: SavedSearch = {
      id: `saved-search-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sourceId: String(sourceId),
      name: name.trim() || 'Saved search',
      query: query ? query.trim() : null,
      filters: filters || [],
      createdAt: Date.now(),
    }

    savedSearches.value = [...savedSearches.value, newSearch]
    persistSavedSearches(savedSearches.value)
    return newSearch
  }

  function deleteSearch(id: string) {
    savedSearches.value = savedSearches.value.filter(s => s.id !== id)
    persistSavedSearches(savedSearches.value)
  }

  function renameSearch(id: string, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed) return
    const target = savedSearches.value.find(s => s.id === id)
    if (target) {
      target.name = trimmed
      persistSavedSearches(savedSearches.value)
    }
  }

  return {
    savedSearches,
    getSearchesForSource,
    getSearchById,
    saveSearch,
    deleteSearch,
    renameSearch,
  }
})
