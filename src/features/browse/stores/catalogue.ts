import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiErrorMessage, createSuwayomiApi } from '@/core/api/client'
import type { Manga, RawSourceFilterObject } from '@/core/api/types'
export type CatalogueMode = 'popular' | 'latest' | 'search'
export const useCatalogueStore = defineStore('catalogue', () => {
  const items = ref<Manga[]>([]), loading = ref(false), error = ref<string | null>(null)
  const hasNextPage = ref(false), page = ref(0)
  let generation = 0
  let selection: { apiUrl: string; sourceId: string; mode: CatalogueMode; query: string; filters?: RawSourceFilterObject[] } | null = null
  function close() { generation++; selection = null; items.value = []; loading.value = false; error.value = null; page.value = 0; hasNextPage.value = false }
  async function open(apiUrl: string, sourceId: string, mode: CatalogueMode, query = '', filters?: RawSourceFilterObject[]) {
    close(); selection = { apiUrl, sourceId, mode, query, filters }; hasNextPage.value = true
    await loadMore()
  }
  async function loadMore() {
    if (!selection || loading.value || !hasNextPage.value) return
    const current = selection, request = generation, next = page.value + 1
    loading.value = true; error.value = null
    try {
      const api = createSuwayomiApi(current.apiUrl)
      const result = current.filters !== undefined
        ? await api.sourceCatalogue(current.sourceId, current.mode, next, current.query, current.filters)
        : await api.sourceCatalogue(current.sourceId, current.mode, next, current.query)
      if (request !== generation) return
      const existing = new Set(items.value.map(m => m.id))
      const unique = result.mangaList.filter(m => {
        if (existing.has(m.id)) return false
        existing.add(m.id); return true
      })
      items.value = [...items.value, ...unique]
      page.value = next; hasNextPage.value = result.hasNextPage
    } catch (reason) { if (request === generation) error.value = apiErrorMessage(reason) }
    finally { if (request === generation) loading.value = false }
  }
  return { items, loading, error, hasNextPage, page, open, loadMore, close }
})
