<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiErrorMessage, createSuwayomiApi } from '../api/client'
import type { Manga } from '../api/types'
import { useSourceCatalogue, type CatalogueMode } from '../composables/useSourceCatalogue'
import { usePreferencesStore } from '../stores/preferences'
import { useSuwayomiStore } from '../stores/suwayomi'
import MangaCollection from '../components/MangaCollection.vue'
import { fetchExtensionList } from '../api/extensions'
import { sourceIdentityToString, type SourceIdentity } from '../utils/sourceId'
import { resolveStubSourceIdentity } from '../utils/sourceIdentity'
import BrowseSourceLoadingItem from '../components/BrowseSourceLoadingItem.vue'
import RemoveMangaDialog from '../components/RemoveMangaDialog.vue'
import DuplicateMangaDialog from '../components/DuplicateMangaDialog.vue'
import ChangeCategoryDialog from '../components/ChangeCategoryDialog.vue'
import MigrateMangaDialog from '../components/MigrateMangaDialog.vue'
import SourceFilterDialog from '../components/SourceFilterDialog.vue'
import { findDuplicateManga, type DuplicateManga } from '../utils/duplicates'
import { cloneSourceFilters, toRawSourceFilters, toSourceFilters, type SourceFilter } from '../components/sourceFilter'
import { stateSelection, type CategorySelection } from '../utils/categorySelection'

/**
 * Mirrors Mihon's `presentation/browse/BrowseSourceScreen.kt`,
 * `tachiyomi/ui/browse/source/browse/BrowseSourceScreen.kt` and
 * `presentation/browse/components/BrowseSourceToolbar.kt`.
 *
 * Layout (top → bottom):
 *  - `AppBar` / `SearchToolbar`: up button, title or inline search field,
 *    display-mode action, overflow (`MoreVert`) menu.
 *  - Listing chip row (`FilterChip`: Popular, Latest, Filter), horizontally scrollable.
 *  - `HorizontalDivider` under the chip row (1dp `outlineVariant`).
 *  - Content: compact grid / comfortable grid / list, or `LoadingScreen`,
 *    or `EmptyScreen` (kaomoji face + message + action row).
 *  - `SnackbarHost`: an indefinite snackbar with a "Retry" action when a page
 *    failed while items are already on screen.
 */
const preferences = usePreferencesStore()
const route = useRoute(), router = useRouter(), server = useSuwayomiStore(), catalogue = useSourceCatalogue()
const source = computed(() => server.sources.find(s => s.id === String(route.params.sourceId)))
const sourceId = computed(() => String(route.params.sourceId ?? ''))
const mode = computed<CatalogueMode>(() => route.query.mode === 'search' ? 'search' : route.query.mode === 'latest' ? 'latest' : 'popular')
const searchTerm = computed(() => typeof route.query.q === 'string' ? route.query.q : '')
const draft = ref(searchTerm.value), searchOpen = ref(mode.value === 'search')
const searchInput = ref<{ focus: () => void; blur: () => void } | null>(null)

const displayMenu = ref(false), overflowMenu = ref(false)
const webViewDialog = ref(false), removeDialog = ref(false)
const changeCategoryOpen = ref(false), migrateDialogOpen = ref(false)
const filterDialogOpen = ref(false)

/**
 * Filter list as produced by the source.
 * In Mihon, `viewModel.state.filters` holds the `FilterList`.
 */
const sourceFilters = ref<SourceFilter[]>([])
const defaultFilters = ref<SourceFilter[]>([])

/** The listing that was active before the toolbar search was opened. Mihon keeps
 * the listing in `state.listing` and only the query in `state.toolbarQuery`, so
 * clearing the query returns to the previous listing (not always "Popular"). */
const lastListingMode = ref<'popular' | 'latest'>(mode.value === 'latest' ? 'latest' : 'popular')
const pendingManga = ref<Manga | null>(null)
/** `BrowseSourceViewModel.Dialog.AddDuplicateManga`: the long press of an entry that
 * has duplicates in the library opens the duplicate sheet instead of adding it. */
const duplicateDialog = ref(false), duplicateManga = ref<Manga | null>(null), duplicateEntries = ref<DuplicateManga[]>([])
const errorSnackbar = ref(false), infoSnackbar = ref(false), infoMessage = ref('')

/** `BrowseSourceToolbar`: `action_display_comfortable_grid`, `action_display_grid`, `action_display_list`. */
const displayModes = [
  { title: 'Comfortable grid', value: 'comfortable' as const },
  { title: 'Compact grid', value: 'compact' as const },
  { title: 'List', value: 'list' as const },
]
/** Mihon has no "cover only" entry in the source menu; `CoverOnlyGrid` renders like the compact grid. */
const displayMode = computed(() => preferences.catalogueDisplay === 'covers' ? 'compact' : preferences.catalogueDisplay)
const displayIcon = computed(() => displayMode.value === 'list' ? 'view_list' : displayMode.value === 'comfortable' ? 'view_module' : 'view_compact')

/**
 * Mihon `MissingSourceScreen` (BrowseSourceScreen.kt:150) renders a plain
 * `AppBar` (title + up button) and an `EmptyScreen` without actions.
 * It is shown when the source is a `StubSource`, i.e. it is not installed.
 * Suwayomi's `/source/list` only exposes installed sources, so a source id
 * that is absent from the list is a missing (not installed) source.
 */
const missingSource = computed(() => server.sourcesLoaded && !server.sourcesError && !server.loadingSources && !source.value)

