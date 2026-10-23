import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/MigrationProgressDialog.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/components/MigrationProgressDialog.vue` with
 * mihon/app/src/main/java/mihon/feature/migration/list/components/MigrationProgressDialog.kt.
 * The reference is Kotlin, so the invariants are asserted on the ported metrics.
 */
describe('MigrationProgressDialog parity with Mihon', () => {
  it('renders only the progress indicator and the Cancel confirm button', () => {
    // The reference AlertDialog has no title, no icon and no dismiss button.
    expect(source).not.toContain('<h2')
    // confirmButton = TextButton { Text(cancelLabel) }.
    expect(source).toContain('>Cancel</button>')
    // The text slot holds the LinearProgressIndicator only.
    expect(source).toContain('class="migration-progress-indicator"')
    expect(source).toContain('role="progressbar"')
  })

  it('keeps the dialog non dismissible like DialogProperties', () => {
    // dismissOnBackPress = false, dismissOnClickOutside = false.
    expect(source).toMatch(/<v-dialog[^>]*persistent/)
  })

  it('uses the Material3 alert dialog container metrics', () => {
    // DialogTokens.ContainerShape = ShapeKeyTokens.CornerExtraLarge (28dp).
    expect(source).toContain('border-radius: 28px')
    // DialogTokens.ContainerColor = SurfaceContainerHigh.
    expect(source).toContain('background: rgb(var(--v-theme-surface-container-high))')
    // DialogTokens.ContainerElevation = Level3.
    expect(source).toContain('box-shadow: 0 1px 3px 0 rgba(0, 0, 0, .3), 0 4px 8px 3px rgba(0, 0, 0, .15)')
    // dialogPadding = 24dp on all sides.
    expect(source).toMatch(/\.migration-progress-dialog \{[^}]*padding: 24px;/s)
    // BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp).
    expect(source).toContain('min-width: 280px')
    expect(source).toContain('max-width: 560px')
    // AlertDialogDefaults.textPadding = bottom 24dp.
    expect(source).toMatch(/\.migration-progress-text \{[^}]*padding-bottom: 24px;/s)
  })

  it('uses the Material3 linear progress indicator metrics', () => {
    // LinearProgressIndicatorTokens.Height = 4dp.
    expect(source).toContain('height: 4px')
    // The canvas is 240dp wide and coerced by the parent to the available width.
    expect(source).toContain('max-width: 240px')
    // ActiveIndicatorColor = Primary, TrackColor = SecondaryContainer.
    expect(source).toContain('background: rgb(var(--v-theme-primary))')
    expect(source).toContain('background: rgb(var(--v-theme-secondary-container))')
    // LinearStrokeCap = Round.
    expect(source).toContain('border-radius: 2px')
    // LinearTrackStopIndicatorSize = 4dp, drawn at the end of the track.
    expect(source).toMatch(/\.migration-progress-stop \{[^}]*width: 4px;/s)
  })

  it('animates the progress with the Material3 spring animation spec', () => {
    // ProgressIndicatorDefaults.ProgressAnimationSpec: no bounce, very low stiffness.
    expect(source).toContain('SPRING_OMEGA')
    expect(source).toContain('visibilityThreshold')
    // The reference composes the indicator only for a non-NaN progress.
    expect(source).toContain('Number.isNaN')
  })

  it('uses the Material3 text button metrics for the Cancel action', () => {
    // ButtonDefaults.MinWidth = 58dp, MinHeight = 40dp, content padding 12dp.
    expect(source).toContain('min-width: 58px')
    expect(source).toContain('height: 40px')
    expect(source).toContain('padding: 0 12px')
    // ButtonSmallTokens.ContainerShapeRound = 20dp full radius.
    expect(source).toContain('border-radius: 20px')
    // labelLarge = 14sp / 20sp, w500, in primary.
    expect(source).toContain('font-size: 14px')
    expect(source).toContain('line-height: 20px')
    expect(source).toContain('font-weight: 500')
    expect(source).toContain('color: rgb(var(--v-theme-primary))')
    // MD3 state layers: hover 8%, pressed 10% of the content colour.
    expect(source).toContain('.migration-progress-button:hover::after { opacity: 0.08; }')
    expect(source).toContain('.migration-progress-button:active::after { opacity: 0.1; }')
  })

  it('stubs the unsupported migration honestly instead of hiding the feature', () => {
    // Suwayomi-Server has no REST contract to migrate entries: honest stub, not a hidden action.
    expect(source).toContain('Migration is not supported in the web version')
    expect(source).toContain('role="alert"')
  })
})
