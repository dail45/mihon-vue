import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { toSourceFilters, toRawSourceFilters, cloneSourceFilters, type RawSourceFilterObject } from '../../src/components/sourceFilter'

const dialog = readFileSync('src/components/SourceFilterDialog.vue', 'utf8')
const items = readFileSync('src/components/SourceFilterItems.vue', 'utf8')

describe('SourceFilterDialog matches the Mihon reference', () => {
  it('uses the AdaptiveSheet geometry (extraLarge 28dp surface, 460dp max width)', () => {
    expect(dialog).toMatch(/max-width:\s*460px/)
    expect(dialog).toMatch(/border-radius:\s*28px/)
    expect(dialog).toContain('surface-container-high')
  })

  it('keeps the sticky header metrics (background, 8dp padding, divider)', () => {
    expect(dialog).toMatch(/background:\s*rgb\(var\(--v-theme-background\)\)/)
    expect(dialog).toMatch(/\.source-filter-header-row \{[^}]*padding:\s*8px/)
    expect(dialog).toMatch(/\.source-filter-header-divider \{[^}]*height:\s*1px/)
  })

  it('renders the reference actions', () => {
    expect(dialog).toContain('>Reset</button>')
    expect(dialog).toContain('>Filter</button>')
  })

  it('uses the MD3 button metrics (40dp height, 58dp min width, 20dp radius)', () => {
    expect(dialog).toMatch(/min-width:\s*58px/)
    expect(dialog).toMatch(/height:\s*40px/)
    expect(dialog).toMatch(/border-radius:\s*20px/)
  })

  it('renders every reference filter item type', () => {
    for (const type of ['Header', 'Separator', 'CheckBox', 'TriState', 'Text', 'Select', 'Sort', 'Group']) {
      expect(items).toContain(`filter.type === '${type}'`)
    }
  })

  it('keeps the reference tri-state cycle and icons', () => {
    expect(items).toContain("if (state === 1) return 'check_box'")
    expect(items).toContain("if (state === 2) return 'disabled_by_default'")
    expect(items).toContain("return 'check_box_outline_blank'")
    expect(items).toContain('if (state === 1) return 2')
    expect(items).toContain('if (state === 2) return 0')
  })

  it('keeps the SettingsItems paddings (24dp horizontal, 10dp vertical)', () => {
    expect(items).toMatch(/\.source-filter-row \{[^}]*padding:\s*10px 24px/)
    expect(items).toMatch(/\.source-filter-heading \{[^}]*padding:\s*10px 24px/)
    expect(items).toMatch(/\.source-filter-select \{[^}]*padding:\s*10px 24px/)
    expect(items).toMatch(/\.source-filter-text \{[^}]*padding:\s*4px 24px/)
  })

  it('keeps the CollapsibleBox header padding (24dp / 12dp) and arrow icons', () => {
    expect(items).toMatch(/\.source-filter-collapsible-header \{[^}]*padding:\s*12px 24px/)
    expect(items).toContain("'keyboard_arrow_up' : 'keyboard_arrow_down'")
  })

  it('keeps the MD3 checkbox geometry (18dp box, 2dp radius, 48dp slot)', () => {
    expect(items).toMatch(/\.source-filter-check-box \{[^}]*width:\s*18px/)
    expect(items).toMatch(/\.source-filter-check-box \{[^}]*border-radius:\s*2px/)
    expect(items).toMatch(/\.source-filter-check \{[^}]*width:\s*48px/)
  })

  it('converts Suwayomi filter objects to SourceFilter and serializes them back cleanly', () => {
    const raw: RawSourceFilterObject[] = [
      { type: 'Header', filter: { name: 'Genre Filters' } },
      { type: 'Separator', filter: {} },
      { type: 'CheckBox', filter: { name: 'Completed', state: true } },
      { type: 'TriState', filter: { name: 'Action', state: 1 } },
      { type: 'Text', filter: { name: 'Author', state: 'Oda' } },
      { type: 'Select', filter: { name: 'Sort by', values: ['Popularity', 'Latest', 'Alphabetical'], state: 0 } },
      { type: 'Sort', filter: { name: 'Order', values: ['Date', 'Rating'], state: { index: 1, ascending: false } } },
      {
        type: 'Group',
        filter: {
          name: 'Tags',
          state: [
            { type: 'CheckBox', filter: { name: 'Sci-Fi', state: false } },
            { type: 'TriState', filter: { name: 'Romance', state: 2 } },
          ],
        },
      },
    ]

    const parsed = toSourceFilters(raw)
    expect(parsed).toHaveLength(8)
    expect(parsed[0].type).toBe('Header')
    expect(parsed[0].name).toBe('Genre Filters')
    expect(parsed[2].state).toBe(true)
    expect(parsed[3].state).toBe(1)
    expect(parsed[4].state).toBe('Oda')
    expect(parsed[5].values).toEqual(['Popularity', 'Latest', 'Alphabetical'])
    expect(parsed[7].children).toHaveLength(2)
    expect(parsed[7].children?.[0].name).toBe('Sci-Fi')
    expect(parsed[7].children?.[1].state).toBe(2)

    const cloned = cloneSourceFilters(parsed)
    expect(cloned).toEqual(parsed)
    expect(cloned[7].children).not.toBe(parsed[7].children)

    const serialized = toRawSourceFilters(parsed)
    expect(serialized).toHaveLength(8)
    expect(serialized[0].type).toBe('Header')
    expect(serialized[2].filter.state).toBe(true)
    expect(serialized[7].filter.state).toHaveLength(2)
    expect((serialized[7].filter.state as RawSourceFilterObject[])[0].filter.name).toBe('Sci-Fi')
  })
})