/**
 * Mihon `StubSource` keeps the name and the language of the source in its local
 * database, so the missing source screen can show "Source not installed: NAME (LANG)".
 * Suwayomi-Server has no stub source table: a source that is not installed is
 * simply absent from `/source/list`. The identity is reconstructed from the
 * extension catalogue instead, because the source id is the MD5 of
 * "name/lang/1" (Mihon `HttpSource.generateId`).
 */
const extensionNames = ref<string[]>([])
async function loadExtensionNames() {
  try {
    const list = await fetchExtensionList(server.apiUrl)
    extensionNames.value = [...new Set(list.map(item => item.name))]
  } catch { extensionNames.value = [] }
}
/** The extension catalogue is only needed to name a source that is not installed. */
watch(missingSource, value => { if (value && !extensionNames.value.length) void loadExtensionNames() }, { immediate: true })
/**
 * The reverse lookup is a cross product of ~1500 extension names and ~67 language
 * codes, so it runs in chunks outside the render path: the screen shows the bare
 * source id first and the resolved name as soon as the search is done.
 */
const stubIdentity = ref<SourceIdentity | null>(null)
let resolveToken = 0
async function resolveStubIdentity(names: string[], wanted: string) {
  const token = ++resolveToken
  const result = await resolveStubSourceIdentity(names, wanted, () => token !== resolveToken)
  if (token === resolveToken) stubIdentity.value = result
}
watch([missingSource, extensionNames, sourceId], ([isMissing, names, id]) => {
  if (!isMissing || !names.length) { stubIdentity.value = null; return }
  void resolveStubIdentity(names, id)
}, { immediate: true })
/** `StubSource.toString()`: "$name (${lang.uppercase()})", or the bare id when invalid. */
const stubLabel = computed(() => sourceIdentityToString(stubIdentity.value, sourceId.value))
/** `MR.strings.source_not_installed` = "Source not installed: %1$s". */
const missingSourceMessage = computed(() => `Source not installed: ${stubLabel.value}`)
/** `AppBar(title = source.name)`: the title of a stub source is its name. */
const title = computed(() => source.value?.name || source.value?.displayName || stubIdentity.value?.name || (source.value ? 'Source' : sourceId.value))
const isLocalSource = computed(() => !!source.value && (source.value.id === '0' || source.value.lang === 'localsourcelang'))
const unsupported = computed(() => mode.value === 'latest' && !!source.value && source.value.supportsLatest === false)

/** `EmptyScreen` picks a random face out of `ErrorFaces`. */
const errorFaces = ['(･o･;)', 'Σ(ಠ_ಠ)', 'ಥ_ಥ', '(˘･_･˘)', '(；￣Д￣)', '(･Д･。', '(╬ಠ益ಠ)', '(╥﹏╥)', '(⋟﹏⋞)', 'Ò︵Ó', ' ˙ᯅ˙)', '(¬_¬)']
const face = ref(errorFaces[Math.floor(Math.random() * errorFaces.length)])

const HELP_URL = 'https://mihon.app/docs/guides/troubleshooting/'
const LOCAL_HELP_URL = 'https://mihon.app/docs/guides/local-source/'

async function loadFilters() {
  if (!sourceId.value) return
  try {
    const raw = await createSuwayomiApi(server.apiUrl).sourceFilters(sourceId.value)
    const parsed = toSourceFilters(raw)
    sourceFilters.value = parsed
    defaultFilters.value = cloneSourceFilters(parsed)
  } catch {
    sourceFilters.value = []
    defaultFilters.value = []
  }
}

/**
 * `SearchToolbar`'s search action calls `onChangeSearchQuery("")`: the field
 * opens empty and the listing on screen is not touched.
 */
async function openSearch() {
  searchOpen.value = true
  draft.value = ''
  await nextTick()
  const rawInput = (searchInput.value as { $el?: HTMLElement; focus?: () => void } | null)?.$el?.querySelector('input') ?? searchInput.value
  rawInput?.focus?.()
}
/**
 * `SearchToolbar`'s reset action: it only clears the text and returns the focus to
 * the field. The listing that is already on screen stays untouched
 * (Mihon `onChangeSearchQuery("")` + `focusRequester.requestFocus()`).
 */
function clearSearch() {
  draft.value = ''
  void nextTick(() => {
    const rawInput = (searchInput.value as { $el?: HTMLElement; focus?: () => void } | null)?.$el?.querySelector('input') ?? searchInput.value
    rawInput?.focus?.()
  })
}

/**
 * Mihon `BrowseSourceScreen.navigateUp` / `SearchToolbar.onClickCloseSearch`:
 * When search is active (searchOpen, mode === 'search', or non-empty query),
 * pressing back clears the search query and closes search, returning to the
 * regular listing mode (popular or latest). A second press navigates back to /browse.
 */
function goBack() {
  if (searchOpen.value || mode.value === 'search' || draft.value) {
    searchOpen.value = false
    draft.value = ''
    sourceFilters.value = cloneSourceFilters(defaultFilters.value)
    void router.replace({ query: { mode: lastListingMode.value } })
    return
  }
  void router.push('/browse')
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && (searchOpen.value || mode.value === 'search')) {
    event.preventDefault()
    goBack()
  }
}

function chooseListing(newMode: 'popular' | 'latest') {
  searchOpen.value = false
  draft.value = ''
  lastListingMode.value = newMode
  // Mihon `viewModel.resetFilters()`
  sourceFilters.value = cloneSourceFilters(defaultFilters.value)
  void router.replace({ query: { mode: newMode } })
}

function openFilterSheet() {
  filterDialogOpen.value = true
}

function onFiltersUpdated(updated: SourceFilter[]) {
  sourceFilters.value = updated
}

function onFiltersReset() {
  sourceFilters.value = cloneSourceFilters(defaultFilters.value)
}

