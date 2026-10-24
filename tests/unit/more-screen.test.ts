import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const moreViewSource = readFileSync('src/features/settings/views/MoreView.vue', 'utf8')
const prefWidgetSource = readFileSync('src/core/components/MorePreferenceWidget.vue', 'utf8')

describe('MoreScreen matches Mihon reference (MoreScreen.kt / LogoHeader.kt)', () => {
  it('renders LogoHeader with 64dp icon, 32dp vertical padding and outlineVariant divider', () => {
    // LogoHeader.kt: Icon(ic_mihon, Modifier.padding(vertical = 32.dp).size(64.dp), tint = onSurface)
    expect(moreViewSource).toMatch(/width="64"\s+height="64"/)
    expect(moreViewSource).toContain('MORE_SYMBOLS.mihonLogo')
    expect(moreViewSource).toMatch(/\.more-logo\s*\{[^}]*padding:\s*32px 0;/s)
    expect(moreViewSource).toMatch(/\.more-logo\s*\{[^}]*color:\s*rgb\(var\(--v-theme-on-surface\)\);/s)
    expect(moreViewSource).toMatch(/<v-divider\s+color="outline-variant"\s+:opacity="1"\s*\/>/)
  })

  it('contains all items in the exact reference order', () => {
    // MoreScreen.kt order:
    // LogoHeader -> Downloaded only -> Incognito mode -> Divider ->
    // Download queue -> Categories -> Statistics -> Data and storage -> Divider ->
    // Settings -> Support Us -> About -> Help
    const items = [
      'more-logo',
      'title="Downloaded only"',
      'title="Incognito mode"',
      ':opacity="1"',
      'title="Download queue"',
      'title="Categories"',
      'title="Statistics"',
      'title="Data and storage"',
      ':opacity="1"',
      'title="Settings"',
      'title="Support Us"',
      'title="About"',
      'title="Help"',
    ]

    let lastIndex = -1
    for (const item of items) {
      const idx = moreViewSource.indexOf(item, lastIndex + 1)
      expect(idx).toBeGreaterThan(lastIndex)
      lastIndex = idx
    }
  })

  it('configures Downloaded only and Incognito mode with switches and subtitles', () => {
    // MR.strings.label_downloaded_only: "Downloaded only"
    // MR.strings.downloaded_only_summary: "Filters all entries in your library"
    expect(moreViewSource).toContain('title="Downloaded only"')
    expect(moreViewSource).toContain('subtitle="Filters all entries in your library"')
    expect(moreViewSource).toContain('icon="cloud_off"')

    // MR.strings.pref_incognito_mode: "Incognito mode"
    // MR.strings.pref_incognito_mode_summary: "Pauses reading history"
    expect(moreViewSource).toContain('title="Incognito mode"')
    expect(moreViewSource).toContain('subtitle="Pauses reading history"')
    expect(moreViewSource).toContain(':icon-path="MORE_SYMBOLS.eyeglasses2"')
  })

  it('supports badge and status summary on Download queue item', () => {
    expect(moreViewSource).toContain(':badge="queuePending || undefined"')
    expect(moreViewSource).toContain(':subtitle="queueSummary"')
    expect(moreViewSource).toContain('icon="download"')
  })

  it('binds the navigation targets matching Mihon MoreTab.kt', () => {
    // Categories: CategoryScreen()
    expect(moreViewSource).toContain("router.push('/categories')")
    // Data and storage: SettingsScreen(Destination.DataAndStorage)
    expect(moreViewSource).toContain("router.push('/settings/data')")
    // Settings: SettingsScreen()
    expect(moreViewSource).toContain("router.push('/settings')")
    // About: SettingsScreen(Destination.About)
    expect(moreViewSource).toContain("router.push('/about')")
    // Help: uriHandler.openUri(Constants.URL_HELP)
    expect(moreViewSource).toContain('https://mihon.app/docs/guides/troubleshooting/')
  })

  it('provides fallback dialog for Statistics in web headless client', () => {
    expect(moreViewSource).toContain('v-dialog v-model="statsOpen"')
    expect(moreViewSource).toContain('Statistics are not supported in the web version')
  })
})

describe('MorePreferenceWidget matches BasePreferenceWidget / TextPreferenceWidget', () => {
  it('implements 56dp minHeight and proper padding', () => {
    // BasePreferenceWidget.kt: minHeight = 56.dp, PrefsVerticalPadding = 16.dp
    expect(prefWidgetSource).toMatch(/min-height:\s*56px;/)
    // Icon Box: padding(start = 16.dp, end = 8.dp)
    expect(prefWidgetSource).toMatch(/padding:\s*0 8px 0 16px;/)
    // Text Column: padding(vertical = 16.dp)
    expect(prefWidgetSource).toMatch(/\.pref-text\s*\{[^}]*padding:\s*16px;/s)
    // Widget Box: padding(end = 16.dp)
    expect(prefWidgetSource).toMatch(/\.pref-widget\s*\{[^}]*padding:\s*0 16px 0 0;/s)
  })

  it('uses M3 typography and secondaryItemAlpha for subtitle', () => {
    // Title: titleLarge (fontSize 16sp, lineHeight 24px)
    expect(prefWidgetSource).toMatch(/\.pref-title\s*\{[^}]*font-size:\s*16px;/s)
    expect(prefWidgetSource).toMatch(/\.pref-title\s*\{[^}]*line-height:\s*24px;/s)
    // Subtitle: bodySmall (fontSize 12sp, lineHeight 16sp), secondaryItemAlpha (0.78)
    expect(prefWidgetSource).toMatch(/\.pref-subtitle\s*\{[^}]*font-size:\s*12px;/s)
    expect(prefWidgetSource).toMatch(/\.pref-subtitle\s*\{[^}]*line-height:\s*16px;/s)
    expect(prefWidgetSource).toContain('78%')
  })

  it('renders MD3 state layers for hover, active and focus', () => {
    expect(prefWidgetSource).toContain('.pref-row:hover:not(.pref-row--disabled)')
    expect(prefWidgetSource).toContain('8%')
    expect(prefWidgetSource).toContain('.pref-row:active:not(.pref-row--disabled)')
    expect(prefWidgetSource).toContain('12%')
    expect(prefWidgetSource).toContain('.pref-row:focus-visible:not(.pref-row--disabled)')
    expect(prefWidgetSource).toContain('10%')
  })
})
