import { computed, ref } from 'vue'

export function useChapterSelection() {
  const selectedChapters = ref<Set<number>>(new Set())
  const lastSelectedChapterIndex = ref<number | null>(null)

  const isActionMode = computed(() => selectedChapters.value.size > 0)
  const selectedCount = computed(() => selectedChapters.value.size)

  function toggleChapterSelection(id: number, visibleChapters?: Array<{ id: number }>) {
    const next = new Set(selectedChapters.value)
    if (!next.delete(id)) {
      next.add(id)
      if (visibleChapters) {
        lastSelectedChapterIndex.value = visibleChapters.findIndex(c => c.id === id)
      }
    }
    selectedChapters.value = next
    if (next.size === 0) {
      lastSelectedChapterIndex.value = null
    }
  }

  function cancelSelection() {
    selectedChapters.value = new Set()
    lastSelectedChapterIndex.value = null
  }

  function selectAllChapters(chapterIds: number[]) {
    selectedChapters.value = new Set(chapterIds)
  }

  function invertChapterSelection(allChapterIds: number[]) {
    const next = new Set<number>()
    for (const id of allChapterIds) {
      if (!selectedChapters.value.has(id)) {
        next.add(id)
      }
    }
    selectedChapters.value = next
  }

  function handleLongPressSelect(chapter: { id: number }, visibleChapters: Array<{ id: number }>) {
    const currentIndex = visibleChapters.findIndex(c => c.id === chapter.id)
    if (currentIndex < 0) return

    if (!isActionMode.value || lastSelectedChapterIndex.value === null) {
      selectedChapters.value = new Set([chapter.id])
      lastSelectedChapterIndex.value = currentIndex
    } else {
      const start = Math.min(lastSelectedChapterIndex.value, currentIndex)
      const end = Math.max(lastSelectedChapterIndex.value, currentIndex)
      const next = new Set(selectedChapters.value)
      for (let i = start; i <= end; i++) {
        const c = visibleChapters[i]
        if (c) next.add(c.id)
      }
      selectedChapters.value = next
      lastSelectedChapterIndex.value = currentIndex
    }
  }

  return {
    selectedChapters,
    lastSelectedChapterIndex,
    isActionMode,
    selectedCount,
    toggleChapterSelection,
    cancelSelection,
    selectAllChapters,
    invertChapterSelection,
    handleLongPressSelect,
  }
}
