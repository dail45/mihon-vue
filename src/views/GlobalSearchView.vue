<script setup lang="ts">
import { TransitionGroup, computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiErrorMessage, createSuwayomiApi } from '../api/client'
import type { Manga, Source } from '../api/types'
import GlobalSearchCardRow from '../components/GlobalSearchCardRow.vue'
import GlobalSearchResultItem, {
  GlobalSearchErrorResultItem,
  GlobalSearchLoadingResultItem,
} from '../components/GlobalSearchResultItems.vue'
import GlobalSearchToolbar from '../components/GlobalSearchToolbar.vue'
import { readPreference, writePreference } from '../stores/preferences'
import { useSuwayomiStore } from '../stores/suwayomi'
import { languageName } from '../utils/sourceLanguage'
import { isSourcePinned } from '../utils/sourcePins'

/**
 * Pixel-parity port of Mihon's global search screen.
 *
 * Reference (Mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1):
 * - `presentation/browse/GlobalSearchScreen.kt` -> `GlobalSearchScreen` / `GlobalSearchContent`:
 *   a `Scaffold` whose top bar is `GlobalSearchToolbar` and whose body is a `LazyColumn` of
 *   per-source items (`Modifier.animateItem()`), keyed by `source.id`.
 * - `presentation/browse/components/GlobalSearchToolbar.kt` -> top app bar (`SearchToolbar`),
 *   the `LinearProgressIndicator` pinned to the bottom of the bar, the filter chip row
 *   (Pinned / All | Has results) and the trailing `HorizontalDivider`.
 * - `presentation/browse/components/GlobalSearchResultItems.kt` -> the per-source header row
 *   (title + localized language + `arrow_forward` IconButton) plus the loading and error states.
 * - `presentation/browse/components/GlobalSearchCardRow.kt` -> the horizontal row of 96dp wide
 *   comfortable grid items, or the "No results found" text for an empty result.
 * - `tachiyomi/ui/browse/source/globalsearch/SearchViewModel.kt` -> the state machine:
 *   `SourceFilter { All, PinnedOnly }` (default `PinnedOnly`), the persisted
 *   `onlyShowHasResults` flag, `SearchItemResult { Loading, Error, Success }`,
 *   `progress` / `total`, `filteredItems` and `sortComparator`.
 * - `tachiyomi/ui/browse/source/globalsearch/GlobalSearchViewModel.kt` -> the `PinnedOnly`
 *   source filter and the initial search for a non blank query.
 * - `tachiyomi/ui/browse/source/globalsearch/GlobalSearchScreen.kt` -> the `extensionFilter`
 *   deep link: a single source is searched, the source filter switches to `SourceFilter.All`,
 *   the screen shows a plain `LoadingScreen` and replaces itself with the manga screen when
 *   exactly one result comes back. The web build has no extension packages, so the filter is
 *   a source id (`?source=<id>`).
 *
 * The Suwayomi REST API has no cross-source search endpoint, so the search is performed with the
 * per-source catalogue endpoint (`GET /source/{id}/search?searchTerm=...&pageNum=1`), exactly like
 * Mihon queries every enabled source separately. Mihon's `Dispatchers.IO.limitedParallelism(5)`
 * is mirrored by a five-request worker pool.
 */
type SourceFilter = 'All' | 'PinnedOnly'
/** Mihon: `SearchItemResult` -> `Success` / `Error` / `Loading`. */
type SourceResult =
  | { status: 'loading' }
  | { status: 'success'; items: Manga[] }
  | { status: 'error'; message: string }

const server = useSuwayomiStore()
const route = useRoute()
const router = useRouter()

/** Mihon: `State.searchQuery: String?` — never null here, so the search field is always open. */
const searchQuery = ref(typeof route.query.q === 'string' ? route.query.q : '')
/**
 * Mihon: `GlobalSearchScreen(extensionFilter: String?)` — the deep link that searches a single
 * extension. The web build has no extension packages, so the filter is a single source id
 * (`?source=<id>`), which is the equivalent of `extensionManager.getLoadedExtensions()`.
 * When it is set, Mihon switches the source filter to `SourceFilter.All`.
 */
