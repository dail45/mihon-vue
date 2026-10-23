import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/LibraryToolbar.vue', 'utf8')

describe('LibraryToolbar matches the Mihon reference (LibraryToolbar.kt & AppBar.kt)', () => {
  it('implements regular and selection modes based on selectedCount', () => {
    // Reference: selectedCount > 0 -> LibrarySelectionToolbar(...) else -> LibraryRegularToolbar(...)
    expect(source).toContain('selectedCount > 0')
    expect(source).toContain('library-toolbar--selection')
  })

  it('elevates container to surface-container-high in selection mode', () => {
    // Reference AppBar.kt: containerColor = surfaceColorAtElevation(if (isActionMode) 3.dp else 0.dp)
    expect(source).toContain("selectedCount > 0 ? 'surface-container-high' : 'surface'")
  })

  it('uses M3 titleLarge typography for title and selection count', () => {
    // Material 3 titleLarge: 22sp / 28sp w400
    expect(source).toMatch(/\.library-toolbar-title-text \{[^}]*font-size:\s*22px;/s)
    expect(source).toMatch(/\.library-toolbar-title-text \{[^}]*line-height:\s*28px;/s)
    expect(source).toMatch(/\.library-toolbar-title-text \{[^}]*font-weight:\s*400;/s)

    expect(source).toMatch(/\.library-toolbar-selection-count \{[^}]*font-size:\s*22px;/s)
    expect(source).toMatch(/\.library-toolbar-selection-count \{[^}]*line-height:\s*28px;/s)
  })

  it('implements Pill with shapes.extraLarge (28dp) and exact paddings', () => {
    // Pill.kt: shape = shapes.extraLarge (28dp), padding(start = 4.dp), padding(6.dp, 1.dp), 14sp
    expect(source).toMatch(/\.library-toolbar-pill \{[^}]*border-radius:\s*28px;/s)
    expect(source).toMatch(/\.library-toolbar-pill \{[^}]*padding:\s*1px 6px;/s)
    expect(source).toMatch(/\.library-toolbar-pill \{[^}]*font-size:\s*14px;/s)
    expect(source).toMatch(/\.library-toolbar-pill \{[^}]*margin-inline-start:\s*4px;/s)
    // Dark mode pill alpha 12%, light mode 8%
    expect(source).toContain('12%')
    expect(source).toContain('8%')
  })

  it('uses ColorScheme.active for active filter tint', () => {
    // ColorScheme.active: Color(255, 235, 59) in dark, Color(255, 193, 7) in light
    expect(source).toContain('rgb(255, 235, 59)')
    expect(source).toContain('rgb(255, 193, 7)')
    expect(source).toContain('activeColor')
  })

  it('renders all action items and overflow menu options from MR.strings', () => {
    // Actions: select-all, invert-selection, filter, search, reset, cancel
    expect(source).toContain('icon="select_all"')
    expect(source).toContain('icon="flip_to_back"')
    expect(source).toContain('icon="filter_list"')
    expect(source).toContain('icon="search"')
    expect(source).toContain('icon="more_vert"')

    // Overflow actions: Update library, Update category, Open random entry
    expect(source).toContain('title="Update library"')
    expect(source).toContain('title="Update category"')
    expect(source).toContain('title="Open random entry"')
  })

  it('configures SearchToolbar input with titleMedium 18sp and secondaryItemAlpha', () => {
    // AppBar.kt: titleMedium fontSize 18sp, placeholder secondaryItemAlpha (0.78)
    expect(source).toMatch(/\.toolbar-search-field :deep\(input\) \{[^}]*font-size:\s*18px;/s)
    expect(source).toMatch(/\.toolbar-search-field :deep\(input\) \{[^}]*line-height:\s*24px;/s)
    expect(source).toMatch(/\.toolbar-search-field :deep\(input::placeholder\) \{[^}]*opacity:\s*0\.78;/s)
  })

  it('wraps actions in M3 PlainTooltip anchored above', () => {
    // PlainTooltip: inverseSurface container, inverseOnSurface text, 4dp shape
    expect(source).toContain('library-toolbar__tooltip')
    expect(source).toMatch(/\.library-toolbar__tooltip \{[^}]*background:\s*rgb\(var\(--v-theme-inverse-surface\)\);/s)
    expect(source).toMatch(/\.library-toolbar__tooltip \{[^}]*color:\s*rgb\(var\(--v-theme-inverse-on-surface\)\);/s)
    expect(source).toMatch(/\.library-toolbar__tooltip \{[^}]*border-radius:\s*4px;/s)
  })

  it('uses standard MD3 action button touch targets (48dp)', () => {
    expect(source).toMatch(/\.library-toolbar__action \{[^}]*width:\s*48px !important;/s)
    expect(source).toMatch(/\.library-toolbar__action \{[^}]*height:\s*48px !important;/s)
  })

  it('implements M3 TopAppBarHorizontalPadding (4dp) and exact keyline offsets', () => {
    // Compose TopAppBar: TopAppBarHorizontalPadding = 4.dp
    expect(source).toMatch(/\.library-toolbar :deep\(\.v-toolbar__content\) \{[^}]*padding:\s*0 4px !important;/s)
    // Nav icon present: 4dp container + 48dp button + 4dp margin = 56dp title keyline
    expect(source).toMatch(/\.library-toolbar-title \{[^}]*margin-inline-start:\s*4px !important;/s)
    // No nav icon: 4dp container + 12dp margin = 16dp title keyline (TopAppBarTitleInset = 16.dp)
    expect(source).toMatch(/\.library-toolbar-title--no-nav \{[^}]*margin-inline-start:\s*12px !important;/s)
  })

  it('handles Escape key to cancel selection mode mirroring Android BackHandler', () => {
    // LibraryTab.kt: BackHandler(enabled = state.selectionMode) { viewModel.clearSelection() }
    expect(source).toContain("event.key === 'Escape'")
    expect(source).toContain("emit('cancel-selection')")
    expect(source).toContain("window.addEventListener('keydown', onKeydown)")
    expect(source).toContain("window.removeEventListener('keydown', onKeydown)")
  })
})
