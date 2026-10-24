<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { readPreference, writePreference } from '@/features/settings/stores/preferences'
import { pinnedSourceIds, setSourcePinned } from '@/core/utils/sourcePins'
import { getSourceDisplayName } from '../utils/sourceLanguage'
import SourcePinButton from '../components/SourcePinButton.vue'
import SourceOptionsDialog from '../components/SourceOptionsDialog.vue'
import SearchAppBar from '@/core/components/SearchAppBar.vue'
import Md3CircularProgress from '@/core/components/Md3CircularProgress.vue'
import MihonEmptyScreen from '@/core/components/MihonEmptyScreen.vue'
import Md3PrimaryTabs, { type Md3TabItem } from '@/core/components/Md3PrimaryTabs.vue'
import ExtensionsView from '@/features/browse/components/BrowseExtensionsTab.vue'
import MigrateSourceList from '@/features/migration/components/MigrateSourceList.vue'
import { fetchExtensionList, type ExtensionDto } from '@/core/api/extensions'
import type { Source } from '@/core/api/types'

/**
 * Pixel-parity port of the Browse > Sources screen.
 *
 * Reference (mihon @ 446f6df8):
 * - eu/kanade/presentation/browse/SourcesScreen.kt        (screen, header, item, options dialog)
 * - eu/kanade/presentation/browse/components/BaseSourceItem.kt
 * - eu/kanade/presentation/browse/components/BaseBrowseItem.kt
 * - eu/kanade/presentation/browse/components/BrowseIcons.kt
 * - eu/kanade/tachiyomi/ui/browse/source/SourcesTab.kt   (app bar actions, snackbar)
 * - eu/kanade/tachiyomi/ui/browse/source/SourcesViewModel.kt (grouping)
 * - eu/kanade/domain/source/interactor/GetEnabledSources.kt (filtering, pinning, last used)
 * - tachiyomi/presentation/core/screens/{LoadingScreen,EmptyScreen}.kt
 * - eu/kanade/presentation/components/TabbedScreen.kt    (app bar + primary tab row)
 */
const server = useSuwayomiStore()
const router = useRouter()

/* Mihon keeps pinned sources and the last used source in local preferences
   (SourcePreferences.pinnedSources / lastUsedSource). Suwayomi-Server has no REST
   contract for either, so both stay in browser storage. Pinned sources are shared
   with the rest of the app through utils/sourcePins. */
const LAST_USED_KEY = 'mihon.sources.lastUsed'
const pinnedIds = ref<string[]>(pinnedSourceIds())
function setPinned(id: string, pinned: boolean) {
  setSourcePinned(id, pinned)
  pinnedIds.value = pinnedSourceIds()
}
const lastUsedId = ref<string | null>(readPreference(LAST_USED_KEY))
function setLastUsed(id: string) {
  lastUsedId.value = id
  writePreference(LAST_USED_KEY, id)
}

/* Mihon: Source.isLocal() == (id == LocalSource.ID) and LocalSource.lang == "other".
   Suwayomi reports the local source with id "0" and lang "localsourcelang". */
const LOCAL_LANG = 'localsourcelang'
function isLocal(source: Source) { return source.id === '0' || source.lang === LOCAL_LANG }

function sourcePath(source: Source, mode?: 'latest') {
  return { path: `/browse/source/${encodeURIComponent(source.id)}`, query: mode ? { mode } : {} }
}

const serverBase = computed(() => server.apiUrl.replace(/\/api\/v1\/?$/, ''))
function iconUrl(source: Source) {
  if (!source.iconUrl) return ''
  return /^https?:\/\//.test(source.iconUrl) ? source.iconUrl : `${serverBase.value}${source.iconUrl}`
}

/* GetEnabledSources filters by the enabled languages and the disabled sources before the
   list is grouped. Mihon stores both sets in app preferences ("source_languages" and
   "hidden_catalogues"); Suwayomi's REST API exposes neither, so the web app keeps them in
   browser storage, exactly like the Sources filter screen does. */
