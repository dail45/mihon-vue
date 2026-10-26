import { defineStore } from 'pinia'
import { ref, shallowRef, triggerRef } from 'vue'
import { createSuwayomiApi, apiErrorMessage } from '@/core/api/client'
import { summarizeChapters, type ChapterSummary } from '@/core/utils/library'
export const useLibraryDetails = defineStore('library-details', () => {
  const summaries = shallowRef<Record<number, ChapterSummary>>({}), errors = shallowRef<Record<number, string>>({}), pendingCount = ref(0)
  let generation = 0, address = '', pending = new Set<number>()
  function clear() { generation++; summaries.value = {}; errors.value = {}; pending = new Set(); pendingCount.value = 0 }
  async function ensure(apiUrl: string, ids: number[], retry = false) {
    if (address !== apiUrl) { clear(); address = apiUrl }
    const request = generation
    const queue = [...new Set(ids)].filter(id => !summaries.value[id] && !pending.has(id) && (retry || !errors.value[id]))
    for (const id of queue) pending.add(id)
    pendingCount.value = pending.size
    const api = createSuwayomiApi(apiUrl)
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length && request === generation) {
        const id = queue.shift()!
        try { const chapters = await api.chapters(id, false); if (request === generation) { summaries.value[id] = summarizeChapters(chapters); delete errors.value[id]; triggerRef(summaries); triggerRef(errors) } }
        catch (e) { if (request === generation) { errors.value[id] = apiErrorMessage(e); triggerRef(errors) } }
        finally { if (request === generation) { pending.delete(id); pendingCount.value = pending.size } }
      }
    }))
  }
  return { summaries, errors, pendingCount, clear, ensure }
})
