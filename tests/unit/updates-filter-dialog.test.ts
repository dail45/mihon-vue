import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('UpdatesFilterDialog matches Mihon reference', () => {
  const source = readFileSync('src/features/updates/components/UpdatesFilterDialog.vue', 'utf8')

  it('uses TabbedDialog tabs: Filter and Categories', () => {
    expect(source).toContain(":tabs=\"['Filter', 'Categories']\"")
    expect(source).toContain("const tab = ref<'filter' | 'categories'>('filter')")
  })

  it('implements FilterSheet with 4 TriState items and excluded scanlators switch', () => {
    expect(source).toContain("key: 'downloaded'")
    expect(source).toContain("label: 'Downloaded'")
    expect(source).toContain("key: 'unread'")
    expect(source).toContain("label: 'Unread'")
    expect(source).toContain("key: 'started'")
    expect(source).toContain("label: 'Started'")
    expect(source).toContain("key: 'bookmarked'")
    expect(source).toContain("label: 'Bookmarked'")
    expect(source).toContain('Filter excluded scanlators')
    expect(source).toContain('toggleExcludedScanlators')
  })

  it('uses dividers with 8dp (small) and 4dp (extraSmall) margins', () => {
    expect(source).toMatch(/\.updates-filter-divider\.is-small\s*\{[^}]*margin:\s*8px;/)
    expect(source).toMatch(/\.updates-filter-divider\.is-extra-small\s*\{[^}]*margin:\s*4px;/)
  })

  it('implements CategoryFilterSheet with reference description, divider and TriState rows', () => {
    expect(source).toContain('Updates in excluded categories will not be shown even if they are also in any included categories.')
    expect(source).toMatch(/\.updates-filter-description\s*\{[^}]*font-size:\s*14px;/)
    expect(source).toMatch(/\.updates-filter-description\s*\{[^}]*line-height:\s*20px;/)
    expect(source).toMatch(/\.updates-filter-description\s*\{[^}]*padding:\s*10px 24px;/)
  })

  it('labels uncategorized/system category (id == 0) as Default (Category.visualName)', () => {
    expect(source).toContain("category.id === 0 || category.default || category.isDefaultCategory ? 'Default' : category.name")
  })

  it('supports horizontal touch swipe mirroring HorizontalPager', () => {
    expect(source).toContain('onTouchStart')
    expect(source).toContain('onTouchEnd')
  })

  it('resets to page 0 (filter) on dialog open', () => {
    expect(source).toContain("tab.value = 'filter'")
  })
})
