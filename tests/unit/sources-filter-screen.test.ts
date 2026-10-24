import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { getSourceDisplayName } from '@/features/browse/utils/sourceLanguage'

const sourcesFilterSource = readFileSync('src/features/browse/views/SourcesFilterView.vue', 'utf8')

/**
 * Parity tests for SourcesFilterView against Mihon Jetpack Compose:
 * - presentation/browse/SourcesFilterScreen.kt
 * - presentation/more/settings/widget/SwitchPreferenceWidget.kt
 * - presentation/more/settings/widget/BasePreferenceWidget.kt
 * - presentation/browse/components/BaseSourceItem.kt
 * - presentation/browse/components/BaseBrowseItem.kt
 * - presentation/browse/components/BrowseIcons.kt
 * - presentation-core/src/main/java/tachiyomi/presentation/core/components/VerticalFastScroller.kt
 * - presentation-core/src/main/java/tachiyomi/presentation/core/screens/EmptyScreen.kt
 * - presentation-core/src/main/java/tachiyomi/presentation/core/screens/LoadingScreen.kt
 * - domain/source/interactor/GetLanguagesWithSources.kt
 */
describe('SourcesFilterScreen parity with Mihon Compose', () => {
  it('maps language display names exactly matching LocaleHelper.getSourceDisplayName', () => {
    expect(getSourceDisplayName('all')).toBe('Multi')
    expect(getSourceDisplayName('other')).toBe('Other')
    expect(getSourceDisplayName('localsourcelang')).toBe('Other')
    expect(getSourceDisplayName('en')).toBe('English')
    expect(getSourceDisplayName('ja')).toBe('日本語')
  })

  it('implements SwitchPreferenceWidget structure, typography and M3 Switch tokens', () => {
    // BasePreferenceWidget: minHeight = 56dp, TitleFontSize = 16sp, line-height 28sp (titleLarge), PrefsVerticalPadding = 16dp
    expect(sourcesFilterSource).toMatch(/\.sf-pref\s*\{[^}]*min-height:\s*56px;/s)
    expect(sourcesFilterSource).toMatch(/\.sf-pref-title\s*\{[^}]*font-size:\s*16px;/s)
    expect(sourcesFilterSource).toMatch(/\.sf-pref-title\s*\{[^}]*line-height:\s*28px;/s)
    expect(sourcesFilterSource).toMatch(/\.sf-pref-title\s*\{[^}]*font-weight:\s*400;/s)
    expect(sourcesFilterSource).toMatch(/\.sf-pref-title\s*\{[^}]*padding:\s*16px;/s)

    // Switch tokens: track 52x32dp, radius 16dp, thumb 16dp off / 24dp on (+16px shift)
    expect(sourcesFilterSource).toMatch(/\.sf-switch-track\s*\{[^}]*width:\s*52px;\s*height:\s*32px;\s*border-radius:\s*16px;/s)
    expect(sourcesFilterSource).toMatch(/\.sf-switch-thumb\s*\{[^}]*width:\s*16px;\s*height:\s*16px;/s)
    expect(sourcesFilterSource).toContain('transform: translateX(16px);')
    expect(sourcesFilterSource).toContain('rgb(var(--v-theme-surface-container-highest))')
    expect(sourcesFilterSource).toContain('rgb(var(--v-theme-outline))')
    expect(sourcesFilterSource).toContain('rgb(var(--v-theme-primary))')
    expect(sourcesFilterSource).toContain('rgb(var(--v-theme-on-primary))')
  })

  it('implements BaseSourceItem and BaseBrowseItem row geometry', () => {
    // BaseBrowseItem: padding horizontal 16dp, vertical 8dp
    expect(sourcesFilterSource).toMatch(/\.sf-source\s*\{[^}]*padding:\s*8px 16px;/s)

    // SourceIcon: width 48dp, height 40dp (40x40dp icon centered in 48x40dp slot)
    expect(sourcesFilterSource).toMatch(/\.sf-source-icon-wrap\s*\{[^}]*width:\s*48px;\s*height:\s*40px;/s)
    expect(sourcesFilterSource).toMatch(/\.sf-source-icon\s*\{[^}]*width:\s*40px;\s*height:\s*40px;/s)

    // Name: bodyMedium 14sp/20sp w400, 16dp horizontal margins
    expect(sourcesFilterSource).toMatch(/\.sf-source-name\s*\{[^}]*font-size:\s*14px;/s)
    expect(sourcesFilterSource).toMatch(/\.sf-source-name\s*\{[^}]*line-height:\s*20px;/s)
    expect(sourcesFilterSource).toMatch(/\.sf-source-name\s*\{[^}]*font-weight:\s*400;/s)
    expect(sourcesFilterSource).toMatch(/\.sf-source-name\s*\{[^}]*margin:\s*0 16px;/s)
  })

  it('implements Checkbox tokens for source visibility toggling', () => {
    // 20dp box with 2dp stroke, 2dp radius, square linecap checkmark
    expect(sourcesFilterSource).toMatch(/\.sf-checkbox-slot\s*\{[^}]*width:\s*24px;\s*height:\s*24px;/s)
    expect(sourcesFilterSource).toMatch(/\.sf-checkbox\s*\{[^}]*width:\s*20px;\s*height:\s*20px;/s)
    expect(sourcesFilterSource).toContain('stroke-linecap: square')
    expect(sourcesFilterSource).toContain('rgb(var(--v-theme-primary))')
  })

  it('implements VerticalFastScroller specs and hides native scrollbar', () => {
    // FastScroller: 28dp hit target, 12x48dp thumb, 6dp radius, primary color
    expect(sourcesFilterSource).toMatch(/\.sf-fast-scroll\s*\{[^}]*width:\s*28px;/s)
    expect(sourcesFilterSource).toMatch(/\.sf-thumb\s*\{[^}]*width:\s*12px;\s*height:\s*48px;\s*border-radius:\s*6px;/s)
    expect(sourcesFilterSource).toContain('background: rgb(var(--v-theme-primary));')
    expect(sourcesFilterSource).toContain('scrollbar-width: none;')
    expect(sourcesFilterSource).toContain('display: none;')
  })

  it('uses MihonEmptyScreen and Md3CircularProgress for empty and loading states', () => {
    expect(sourcesFilterSource).toContain('<MihonEmptyScreen')
    expect(sourcesFilterSource).toContain('message="No installed source found"')
    expect(sourcesFilterSource).toContain('<Md3CircularProgress />')
  })

  it('stores preferences persistently and synchronizes with BrowseView keys', () => {
    expect(sourcesFilterSource).toContain("'mihon.sourceLanguages'")
    expect(sourcesFilterSource).toContain("'mihon.disabledSources'")
  })
})
