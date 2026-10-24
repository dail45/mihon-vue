import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiErrorMessage, createSuwayomiApi } from '@/core/api/client'
import type { Source } from '@/core/api/types'
import { useConnectionStore } from '@/features/library/stores/connection'

export const useSourcesStore = defineStore('sources', () => {
  const connection = useConnectionStore()
  const sources = ref<Source[]>([])
  const loadingSources = ref(false)
  const sourcesLoaded = ref(false)
  const sourcesError = ref<string | null>(null)
  let sourceRequest = 0

  async function loadSources() {
    const request = ++sourceRequest
    const api = createSuwayomiApi(connection.apiUrl)
    loadingSources.value = true
    sourcesError.value = null
    try {
      const list = await api.sources()
      if (request === sourceRequest) {
        sources.value = list
        connection.connected = true
      }
    } catch (error) {
      if (request === sourceRequest) {
        sourcesError.value = apiErrorMessage(error)
      }
    } finally {
      if (request === sourceRequest) {
        loadingSources.value = false
        sourcesLoaded.value = true
      }
    }
  }

  function reset() {
    sources.value = []
    loadingSources.value = false
    sourcesLoaded.value = false
    sourcesError.value = null
  }

  return {
    sources,
    loadingSources,
    sourcesLoaded,
    sourcesError,
    loadSources,
    reset,
  }
})