const LANGUAGES_KEY = 'mihon.sourceLanguages'
const DISABLED_SOURCES_KEY = 'mihon.disabledSources'
function readStringList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch { return [] }
}
/* LocaleHelper.getDefaultEnabledLanguages() = { "all", "en", device locale language }. */
function defaultEnabledLanguages(): string[] {
  const device = (navigator.language || 'en').split('-')[0] || 'en'
  return [...new Set(['all', 'en', device])]
}

const storedLanguages = ref<string[]>(readStringList(LANGUAGES_KEY))
const disabledSources = ref<string[]>(readStringList(DISABLED_SOURCES_KEY))

function reloadFilters() {
  pinnedIds.value = pinnedSourceIds()
  lastUsedId.value = readPreference(LAST_USED_KEY)
  storedLanguages.value = readStringList(LANGUAGES_KEY)
  disabledSources.value = readStringList(DISABLED_SOURCES_KEY)
}

const visibleSources = computed(() => {
  const langs = storedLanguages.value.length ? storedLanguages.value : defaultEnabledLanguages()
  const disabled = new Set(disabledSources.value)
  return server.sources.filter(source => {
    const enabled = langs.includes(source.lang) || isLocal(source)
    return enabled && !disabled.has(source.id)
  })
})

interface Entry { key: string; source: Source; pinned: boolean }
interface Group { key: string; title: string; entries: Entry[] }

/* Mirrors SourcesViewModel.toSourceUiModels: "Last used" first, "Pinned" second,
   then one header per language, sources sorted by name inside each group. */
const groups = computed<Group[]>(() => {
  const byName = (a: Entry, b: Entry) => a.source.name.localeCompare(b.source.name, undefined, { sensitivity: 'base' })
  const entries: Entry[] = visibleSources.value.map(source => ({
    key: `source-${source.id}`,
    source,
    pinned: pinnedIds.value.includes(source.id),
  }))
  const used = lastUsedId.value ? entries.find(entry => entry.source.id === lastUsedId.value) : undefined
  const lastUsed: Entry[] = used ? [{ ...used, key: `${used.key}-lastused` }] : []
  const pinned = entries.filter(entry => entry.pinned)
  const byLang = new Map<string, Entry[]>()
  for (const entry of entries) {
    if (entry.pinned) continue
    const list = byLang.get(entry.source.lang) || []
    list.push(entry)
    byLang.set(entry.source.lang, list)
  }
  const langKeys = [...byLang.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a < b ? -1 : a > b ? 1 : 0))
  const result: Group[] = []
  if (lastUsed.length) result.push({ key: 'last_used', title: getSourceDisplayName('last_used'), entries: lastUsed.sort(byName) })
  if (pinned.length) result.push({ key: 'pinned', title: getSourceDisplayName('pinned'), entries: pinned.sort(byName) })
  for (const lang of langKeys) {
    result.push({ key: `lang-${lang}`, title: getSourceDisplayName(lang) || 'Other', entries: byLang.get(lang)!.sort(byName) })
  }
  return result
})

/* The search query belongs to the Extensions tab (BrowseTab.kt:77-78 hoists the
   ExtensionsViewModel query into the TabbedScreen). The reference only enables the search
   action on the Extensions tab, so the field is hidden on the other two tabs and the query
   is cleared when the tab changes. */


const activeTab = ref('sources')
function onTabChange(value: unknown) {
  const next = typeof value === 'string' ? value : 'sources'
  activeTab.value = next
}
const searchQuery = ref('')
/* `TabContent.searchEnabled` — only the Extensions tab has it (ExtensionsTab.kt). */
const searchEnabled = computed(() => activeTab.value === 'extensions')
/* The open state of the search field: the reference derives it from the query being null
   (TabbedScreen.kt:49), so the field is closed while another tab is selected. */
const searchOpen = ref(false)
watch(searchEnabled, value => { if (!value) searchOpen.value = false })