function onFiltersApply() {
  // Mihon `viewModel.search(filters = state.filters)`
  const rawFilters = toRawSourceFilters(sourceFilters.value)
  const q = draft.value.trim()
  searchOpen.value = true
  void router.replace({ query: { mode: 'search', q: q || undefined } })
  void catalogue.open(server.apiUrl, sourceId.value, 'search', q, rawFilters)
}

function search() {
  const q = draft.value.trim()
  // Mihon `searchAndClearFocus` ignores a blank query.
  if (!q) { searchInput.value?.blur(); return }
  searchInput.value?.blur()
  const rawFilters = sourceFilters.value.length ? toRawSourceFilters(sourceFilters.value) : undefined
  void router.replace({ query: { mode: 'search', q } })
  void catalogue.open(server.apiUrl, sourceId.value, 'search', q, rawFilters)
}

function selectDisplay(value: 'compact' | 'comfortable' | 'list') {
  preferences.catalogueDisplay = value
  displayMenu.value = false
}

function reload() {
  if (!source.value || unsupported.value) { catalogue.close(); return }
  const rawFilters = mode.value === 'search' && sourceFilters.value.length ? toRawSourceFilters(sourceFilters.value) : undefined
  void catalogue.open(server.apiUrl, sourceId.value, mode.value, searchTerm.value, rawFilters)
}

/** `onWebViewClick`: Mihon pushes the WebView screen; the web build shows an honest stub instead. */
function openWebView() { webViewDialog.value = true }
/** `onSettingsClick`: Mihon opens `SourcePreferencesScreen`. Suwayomi exposes the
 * source preferences through `/source/{id}/preferences`, so the real screen
 * (src/views/SourcePreferencesView.vue) is opened instead of a stub. */
