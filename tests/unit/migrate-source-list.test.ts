import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/migration/components/MigrateSourceList.vue', 'utf8')
const browseView = readFileSync('src/features/browse/views/BrowseView.vue', 'utf8')

/**
 * Verification of `src/features/migration/components/MigrateSourceList.vue` against Mihon:
 * - `eu/kanade/presentation/browse/MigrateSourceScreen.kt`
 * - `eu/kanade/tachiyomi/ui/browse/migration/sources/MigrateSourceTab.kt`
 * - `eu/kanade/tachiyomi/ui/browse/migration/sources/MigrateSourceViewModel.kt`
 * - `eu/kanade/domain/source/interactor/GetSourcesWithFavoriteCount.kt`
 * - `eu/kanade/presentation/browse/components/BaseBrowseItem.kt`
 * - `eu/kanade/presentation/browse/components/BaseSourceItem.kt`
 * - `eu/kanade/presentation/browse/components/BrowseIcons.kt`
 * - `tachiyomi/presentation/core/components/Badges.kt`
 */
describe('MigrateSourceList parity with Mihon reference', () => {
  it('renders LoadingScreen with Md3CircularProgress while loading', () => {
    // state.isLoading -> LoadingScreen(Modifier.padding(contentPadding))
    expect(source).toContain('v-if="loading"')
    expect(source).toContain('<Md3CircularProgress label="Loading sources" />')
    expect(source).toMatch(/\.migrate-loading \{[^}]*display: flex;[^}]*align-items: center;[^}]*justify-content: center;/s)
  })

  it('renders EmptyScreen with "Your library is empty" when empty', () => {
    // state.isEmpty -> EmptyScreen(stringRes = MR.strings.information_empty_library)
    expect(source).toContain('v-else-if="isEmpty"')
    expect(source).toContain('<MihonEmptyScreen')
    expect(source).toContain('message="Your library is empty"')
  })

  it('contains sticky header with prompt text and sorting icon buttons', () => {
    // stickyHeader(key = STICKY_HEADER_KEY_PREFIX)
    expect(source).toMatch(/\.migrate-header \{[^}]*position: sticky;[^}]*top: 0;[^}]*background: rgb\(var\(--v-theme-background\)\);/s)
    expect(source).toMatch(/\.migrate-header \{[^}]*padding-inline-start: 16px;/s)
    // Typography.header = bodyMedium (14/20) + onSurfaceVariant + FontWeight.SemiBold (600)
    expect(source).toMatch(/\.migrate-header-title \{[^}]*font-size: 14px;[^}]*line-height: 20px;[^}]*font-weight: 600;/s)
    expect(source).toMatch(/\.migrate-header-title \{[^}]*color: rgb\(var\(--v-theme-on-surface-variant\)\);/s)
    // IconButton size: 48x48dp, 24dp icons
    expect(source).toMatch(/\.migrate-header-action \{[^}]*width: 48px;[^}]*height: 48px;/s)
    expect(source).toContain("sortingMode === 'ALPHABETICAL' ? 'sort_by_alpha' : 'numbers'")
    expect(source).toContain("sortingDirection === 'ASCENDING' ? 'arrow_upward' : 'arrow_downward'")
  })

  it('implements BaseBrowseItem and BaseSourceItem row metrics', () => {
    // BaseBrowseItem: padding horizontal 16dp / vertical 8dp, min-height 64dp (48dp icon + 8 + 8)
    expect(source).toMatch(/\.migrate-item \{[^}]*min-height: 64px;[^}]*padding: 8px 16px;/s)
    expect(source).toContain('role="button"')
    expect(source).toContain('tabindex="0"')
    // Hover / active / focus-visible state layers
    expect(source).toContain('.migrate-item:hover')
    expect(source).toContain('.migrate-item:active')
    expect(source).toContain('.migrate-item:focus-visible')
  })

  it('matches SourceIcon sizing, stub warning icon and fallback', () => {
    // SourceIcon: 48dp slot
    expect(source).toMatch(/\.migrate-item-icon-wrap \{[^}]*width: 48px;[^}]*height: 48px;/s)
    expect(source).toMatch(/\.migrate-item-icon \{[^}]*width: 48px;[^}]*height: 48px;[^}]*object-fit: contain;/s)
    // Stub source: MaterialSymbols.RoundedFilled.Warning in error color
    expect(source).toContain('v-if="item.isStub"')
    expect(source).toContain('migrate-item-icon-stub')
    expect(source).toMatch(/\.migrate-item-icon-stub \{[^}]*color: rgb\(var\(--v-theme-error\)\);/s)
    expect(source).toMatch(/\.migrate-item-icon-stub \{[^}]*'FILL' 1/s)
  })

  it('formats item name and secondary texts matching typography and alpha', () => {
    // Title: bodyMedium (14/20 w400 onSurface), 1 line, ellipsis
    expect(source).toMatch(/\.migrate-item-name \{[^}]*font-size: 14px;[^}]*line-height: 20px;[^}]*text-overflow: ellipsis;/s)
    // Secondary row: gap 8dp (padding.small)
    expect(source).toMatch(/\.migrate-item-meta \{[^}]*display: flex;[^}]*gap: 8px;/s)
    // Language: bodySmall (12/16), secondaryItemAlpha (0.78)
    expect(source).toMatch(/\.migrate-item-lang \{[^}]*font-size: 12px;[^}]*line-height: 16px;[^}]*opacity: 0.78;/s)
    // Stub: "Not installed", bodySmall, error color, secondaryItemAlpha (0.78)
    expect(source).toMatch(/\.migrate-item-stub \{[^}]*color: rgb\(var\(--v-theme-error\)\);[^}]*opacity: 0.78;/s)
  })

  it('implements BadgeGroup and Badge with extraSmall clip and secondary colors', () => {
    // BadgeGroup: extraSmall shape (4px)
    expect(source).toMatch(/\.migrate-badge-group \{[^}]*border-radius: 4px;[^}]*overflow: hidden;/s)
    // Badge: secondary container, onSecondary text, padding 3dp x 1dp, bodySmall 12/16 w500
    expect(source).toMatch(/\.migrate-badge \{[^}]*background: rgb\(var\(--v-theme-secondary\)\);[^}]*color: rgb\(var\(--v-theme-on-secondary\)\);/s)
    expect(source).toMatch(/\.migrate-badge \{[^}]*padding: 1px 3px;[^}]*font-size: 12px;[^}]*line-height: 16px;[^}]*font-weight: 500;/s)
  })

  it('handles touch-slop and long press clipboard copy with feedback', () => {
    expect(source).toContain('TOUCH_SLOP_PX = 8')
    expect(source).toContain('pressStart')
    expect(source).toContain('pressMove')
    expect(source).toContain('pressEnd')
    expect(source).toContain('navigator.clipboard?.writeText')
    expect(source).toContain('Copied to clipboard:')
  })

  it('includes Modifier.animateItem transitions for row reordering', () => {
    expect(source).toContain('<TransitionGroup tag="div" name="migrate-item"')
    expect(source).toContain('.migrate-item-enter-active')
    expect(source).toContain('.migrate-item-move')
  })

  it('provides Migration guide action in BrowseView tab', () => {
    // MigrateSourceTab.kt: AppBar.Action(stringResource(MR.strings.migration_help_guide), Help)
    expect(browseView).toContain('openMigrationGuide')
    expect(browseView).toContain('https://mihon.app/docs/guides/source-migration')
    expect(browseView).toContain('title="Source migration guide"')
    expect(browseView).toContain('class="browse-pane migrate-pane"')
  })

  it('uses ScrollbarLazyColumn styling for the migrate pane in BrowseView', () => {
    expect(browseView).toContain('.migrate-pane')
    expect(browseView).toMatch(/\.migrate-pane \{[^}]*overflow-y: auto;/s)
    expect(browseView).toMatch(/\.migrate-pane \{[^}]*scrollbar-width: thin;/s)
  })
})
