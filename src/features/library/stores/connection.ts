import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DEFAULT_API_URL, normalizeApiUrl } from '@/core/api/client'
import { readPreference, writePreference } from '@/features/settings/stores/preferences'

export const useConnectionStore = defineStore('connection', () => {
  let initialUrl = DEFAULT_API_URL
  try {
    initialUrl = normalizeApiUrl(readPreference('mihon.apiUrl') || DEFAULT_API_URL)
  } catch {
    /* invalid saved setting */
  }

  const apiUrl = ref(initialUrl)
  const connected = ref(false)
  const serverGeneration = ref(0)

  function setApiUrl(value: string) {
    const url = normalizeApiUrl(value)
    if (url === apiUrl.value) return
    apiUrl.value = url
    writePreference('mihon.apiUrl', url)
    serverGeneration.value++
    connected.value = false
  }

  function thumbnailUrl(id: number) {
    return `${apiUrl.value}/manga/${id}/thumbnail`
  }

  return {
    apiUrl,
    connected,
    serverGeneration,
    setApiUrl,
    thumbnailUrl,
  }
})