const loading = computed(() => server.loadingSources)
const isEmpty = computed(() => !server.loadingSources && !visibleSources.value.length)
/* The Sources tab has no search field in the reference, so the list is never filtered. */
const filteredGroups = computed<Group[]>(() => groups.value)
/* `EmptyScreen(MR.strings.source_empty_screen)` = "No source found". */
const emptyMessage = computed(() => 'No source found')

/* SourceOptionsDialog state (SourcesScreen.kt:164-199). */
const dialogSource = ref<Source | null>(null)
const dialogOpen = computed({ get: () => dialogSource.value !== null, set: (value: boolean) => { if (!value) dialogSource.value = null } })
function onDialogPin() {
  pinnedIds.value = pinnedSourceIds()
}
function onDialogDisable(source: Source) {
  const disabled = new Set(readStringList(DISABLED_SOURCES_KEY))
  disabled.add(source.id)
  localStorage.setItem(DISABLED_SOURCES_KEY, JSON.stringify([...disabled]))
  reloadFilters()
}

/* BrowseTab app bar: the tab strip carries the Sources / Extensions / Migrate tabs
   (BrowseTab.kt:65-79) and each tab brings its own actions:
   - Sources    -> "Global search" (TravelExplore) and "Filter" (FilterList)   [SourcesTab.kt:31-44]
   - Extensions -> overflow "Filter" and "Extension stores"                    [ExtensionsTab.kt]
   - Migrate    -> "Source migration guide" (AutoMirrored Help)                [MigrateSourceTab.kt]
   The screens behind those actions live on their own routes; when a route is registered
   the action navigates, otherwise it opens an honest stub instead of a dead link. */
const GLOBAL_SEARCH_PATH = '/browse/global-search'
const FILTER_PATH = '/browse/sources/filter'
const EXTENSION_FILTER_PATH = '/browse/extensions/filter'
const EXTENSION_STORES_PATH = '/browse/extensions/stores'
const stub = ref<'' | 'global-search' | 'filter' | 'extension-filter' | 'extension-stores'>('')
const stubOpen = computed({ get: () => stub.value !== '', set: (value: boolean) => { if (!value) stub.value = '' } })
const STUB_TITLES: Record<string, string> = {
  'global-search': 'Global search',
  'filter': 'Filter',
  'extension-filter': 'Filter',
  'extension-stores': 'Extension stores',
}
const STUB_MESSAGES: Record<string, string> = {
  'global-search': 'Searching every source at once is not available in the web version yet. Open a source to search inside it.',
  'filter': 'Filtering sources by language is not available in the web version yet.',
  'extension-filter': 'Filtering extensions by language and signature is not available in the web version yet.',
  'extension-stores': 'Managing extension stores is not available in the web version yet.',
}
const stubTitle = computed(() => STUB_TITLES[stub.value] ?? '')
const stubMessage = computed(() => STUB_MESSAGES[stub.value] ?? '')
function routeExists(path: string) {
  return router.getRoutes().some(route => route.path === path)
}
function openGlobalSearch() {
  if (routeExists(GLOBAL_SEARCH_PATH)) { void router.push(GLOBAL_SEARCH_PATH); return }
  stub.value = 'global-search'
}
function openFilter() {
  if (routeExists(FILTER_PATH)) { void router.push(FILTER_PATH); return }
  stub.value = 'filter'
}
/* ExtensionsTab.kt: OverflowAction("Filter"). */
function openExtensionFilter() {
  if (routeExists(EXTENSION_FILTER_PATH)) { void router.push(EXTENSION_FILTER_PATH); return }
  stub.value = 'extension-filter'
}
/* ExtensionsTab.kt: OverflowAction("Extension stores"). */
function openExtensionStores() {
  if (routeExists(EXTENSION_STORES_PATH)) { void router.push(EXTENSION_STORES_PATH); return }
  stub.value = 'extension-stores'
}
/* MigrateSourceTab.kt: AppBar.Action("Source migration guide") opens the online guide. */
function openMigrationGuide() {
  window.open('https://mihon.app/docs/guides/source-migration', '_blank', 'noopener,noreferrer')
}

