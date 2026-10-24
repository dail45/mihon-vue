import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const sourceView = readFileSync('src/features/browse/views/SourceView.vue', 'utf8')

describe('BrowseSourceScreen parity with the Mihon reference', () => {
  it('renders Scaffold top bar with SearchToolbar, display mode, and overflow menu', () => {
    // Scaffold / AppBar 64dp flat surface
    expect(sourceView).toMatch(/<v-app-bar[^>]*height="64"[^>]*color="surface"/)
    expect(sourceView).toContain('icon="arrow_back"')
    expect(sourceView).toContain('aria-label="Navigate up"')
    expect(sourceView).toContain('<v-text-field')
    expect(sourceView).toContain('placeholder="Search…"')
    expect(sourceView).toContain('icon="search"')
    expect(sourceView).toContain('icon="more_vert"')
  })

  it('matches SearchToolbar typography (18sp, font-weight 400)', () => {
    expect(sourceView).toMatch(/\.source-toolbar :deep\(\.toolbar-search input\)\s*\{[^}]*font-size:\s*18px/)
    expect(sourceView).toMatch(/\.source-toolbar :deep\(\.toolbar-search input\)\s*\{[^}]*line-height:\s*24px/)
    expect(sourceView).toMatch(/\.source-toolbar :deep\(\.toolbar-search input\)\s*\{[^}]*font-weight:\s*400/)
  })

  it('provides display mode dropdown with 196dp width and the reference ordering', () => {
    expect(sourceView).toContain('min-width="196"')
    expect(sourceView).toContain('max-width="196"')
    expect(sourceView).toContain("'Comfortable grid'")
    expect(sourceView).toContain("'Compact grid'")
    expect(sourceView).toContain("'List'")
    expect(sourceView).toContain('radio_button_checked')
    expect(sourceView).toContain('radio_button_unchecked')
  })

  it('renders horizontally scrollable FilterChip row with 8dp padding and 8dp spacing', () => {
    expect(sourceView).toMatch(/\.source-listing-bar\s*\{[^}]*display:\s*flex/)
    expect(sourceView).toMatch(/\.source-listing-bar\s*\{[^}]*gap:\s*8px/)
    expect(sourceView).toMatch(/\.source-listing-bar\s*\{[^}]*padding-inline:\s*8px/)
    expect(sourceView).toMatch(/\.source-listing-bar\s*\{[^}]*overflow-x:\s*auto/)
  })

  it('implements Material 3 FilterChip specs (32dp height, 8dp radius, labelLarge 14sp/500)', () => {
    expect(sourceView).toMatch(/\.source-chip\s*\{[^}]*height:\s*32px/)
    expect(sourceView).toMatch(/\.source-chip\s*\{[^}]*border-radius:\s*8px/)
    expect(sourceView).toMatch(/\.source-chip\s*\{[^}]*padding-inline:\s*8px/)
    expect(sourceView).toMatch(/\.source-chip\s*\{[^}]*font-size:\s*14px/)
    expect(sourceView).toMatch(/\.source-chip\s*\{[^}]*font-weight:\s*500/)
    expect(sourceView).toMatch(/\.source-chip\s*\{[^}]*line-height:\s*20px/)
    // Unselected outlineVariant outline and onSurfaceVariant color
    expect(sourceView).toMatch(/\.source-chip\s*\{[^}]*outline-variant/)
    expect(sourceView).toMatch(/\.source-chip\s*\{[^}]*on-surface-variant/)
    // Selected secondaryContainer container and onSecondaryContainer color
    expect(sourceView).toMatch(/\.source-chip--selected\s*\{[^}]*secondary-container/)
    expect(sourceView).toMatch(/\.source-chip--selected\s*\{[^}]*on-secondary-container/)
  })

  it('renders all three chips: Popular, Latest, and Filter', () => {
    expect(sourceView).toContain('>favorite</span>')
    expect(sourceView).toContain('>Popular</span>')
    expect(sourceView).toContain('>verified</span>')
    expect(sourceView).toContain('>Latest</span>')
    expect(sourceView).toContain('>filter_list</span>')
    expect(sourceView).toContain('>Filter</span>')
    expect(sourceView).toContain('v-if="sourceFilters.length > 0"')
    expect(sourceView).toContain('v-if="source.supportsLatest"')
  })

  it('renders HorizontalDivider (1dp outlineVariant) under the chip row', () => {
    expect(sourceView).toContain('class="source-header-divider"')
    expect(sourceView).toMatch(/\.source-header-divider\s*\{[^}]*height:\s*1px/)
    expect(sourceView).toMatch(/\.source-header-divider\s*\{[^}]*outline-variant/)
  })

  it('connects all five reference dialogs', () => {
    // 1. SourceFilterDialog (BrowseSourceViewModel.Dialog.Filter)
    expect(sourceView).toContain('<SourceFilterDialog')
    expect(sourceView).toContain(':filters="sourceFilters"')
    expect(sourceView).toContain(':defaults="defaultFilters"')
    expect(sourceView).toContain('@filter="onFiltersApply"')
    expect(sourceView).toContain('@reset="onFiltersReset"')

    // 2. DuplicateMangaDialog (BrowseSourceViewModel.Dialog.AddDuplicateManga)
    expect(sourceView).toContain('<DuplicateMangaDialog')
    expect(sourceView).toContain('@open-manga="m => router.push(\'/manga/\' + m.id)"')
    expect(sourceView).toContain('@migrate="onMigrateDuplicate"')

    // 3. MigrateMangaDialog (BrowseSourceViewModel.Dialog.Migrate)
    expect(sourceView).toContain('<MigrateMangaDialog')

    // 4. RemoveMangaDialog (BrowseSourceViewModel.Dialog.RemoveManga)
    expect(sourceView).toContain('<RemoveMangaDialog')

    // 5. ChangeCategoryDialog (BrowseSourceViewModel.Dialog.ChangeMangaCategory)
    expect(sourceView).toContain('<ChangeCategoryDialog')
  })

  it('renders EmptyScreen with kaomoji face, bodyMedium message, and reference actions', () => {
    expect(sourceView).toContain('class="mihon-empty"')
    expect(sourceView).toContain('class="mihon-empty-face"')
    expect(sourceView).toContain('class="mihon-empty-message"')
    expect(sourceView).toContain('class="mihon-empty-actions"')
    expect(sourceView).toContain('Local source guide')
    expect(sourceView).toContain('Retry')
    expect(sourceView).toContain('Open in WebView')
    expect(sourceView).toContain('Help')
  })

  it('renders indefinite error snackbar with Retry action', () => {
    expect(sourceView).toContain('<v-snackbar v-model="errorSnackbar" :timeout="-1"')
    expect(sourceView).toContain('Retry')
    expect(sourceView).toContain('@click="retryPage"')
  })
})
