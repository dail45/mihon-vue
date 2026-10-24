import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/library/components/DeleteLibraryMangaDialog.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/features/library/components/DeleteLibraryMangaDialog.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/library/DeleteLibraryMangaDialog.kt.
 * The reference is Kotlin, so the invariants are asserted on the ported Material3 metrics.
 */
describe('DeleteLibraryMangaDialog parity with Mihon', () => {
  it('uses the Material3 alert dialog shape, colour and container padding', () => {
    // AlertDialogDefaults.shape = ShapeKeyTokens.CornerExtraLarge (28dp).
    expect(source).toContain('rounded="28px"')
    // AlertDialogDefaults.containerColor = SurfaceContainerHigh.
    expect(source).toContain('color="surface-container-high"')
    // dialogPadding = 24dp on all sides.
    expect(source).toMatch(/\.delete-library-manga-card \{[^}]*padding: 24px;/s)
    // BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp).
    expect(source).toContain('min-width: min(280px, calc(100% - 48px))')
    expect(source).toContain('max-width: min(560px, calc(100% - 48px))')
    // Compose draws the surface with tonalElevation 0.dp and no shadow elevation.
    expect(source).toMatch(/\.v-dialog > \.v-overlay__content\.delete-library-manga-overlay > \.v-card \{[^}]*box-shadow: none;/s)
  })

  it('uses the Material3 title and supporting text typography', () => {
    // Title: headlineSmall (24sp / 32sp) in on-surface, 16dp bottom padding.
    expect(source).toMatch(/font-size: 24px;/)
    expect(source).toMatch(/line-height: 32px;/)
    expect(source).toMatch(/\.delete-library-manga-title \{[^}]*margin: 0 0 16px;/s)
    expect(source).toContain('color: rgb(var(--v-theme-on-surface))')
    // Supporting text: bodyMedium (14sp / 20sp) in on-surface-variant, 24dp bottom padding.
    expect(source).toMatch(/font-size: 14px;/)
    expect(source).toMatch(/line-height: 20px;/)
    expect(source).toContain('letter-spacing: 0.0178571429em')
    expect(source).toContain('color: rgb(var(--v-theme-on-surface-variant))')
    expect(source).toMatch(/\.delete-library-manga-content \{[^}]*margin: 0 0 24px;/s)
  })

  it('renders the reference strings of the Mihon dialog', () => {
    // MR.strings.action_remove / action_cancel / action_ok / manga_from_library /
    // downloaded_chapters.
    expect(source).toContain('>Remove<')
    expect(source).toContain('>Cancel<')
    expect(source).toContain('>OK<')
    expect(source).toContain('>From library<')
    expect(source).toContain('>Downloaded chapters<')
  })

  it('places the dismiss button left of the confirm button like the flipped flow row', () => {
    // AlertDialogFlowRow flips the layout direction: confirm ("OK") right, dismiss left.
    expect(source).toMatch(/flex-direction: row-reverse;/)
    expect(source).toMatch(/@click="confirm"[\s\S]*?>OK<\/button>\s*<button[^>]*@click="open = false">Cancel<\/button>/)
    // The confirm button is disabled while nothing is checked.
    expect(source).toContain(':disabled="!canConfirm"')
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
    expect(source).toMatch(/\.delete-library-manga-button:hover::after \{ opacity: 0\.08; \}/)
    expect(source).toMatch(/\.delete-library-manga-button:active::after \{ opacity: 0\.1; \}/)
    // Disabled label: OnSurfaceVariant at 38%.
    expect(source).toMatch(/opacity: 0\.38;/)
  })

  it('renders the LabeledCheckbox rows of the reference', () => {
    // LabeledCheckbox: 48dp tall row, 8dp gap, 8dp clipped radius, the row is clickable.
    expect(source).toMatch(/min-height: 48px;/)
    expect(source).toMatch(/gap: 8px;/)
    expect(source).toMatch(/border-radius: 8px;/)
    expect(source).toContain('role="checkbox"')
    // The checkbox itself is not clickable in the reference (onCheckedChange = null).
    // The "Downloaded chapters" row only exists when the selection holds no local manga.
    expect(source).toContain('const showChaptersRow = computed(() => !props.containsLocalManga)')
    expect(source).toContain('v-if="showChaptersRow"')
  })

  it('dismisses before the removal and reports both flags', () => {
    // The reference dismisses the dialog first, then runs the action.
    expect(source).toMatch(/open\.value = false\s+emit\('confirm', deleteManga\.value, deleteChapters\.value\)/)
  })
})
