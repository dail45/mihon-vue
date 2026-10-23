import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/HistoryDeleteDialog.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/components/HistoryDeleteDialog.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/history/components/HistoryDialogs.kt:21-60
 * (HistoryDeleteDialog). The reference is Kotlin, so the invariants are asserted on the
 * ported Material3 metrics.
 */
describe('HistoryDeleteDialog parity with Mihon', () => {
  it('uses the Material3 alert dialog shape, colour and container padding', () => {
    // AlertDialogDefaults.shape = DialogTokens.ContainerShape = CornerExtraLarge (28dp).
    expect(source).toContain('rounded="28px"')
    // DialogTokens.ContainerColor = SurfaceContainerHigh.
    expect(source).toContain('color="surface-container-high"')
    // AlertDialogDefaults.dialogPadding = 24dp on all sides.
    expect(source).toMatch(/\.history-delete-card \{[^}]*padding: 24px;/s)
    // BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp).
    expect(source).toContain('min-width: min(280px, calc(100% - 48px))')
    expect(source).toContain('max-width: min(560px, calc(100% - 48px))')
    // Surface with tonalElevation 0.dp and no shadow elevation: the dialog is flat.
    expect(source).toMatch(/\.v-dialog > \.history-delete-overlay > \.v-card\.history-delete-card \{[^}]*box-shadow: none;/s)
  })

  it('renders the reference strings of the Mihon dialog', () => {
    // MR.strings.action_remove, MR.strings.action_cancel.
    expect(source).toContain('>Remove<')
    expect(source).toContain('>Cancel<')
    // MR.strings.dialog_with_checkbox_remove_description.
    expect(source).toContain('This will remove the read date of this chapter. Are you sure?')
    // MR.strings.dialog_with_checkbox_reset.
    expect(source).toContain('Reset all chapters for this entry')
    // The reference dialog has no icon.
    expect(source).not.toContain('v-icon')
  })

  it('uses the Material3 title and supporting text typography', () => {
    // Title: DialogTokens.HeadlineFont = HeadlineSmall (24sp / 32sp, w400) in on-surface.
    expect(source).toMatch(/\.history-delete-title \{[^}]*font-size: 24px;/s)
    expect(source).toMatch(/\.history-delete-title \{[^}]*line-height: 32px;/s)
    expect(source).toMatch(/\.history-delete-title \{[^}]*margin: 0 0 16px;/s)
    expect(source).toContain('color: rgb(var(--v-theme-on-surface))')
    // Supporting text: DialogTokens.SupportingTextFont = BodyMedium (14sp / 20sp) in
    // on-surface-variant, with the 24dp text padding below the text slot.
    expect(source).toMatch(/\.history-delete-text \{[^}]*font-size: 14px;/s)
    expect(source).toMatch(/\.history-delete-text \{[^}]*line-height: 20px;/s)
    expect(source).toContain('letter-spacing: 0.0178571429em')
    expect(source).toContain('color: rgb(var(--v-theme-on-surface-variant))')
    expect(source).toMatch(/\.history-delete-content \{[^}]*padding-bottom: 24px;/s)
  })

  it('renders the LabeledCheckbox row of the reference', () => {
    // LabeledCheckbox: Row(clip(shapes.small = 8dp).fillMaxWidth().heightIn(min = 48.dp)
    // .clickable(role = Checkbox), spacedBy(padding.small = 8dp)).
    expect(source).toMatch(/\.history-delete-checkbox-row \{[^}]*min-height: 48px;/s)
    expect(source).toMatch(/\.history-delete-checkbox-row \{[^}]*border-radius: 8px;/s)
    expect(source).toMatch(/\.history-delete-checkbox-row \{[^}]*gap: 8px;/s)
    expect(source).toContain('role="checkbox"')
    expect(source).toContain(':aria-checked="removeEverything"')
    // The label inherits the text slot typography (bodyMedium) and colour (on-surface-variant).
    expect(source).toMatch(/\.history-delete-checkbox-label \{[^}]*font-size: 14px;/s)
    expect(source).toMatch(/\.history-delete-checkbox-label \{[^}]*line-height: 20px;/s)
    // Legacy Compose checkbox geometry: 20dp box, 2dp radius, 2dp stroke, 24dp footprint.
    expect(source).toMatch(/\.history-delete-checkbox \{[^}]*width: 24px;/s)
    expect(source).toMatch(/\.history-delete-checkbox::before \{[^}]*border: 2px solid/s)
    expect(source).toMatch(/\.history-delete-checkbox::before \{[^}]*border-radius: 2px;/s)
  })

  it('renders the action row as MD3 text buttons in the reference order', () => {
    // AlertDialogFlowRow flips the layout direction, so the confirm button ("Remove", declared
    // first) renders on the RIGHT and the dismiss button ("Cancel") on the LEFT.
    expect(source).toMatch(/\.history-delete-actions \{[^}]*flex-direction: row-reverse;/s)
    expect(source).toMatch(/\.history-delete-actions \{[^}]*gap: 8px;/s)
    expect(source).toMatch(/@click="onConfirm">Remove<\/button>\s*<button[^>]*@click="open = false">Cancel<\/button>/)
    // TextButton: height 40dp, min width 58dp, content padding 12dp / 8dp, shape = CornerFull.
    expect(source).toMatch(/\.history-delete-button \{[^}]*height: 40px;/s)
    expect(source).toMatch(/\.history-delete-button \{[^}]*min-width: 58px;/s)
    expect(source).toMatch(/\.history-delete-button \{[^}]*padding: 8px 12px;/s)
    expect(source).toMatch(/\.history-delete-button \{[^}]*border-radius: 20px;/s)
    expect(source).toMatch(/\.history-delete-button \{[^}]*font-weight: 500;/s)
    expect(source).toContain('letter-spacing: 0.0071428571em')
    expect(source).toContain('color: rgb(var(--v-theme-primary))')
  })

  it('calls the delete action and dismisses in the reference order', () => {
    // `onDelete(removeEverything); onDismissRequest()` (HistoryDialogs.kt:47-49).
    expect(source).toMatch(/async function onConfirm\(\) \{[\s\S]*emit\('delete', all\)\s*open\.value = false/s)
  })

  it('clears the chapter read state through the Suwayomi REST API', () => {
    // Suwayomi derives the history from the chapter read state, so the reference action maps to
    // PATCH /manga/{mangaId}/chapter/{chapterIndex} with read=false.
    expect(source).toContain('api.modifyChapter(props.mangaId, index, { read: false, lastPageRead: 0 })')
    // The checkbox resets every chapter of the manga (Mihon: removeAllFromHistory(mangaId)).
    expect(source).toMatch(/api\.chapters\(props\.mangaId\)/)
    expect(source).toContain('api.modifyChapter(props.mangaId, chapter.index, { read: false, lastPageRead: 0 })')
  })
})
