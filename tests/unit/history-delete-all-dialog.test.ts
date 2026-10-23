import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/HistoryDeleteAllDialog.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/components/HistoryDeleteAllDialog.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/history/components/HistoryDialogs.kt:62-89
 * (HistoryDeleteAllDialog). The reference is Kotlin, so the invariants are asserted on the
 * ported Material3 metrics.
 */
describe('HistoryDeleteAllDialog parity with Mihon', () => {
  it('uses the Material3 alert dialog shape, colour, flat variant and container padding', () => {
    // AlertDialogDefaults.shape = ShapeKeyTokens.CornerExtraLarge (28dp).
    expect(source).toContain('rounded="28px"')
    // AlertDialogDefaults.containerColor = SurfaceContainerHigh.
    expect(source).toContain('color="surface-container-high"')
    // Dialog surface is flat (no drop shadow).
    expect(source).toContain('variant="flat"')
    expect(source).toContain('box-shadow: none;')
    // dialogPadding = 24dp on all sides.
    expect(source).toMatch(/\.history-delete-all-card \{[^}]*padding: 24px;/s)
    // BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp).
    expect(source).toContain('min-width: min(280px, calc(100% - 48px))')
    expect(source).toContain('max-width: min(560px, calc(100% - 48px))')
    // App components CSS layer.
    expect(source).toContain('@layer app-components')
  })

  it('renders the reference title and confirmation text with accessibility ids', () => {
    // MR.strings.action_remove_everything.
    expect(source).toContain('Remove everything')
    // MR.strings.clear_history_confirmation.
    expect(source).toContain('Are you sure? All history will be lost.')
    // Dynamic aria attributes via useId().
    expect(source).toContain(':content-props="{ \'aria-labelledby\': titleId, \'aria-describedby\': textId }"')
    expect(source).toContain(':id="titleId"')
    expect(source).toContain(':id="textId"')
    // The reference dialog has no icon and no checkbox.
    expect(source).not.toContain('v-checkbox')
  })

  it('uses the Material3 title and supporting text typography', () => {
    // Title: headlineSmall (24sp / 32sp) in on-surface, 16dp bottom padding.
    expect(source).toMatch(/font-size: 24px;/)
    expect(source).toMatch(/line-height: 32px;/)
    expect(source).toMatch(/\.history-delete-all-title \{[^}]*margin: 0 0 16px;/s)
    expect(source).toContain('color: rgb(var(--v-theme-on-surface))')
    // Supporting text: bodyMedium (14sp / 20sp) in on-surface-variant.
    expect(source).toMatch(/font-size: 14px;/)
    expect(source).toMatch(/line-height: 20px;/)
    expect(source).toContain('letter-spacing: 0.0178571429em')
    expect(source).toContain('color: rgb(var(--v-theme-on-surface-variant))')
    // textPadding = bottom 24dp.
    expect(source).toMatch(/\.history-delete-all-text \{[^}]*margin: 0 0 24px;/s)
  })

  it('renders the action row as MD3 text buttons in the reference order', () => {
    // MR.strings.action_cancel and MR.strings.action_ok.
    expect(source).toContain('>Cancel<')
    expect(source).toContain('>OK<')
    // The buttons are TextButtons: labelLarge (14sp / 20sp, weight 500) in primary.
    expect(source).toMatch(/\.history-delete-all-button \{[^}]*font-weight: 500;/s)
    expect(source).toMatch(/\.history-delete-all-button \{[^}]*min-width: 58px;/s)
    expect(source).toMatch(/\.history-delete-all-button \{[^}]*height: 40px;/s)
    expect(source).toMatch(/\.history-delete-all-button \{[^}]*padding: 8px 12px;/s)
    expect(source).toMatch(/\.history-delete-all-button \{[^}]*text-transform: none;/s)
    // ButtonSmallTokens.ContainerShapeRound = CornerFull, pressed shape = CornerSmall (8dp).
    // CornerFull at the 40dp container height is a 20dp radius.
    expect(source).toMatch(/\.history-delete-all-button \{[^}]*border-radius: 20px;/s)
    expect(source).toMatch(/\.history-delete-all-button:active \{ border-radius: 8px; \}/)
    // State layer: 8% on hover, 10% on pressed.
    expect(source).toMatch(/\.history-delete-all-button:hover::after \{ opacity: 0\.08; \}/)
    expect(source).toMatch(/\.history-delete-all-button:active::after \{ opacity: 0\.1; \}/)
    // AlertDialogFlowRow spacing.
    expect(source).toMatch(/\.history-delete-all-actions \{[^}]*gap: 8px;/s)
  })

  it('dismisses on cancel and on confirm, in the reference order', () => {
    // onDismissRequest on both the dismiss button and the confirm button.
    expect(source).toMatch(/function onDismiss\(\)/)
    expect(source).toMatch(/function onClickDelete\(\) \{[^}]*emit\('delete'\)\s*onDismiss\(\)/s)
  })

  it('stubs the history clear, because Suwayomi exposes no history delete route', () => {
    // Mihon calls removeHistory.awaitAll(); the Suwayomi REST v1 contract has no such route,
    // so the action reports honestly instead of pretending to delete the history.
    expect(source).toContain('Clearing the whole history is not supported in the web version')
    expect(source).toContain('role="status"')
    expect(source).toContain('history-delete-all-snackbar-fade')
  })
})