/* The Browse tab strip shows the three tabs of BrowseTab.kt:65-79; the content of the
   selected tab is rendered in place, like the HorizontalPager of TabbedScreen.kt:77-87.
   The query stays in the ExtensionsViewModel of the reference, so it survives a tab change
   and the field is only hidden while another tab is selected (TabbedScreen.kt:49). */

/* `TabContent.badgeNumber` of the Extensions tab = the number of pending updates
   (ExtensionsTab.kt: badgeNumber = viewModel.state.value.updates). */
const extensionList = ref<ExtensionDto[]>([])
const updatesCount = computed(() => extensionList.value.filter(entry => entry.installed && entry.hasUpdate).length)
const browseTabs = computed<Md3TabItem<string>[]>(() => [
  { value: 'sources', label: 'Sources' },
  { value: 'extensions', label: 'Extensions', badge: updatesCount.value || null },
  { value: 'migrate', label: 'Migrate' },
])
async function loadExtensionCount() {
  try { extensionList.value = await fetchExtensionList(server.apiUrl) } catch { extensionList.value = [] }
}

/* Snackbar shown when the source list could not be fetched
   (SourcesTab.kt: Event.FailedFetchingSources -> MR.strings.internal_error). */
const INTERNAL_ERROR = 'InternalError: Check crash logs for further information'
const snackbar = ref('')
let snackbarTimer: number | undefined
function notify(message: string) {
  snackbar.value = message
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
  /* SnackbarDuration.Short = 4s (compose material3 Snackbar.kt). */
  snackbarTimer = window.setTimeout(() => { snackbar.value = '' }, 4000)
}

function openSource(source: Source) {
  setLastUsed(source.id)
  void router.push(sourcePath(source))
}
function openLatest(source: Source) {
  setLastUsed(source.id)
  void router.push(sourcePath(source, 'latest'))
}
function togglePin(source: Source) {
  setPinned(source.id, !pinnedIds.value.includes(source.id))
}

/* combinedClickable: long press with touch-slop detection opens the options dialog (SourcesScreen.kt:47). */
const TOUCH_SLOP_PX = 8
let pressTimer: number | undefined
let longPressed = false
let startX = 0
let startY = 0

function pressStart(event: PointerEvent, source: Source) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  longPressed = false
  startX = event.clientX
  startY = event.clientY
  if (pressTimer) window.clearTimeout(pressTimer)
  pressTimer = window.setTimeout(() => {
    pressTimer = undefined
    longPressed = true
    dialogSource.value = source
    try { navigator.vibrate?.(40) } catch { /* optional haptic feedback */ }
  }, 500)
}

function pressMove(event: PointerEvent) {
  if (pressTimer === undefined) return
  if (Math.hypot(event.clientX - startX, event.clientY - startY) > TOUCH_SLOP_PX) {
    window.clearTimeout(pressTimer)
    pressTimer = undefined
  }
}

function pressEnd() {
  if (pressTimer) {
    window.clearTimeout(pressTimer)
    pressTimer = undefined
  }
}

function onContextMenu(source: Source) {
  pressEnd()
  longPressed = false
  dialogSource.value = source
}

function rowClick(source: Source) {
  if (longPressed) {
    longPressed = false
    return
  }
  openSource(source)
}

function onAuxClick(event: MouseEvent, source: Source) {
  if (event.button === 1) {
    event.preventDefault()
    setLastUsed(source.id)
    const route = router.resolve(sourcePath(source))
    window.open(route.href, '_blank')
  }
}

function onIconError(event: Event) {
  const wrapper = (event.target as HTMLElement).parentElement
  if (wrapper) wrapper.classList.add('is-broken')
}

watch(() => server.sourcesError, error => { if (error) notify(INTERNAL_ERROR) })
watch(() => server.apiUrl, () => { void server.loadSources(); void loadExtensionCount() })

