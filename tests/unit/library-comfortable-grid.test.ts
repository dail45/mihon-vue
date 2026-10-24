import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const itemComponent = readFileSync('src/features/library/components/LibraryComfortableGridItem.vue', 'utf8')
const collectionComponent = readFileSync('src/features/browse/components/MangaCollection.vue', 'utf8')
const cardComponent = readFileSync('src/features/browse/components/MangaCard.vue', 'utf8')
const styles = readFileSync('src/styles/main.scss', 'utf8')

/**
 * Pixel-parity verification for CHECKLIST item 3:
 * Library — comfortable grid
 *
 * References:
 * - mihon/app/src/main/java/eu/kanade/presentation/library/components/LibraryComfortableGrid.kt
 * - mihon/app/src/main/java/eu/kanade/presentation/library/components/CommonMangaItem.kt (MangaComfortableGridItem)
 * - mihon/app/src/main/java/eu/kanade/presentation/library/components/LazyLibraryGrid.kt
 * - mihon/app/src/main/java/eu/kanade/presentation/manga/components/MangaCover.kt
 */
describe('LibraryComfortableGrid pixel-parity with Mihon reference', () => {
  describe('LazyLibraryGrid integration in MangaCollection.vue', () => {
    it('uses Adaptive(128dp) when column preference is 0, Fixed(columns) otherwise', () => {
      // LazyLibraryGrid.kt: columns = if (columns == 0) GridCells.Adaptive(128.dp) else GridCells.Fixed(columns)
      expect(styles).toMatch(/\.library-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(100%,\s*128px\),\s*1fr\)\)/)
      expect(collectionComponent).toContain('repeat(${columns.value}, minmax(0, 1fr))')
    })

    it('sets 4dp vertical and horizontal spacing with 8dp content padding', () => {
      // LazyLibraryGrid.kt: contentPadding + PaddingValues(8.dp), spacedBy(GridVerticalSpacer/GridHorizontalSpacer = 4.dp)
      expect(styles).toMatch(/\.library-grid\s*\{[^}]*gap:\s*4px/)
      expect(styles).toMatch(/\.library-grid\s*\{[^}]*padding:\s*8px/)
    })

    it('includes GlobalSearchItem spanning all columns when searchQuery is present', () => {
      // LazyLibraryGrid.kt: span = { GridItemSpan(maxLineSpan) }
      expect(collectionComponent).toContain('<GlobalSearchItem v-if="showGlobalSearch"')
      expect(collectionComponent).toContain('variant="grid"')
    })

    it('includes fast scroller with 12dp width and 48dp thumb', () => {
      // LazyLibraryGrid.kt: FastScrollLazyVerticalGrid
      expect(collectionComponent).toContain('fastScrollVisible')
      expect(styles).toMatch(/\.fast-scroll-thumb\s*\{[^}]*width:\s*12px;\s*height:\s*48px/)
    })

    it('routes comfortable display in library to LibraryComfortableGridItem', () => {
      // LibraryPager.kt: LibraryDisplayMode.ComfortableGrid -> LibraryComfortableGrid
      expect(collectionComponent).toContain("libraryComfortable = computed(() => !props.catalogue && props.display === 'comfortable')")
      expect(collectionComponent).toContain('<LibraryComfortableGridItem')
    })
  })

  describe('GridItemSelectable container in LibraryComfortableGridItem.vue', () => {
    it('applies shapes.small (8dp) clip and 4dp inner padding', () => {
      // GridItemSelectable: Box.clip(MaterialTheme.shapes.small).padding(4.dp)
      expect(itemComponent).toMatch(/\.comfortable-tile\s*\{[^}]*border-radius:\s*8px/)
      expect(itemComponent).toMatch(/\.comfortable-tile\s*\{[^}]*overflow:\s*hidden/)
      expect(itemComponent).toMatch(/\.comfortable-tile-link\s*\{[^}]*padding:\s*4px/)
      expect(itemComponent).toMatch(/\.comfortable-tile-link\s*\{[^}]*border-radius:\s*8px/)
    })

    it('prevents user text selection during long press and touch drag', () => {
      expect(itemComponent).toMatch(/\.comfortable-tile\s*\{[^}]*user-select:\s*none/)
      expect(styles).toMatch(/\.manga-tile\s*\{[^}]*user-select:\s*none/)
    })

    it('paints selectedOutline in secondary color with onSecondary content color', () => {
      // GridItemSelectable: selectedOutline(isSelected, colorScheme.secondary) + LocalContentColor provides onSecondary
      expect(itemComponent).toMatch(/\.comfortable-tile-selected\s*\{[^}]*background:\s*rgb\(var\(--v-theme-secondary\)\)/)
      expect(itemComponent).toMatch(/\.comfortable-tile-selected\s*\{[^}]*color:\s*rgb\(var\(--v-theme-on-secondary\)\)/)
      expect(itemComponent).toMatch(/\.comfortable-tile-selected \.comfortable-title\s*\{[^}]*color:\s*rgb\(var\(--v-theme-on-secondary\)\)/)
    })

    it('attaches v-ripple to the selectable link', () => {
      expect(itemComponent).toContain('v-ripple')
      expect(cardComponent).toContain('v-ripple')
    })

    it('handles touch gestures with touch slop (8px) to avoid scroll conflicts', () => {
      expect(itemComponent).toContain('@pointerdown="onPointerDown"')
      expect(itemComponent).toContain('@pointermove="onPointerMove"')
      expect(itemComponent).toContain('@pointerup="onPointerUp"')
      expect(itemComponent).toContain('@pointercancel="onPointerUp"')
      expect(itemComponent).toContain('@pointerleave="onPointerUp"')
      expect(itemComponent).toContain('@contextmenu="onContextMenu"')
      expect(itemComponent).toContain('TOUCH_SLOP_PX = 8')
      expect(cardComponent).toContain('TOUCH_SLOP_PX = 8')
    })

    it('supports Space and Enter keyboard keys for accessibility', () => {
      expect(itemComponent).toContain('@keydown.space="onSpaceKey"')
      expect(cardComponent).toContain('@keydown.space="onSpaceKey"')
    })
  })

  describe('MangaGridCover & MangaCover.Book geometry', () => {
    it('sets 2:3 aspect ratio and 4dp corner radius', () => {
      // MangaCover.Book.ratio = 2f / 3f, shape = MaterialTheme.shapes.extraSmall (4dp)
      expect(itemComponent).toMatch(/\.comfortable-cover\s*\{[^}]*aspect-ratio:\s*2 \/ 3/)
      expect(itemComponent).toMatch(/\.comfortable-cover\s*\{[^}]*border-radius:\s*4px/)
      expect(itemComponent).toMatch(/\.comfortable-cover\s*\{[^}]*overflow:\s*hidden/)
    })

    it('uses GRID_SELECTED_COVER_ALPHA = 0.76 for selected cover plate', () => {
      expect(itemComponent).toMatch(/\.comfortable-cover-selected\s*\{[^}]*opacity:\s*0\.76/)
    })

    it('uses #8888881f for placeholder and cover error fallback', () => {
      expect(itemComponent).toMatch(/\.comfortable-cover\s*\{[^}]*background:\s*#8888881f/)
      expect(itemComponent).toMatch(/\.comfortable-cover-fallback\s*\{[^}]*background:\s*#8888881f/)
      expect(itemComponent).toContain('fill="#8888881f"')
    })

    it('positions badgesStart and badgesEnd at 4dp from top and edges with pointer-events: none', () => {
      // MangaGridCover: BadgeGroup(padding(4.dp).align(TopStart / TopEnd))
      expect(itemComponent).toMatch(/\.comfortable-badges-start\s*\{[^}]*top:\s*4px;\s*left:\s*4px/)
      expect(itemComponent).toMatch(/\.comfortable-badges-end\s*\{[^}]*top:\s*4px;\s*right:\s*4px/)
      expect(itemComponent).toMatch(/\.comfortable-badges-start\s*\{[^}]*pointer-events:\s*none/)
      expect(itemComponent).toMatch(/\.comfortable-badges-end\s*\{[^}]*pointer-events:\s*none/)
    })
  })

  describe('Title below cover (MangaComfortableGridItem)', () => {
    it('places title below cover with 4dp padding and no cover overlay', () => {
      // MangaComfortableGridItem: Column { MangaGridCover, GridItemTitle(padding(4.dp)) }
      expect(itemComponent).not.toContain('manga-shade')
      expect(itemComponent).not.toContain('compact-overlay')
      expect(itemComponent).toMatch(/\.comfortable-title\s*\{[^}]*padding:\s*4px/)
    })

    it('styles title with 12sp/18sp titleSmall typography (500 medium, 0.1px letter spacing)', () => {
      // GridItemTitle: 12sp / 18sp, titleSmall, minLines = 2, maxLines = 2
      expect(itemComponent).toMatch(/\.comfortable-title\s*\{[^}]*font-size:\s*12px/)
      expect(itemComponent).toMatch(/\.comfortable-title\s*\{[^}]*line-height:\s*18px/)
      expect(itemComponent).toMatch(/\.comfortable-title\s*\{[^}]*font-weight:\s*500/)
      expect(itemComponent).toMatch(/\.comfortable-title\s*\{[^}]*letter-spacing:\s*0\.1px/)
      expect(itemComponent).toMatch(/\.comfortable-title\s*\{[^}]*color:\s*rgb\(var\(--v-theme-on-surface\)\)/)
    })

    it('enforces minLines = 2 (36px min-height) and maxLines = 2 with ellipsis', () => {
      // min-height: 36px (2 lines * 18px line-height) guarantees aligned heights in the grid row
      expect(itemComponent).toMatch(/\.comfortable-title \.manga-title-text\s*\{[^}]*min-height:\s*36px/)
      expect(itemComponent).toMatch(/\.comfortable-title \.manga-title-text\s*\{[^}]*-webkit-line-clamp:\s*2/)
      expect(itemComponent).toMatch(/\.comfortable-title \.manga-title-text\s*\{[^}]*overflow:\s*hidden/)
      expect(itemComponent).toMatch(/\.comfortable-title \.manga-title-text\s*\{[^}]*text-overflow:\s*ellipsis/)
    })
  })

  describe('ContinueReadingButton in comfortable grid', () => {
    it('uses large size (32dp) and large icon (20dp)', () => {
      // MangaComfortableGridItem: ContinueReadingButton(size = ContinueReadingButtonSizeLarge, iconSize = ContinueReadingButtonIconSizeLarge)
      expect(itemComponent).toContain('const continueSize = 32')
      expect(itemComponent).toContain('const continueIcon = 20')
      expect(itemComponent).toMatch(/\.comfortable-continue\s*\{[^}]*border-radius:\s*8px/)
    })

    it('styles button with primaryContainer 90% alpha and onPrimaryContainer color', () => {
      expect(itemComponent).toMatch(/\.comfortable-continue\s*\{[^}]*background:\s*color-mix\(in srgb,\s*rgb\(var\(--v-theme-primary-container\)\)\s*90%,\s*transparent\)/)
      expect(itemComponent).toMatch(/\.comfortable-continue\s*\{[^}]*color:\s*rgb\(var\(--v-theme-on-primary-container\)\)/)
    })

    it('positions button in cover at BottomEnd with 6dp padding inside cover anchor', () => {
      // MangaGridCover content: align(Alignment.BottomEnd).padding(ContinueReadingButtonGridPadding = 6.dp)
      expect(itemComponent).toMatch(/\.comfortable-cover-anchor\s*\{[^}]*top:\s*4px;\s*left:\s*4px;\s*right:\s*4px;\s*aspect-ratio:\s*2 \/ 3/)
      expect(itemComponent).toMatch(/\.comfortable-continue\s*\{[^}]*right:\s*6px;\s*bottom:\s*6px/)
    })

    it('isolates pointerdown/pointerup events to avoid pager swipe interference', () => {
      expect(itemComponent).toContain('@pointerdown.stop')
      expect(itemComponent).toContain('@pointerup.stop')
      expect(itemComponent).toContain('@click.stop')
      expect(cardComponent).toContain('@pointerdown.stop')
      expect(cardComponent).toContain('@pointerup.stop')
      expect(cardComponent).toContain('@click.stop')
    })

    it('renders router-link when continueHref exists and button with no-next-chapter when missing', () => {
      expect(itemComponent).toContain('v-if="continueHref"')
      expect(itemComponent).toContain(':to="continueHref"')
      expect(itemComponent).toContain('v-else')
      expect(itemComponent).toContain('@click.stop="onContinueClick"')
      expect(itemComponent).toContain("emit('no-next-chapter', props.manga.id)")
    })
  })
})
