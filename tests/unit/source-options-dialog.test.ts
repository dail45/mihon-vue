import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/browse/components/SourceOptionsDialog.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/features/browse/components/SourceOptionsDialog.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/browse/SourcesScreen.kt (SourceOptionsDialog).
 * The reference is Kotlin, so the invariants are asserted on the ported metrics.
 */
describe('SourceOptionsDialog parity with Mihon', () => {
  it('uses the Material3 alert dialog shape, colour and container padding', () => {
    // AlertDialogDefaults.shape = ShapeKeyTokens.CornerExtraLarge (28dp).
    expect(source).toContain('rounded="28px"')
    // AlertDialogDefaults.containerColor = SurfaceContainerHigh.
    expect(source).toContain('color="surface-container-high"')
    // dialogPadding = 24dp on all sides.
    expect(source).toMatch(/\.source-options-card \{ padding: 24px; \}/)
    // BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp).
    expect(source).toContain('min-width: min(280px, calc(100% - 48px))')
    expect(source).toContain('max-width: min(560px, calc(100% - 48px))')
  })

  it('uses the Material3 title and supporting text typography', () => {
    // Title: headlineSmall (24sp / 32sp) in on-surface, 16dp bottom padding.
    expect(source).toMatch(/font-size: 24px;/)
    expect(source).toMatch(/line-height: 32px;/)
    expect(source).toMatch(/\.source-options-title \{[^}]*margin: 0 0 16px;/s)
    expect(source).toContain('color: rgb(var(--v-theme-on-surface))')
    // Supporting text: bodyMedium (14sp / 20sp) in on-surface-variant.
    expect(source).toMatch(/font-size: 14px;/)
    expect(source).toMatch(/line-height: 20px;/)
    expect(source).toContain('letter-spacing: 0.0178571429em')
    expect(source).toContain('color: rgb(var(--v-theme-on-surface-variant))')
    // textPadding = bottom 24dp.
    expect(source).toMatch(/\.source-options-text \{ padding-bottom: 24px; \}/)
  })

  it('renders the Pin/Unpin and Disable entries as full width 16dp padded rows', () => {
    // MR.strings.action_pin / action_unpin / action_disable.
    expect(source).toContain("'Unpin' : 'Pin'")
    expect(source).toContain('>Disable<')
    // The local source has no Disable entry (source.isLocal()).
    expect(source).toContain('v-if="!isLocal"')
    // The entries fill the width and use 16dp vertical padding.
    expect(source).toMatch(/padding: 16px 0;/)
    expect(source).toMatch(/width: 100%;/)
  })

  it('keeps the pin action functional and stubs the source disabling', () => {
    // Mihon keeps the pin state app-local, the web client does the same.
    expect(source).toContain('toggleSourcePin')
    // Suwayomi-Server has no REST contract to disable a source: honest stub, not a hidden action.
    expect(source).toContain('Disabling a source is not supported in the web version')
    expect(source).toContain('role="status"')
  })
})
