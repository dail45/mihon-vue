import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { searchSettings, settingsIndex } from '../../src/data/settingsIndex'

const source = readFileSync('src/features/settings/views/SettingsSearchView.vue', 'utf8')

/**
 * Parity audit against Mihon Compose:
 * - `eu/kanade/presentation/more/settings/screen/SettingsSearchScreen.kt`
 * - `eu/kanade/presentation/components/AppBar.kt` (SearchToolbar, UpIcon, PlainTooltip)
 * - `tachiyomi/presentation/core/screens/EmptyScreen.kt`
 * - `eu/kanade/presentation/more/settings/widget/BasePreferenceWidget.kt`
 */
describe('SettingsSearchScreen parity with Mihon Compose', () => {
  it('implements TopAppBar (64dp height, surface color, flat zero elevation, 4dp padding)', () => {
    expect(source).toMatch(/\.ss-bar\s*\{[^}]*height:\s*64px/s)
    expect(source).toMatch(/\.ss-bar\s*\{[^}]*background:\s*rgb\(var\(--v-theme-surface\)\)/s)
    expect(source).toMatch(/\.ss-bar\s*\{[^}]*padding-inline:\s*4px/s)
  })

  it('implements navigation icon UpIcon with PlainTooltip "Navigate up" (arrow_back 24dp, 48x48dp target, 40dp state layer)', () => {
    expect(source).toContain('aria-label="Navigate up"')
    expect(source).toContain('title="Navigate up"')
    expect(source).toContain('arrow_back')
    expect(source).toContain('<span class="ss-tooltip" role="tooltip">Navigate up</span>')

    // Touch target: 48x48dp
    expect(source).toMatch(/\.ss-icon-btn\s*\{[^}]*width:\s*48px/s)
    expect(source).toMatch(/\.ss-icon-btn\s*\{[^}]*height:\s*48px/s)

    // State layer: 40x40dp circular CornerFull
    expect(source).toMatch(/\.ss-icon-btn::before\s*\{[^}]*width:\s*40px/s)
    expect(source).toMatch(/\.ss-icon-btn::before\s*\{[^}]*height:\s*40px/s)
    expect(source).toMatch(/\.ss-icon-btn::before\s*\{[^}]*border-radius:\s*50%/s)

    // Icon glyph: 24dp
    expect(source).toMatch(/\.ss-icon\s*\{[^}]*font-size:\s*24px/s)
    expect(source).toMatch(/\.ss-icon\s*\{[^}]*width:\s*24px/s)
    expect(source).toMatch(/\.ss-icon\s*\{[^}]*height:\s*24px/s)
  })

  it('implements Reset/Clear action with PlainTooltip "Reset" (close 24dp, keeps focus on click)', () => {
    expect(source).toContain('v-if="query"')
    expect(source).toContain('aria-label="Reset"')
    expect(source).toContain('title="Reset"')
    expect(source).toContain('close')
    expect(source).toContain('<span class="ss-tooltip" role="tooltip">Reset</span>')
    expect(source).toContain("query.value = ''")
    expect(source).toContain('input.value?.focus()')
  })

  it('implements BasicTextField (bodyLarge 16/24sp w400, caret primary, onSurface color, placeholder secondaryItemAlpha 0.78, Enter & Esc handlers)', () => {
    expect(source).toMatch(/\.ss-input\s*\{[^}]*font-size:\s*16px/s)
    expect(source).toMatch(/\.ss-input\s*\{[^}]*line-height:\s*24px/s)
    expect(source).toMatch(/\.ss-input\s*\{[^}]*font-weight:\s*400/s)
    expect(source).toMatch(/\.ss-input\s*\{[^}]*caret-color:\s*rgb\(var\(--v-theme-primary\)\)/s)
    expect(source).toMatch(/\.ss-input\s*\{[^}]*color:\s*rgb\(var\(--v-theme-on-surface\)\)/s)
    expect(source).toMatch(/\.ss-input::placeholder\s*\{[^}]*78%/s)

    // Key handlers
    expect(source).toContain('@keydown.enter.prevent="input?.blur()"')
    expect(source).toContain('@keydown.esc.prevent="goUp"')
  })

  it('implements HorizontalDivider (1dp, outlineVariant)', () => {
    expect(source).toMatch(/\.ss-divider\s*\{[^}]*height:\s*1px/s)
    expect(source).toMatch(/\.ss-divider\s*\{[^}]*background:\s*rgb\(var\(--v-theme-outline-variant\)\)/s)
  })

  it('uses MihonEmptyScreen for no results found state with kaomoji glyph and bodyMedium', () => {
    expect(source).toContain("import MihonEmptyScreen from '@/core/components/MihonEmptyScreen.vue'")
    expect(source).toContain('message="No results found"')
  })

  it('implements SearchResultItem (min-height 56dp, padding 14dp vertical / 24dp horizontal, title ellipsis, breadcrumbs bodySmall)', () => {
    expect(source).toMatch(/\.ss-result\s*\{[^}]*min-height:\s*56px/s)
    expect(source).toMatch(/\.ss-result\s*\{[^}]*padding:\s*14px 24px/s)
    expect(source).toMatch(/\.ss-result-title\s*\{[^}]*font-size:\s*16px/s)
    expect(source).toMatch(/\.ss-result-title\s*\{[^}]*text-overflow:\s*ellipsis/s)
    expect(source).toMatch(/\.ss-result-crumbs\s*\{[^}]*font-size:\s*12px/s)
    expect(source).toMatch(/\.ss-result-crumbs\s*\{[^}]*text-overflow:\s*ellipsis/s)
  })

  it('searches all 9 settings screens and caps results at 10 items', () => {
    expect(settingsIndex).toHaveLength(9)
    const screens = settingsIndex.map(s => s.key)
    expect(screens).toEqual([
      'appearance',
      'library',
      'reader',
      'downloads',
      'tracking',
      'browse',
      'data',
      'security',
      'advanced',
    ])

    const res = searchSettings('a')
    expect(res.length).toBeLessThanOrEqual(10)
    expect(res.length).toBeGreaterThan(0)

    const themeRes = searchSettings('theme')
    expect(themeRes.some(r => r.title.toLowerCase().includes('theme'))).toBe(true)
    expect(themeRes[0]?.breadcrumbs).toBeTruthy()
    expect(themeRes[0]?.highlightKey).toBeTruthy()
  })

  it('navigates with highlight key and route query on click', () => {
    expect(source).toContain('highlight.set(result.highlightKey)')
    expect(source).toContain('query: { highlight: result.highlightKey }')
  })
})