function openSettings() { void router.push(`/browse/source/${sourceId.value}/preferences`) }
function openSourceSite() {
  const url = source.value?.baseUrl
  if (url && /^https?:\/\//.test(url)) window.open(url, '_blank', 'noopener,noreferrer')
  webViewDialog.value = false
}

watch(() => [route.params.sourceId, mode.value, searchTerm.value, server.apiUrl, source.value, unsupported.value], () => {
  draft.value = searchTerm.value
  if (mode.value === 'search') searchOpen.value = true
  else { searchOpen.value = false; lastListingMode.value = mode.value === 'latest' ? 'latest' : 'popular' }
  reload()
}, { immediate: true })

watch(sourceId, () => { void loadFilters() }, { immediate: true })
watch(() => server.apiUrl, () => { extensionNames.value = []; void server.loadSources(); void loadFilters() })
if (!server.sources.length) void server.loadSources()
onUnmounted(() => { catalogue.close(); window.removeEventListener('scroll', onScroll); window.removeEventListener('keydown', onWindowKeydown) })

/* ------------------------------------------------------------------ *
 * Empty screen (Mihon `EmptyScreen` / `EmptyScreenAction`)
 * ------------------------------------------------------------------ */
interface EmptyAction { label: string; icon: string; href?: string; ariaLabel?: string; onClick?: () => void }
interface EmptyScreenData { message: string; actions: EmptyAction[] }

const emptyScreen = computed<EmptyScreenData | null>(() => {
  if (server.sourcesError) {
    return { message: server.sourcesError, actions: [{ label: 'Retry', icon: 'refresh', onClick: () => void server.loadSources() }] }
  }
  if (server.loadingSources && !source.value) return null
  // The missing source has its own screen (Mihon `MissingSourceScreen`), which is
  // rendered by the template, not by the generic `EmptyScreen`.
  if (!source.value) return null
  if (unsupported.value) {
    return {
      message: 'Latest updates not supported',
      actions: isLocalSource.value
        ? [{ label: 'Local source guide', icon: 'help', href: LOCAL_HELP_URL }]
        : [
          { label: 'Retry', ariaLabel: 'Try again', icon: 'refresh', onClick: () => void reload() },
          { label: 'Open in WebView', icon: 'public', onClick: openWebView },
          { label: 'Help', icon: 'help', href: HELP_URL },
        ],
    }
  }
  // `EmptyScreen` actions: a local source only offers its help guide, every other
  // source offers Retry, Open in WebView and Help.
  const standardActions = (): EmptyAction[] => isLocalSource.value
    ? [{ label: 'Local source guide', icon: 'help', href: LOCAL_HELP_URL }]
    : [
      { label: 'Retry', ariaLabel: 'Try again', icon: 'refresh', onClick: () => void reload() },
      { label: 'Open in WebView', icon: 'public', onClick: openWebView },
      { label: 'Help', icon: 'help', href: HELP_URL },
    ]
  if (catalogue.error && !catalogue.items.length) {
    return { message: catalogue.error, actions: standardActions() }
  }
  if (!catalogue.loading && !catalogue.items.length) {
    return { message: 'No results found', actions: standardActions() }
  }
  return null
})

const showLoading = computed(() => {
  if (emptyScreen.value) return false
  // A source that is not in the list has its own screen (`MissingSourceScreen`).
  if (missingSource.value) return false
  if (!source.value) return true
  return (catalogue.loading || server.loadingSources) && !catalogue.items.length
})

/* ------------------------------------------------------------------ *
 * Snackbar (Mihon shows an indefinite snackbar with a "Retry" action
 * when a page failed while items are already on screen.)
 * ------------------------------------------------------------------ */
watch(() => catalogue.error, (value, previous) => {
  if (value && previous !== value && catalogue.items.length) errorSnackbar.value = true
})
function retryPage() { errorSnackbar.value = false; void catalogue.loadMore() }

/* ------------------------------------------------------------------ *
 * Long press (Mihon `onMangaLongClick`): in-library entries ask for
 * removal, the others are added to the library.
 * ------------------------------------------------------------------ */
const LONG_PRESS_MS = 500
let pressTimer: number | undefined, longPressed = false
let pressStartX = 0, pressStartY = 0
function mangaIdFrom(target: EventTarget | null): number | null {
  const element = (target as HTMLElement | null)?.closest?.('a[href^="/manga/"]') as HTMLAnchorElement | null
  if (!element) return null
  const id = Number(element.getAttribute('href')?.split('/')[2])
  return Number.isFinite(id) ? id : null
}
function onPressStart(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const id = mangaIdFrom(event.target)
  if (id === null) return
  longPressed = false
  pressStartX = event.clientX
  pressStartY = event.clientY
  window.clearTimeout(pressTimer)
  pressTimer = window.setTimeout(() => { longPressed = true; void onMangaLongPress(id) }, LONG_PRESS_MS)
}
function onPressMove(event: PointerEvent) {
  if (pressTimer === undefined) return
  if (Math.hypot(event.clientX - pressStartX, event.clientY - pressStartY) > 8) {
    window.clearTimeout(pressTimer)
    pressTimer = undefined
  }
}
function onPressEnd() {
  if (pressTimer !== undefined) {
    window.clearTimeout(pressTimer)
    pressTimer = undefined
  }
}
function onContextMenu(event: MouseEvent) {
  const id = mangaIdFrom(event.target)
  if (id === null) return
  event.preventDefault()
  void onMangaLongPress(id)
}
function onClickCapture(event: MouseEvent) {
  if (!longPressed) return
  longPressed = false
  event.preventDefault()
  event.stopPropagation()
}

/**
 * `BrowseSourceScreen.kt`: the long press of a library entry opens the removal
 * dialog, the long press of an entry with duplicates in the library opens the
 * duplicate sheet, and everything else is added to the library right away.
 */
async function onMangaLongPress(id: number) {
  try { navigator.vibrate?.(20) } catch { /* haptics are optional */ }
  const manga = catalogue.items.find(item => item.id === id)
  if (!manga) return
  if (manga.inLibrary) { pendingManga.value = manga; removeDialog.value = true; return }
  // `viewModel.getDuplicateLibraryManga(manga)` -> `Dialog.AddDuplicateManga`.
  if (!server.loadingLibrary && !server.totalLibraryCount) await server.loadLibrary()
  const library = [...new Map(Object.values(server.libraryByCategory).flat().map(item => [item.id, item])).values()]
  const duplicates = findDuplicateManga(manga, library)
  if (duplicates.length) {
    duplicateManga.value = manga
    duplicateEntries.value = duplicates
    duplicateDialog.value = true
    return
  }
  await addFavorite(manga)
}

/**
 * Mirrors Mihon `BrowseSourceViewModel.addFavorite(manga)`:
 * Checks categories and default category preference.
 */
async function addFavorite(manga: Manga) {
  const nonSystemCategories = server.categories.filter(c => c.id !== 0 && c.id !== -1)
  // If user has custom categories and default category is not chosen, prompt with dialog
  if (nonSystemCategories.length > 0) {
    pendingManga.value = manga
    changeCategoryOpen.value = true
    return
  }
  await addToLibrary(manga)
}

/** `viewModel.addFavorite(manga)` -> `changeMangaFavorite(manga)`. */
async function addToLibrary(manga: Manga) {
  try {
    await createSuwayomiApi(server.apiUrl).addToLibrary(manga.id)
    manga.inLibrary = true
    infoMessage.value = 'Added to library'
  } catch (reason) {
    infoMessage.value = apiErrorMessage(reason)
  }
  infoSnackbar.value = true
}

/** The duplicate sheet confirms the addition of the entry anyway. */
async function confirmDuplicate() {
  const manga = duplicateManga.value
  duplicateDialog.value = false
  if (!manga) return
  await addFavorite(manga)
}

/** `DuplicateMangaDialog` migrate event */
function onMigrateDuplicate() {
  duplicateDialog.value = false
  migrateDialogOpen.value = true
}

/** The shared `RemoveMangaDialog` owns the removal request. */
function onRemoved(id: number) {
  const manga = catalogue.items.find(item => item.id === id)
  if (manga) manga.inLibrary = false
  infoMessage.value = 'Removed from library'
  infoSnackbar.value = true
}

const categorySelection = computed<CategorySelection[]>(() => {
  return server.categories.filter(c => c.id !== 0 && c.id !== -1).map(category => stateSelection(category, false))
})

async function onCategoryConfirm() {
  changeCategoryOpen.value = false
  if (pendingManga.value) {
    await addToLibrary(pendingManga.value)
  }
}

/* ------------------------------------------------------------------ *
 * Append pages while scrolling (Mihon appends through the pager).
 * ------------------------------------------------------------------ */
function onScroll() {
  if (!catalogue.hasNextPage || catalogue.loading || !catalogue.items.length) return
  const documentHeight = document.documentElement.scrollHeight
  if (documentHeight - window.innerHeight < 120) return
  if (window.scrollY <= 0) return
  if (window.innerHeight + window.scrollY >= documentHeight - 240) void catalogue.loadMore()
}
onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('keydown', onWindowKeydown)
})
</script>

