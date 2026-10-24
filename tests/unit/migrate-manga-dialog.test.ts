import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/migration/components/MigrateMangaDialog.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/features/migration/components/MigrateMangaDialog.vue` with
 * mihon/app/src/main/java/mihon/feature/migration/list/components/MigrationMangaDialog.kt.
 * The reference is Kotlin, so the invariants are asserted on the ported Material3 metrics.
 */
describe('MigrateMangaDialog parity with Mihon', () => {
  it('uses the Material3 alert dialog container metrics', () => {
    // DialogTokens.ContainerShape = ShapeKeyTokens.CornerExtraLarge (28dp).
    expect(source).toContain('border-radius: 28px')
    // DialogTokens.ContainerColor = SurfaceContainerHigh.
    expect(source).toContain('background: rgb(var(--v-theme-surface-container-high))')
    // DialogTokens.ContainerElevation = Level3.
    expect(source).toContain('box-shadow: 0 1px 3px 0 rgba(0, 0, 0, .3), 0 4px 8px 3px rgba(0, 0, 0, .15)')
    // AlertDialogDefaults.dialogPadding = 24dp on all sides.
    expect(source).toMatch(/\.migrate-manga-dialog \{[^}]*padding: 24px;/s)
    // BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp).
    expect(source).toContain('min-width: 280px')
    expect(source).toContain('max-width: 560px')
  })

  it('uses the Material3 title and supporting text typography', () => {
    // Title: DialogTokens.HeadlineFont = headlineSmall (24sp / 32sp) in on-surface, 16dp bottom padding.
    expect(source).toMatch(/font-size: 24px;/)
    expect(source).toMatch(/line-height: 32px;/)
    expect(source).toMatch(/\.migrate-manga-title \{[^}]*padding-bottom: 16px;/s)
    expect(source).toContain('color: rgb(var(--v-theme-on-surface))')
    // Supporting text: DialogTokens.SupportingTextFont = bodyMedium (14sp / 20sp) in on-surface-variant.
    expect(source).toMatch(/\.migrate-manga-text \{[^}]*font-size: 14px;[^}]*line-height: 20px;/s)
    expect(source).toContain('color: rgb(var(--v-theme-on-surface-variant))')
    // AlertDialogDefaults.textPadding = bottom 24dp.
    expect(source).toMatch(/\.migrate-manga-content \{[^}]*padding-bottom: 24px;/s)
  })

  it('renders the reference strings of the Mihon dialog', () => {
    // MR.plurals.migrationListScreen_migrateDialog_migrateTitle / _copyTitle and _skipText.
    expect(source).toContain("'Migrate'")
    expect(source).toContain("'Copy'")
    expect(source).toContain("'An entry was skipped'")
    expect(source).toContain("`${count} entries were skipped`")
    expect(source).toContain("'entry'")
    expect(source).toContain("'entries'")
    // MR.strings.cancelLabel.
    expect(source).toContain('>Cancel</button>')
    // The dismiss button sits left of the confirm button: the reference composes the confirm
    // button first and AlertDialogFlowRow flips the layout direction, so the confirm button
    // renders rightmost (row-reverse + confirm first in the DOM).
    expect(source).toMatch(/flex-direction: row-reverse/)
    expect(source).toMatch(/@click="confirm">\{\{ confirmLabel \}\}<\/button>\s*<button[^>]*@click="open = false">Cancel<\/button>/)
  })

  it('styles the action labels as Material3 text buttons', () => {
    // TextButton: height 40dp, min width 58dp, content padding 12dp, shape = CornerFull (20dp).
    expect(source).toMatch(/min-width: 58px;/)
    expect(source).toMatch(/height: 40px;/)
    expect(source).toMatch(/padding: 0 12px;/)
    expect(source).toMatch(/border-radius: 20px;/)
    // labelLarge (14sp / 20sp, w500) in the primary colour (DialogTokens.ActionLabelTextColor).
    expect(source).toMatch(/font-size: 14px;/)
    expect(source).toMatch(/line-height: 20px;/)
    expect(source).toMatch(/font-weight: 500;/)
    expect(source).toContain('color: rgb(var(--v-theme-primary))')
    // State layer: 8% on hover, 10% while pressed.
    expect(source).toMatch(/\.migrate-manga-button:hover \{[^}]*8%/s)
    expect(source).toMatch(/\.migrate-manga-button:active \{[^}]*10%/s)
  })

  it('stubs the unsupported migration honestly instead of hiding the feature', () => {
    // Suwayomi-Server has no REST contract to migrate entries: honest stub, not a hidden action.
    expect(source).toContain('Migration is not supported in the web version')
    expect(source).toContain('role="alert"')
  })
})
