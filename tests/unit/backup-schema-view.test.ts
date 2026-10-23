import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/views/BackupSchemaView.vue', 'utf8')

/**
 * Guards for pixel parity of `src/views/BackupSchemaView.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/debug/BackupSchemaScreen.kt
 * and related Compose references (AppBar.kt, FastScrollLazyColumn.kt, SelectionContainer).
 */
describe('BackupSchemaView parity with Mihon', () => {
  it('renders the reference title and supports both "Backup schema" and "Backup file schema"', () => {
    // BackupSchemaScreen.TITLE = "Backup file schema", checklist prompt specifies "Backup schema"
    expect(source).toContain("const TITLE = 'Backup schema'")
    expect(source).toContain("const BACKUP_FILE_SCHEMA = 'Backup file schema'")
    expect(source).toContain('displayTitle')
  })

  it('keeps the top bar metrics of AppBar.kt', () => {
    // TopAppBar: 64dp tall, surface container color at 0dp elevation
    expect(source).toMatch(/\.backup-toolbar \{[^}]*height: 64px/)
    expect(source).toMatch(/\.backup-toolbar \{[^}]*background: rgb\(var\(--v-theme-surface\)\)/)
    // TopAppBar title slot uses titleLarge (22sp / 28sp, weight 400)
    expect(source).toMatch(/\.backup-toolbar-title \{[^}]*font-size: 22px/)
    expect(source).toMatch(/\.backup-toolbar-title \{[^}]*line-height: 28px/)
    expect(source).toMatch(/\.backup-toolbar-title \{[^}]*font-weight: 400/)
    expect(source).toMatch(/\.backup-toolbar-title \{[^}]*color: rgb\(var\(--v-theme-on-surface\)\)/)
  })

  it('has Navigate up button with 48x48dp target, 40dp state layer, and arrow_back icon', () => {
    expect(source).toContain("const NAVIGATE_UP_LABEL = 'Navigate up'")
    expect(source).toContain(':aria-label="NAVIGATE_UP_LABEL"')
    expect(source).toContain('icon="arrow_back"')
    expect(source).toMatch(/\.backup-nav-btn[^}]*width: 48px !important/)
    expect(source).toMatch(/\.backup-nav-btn[^}]*height: 48px !important/)
    expect(source).toMatch(/\.backup-nav-btn \.v-btn__overlay[^}]*width: 40px/)
    expect(source).toMatch(/\.backup-nav-btn \.v-btn__overlay[^}]*height: 40px/)
    expect(source).toMatch(/\.backup-nav-btn \.v-btn__overlay[^}]*border-radius: 20px/)
    expect(source).toMatch(/\.backup-nav-btn \.v-btn__content[^}]*font-size: 24px/)
  })

  it('has Copy to clipboard action with 48x48dp target, 40dp state layer, and content_copy icon', () => {
    expect(source).toContain("const COPY_LABEL = 'Copy to clipboard'")
    expect(source).toContain(':aria-label="COPY_LABEL"')
    expect(source).toContain('icon="content_copy"')
    expect(source).toMatch(/\.backup-action-btn[^}]*width: 48px !important/)
    expect(source).toMatch(/\.backup-action-btn[^}]*height: 48px !important/)
    expect(source).toMatch(/\.backup-action-btn \.v-btn__overlay[^}]*width: 40px/)
    expect(source).toMatch(/\.backup-action-btn \.v-btn__overlay[^}]*height: 40px/)
    expect(source).toMatch(/\.backup-action-btn \.v-btn__overlay[^}]*border-radius: 20px/)
    expect(source).toMatch(/\.backup-action-btn \.v-btn__content[^}]*font-size: 24px/)
    expect(source).toContain('navigator.clipboard.writeText(content)')
  })

  it('provides an MD3 PlainTooltip above the copy action button', () => {
    expect(source).toMatch(/\.backup-action-tooltip \{[^}]*bottom: calc\(100% \+ 4px\)/)
    expect(source).toMatch(/\.backup-action-tooltip \{[^}]*background: rgb\(var\(--v-theme-inverse-surface\)\)/)
    expect(source).toMatch(/\.backup-action-tooltip \{[^}]*color: rgb\(var\(--v-theme-inverse-on-surface\)\)/)
    expect(source).toMatch(/\.backup-action-tooltip \{[^}]*border-radius: 4px/)
    expect(source).toMatch(/\.backup-action-tooltip \{[^}]*font-size: 14px/)
  })

  it('renders an MD3 snackbar for copy confirmation with truncateCenter and safe-area inset', () => {
    expect(source).toContain('Copied to clipboard:\\n${truncateCenter(content, 50)}')
    expect(source).toMatch(/\.backup-toast \{[^}]*background: rgb\(var\(--v-theme-inverse-surface\)\)/)
    expect(source).toMatch(/\.backup-toast \{[^}]*color: rgb\(var\(--v-theme-inverse-on-surface\)\)/)
    expect(source).toMatch(/\.backup-toast \{[^}]*border-radius: 4px/)
    expect(source).toMatch(/\.backup-toast \{[^}]*bottom: calc\(24px \+ env\(safe-area-inset-bottom\)\)/)
  })

  it('keeps FastScrollLazyColumn and SelectionContainer metrics with safe-area insets', () => {
    // Scrollable container with safe margins
    expect(source).toMatch(/\.backup-body \{[^}]*padding-bottom: calc\(16px \+ env\(safe-area-inset-bottom\)\)/)
    expect(source).toMatch(/\.backup-body \{[^}]*scrollbar-width: thin/)
    // SelectionContainer: user-select text
    expect(source).toMatch(/\.backup-selection-container \{[^}]*user-select: text/)
    // Monospace code block styling
    expect(source).toMatch(/\.backup-schema-text \{[^}]*font-family: ui-monospace/)
    expect(source).toMatch(/\.backup-schema-text \{[^}]*font-size: 13\.5px/)
    expect(source).toMatch(/\.backup-schema-text \{[^}]*padding: 12px 16px/)
    expect(source).toMatch(/\.backup-schema-text \{[^}]*border-radius: 12px/)
    expect(source).toMatch(/\.backup-schema-text \{[^}]*background: rgb\(var\(--v-theme-surface-container-low\)\)/)
    expect(source).toMatch(/\.backup-schema-text \{[^}]*color: rgb\(var\(--v-theme-on-surface\)\)/)
    expect(source).toMatch(/\.backup-schema-text \{[^}]*white-space: pre/)
    expect(source).toMatch(/\.backup-schema-text \{[^}]*overflow-x: auto/)
  })

  it('defines all Tachiyomi/Mihon backup models in Protobuf generator descriptor', () => {
    expect(source).toContain('defineClass(`${PKG}.Backup`')
    expect(source).toContain('defineClass(`${PKG}.BackupManga`')
    expect(source).toContain('defineClass(`${PKG}.BackupCategory`')
    expect(source).toContain('defineClass(`${PKG}.BackupSource`')
    expect(source).toContain('defineClass(`${PKG}.BackupPreference`')
    expect(source).toContain('defineClass(`${PKG}.BackupSourcePreferences`')
    expect(source).toContain('defineClass(`${PKG}.BackupExtensionStore`')
    expect(source).toContain('defineClass(`${PKG}.BackupChapter`')
    expect(source).toContain('defineClass(`${PKG}.BackupTracking`')
    expect(source).toContain('defineClass(`${PKG}.BackupHistory`')
    expect(source).toContain("TYPES['eu.kanade.tachiyomi.source.model.UpdateStrategy']")
    expect(source).toContain('TYPES[`${PKG}.PreferenceValue`]')
  })
})
