import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const sourceView = readFileSync('src/views/SourceView.vue', 'utf8')

describe('BrowseSourceToolbar parity with Mihon reference (item 34)', () => {
  it('implements Material 3 TopAppBar container (64dp height, surface color, flat elevation, 4dp padding)', () => {
    // Scaffold / TopAppBar container
    expect(sourceView).toMatch(/<v-app-bar[^>]*height="64"[^>]*color="surface"/)
    expect(sourceView).toMatch(/\.source-toolbar\s*\{[^}]*box-shadow:\s*none !important/)
    expect(sourceView).toMatch(/\.source-toolbar\s*\{[^}]*background-color:\s*rgb\(var\(--v-theme-surface\)\) !important/)
    expect(sourceView).toMatch(/\.source-toolbar :deep\(\.v-toolbar__content\)\s*\{[^}]*height:\s*64px !important/)
    expect(sourceView).toMatch(/\.source-toolbar :deep\(\.v-toolbar__content\)\s*\{[^}]*padding:\s*0 4px !important/)
  })

  it('implements UpIcon navigation button with 48x48dp target, 40dp circular state layer, and PlainTooltip', () => {
    // UpIcon: arrow_back with PlainTooltip "Navigate up"
    expect(sourceView).toContain('icon="arrow_back"')
    expect(sourceView).toContain('aria-label="Navigate up"')
    expect(sourceView).toContain('<span class="toolbar-tooltip" role="tooltip">Navigate up</span>')

    // M3 IconButton dimensions
    expect(sourceView).toMatch(/\.toolbar-action\s*\{[^}]*width:\s*48px !important/)
    expect(sourceView).toMatch(/\.toolbar-action\s*\{[^}]*height:\s*48px !important/)
    expect(sourceView).toMatch(/\.toolbar-action\s*\{[^}]*border-radius:\s*50% !important/)

    // 40dp circular state layer
    expect(sourceView).toMatch(/\.toolbar-action :deep\(\.v-btn__overlay\)[^{]*\{[^}]*width:\s*40px !important/)
    expect(sourceView).toMatch(/\.toolbar-action :deep\(\.v-btn__overlay\)[^{]*\{[^}]*height:\s*40px !important/)
    expect(sourceView).toMatch(/\.toolbar-action :deep\(\.v-btn__overlay\)[^{]*\{[^}]*border-radius:\s*50% !important/)
  })

  it('implements AppBarTitle with titleLarge (22/28sp w400 onSurface) and 56dp keyline', () => {
    expect(sourceView).toContain('class="source-toolbar__title text-title-large font-weight-regular"')
    expect(sourceView).toMatch(/\.source-toolbar__title\s*\{[^}]*margin-inline-start:\s*4px !important/)
    expect(sourceView).toMatch(/\.source-toolbar__title :deep\(\.v-toolbar-title__placeholder\)\s*\{[^}]*font-size:\s*22px !important/)
    expect(sourceView).toMatch(/\.source-toolbar__title :deep\(\.v-toolbar-title__placeholder\)\s*\{[^}]*line-height:\s*28px !important/)
    expect(sourceView).toMatch(/\.source-toolbar__title :deep\(\.v-toolbar-title__placeholder\)\s*\{[^}]*font-weight:\s*400 !important/)
    expect(sourceView).toMatch(/\.source-toolbar__title :deep\(\.v-toolbar-title__placeholder\)\s*\{[^}]*color:\s*rgb\(var\(--v-theme-on-surface\)\) !important/)
  })

  it('implements SearchToolbar BasicTextField specifications (18/24sp w400, onBackground color, 0.78 opacity placeholder)', () => {
    expect(sourceView).toContain('class="toolbar-search"')
    expect(sourceView).toContain('class="toolbar-search-field"')
    expect(sourceView).toContain('placeholder="Search…"')
    expect(sourceView).toMatch(/\.toolbar-search-field :deep\(input\)[^{]*\{[^}]*font-size:\s*18px !important/)
    expect(sourceView).toMatch(/\.toolbar-search-field :deep\(input\)[^{]*\{[^}]*line-height:\s*24px !important/)
    expect(sourceView).toMatch(/\.toolbar-search-field :deep\(input\)[^{]*\{[^}]*font-weight:\s*400 !important/)
    expect(sourceView).toMatch(/\.toolbar-search-field :deep\(input\)[^{]*\{[^}]*color:\s*rgb\(var\(--v-theme-on-background\)\) !important/)
    expect(sourceView).toMatch(/\.toolbar-search-field :deep\(input\)[^{]*\{[^}]*caret-color:\s*rgb\(var\(--v-theme-on-background\)\) !important/)
    expect(sourceView).toMatch(/\.toolbar-search-field :deep\(input::placeholder\)\s*\{[^}]*opacity:\s*0\.78 !important/)
  })

  it('implements Search and Reset toolbar action buttons with PlainTooltips', () => {
    // Search action
    expect(sourceView).toContain('icon="search"')
    expect(sourceView).toContain('aria-label="Search"')
    expect(sourceView).toContain('<span class="toolbar-tooltip" role="tooltip">Search</span>')

    // Reset action
    expect(sourceView).toContain('icon="close"')
    expect(sourceView).toContain('aria-label="Reset"')
    expect(sourceView).toContain('<span class="toolbar-tooltip" role="tooltip">Reset</span>')
  })

  it('implements Display mode action button and M3 DropdownMenu with RadioMenuItems in reference order', () => {
    // Display mode button & tooltip
    expect(sourceView).toContain('aria-label="Display mode"')
    expect(sourceView).toContain('<span class="toolbar-tooltip" role="tooltip">Display mode</span>')

    // 196dp width and CornerExtraSmall (4dp) shape
    expect(sourceView).toContain('min-width="196"')
    expect(sourceView).toContain('max-width="196"')
    expect(sourceView).toMatch(/\.m3-dropdown-menu\s*\{[^}]*width:\s*196px !important/)
    expect(sourceView).toMatch(/\.m3-dropdown-menu\s*\{[^}]*border-radius:\s*4px !important/)

    // Items and RadioMenuItem state
    expect(sourceView).toContain("'Comfortable grid'")
    expect(sourceView).toContain("'Compact grid'")
    expect(sourceView).toContain("'List'")
    expect(sourceView).toContain('radio_button_checked')
    expect(sourceView).toContain('radio_button_unchecked')

    // Current display icons
    expect(sourceView).toContain("'view_list'")
    expect(sourceView).toContain("'view_module'")
    expect(sourceView).toContain("'view_compact'")
  })

  it('implements More options overflow button and M3 DropdownMenu with reference items', () => {
    // More options button & tooltip
    expect(sourceView).toContain('icon="more_vert"')
    expect(sourceView).toContain('aria-label="More options"')
    expect(sourceView).toContain('<span class="toolbar-tooltip" role="tooltip">More options</span>')

    // Overflow menu items
    expect(sourceView).toContain('title="Help"')
    expect(sourceView).toContain('title="Open in WebView"')
    expect(sourceView).toContain('title="Settings"')
    expect(sourceView).toContain('source?.isConfigurable')
  })

  it('handles navigateUp: active search clears query and returns to normal listing, second press navigates back', () => {
    // Check goBack logic
    expect(sourceView).toContain('if (searchOpen.value || mode.value === \'search\' || draft.value)')
    expect(sourceView).toContain('searchOpen.value = false')
    expect(sourceView).toContain("draft.value = ''")
    expect(sourceView).toContain("void router.replace({ query: { mode: lastListingMode.value } })")
    expect(sourceView).toContain("void router.push('/browse')")

    // Escape key listener for closing search
    expect(sourceView).toContain("event.key === 'Escape'")
    expect(sourceView).toContain("window.addEventListener('keydown', onWindowKeydown)")
    expect(sourceView).toContain("window.removeEventListener('keydown', onWindowKeydown)")
  })

  it('renders HorizontalDivider (1dp outlineVariant) under the toolbar and extension', () => {
    expect(sourceView).toContain('class="source-header-divider"')
    expect(sourceView).toMatch(/\.source-header-divider\s*\{[^}]*height:\s*1px/)
    expect(sourceView).toMatch(/\.source-header-divider\s*\{[^}]*outline-variant/)
  })

  it('implements M3 PlainTooltip styling tokens (inverseSurface, inverseOnSurface, 4dp radius, 12sp/16sp)', () => {
    expect(sourceView).toMatch(/\.toolbar-tooltip\s*\{[^}]*background:\s*rgb\(var\(--v-theme-inverse-surface\)\)/)
    expect(sourceView).toMatch(/\.toolbar-tooltip\s*\{[^}]*color:\s*rgb\(var\(--v-theme-inverse-on-surface\)\)/)
    expect(sourceView).toMatch(/\.toolbar-tooltip\s*\{[^}]*border-radius:\s*4px/)
    expect(sourceView).toMatch(/\.toolbar-tooltip\s*\{[^}]*font-size:\s*12px/)
    expect(sourceView).toMatch(/\.toolbar-tooltip\s*\{[^}]*line-height:\s*16px/)
  })
})
