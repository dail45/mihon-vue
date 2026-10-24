import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'src/features/library/components/LibraryCategoryTabs.vue'), 'utf8')

describe('LibraryCategoryTabs Material 3 parity', () => {
  it('sizes indicator to label content width rather than full tab width', () => {
    // PrimaryScrollableTabRow: indicator matches content width (label + badge)
    expect(source).toContain("const label = tab.querySelector<HTMLElement>('.library-tab-label')")
    expect(source).toContain('const width = label ? label.offsetWidth : tab.offsetWidth')
    expect(source).toContain('const left = label ? tab.offsetLeft + label.offsetLeft : tab.offsetLeft')
    expect(source).toContain('width: `${width}px`')
    expect(source).toContain('transform: `translateX(${left}px)`')
  })

  it('protects against sticky hover on touch/swipe devices', () => {
    // Only apply hover opacity on devices that actually support hover
    expect(source).toContain('@media (hover: hover) and (pointer: fine)')
    expect(source).toContain('@media (hover: none)')
    expect(source).toMatch(/\.library-tab:not\(:active\):not\(:focus-visible\)::before\s*\{[^}]*opacity:\s*0\s*!important/s)
  })

  it('blurs clicked tab to prevent persistent focus styling on mobile', () => {
    expect(source).toContain(';(event.currentTarget as HTMLElement | null)?.blur()')
  })
})
