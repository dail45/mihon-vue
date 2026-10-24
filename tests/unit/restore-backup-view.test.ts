import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/settings/views/RestoreBackupView.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/features/settings/views/RestoreBackupView.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/data/RestoreBackupScreen.kt.
 * The reference is Kotlin, so the invariants are asserted on the ported metrics.
 */
describe('RestoreBackupView parity with Mihon', () => {
  it('renders the reference title and the five restore options in order', () => {
    // AppBar(title = stringResource(MR.strings.pref_restore_backup)).
    expect(source).toContain('>Restore backup</h1>')
    // RestoreOptions.options (RestoreOptions.kt:25-51).
    expect(source).toContain("{ key: 'libraryEntries', label: 'Library' }")
    expect(source).toContain("{ key: 'categories', label: 'Categories' }")
    expect(source).toContain("{ key: 'appSettings', label: 'App settings' }")
    expect(source).toContain("{ key: 'extensionStores', label: 'Extension stores' }")
    expect(source).toContain("{ key: 'sourceSettings', label: 'Source settings' }")
    expect(source.indexOf("label: 'Library'")).toBeLessThan(source.indexOf("label: 'Categories'"))
    expect(source.indexOf("label: 'Categories'")).toBeLessThan(source.indexOf("label: 'App settings'"))
    expect(source.indexOf("label: 'App settings'")).toBeLessThan(source.indexOf("label: 'Extension stores'"))
    expect(source.indexOf("label: 'Extension stores'")).toBeLessThan(source.indexOf("label: 'Source settings'"))
  })

  it('keeps the top bar metrics of AppBar.kt', () => {
    // TopAppBar: 64dp tall, surface container color at 0dp elevation.
    expect(source).toMatch(/\.restore-backup-toolbar \{[^}]*height: 64px/)
    expect(source).toMatch(/\.restore-backup-toolbar \{[^}]*background: rgb\(var\(--v-theme-surface\)\)/)
    // TopAppBar title slot uses titleLarge (22sp / 28sp, weight 400).
    expect(source).toMatch(/\.restore-backup-title \{[^}]*font-size: 22px/)
    expect(source).toMatch(/\.restore-backup-title \{[^}]*line-height: 28px/)
    expect(source).toMatch(/\.restore-backup-title \{[^}]*font-weight: 400/)
  })

  it('keeps the SectionCard and LabeledCheckbox metrics of the reference', () => {
    // SectionCard.kt: ElevatedCard, horizontal padding medium (16dp), vertical padding small (8dp),
    // shapes.extraLarge (28dp) and an inner Column padding of medium (16dp).
    expect(source).toMatch(/\.restore-backup-card \{[^}]*margin: 8px 16px/)
    expect(source).toMatch(/\.restore-backup-card \{[^}]*padding: 16px/)
    expect(source).toMatch(/\.restore-backup-card \{[^}]*border-radius: 28px/)
    // LabeledCheckbox.kt: Row(min height 48.dp, spacedBy small = 8.dp, clip shapes.small).
    expect(source).toMatch(/\.restore-backup-option \{[^}]*min-height: 48px/)
    expect(source).toMatch(/\.restore-backup-option \{[^}]*gap: 8px/)
    // Material3 Checkbox: 18dp box, 2dp corner radius, 2dp outline.
    expect(source).toMatch(/\.restore-backup-checkbox-box \{[^}]*width: 18px/)
    expect(source).toMatch(/\.restore-backup-checkbox-box \{[^}]*border-radius: 2px/)
    // Compose default Text style: bodyLarge (16.sp / 24.sp).
    expect(source).toMatch(/\.restore-backup-option-label \{[^}]*font-size: 16px/)
    expect(source).toMatch(/\.restore-backup-option-label \{[^}]*line-height: 24px/)
  })

  it('keeps the action bar of LazyColumnWithAction.kt', () => {
    // HorizontalDivider() then Button(padding 16.dp horizontal / 8.dp vertical, fillMaxWidth).
    expect(source).toMatch(/\.restore-backup-action-inner \{[^}]*padding: 8px 16px/)
    expect(source).toMatch(/\.restore-backup-divider \{[^}]*border-top: 1px solid rgb\(var\(--v-theme-outline-variant\)\)/)
    // Material3 Button: 40.dp height, CornerFull (20.dp) shape, container primary, label labelLarge.
    expect(source).toMatch(/\.restore-backup-button \{[^}]*height: 40px/)
    expect(source).toMatch(/\.restore-backup-button \{[^}]*border-radius: 20px/)
    expect(source).toMatch(/\.restore-backup-button \{[^}]*background: rgb\(var\(--v-theme-primary\)\)/)
    expect(source).toMatch(/\.restore-backup-button \{[^}]*font-size: 14px/)
    // The action label is action_restore and the button is disabled while the file is not validated.
    expect(source).toContain('Restore')
    expect(source).toContain(':disabled="!state.canRestore || !canRestore"')
  })

  it('renders the annotated error message of errorMessageItem()', () => {
    // MR.strings.backup_restore_content_full.
    expect(source).toContain('You may need to install any missing extensions and log in to tracking services afterwards to use them.')
    // MR.strings.backup_restore_missing_sources / backup_restore_missing_trackers.
    expect(source).toContain("'Missing sources:'")
    expect(source).toContain("'Trackers not logged into:'")
    // MR.strings.invalid_backup_file / invalid_backup_file_error.
    expect(source).toContain("'Invalid backup file:'")
    expect(source).toContain("'Full error:'")
    // The list items are prefixed with "- " like the reference joinTo().
    expect(source).toContain('`- ${source}`')
    expect(source).toContain('`- ${tracker}`')
    // SelectionContainer: the message is selectable.
    expect(source).toMatch(/\.restore-backup-error \{[^}]*user-select: text/)
  })

  it('enables the action only when the options allow a restore', () => {
    // RestoreOptions.canRestore() (RestoreOptions.kt:22).
    expect(source).toContain('options.libraryEntries || options.categories || options.appSettings || options.extensionStores || options.sourceSettings')
  })

  it('keeps the MD3 dialog metrics of the reference alert dialog', () => {
    // AlertDialog: CornerExtraLarge (28dp), container surface-container-high, 24dp padding.
    expect(source).toMatch(/\.restore-backup-dialog \{[^}]*border-radius: 28px/)
    expect(source).toMatch(/\.restore-backup-dialog \{[^}]*background: rgb\(var\(--v-theme-surface-container-high\)\)/)
    expect(source).toMatch(/\.restore-backup-dialog \{[^}]*padding: 24px/)
  })
})
