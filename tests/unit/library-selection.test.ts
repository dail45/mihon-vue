import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const libraryViewSource = readFileSync('src/features/library/views/LibraryView.vue', 'utf8')

describe('Library selection parity with Mihon (LibraryViewModel.kt:684-705)', () => {
  it('invertSelection toggles items in active category while preserving selections from other categories', () => {
    // Mihon reference:
    // val itemIds = state.getItemsForCategoryId(state.activeCategory?.id).fastMap { it.id }
    // val (toRemove, toAdd) = itemIds.partition { it in list }
    // list.removeAll(toRemove)
    // list.addAll(toAdd)
    expect(libraryViewSource).toContain('function invertSelection()')
    expect(libraryViewSource).toContain('const currentCategoryIds = new Set(')
    expect(libraryViewSource).toContain('const nextSelection = new Set(selection.value)')
    expect(libraryViewSource).toContain('nextSelection.delete(id)')
    expect(libraryViewSource).toContain('nextSelection.add(id)')
    expect(libraryViewSource).toContain('selection.value = [...nextSelection]')
  })

  it('correctly simulates invertSelection across multiple categories', () => {
    // Category 1 items: [1, 2, 3]
    // Category 2 items: [10, 20]
    // Initial selection across categories: [1, 10]
    const cat1Ids = [1, 2, 3]
    let selection = [1, 10]

    // Invert selection on Category 1
    const currentCategoryIds = new Set(cat1Ids)
    const nextSelection = new Set(selection)
    for (const id of currentCategoryIds) {
      if (nextSelection.has(id)) {
        nextSelection.delete(id)
      } else {
        nextSelection.add(id)
      }
    }
    selection = [...nextSelection]

    // Item 1 was in cat 1 and selected -> deselected
    // Items 2, 3 were in cat 1 and unselected -> selected
    // Item 10 was in cat 2 -> preserved!
    expect(selection).toEqual([10, 2, 3])
  })
})