<template>
  <div
    class="source-catalogue"
    @pointerdown.capture="onPressStart"
    @pointermove.capture="onPressMove"
    @pointerup.capture="onPressEnd"
    @pointerleave.capture="onPressEnd"
    @pointercancel.capture="onPressEnd"
    @click.capture="onClickCapture"
    @contextmenu.capture="onContextMenu"
  >
    <!-- AppBar.kt: TopAppBar, up button, title / search field, actions, overflow menu. -->
    <!--
      Mihon `MissingSourceScreen` (BrowseSourceScreen.kt:150) renders a bare
      `AppBar` — the up button and the source name only, without the search
      action, the display-mode action or the overflow menu.
    -->
    <v-app-bar flat height="64" color="surface" class="source-toolbar" :class="{ 'source-toolbar--missing': missingSource }" extension-height="48" :extended="!!source && !missingSource">
      <!-- `UpIcon`: MaterialSymbols.AutoMirroredRounded.ArrowBack (`action_bar_up_description`). -->
      <div class="toolbar-action-wrap toolbar-action-wrap--nav">
        <v-btn
          icon="arrow_back"
          variant="text"
          class="toolbar-action"
          aria-label="Navigate up"
          title="Navigate up"
          @click="goBack"
        />
        <span class="toolbar-tooltip" role="tooltip">Navigate up</span>
      </div>
      <form v-if="searchOpen && !missingSource" class="toolbar-search" role="search" @submit.prevent="search">
        <v-text-field
          ref="searchInput"
          v-model="draft"
          type="search"
          enterkeyhint="search"
          autocomplete="off"
          aria-label="Search…"
          placeholder="Search…"
          variant="plain"
          density="comfortable"
          hide-details
          class="toolbar-search-field"
          @keydown.enter.prevent="search"
          @keydown.esc.prevent="goBack"
        />
      </form>
      <v-app-bar-title v-else class="source-toolbar__title text-title-large font-weight-regular">{{ title }}</v-app-bar-title>
      <template v-if="!missingSource">
        <!-- Search action: `MaterialSymbols.Rounded.Search` with PlainTooltip "Search" -->
        <div v-if="!searchOpen" class="toolbar-action-wrap">
          <v-btn
            icon="search"
            variant="text"
            class="toolbar-action"
            aria-label="Search"
            title="Search"
            @click="openSearch"
          />
          <span class="toolbar-tooltip" role="tooltip">Search</span>
        </div>

        <!-- Reset action: `MaterialSymbols.Rounded.Close` with PlainTooltip "Reset" -->
        <div v-else-if="draft" class="toolbar-action-wrap">
          <v-btn
            icon="close"
            variant="text"
            class="toolbar-action"
            aria-label="Reset"
            title="Reset"
            @click="clearSearch"
          />
          <span class="toolbar-tooltip" role="tooltip">Reset</span>
        </div>

        <!-- Display mode action (`action_display_mode`): the icon follows the current mode. -->
        <div class="toolbar-action-wrap">
          <v-menu
            v-model="displayMenu"
            :close-on-content-click="true"
            min-width="196"
            max-width="196"
            location="bottom end"
            :offset="[-56, 0]"
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                :icon="displayIcon"
                variant="text"
                class="toolbar-action"
                aria-label="Display mode"
                title="Display mode"
              />
            </template>
            <v-list aria-label="Catalogue display modes" class="display-mode-menu m3-dropdown-menu" density="compact">
              <v-list-item
                v-for="item in displayModes"
                :key="item.value"
                :title="item.title"
                class="m3-radio-menu-item"
                @click="selectDisplay(item.value)"
              >
                <template #append>
                  <v-icon
                    :icon="displayMode === item.value ? 'radio_button_checked' : 'radio_button_unchecked'"
                    :color="displayMode === item.value ? 'primary' : undefined"
                    class="m3-radio-menu-item__icon"
                    size="24"
                    :aria-label="displayMode === item.value ? 'Selected' : 'Not selected'"
                  />
                </template>
              </v-list-item>
            </v-list>
          </v-menu>
          <span class="toolbar-tooltip" role="tooltip">Display mode</span>
        </div>

        <!-- Overflow actions (`AppBar.OverflowAction`): text only, no icons. -->
        <div class="toolbar-action-wrap">
          <v-menu
            v-model="overflowMenu"
            min-width="196"
            max-width="196"
            location="bottom end"
            :offset="[-56, 0]"
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon="more_vert"
                variant="text"
                class="toolbar-action"
                aria-label="More options"
                title="More options"
              />
            </template>
            <v-list class="m3-dropdown-menu" density="compact">
              <v-list-item
                v-if="isLocalSource"
                title="Help"
                class="m3-menu-item"
                :href="LOCAL_HELP_URL"
                target="_blank"
                rel="noopener noreferrer"
              />
              <v-list-item
                v-else
                title="Open in WebView"
                class="m3-menu-item"
                @click="openWebView"
              />
              <v-list-item
                v-if="source?.isConfigurable"
                title="Settings"
                class="m3-menu-item"
                @click="openSettings"
              />
            </v-list>
          </v-menu>
          <span class="toolbar-tooltip" role="tooltip">More options</span>
        </div>
      </template>

      <!-- Listing chips (`FilterChip`: Popular, Latest, Filter) below the app bar, above the divider. -->
      <template #extension>
        <div v-if="source" class="source-extension-container">
          <div class="source-listing-bar" role="group" aria-label="Source listing">
            <!-- Popular FilterChip -->
            <button
              type="button"
              class="source-chip"
              :class="{ 'source-chip--selected': mode === 'popular' }"
              :aria-pressed="mode === 'popular'"
              @click="chooseListing('popular')"
            >
              <span class="material-symbols-rounded source-chip-icon" aria-hidden="true">favorite</span>
              <span class="source-chip-label">Popular</span>
            </button>

            <!-- Latest FilterChip (BrowseSourceScreen.kt:172) -->
            <button
              v-if="source.supportsLatest"
              type="button"
              class="source-chip"
              :class="{ 'source-chip--selected': mode === 'latest' }"
              :aria-pressed="mode === 'latest'"
              @click="chooseListing('latest')"
            >
              <span class="material-symbols-rounded source-chip-icon" aria-hidden="true">verified</span>
              <span class="source-chip-label">Latest</span>
            </button>

            <!-- Filter FilterChip (BrowseSourceScreen.kt:192) -->
            <button
              v-if="sourceFilters.length > 0"
              type="button"
              class="source-chip"
              :class="{ 'source-chip--selected': mode === 'search' }"
              :aria-pressed="mode === 'search'"
              @click="openFilterSheet"
            >
              <span class="material-symbols-rounded source-chip-icon" aria-hidden="true">filter_list</span>
              <span class="source-chip-label">Filter</span>
            </button>
          </div>
          <!-- HorizontalDivider() (BrowseSourceScreen.kt:211) -->
          <div class="source-header-divider" role="separator" />
        </div>
      </template>
    </v-app-bar>

    <p v-if="mode === 'search'" class="sr-only" role="status">Search results for {{ searchTerm }}</p>

    <!-- LoadingScreen.kt -->
    <div v-if="showLoading" class="mihon-loading" role="status" aria-label="Loading catalogue">
      <BrowseSourceLoadingItem label="Loading catalogue" />
    </div>

    <!--
      `MissingSourceScreen` (BrowseSourceScreen.kt:149-167): a bare `AppBar` with the
      source name and an `EmptyScreen` without any action row. The message is
      `stringResource(MR.strings.source_not_installed, source.toString())`.
    -->
    <div v-else-if="missingSource" class="mihon-missing-source">
      <div class="mihon-missing-source__content">
        <p class="mihon-empty-face">{{ face }}</p>
        <h1 class="mihon-empty-message">{{ missingSourceMessage }}</h1>
      </div>
    </div>

    <!-- EmptyScreen.kt: face, message, action row. -->
    <div v-else-if="emptyScreen" class="mihon-empty">
      <p class="mihon-empty-face">{{ face }}</p>
      <p class="mihon-empty-message">{{ emptyScreen.message }}</p>
      <div v-if="emptyScreen.actions.length" class="mihon-empty-actions">
        <a
          v-for="action in emptyScreen.actions.filter(a => a.href)"
          :key="action.label"
          class="mihon-empty-action"
          :href="action.href"
          :aria-label="action.ariaLabel"
          target="_blank"
          rel="noopener noreferrer"
        >
          <v-icon :icon="action.icon" size="24" />
          <span>{{ action.label }}</span>
        </a>
        <button
          v-for="action in emptyScreen.actions.filter(a => !a.href)"
          :key="action.label"
          type="button"
          class="mihon-empty-action"
          :aria-label="action.ariaLabel"
          @click="action.onClick?.()"
        >
          <v-icon :icon="action.icon" size="24" />
          <span>{{ action.label }}</span>
        </button>
      </div>
    </div>

    <template v-else>
      <!--
        The catalogue never multi-selects: Mihon uses the long press for the library action.
        `BrowseSourceList.kt` / `BrowseSourceCompactGrid.kt` draw a `BrowseSourceLoadingItem()`
        as the last row while `loadState.refresh/append is LoadState.Loading`, so the loading
        state is handed to the collection instead of being rendered here.
      -->
      <MangaCollection :items="catalogue.items" :display="displayMode" catalogue :selection="[]" :loading="catalogue.loading" />
      <div v-if="catalogue.items.length" class="catalogue-footer" aria-live="polite">
        <v-btn v-if="catalogue.hasNextPage" color="primary" variant="text" :loading="catalogue.loading" @click="catalogue.loadMore">
          {{ catalogue.error ? 'Retry next page' : 'Load more' }}
        </v-btn>
      </div>
    </template>

    <!-- SnackbarHost: an indefinite snackbar with a "Retry" action. -->
    <v-snackbar v-model="errorSnackbar" :timeout="-1" color="inverse-surface" location="bottom">
      {{ catalogue.error }}
      <template #actions>
        <v-btn variant="text" color="inverse-primary" @click="retryPage">Retry</v-btn>
      </template>
    </v-snackbar>
    <v-snackbar v-model="infoSnackbar" :timeout="3000" color="inverse-surface" location="bottom">
      {{ infoMessage }}
    </v-snackbar>

    <!-- WebView stub: the Android in-app WebView has no web equivalent. -->
    <v-dialog v-model="webViewDialog" max-width="480">
      <v-card rounded="xl" color="surface-container-high" title="Open in WebView">
        <v-card-text>
          <p class="mb-4 text-body-medium text-on-surface-variant">The in-app WebView is not supported in the web version.</p>
          <p v-if="source?.baseUrl" class="mb-0 text-body-medium text-on-surface-variant">You can open the source website in your browser instead.</p>
        </v-card-text>
        <v-card-actions class="px-0">
          <v-spacer />
          <v-btn v-if="source?.baseUrl" color="primary" variant="text" @click="openSourceSite">Open website</v-btn>
          <v-btn color="primary" @click="webViewDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- BrowseSourceDialogs.kt: RemoveMangaDialog (the shared M3 AlertDialog port). -->
    <RemoveMangaDialog v-model="removeDialog" :manga="pendingManga" @removed="onRemoved" @failed="message => { infoMessage = message; infoSnackbar = true }" />

    <!--
      BrowseSourceScreen.kt: `Dialog.AddDuplicateManga` -> `DuplicateMangaDialog`.
      The duplicate sheet is shown when the library already holds a similar entry.
    -->
    <DuplicateMangaDialog
      v-model="duplicateDialog"
      :manga="duplicateManga"
      :duplicates="duplicateEntries"
      @confirm="confirmDuplicate"
      @open-manga="m => router.push('/manga/' + m.id)"
      @migrate="onMigrateDuplicate"
    />

    <!-- BrowseSourceScreen.kt: `Dialog.ChangeMangaCategory` -> `ChangeCategoryDialog` -->
    <ChangeCategoryDialog
      v-model="changeCategoryOpen"
      :initial-selection="categorySelection"
      @confirm="onCategoryConfirm"
      @edit-categories="router.push('/categories')"
    />

    <!-- BrowseSourceScreen.kt: `Dialog.Filter` -> `SourceFilterDialog` -->
    <SourceFilterDialog
      v-model="filterDialogOpen"
      :filters="sourceFilters"
      :defaults="defaultFilters"
      @update="onFiltersUpdated"
      @reset="onFiltersReset"
      @filter="onFiltersApply"
    />

    <!-- BrowseSourceScreen.kt: `Dialog.Migrate` -> `MigrateMangaDialog` -->
    <MigrateMangaDialog
      v-model="migrateDialogOpen"
      :total-count="1"
      :supported="false"
      @migrate="migrateDialogOpen = false"
    />
  </div>
