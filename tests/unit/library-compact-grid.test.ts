import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const itemComponent = readFileSync('src/features/library/components/LibraryCompactGridItem.vue', 'utf8')
const collectionComponent = readFileSync('src/features/browse/components/MangaCollection.vue', 'utf8')
const styles = readFileSync('src/styles/main.scss', 'utf8')

/**
 * Pixel-parity verification for CHECKLIST item 2:
 * Library — compact grid
 *
 * References:
 * - mihon/app/src/main/java/eu/kanade/presentation/library/components/LibraryCompactGrid.kt
 * - mihon/app/src/main/java/eu/kanade/presentation/library/components/CommonMangaItem.kt (MangaCompactGridItem)
 * - mihon/app/src/main/java/eu/kanade/presentation/library/components/LazyLibraryGrid.kt
 */
describe('LibraryCompactGrid pixel-parity with Mihon reference', () => {
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
  })

  describe('GridItemSelectable container in LibraryCompactGridItem.vue', () => {
    it('applies shapes.small (8dp) clip and 4dp inner padding', () => {
      // GridItemSelectable: Box.clip(MaterialTheme.shapes.small).padding(4.dp)
      expect(itemComponent).toMatch(/\.compact-tile\s*\{[^}]*border-radius:\s*8px/)
      expect(itemComponent).toMatch(/\.compact-tile\s*\{[^}]*overflow:\s*hidden/)
      expect(itemComponent).toMatch(/\.compact-tile-link\s*\{[^}]*padding:\s*4px/)
      expect(itemComponent).toMatch(/\.compact-tile-link\s*\{[^}]*border-radius:\s*8px/)
    })

    it('prevents user text selection during long press', () => {
      expect(itemComponent).toMatch(/\.compact-tile\s*\{[^}]*user-select:\s*none/)
    })

    it('paints selectedOutline in secondary color with onSecondary content color', () => {
      // GridItemSelectable: selectedOutline(isSelected, colorScheme.secondary) + LocalContentColor provides onSecondary
      expect(itemComponent).toMatch(/\.compact-tile-selected\s*\{[^}]*background:\s*rgb\(var\(--v-theme-secondary\)\)/)
      expect(itemComponent).toMatch(/\.compact-tile-selected\s*\{[^}]*color:\s*rgb\(var\(--v-theme-on-secondary\)\)/)
    })

    it('attaches v-ripple to the selectable link', () => {
      expect(itemComponent).toContain('v-ripple')
    })

    it('handles touch gestures with touch slop to avoid scroll conflicts', () => {
      expect(itemComponent).toContain('@pointerdown="onPointerDown"')
      expect(itemComponent).toContain('@pointermove="onPointerMove"')
      expect(itemComponent).toContain('@pointerup="onPointerUp"')
      expect(itemComponent).toContain('@pointercancel="onPointerUp"')
      expect(itemComponent).toContain('@pointerleave="onPointerUp"')
      expect(itemComponent).toContain('@contextmenu="onContextMenu"')
      expect(itemComponent).toContain('TOUCH_SLOP_PX = 8')
    })

    it('supports Space and Enter keyboard keys for accessibility', () => {
      expect(itemComponent).toContain('@keydown.space="onSpaceKey"')
    })
  })

  describe('MangaGridCover & MangaCover.Book geometry', () => {
    it('sets 2:3 aspect ratio and 4dp corner radius', () => {
      // MangaCover.Book.ratio = 2f / 3f, shape = MaterialTheme.shapes.extraSmall (4dp)
      expect(itemComponent).toMatch(/\.compact-cover\s*\{[^}]*aspect-ratio:\s*2 \/ 3/)
      expect(itemComponent).toMatch(/\.compact-cover\s*\{[^}]*border-radius:\s*4px/)
      expect(itemComponent).toMatch(/\.compact-cover\s*\{[^}]*overflow:\s*hidden/)
    })

    it('uses GRID_SELECTED_COVER_ALPHA = 0.76 for selected cover plate', () => {
      expect(itemComponent).toMatch(/\.compact-cover-selected\s*\{[^}]*opacity:\s*0\.76/)
    })

    it('uses #8888881f for placeholder and cover error fallback', () => {
      expect(itemComponent).toMatch(/\.compact-cover\s*\{[^}]*background:\s*#8888881f/)
      expect(itemComponent).toMatch(/\.compact-cover-fallback\s*\{[^}]*background:\s*#8888881f/)
      expect(itemComponent).toContain('fill="#8888881f"')
    })

    it('positions badgesStart and badgesEnd at 4dp from top and edges', () => {
      // MangaGridCover: BadgeGroup(padding(4.dp).align(TopStart / TopEnd))
      expect(itemComponent).toMatch(/\.compact-badges-start\s*\{[^}]*top:\s*4px;\s*left:\s*4px/)
      expect(itemComponent).toMatch(/\.compact-badges-end\s*\{[^}]*top:\s*4px;\s*right:\s*4px/)
      expect(itemComponent).toMatch(/\.compact-badges-start\s*\{[^}]*pointer-events:\s*none/)
      expect(itemComponent).toMatch(/\.compact-badges-end\s*\{[^}]*pointer-events:\s*none/)
    })
  })

  describe('CoverTextOverlay (title overlay in compact mode)', () => {
    it('renders 33% height gradient overlay with 4dp bottom radius', () => {
      // CoverTextOverlay: fillMaxHeight(0.33f).clip(RoundedCornerShape(bottomStart = 4.dp, bottomEnd = 4.dp))
      expect(itemComponent).toMatch(/\.compact-overlay\s*\{[^}]*height:\s*33%/)
      expect(itemComponent).toMatch(/\.compact-overlay\s*\{[^}]*border-bottom-left-radius:\s*4px/)
      expect(itemComponent).toMatch(/\.compact-overlay\s*\{[^}]*border-bottom-right-radius:\s*4px/)
    })

    it('styles title with 12sp/18sp medium white text with black shadow', () => {
      // GridItemTitle: 12sp / 18sp, MaterialTheme.typography.titleSmall (Medium / 500), White, Shadow blur 4
      expect(itemComponent).toMatch(/\.compact-title\s*\{[^}]*font-size:\s*12px/)
      expect(itemComponent).toMatch(/\.compact-title\s*\{[^}]*line-height:\s*18px/)
      expect(itemComponent).toMatch(/\.compact-title\s*\{[^}]*font-weight:\s*500/)
      expect(itemComponent).toMatch(/\.compact-title\s*\{[^}]*letter-spacing:\s*0\.1px/)
      expect(itemComponent).toMatch(/\.compact-title\s*\{[^}]*color:\s*#fff/)
      expect(itemComponent).toMatch(/\.compact-title\s*\{[^}]*text-shadow:\s*0 0 4px #000/)
      expect(itemComponent).toMatch(/\.compact-title\s*\{[^}]*padding:\s*8px/)
    })

    it('clamps title to 2 lines with ellipsis', () => {
      expect(itemComponent).toMatch(/\.compact-title \.manga-title-text\s*\{[^}]*-webkit-line-clamp:\s*2/)
      expect(itemComponent).toMatch(/\.compact-title \.manga-title-text\s*\{[^}]*overflow:\s*hidden/)
      expect(itemComponent).toMatch(/\.compact-title \.manga-title-text\s*\{[^}]*text-overflow:\s*ellipsis/)
    })

    it('reserves 42px right padding when continue button is shown', () => {
      // 28dp button + 6dp padding + 8dp title padding = 42dp
      expect(itemComponent).toMatch(/\.compact-title\.has-continue\s*\{[^}]*padding-right:\s*42px/)
    })
  })

  describe('ContinueReadingButton', () => {
    it('uses 28dp (small) for compact grid and 32dp (large) for cover-only grid', () => {
      expect(itemComponent).toContain("const continueSize = computed(() => showTitle.value ? 28 : 32)")
      expect(itemComponent).toContain("const continueIcon = computed(() => showTitle.value ? 16 : 20)")
    })

    it('styles button with 8dp radius, primaryContainer 90% alpha, onPrimaryContainer icon', () => {
      expect(itemComponent).toMatch(/\.compact-continue\s*\{[^}]*border-radius:\s*8px/)
      expect(itemComponent).toMatch(/\.compact-continue\s*\{[^}]*background:\s*color-mix\(in srgb,\s*rgb\(var\(--v-theme-primary-container\)\)\s*90%,\s*transparent\)/)
      expect(itemComponent).toMatch(/\.compact-continue\s*\{[^}]*color:\s*rgb\(var\(--v-theme-on-primary-container\)\)/)
    })

    it('places button 6dp inside cover (10px from tile edge)', () => {
      // 4dp tile padding + 6dp continue button padding = 10px
      expect(itemComponent).toMatch(/\.compact-continue\s*\{[^}]*right:\s*10px;\s*bottom:\s*10px/)
    })

    it('stops pointerdown/pointerup to prevent pager swipe interference', () => {
      expect(itemComponent).toContain('@pointerdown.stop')
      expect(itemComponent).toContain('@pointerup.stop')
      expect(itemComponent).toContain('@click.stop')
    })

    it('renders a button when nextUnread is missing and emits no-next-chapter', () => {
      expect(itemComponent).toContain('v-else-if="showContinue"')
      expect(itemComponent).toContain('@click.stop="onContinueClick"')
      expect(itemComponent).toContain("emit('no-next-chapter', props.manga.id)")
    })
  })
})
