import { defineStore } from 'pinia'
import { ref, shallowRef, triggerRef } from 'vue'
import { createSuwayomiApi, apiErrorMessage } from '@/core/api/client'
import { summarizeChapters, type ChapterSummary } from '@/core/utils/library'

export const useLibraryDetails = defineStore('library-details', () => {
  const summaries = shallowRef<Record<number, ChapterSummary>>({})
  const errors = shallowRef<Record<number, string>>({})
  const pendingCount = ref(0)
  let generation = 0
  let address = ''
  let pending = new Set<number>()

  let throttleTimer: ReturnType<typeof setTimeout> | null = null
  let pendingSummariesTrigger = false
  let pendingErrorsTrigger = false

  function flushTriggers() {
    if (throttleTimer !== null) {
      clearTimeout(throttleTimer)
      throttleTimer = null
    }
    if (pendingSummariesTrigger) {
      pendingSummariesTrigger = false
      triggerRef(summaries)
    }
    if (pendingErrorsTrigger) {
      pendingErrorsTrigger = false
      triggerRef(errors)
    }
  }

  function scheduleTrigger(type: 'summaries' | 'errors') {
    if (type === 'summaries') pendingSummariesTrigger = true
    if (type === 'errors') pendingErrorsTrigger = true
    if (throttleTimer === null) {
      throttleTimer = setTimeout(() => {
        throttleTimer = null
        flushTriggers()
      }, 250)
    }
  }

  function clear() {
    generation++
    if (throttleTimer !== null) {
      clearTimeout(throttleTimer)
      throttleTimer = null
    }
    pendingSummariesTrigger = false
    pendingErrorsTrigger = false
    summaries.value = {}
    errors.value = {}
    pending = new Set()
    pendingCount.value = 0
  }

  async function ensure(apiUrl: string, ids: number[], retry = false, batchOnly = false) {
    if (address !== apiUrl) {
      clear()
      address = apiUrl
    }
    const request = generation
    const queue = [...new Set(ids)].filter(id => !summaries.value[id] && !pending.has(id) && (retry || !errors.value[id]))
    for (const id of queue) pending.add(id)
    pendingCount.value = pending.size
    const api = createSuwayomiApi(apiUrl)
    try {
      await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
        while (queue.length && request === generation) {
          const id = queue.shift()!
          try {
            const chapters = await api.chapters(id, false)
            if (request === generation) {
              summaries.value[id] = summarizeChapters(chapters)
              delete errors.value[id]
              if (!batchOnly) {
                scheduleTrigger('summaries')
                scheduleTrigger('errors')
              } else {
                pendingSummariesTrigger = true
                pendingErrorsTrigger = true
              }
            }
          } catch (e) {
            if (request === generation) {
              errors.value[id] = apiErrorMessage(e)
              if (!batchOnly) {
                scheduleTrigger('errors')
              } else {
                pendingErrorsTrigger = true
              }
            }
          } finally {
            if (request === generation) {
              pending.delete(id)
              pendingCount.value = pending.size
            }
          }
        }
      }))
    } finally {
      if (request === generation) {
        flushTriggers()
      }
    }
  }

  return { summaries, errors, pendingCount, clear, ensure }
})
