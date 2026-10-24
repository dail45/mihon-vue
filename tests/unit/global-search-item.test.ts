import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/browse/components/GlobalSearchItem.vue', 'utf8')

/**
 * Pixel-parity guardrails for Mihon's `GlobalSearchItem`
 * (mihon/app/src/main/java/eu/kanade/presentation/library/components/GlobalSearchItem.kt):
 *
 *   TextButton(modifier = modifier, onClick = onClick) {
 *       Text(
 *           text = stringResource(MR.strings.action_global_search_query, searchQuery),
 *           modifier = Modifier.zIndex(99f),
 *       )
 *   }
 *
 * Every metric therefore comes from the Material 3 `TextButton` defaults of
 * androidx.compose.material3 `Button.kt`.
 */
describe('GlobalSearchItem parity with the Mihon reference', () => {
  it('renders the Mihon label `Search for "%1$s" globally`', () => {
    expect(source).toContain('Search for "${props.searchQuery}" globally')
  })

  it('keeps the MD3 TextButton metrics: 40dp height, 58dp min width, 12dp horizontal padding', () => {
    expect(source).toMatch(/\.global-search-item\.v-btn\s*\{[^}]*height:\s*40px/)
    expect(source).toMatch(/\.global-search-item\.v-btn\s*\{[^}]*min-width:\s*58px/)
    expect(source).toMatch(/\.global-search-item\.v-btn\s*\{[^}]*padding:\s*0 12px/)
  })

  it('uses the fully rounded MD3 container shape (ButtonSmallTokens.ContainerShapeRound)', () => {
    expect(source).toMatch(/\.global-search-item\.v-btn\s*\{[^}]*border-radius:\s*20px/)
  })

  it('uses the labelLarge typography (14sp / 20sp / weight 500 / 0.1sp letter spacing)', () => {
    expect(source).toMatch(/\.global-search-item\.v-btn\s*\{[^}]*font-size:\s*14px/)
    expect(source).toMatch(/\.global-search-item\.v-btn\s*\{[^}]*line-height:\s*20px/)
    expect(source).toMatch(/\.global-search-item\.v-btn\s*\{[^}]*font-weight:\s*500/)
    expect(source).toMatch(/\.global-search-item\.v-btn\s*\{[^}]*letter-spacing:\s*0\.1px/)
  })

  it('keeps the transparent container and the primary content colour', () => {
    expect(source).toContain('variant="text"')
    expect(source).toContain('color="primary"')
  })

  it('draws the label above the state layer (Modifier.zIndex(99f))', () => {
    expect(source).toMatch(/\.global-search-item-label\s*\{[^}]*z-index:\s*99/)
  })

  it('uses the MD3 state layer opacities: hover 8%, focus 10%, pressed 10%', () => {
    expect(source).toMatch(/hover :deep\(\.v-btn__overlay\)\s*\{\s*opacity:\s*0\.08/)
    expect(source).toMatch(/focus-visible :deep\(\.v-btn__overlay\)\s*\{\s*opacity:\s*0\.1/)
    expect(source).toMatch(/:active :deep\(\.v-btn__overlay\)\s*\{\s*opacity:\s*0\.1/)
  })

  it('spans the full row in the list and the pager (Modifier.fillMaxWidth())', () => {
    expect(source).toMatch(/\.global-search-item-root-list\s*\{[^}]*width:\s*100%/)
    expect(source).toMatch(/\.global-search-item-block\s*\{[^}]*width:\s*100%/)
    expect(source).toMatch(/\.global-search-item-block\s*\{[^}]*justify-content:\s*center/)
  })

  it('keeps the content width at the start of the grid row (LazyLibraryGrid, no fillMaxWidth)', () => {
    expect(source).toMatch(/\.global-search-item-root-grid\s*\{[^}]*grid-column:\s*1 \/ -1/)
    expect(source).not.toMatch(/\.global-search-item-root-grid\s*\{[^}]*width:\s*100%/)
  })

  it('opens the global search screen with the current query', () => {
    expect(source).toContain("path: '/browse/global-search'")
    expect(source).toContain('query: { q: props.searchQuery }')
  })

  it('supports onClick callback prop and click emit to match Kotlin signature', () => {
    expect(source).toContain('onClick?: () => void')
    expect(source).toContain("(e: 'click', event: MouseEvent): void")
  })
})
