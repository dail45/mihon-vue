import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/CategoryFab.vue', 'utf8')

describe('CategoryFab matches the Mihon reference', () => {
  it('renders the "Add" label and the Material Symbols Add icon', () => {
    expect(source).toContain('material-symbols-rounded category-fab-icon')
    expect(source).toContain('>add<')
    expect(source).toContain('action_add')
  })

  it('keeps the MD3 small extended FAB geometry', () => {
    // ContainerHeight 56dp, CornerLarge 16dp, IconSize 24dp, LeadingSpace 16dp,
    // IconLabelSpace 8dp, TrailingSpace 16dp.
    expect(source).toMatch(/height:\s*56px/)
    expect(source).toMatch(/min-width:\s*56px/)
    expect(source).toMatch(/border-radius:\s*16px/)
    expect(source).toMatch(/font-size:\s*24px/)
    expect(source).toMatch(/padding:\s*0 16px/)
    expect(source).toMatch(/margin:\s*0 0 0 8px/)
  })

  it('uses the primary container colors of the FAB', () => {
    expect(source).toContain('rgb(var(--v-theme-primary-container))')
    expect(source).toContain('rgb(var(--v-theme-on-primary-container))')
  })

  it('uses the titleMedium label typography', () => {
    expect(source).toMatch(/font-size:\s*16px;\s*line-height:\s*24px;\s*font-weight:\s*500/)
  })

  it('keeps the shouldExpandFAB scroll rule', () => {
    expect(source).toContain('lastScrolledBackward || !canScrollForward || !canScrollBackward')
  })
})
