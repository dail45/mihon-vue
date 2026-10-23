import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  categoryVisualName,
  nextCategorySelection,
  selectionCategories,
  type CategorySelection,
} from '../../src/utils/categorySelection'
import type { Category } from '../../src/api/types'

const source = readFileSync('src/components/ChangeCategoryDialog.vue', 'utf8')

/**
 * Parity guards for `src/components/ChangeCategoryDialog.vue` against
 * mihon/app/src/main/java/eu/kanade/presentation/category/components/CategoryDialogs.kt:189-295
 * and supporting tachiyomi components (LabeledCheckbox.kt, AlertDialog.kt).
 */
describe('ChangeCategoryDialog parity with Mihon', () => {
  it('implements Material 3 AlertDialog container tokens and dimensions', () => {
    // DialogTokens.ContainerShape = CornerExtraLarge (28dp).
    expect(source).toContain('border-radius: 28px;')
    // DialogTokens.ContainerColor = SurfaceContainerHigh.
    expect(source).toContain('background: rgb(var(--v-theme-surface-container-high));')
    // AlertDialog padding: 24dp on all sides.
    expect(source).toMatch(/\.ccd-dialog \{[^}]*padding: 24px;/s)
    // AlertDialog dimensions: min-width 280dp, max-width 560dp.
    expect(source).toContain('min-width: min(280px, calc(100vw - 48px));')
    expect(source).toContain('max-width: min(560px, calc(100vw - 48px));')
  })

  it('adheres to Material 3 dialog typography and spacing tokens', () => {
    // Title: headlineSmall (24sp / 32sp, w400) in on-surface with 16dp bottom padding.
    expect(source).toMatch(/\.ccd-title \{[^}]*font-size: 24px;/s)
    expect(source).toMatch(/\.ccd-title \{[^}]*line-height: 32px;/s)
    expect(source).toMatch(/\.ccd-title \{[^}]*font-weight: 400;/s)
    expect(source).toMatch(/\.ccd-title \{[^}]*margin: 0 0 16px;/s)
    expect(source).toContain('color: rgb(var(--v-theme-on-surface));')

    // Empty state body: bodyMedium (14sp / 20sp, w400, ls 0.0178571429em) in on-surface-variant with 24dp bottom margin.
    expect(source).toMatch(/\.ccd-body \{[^}]*font-size: 14px;/s)
    expect(source).toMatch(/\.ccd-body \{[^}]*line-height: 20px;/s)
    expect(source).toMatch(/\.ccd-body \{[^}]*letter-spacing: 0.0178571429em;/s)
    expect(source).toMatch(/\.ccd-body \{[^}]*margin: 0 0 24px;/s)

    // Actions button typography: labelLarge (14sp / 20sp, w500, ls 0.0071428571em).
    expect(source).toMatch(/\.ccd-button \{[^}]*font-size: 14px;/s)
    expect(source).toMatch(/\.ccd-button \{[^}]*line-height: 20px;/s)
    expect(source).toMatch(/\.ccd-button \{[^}]*font-weight: 500;/s)
    expect(source).toMatch(/\.ccd-button \{[^}]*letter-spacing: 0.0071428571em;/s)
  })

  it('implements LabeledCheckbox requirements (48dp min-height, 8dp shapes.small clip, 8dp gap)', () => {
    // LabeledCheckbox: Row(clip(shapes.small = 8dp).fillMaxWidth().heightIn(min = 48dp), spacedBy(8dp))
    expect(source).toMatch(/\.ccd-row \{[^}]*min-height: 48px;/s)
    expect(source).toMatch(/\.ccd-row \{[^}]*border-radius: 8px;/s)
    expect(source).toMatch(/\.ccd-row \{[^}]*gap: 8px;/s)
    expect(source).toMatch(/\.ccd-row \{[^}]*overflow: hidden;/s)

    // Checkbox container: 24dp footprint, 20dp box with 2dp border and 2dp radius
    expect(source).toMatch(/\.ccd-checkbox \{[^}]*width: 24px;/s)
    expect(source).toMatch(/\.ccd-checkbox \{[^}]*height: 24px;/s)
    expect(source).toMatch(/\.ccd-box \{[^}]*width: 20px;/s)
    expect(source).toMatch(/\.ccd-box \{[^}]*height: 20px;/s)
    expect(source).toMatch(/\.ccd-box \{[^}]*border: 2px solid/s)
    expect(source).toMatch(/\.ccd-box \{[^}]*border-radius: 2px;/s)

    // Row has accessibility semantics
    expect(source).toContain('role="checkbox"')
    expect(source).toContain('tabindex="0"')
    expect(source).toContain(':aria-checked="isChecked(item) ? true : isIndeterminate(item) ? \'mixed\' : false"')
    expect(source).toContain('@keydown.enter.prevent="onChange(index)"')
    expect(source).toContain('@keydown.space.prevent="onChange(index)"')
  })

  it('renders exact reference strings and actions layout for empty and populated states', () => {
    // Reference strings from strings.xml
    expect(source).toContain('Set categories') // MR.strings.action_move_category
    expect(source).toContain("You don't have any categories yet.") // MR.strings.information_empty_category_dialog
    expect(source).toContain('Edit categories') // MR.strings.action_edit_categories
    expect(source).toContain('Edit') // MR.strings.action_edit
    expect(source).toContain('Cancel') // MR.strings.action_cancel
    expect(source).toContain('OK') // MR.strings.action_ok

    // In non-empty state: "Edit" on the start, spacer, "Cancel" and "OK" on the end.
    expect(source).toContain('<span class="ccd-spacer" />')
    // In empty state: end-aligned single button
    expect(source).toContain('class="ccd-actions" :class="{ \'ccd-actions--end\': empty }"')
  })

  function mockCategory(overrides: Partial<Category> = {}): Category {
    return {
      id: 1,
      name: 'Manga',
      order: 0,
      default: false,
      includeInUpdate: 1,
      includeInDownload: 1,
      version: 1,
      uid: 1,
      lastModifiedAt: 0,
      ...overrides,
    }
  }

  it('correctly handles nextCategorySelection state transitions', () => {
    const dummyCat = mockCategory({ id: 1, name: 'Manga' })

    // Two-state: Checked <-> None
    const stateChecked: CategorySelection = { kind: 'state', category: dummyCat, checked: true }
    const stateUnchecked = nextCategorySelection(stateChecked)
    expect(stateUnchecked).toEqual({ kind: 'state', category: dummyCat, checked: false })
    const stateRechecked = nextCategorySelection(stateUnchecked)
    expect(stateRechecked).toEqual({ kind: 'state', category: dummyCat, checked: true })

    // Tri-state: None -> Include -> Exclude -> None
    const triNone: CategorySelection = { kind: 'tri', category: dummyCat, state: 'none' }
    const triInclude = nextCategorySelection(triNone)
    expect(triInclude).toEqual({ kind: 'tri', category: dummyCat, state: 'include' })
    const triExclude = nextCategorySelection(triInclude)
    expect(triExclude).toEqual({ kind: 'tri', category: dummyCat, state: 'exclude' })
    const triBackToNone = nextCategorySelection(triExclude)
    expect(triBackToNone).toEqual({ kind: 'tri', category: dummyCat, state: 'none' })
  })

  it('correctly derives include and exclude category IDs on confirm', () => {
    const cat1 = mockCategory({ id: 10, name: 'Action' })
    const cat2 = mockCategory({ id: 20, name: 'Drama' })
    const cat3 = mockCategory({ id: 30, name: 'Comedy' })

    const selections: CategorySelection[] = [
      { kind: 'state', category: cat1, checked: true },
      { kind: 'tri', category: cat2, state: 'exclude' }, // Exclude means "unchanged" in Mihon confirm
      { kind: 'tri', category: cat3, state: 'none' },
    ]

    const result = selectionCategories(selections)
    expect(result.include).toEqual([10])
    expect(result.exclude).toEqual([30])
  })

  it('maps visual names according to CategoryExtensions.kt', () => {
    expect(categoryVisualName(mockCategory({ id: 0, name: 'Default' }))).toBe('Default')
    expect(categoryVisualName(mockCategory({ id: 0, name: '' }))).toBe('Default')
    expect(categoryVisualName(mockCategory({ id: 1, name: 'My Cat' }))).toBe('My Cat')
  })
})
