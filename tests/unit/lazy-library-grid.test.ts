import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const collectionSource = readFileSync('src/features/browse/components/MangaCollection.vue', 'utf8')
const styles = readFileSync('src/styles/main.scss', 'utf8')
const pagerSource = readFileSync('src/features/library/components/LibraryPager.vue', 'utf8')

/**
 * Pixel-parity verification for CHECKLIST item 13:
 * Library — ленивая сетка (LazyLibraryGrid)
 *
 * References:
 * - mihon/app/src/main/java/eu/kanade/presentation/library/components/LazyLibraryGrid.kt
 * - mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/LazyGrid.kt (FastScrollLazyVerticalGrid)
 * - mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/VerticalFastScroller.kt (VerticalGridFastScroller)
 */
describe('LazyLibraryGrid pixel-parity with Mihon reference', () => {
  describe('Grid layout geometry and cell calculations (LazyLibraryGrid.kt)', () => {
    it('uses Adaptive(128dp) when column preference is 0 (GridCells.Adaptive(128.dp))', () => {
      // LazyLibraryGrid.kt: columns = if (columns == 0) GridCells.Adaptive(128.dp) else GridCells.Fixed(columns)
      expect(styles).toMatch(/\.library-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(100%,\s*128px\),\s*1fr\)\)/)
    })

    it('uses Fixed(columns) when columns preference > 0 (GridCells.Fixed(columns))', () => {
      expect(collectionSource).toContain('repeat(${columns.value}, minmax(0, 1fr))')
    })

    it('sets 4dp vertical and horizontal spacing with 8dp content padding (CommonMangaItemDefaults.GridVerticalSpacer/GridHorizontalSpacer)', () => {
      // LazyLibraryGrid.kt: contentPadding + PaddingValues(8.dp), spacedBy(GridVerticalSpacer = 4.dp), spacedBy(GridHorizontalSpacer = 4.dp)
      expect(styles).toMatch(/\.library-grid\s*\{[^}]*gap:\s*4px/)
      expect(styles).toMatch(/\.library-grid\s*\{[^}]*padding:\s*8px/)
    })

    it('sets fillMaxSize with top alignment (align-content: start, box-sizing: border-box, width: 100%)', () => {
      expect(styles).toMatch(/\.library-grid\s*\{[^}]*align-content:\s*start/)
      expect(styles).toMatch(/\.library-grid\s*\{[^}]*box-sizing:\s*border-box/)
      expect(styles).toMatch(/\.library-grid\s*\{[^}]*width:\s*100%/)
    })

    it('supports contentPaddingBottom for Scaffold bottom insets', () => {
      expect(collectionSource).toContain('contentPaddingBottom?: number | string')
      expect(collectionSource).toContain('paddingBottom')
      expect(pagerSource).toContain(':content-padding-bottom="contentPaddingBottom"')
    })
  })

  describe('Global search row integration (globalSearchItem)', () => {
    it('renders globalSearchItem when searchQuery is not empty', () => {
      // LazyLibraryGrid.kt: if (!searchQuery.isNullOrEmpty()) { item(span = { GridItemSpan(maxLineSpan) }) { ... } }
      expect(collectionSource).toContain('showGlobalSearch = computed(() => !props.catalogue && props.searchQuery.length > 0)')
      expect(collectionSource).toContain('<GlobalSearchItem v-if="showGlobalSearch"')
      expect(collectionSource).toContain('variant="grid"')
    })

    it('spans the full width of the grid line (GridItemSpan(maxLineSpan))', () => {
      expect(styles).toMatch(/\.library-grid-loading\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/)
      expect(collectionSource).toContain('library-grid-global-search')
    })

    it('wires click handler for global search (onGlobalSearchClicked)', () => {
      // LazyLibraryGrid.kt: onClick = onGlobalSearchClicked
      expect(collectionSource).toContain("@click=\"emit('global-search')\"")
      expect(pagerSource).toContain("@global-search=\"emit('global-search')\"")
    })
  })

  describe('Fast scroller (FastScrollLazyVerticalGrid -> VerticalGridFastScroller)', () => {
    it('is enabled only in library mode and disabled in catalogue', () => {
      expect(collectionSource).toContain('const fastScrollEnabled = computed(() => !props.catalogue)')
    })

    it('renders 12x48dp pill thumb in primary color (ThumbLength = 48.dp, ThumbThickness = 12.dp, ThumbShape = RoundedCornerShape(6.dp))', () => {
      expect(styles).toMatch(/\.fast-scroll-thumb\s*\{[^}]*width:\s*12px/)
      expect(styles).toMatch(/\.fast-scroll-thumb\s*\{[^}]*height:\s*48px/)
      expect(styles).toMatch(/\.fast-scroll-thumb\s*\{[^}]*border-radius:\s*6px/)
      expect(styles).toMatch(/\.fast-scroll-thumb\s*\{[^}]*background:\s*rgb\(var\(--v-theme-primary\)\)/)
    })

    it('applies touch-action: none and cursor: pointer for mobile and desktop dragging', () => {
      expect(styles).toMatch(/\.fast-scroll-thumb\s*\{[^}]*touch-action:\s*none/)
      expect(styles).toMatch(/\.fast-scroll-thumb\s*\{[^}]*cursor:\s*pointer/)
      expect(styles).toMatch(/\.fast-scroll-thumb\s*\{[^}]*user-select:\s*none/)
    })

    it('fades out thumb after 2s delay with 250ms ease-out transition (ScrollBarVisibilityDuration = 2.seconds, ImmediateFadeOutAnimationSpec = 250ms)', () => {
      expect(collectionSource).toContain('hideTimer = window.setTimeout(() => { if (!dragging) fastScrollVisible.value = false }, 2000)')
      expect(collectionSource).toContain('<Transition name="fast-scroll-fade">')
      expect(styles).toMatch(/\.fast-scroll-fade-leave-active\s*\{[^}]*transition:\s*opacity\s*250ms\s*ease-out/)
    })

    it('uses delta-based drag tracking without jumping (rememberDraggableState { delta -> ... })', () => {
      expect(collectionSource).toContain('const deltaY = moveEvent.clientY - startClientY')
      expect(collectionSource).toContain('startThumbTop + deltaY')
    })

    it('accounts for bottom navigation bar inset in scrollMetrics', () => {
      expect(collectionSource).toContain('--v-layout-bottom')
      expect(collectionSource).toContain('window.innerHeight - bottomNav')
    })
  })
})
