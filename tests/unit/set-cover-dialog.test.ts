import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/reader/components/SetCoverDialog.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/features/reader/components/SetCoverDialog.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/reader/ReaderPageActionsDialog.kt
 * (private fun SetCoverDialog). The reference is Kotlin, so the invariants are asserted on the
 * ported Material3 metrics of androidx.compose.material3.AlertDialog.
 */
describe('SetCoverDialog parity with Mihon', () => {
  it('uses the Material3 alert dialog container metrics', () => {
    // AlertDialogDefaults.shape = ShapeKeyTokens.CornerExtraLarge (28dp).
    expect(source).toMatch(/border-radius: 28px;/)
    // AlertDialogDefaults.containerColor = SurfaceContainerHigh.
    expect(source).toContain('background: rgb(var(--v-theme-surface-container-high))')
    // AlertDialogDefaults.dialogPadding = 24dp on all sides.
    expect(source).toMatch(/padding: 24px;/)
    // BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp).
    expect(source).toContain('min-width: min(280px, calc(100vw - 48px))')
    expect(source).toContain('max-width: min(560px, calc(100vw - 48px))')
    // tonalElevation = 0.dp and no shadow elevation: the surface has no drop shadow.
    expect(source).toMatch(/box-shadow: none;/)
  })

  it('uses the Material3 supporting text typography', () => {
    // DialogTokens.SupportingTextFont = BodyMedium (14sp / 20sp, w400) in on-surface-variant.
    expect(source).toMatch(/font-size: 14px;/)
    expect(source).toMatch(/line-height: 20px;/)
    expect(source).toContain('letter-spacing: 0.0178571429em')
    expect(source).toContain('color: rgb(var(--v-theme-on-surface-variant))')
    // The text slot has a 24dp bottom gap before the button row.
    expect(source).toMatch(/\.set-cover-text \{[^}]*margin: 0 0 24px;/s)
  })

  it('renders the reference strings of the Mihon dialog', () => {
    // MR.strings.confirm_set_image_as_cover / action_ok / action_cancel.
    expect(source).toContain('Use this image as cover art?')
    expect(source).toContain('>OK<')
    expect(source).toContain('>Cancel<')
  })

  it('renders the dismiss button left of the confirm button', () => {
    // AlertDialogFlowRow flips the layout direction: the composition order is confirmButton then
    // dismissButton, so the dismiss button ("Cancel") is rendered on the left.
    expect(source).toContain('flex-flow: row-reverse wrap')
    const actions = source.slice(source.indexOf('class="set-cover-actions"'))
    expect(actions.indexOf('>OK<')).toBeLessThan(actions.indexOf('>Cancel<'))
  })

  it('styles the action labels as Material3 text buttons', () => {
    // TextButton: height 40dp, min width 64dp, content padding 12dp, shape = CornerFull (20dp).
    expect(source).toMatch(/min-width: 64px;/)
    expect(source).toMatch(/height: 40px;/)
    expect(source).toMatch(/padding: 8px 12px;/)
    expect(source).toMatch(/border-radius: 20px;/)
    // labelLarge (14sp / 500) in the primary colour (DialogTokens.ActionLabelTextColor).
    expect(source).toContain('letter-spacing: 0.0071428571em')
    expect(source).toContain('color: rgb(var(--v-theme-primary))')
    // State layer: 8% on hover, 10% while pressed.
    expect(source).toMatch(/\.set-cover-button:hover \{[^}]*8%/s)
    expect(source).toMatch(/\.set-cover-button:active \{[^}]*10%/s)
  })

  it('dismisses on the back press without reaching the page actions sheet', () => {
    // The Compose dialog is its own window, so Escape only closes it.
    expect(source).toMatch(/@keydown="onKeydown"/)
    expect(source).toContain('event.stopPropagation()')
    expect(source).not.toMatch(/window\.addEventListener\('keydown'/)
  })

  it('reports that the cover cannot be set in the web version', () => {
    // Suwayomi REST v1 exposes no cover upload endpoint, so the confirmation is an honest stub.
    expect(source).toContain('not supported in the web version')
    expect(source).toContain("emit('confirm')")
  })
})
