import { describe, expect, it } from 'vitest'
import { useChapterSelection } from '../../src/composables/useChapterSelection'

describe('useChapterSelection composable', () => {
  it('toggles selection and tracks action mode', () => {
    const {
      selectedChapters,
      isActionMode,
      selectedCount,
      toggleChapterSelection,
      cancelSelection,
    } = useChapterSelection()

    expect(isActionMode.value).toBe(false)
    expect(selectedCount.value).toBe(0)

    toggleChapterSelection(10)
    expect(isActionMode.value).toBe(true)
    expect(selectedCount.value).toBe(1)
    expect(selectedChapters.value.has(10)).toBe(true)

    toggleChapterSelection(10)
    expect(isActionMode.value).toBe(false)
    expect(selectedCount.value).toBe(0)

    toggleChapterSelection(1)
    toggleChapterSelection(2)
    expect(selectedCount.value).toBe(2)

    cancelSelection()
    expect(selectedCount.value).toBe(0)
    expect(isActionMode.value).toBe(false)
  })

  it('handles select all and invert selection', () => {
    const {
      selectedChapters,
      selectAllChapters,
      invertChapterSelection,
    } = useChapterSelection()

    const all = [1, 2, 3, 4]
    selectAllChapters(all)
    expect(selectedChapters.value.size).toBe(4)

    // Deselect chapter 1
    selectedChapters.value.delete(1)
    // Invert: should now have [1]
    invertChapterSelection(all)
    expect(Array.from(selectedChapters.value)).toEqual([1])
  })

  it('supports range selection via handleLongPressSelect', () => {
    const {
      selectedChapters,
      handleLongPressSelect,
    } = useChapterSelection()

    const chapters = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]

    // First long press selects item 2 (index 1)
    handleLongPressSelect({ id: 2 }, chapters)
    expect(Array.from(selectedChapters.value)).toEqual([2])

    // Second long press on item 4 (index 3) selects range [2, 3, 4]
    handleLongPressSelect({ id: 4 }, chapters)
    expect(Array.from(selectedChapters.value).sort()).toEqual([2, 3, 4])
  })
})
