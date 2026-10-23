import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/TriStateListDialog.vue', 'utf8')

describe('TriStateListDialog matches the Mihon reference', () => {
  it('renders the reference tri-state cycle UNCHECKED -> CHECKED -> INVERSED -> UNCHECKED', () => {
    expect(source).toContain("current === 'unchecked' ? 'checked' : current === 'checked' ? 'inversed' : 'unchecked'")
  })

  it('maps the reference icons to the Material Symbols set', () => {
    expect(source).toContain("if (state === 'checked') return 'check_box'")
    expect(source).toContain("if (state === 'inversed') return 'disabled_by_default'")
    expect(source).toContain("return 'check_box_outline_blank'")
  })

  it('keeps the reference icon content descriptions', () => {
    expect(source).toContain("return 'Selected'")
    expect(source).toContain("return 'Disabled'")
    expect(source).toContain("return 'Not selected'")
  })

  it('uses the MD3 alert dialog geometry', () => {
    expect(source).toMatch(/padding:\s*24px/)
    expect(source).toMatch(/border-radius:\s*28px/)
    expect(source).toMatch(/min-width:\s*280px/)
    expect(source).toMatch(/max-width:\s*min\(560px/)
    expect(source).toMatch(/font-size:\s*24px;\s*line-height:\s*32px/)
  })

  it('keeps the reference row metrics (48dp height, 4dp clip, 20dp icon gap)', () => {
    expect(source).toMatch(/min-height:\s*48px/)
    expect(source).toMatch(/border-radius:\s*4px/)
    expect(source).toMatch(/margin-inline-end:\s*20px/)
  })

  it('renders the reference action buttons', () => {
    expect(source).toContain('>Cancel</button>')
    expect(source).toContain('>OK</button>')
  })
})