onMounted(() => {
  reloadFilters()
  window.addEventListener('storage', reloadFilters)
  window.addEventListener('focus', reloadFilters)
  void server.loadSources()
  void loadExtensionCount()
})

onBeforeUnmount(() => {
  window.removeEventListener('storage', reloadFilters)
  window.removeEventListener('focus', reloadFilters)
  if (pressTimer) window.clearTimeout(pressTimer)
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
})
</script>

<template>
  <div class="sources-screen">
    <!--
      SearchToolbar (AppBar.kt:263-418): the title is always "Browse" (MR.strings.browse) and
      the actions belong to the visible tab (TabbedScreen.kt:43-52):
      - Sources   -> AppBar.Action "Global search" (TravelExplore) + "Filter" (FilterList)
      - Extensions-> OverflowAction "Filter" + "Extension stores" (MoreVert)
      - Migrate   -> AppBar.Action "Source migration guide" (AutoMirrored Help)
      The search action only exists on the Extensions tab (`tab.searchEnabled`).
    -->
    <SearchAppBar
      v-model="searchQuery"
      v-model:open="searchOpen"
      title="Browse"
      label="Search extensions"
      open-label="Search extensions"
      :searchable="searchEnabled"
    >
      <!-- SourcesTab.kt:31-44 -->
      <template v-if="activeTab === 'sources'">
        <v-btn icon="travel_explore" variant="text" title="Global search" aria-label="Global search" @click="openGlobalSearch" />
        <v-btn icon="filter_list" variant="text" title="Filter" aria-label="Filter" @click="openFilter" />
      </template>

      <!-- ExtensionsTab.kt: OverflowAction("Filter"), OverflowAction("Extension stores") -->
      <v-menu v-else-if="activeTab === 'extensions'">
        <template #activator="{ props }">
          <v-btn v-bind="props" icon="more_vert" variant="text" aria-label="More options" />
        </template>
        <v-list>
          <v-list-item title="Filter" @click="openExtensionFilter" />
          <v-list-item title="Extension stores" @click="openExtensionStores" />
        </v-list>
      </v-menu>

      <!-- MigrateSourceTab.kt: AppBar.Action("Source migration guide") -->
      <v-btn
        v-else
        icon="help"
        variant="text"
        aria-label="Source migration guide"
        title="Source migration guide"
        @click="openMigrationGuide"
      />
    </SearchAppBar>

    <!-- PrimaryTabRow (TabbedScreen.kt:63-75): 48dp row, 3dp primary indicator, labelLarge tabs. -->
    <Md3PrimaryTabs
      v-model="activeTab"
      :items="browseTabs"
      :scrollable="false"
      class="sources-tabs"
      aria-label="Browse sections"
      @update:model-value="onTabChange"
    />

    <!-- HorizontalPager: the content of the visible tab. -->
    <div v-show="activeTab === 'extensions'" class="browse-pane">
      <ExtensionsView embedded v-model:query="searchQuery" />
    </div>
    <div v-show="activeTab === 'migrate'" class="browse-pane migrate-pane">
      <MigrateSourceList />
    </div>

    <div v-show="activeTab === 'sources'" class="browse-pane sources-pane">
    <!-- LoadingScreen: Box(fillMaxSize) with a centered CircularProgressIndicator. -->
    <div v-if="loading" class="sources-loading" role="status" aria-label="Loading sources">
      <Md3CircularProgress label="Loading sources" />
    </div>

    <!-- EmptyScreen: kaomoji face above the centered message (presentation-core/screens/EmptyScreen.kt). -->
    <MihonEmptyScreen v-else-if="isEmpty || !filteredGroups.length" :message="emptyMessage" class="sources-empty" />

    <div v-else class="sources-list">
      <template v-for="group in filteredGroups" :key="group.key">
        <!-- SourceHeader: typography.header (bodyMedium, onSurfaceVariant, SemiBold). -->
        <h2 class="source-group-header">{{ group.title }}</h2>
        <!-- BaseBrowseItem: combinedClickable row, 16dp horizontal / 8dp vertical padding. -->
        <div
          v-for="entry in group.entries"
          :key="entry.key"
          class="source-row"
          role="button"
          tabindex="0"
          :aria-label="entry.source.name"
          @click="rowClick(entry.source)"
          @auxclick="onAuxClick($event, entry.source)"
          @keydown.enter.prevent="openSource(entry.source)"
          @keydown.space.prevent="openSource(entry.source)"
          @pointerdown="pressStart($event, entry.source)"
          @pointermove="pressMove($event)"
          @pointerup="pressEnd"
          @pointerleave="pressEnd"
          @pointercancel="pressEnd"
          @contextmenu.prevent="onContextMenu(entry.source)"
        >
          <span class="source-icon-wrap" :class="{ 'is-broken': !iconUrl(entry.source), 'is-local': isLocal(entry.source) }">
            <img v-if="iconUrl(entry.source) && !isLocal(entry.source)" class="source-icon" :src="iconUrl(entry.source)" alt="" loading="lazy" @error="onIconError" />
            <span v-else-if="isLocal(entry.source)" class="source-icon-fallback material-symbols-rounded is-local-icon" aria-hidden="true">folder</span>
            <span v-else class="source-icon-fallback material-symbols-rounded" aria-hidden="true">public</span>
          </span>
          <span class="source-text">
            <span class="source-name">{{ entry.source.name }}</span>
            <span class="source-lang">{{ getSourceDisplayName(entry.source.lang) }}</span>
          </span>
          <!-- action slot: "Latest" TextButton (primary) + SourcePinButton. -->
          <v-btn
            v-if="entry.source.supportsLatest"
            variant="text"
            color="primary"
            class="source-latest-btn"
            @pointerdown.stop
            @click.stop.prevent="openLatest(entry.source)"
          >Latest</v-btn>
          <SourcePinButton
            :is-pinned="entry.pinned"
            @pointerdown.stop
            @click.stop.prevent="togglePin(entry.source)"
          />
        </div>
      </template>
    </div>
    </div>

    <SourceOptionsDialog v-model="dialogOpen" :source="dialogSource" @pin="onDialogPin" @disable="onDialogDisable" />

    <v-dialog v-model="stubOpen" max-width="400">
      <v-card class="source-options-card">
        <v-card-title class="source-options-title">{{ stubTitle }}</v-card-title>
        <v-card-text class="source-options-text">
          <p class="stub-message">{{ stubMessage }}</p>
        </v-card-text>
        <v-card-actions class="source-options-actions">
          <v-btn color="primary" variant="text" @click="stub = ''">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- SnackbarHost: SourcesTab.kt:77 shows the plain internal error message, without an
    action button (showSnackbar(internalErrString) has no actionLabel). -->
    <div v-if="snackbar" class="sources-snackbar" role="status" aria-live="polite">
      <span class="snackbar-text">{{ snackbar }}</span>
    </div>
  </div>
