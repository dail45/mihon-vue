import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const view = readFileSync('src/views/CategoriesView.vue', 'utf8') + '\n' + readFileSync('src/components/category/CategoryManagerPanel.vue', 'utf8')
const api = readFileSync('src/api/categoryReorder.ts', 'utf8')
const item = readFileSync('src/components/category/CategoryListItem.vue', 'utf8')

describe('CategoriesView matches the Mihon reference', () => {
  it('uses the reference app bar title and the navigateUp action', () => {
    expect(view).toContain('Edit categories')
    expect(view).toContain('icon="arrow_back"')
    expect(view).toContain('aria-label="Back"')
    // TopAppBar title = titleLarge (22sp / 28sp, weight 400).
    expect(view).toMatch(/font-size:\s*22px;\s*line-height:\s*28px;\s*font-weight:\s*400/)
    // The screen owns its app bar, so the shared shell bar is hidden.
    expect(view).toContain('categories-screen__toolbar')
  })

  it('renders the empty screen with the reference message', () => {
    expect(view).toContain('MihonEmptyScreen')
    expect(view).toContain(
      'You have no categories. Tap the plus button to create one for organizing your library.',
    )
  })

  it('keeps the LazyColumn content padding and the 8dp item spacing', () => {
    // topSmallPaddingValues (8dp) + horizontal medium padding (16dp).
    expect(view).toMatch(/padding:\s*8px 16px 96px/)
    expect(view).toMatch(/gap:\s*8px/)
  })

  it('renders the reference list item with the drag handle, rename and delete actions', () => {
    expect(view).toContain('CategoryListItem')
    expect(item).toContain('drag_handle')
    expect(item).toContain('>edit<')
    expect(item).toContain('>delete<')
    // The handle is the drag source of the reorder.
    expect(item).toContain('draggable="true"')
  })

  it('uses the reference FAB and the reference dialogs', () => {
    expect(view).toContain('<CategoryFab')
    expect(view).toContain('<CategoryRenameDialog')
    expect(view).toContain('<CategoryDeleteDialog')
  })

  it('filters the system category out like the reference view model', () => {
    expect(view).toContain('const SYSTEM_CATEGORY_ID = 0')
    expect(view).toMatch(/item\.id !== SYSTEM_CATEGORY_ID/)
  })

  it('persists the order with the Suwayomi GraphQL order mutation', () => {
    expect(api).toContain('updateCategoryOrder')
    expect(api).toContain('UpdateCategoryOrderInput')
    expect(view).toContain('reorderCategory(server.apiUrl, category.id, index + 1)')
  })

  it('reports a failed reorder with the reference internal error message', () => {
    expect(view).toContain('InternalError: could not change the category order.')
  })
})
