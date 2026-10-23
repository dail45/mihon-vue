import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/DeleteChaptersDialog.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/components/DeleteChaptersDialog.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/manga/components/MangaDialogs.kt:35-64
 * (DeleteChaptersDialog). The reference is Kotlin, so the invariants are asserted on the ported
 * Material3 metrics of androidx.compose.material3.AlertDialog.
 */
describe('DeleteChaptersDialog parity with Mihon', () => {
  it('uses the Material3 alert dialog shape, colour and container padding', () => {
    // AlertDialogDefaults.shape = DialogTokens.ContainerShape = ShapeKeyTokens.CornerExtraLarge (28dp).
    expect(source).toContain('rounded="28px"')
    // DialogTokens.ContainerColor = SurfaceContainerHigh.
    expect(source).toContain('color="surface-container-high"')
    // AlertDialogDefaults.dialogPadding = 24dp on all sides.
    expect(source).toMatch(/\.delete-chapters-dialog \{[^}]*padding: 24px;/s)
    // BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp).
    expect(source).toContain('min-width: min(280px, 100%)')
    expect(source).toContain('max-width: min(560px, 100%)')
    // AlertDialogContent draws the Surface with tonalElevation 0.dp and no shadow elevation.
    expect(source).toContain('variant="flat"')
    expect(source).toMatch(/\.delete-chapters-dialog \{[^}]*box-shadow: none;/s)
  })

  it('uses the Material3 title and supporting text typography', () => {
    // Title: DialogTokens.HeadlineFont = HeadlineSmall (24sp / 32sp, w400) in on-surface,
    // AlertDialogDefaults.TitlePadding = 16dp bottom.
    expect(source).toMatch(/font-size: 24px;/)
    expect(source).toMatch(/line-height: 32px;/)
    expect(source).toMatch(/\.delete-chapters-title \{[^}]*margin: 0 0 16px;/s)
    expect(source).toContain('color: rgb(var(--v-theme-on-surface))')
    // Text: DialogTokens.SupportingTextFont = BodyMedium (14sp / 20sp) in on-surface-variant,
    // AlertDialogDefaults.textPadding = 24dp bottom.
    expect(source).toMatch(/font-size: 14px;/)
    expect(source).toMatch(/line-height: 20px;/)
    expect(source).toContain('letter-spacing: 0.0178571429em')
    expect(source).toContain('color: rgb(var(--v-theme-on-surface-variant))')
    expect(source).toMatch(/\.delete-chapters-text \{[^}]*margin: 0 0 24px;/s)
  })

  it('renders the reference strings of the Mihon dialog', () => {
    // MR.strings.are_you_sure / MR.strings.confirm_delete_chapters / action_ok / action_cancel.
    expect(source).toContain('Are you sure?')
    expect(source).toContain('Are you sure you want to delete the selected chapters?')
    expect(source).toContain('>OK<')
    expect(source).toContain('>Cancel<')
  })

  it('puts the confirm button on the right, like the flipped AlertDialogFlowRow', () => {
    // AlertDialogFlowRow flips the layout direction: the confirm button ("OK", declared first
    // in Kotlin) renders rightmost, the dismiss button ("Cancel") leftmost.
    expect(source).toMatch(/\.delete-chapters-actions \{[^}]*flex-direction: row-reverse;/s)
    // The DOM order keeps the confirm button first, matching the Compose composition order.
    expect(source).toMatch(/@click="confirm">OK<\/button>\s*<button[^>]*@click="open = false">Cancel<\/button>/)
    // ButtonsMainAxisSpacing = ButtonsCrossAxisSpacing = 8dp.
    expect(source).toMatch(/\.delete-chapters-actions \{[^}]*gap: 8px;/s)
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
    expect(source).toMatch(/\.delete-chapters-button:hover::after \{ opacity: 0\.08; \}/)
    expect(source).toMatch(/\.delete-chapters-button:active::after \{ opacity: 0\.1; \}/)
  })

  it('dismisses before the deletion and only deletes downloaded, unbookmarked chapters', () => {
    // `TextButton(onClick = { onDismissRequest(); onConfirm() })`: dismiss first, confirm after.
    expect(source).toMatch(/open\.value = false\s+if \(!selected\.length\)/)
    // DownloadManager.getChaptersToDelete skips bookmarked chapters by default, and
    // DownloadManager.deleteChapters only removes the files of downloaded chapters.
    expect(source).toContain('entry.downloaded && !entry.bookmarked')
    // The web client is a headless Suwayomi REST client: DELETE /manga/{id}/chapter/{index}.
    expect(source).toContain('deleteChapterDownload(props.apiUrl, props.mangaId, entry.index)')
  })
})
