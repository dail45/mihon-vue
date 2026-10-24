import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/settings/views/OpenSourceLicensesView.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/features/settings/views/OpenSourceLicensesView.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/about/OpenSourceLicensesScreen.kt
 * and the AboutLibraries 15.3.0 Material3 variant it renders (Traditional row + detail sheet).
 */
describe('OpenSourceLicensesView parity with Mihon', () => {
  it('renders the AppBar top bar exactly like AppBar.kt', () => {
    // AppBar.kt: TopAppBar with the up navigation icon (action_bar_up_description = "Navigate up") and the title in titleLarge.
    expect(source).toContain('aria-label="Navigate up"')
    expect(source).toContain('icon="arrow_back"')
    // TopAppBar is 64dp tall and uses surfaceColorAtElevation(0dp) = surface.
    expect(source).toMatch(/\.licenses-toolbar \{[^}]*height: 64px;/s)
    expect(source).toContain('background: rgb(var(--v-theme-surface))')
    // titleLarge = 22sp / 28sp, weight 400.
    expect(source).toMatch(/\.licenses-toolbar-title \{[^}]*font-size: 22px;/s)
    expect(source).toMatch(/\.licenses-toolbar-title \{[^}]*line-height: 28px;/s)
    // Pinned scroll elevation behavior to surfaceContainer.
    expect(source).toContain('.licenses-toolbar.is-scrolled')
    expect(source).toContain('background: rgb(var(--v-theme-surface-container))')
    // The shared shell bar is hidden while this screen owns its own top bar.
    expect(source).toContain('licenses-toolbar')
  })

  it('uses the AboutLibraries Traditional row metrics', () => {
    // rowPaddingCozy = PaddingValues(horizontal = 20.dp, vertical = 14.dp).
    expect(source).toMatch(/\.library-row \{[^}]*padding: 14px 20px;/s)
    // Cozy density uses Arrangement.spacedBy(4.dp).
    expect(source).toMatch(/\.library-row \{[^}]*gap: 4px;/s)
    // nameTextStyle = titleMedium, 16sp / 24sp, weight 500.
    expect(source).toMatch(/\.library-row__name \{[^}]*font-size: 16px;/s)
    expect(source).toMatch(/\.library-row__name \{[^}]*line-height: 24px;/s)
    expect(source).toMatch(/\.library-row__name \{[^}]*font-weight: 500;/s)
    // versionTextStyle = labelSmall 11sp rendered with FontFamily.Monospace.
    expect(source).toMatch(/\.library-row__version \{[^}]*font-size: 11px;/s)
    expect(source).toContain('font-family: ui-monospace')
    // authorTextStyle = bodySmall 11sp in the subtle on-surface-variant colour.
    expect(source).toMatch(/\.library-row__author \{[^}]*font-size: 11px;/s)
    expect(source).toContain('color: rgb(var(--v-theme-on-surface-variant))')
    // License badges are a FlowRow with spacedBy(6.dp).
    expect(source).toMatch(/\.library-row__badges \{[^}]*gap: 6px;/s)
    // LicenseBadge: 50% rounded shape (pill), padding horizontal 10dp / vertical 3dp, labelSmall 11sp Medium.
    expect(source).toMatch(/\.licenses-license-badge \{[^}]*padding: 3px 10px;/s)
    expect(source).toMatch(/\.licenses-license-badge \{[^}]*border-radius: 999px;/s)
    expect(source).toMatch(/\.licenses-license-badge \{[^}]*font-size: 11px;/s)
    expect(source).toMatch(/\.licenses-license-badge \{[^}]*font-weight: 500;/s)
    // The list background is colorScheme.background.
    expect(source).toContain('background: rgb(var(--v-theme-background))')
  })

  it('uses the AboutLibraries detail sheet metrics', () => {
    // The reference opens the detail in a ModalBottomSheet (LibraryDetailMode.Sheet).
    expect(source).toContain('<v-bottom-sheet')
    // sheetSurface = surfaceContainerHigh, 28dp top corners.
    expect(source).toContain('background: rgb(var(--v-theme-surface-container-high))')
    expect(source).toContain('border-top-left-radius: 28px !important')
    // Scrim at 40% opacity.
    expect(source).toContain('rgba(0, 0, 0, 0.4)')
    // DefaultDragHandle: 32dp x 4dp, radius 2dp, onSurfaceVariant at 40%.
    expect(source).toMatch(/\.licenses-sheet__handle \{[^}]*width: 32px;/s)
    expect(source).toMatch(/\.licenses-sheet__handle \{[^}]*height: 4px;/s)
    expect(source).toMatch(/\.licenses-sheet__handle \{[^}]*border-radius: 2px;/s)
    expect(source).toContain('on-surface-variant)) 40%, transparent)')
    // Close button (крестик).
    expect(source).toContain('aria-label="Close"')
    expect(source).toContain('icon="close"')
    // sheetPadding = spacedBy(12.dp).
    expect(source).toMatch(/\.licenses-sheet__content-inner \{[^}]*gap: 12px;/s)
    expect(source).toMatch(/\.licenses-sheet__content-inner \{[^}]*padding: 8px 24px 28px;/s)
    // sheetTitleTextStyle = titleLarge 22sp SemiBold.
    expect(source).toMatch(/\.licenses-sheet__title \{[^}]*font-size: 22px;/s)
    expect(source).toMatch(/\.licenses-sheet__title \{[^}]*font-weight: 600;/s)
    // sheetMetaTextStyle = bodyMedium 13sp.
    expect(source).toMatch(/\.licenses-sheet__meta \{[^}]*font-size: 13px;/s)
    // ActionChip: radius 8dp, padding horizontal 12dp / vertical 6dp, labelLarge 12sp Medium, open_in_new icon.
    expect(source).toContain('icon="open_in_new"')
    expect(source).toMatch(/\.licenses-action-chip \{[^}]*padding: 6px 12px;/s)
    expect(source).toMatch(/\.licenses-action-chip \{[^}]*border-radius: 8px;/s)
    expect(source).toMatch(/\.licenses-action-chip \{[^}]*font-size: 12px;/s)
    // License body box: 16dp radius, 16dp padding, surfaceContainerHighest, monospace font.
    expect(source).toMatch(/\.licenses-sheet__license \{[^}]*border-radius: 16px;/s)
    expect(source).toMatch(/\.licenses-sheet__license \{[^}]*padding: 16px;/s)
    expect(source).toContain('background: rgb(var(--v-theme-surface-container-highest))')
    expect(source).toMatch(/\.licenses-sheet__license \{[^}]*font-family: ui-monospace/s)
    // Dismissal behaviors: swipe, Escape key, click outside.
    expect(source).toContain('onTouchStart')
    expect(source).toContain('onTouchMove')
    expect(source).toContain('onTouchEnd')
    expect(source).toContain('@keydown.esc="closeSheet"')
  })

  it('keeps the license badge hues of the AboutLibraries M3 palette', () => {
    // Dark palette (m3_tokens.kt).
    expect(source).toContain("'Apache-2.0': '#B69CFF'")
    expect(source).toContain("'MIT': '#7AC0FF'")
    // Light palette.
    expect(source).toContain("'Apache-2.0': '#5030BB'")
    expect(source).toContain("'MIT': '#1560A8'")
    // The badge container is the hue at 15% alpha, the badge content is the hue itself.
    expect(source).toContain('15%, transparent)')
  })
})
