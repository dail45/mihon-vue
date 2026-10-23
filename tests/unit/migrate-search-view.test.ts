import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/views/MigrateSearchView.vue', 'utf8')

/**
 * Pixel-parity guardrails for Mihon's `MigrateSearchScreen`
 * (mihon/app/src/main/java/eu/kanade/presentation/browse/MigrateSearchScreen.kt,
 *  mihon/app/src/main/java/eu/kanade/tachiyomi/ui/browse/migration/search/MigrateSearchScreen.kt,
 *  mihon/app/src/main/java/eu/kanade/tachiyomi/ui/browse/migration/search/MigrateSearchViewModel.kt,
 *  mihon/app/src/main/java/mihon/feature/migration/dialog/MigrateMangaDialog.kt).
 */
describe('MigrateSearchView parity with Mihon reference', () => {
  it('mounts GlobalSearchToolbar with hide-source-filter and reference bindings', () => {
    expect(source).toContain('<GlobalSearchToolbar')
    expect(source).toContain(':search-query="searchQuery"')
    expect(source).toContain(':progress="progress"')
    expect(source).toContain(':total="total"')
    expect(source).toContain('source-filter="PinnedOnly"')
    expect(source).toContain(':only-show-has-results="onlyShowHasResults"')
    expect(source).toContain('hide-source-filter')
    expect(source).toContain('@navigate-up="goUp"')
    expect(source).toContain('@update:search-query="searchQuery = $event"')
    expect(source).toContain('@search="onSearch"')
    expect(source).toContain('@toggle-results="onToggleResults"')
  })

  it('renders GlobalSearchContent with animateItem, fromSource indicator, and item states', () => {
    // TransitionGroup with Compose animateItem transition
    expect(source).toContain('<TransitionGroup name="msi"')
    expect(source).toContain('.msi-enter-active')
    expect(source).toContain('.msi-leave-active')
    expect(source).toContain('.msi-move')

    // GlobalSearchResultItem: marker "▶ " for the manga source
    expect(source).toContain('<GlobalSearchResultItem')
    expect(source).toContain("isFromSource(entry.source.id) ? `▶ ${entry.source.name}` : entry.source.name")
    expect(source).toContain(':subtitle="languageName(entry.source.lang)"')

    // Result body states: card row on success, loading item, error item
    expect(source).toContain('<GlobalSearchCardRow')
    expect(source).toContain('<GlobalSearchLoadingResultItem')
    expect(source).toContain('<GlobalSearchErrorResultItem')
  })

  it('mirrors MigrateSearchViewModel sorting comparator (results first, then migration order)', () => {
    expect(source).toContain('const sortedEntries = computed(() =>')
    expect(source).toContain("const aEmpty = a.result.status !== 'success' || a.result.items.length === 0")
    expect(source).toContain("const bEmpty = b.result.status !== 'success' || b.result.items.length === 0")
    expect(source).toContain('order.indexOf(a.source.id)')
    expect(source).toContain('order.indexOf(b.source.id)')
  })

  it('mirrors MigrateSearchViewModel getEnabledSources fallback logic', () => {
    expect(source).toContain('const migrationSourceIds = computed(() =>')
    expect(source).toContain('readMigrationSources()')
    expect(source).toContain('pinnedSourceIds()')
    expect(source).toContain('server.sources.map')
  })

  it('mirrors SearchViewModel filteredItems (isVisible with onlyShowHasResults)', () => {
    expect(source).toContain('const visibleEntries = computed(() =>')
    expect(source).toContain('if (!onlyShowHasResults.value) return true')
    expect(source).toContain("return entry.result.status === 'success' && entry.result.items.length > 0")
  })

  it('mirrors Dispatchers.IO.limitedParallelism(5)', () => {
    expect(source).toContain('const parallelism = 5')
  })

  it('mirrors onClickItem and onLongClickItem behavior', () => {
    // onClickItem: if fromList, passes match override back; otherwise opens MigrateMangaDialog
    expect(source).toContain('function onClickItem(manga: Manga)')
    expect(source).toContain("if (route.query.fromList)")
    expect(source).toContain("matchCurrent: String(mangaId.value)")
    expect(source).toContain("matchTarget: String(manga.id)")
    expect(source).toContain("dialogTarget.value = manga")

    // onLongClickItem: opens manga screen
    expect(source).toContain('function onLongClickItem(manga: Manga)')
    expect(source).toContain('router.push(`/manga/${manga.id}`)')
  })

  it('mirrors MigrateMangaDialog Material3 tokens and metrics', () => {
    // Title: headlineSmall (24/32 w400 in onSurface, 16dp bottom padding)
    expect(source).toContain('Select data to include')
    expect(source).toMatch(/\.migrate-dialog-title \{[^}]*font-size: 24px;[^}]*line-height: 32px;/s)
    expect(source).toMatch(/\.migrate-dialog-title \{[^}]*padding-bottom: 16px;/s)

    // Container: surfaceContainerHigh, CornerExtraLarge (28dp), 24dp padding
    expect(source).toMatch(/\.migrate-dialog \{[^}]*border-radius: 28px;/s)
    expect(source).toMatch(/\.migrate-dialog \{[^}]*background: rgb\(var\(--v-theme-surface-container-high\)\);/s)
    expect(source).toMatch(/\.migrate-dialog \{[^}]*padding: 24px;/s)

    // Checkbox: 20x20 in 24dp footprint, 2dp radius, 2dp border, primary when checked
    expect(source).toMatch(/\.migrate-checkbox-wrap \{[^}]*width: 24px;[^}]*height: 24px;/s)
    expect(source).toMatch(/\.migrate-checkbox \{[^}]*width: 20px;[^}]*height: 20px;/s)
    expect(source).toMatch(/\.migrate-checkbox \{[^}]*border-radius: 2px;/s)

    // Buttons: FlowRow spacedBy 4dp, Show entry, Spacer, Copy, Migrate
    expect(source).toContain('>Show entry</button>')
    expect(source).toContain('>Copy</button>')
    expect(source).toContain('>Migrate</button>')
    expect(source).toMatch(/\.migrate-dialog-actions \{[^}]*gap: 4px;/s)
    expect(source).toMatch(/\.migrate-text-button \{[^}]*min-width: 58px;[^}]*height: 40px;/s)
    expect(source).toMatch(/\.migrate-text-button \{[^}]*border-radius: 20px;/s)
    expect(source).toMatch(/\.migrate-text-button \{[^}]*font-size: 14px;[^}]*font-weight: 500;/s)

    // LoadingScreen during migration
    expect(source).toContain('v-progress-circular')
    expect(source).toMatch(/\.migrate-loading \{[^}]*position: fixed;[^}]*inset: 0;/s)
  })

  it('mirrors applicableFlags and migrationFlags persistence', () => {
    expect(source).toContain("const applicableFlags = computed(() =>")
    expect(source).toContain("chapters")
    expect(source).toContain("categories")
    expect(source).toContain("hasNotes.value")
    expect(source).toContain("downloadCount")
    expect(source).toContain("readMigrationFlags")
    expect(source).toContain("writeMigrationFlags")
  })
})
