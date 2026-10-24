import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/browse/views/GlobalSearchView.vue', 'utf8')

/**
 * Pixel-parity guardrails for Mihon's `GlobalSearchScreen`
 * (mihon/app/src/main/java/eu/kanade/presentation/browse/GlobalSearchScreen.kt)
 * and `SearchViewModel` / `GlobalSearchViewModel`
 * (mihon/app/src/main/java/eu/kanade/tachiyomi/ui/browse/source/globalsearch/).
 */
describe('GlobalSearchScreen parity with the Mihon reference', () => {
  it('mounts GlobalSearchToolbar with all reference props and events', () => {
    expect(source).toContain('<GlobalSearchToolbar')
    expect(source).toContain(':search-query="searchQuery"')
    expect(source).toContain(':progress="progress"')
    expect(source).toContain(':total="total"')
    expect(source).toContain(':source-filter="sourceFilter"')
    expect(source).toContain(':only-show-has-results="onlyShowHasResults"')
    expect(source).toContain('@navigate-up="goUp"')
    expect(source).toContain('@update:search-query="searchQuery = $event ?? \'\'"')
    expect(source).toContain('@search="onSearch"')
    expect(source).toContain('@change-source-filter="onChangeFilter"')
    expect(source).toContain('@toggle-results="onToggleResults"')
  })

  it('mirrors SearchViewModel getEnabledSources with enabledLanguages and disabledSources', () => {
    expect(source).toContain("const LANGUAGES_KEY = 'mihon.sourceLanguages'")
    expect(source).toContain("const DISABLED_SOURCES_KEY = 'mihon.disabledSources'")
    expect(source).toContain('function getEnabledSources(): Source[]')
    expect(source).toContain('!disabled.has(source.id)')
  })

  it('mirrors GlobalSearchViewModel source filter (PinnedOnly vs All)', () => {
    expect(source).toContain("type SourceFilter = 'All' | 'PinnedOnly'")
    expect(source).toContain("const sourceFilter = ref<SourceFilter>(extensionSourceId.value ? 'All' : 'PinnedOnly')")
    expect(source).toContain("filter !== 'PinnedOnly' || isSourcePinned(source.id)")
  })

  it('mirrors SearchViewModel.sortComparator (results first, pinned first, name (lang) alphabetical)', () => {
    expect(source).toContain('const sortedEntries = computed(() =>')
    expect(source).toContain('const aEmpty = a.result.status !== \'success\' || a.result.items.length === 0')
    expect(source).toContain('const bEmpty = b.result.status !== \'success\' || b.result.items.length === 0')
    expect(source).toContain('const aPinned = isSourcePinned(a.source.id) ? 0 : 1')
    expect(source).toContain('const bPinned = isSourcePinned(b.source.id) ? 0 : 1')
    expect(source).toMatch(/\$\{source\.name\.toLowerCase\(\)\}\s*\(\$\{source\.lang\}\)/)
  })

  it('mirrors SearchViewModel.filteredItems (isVisible with onlyShowHasResults)', () => {
    expect(source).toContain('const visibleEntries = computed(() =>')
    expect(source).toContain('if (!onlyShowHasResults.value) return true')
    expect(source).toContain("return entry.result.status === 'success' && entry.result.items.length > 0")
  })

  it('mirrors Dispatchers.IO.limitedParallelism(5)', () => {
    expect(source).toContain('const parallelism = 5')
  })

  it('mirrors single extension search behavior (LoadingScreen and auto-replace on single result)', () => {
    expect(source).toContain('const showSingleLoadingScreen = ref(false)')
    expect(source).toContain('class="global-search-loading"')
    expect(source).toContain('titles.length === 1')
    expect(source).toMatch(/router\.replace\(`\/manga\/\$\{titles\[0\]!\.id\}`\)/)
  })

  it('mirrors per-source results rendering (GlobalSearchResultItem, GlobalSearchCardRow, Loading, Error)', () => {
    expect(source).toContain('<GlobalSearchResultItem')
    expect(source).toContain('<GlobalSearchCardRow v-if="entry.result.status === \'success\'"')
    expect(source).toContain('<GlobalSearchLoadingResultItem v-else-if="entry.result.status === \'loading\'"')
    expect(source).toContain('<GlobalSearchErrorResultItem v-else :message="entry.result.message"')
  })

  it('mirrors Modifier.animateItem() via TransitionGroup', () => {
    expect(source).toContain('<TransitionGroup name="gsi"')
    expect(source).toMatch(/\.gsi-enter-active\s*\{[^}]*transition:/)
    expect(source).toMatch(/\.gsi-leave-active\s*\{[^}]*position:\s*absolute/)
    expect(source).toMatch(/\.gsi-move\s*\{[^}]*transition:\s*transform/)
  })

  it('uses viewport layout min-height and list bottom content padding', () => {
    expect(source).toMatch(/\.global-search\s*\{[^}]*min-height:\s*calc\(100dvh - var\(--v-layout-top, 0px\) - var\(--v-layout-bottom, 0px\)\)/)
    expect(source).toMatch(/\.global-search-loading\s*\{[^}]*min-height:\s*calc\(100dvh - var\(--v-layout-top, 0px\) - var\(--v-layout-bottom, 0px\)\)/)
    expect(source).toMatch(/\.global-search-list\s*\{[^}]*padding-bottom:\s*max\(env\(safe-area-inset-bottom, 0px\), 16px\)/)
  })
})
