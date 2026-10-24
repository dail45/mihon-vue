import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const collection = readFileSync('src/features/browse/components/MangaCollection.vue', 'utf8')
const card = readFileSync('src/features/browse/components/MangaCard.vue', 'utf8')
const styles = readFileSync('src/styles/main.scss', 'utf8')
const sourceView = readFileSync('src/features/browse/views/SourceView.vue', 'utf8')

/**
 * Pixel-parity guardrails for Mihon's `BrowseSourceCompactGrid.kt`
 * (mihon/app/src/main/java/eu/kanade/presentation/browse/components/BrowseSourceCompactGrid.kt)
 * and the shared `MangaCompactGridItem` it renders
 * (mihon/app/src/main/java/eu/kanade/presentation/library/components/CommonMangaItem.kt):
 *
 *   LazyVerticalGrid(
 *       columns = columns,
 *       contentPadding = contentPadding + PaddingValues(8.dp),
 *       verticalArrangement = Arrangement.spacedBy(GridVerticalSpacer),   // 4.dp
 *       horizontalArrangement = Arrangement.spacedBy(GridHorizontalSpacer), // 4.dp
 *   ) {
 *       if (prepend is Loading) item(span = maxLineSpan) { BrowseSourceLoadingItem() }
 *       items { BrowseSourceCompactGridItem(...) }
 *       if (refresh is Loading || append is Loading) item(span = maxLineSpan) { BrowseSourceLoadingItem() }
 *   }
 */
describe('BrowseSourceCompactGrid parity with the Mihon reference', () => {
  it('renders the trailing full-span loading row of the grid', () => {
    // The loading item is the last child of the grid, after the manga items.
    const grid = collection.slice(collection.indexOf('class="library-grid"'))
    const items = grid.indexOf('v-for="item in items"')
    const loading = grid.indexOf('<BrowseSourceLoadingItem v-if="loading"')
    expect(items).toBeGreaterThan(-1)
    expect(loading).toBeGreaterThan(items)
  })

  it('spans the loading row over the whole grid line (GridItemSpan(maxLineSpan))', () => {
    expect(styles).toMatch(/\.library-grid > \.browse-source-loading-item\s*\{[^}]*grid-column:\s*1 \/ -1/)
  })

  it('keeps the grid content padding of 8dp and the 4dp spacers', () => {
    expect(styles).toMatch(/\.library-grid\s*\{[^}]*gap:\s*4px/)
    expect(styles).toMatch(/\.library-grid\s*\{[^}]*padding:\s*8px/)
  })

  it('always draws the title over the cover in the catalogue grid', () => {
    // `BrowseSourceCompactGridItem` always passes a title, so the overlay is always present.
    expect(card).toContain("const overlayTitle = computed(() => props.display === 'compact' || (props.catalogue && props.display === 'covers'))")
  })

  it('dims the cover of a library entry to BrowseFavoriteCoverAlpha (0.34)', () => {
    expect(card).toContain("'in-library-cover': catalogue && manga.inLibrary")
    expect(styles).toMatch(/\.in-library-cover\s*\{[^}]*opacity:\s*\.34/)
  })

  it('draws only the in-library badge (coverBadgeStart) in the catalogue grid', () => {
    // `BrowseSourceCompactGridItem` passes `coverBadgeStart` only; there is no end badge.
    expect(card).toContain('<MangaBadges :manga="manga" :catalogue="catalogue" side="start" class="grid-badges-start" />')
    expect(card).toContain('<MangaBadges v-if="!catalogue" :manga="manga" :catalogue="catalogue" side="end" class="grid-badges-end" />')
  })

  it('never offers the resume button in the catalogue', () => {
    // `MangaCompactGridItem` gets no `onClickContinueReading` from the browse source grid.
    expect(card).toContain('const showContinue = computed(() => !props.catalogue && prefs.showContinue')
  })

  it('keeps the tile geometry of GridItemSelectable (8dp clip, 4dp inner padding)', () => {
    // `Box.clip(shapes.small).combinedClickable(...).selectedOutline(...).padding(4.dp)`:
    // the outer box is clipped to 8dp and carries the selected outline, the 4dp padding
    // is applied inside it.
    expect(styles).toMatch(/\.manga-tile\s*\{[^}]*border-radius:\s*8px/)
    expect(styles).toMatch(/\.manga-tile\s*\{[^}]*overflow:\s*hidden/)
    expect(styles).toMatch(/\.manga-tile-link\s*\{[^}]*padding:\s*4px/)
  })

  it('keeps the 2/3 book cover ratio and the 4dp cover shape', () => {
    expect(styles).toMatch(/\.manga-grid-cover\s*\{[^}]*aspect-ratio:\s*2 \/ 3/)
    expect(styles).toMatch(/\.manga-grid-cover\s*\{[^}]*border-radius:\s*4px/)
  })

  it('hands the catalogue loading state to the collection instead of the page', () => {
    expect(sourceView).toContain(':loading="catalogue.loading"')
  })
})
