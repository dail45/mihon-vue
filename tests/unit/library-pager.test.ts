import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/LibraryPager.vue', 'utf8')

/**
 * Pixel-parity guardrails for Mihon's `LibraryPager`
 * (mihon/app/src/main/java/eu/kanade/presentation/library/components/LibraryPager.kt):
 *
 * HorizontalPager(
 *     modifier = Modifier.fillMaxSize(),
 *     state = state,
 *     verticalAlignment = Alignment.Top,
 * ) { page ->
 *     if (page !in ((state.currentPage - 1)..(state.currentPage + 1))) {
 *         return@HorizontalPager
 *     }
 *     val category = getCategoryForPage(page)
 *     val items = getItemsForCategory(category)
 *     if (items.isEmpty()) {
 *         LibraryPagerEmptyScreen(
 *             searchQuery = searchQuery,
 *             hasActiveFilters = hasActiveFilters,
 *             contentPadding = contentPadding,
 *             onGlobalSearchClicked = onGlobalSearchClicked,
 *         )
 *         return@HorizontalPager
 *     }
 *     ...
 * }
 */
describe('LibraryPager parity with Mihon LibraryPager.kt', () => {
  it('implements HorizontalPager page composition with adjacent neighbour constraint', () => {
    expect(source).toContain('renderedPages')
    expect(source).toContain('shouldRender')
    // Composes current page and its direct neighbours
    expect(source).toMatch(/set\.add\(cur\)/)
    expect(source).toMatch(/set\.add\(cur - 1\)/)
    expect(source).toMatch(/set\.add\(cur \+ 1\)/)
  })

  it('renders all page slots in the track to preserve geometric offsets without jumping', () => {
    expect(source).toMatch(/v-for="page in pages"/)
    expect(source).toMatch(/trackOffset = computed\(\(\) => `\${-position\.value \* 100}%`\)/)
  })

  it('implements LibraryPagerEmptyScreen with exact MR.strings mapping', () => {
    // !searchQuery.isNullOrEmpty() -> MR.strings.no_results_found
    expect(source).toContain("'No results found'")
    // hasActiveFilters -> MR.strings.error_no_match
    expect(source).toContain("'No match found'")
    // else -> MR.strings.information_no_manga_category
    expect(source).toContain("'Category is empty'")
  })

  it('renders GlobalSearchItem on empty search with list variant', () => {
    expect(source).toMatch(/<GlobalSearchItem[\s\S]*searchQuery[\s\S]*variant="list"/)
    expect(source).toContain("@click=\"emit('global-search')\"")
  })

  it('styles EmptyScreen face with displayMedium (45sp / 52sp, w400) and secondaryItemAlpha (0.78)', () => {
    expect(source).toMatch(/\.library-pager-empty-face\s*\{[^}]*font-size:\s*45px/)
    expect(source).toMatch(/\.library-pager-empty-face\s*\{[^}]*line-height:\s*52px/)
    expect(source).toMatch(/\.library-pager-empty-face\s*\{[^}]*font-weight:\s*400/)
    expect(source).toMatch(/\.library-pager-empty-face\s*\{[^}]*color:\s*rgb\(var\(--v-theme-on-surface\) \/ 0\.78\)/)
    expect(source).toMatch(/\.library-pager-empty-face\s*\{[^}]*direction:\s*ltr/)
  })

  it('styles EmptyScreen message with bodyMedium (14sp / 20sp, w400, ls 0.25px) and secondaryItemAlpha', () => {
    expect(source).toMatch(/\.library-pager-empty-message\s*\{[^}]*font-size:\s*14px/)
    expect(source).toMatch(/\.library-pager-empty-message\s*\{[^}]*line-height:\s*20px/)
    expect(source).toMatch(/\.library-pager-empty-message\s*\{[^}]*font-weight:\s*400/)
    expect(source).toMatch(/\.library-pager-empty-message\s*\{[^}]*letter-spacing:\s*0\.0178571429em/)
    expect(source).toMatch(/\.library-pager-empty-message\s*\{[^}]*text-align:\s*center/)
    expect(source).toMatch(/\.library-pager-empty-message\s*\{[^}]*margin:\s*24px 0 0/)
    expect(source).toMatch(/\.library-pager-empty-message\s*\{[^}]*color:\s*rgb\(var\(--v-theme-on-surface\) \/ 0\.78\)/)
  })

  it('pads empty screen with 8dp (padding(contentPadding + PaddingValues(8.dp)))', () => {
    expect(source).toMatch(/\.library-pager-empty\s*\{[^}]*padding:\s*8px/)
  })

  it('uses Compose Material standard transition easing and duration', () => {
    expect(source).toMatch(/transition:\s*left 260ms cubic-bezier\(0\.2, 0, 0, 1\)/)
  })

  it('uses Compose snap and fling velocity thresholds', () => {
    expect(source).toMatch(/SNAP_FRACTION = 0\.5/)
    expect(source).toMatch(/FLING_VELOCITY = 0\.4/)
  })
})