</template>

<style scoped>
/*
 * BrowseSourceToolbar: Material 3 TopAppBar container (TopAppBarTokens.kt)
 * Height: 64dp, surface container color at elevation 0 (flat, no shadow),
 * content horizontal padding: 4dp at start and end.
 */
.source-toolbar {
  box-shadow: none !important;
  background-color: rgb(var(--v-theme-surface)) !important;
  color: rgb(var(--v-theme-on-surface)) !important;
}

.source-toolbar :deep(.v-toolbar__content) {
  height: 64px !important;
  padding: 0 4px !important;
}

/* AppBar.kt: the extension holds the chip row and the divider. */
.source-toolbar :deep(.v-toolbar__extension) {
  padding: 0;
  height: 48px !important;
}

.source-extension-container {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  width: 100%;
  height: 48px;
}

/* Row(horizontalScroll, padding(horizontal = 8.dp), spacedBy(8.dp)) */
.source-listing-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 47px;
  padding-inline: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.source-listing-bar::-webkit-scrollbar {
  display: none;
}

/*
 * FilterChip: FilterChipDefaults.Height = 32dp, shape = RoundedCornerShape(8dp),
 * typography = labelLarge (14sp / 20sp, 500, letter-spacing 0.1px).
 * Unselected: 1dp outlineVariant outline, onSurfaceVariant text, primary leading icon.
 * Selected: secondaryContainer container, onSecondaryContainer text and icon.
 */
