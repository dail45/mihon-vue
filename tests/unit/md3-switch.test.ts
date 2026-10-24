import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/Md3Switch.vue', 'utf8')

describe('Md3Switch (Material 3 Switch)', () => {
  it('renders switch role and accessible attributes', () => {
    expect(source).toContain('role="switch"')
    expect(source).toContain(':aria-checked="model"')
    expect(source).toContain(':aria-label="label"')
    expect(source).toContain(':aria-disabled="disabled || undefined"')
  })

  it('does NOT contain any SVG checkmark or checkmark paths (matches Mihon Switch without icon)', () => {
    // Mihon/Tachiyomi Switch has thumbContent = null, so NO check mark is rendered
    expect(source).not.toContain('<svg')
    expect(source).not.toContain('md3-switch-mark')
    expect(source).not.toContain('M9.5 16.2 5.3 12')
  })

  it('implements Material 3 Switch geometry with 8dp inset in OFF state and 4dp inset in ON state', () => {
    // Track 52x32dp (radius 16dp / pill)
    expect(source).toMatch(/\.md3-switch-track\s*\{[^}]*width:\s*52px;/s)
    expect(source).toMatch(/\.md3-switch-track\s*\{[^}]*height:\s*32px;/s)
    expect(source).toMatch(/\.md3-switch-track\s*\{[^}]*border-radius:\s*16px;/s)

    // Unselected (OFF): 16dp thumb centered in left 32dp cap -> 8dp inset on all sides ((32 - 16) / 2 = 8dp)
    expect(source).toMatch(/\.md3-switch-thumb\s*\{[^}]*left:\s*8px;/s)
    expect(source).toMatch(/\.md3-switch-thumb\s*\{[^}]*top:\s*8px;/s)
    expect(source).toMatch(/\.md3-switch-thumb\s*\{[^}]*width:\s*16px;/s)
    expect(source).toMatch(/\.md3-switch-thumb\s*\{[^}]*height:\s*16px;/s)

    // Selected (ON): 24dp thumb centered in right 32dp cap -> 4dp inset on all sides ((32 - 24) / 2 = 4dp)
    // translateX(16px) moves from 8px to 24px (24 + 24 = 48px, 52 - 48 = 4px)
    expect(source).toMatch(/\.md3-switch\.is-on\s+\.md3-switch-thumb\s*\{[^}]*width:\s*24px;/s)
    expect(source).toMatch(/\.md3-switch\.is-on\s+\.md3-switch-thumb\s*\{[^}]*height:\s*24px;/s)
    expect(source).toMatch(/\.md3-switch\.is-on\s+\.md3-switch-thumb\s*\{[^}]*top:\s*4px;/s)
    expect(source).toMatch(/\.md3-switch\.is-on\s+\.md3-switch-thumb\s*\{[^}]*transform:\s*translateX\(16px\);/s)
  })

  it('supports click, space, and enter keyboard interaction', () => {
    expect(source).toContain('@click.stop="disabled || (model = !model)"')
    expect(source).toContain('@keydown.space.prevent="disabled || (model = !model)"')
    expect(source).toContain('@keydown.enter.prevent="disabled || (model = !model)"')
  })
})