</template>

<style scoped>
.sources-screen {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

/* HorizontalPager: every page fills the remaining height of the Scaffold. */
.browse-pane {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

/* TopAppBar title: titleLarge (22sp / 28sp, weight 400). */
.sources-toolbar :deep(.v-toolbar__title) { font-size: 22px; font-weight: 400; }

/* ScrollbarLazyColumn: contentPadding = contentPadding + topSmallPaddingValues (top 8dp).
   In Compose, the LazyColumn has a vertical scrollbar (thickness 4dp, onSurface 36.4% alpha). */
.sources-pane,
.migrate-pane {
  display: block;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 36.4%, transparent) transparent;
}
.sources-pane::-webkit-scrollbar,
.migrate-pane::-webkit-scrollbar {
  width: 4px;
}
.sources-pane::-webkit-scrollbar-track,
.migrate-pane::-webkit-scrollbar-track {
  background: transparent;
}
.sources-pane::-webkit-scrollbar-thumb,
.migrate-pane::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 36.4%, transparent);
  border-radius: 2px;
}
.sources-list { padding-top: 8px; padding-bottom: 96px; }

/* SourceHeader: typography.header = bodyMedium.copy(color = onSurfaceVariant,
   fontWeight = SemiBold) with 16dp horizontal / 8dp vertical padding.
   MD3 bodyMedium: 14sp / 20sp, letterSpacing 0.25sp. */