.source-chip {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding-inline: 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  box-shadow: inset 0 0 0 1px rgb(var(--v-theme-outline-variant));
  color: rgb(var(--v-theme-on-surface-variant));
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: 0.1px;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.source-chip:hover:not(:disabled) {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.source-chip--selected {
  box-shadow: none;
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}

.source-chip--selected:hover:not(:disabled) {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-secondary-container)) 8%, transparent);
}

.source-chip-icon {
  font-size: 18px;
  width: 18px;
  height: 18px;
  color: rgb(var(--v-theme-primary));
}

.source-chip--selected .source-chip-icon {
  color: rgb(var(--v-theme-on-secondary-container));
}

.source-chip-label {
  white-space: nowrap;
}

/* HorizontalDivider: 1dp, outlineVariant (BrowseSourceScreen.kt:211) */
.source-header-divider {
  width: 100%;
  height: 1px;
  background: rgb(var(--v-theme-outline-variant));
  flex: none;
}

/*
 * M3 IconButton (IconButtonTokens.kt):
 * - Interactive touch target: 48x48dp
 * - State layer / bounded ripple container: 40dp circle (CornerFull)
 * - Glyph / Icon: 24dp
 */
.toolbar-action-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.toolbar-action {
  width: 48px !important;
  height: 48px !important;
  min-width: 48px !important;
  min-height: 48px !important;
  padding: 0 !important;
  border-radius: 50% !important;
  color: rgb(var(--v-theme-on-surface)) !important;
}

.toolbar-action :deep(.v-btn__overlay),
.toolbar-action :deep(.v-btn__underlay),
.toolbar-action :deep(.v-ripple__container) {
  width: 40px !important;
  height: 40px !important;
  top: 4px !important;
  left: 4px !important;
  border-radius: 50% !important;
}

.toolbar-action :deep(.v-icon) {
  font-size: 24px !important;
  width: 24px !important;
  height: 24px !important;
}

/*
 * M3 PlainTooltip (anchored above button):
 * Container: inverseSurface, text: inverseOnSurface, 4dp shape (CornerExtraSmall),
 * labelSmall typography (12sp/16sp w400).
 */
.toolbar-tooltip {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-family: Roboto, sans-serif;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.1s linear;
  z-index: 1000;
}

.toolbar-action-wrap:hover .toolbar-tooltip,
.toolbar-action-wrap:focus-within .toolbar-tooltip {
  opacity: 1;
  visibility: visible;
}

/*
 * AppBarTitle: titleLarge 22/28sp w400 onSurface, maxLines = 1, ellipsis.
 * 56dp keyline from start (4dp content padding + 48dp nav button + 4dp margin).
 */
.source-toolbar__title {
  margin-inline-start: 4px !important;
  min-width: 0 !important;
}

