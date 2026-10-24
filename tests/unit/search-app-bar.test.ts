import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/core/components/SearchAppBar.vue', 'utf8')

/**
 * Guards for pixel parity of `src/core/components/SearchAppBar.vue` with Mihon Compose:
 *  - `eu/kanade/presentation/components/AppBar.kt:263-418` (SearchToolbar)
 *  - `eu/kanade/presentation/components/AppBar.kt:137-164` (TopAppBar container)
 *  - `tachiyomi/presentation/core/components/material/IconButtonTokens.kt`
 */
describe('SearchAppBar parity with Mihon SearchToolbar', () => {
  it('implements Material 3 TopAppBar container (64dp, flat surface, zero elevation, 4dp layout padding)', () => {
    // Height 64dp, flat elevation, surface color
    expect(source).toContain('height="64"')
    expect(source).toContain('color="surface"')
    expect(source).toContain('flat')
    expect(source).toMatch(/\.search-app-bar\s*\{[^}]*box-shadow:\s*none/s)
    expect(source).toMatch(/\.search-app-bar\s*\{[^}]*background-color:\s*rgb\(var\(--v-theme-surface\)\)/s)
    // 4dp horizontal padding (TopAppBarTokens.NavIconLeading / content padding)
    expect(source).toMatch(/\.v-toolbar__content\)\s*\{[^}]*padding:\s*0 4px !important;/s)
    expect(source).toMatch(/\.v-toolbar__content\)\s*\{[^}]*height:\s*64px !important;/s)
  })

  it('implements back / close navigation button (arrow_back 24dp, 48x48dp touch target, 40dp ripple circle CornerFull)', () => {
    // Icon: arrow_back (MaterialSymbols AutoMirrored Rounded ArrowBack)
    expect(source).toContain('icon="arrow_back"')
    // Touch target: 48x48dp
    expect(source).toMatch(/\.search-app-bar__action\s*\{[^}]*width:\s*48px !important;/s)
    expect(source).toMatch(/\.search-app-bar__action\s*\{[^}]*height:\s*48px !important;/s)
    // State layer / ripple circle: 40dp (CornerFull / border-radius 50%)
    expect(source).toMatch(/\.v-btn__overlay\)\s*\{[^}]*width:\s*40px !important;/s)
    expect(source).toMatch(/\.v-btn__overlay\)\s*\{[^}]*height:\s*40px !important;/s)
    expect(source).toMatch(/\.v-btn__overlay\)\s*\{[^}]*border-radius:\s*50% !important;/s)
    expect(source).toMatch(/\.v-ripple__container\)\s*\{[^}]*width:\s*40px !important;/s)
    expect(source).toMatch(/\.v-ripple__container\)\s*\{[^}]*height:\s*40px !important;/s)
    // Icon size: 24dp
    expect(source).toMatch(/\.v-icon\)\s*\{[^}]*font-size:\s*24px !important;/s)
    expect(source).toMatch(/\.v-icon\)\s*\{[^}]*width:\s*24px !important;/s)
    expect(source).toMatch(/\.v-icon\)\s*\{[^}]*height:\s*24px !important;/s)
    // Content description and tooltip: "Navigate up" (MR.strings.action_bar_up_description)
    expect(source).toContain("closeLabel: 'Navigate up'")
    expect(source).toContain('role="tooltip"')
  })

  it('implements BasicTextField (titleMedium 18/24sp w400, letter-spacing 0.15px, onBackground color, secondaryItemAlpha 0.78)', () => {
    // BasicTextField port via v-text-field
    expect(source).toContain('<v-text-field')
    expect(source).not.toMatch(/<input\b/)
    // titleMedium: 18px / 24px w400, letter-spacing 0.15px
    expect(source).toMatch(/font-size:\s*18px !important;/s)
    expect(source).toMatch(/line-height:\s*24px !important;/s)
    expect(source).toMatch(/font-weight:\s*400 !important;/s)
    expect(source).toMatch(/letter-spacing:\s*0.15px !important;/s)
    // onBackground color and caret
    expect(source).toMatch(/color:\s*rgb\(var\(--v-theme-on-background\)\) !important;/s)
    expect(source).toMatch(/caret-color:\s*rgb\(var\(--v-theme-on-background\)\) !important;/s)
    // Placeholder with secondaryItemAlpha = 0.78 (SECONDARY_ALPHA)
    expect(source).toContain("placeholder: 'Search…'")
    expect(source).toMatch(/opacity:\s*0.78 !important;/s)
  })

  it('implements Clear / Reset button (close 24dp, shown when non-empty, retains focus)', () => {
    expect(source).toContain('v-else-if="isOpen && query"')
    expect(source).toContain('icon="close"')
    expect(source).toContain("resetLabel: 'Reset'")
    expect(source).toContain('focusInput()')
    expect(source).toContain("emit('clear')")
  })

  it('implements Search button (search 24dp, shown when closed and searchEnabled)', () => {
    expect(source).toContain('v-if="!isOpen && canSearch"')
    expect(source).toContain('icon="search"')
    expect(source).toContain("openLabel: 'Search'")
  })

  it('implements keyboard handlers: Enter confirms/finishes input, Escape closes search', () => {
    expect(source).toContain('@keydown.enter.prevent="submit"')
    expect(source).toContain('@keydown.esc.prevent="close"')
    expect(source).toContain("event.key === 'Escape'")
    expect(source).toContain("emit('search', current)")
  })

  it('implements M3 PlainTooltip anchored above buttons', () => {
    expect(source).toMatch(/\.search-app-bar__tooltip\s*\{[^}]*background:\s*rgb\(var\(--v-theme-inverse-surface\)\)/s)
    expect(source).toMatch(/\.search-app-bar__tooltip\s*\{[^}]*color:\s*rgb\(var\(--v-theme-inverse-on-surface\)\)/s)
    expect(source).toMatch(/\.search-app-bar__tooltip\s*\{[^}]*border-radius:\s*4px/s)
    expect(source).toMatch(/\.search-app-bar__tooltip\s*\{[^}]*font-size:\s*12px/s)
    expect(source).toMatch(/\.search-app-bar__tooltip\s*\{[^}]*bottom:\s*calc\(100% \+ 4px\)/s)
  })
})
