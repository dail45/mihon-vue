import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiErrorMessage, createSuwayomiApi } from '@/core/api/client'

export interface LibraryUpdateError {
  id: string
  mangaId: number
  title: string
  sourceId: string
  sourceName: string
  message: string
  timestamp: number
}

const STORAGE_KEY = 'mihon.library.updateErrors'

function loadErrorsFromStorage(): LibraryUpdateError[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveErrorsToStorage(errors: LibraryUpdateError[]) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(errors))
  } catch {
    // Quota exceeded or private browsing
  }
}

export const useLibraryUpdateErrorsStore = defineStore('libraryUpdateErrors', () => {
  const errors = ref<LibraryUpdateError[]>(loadErrorsFromStorage())
  const updating = ref(false)
  const progress = ref<number | null>(null)

  const errorCount = computed(() => errors.value.length)

  function addError(error: Omit<LibraryUpdateError, 'id' | 'timestamp'> & { id?: string; timestamp?: number }) {
    const errorId = error.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const timestamp = error.timestamp || Date.now()
    const newEntry: LibraryUpdateError = {
      id: errorId,
      mangaId: error.mangaId,
      title: error.title,
      sourceId: String(error.sourceId || ''),
      sourceName: error.sourceName || 'Unknown source',
      message: error.message,
      timestamp,
    }

    // Replace if an error for this manga already exists, otherwise add at the beginning
    const existingIndex = errors.value.findIndex(e => e.mangaId === error.mangaId)
    if (existingIndex >= 0) {
      errors.value[existingIndex] = newEntry
    } else {
      errors.value.unshift(newEntry)
    }
    saveErrorsToStorage(errors.value)
  }

  function removeError(id: string) {
    errors.value = errors.value.filter(e => e.id !== id)
    saveErrorsToStorage(errors.value)
  }

  function removeErrors(ids: string[]) {
    const idSet = new Set(ids)
    errors.value = errors.value.filter(e => !idSet.has(e.id))
    saveErrorsToStorage(errors.value)
  }

  function clearErrors() {
    errors.value = []
    saveErrorsToStorage([])
  }

  function setUpdating(isUpdating: boolean, pct: number | null = null) {
    updating.value = isUpdating
    progress.value = pct
  }

  function updateProgress(pct: number | null) {
    progress.value = pct
  }

  async function retryError(id: string, apiUrl: string): Promise<boolean> {
    const item = errors.value.find(e => e.id === id)
    if (!item) return false

    const api = createSuwayomiApi(apiUrl)
    try {
      await api.chapters(item.mangaId, true)
      removeError(id)
      return true
    } catch (err) {
      item.message = apiErrorMessage(err)
      item.timestamp = Date.now()
      saveErrorsToStorage(errors.value)
      return false
    }
  }

  async function retrySelected(ids: string[], apiUrl: string): Promise<{ succeeded: string[]; failed: string[] }> {
    const succeeded: string[] = []
    const failed: string[] = []

    for (const id of ids) {
      const ok = await retryError(id, apiUrl)
      if (ok) succeeded.push(id)
      else failed.push(id)
    }

    return { succeeded, failed }
  }

  async function retryAll(apiUrl: string): Promise<{ succeeded: string[]; failed: string[] }> {
    const allIds = errors.value.map(e => e.id)
    return retrySelected(allIds, apiUrl)
  }

  return {
    errors,
    updating,
    progress,
    errorCount,
    addError,
    removeError,
    removeErrors,
    clearErrors,
    setUpdating,
    updateProgress,
    retryError,
    retrySelected,
    retryAll,
  }
})