const extensionSourceId = ref(typeof route.query.source === 'string' ? route.query.source : '')
/** Mihon: `State.sourceFilter = SourceFilter.PinnedOnly`. */
const sourceFilter = ref<SourceFilter>(extensionSourceId.value ? 'All' : 'PinnedOnly')
/** Mihon: `preferences.globalSearchFilterState`, persisted between sessions. */
const onlyShowHasResults = ref(readPreference('mihon.globalSearch.onlyShowHasResults') === 'true')
const items = ref(new Map<string, SourceResult>())

/** Guards against a stale response overwriting a newer search. */
let job = 0
/** Mihon: `Dispatchers.IO.limitedParallelism(5)`. */
const parallelism = 5
/** Mihon: `lastQuery` / `lastSourceFilter`, a repeated pair is a no-op. */
let lastQuery: string | null = null
let lastSourceFilter: SourceFilter | null = null
/** True once the sources of the current query have been requested. */
let searchStarted = false

const progress = computed(() => {
  let done = 0
  for (const result of items.value.values()) if (result.status !== 'loading') done++
  return done
})
const total = computed(() => items.value.size)

const LANGUAGES_KEY = 'mihon.sourceLanguages'
const DISABLED_SOURCES_KEY = 'mihon.disabledSources'

function readStringList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function defaultEnabledLanguages(): string[] {
  const device = (navigator.language || 'en').split('-')[0] || 'en'
  return [...new Set(['all', 'en', device])]
}

function isLocalSource(source: Source): boolean {
  return source.id === '0' || source.lang === 'localsourcelang' || source.lang === 'other'
}

/**
 * Mihon: `SearchViewModel.getEnabledSources()`:
 * `sourceManager.getAll().filter { (it.lang in enabledLanguages || it.isLocal()) && "${it.id}" !in disabledSources }`
 * and `GlobalSearchViewModel.getEnabledSources()`:
 * `super.getEnabledSources().filter { state.value.sourceFilter != SourceFilter.PinnedOnly || "${it.id}" in pinnedSources }`
 */
function getEnabledSources(): Source[] {
  const storedLangs = readStringList(LANGUAGES_KEY)
  const langs = storedLangs.length ? storedLangs : defaultEnabledLanguages()
  const disabled = new Set(readStringList(DISABLED_SOURCES_KEY))
  return server.sources.filter(source => {
    const enabled = langs.includes(source.lang) || isLocalSource(source)
    return enabled && !disabled.has(source.id)
  })
}

function sourcesForFilter(filter: SourceFilter): Source[] {
  if (extensionSourceId.value) {
    return server.sources.filter(source => source.id === extensionSourceId.value)
  }
  return getEnabledSources().filter(source => filter !== 'PinnedOnly' || isSourcePinned(source.id))
}

/**
 * Mihon: `showSingleLoadingScreen = searchQuery.isNotEmpty() && !extensionFilter.isNullOrEmpty()
 * && state.total == 1` — while a single extension is searched the screen shows a plain
 * `LoadingScreen` instead of the list and replaces itself with the manga screen when exactly
 * one result comes back.
 */
const showSingleLoadingScreen = ref(false)

/** Mihon: `sortComparator` = empty result last, pinned first, then "name (lang)". */
const sortedEntries = computed(() => {
  const map = items.value
  const entries = server.sources
    .filter(source => map.has(source.id))
    .map(source => ({ source, result: map.get(source.id)! }))
  // Kotlin: `compareBy({ (map[it] as? SearchItemResult.Success)?.isEmpty ?: true }, ...)` —
  // `false` sorts before `true`, so a non empty result comes first.
  const key = (source: Source) => `${source.name.toLowerCase()} (${source.lang})`
  entries.sort((a, b) => {
    const aEmpty = a.result.status !== 'success' || a.result.items.length === 0
    const bEmpty = b.result.status !== 'success' || b.result.items.length === 0
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1
    // Kotlin: `{ "${it.id}" !in pinnedSources }` — a pinned source (false) comes first.
    const aPinned = isSourcePinned(a.source.id) ? 0 : 1
    const bPinned = isSourcePinned(b.source.id) ? 0 : 1
    if (aPinned !== bPinned) return aPinned - bPinned
    // Kotlin compares the strings with `String.compareTo` (code point order), not with a
    // locale aware collation, so the plain comparison is used here as well.
    const aKey = key(a.source)
    const bKey = key(b.source)
    if (aKey === bKey) return 0
    return aKey < bKey ? -1 : 1
  })
  return entries
})

