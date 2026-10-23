import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
/**
 * Mihon's library multi-selection (LibraryViewModel.kt):
 * a plain click toggles one item, a long press selects the range between the last
 * pressed item and the current one inside the same category.
 */
export const useLibrarySelectionStore = defineStore('librarySelection', () => {
  const selected = ref<Set<number>>(new Set())
  const lastSelection = ref<{ categoryId: number; mangaId: number } | null>(null)
  const count = computed(() => selected.value.size)
  function clear() {
    selected.value = new Set()
    lastSelection.value = null
  }
  function toggle(categoryId: number, mangaId: number) {
    const next = new Set(selected.value)
    if (!next.delete(mangaId)) next.add(mangaId)
    selected.value = next
    lastSelection.value = next.has(mangaId) ? { categoryId, mangaId } : null
  }
  function toggleRange(categoryId: number, mangaId: number, ids: number[]) {
    const next = new Set(selected.value)
    const last = lastSelection.value
    const lastIndex = last && last.categoryId === categoryId ? ids.indexOf(last.mangaId) : -1
    const currentIndex = ids.indexOf(mangaId)
    if (lastIndex === -1 || currentIndex === -1) next.add(mangaId)
    else {
      const from = Math.min(lastIndex, currentIndex)
      const to = Math.max(lastIndex, currentIndex)
      for (let i = from; i <= to; i++) next.add(ids[i])
    }
    selected.value = next
    lastSelection.value = { categoryId, mangaId }
  }
  function selectAll(ids: number[]) {
    selected.value = new Set(ids)
    lastSelection.value = null
  }
  function invert(ids: number[]) {
    const next = new Set<number>()
    for (const id of ids) if (!selected.value.has(id)) next.add(id)
    selected.value = next
    lastSelection.value = null
  }
  return { selected, lastSelection, count, clear, toggle, toggleRange, selectAll, invert }
})
