import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/migration/views/MigrationListView.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/features/migration/views/MigrationListView.vue` with
 * mihon/app/src/main/java/mihon/feature/migration/list/MigrationListScreenContent.kt
 * and MigrationListScreen.kt (revision 446f6df8). The reference is Kotlin, so the invariants
 * are asserted on the ported Material3 metrics.
 */
describe('MigrationListView parity with Mihon', () => {
  it('renders the reference app bar', () => {
    // AppBar: title = "Migration" or "Migration (finished/total)".
    expect(source).toContain('`Migration (${finishedCount.value}/${items.value.length})`')
    expect(source).toContain("'Migration'")
    // The actions are Copy (content_copy / copy_all) and Migrate (check / done_all).
    expect(source).toContain("items.value.length === 1 ? 'content_copy' : 'copy_all'")
    expect(source).toContain("items.value.length === 1 ? 'check' : 'done_all'")
    // Both actions are enabled only when the migration is complete.
    expect(source).toContain(':disabled="!migrationComplete"')
    // TopAppBar without an up button.
    expect(source).not.toContain('migration-toolbar-prepend')
  })

  it('uses the reference list geometry', () => {
    // Row padding: start = padding.medium (16dp), end = padding.small (8dp).
    expect(source).toMatch(/\.migration-row \{[^}]*padding-left: 16px;/s)
    expect(source).toMatch(/\.migration-row \{[^}]*padding-right: 8px;/s)
    // FastScrollLazyColumn contentPadding = contentPadding + topSmallPaddingValues (8dp top).
    expect(source).toMatch(/\.migration-list \{[^}]*padding-top: 8px;/s)
    // The row weights are 1 / 0.2 / 1 / 0.2.
    expect(source).toMatch(/\.migration-slot \{[^}]*flex: 1 1 0;/s)
    expect(source).toMatch(/\.migration-arrow \{[^}]*flex: 0.2 1 0;/s)
    expect(source).toMatch(/\.migration-action \{[^}]*flex: 0.2 1 0;/s)
  })

  it('uses the reference item metrics', () => {
    // MigrationListItem: widthIn(max = 150dp), clip(shapes.small = 8dp), padding 4dp.
    expect(source).toMatch(/\.migration-item \{[^}]*max-width: 150px;/s)
    expect(source).toMatch(/\.migration-item \{[^}]*padding: 4px;/s)
    expect(source).toMatch(/\.migration-item \{[^}]*border-radius: 8px;/s)
    // MangaCover.Book: aspectRatio 2/3, clipped to shapes.extraSmall (4dp).
    expect(source).toMatch(/aspect-ratio: 2 \/ 3;/)
    expect(source).toMatch(/\.migration-cover \{[^}]*border-radius: 4px;/s)
    // The gradient overlay covers the bottom 40% of the cover.
    expect(source).toMatch(/\.migration-shade \{[^}]*height: 40%;/s)
    // The cover title: labelMedium (12sp/16sp, Medium), 8dp padding, 2 lines.
    expect(source).toMatch(/\.migration-cover-title \{[^}]*font-size: 12px;[^}]*line-height: 16px;/s)
    expect(source).toMatch(/\.migration-cover-title \{[^}]*padding: 8px;/s)
    expect(source).toContain('-webkit-line-clamp: 2')
    // Badge: secondary background, onSecondary text, bodySmall (12sp/16sp, Medium), 3dp/1dp padding.
    expect(source).toMatch(/\.migration-badge \{[^}]*padding: 1px 3px;/s)
    expect(source).toMatch(/\.migration-badge \{[^}]*font-size: 12px;[^}]*line-height: 16px;/s)
    expect(source).toContain('background: rgb(var(--v-theme-secondary))')
    expect(source).toContain('color: rgb(var(--v-theme-on-secondary))')
    // The source name is titleSmall (14sp/20sp, Medium) and "Latest: x" is bodyMedium (14sp/20sp).
    expect(source).toMatch(/\.migration-source \{[^}]*font-size: 14px;[^}]*line-height: 20px;[^}]*font-weight: 500;/s)
    expect(source).toMatch(/\.migration-latest \{[^}]*font-size: 14px;[^}]*line-height: 20px;[^}]*font-weight: 400;/s)
  })

  it('renders the reference strings and the result states', () => {
    expect(source).toContain('Latest: Unknown')
    expect(source).toContain('No alternatives found')
    expect(source).toContain('title="Search manually"')
    expect(source).toContain('title="Don\'t migrate"')
    expect(source).toContain('title="Migrate now"')
    expect(source).toContain('title="Copy now"')
    // The dropdown of the reference is offset by DpOffset(8dp, -56dp).
    expect(source).toContain(':offset="[8, -56]"')
    // The migrate dialog is the reference dialog, the exit dialog the reference exit dialog.
    expect(source).toContain('<MigrateMangaDialog')
    expect(source).toContain('<MigrationExitDialog')
    expect(source).toContain('<MigrationProgressDialog')
  })

  it('stubs the unsupported migration honestly instead of hiding the feature', () => {
    // Suwayomi-Server has no REST contract to migrate entries: honest stub, not a hidden action.
    expect(source).toContain('Migration is not supported in the web version')
  })
})
