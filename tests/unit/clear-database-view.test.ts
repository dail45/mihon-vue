import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/views/ClearDatabaseView.vue', 'utf8')
const routerSource = readFileSync('src/router/index.ts', 'utf8')
const settingsAdvancedSource = readFileSync('src/views/SettingsAdvancedView.vue', 'utf8')

/**
 * Parity verification of `src/views/ClearDatabaseView.vue` with Mihon reference:
 * - `mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/advanced/ClearDatabaseScreen.kt`
 * - `mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/LazyColumnWithAction.kt`
 * - `mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/material/AlertDialog.kt`
 * - `mihon/presentation-core/src/main/java/tachiyomi/presentation/core/screens/EmptyScreen.kt`
 * - `mihon/presentation-core/src/main/java/tachiyomi/presentation/core/screens/LoadingScreen.kt`
 * - `mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt`
 */
describe('ClearDatabaseView parity with Mihon', () => {
  it('matches all reference string resources from MR.strings', () => {
    // pref_clear_database ("Clear database")
    expect(source).toContain('Clear database')
    // action_bar_up_description ("Navigate up")
    expect(source).toContain('Navigate up')
    // action_select_all ("Select all")
    expect(source).toContain('Select all')
    // action_select_inverse ("Select inverse")
    expect(source).toContain('Select inverse')
    // database_clean ("Nothing to clear")
    expect(source).toContain('Nothing to clear')
    // clear_database_source_item_count ("%1$d non-library entries in database")
    expect(source).toContain('non-library entries in database')
    // action_delete ("Delete")
    expect(source).toContain('Delete')
    // are_you_sure ("Are you sure?")
    expect(source).toContain('Are you sure?')
    // clear_database_text ("You’re about to remove entries from the database")
    expect(source).toContain('about to remove entries from the database')
    // clear_db_exclude_read ("Keep entries with read chapters")
    expect(source).toContain('Keep entries with read chapters')
    // clear_database_history_warning ("Read chapters and progress of non-library entries will be lost")
    expect(source).toContain('Read chapters and progress of non-library entries will be lost')
    // action_cancel ("Cancel") and action_ok ("OK")
    expect(source).toContain('Cancel')
    expect(source).toContain('OK')
    // clear_database_completed ("Entries deleted")
    expect(source).toContain('Entries deleted')
  })

  it('keeps the top bar metrics of AppBar.kt', () => {
    // TopAppBar: 64dp height, surface container, 0dp elevation (box-shadow none).
    expect(source).toMatch(/\.cd-toolbar \{[^}]*height: 64px/)
    expect(source).toMatch(/\.cd-toolbar \{[^}]*background: rgb\(var\(--v-theme-surface\)\)/)
    // Up icon & action buttons: 48x48dp target, 40dp circular state layer.
    expect(source).toMatch(/\.cd-icon-button \{[^}]*width: 48px/)
    expect(source).toMatch(/\.cd-icon-button \{[^}]*height: 48px/)
    expect(source).toMatch(/\.cd-icon-button::before \{[^}]*width: 40px/)
    expect(source).toMatch(/\.cd-icon-button::before \{[^}]*height: 40px/)
    expect(source).toMatch(/\.cd-icon-button::before \{[^}]*border-radius: 20px/)
    // Title slot: titleLarge (22sp / 28sp w400 onSurface).
    expect(source).toMatch(/\.cd-title \{[^}]*font-size: 22px/)
    expect(source).toMatch(/\.cd-title \{[^}]*line-height: 28px/)
    expect(source).toMatch(/\.cd-title \{[^}]*font-weight: 400/)
    // M3 PlainTooltip: inverseSurface container, inverseOnSurface text, 4dp shape (CornerExtraSmall), labelSmall 12/16sp.
    expect(source).toMatch(/\.cd-tooltip \{[^}]*background: rgb\(var\(--v-theme-inverse-surface\)\)/)
    expect(source).toMatch(/\.cd-tooltip \{[^}]*color: rgb\(/)
    expect(source).toMatch(/\.cd-tooltip \{[^}]*border-radius: 4px/)
    expect(source).toMatch(/\.cd-tooltip \{[^}]*font-size: 12px/)
  })

  it('keeps the source item and checkbox metrics of ClearDatabaseItem', () => {
    // Row: min-height 56dp, padding 8x16dp.
    expect(source).toMatch(/\.cd-item \{[^}]*min-height: 56px/)
    expect(source).toMatch(/\.cd-item \{[^}]*padding: 8px 16px/)
    // SourceIcon: 40x40dp.
    expect(source).toMatch(/\.cd-icon-wrap \{[^}]*width: 40px/)
    expect(source).toMatch(/\.cd-icon-wrap \{[^}]*height: 40px/)
    // Title text: bodyLarge (16sp / 24sp w400 onSurface).
    expect(source).toMatch(/\.cd-item-name \{[^}]*font-size: 16px/)
    expect(source).toMatch(/\.cd-item-name \{[^}]*line-height: 24px/)
    expect(source).toMatch(/\.cd-item-name \{[^}]*font-weight: 400/)
    // Subtitle text: bodyMedium (14sp / 20sp w400 onSurfaceVariant).
    expect(source).toMatch(/\.cd-item-count \{[^}]*font-size: 14px/)
    expect(source).toMatch(/\.cd-item-count \{[^}]*line-height: 20px/)
    expect(source).toMatch(/\.cd-item-count \{[^}]*font-weight: 400/)
    // Checkbox M3: 48x48dp target, 18x18dp box with 2dp border radius.
    expect(source).toMatch(/\.cd-checkbox-slot \{[^}]*width: 48px/)
    expect(source).toMatch(/\.cd-checkbox-slot \{[^}]*height: 48px/)
    expect(source).toMatch(/\.cd-checkbox \{[^}]*width: 18px/)
    expect(source).toMatch(/\.cd-checkbox \{[^}]*height: 18px/)
    expect(source).toMatch(/\.cd-checkbox \{[^}]*border-radius: 2px/)
    // Modifier.kt selectedBackground: secondary 22% light / 16% dark.
    expect(source).toMatch(/\.cd-item\.cd-item-selected \{[^}]*rgb\(var\(--v-theme-secondary\)\)\s*22%/)
    expect(source).toMatch(/--mihonDark.*\.cd-item\.cd-item-selected \{[^}]*rgb\(var\(--v-theme-secondary\)\)\s*16%/)
    // State layers: hover 8% / active 12% onSurface.
    expect(source).toMatch(/\.cd-item:hover \{[^}]*rgb\(var\(--v-theme-on-surface\)\)\s*8%/)
    expect(source).toMatch(/\.cd-item:active \{[^}]*rgb\(var\(--v-theme-on-surface\)\)\s*12%/)
  })

  it('keeps the action bar metrics of LazyColumnWithAction.kt', () => {
    // HorizontalDivider() then Button(padding 16dp horizontal / 8dp vertical, fillMaxWidth).
    expect(source).toMatch(/\.cd-action-inner \{[^}]*padding: 8px 16px/)
    expect(source).toMatch(/\.cd-divider \{[^}]*border-top: 1px solid rgb\(var\(--v-theme-outline-variant\)\)/)
    // Material3 Button: 40dp height, CornerFull (20dp) shape, container primary, label labelLarge (14/20sp w500).
    expect(source).toMatch(/\.cd-button \{[^}]*height: 40px/)
    expect(source).toMatch(/\.cd-button \{[^}]*border-radius: 20px/)
    expect(source).toMatch(/\.cd-button \{[^}]*background: rgb\(var\(--v-theme-primary\)\)/)
    expect(source).toMatch(/\.cd-button \{[^}]*font-size: 14px/)
    expect(source).toMatch(/\.cd-button \{[^}]*font-weight: 500/)
    // Disabled state when selection is empty.
    expect(source).toContain(':disabled="!selection.length"')
  })

  it('keeps the MD3 AlertDialog metrics and switch configuration', () => {
    // AlertDialog: CornerExtraLarge (28dp), surfaceContainerHigh, padding 24dp.
    expect(source).toMatch(/\.cd-dialog \{[^}]*background: rgb\(var\(--v-theme-surface-container-high\)\)/)
    expect(source).toMatch(/\.cd-dialog \{[^}]*padding: 24px/)
    expect(source).toMatch(/border-radius: 28px/)
    // Title: headlineSmall (24sp / 32sp w400).
    expect(source).toMatch(/\.cd-dialog-title \{[^}]*font-size: 24px/)
    expect(source).toMatch(/\.cd-dialog-title \{[^}]*line-height: 32px/)
    // Text: bodyMedium (14sp / 20sp w400).
    expect(source).toMatch(/\.cd-dialog-message \{[^}]*font-size: 14px/)
    expect(source).toMatch(/\.cd-dialog-message \{[^}]*line-height: 20px/)
    // Warning: bodySmall (12sp / 16sp w400) in error color.
    expect(source).toMatch(/\.cd-dialog-warning \{[^}]*font-size: 12px/)
    expect(source).toMatch(/\.cd-dialog-warning \{[^}]*color: rgb\(var\(--v-theme-error\)\)/)
    // Switch: 52x32dp track, thumb 16dp unselected / 24dp selected.
    expect(source).toMatch(/\.cd-switch-track \{[^}]*width: 52px/)
    expect(source).toMatch(/\.cd-switch-track \{[^}]*height: 32px/)
    // Buttons: labelLarge (14sp / 20sp w500 primary, 40dp height).
    expect(source).toMatch(/\.cd-dialog-button \{[^}]*height: 40px/)
    expect(source).toMatch(/\.cd-dialog-button \{[^}]*color: rgb\(var\(--v-theme-primary\)\)/)
    expect(source).toMatch(/\.cd-dialog-button \{[^}]*font-weight: 500/)
  })

  it('provides an honest stub dialog explaining web platform limitations', () => {
    expect(source).toContain('stubOpen')
    expect(source).toContain('Deleting non-library entries is not supported in the web version')
    expect(source).toContain('Suwayomi Server REST API v1 provides no endpoint')
  })

  it('is integrated with Vue Router and SettingsAdvancedView navigation', () => {
    expect(routerSource).toContain("path: '/settings/advanced/clear-database'")
    expect(routerSource).toContain("redirect: '/settings/advanced/clear-database'")
    expect(settingsAdvancedSource).toContain("case 'clearDatabase':")
    expect(settingsAdvancedSource).toContain("router.push('/settings/advanced/clear-database')")
  })
})
