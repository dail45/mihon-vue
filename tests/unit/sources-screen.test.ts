import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { getSourceDisplayName } from '@/features/browse/utils/sourceLanguage'

const browseViewSource = readFileSync('src/features/browse/views/BrowseView.vue', 'utf8')

/**
 * Parity tests for BrowseView Sources tab against Mihon Jetpack Compose:
 * - presentation/browse/SourcesScreen.kt
 * - presentation/browse/components/BaseSourceItem.kt
 * - presentation/browse/components/BaseBrowseItem.kt
 * - presentation/browse/components/BrowseIcons.kt
 * - presentation/components/TabbedScreen.kt
 */
describe('SourcesScreen parity with Mihon Compose', () => {
  it('uses getSourceDisplayName with exact Mihon display mappings', () => {
    expect(getSourceDisplayName('last_used')).toBe('Last used')
    expect(getSourceDisplayName('pinned')).toBe('Pinned')
    expect(getSourceDisplayName('other')).toBe('Other')
    expect(getSourceDisplayName('localsourcelang')).toBe('Other')
    expect(getSourceDisplayName('all')).toBe('Multi')
    expect(getSourceDisplayName('en')).toBe('English')
    expect(getSourceDisplayName('ru')).toBe('Русский')
  })

  it('implements Material 3 typography and padding for group headers', () => {
    // SourceHeader: typography.header = bodyMedium (14sp / 20sp, SemiBold 600, ls 0.25px) in onSurfaceVariant
    // padding: horizontal 16dp, vertical 8dp
    expect(browseViewSource).toMatch(/\.source-group-header\s*\{[^}]*font-size:\s*14px;/s)
    expect(browseViewSource).toMatch(/\.source-group-header\s*\{[^}]*line-height:\s*20px;/s)
    expect(browseViewSource).toMatch(/\.source-group-header\s*\{[^}]*font-weight:\s*600;/s)
    expect(browseViewSource).toMatch(/\.source-group-header\s*\{[^}]*letter-spacing:\s*\.?25px;/s)
    expect(browseViewSource).toMatch(/\.source-group-header\s*\{[^}]*padding:\s*8px 16px;/s)
    expect(browseViewSource).toContain('color: rgb(var(--v-theme-on-surface-variant));')
  })

  it('implements BaseBrowseItem 64dp row geometry and paddings', () => {
    // Row padding: horizontal 16dp, vertical 8dp. Icon: 48dp -> row 64dp min-height
    expect(browseViewSource).toMatch(/\.source-row\s*\{[^}]*min-height:\s*64px;/s)
    expect(browseViewSource).toMatch(/\.source-row\s*\{[^}]*padding:\s*8px 16px;/s)
    expect(browseViewSource).toMatch(/\.source-icon-wrap\s*\{[^}]*width:\s*48px;\s*height:\s*48px;/s)
    // 16dp horizontal text padding
    expect(browseViewSource).toMatch(/\.source-text\s*\{[^}]*padding:\s*0 16px;/s)
  })

  it('implements BaseSourceItem typography: bodyMedium name and bodySmall 0.78 alpha language', () => {
    // Title: bodyMedium (14sp / 20sp, weight 400, onSurface)
    expect(browseViewSource).toMatch(/\.source-name\s*\{[^}]*font-size:\s*14px;/s)
    expect(browseViewSource).toMatch(/\.source-name\s*\{[^}]*line-height:\s*20px;/s)
    expect(browseViewSource).toMatch(/\.source-name\s*\{[^}]*font-weight:\s*400;/s)
    expect(browseViewSource).toContain('color: rgb(var(--v-theme-on-surface));')

    // Subtitle: bodySmall (12sp / 16sp, weight 400, secondaryItemAlpha = 0.78)
    expect(browseViewSource).toMatch(/\.source-lang\s*\{[^}]*font-size:\s*12px;/s)
    expect(browseViewSource).toMatch(/\.source-lang\s*\{[^}]*line-height:\s*16px;/s)
    expect(browseViewSource).toContain('color: rgb(var(--v-theme-on-surface) / 0.78);')
  })

  it('implements TextButton specs for the Latest action', () => {
    // M3 TextButton: height 40dp, min-width 48dp, padding 12dp horizontal, CornerFull 20dp
    expect(browseViewSource).toMatch(/\.source-latest-btn\s*\{[^}]*height:\s*40px;/s)
    expect(browseViewSource).toMatch(/\.source-latest-btn\s*\{[^}]*min-width:\s*48px\s*!important;/s)
    expect(browseViewSource).toMatch(/\.source-latest-btn\s*\{[^}]*padding:\s*0 12px\s*!important;/s)
    expect(browseViewSource).toMatch(/\.source-latest-btn\s*\{[^}]*border-radius:\s*20px;/s)
  })

  it('implements touch-slop cancellation for long-press combinedClickable', () => {
    expect(browseViewSource).toContain('TOUCH_SLOP_PX = 8')
    expect(browseViewSource).toContain('Math.hypot')
    expect(browseViewSource).toContain('pressMove')
    expect(browseViewSource).toContain('pressStart')
    expect(browseViewSource).toContain('pressEnd')
  })

  it('implements ScrollbarLazyColumn vertical scrollbar parity and contentPadding', () => {
    // ScrollbarLazyColumn topSmallPaddingValues (top 8dp) + bottom content padding
    expect(browseViewSource).toMatch(/\.sources-list\s*\{[^}]*padding-top:\s*8px;/s)
    expect(browseViewSource).toContain('scrollbar-width: thin;')
    expect(browseViewSource).toContain('36.4%')
  })

  it('uses MihonEmptyScreen with the exact string resource MR.strings.source_empty_screen', () => {
    expect(browseViewSource).toContain('<MihonEmptyScreen')
    expect(browseViewSource).toContain("'No source found'")
  })

  it('provides accessible role and keyboard activation for source rows', () => {
    expect(browseViewSource).toContain('role="button"')
    expect(browseViewSource).toContain('tabindex="0"')
    expect(browseViewSource).toContain('@keydown.enter.prevent=')
    expect(browseViewSource).toContain('@keydown.space.prevent=')
  })
})