/** Mihon: `filteredItems = items.filter { result.isVisible(onlyShowHasResults) }`. */
const visibleEntries = computed(() =>
  sortedEntries.value.filter(entry => {
    if (!onlyShowHasResults.value) return true
    return entry.result.status === 'success' && entry.result.items.length > 0
  }),
)

function setResult(sourceId: string, result: SourceResult) {
  const next = new Map(items.value)
  next.set(sourceId, result)
  items.value = next
}

async function runSearch(query: string, filter: SourceFilter = sourceFilter.value) {
  // Mihon: `if (query.isNullOrBlank()) return`.
  if (!query.trim()) return
  const sameQuery = lastQuery === query
  // Mihon: the same query with the same filter is a no-op.
  if (sameQuery && lastSourceFilter === filter) return
  const sources = sourcesForFilter(filter)
  // Without sources there is nothing to query; the watcher on the source list retries later.
  if (!sources.length) {
    // Mihon: `updateItems(sources.associateWith { ... })` clears the list.
    items.value = new Map()
    return
  }
  lastQuery = query
  lastSourceFilter = filter
  searchStarted = true
  // Mihon: the single extension search shows a plain `LoadingScreen` instead of the list.
  if (extensionSourceId.value) showSingleLoadingScreen.value = true
  const current = ++job
  const previous = items.value
  // Mihon: a repeated query reuses the previous results, a new query starts from `Loading`.
  items.value = new Map(
    sources.map(source => [
      source.id,
      sameQuery ? previous.get(source.id) ?? ({ status: 'loading' } as SourceResult) : ({ status: 'loading' } as SourceResult),
    ]),
  )
  const api = createSuwayomiApi(server.apiUrl)
  const queue = sources.filter(source => items.value.get(source.id)?.status === 'loading')
  const worker = async () => {
    while (queue.length) {
      const source = queue.shift()!
      try {
        const page = await api.sourceCatalogue(source.id, 'search', 1, query)
        if (current !== job) return
        // Mihon: `distinctBy { it.url }`.
        const seen = new Set<string>()
        const titles = page.mangaList.filter(manga => (seen.has(manga.url) ? false : (seen.add(manga.url), true)))
        setResult(source.id, { status: 'success', items: titles })
        // Mihon: `navigator.replace(MangaScreen(manga.id, true))` when the single searched
        // source returned exactly one manga.
        if (extensionSourceId.value && titles.length === 1) {
          void router.replace(`/manga/${titles[0]!.id}`)
          return
        }
        // Mihon: `showSingleLoadingScreen = false` — fall back to the result screen.
        if (extensionSourceId.value) showSingleLoadingScreen.value = false
      } catch (error) {
        if (current !== job) return
        setResult(source.id, { status: 'error', message: apiErrorMessage(error) || 'Unknown error' })
        // Mihon: `else -> showSingleLoadingScreen = false` for an errored single source.
        if (extensionSourceId.value) showSingleLoadingScreen.value = false
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallelism, Math.max(queue.length, 1)) }, worker))
}

function onSearch(value: string) {
  searchQuery.value = value
  if (route.query.q !== value) {
    void router.replace({ query: { ...route.query, q: value || undefined } })
  }
  void runSearch(value)
}

function onChangeFilter(value: SourceFilter) {
  sourceFilter.value = value
  void runSearch(searchQuery.value, value)
}

function onToggleResults() {
  onlyShowHasResults.value = !onlyShowHasResults.value
  writePreference('mihon.globalSearch.onlyShowHasResults', String(onlyShowHasResults.value))
}

function goUp() {
  if (typeof window.history.state?.back === 'string') {
    router.back()
    return
  }
  void router.push('/browse')
}

/** Mihon: `navigator.push(BrowseSourceScreen(source.id, state.searchQuery))`. */
function sourceHref(source: Source) {
  return {
    path: `/browse/source/${source.id}`,
    query: searchQuery.value ? { mode: 'search', q: searchQuery.value } : {},
  }
}

