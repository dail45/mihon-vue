import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiErrorMessage, createSuwayomiApi } from '../api/client'
import type { MangaChapter } from '../api/types'
export const useUpdatesStore = defineStore('updates', () => {
  const entries = ref<MangaChapter[]>([]), loading = ref(false), error = ref<string | null>(null)
  const page = ref(-1), hasNextPage = ref(true)
  let generation = 0, address = ''
  async function refresh(apiUrl: string) {
    const request = ++generation
    if (address !== apiUrl) { entries.value = []; page.value = -1; hasNextPage.value = true }
    address = apiUrl; loading.value = true; error.value = null
    try {
      const result = await createSuwayomiApi(apiUrl).recentChapters(0)
      if (request !== generation) return
      entries.value = result.page; page.value = 0; hasNextPage.value = result.hasNextPage
    } catch (e) { if (request === generation) error.value = apiErrorMessage(e) }
    finally { if (request === generation) loading.value = false }
  }
  async function loadMore() {
    if (loading.value || !hasNextPage.value || page.value < 0) return
    const request = generation, next = page.value + 1
    loading.value = true; error.value = null
    try {
      const result = await createSuwayomiApi(address).recentChapters(next)
      if (request !== generation) return
      const seen = new Set(entries.value.map(e => `${e.manga.id}:${e.chapter.id}`))
      const unique = result.page.filter(e => { const key = `${e.manga.id}:${e.chapter.id}`; if (seen.has(key)) return false; seen.add(key); return true })
      entries.value = [...entries.value, ...unique]; page.value = next; hasNextPage.value = result.hasNextPage
    } catch (e) { if (request === generation) error.value = apiErrorMessage(e) }
    finally { if (request === generation) loading.value = false }
  }
  function dispose() { generation++; loading.value = false }
  return { entries, loading, error, page, hasNextPage, refresh, loadMore, dispose }
})
