import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/settings/views/SettingsDataView.vue', 'utf8')

/**
 * Guards for the parity of `src/features/settings/views/SettingsDataView.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsDataScreen.kt
 * (Mihon 446f6df) and the preference widgets it renders. The reference is Kotlin, so the
 * invariants are asserted on the ported metrics and on the reference strings.
 */
describe('SettingsDataScreen parity with Mihon', () => {
  it('keeps the reference order of the preference groups', () => {
    const order = [
      'Storage location',
      'Used for automatic backups, chapter downloads, and local source.',
      'Backup and restore',
      'Create backup',
      'Restore backup',
      'Automatic backup frequency',
      'You should keep copies of backups in other places as well.',
      'Last automatically backed up: never',
      'Storage usage',
      'Clear chapter cache',
      'Clear chapter cache on app launch',
      'Export',
      'Library List',
    ]
    // The order is asserted on the rendered template, not on the script (the stub texts repeat
    // some of the reference labels).
    const template = source.slice(source.indexOf('<template>'))
    let cursor = -1
    for (const text of order) {
      const index = template.indexOf(text)
      expect(index, `missing reference text: ${text}`).toBeGreaterThan(-1)
      expect(index, `wrong order for: ${text}`).toBeGreaterThan(cursor)
      cursor = index
    }
  })

  it('uses the reference backup interval entries', () => {
    // MR.strings.off / update_6hour / update_12hour / update_24hour / update_48hour / update_weekly.
    for (const label of ['Off', 'Every 6 hours', 'Every 12 hours', 'Daily', 'Every 2 days', 'Weekly']) {
      expect(source).toContain(`title: '${label}'`)
    }
    expect(source).toContain('Automatic backup frequency')
  })

  it('uses the reference widget metrics', () => {
    // PreferenceGroupHeader.kt: bodyMedium, secondary, padding(top 14dp, bottom 8dp, horizontal 16dp).
    expect(source).toMatch(/\.pref-group-header \{[^}]*padding: 14px 16px 8px;/s)
    expect(source).toMatch(/\.pref-group-header \{[^}]*font-size: 14px;/s)
    expect(source).toMatch(/\.pref-group-header \{[^}]*line-height: 20px;/s)
    expect(source).toMatch(/\.pref-group-header \{[^}]*color: rgb\(var\(--v-theme-secondary\)\);/s)
    // BasePreferenceWidget.kt: 56dp minimum height, 16dp padding, title 16sp, subtitle bodySmall @ .78.
    expect(source).toMatch(/\.pref-row \{[^}]*min-height: 56px;/s)
    expect(source).toMatch(/\.pref-row \{[^}]*padding: 16px;/s)
    expect(source).toMatch(/\.pref-title \{[^}]*font-size: 16px;/s)
    expect(source).toMatch(/\.pref-title \{[^}]*line-height: 24px;/s)
    expect(source).toMatch(/\.pref-subtitle \{[^}]*font-size: 12px;/s)
    expect(source).toMatch(/\.pref-subtitle \{[^}]*line-height: 16px;/s)
    expect(source).toMatch(/\.pref-subtitle \{[^}]*78%, transparent\);/s)
    // InfoWidget.kt: 16dp padding, 16dp gap between the icon and the text, alpha .78.
    expect(source).toMatch(/\.pref-info \{[^}]*gap: 16px;/s)
    expect(source).toMatch(/\.pref-info \{[^}]*padding: 16px;/s)
    expect(source).toMatch(/\.pref-info \{[^}]*opacity: \.78;/s)
    // PreferenceScreen.kt: 12dp spacer between the groups.
    expect(source).toMatch(/\.pref-group-spacer \{ height: 12px; \}/)
  })

  it('reproduces the ColumnSelectionDialog semantics', () => {
    // MR.strings.migration_dialog_what_to_include.
    expect(source).toContain('Select data to include')
    // Unchecking Title also unchecks Author and Artist (SettingsDataScreen.kt).
    expect(source).toMatch(/function toggleTitle\(\)/)
    expect(source).toContain('exportOptions.value.includeAuthor = false')
    expect(source).toContain('exportOptions.value.includeArtist = false')
    // Author and Artist are disabled while Title is unchecked.
    expect(source).toContain(':disabled="!exportOptions.includeTitle"')
    // MR.strings.action_cancel / action_save.
    expect(source).toContain('>Cancel</v-btn>')
    expect(source).toContain('>Save</v-btn>')
  })

  it('exports the library list with the reference CSV format', () => {
    // LibraryExporter.generateCsvData: CRLF rows, comma separated columns.
    expect(source).toContain("}).join('\\r\\n')")
    // A column holding \r \n " or , is quoted and the quotes are doubled.
    expect(source).toContain("escapeRequired.some(character => column.includes(character))")
    expect(source).toContain('column.replace(/"/g, \'""\')')
    // ActivityResultContracts.CreateDocument("text/csv") with the name "mihon_library.csv".
    expect(source).toContain("type: 'text/csv'")
    expect(source).toContain("anchor.download = 'mihon_library.csv'")
  })

  it('keeps the app bar help action and its target', () => {
    // SettingsDataScreen.HELP_URL and the AutoMirroredRounded.Help icon.
    expect(source).toContain("const HELP_URL = 'https://mihon.app/docs/faq/storage'")
    expect(source).toContain('icon="help"')
  })

  it('states plainly that the Android-only actions are not supported in the web version', () => {
    expect(source).toContain('Not supported in the web version.')
    for (const reason of ['storage', 'create-backup', 'restore-backup', 'clear-cache']) {
      expect(source).toContain(`'${reason}':`)
    }
  })
})