onMounted(() => {
  if (!server.sources.length && !server.loadingSources) void server.loadSources()
  // Mihon: `GlobalSearchViewModel.init` runs the search for a non blank initial query.
  if (searchQuery.value.trim()) void runSearch(searchQuery.value)
})

// The sources arrive asynchronously; the search can only start once they are known.
watch(
  () => server.sources,
  list => {
    if (list.length && searchQuery.value.trim() && !searchStarted) void runSearch(searchQuery.value)
  },
)

watch(
  () => route.query.q,
  value => {
    if (typeof value !== 'string' || value === searchQuery.value) return
    searchQuery.value = value
    if (value.trim()) void runSearch(value)
  },
)
</script>

<template>
  <!--
    Mihon: `GlobalSearchScreen.Content` shows a plain `LoadingScreen` while a single extension is
    searched (the `extensionFilter` deep link), without the toolbar.
  -->
  <div v-if="showSingleLoadingScreen" class="global-search-loading" role="status" aria-label="Loading">
    <v-progress-circular indeterminate color="primary" size="40" width="4" />
  </div>

  <div v-else class="global-search">
    <GlobalSearchToolbar
      :search-query="searchQuery"
      :progress="progress"
      :total="total"
      :source-filter="sourceFilter"
      :only-show-has-results="onlyShowHasResults"
      @navigate-up="goUp"
      @update:search-query="searchQuery = $event ?? ''"
      @search="onSearch"
      @change-source-filter="onChangeFilter"
      @toggle-results="onToggleResults"
    />

    <TransitionGroup name="gsi" tag="div" class="global-search-list" role="list" aria-label="Global search results">
      <article v-for="entry in visibleEntries" :key="entry.source.id" class="gsi" role="listitem">
        <!-- GlobalSearchResultItem: Row(padding(start = 16dp, end = 4dp)) with the title column
             and the arrow_forward IconButton, both opening the source catalogue. -->
        <GlobalSearchResultItem
          :title="entry.source.name"
          :subtitle="languageName(entry.source.lang)"
          :to="sourceHref(entry.source)"
        >
          <GlobalSearchCardRow v-if="entry.result.status === 'success'" :titles="entry.result.items" />

          <!-- GlobalSearchLoadingResultItem: a 16dp CircularProgressIndicator (2dp stroke). -->
          <GlobalSearchLoadingResultItem v-else-if="entry.result.status === 'loading'" />

          <!-- GlobalSearchErrorResultItem: the filled error glyph and the centered message. -->
          <GlobalSearchErrorResultItem v-else :message="entry.result.message" />
        </GlobalSearchResultItem>
      </article>
    </TransitionGroup>
  </div>
</template>

<style scoped>
/* The screen owns its own top bar: the 64dp app bar plus the 32dp filter chip row and the
   1dp divider of `GlobalSearchToolbar`. */
.global-search {
  min-height: calc(100dvh - var(--v-layout-top, 0px) - var(--v-layout-bottom, 0px));
}

/* LoadingScreen: Box(fillMaxSize, contentAlignment = Center) with a CircularProgressIndicator. */
.global-search-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100dvh - var(--v-layout-top, 0px) - var(--v-layout-bottom, 0px));
}

/* The LazyColumn of `GlobalSearchContent`: the leaving item of the sort animation is taken
   out of the flow, so the list needs a positioning context. */
.global-search-list {
  position: relative;
  padding-bottom: max(env(safe-area-inset-bottom, 0px), 16px);
}

/* GlobalSearchResultItem: Row(padding(start = medium = 16dp, end = extraSmall = 4dp),
   fillMaxWidth, SpaceBetween, CenterVertically) — the geometry of the header row lives in
   `GlobalSearchResultItems.vue`, this screen only provides the animated list container. */

/* Modifier.animateItem(): the item fades and slides into place when the list is reordered by
   the sort comparator or when a source switches from loading to a result. */
.gsi-enter-active {
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}

.gsi-leave-active {
  transition: opacity 150ms ease-in, transform 150ms ease-in;
  position: absolute;
}

.gsi-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.gsi-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.gsi-move {
  transition: transform 200ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .gsi-enter-active,
  .gsi-leave-active,
  .gsi-move {
    transition: none;
  }
}
</style>
