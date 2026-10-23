import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/RemoveMangaDialog.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/components/RemoveMangaDialog.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/browse/components/BrowseSourceDialogs.kt
 * (RemoveMangaDialog). The reference is Kotlin, so the invariants are asserted on the ported
 * Material3 metrics.
 */
describe('RemoveMangaDialog parity with Mihon', () => {
  it('uses the Material3 alert dialog shape, colour and container padding', () => {
    // AlertDialogDefaults.shape = ShapeKeyTokens.CornerExtraLarge (28dp).
    expect(source).toContain('rounded="28px"')
    // AlertDialogDefaults.containerColor = SurfaceContainerHigh.
    expect(source).toContain('color="surface-container-high"')
    // dialogPadding = 24dp on all sides.
    expect(source).toMatch(/\.remove-manga-card \{ padding: 24px; \}/)
    // BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp).
    expect(source).toContain('min-width: min(280px, calc(100% - 48px))')
    expect(source).toContain('max-width: min(560px, calc(100% - 48px))')
    // Compose draws the surface with tonalElevation 0.dp and no shadow elevation.
    expect(source).toMatch(/\.v-dialog > \.remove-manga-overlay > \.v-card \{ box-shadow: none; \}/)
  })

  it('uses the Material3 title and supporting text typography', () => {
    // Title: headlineSmall (24sp / 32sp) in on-surface, 16dp bottom padding.
    expect(source).toMatch(/font-size: 24px;/)
    expect(source).toMatch(/line-height: 32px;/)
    expect(source).toMatch(/\.remove-manga-title \{[^}]*margin: 0 0 16px;/s)
    expect(source).toContain('color: rgb(var(--v-theme-on-surface))')
    // Supporting text: bodyMedium (14sp / 20sp) in on-surface-variant, 24dp bottom padding.
    expect(source).toMatch(/font-size: 14px;/)
    expect(source).toMatch(/line-height: 20px;/)
    expect(source).toContain('letter-spacing: 0.0178571429em')
    expect(source).toContain('color: rgb(var(--v-theme-on-surface-variant))')
    expect(source).toMatch(/\.remove-manga-text \{[^}]*margin: 0 0 24px;/s)
  })

  it('renders the reference strings of the Mihon dialog', () => {
    // MR.strings.are_you_sure / MR.strings.remove_manga / action_cancel / action_remove.
    expect(source).toContain('Are you sure?')
    expect(source).toContain('You are about to remove "{{ mangaTitle }}" from your library')
    expect(source).toContain('>Cancel<')
    expect(source).toContain('>Remove<')
    // The dismiss button sits left of the confirm button (AlertDialogFlowRow flips the layout).
    expect(source).toMatch(/@click="open = false">Cancel<\/button>\s*<button[^>]*@click="confirm">Remove<\/button>/)
  })

  it('styles the action labels as Material3 text buttons', () => {
    // TextButton: height 40dp, min width 58dp, content padding 12dp, shape = CornerFull (20dp).
    expect(source).toMatch(/min-width: 58px;/)
    expect(source).toMatch(/height: 40px;/)
    expect(source).toMatch(/padding: 0 12px;/)
    expect(source).toMatch(/border-radius: 20px;/)
    // labelLarge (14sp / 500) in the primary colour (DialogTokens.ActionLabelTextColor).
    expect(source).toContain('letter-spacing: 0.0071428571em')
    expect(source).toContain('color: rgb(var(--v-theme-primary))')
    // State layer: 8% on hover, 10% while pressed.
    expect(source).toMatch(/\.remove-manga-button:hover::after \{ opacity: 0\.08; \}/)
    expect(source).toMatch(/\.remove-manga-button:active::after \{ opacity: 0\.1; \}/)
  })

  it('dismisses before the removal and removes the manga from the library', () => {
    // The reference dismisses the dialog first, then runs the action.
    expect(source).toMatch(/busy\.value = true\s+open\.value = false/)
    // changeMangaFavorite() drops the favourite flag: DELETE /manga/{id}/library.
    expect(source).toContain('removeFromLibrary(manga.id)')
    expect(source).toContain("emit('removed', manga.id)")
  })
})
