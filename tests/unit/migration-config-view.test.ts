import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/views/MigrationConfigView.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/views/MigrationConfigView.vue` with
 * mihon/app/src/main/java/mihon/feature/migration/config/MigrationConfigScreen.kt
 * and MigrationConfigScreenSheet.kt. The reference is Kotlin, so the invariants are
 * asserted on the ported metrics.
 */
describe('MigrationConfigView parity with Mihon', () => {
  it('shows the bare loading screen without an app bar while the sources load', () => {
    // `if (state.isLoading) { LoadingScreen(); return }` - no Scaffold and no AppBar.
    expect(source).toContain('v-if="loading"')
    expect(source).toMatch(/migration-config-loading \{[^}]*place-items: center;/s)
    expect(source).toContain('size="40" width="4"')
  })

  it('keeps the app bar without a title and with the four selection actions', () => {
    // `AppBar(title = null, ...)`.
    expect(source).toContain('class="migration-config-toolbar"')
    expect(source).not.toContain('v-app-bar-title')
    // Action "Select all" / Action "Select none".
    expect(source).toContain('icon="select_all"')
    expect(source).toContain('icon="deselect"')
    // OverflowAction "Select enabled sources" / "Select pinned sources".
    expect(source).toContain('title="Select enabled sources"')
    expect(source).toContain('title="Select pinned sources"')
  })

  it('splits the list into the Selected and the Available group', () => {
    // `state.sources.partition { it.isSelected }` with the "Selected" / "Available" headers.
    expect(source).toContain('const selectedSources = computed')
    expect(source).toContain('const availableSources = computed')
    expect(source).toContain("title: 'Selected'")
    expect(source).toContain("title: 'Available'")
    // The header is bodyMedium with a 16dp padding.
    expect(source).toMatch(/\.migration-config-header \{[^}]*padding: 16px;[^}]*font-size: 14px;[^}]*line-height: 20px;/s)
  })

  it('uses the card metrics of SourceItemContainer', () => {
    // ElevatedCard with a 16dp horizontal padding.
    expect(source).toMatch(/\.migration-config-card \{[^}]*margin: 0 16px;/s)
    // RoundedCornerShape(top = 12dp for the first item, bottom = 12dp for the last one).
    expect(source).toContain('.migration-config-card.is-first { border-top-left-radius: 12px;')
    expect(source).toContain('.migration-config-card.is-last { border-bottom-left-radius: 12px;')
    // HorizontalDivider with a 16dp horizontal padding.
    expect(source).toMatch(/\.migration-config-divider \{[^}]*margin: 0 16px;/s)
  })

  it('renders the source row like the reference ListItem', () => {
    // SourceIcon: 40dp with an aspect ratio of 1.
    expect(source).toMatch(/\.migration-config-icon \{[^}]*width: 40px;[^}]*height: 40px;/s)
    // The name is bodyMedium, one line, with an ellipsis.
    expect(source).toMatch(/\.migration-config-name \{[^}]*font-size: 14px;[^}]*line-height: 20px;[^}]*text-overflow: ellipsis;/s)
    // The Pill uses the extraLarge shape and the surfaceContainerHigh color.
    expect(source).toMatch(/\.migration-config-pill \{[^}]*border-radius: 28px;[^}]*surface-container-high/s)
    // The drag handle is only shown when the selected group holds more than one source.
    expect(source).toContain('group.selected && group.items.length > 1')
    expect(source).toContain('>drag_handle</span>')
  })

  it('keeps the extended FAB with the Continue label and the arrow', () => {
    // SmallExtendedFloatingActionButton with `expanded = lazyListState.shouldExpandFAB()`.
    expect(source).toContain('migration-config-fab-text')
    expect(source).toContain('>Continue</span>')
    expect(source).toContain('>arrow_forward</span>')
    expect(source).toContain('function onScroll(')
  })

  it('reproduces the configuration sheet of MigrationConfigScreenSheet', () => {
    // AdaptiveSheet: a dialog on tablets, a bottom sheet on phones, 460dp wide.
    expect(source).toContain('tablet ? VDialog : VBottomSheet')
    expect(source).toContain('max-width="460"')
    // "Data to migrate" uses Typography.header (bodyMedium, semibold, onSurfaceVariant).
    expect(source).toMatch(/\.migration-config-sheet-header \{[^}]*font-weight: 600;[^}]*on-surface-variant/s)
    // The chips of the MigrationFlag entries except REMOVE_DOWNLOAD.
    for (const label of ['Chapters', 'Categories', 'Custom cover', 'Notes']) {
      expect(source).toContain(`label: '${label}'`)
    }
    // The switches of the sheet.
    expect(source).toContain('Delete downloads of current entry after migration')
    expect(source).toContain('Hide entries without a match')
    expect(source).toContain('Hide entries without newer chapters')
    expect(source).toContain('Advanced search mode')
    expect(source).toContain('Match based on chapter number')
    // The warning row uses the active colour for the icon and the error colour for the text.
    expect(source).toContain('These options are slow and dangerous and may lead to restrictions from sources')
    expect(source).toMatch(/\.migration-config-warning-icon \{[^}]*color: #ffc107;/s)
    expect(source).toMatch(/\.migration-config-warning-text \{[^}]*v-theme-error/s)
    // The button closes the sheet and starts the migration.
    expect(source).toContain('class="migration-config-continue"')
    expect(source).toContain('>Continue</button>')
  })

  it('stubs the unsupported migration honestly instead of hiding the feature', () => {
    // Suwayomi-Server has no REST contract that migrates entries: honest stub, not a hidden action.
    expect(source).toContain('Migration is not supported in the web version')
    expect(source).toContain('class="migration-config-dialog"')
  })
})