.source-group-header {
  margin: 0;
  padding: 8px 16px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  letter-spacing: .25px;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* BaseBrowseItem: 16dp horizontal / 8dp vertical padding, vertically centered content.
   The icon slot is 48dp tall, so the row is 48 + 8 + 8 = 64dp high. */
.source-row {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  min-height: 64px;
  padding: 8px 16px;
  cursor: pointer;
  user-select: none;
  background: transparent;
  border: 0;
  text-align: start;
}
.source-row:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 4%, transparent); }
/* combinedClickable draws a ripple in the content colour on press. */
.source-row:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent); }
.source-row:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

/* SourceIcon: BaseSourceItem's defaultIcon passes Modifier.size(48.dp) and BrowseIcons.kt
   appends defaultModifier = height(40.dp).aspectRatio(1f). The outer size(48.dp) fixes the
   slot to 48x48dp, so the square icon is drawn inside a 48dp box (ContentScale.Fit). */
.source-icon-wrap {
  position: relative;
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
}
.source-icon { width: 48px; height: 48px; object-fit: contain; display: block; }
.source-icon-wrap.is-broken .source-icon { display: none; }
.source-icon-fallback { display: none; font-size: 40px; color: rgb(var(--v-theme-on-surface-variant)); }
.source-icon-wrap.is-broken .source-icon-fallback { display: block; }
.source-icon-wrap.is-local .source-icon-fallback {
  display: block;
  font-size: 32px;
  color: rgb(var(--v-theme-primary));
}

/* BaseSourceItem content: 16dp horizontal padding, name (bodyMedium) + language (bodySmall). */
.source-text {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  flex-direction: column;
  padding: 0 16px;
}
.source-name {
  display: block;
  min-width: 0;
  color: rgb(var(--v-theme-on-surface));
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: .25px;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.source-lang {
  min-width: 0;
  font-size: 12px;
  line-height: 16px;
  letter-spacing: .4px;
  color: rgb(var(--v-theme-on-surface) / 0.78);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* MD3 TextButton: 40dp height, 48dp min width, 12dp side padding, labelLarge (14sp / 20sp). */
.source-latest-btn {
  flex: 0 0 auto;
  min-width: 48px !important;
  height: 40px;
  padding: 0 12px !important;
  border-radius: 20px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .1px;
  text-transform: none;
}

/* LoadingScreen: centered CircularProgressIndicator. */
.sources-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  min-height: 0;
}

/* EmptyScreen: centered in the browse sources pane. */
.sources-empty {
  flex: 1 1 auto;
  min-height: 0;
}

/* Web-only stub dialog for the screens that are not routed yet. */
.stub-message { margin: 0; font-size: 14px; line-height: 20px; color: rgb(var(--v-theme-on-surface-variant)); }
.source-options-card { padding: 24px; }
.source-options-title { font-size: 24px; line-height: 32px; font-weight: 400; padding: 0; }
.source-options-text { padding: 0; }
.source-options-actions { justify-content: flex-end; padding: 0; }

/* MD3 snackbar: inverse surface container, 4dp radius, 14sp/20sp label. */
.sources-snackbar {
  position: fixed;
  left: 50%;
  bottom: calc(80px + 16px);
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: min(560px, calc(100vw - 32px));
  min-width: 288px;
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  box-shadow: 0 3px 6px rgba(0, 0, 0, .28), 0 1px 2px rgba(0, 0, 0, .2);
}
.snackbar-text { flex: 1 1 auto; }
</style>