.source-toolbar__title :deep(.v-toolbar-title__placeholder) {
  font-family: Roboto, sans-serif !important;
  font-size: 22px !important;
  line-height: 28px !important;
  font-weight: 400 !important;
  letter-spacing: 0 !important;
  color: rgb(var(--v-theme-on-surface)) !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

/*
 * SearchToolbar: BasicTextField fills width between nav and action icons.
 * titleMedium 18/24sp w400, onBackground color, placeholder with 0.78 secondaryItemAlpha.
 */
.toolbar-search {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  margin-inline: 4px 8px;
}

.toolbar-search-field :deep(.v-field) {
  padding: 0 !important;
  min-width: 0 !important;
}

.toolbar-search-field :deep(.v-field__input) {
  min-height: 24px !important;
  height: 24px !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  padding-inline: 0 !important;
}

.toolbar-search-field :deep(input),
.source-toolbar :deep(.toolbar-search input) {
  font-family: Roboto, sans-serif !important;
  font-size: 18px !important;
  line-height: 24px !important;
  font-weight: 400 !important;
  letter-spacing: 0.15px !important;
  color: rgb(var(--v-theme-on-background)) !important;
  caret-color: rgb(var(--v-theme-on-background)) !important;
}

.toolbar-search-field :deep(input::placeholder) {
  color: rgb(var(--v-theme-on-background)) !important;
  opacity: 0.78 !important;
}

.toolbar-search-field :deep(input::-webkit-search-cancel-button),
.toolbar-search-field :deep(input::-webkit-search-decoration) {
  display: none !important;
}

/*
 * M3 DropdownMenu (DropdownMenu.kt):
 * width: 196dp, shape: CornerExtraSmall (4dp), surfaceContainerHigh, elevation 2.
 */
.m3-dropdown-menu {
  width: 196px !important;
  min-width: 196px !important;
  max-width: 196px !important;
  background-color: rgb(var(--v-theme-surface-container-high)) !important;
  border-radius: 4px !important;
  padding: 8px 0 !important;
  box-shadow: 0px 2px 6px 2px rgba(0, 0, 0, 0.15), 0px 1px 2px 0px rgba(0, 0, 0, 0.3) !important;
}

.display-mode-menu {
  width: 196px;
}

.m3-radio-menu-item,
.m3-menu-item {
  min-height: 48px !important;
  padding: 0 12px !important;
  color: rgb(var(--v-theme-on-surface)) !important;
}

.m3-radio-menu-item :deep(.v-list-item-title),
.m3-menu-item :deep(.v-list-item-title) {
  font-family: Roboto, sans-serif !important;
  font-size: 14px !important;
  line-height: 20px !important;
  font-weight: 400 !important;
  letter-spacing: 0.1px !important;
  color: rgb(var(--v-theme-on-surface)) !important;
}

.m3-radio-menu-item__icon {
  width: 24px !important;
  height: 24px !important;
  font-size: 24px !important;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* EmptyScreen.kt: face (displayMedium), message (bodyMedium), action row. */
.mihon-empty {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  text-align: center;
}

/*
  MissingSourceScreen.kt (BrowseSourceScreen.kt:150-167): a `Scaffold` whose only top bar
  is the plain `AppBar` and whose body is an `EmptyScreen` without any action row.
  The `EmptyScreen` column fills the scaffold body (the app bar height is already
  consumed by the layout inset), so the content is centred in the remaining area.
*/
.mihon-missing-source {
  flex: 1 1 auto;
  min-height: calc(100dvh - var(--v-layout-top, 0px) - var(--v-layout-bottom, 0px));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 24px;
  text-align: center;
  overflow-y: auto;
}

/*
  The `EmptyScreen` column is scrollable and centred with `Arrangement.Center`, so the
  centred block gets `margin: auto` instead of `justify-content: center` (the same
  technique as the other empty screens of the reference).
*/
.mihon-missing-source__content {
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Text(face, displayMedium = 45sp / 52sp, letterSpacing 0, weight 400) + secondaryItemAlpha (.78). */
.mihon-empty-face {
  font-size: 45px;
  line-height: 52px;
  font-weight: 400;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface) / .78);
  direction: ltr;
}

/*
  `Text(message, bodyMedium, textAlign = Center, modifier = paddingFromBaseline(top = 24.dp) + secondaryItemAlpha())`.
  paddingFromBaseline(top = 24.dp) puts the layout top 24dp above the text baseline, so the
  visible ink gap is 24 - cap height (~9.95px at 14px) ~= 14px - not a flat 24px margin.
*/
.mihon-empty-message {
  margin-top: 14px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: .0178571429em;
  color: rgb(var(--v-theme-on-surface) / .78);
}

.mihon-empty-actions {
  display: flex;
  gap: 8px;
  margin-top: 24px;
  width: 100%;
}

.mihon-empty-action {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  color: rgb(var(--v-theme-primary));
  font: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  text-decoration: none;
  position: relative;
  min-height: 40px;
  border-radius: 20px;
}

.mihon-empty-action span {
  text-align: center;
}

/*
 * ActionButton.kt: a TextButton that holds a Column with a 24dp icon, 4dp of
 * spacing and the label. A TextButton is 40dp tall, has a 20dp full shape and
 * paints a state layer of 8% on hover and 10% while it is pressed.
 */
.mihon-empty-action::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}

.mihon-empty-action:hover::after {
  opacity: 0.08;
}

.mihon-empty-action:active::after {
  opacity: 0.1;
}

.mihon-empty-action:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* LoadingScreen.kt: Box(fillMaxSize, contentAlignment = Center) { CircularProgressIndicator() }. */
.mihon-loading {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mihon-loading :deep(.browse-source-loading-item) {
  padding: 0;
  align-items: center;
}

.catalogue-footer {
  display: flex;
  justify-content: center;
  padding: 8px 16px 24px;
}
</style>
