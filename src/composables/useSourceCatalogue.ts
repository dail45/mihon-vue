import { reactive, ref, type MaybeRefOrGetter, toValue } from 'vue'
import { apiErrorMessage, createSuwayomiApi } from '../api/client'
import type { Manga, RawSourceFilterObject } from '../api/types'

export type CatalogueMode = 'popular' | 'latest' | 'search'

export function useSourceCatalogue(options?: {
  apiUrl?: MaybeRefOrGetter<string>
  sourceId?: MaybeRefOrGetter<string>
}) {
  const items = ref<Manga[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const hasNextPage = ref(false)
  const page = ref(0)

  let generation = 0
  let selection: {
    apiUrl: string
    sourceId: string
    mode: CatalogueMode
    query: string
    filters?: RawSourceFilterObject[]
  } | null = null

  function close() {
    generation++
    selection = null
    items.value = []
    loading.value = false
    error.value = null
    page.value = 0
    hasNextPage.value = false
  }

  async function open(
    apiUrl?: string,
    sourceId?: string,
    mode: CatalogueMode = 'popular',
    query = '',
    filters?: RawSourceFilterObject[],
  ) {
    const resolvedApiUrl = apiUrl ?? (options?.apiUrl ? toValue(options.apiUrl) : '')
    const resolvedSourceId = sourceId ?? (options?.sourceId ? toValue(options.sourceId) : '')

    close()
    selection = {
      apiUrl: resolvedApiUrl,
      sourceId: resolvedSourceId,
      mode,
      query,
      filters,
    }
    hasNextPage.value = true
    await loadMore()
  }

  async function loadMore() {
    if (!selection || loading.value || !hasNextPage.value) return
    const current = selection
    const request = generation
    const next = page.value + 1
    loading.value = true
    error.value = null

    try {
      const api = createSuwayomiApi(current.apiUrl)
      const result = current.filters !== undefined
        ? await api.sourceCatalogue(current.sourceId, current.mode, next, current.query, current.filters)
        : await api.sourceCatalogue(current.sourceId, current.mode, next, current.query)

      if (request !== generation) return

      const existing = new Set(items.value.map(m => m.id))
      const unique = result.mangaList.filter(m => {
        if (existing.has(m.id)) return false
        existing.add(m.id)
        return true
      })
      items.value = [...items.value, ...unique]
      page.value = next
      hasNextPage.value = result.hasNextPage
    } catch (reason) {
      if (request === generation) {
        error.value = apiErrorMessage(reason)
      }
    } finally {
      if (request === generation) {
        loading.value = false
      }
    }
  }

  function onScroll() {
    if (!hasNextPage.value || loading.value || !items.value.length) return
    const documentHeight = document.documentElement.scrollHeight
    if (documentHeight - window.innerHeight < 120) return
    if (window.scrollY <= 0) return
    if (window.innerHeight + window.scrollY >= documentHeight - 240) {
      void loadMore()
    }
  }

  return reactive({
    items,
    loading,
    error,
    hasNextPage,
    page,
    open,
    loadMore,
    close,
    onScroll,
  })
}
