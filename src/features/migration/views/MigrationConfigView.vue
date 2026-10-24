<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VDialog, VBottomSheet } from 'vuetify/components'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { useTabletUi } from '@/core/composables/useTabletUi'
import { readMigrationSources, writeMigrationSources } from '@/core/utils/migrationSources'
import { pinnedSourceIds } from '@/core/utils/sourcePins'
import { readPreference, writePreference } from '@/features/settings/stores/preferences'
import Md3Switch from '@/core/components/Md3Switch.vue'

/**
 * Reference:
 *   - mihon/app/src/main/java/mihon/feature/migration/config/MigrationConfigScreen.kt
 *   - mihon/app/src/main/java/mihon/feature/migration/config/MigrationConfigScreenSheet.kt
 *   - mihon/app/src/main/java/mihon/domain/migration/models/MigrationFlag.kt
 *   - mihon/app/src/main/java/eu/kanade/domain/source/service/SourcePreferences.kt
 *
 * Structure (MigrationConfigScreen.kt):
 *  - While the sources are loading the reference shows a bare `LoadingScreen()` (no app bar).
 *  - `state.sources.partition { it.isSelected }` gives the "Selected" and the "Available" list.
 *  - AppBar without a title, an up arrow, the actions "Select all" / "Select none" and the
 *    overflow items "Select enabled sources" / "Select pinned sources".
 *  - The content is a FastScrollLazyColumn: a bodyMedium header ("Selected" / "Available")
 *    with a 16dp padding, then one ElevatedCard per source (16dp horizontal padding, 12dp
 *    rounded corners at the top of the first and at the bottom of the last card of a group)
 *    separated by a HorizontalDivider (16dp horizontal padding).
 *  - Every card holds a ListItem with the 40dp source icon, the source name (bodyMedium,
 *    one line, ellipsis) and the language Pill (bodySmall, uppercased short display name).
 *    The selected group shows a drag handle as soon as it holds more than one source.
 *  - The FAB is a SmallExtendedFloatingActionButton ("Continue" + arrow_forward) that expands
 *    and collapses with the scroll position (`LazyListState.shouldExpandFAB()`).
 *  - "Continue" saves the selection and either opens the migration configuration sheet (several
 *    entries) or goes straight to the search screen (a single entry).
 *
 * The sheet (MigrationConfigScreenSheet.kt) is an AdaptiveSheet (dialog on tablets, bottom sheet
 * on phones, max-width 460dp, 28dp rounded corners) with the "Data to migrate" chips, the migration
 * switches, the additional keywords field and the "Continue" button.
 *
 * Suwayomi-Server exposes no preference endpoint, so the source preferences of Mihon
 * (`SourcePreferences.migrationSources`, `pinnedSources`, `disabledSources`, `enabledLanguages`)
 * are kept in browser storage, exactly like the other screens of this app do.
 * The REST contract also has no migration endpoint, so the last step of the flow reports that
 * the migration is not supported in the web version instead of pretending to work.
 */

const server = useSuwayomiStore()
const route = useRoute()
const router = useRouter()
const tablet = useTabletUi()

/* -------------------------------------------------------------- preferences */

/** `SourcePreferences.enabledLanguages` (preference key "source_languages"). */
const LANGUAGES_KEY = 'mihon.sourceLanguages'
/** `SourcePreferences.disabledSources` (preference key "disabled_sources"). */
const DISABLED_SOURCES_KEY = 'mihon.disabledSources'
/** `SourcePreferences.migrationFlags` (preference key "migration_flags", stored as a bit mask). */
const FLAGS_KEY = 'mihon.migration.flags'

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch { return [] }
}

/** LocaleHelper.getDefaultEnabledLanguages() = { "all", "en", device locale language }. */
function defaultEnabledLanguages(): string[] {
  const device = (navigator.language || 'en').split('-')[0] || 'en'
  return [...new Set(['all', 'en', device])]
}

const enabledLanguages = ref<string[]>(readList(LANGUAGES_KEY))
if (!enabledLanguages.value.length) enabledLanguages.value = defaultEnabledLanguages()
const disabledSources = ref<string[]>(readList(DISABLED_SOURCES_KEY))

/** The ids of the entries that are migrated. A single id switches to the search screen. */
const mangaIds = computed<number[]>(() => {
  const raw = route.query.ids
  const list = typeof raw === 'string' ? raw.split(',') : Array.isArray(raw) ? raw : []
  const fromQuery = list.map(value => Number(value)).filter(value => Number.isFinite(value) && value > 0)
  if (fromQuery.length) return fromQuery
  const single = Number(route.params.mangaId ?? route.params.id)
  if (Number.isFinite(single) && single > 0) return [single]
  const sourceId = typeof route.params.sourceId === 'string' ? route.params.sourceId : ''
  if (sourceId) {
    const ids = new Set<number>()
    for (const group of Object.values(server.libraryByCategory)) {
      for (const manga of group) {
        if (String(manga.sourceId) === sourceId) ids.add(manga.id)
      }
    }
    return Array.from(ids)
  }
  return []
})
const singleMangaId = computed<number | null>(() => (mangaIds.value.length === 1 ? mangaIds.value[0]! : null))

/* ------------------------------------------------------------------- sources */

interface MigrationSource {
  id: string
  name: string
  lang: string
  shortLanguage: string
  isSelected: boolean
}

const sources = ref<MigrationSource[]>([])
const loaded = ref(false)

/** LocaleHelper.getShortDisplayName(lang, uppercase). */
function shortDisplayName(lang: string | null | undefined, uppercase = false): string {
  if (!lang) return ''
  let short = lang
  if (lang === 'es-419') short = 'es-la'
  else if (lang === 'zh-CN') short = 'zh-hans'
  else if (lang === 'zh-TW') short = 'zh-hant'
  return uppercase ? short.toUpperCase() : short
}

/** The comparator of the reference model: selected first, then the stored order, then the name. */
function sortSources(list: MigrationSource[], includedIds: string[]): MigrationSource[] {
  return list.slice().sort((a, b) => {
    if (a.isSelected !== b.isSelected) return a.isSelected ? -1 : 1
    const ai = includedIds.indexOf(a.id)
    const bi = includedIds.indexOf(b.id)
    const aOrder = ai < 0 ? Number.MAX_SAFE_INTEGER : ai
    const bOrder = bi < 0 ? Number.MAX_SAFE_INTEGER : bi
    if (aOrder !== bOrder) return aOrder - bOrder
    return `${a.name} (${a.shortLanguage})`.localeCompare(`${b.name} (${b.shortLanguage})`)
  })
}

/** `initSources` filters with `it.lang in languages` (SourcePreferences.enabledLanguages). */
function isLanguageEnabled(lang: string) {
  return enabledLanguages.value.includes(lang)
}

/** The Suwayomi local source ("0" / "localsourcelang") is not an HttpSource in Mihon. */
function isLocalSource(id: string, lang: string) {
  return id === '0' || lang === 'localsourcelang' || lang === 'other'
}

function initSources() {
  const pinned = pinnedSourceIds()
  const included = readMigrationSources()
  const disabled = disabledSources.value
  const list: MigrationSource[] = server.sources
    .filter(source => !isLocalSource(String(source.id), source.lang))
    .filter(source => isLanguageEnabled(source.lang))
    .map(source => {
      const id = String(source.id)
      const isSelected = included.length
        ? included.includes(id)
        : pinned.length
          ? pinned.includes(id)
          : !disabled.includes(id)
      return {
        id,
        name: source.name,
        lang: source.lang,
        shortLanguage: shortDisplayName(source.lang),
        isSelected,
      }
    })
  sources.value = sortSources(list, included)
  loaded.value = true
}

const loading = computed(() => server.loadingSources || !loaded.value)

/** `state.sources.partition { it.isSelected }`. */
const selectedSources = computed(() => sources.value.filter(source => source.isSelected))
const availableSources = computed(() => sources.value.filter(source => !source.isSelected))

/** `state.sources.distinctBy { it.source.lang }.size > 1`. */
const showLanguage = computed(() => new Set(sources.value.map(source => source.lang)).size > 1)

/** Model.updateSources(): re-sorts and stores the selection. */
function updateSources(action: (list: MigrationSource[]) => MigrationSource[]) {
  const updated = action(sources.value)
  const includedIds = updated.filter(source => source.isSelected).map(source => source.id)
  sources.value = sortSources(updated, includedIds)
  saveSources()
}

/** Model.saveSources(): stores the selected ids in `SourcePreferences.migrationSources`. */
function saveSources() {
  writeMigrationSources(sources.value.filter(source => source.isSelected).map(source => source.id))
}

function toggleSource(id: string) {
  updateSources(list => list.map(source => (source.id === id ? { ...source, isSelected: !source.isSelected } : source)))
}

/** Model.toggleSelection(SelectionConfig). */
function toggleSelectionConfig(config: 'All' | 'None' | 'Pinned' | 'Enabled') {
  const pinned = pinnedSourceIds()
  const disabled = disabledSources.value
  const isSelected = (id: string) => {
    if (config === 'All') return true
    if (config === 'None') return false
    if (config === 'Pinned') return pinned.includes(id)
    return !disabled.includes(id)
  }
  updateSources(list => list.map(source => ({ ...source, isSelected: isSelected(source.id) })))
}

/** Model.orderSource(from, to): moves a source inside the selected group. */
function orderSource(from: number, to: number) {
  if (from === to) return
  const curSelected = selectedSources.value.slice()
  const moved = curSelected.splice(from, 1)[0]
  if (!moved) return
  curSelected.splice(to, 0, moved)
  const newIncludedIds = curSelected.map(s => s.id)
  sources.value = sortSources(sources.value, newIncludedIds)
  saveSources()
}

/* -------------------------------------------------------------------- icons */

const serverBase = computed(() => server.apiUrl.replace(/\/api\/v1\/?$/, ''))
function iconUrl(id: string) {
  const source = server.sources.find(item => String(item.id) === id)
  if (!source?.iconUrl) return ''
  return /^https?:\/\//.test(source.iconUrl) ? source.iconUrl : `${serverBase.value}${source.iconUrl}`
}

/* -------------------------------------------------------------- drag & drop */

const draggingId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

function onDragStart(id: string, event: DragEvent) {
  draggingId.value = id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
  }
}
function onDragOver(id: string, event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  if (dragOverId.value !== id) dragOverId.value = id
}
function onDragLeave(id: string) {
  if (dragOverId.value === id) dragOverId.value = null
}
function onDragEnd() {
  draggingId.value = null
  dragOverId.value = null
}
function onDrop(id: string) {
  const from = draggingId.value
  draggingId.value = null
  dragOverId.value = null
  if (!from || from === id) return
  const fromIndex = selectedSources.value.findIndex(source => source.id === from)
  const toIndex = selectedSources.value.findIndex(source => source.id === id)
  if (fromIndex < 0 || toIndex < 0) return
  orderSource(fromIndex, toIndex)
}

/* --------------------------------------------------------------------- FAB */

/**
 * `LazyListState.shouldExpandFAB()` = lastScrolledBackward || !canScrollForward || !canScrollBackward.
 * The FAB is expanded while the list is scrolled back up, at the end of the list, or when
 * the list does not scroll at all; it collapses in the middle of a long list.
 */
const fabExpanded = ref(true)
let lastScrollTop = 0
function onScroll(event: Event) {
  const el = event.target as HTMLElement
  const top = el.scrollTop
  const scrolledBackward = top < lastScrollTop
  lastScrollTop = top
  const canScrollForward = el.scrollHeight - el.clientHeight - top > 1
  const canScrollBackward = top > 0
  fabExpanded.value = scrolledBackward || !canScrollForward || !canScrollBackward
}

/* ------------------------------------------------------------------- sheet */

const sheetOpen = ref(false)
const extraSearchQuery = ref('')

/** MigrationFlag bit masks (mihon/domain/migration/models/MigrationFlag.kt). */
const FLAG = { CHAPTER: 0b00001, CATEGORY: 0b00010, CUSTOM_COVER: 0b01000, NOTES: 0b100000, REMOVE_DOWNLOAD: 0b10000 }
/** Mihon SourcePreferences.kt: defaultValue = MigrationFlag.entries.toSet(). */
const DEFAULT_FLAGS = FLAG.CHAPTER | FLAG.CATEGORY | FLAG.CUSTOM_COVER | FLAG.NOTES | FLAG.REMOVE_DOWNLOAD

function initFlags(): number {
  const stored = readPreference(FLAGS_KEY)
  if (stored === null) return DEFAULT_FLAGS
  const num = Number(stored)
  return Number.isFinite(num) ? num : DEFAULT_FLAGS
}

const migrationFlags = ref<number>(initFlags())
function hasFlag(flag: number) { return (migrationFlags.value & flag) !== 0 }
function toggleFlag(flag: number) {
  migrationFlags.value = hasFlag(flag) ? migrationFlags.value & ~flag : migrationFlags.value | flag
  writePreference(FLAGS_KEY, String(migrationFlags.value))
}

/** The chips of the sheet, in the order of `MigrationFlag.entries` without REMOVE_DOWNLOAD. */
const chipFlags = [
  { flag: FLAG.CHAPTER, label: 'Chapters' },
  { flag: FLAG.CATEGORY, label: 'Categories' },
  { flag: FLAG.CUSTOM_COVER, label: 'Custom cover' },
  { flag: FLAG.NOTES, label: 'Notes' },
]

/* The switches that are stored as their own preferences in Mihon. */
function readBool(key: string, fallback: boolean) {
  const raw = readPreference(key)
  if (raw === null) return fallback
  return raw === 'true'
}
function writeBool(key: string, value: boolean) { writePreference(key, String(value)) }

const HIDE_UNMATCHED_KEY = 'mihon.migration.hideUnmatched'
const HIDE_WITHOUT_UPDATES_KEY = 'mihon.migration.hideWithoutUpdates'
const DEEP_SEARCH_KEY = 'mihon.migration.deepSearchMode'
const PRIORITIZE_KEY = 'mihon.migration.prioritizeByChapters'

const hideUnmatched = ref(readBool(HIDE_UNMATCHED_KEY, false))
const hideWithoutUpdates = ref(readBool(HIDE_WITHOUT_UPDATES_KEY, false))
const deepSearchMode = ref(readBool(DEEP_SEARCH_KEY, false))
const prioritizeByChapters = ref(readBool(PRIORITIZE_KEY, false))

function setPref(key: string, value: boolean) {
  writeBool(key, value)
}

/* The switches keep the state of their own preference, like the reference does. */
watch(hideUnmatched, value => setPref(HIDE_UNMATCHED_KEY, value))
watch(hideWithoutUpdates, value => setPref(HIDE_WITHOUT_UPDATES_KEY, value))
watch(deepSearchMode, value => setPref(DEEP_SEARCH_KEY, value))
watch(prioritizeByChapters, value => setPref(PRIORITIZE_KEY, value))

/* ------------------------------------------------------------------- flow */

const stubOpen = ref(false)
const stubText = ref('')

const MIGRATE_SEARCH_PATH = '/migrate/manga/:mangaId'
const MIGRATE_LIST_PATH = '/migrate/list'
function routeExists(path: string) {
  return router.getRoutes().some(r => r.path === path)
}

/**
 * continueMigration(openSheet, extraSearchQuery): a single entry goes straight to the search
 * screen, several entries open the configuration sheet first.
 */
function continueMigration(openSheet: boolean, extraQuery: string | null) {
  const id = singleMangaId.value
  if (id === null && openSheet) {
    sheetOpen.value = true
    return
  }
  if (id !== null) {
    if (routeExists(MIGRATE_SEARCH_PATH)) {
      void router.push({ path: MIGRATE_SEARCH_PATH.replace(':mangaId', encodeURIComponent(String(id))) })
      return
    }
    stubText.value = 'Searching for a manual match of the entry in another source is not available in the web version yet.'
    stubOpen.value = true
    return
  }
  if (routeExists(MIGRATE_LIST_PATH)) {
    void router.push({
      path: MIGRATE_LIST_PATH,
      query: extraQuery ? { ids: mangaIds.value.join(','), extraSearchQuery: extraQuery } : { ids: mangaIds.value.join(',') },
    })
    return
  }
  stubText.value = 'Migration is not supported in the web version: the Suwayomi REST API has no endpoint that migrates or copies entries between sources.'
  stubOpen.value = true
}

function onContinue() {
  saveSources()
  continueMigration(true, null)
}

function onStartMigration() {
  const cleaned = extraSearchQuery.value.trim() || null
  sheetOpen.value = false
  continueMigration(false, cleaned)
}

function goBack() {
  if (window.history.state?.back) { router.back(); return }
  void router.push('/browse')
}

onMounted(async () => {
  if (!server.sourcesLoaded && !server.loadingSources) await server.loadSources()
  initSources()
})

watch(() => server.sources, () => {
  if (server.sources.length && !loaded.value) {
    initSources()
  }
})
</script>

<template>
  <div class="migration-config-screen">
    <!-- LoadingScreen(): a bare centred progress indicator, without an app bar. -->
    <div v-if="loading" class="migration-config-loading">
      <v-progress-circular indeterminate color="primary" size="40" width="4" />
    </div>

    <template v-else>
      <v-app-bar flat height="64" color="surface" class="migration-config-toolbar">
        <v-btn icon="arrow_back" variant="text" aria-label="Back" title="Back" @click="goBack" />
        <v-spacer />
        <v-btn icon="select_all" variant="text" aria-label="Select all" title="Select all" @click="toggleSelectionConfig('All')" />
        <v-btn icon="deselect" variant="text" aria-label="Select none" title="Select none" @click="toggleSelectionConfig('None')" />
        <v-menu location="bottom end">
          <template #activator="{ props }">
            <v-btn v-bind="props" icon="more_vert" variant="text" aria-label="More options" title="More options" />
          </template>
          <v-list class="migration-config-overflow-menu" color="surface-container" rounded="xs" elevation="2">
            <v-list-item title="Select enabled sources" @click="toggleSelectionConfig('Enabled')" />
            <v-list-item title="Select pinned sources" @click="toggleSelectionConfig('Pinned')" />
          </v-list>
        </v-menu>
      </v-app-bar>

      <div class="migration-config-list" @scroll.passive="onScroll">
        <template v-for="group in [{ key: 'selected', title: 'Selected', items: selectedSources, selected: true }, { key: 'available', title: 'Available', items: availableSources, selected: false }]" :key="group.key">
          <p v-if="group.items.length" class="migration-config-header">{{ group.title }}</p>
          <template v-for="(item, index) in group.items" :key="item.id">
            <div
              class="migration-config-card"
              :class="{
                'is-first': index === 0,
                'is-last': index === group.items.length - 1,
                'is-dragging': draggingId === item.id,
                'is-drag-over': dragOverId === item.id && draggingId !== item.id,
              }"
              @dragover="group.selected && onDragOver(item.id, $event)"
              @dragleave="group.selected && onDragLeave(item.id)"
              @drop.prevent="group.selected && onDrop(item.id)"
            >
              <button
                type="button"
                class="migration-config-item"
                :class="{
                  'has-drag': group.selected && group.items.length > 1,
                  'is-first': index === 0,
                  'is-last': index === group.items.length - 1,
                }"
                :aria-label="item.name"
                @click="toggleSource(item.id)"
              >
                <span class="migration-config-icon">
                  <img v-if="iconUrl(item.id)" :src="iconUrl(item.id)" alt="" class="migration-config-icon-image" />
                  <span v-else class="material-symbols-rounded migration-config-icon-fallback" aria-hidden="true">public</span>
                </span>
                <span class="migration-config-name">{{ item.name }}</span>
                <span v-if="showLanguage" class="migration-config-pill">{{ item.shortLanguage.toUpperCase() }}</span>
              </button>
              <span
                v-if="group.selected && group.items.length > 1"
                class="material-symbols-rounded migration-config-drag"
                role="button"
                tabindex="0"
                aria-label="Reorder source"
                draggable="true"
                @dragstart="onDragStart(item.id, $event)"
                @dragend="onDragEnd"
                @click.stop
              >drag_handle</span>
            </div>
            <div v-if="index !== group.items.length - 1" class="migration-config-divider" />
          </template>
        </template>
      </div>

      <!-- SmallExtendedFloatingActionButton: "Continue" + arrow_forward. -->
      <div class="migration-config-fab">
        <button
          type="button"
          class="migration-config-fab-button"
          :class="{ 'is-collapsed': !fabExpanded }"
          aria-label="Continue"
          @click="onContinue"
        >
          <span class="material-symbols-rounded migration-config-fab-icon" aria-hidden="true">arrow_forward</span>
          <span v-if="fabExpanded" class="migration-config-fab-text">Continue</span>
        </button>
      </div>
    </template>

    <!-- MigrationConfigScreenSheet: the configuration of what is migrated. -->
    <component :is="tablet ? VDialog : VBottomSheet" v-model="sheetOpen" max-width="460" scrollable>
      <v-card class="migration-config-sheet" color="surface-container-high" rounded="xl">
        <div class="migration-config-sheet-scroll">
          <p class="migration-config-sheet-header">Data to migrate</p>
          <div class="migration-config-chips">
            <button
              v-for="chip in chipFlags"
              :key="chip.label"
              type="button"
              class="migration-config-chip"
              :class="{ 'is-selected': hasFlag(chip.flag) }"
              @click="toggleFlag(chip.flag)"
            >
              <span v-if="hasFlag(chip.flag)" class="material-symbols-rounded migration-config-chip-icon" aria-hidden="true">check</span>
              <span>{{ chip.label }}</span>
            </button>
          </div>

          <!-- Switch: Delete downloads of current entry after migration -->
          <div
            class="migration-config-switch-item"
            role="button"
            tabindex="0"
            @click="toggleFlag(FLAG.REMOVE_DOWNLOAD)"
            @keydown.space.prevent="toggleFlag(FLAG.REMOVE_DOWNLOAD)"
            @keydown.enter.prevent="toggleFlag(FLAG.REMOVE_DOWNLOAD)"
          >
            <div class="migration-config-switch-content">
              <span class="migration-config-switch-title">Delete downloads of current entry after migration</span>
            </div>
            <Md3Switch
              :model-value="hasFlag(FLAG.REMOVE_DOWNLOAD)"
              label="Delete downloads of current entry after migration"
              tabindex="-1"
              aria-hidden="true"
            />
          </div>

          <div class="migration-config-sheet-divider" />

          <!-- OutlinedTextField: Additional keywords (optional) -->
          <div class="migration-config-field">
            <div class="migration-config-outlined-box">
              <input
                id="extra-search-query-input"
                v-model="extraSearchQuery"
                type="text"
                class="migration-config-input"
                placeholder=" "
                autocomplete="off"
              />
              <label for="extra-search-query-input" class="migration-config-label">
                Additional keywords (optional)
              </label>
              <fieldset class="migration-config-outline" aria-hidden="true">
                <legend class="migration-config-legend">
                  <span>Additional keywords (optional)</span>
                </legend>
              </fieldset>
            </div>
            <span class="migration-config-support">
              Helps narrow down search results by adding additional keywords
            </span>
          </div>

          <!-- Switch: Hide entries without a match -->
          <div
            class="migration-config-switch-item"
            role="button"
            tabindex="0"
            @click="hideUnmatched = !hideUnmatched"
            @keydown.space.prevent="hideUnmatched = !hideUnmatched"
            @keydown.enter.prevent="hideUnmatched = !hideUnmatched"
          >
            <div class="migration-config-switch-content">
              <span class="migration-config-switch-title">Hide entries without a match</span>
            </div>
            <Md3Switch
              :model-value="hideUnmatched"
              label="Hide entries without a match"
              tabindex="-1"
              aria-hidden="true"
            />
          </div>

          <!-- Switch: Hide entries without newer chapters -->
          <div
            class="migration-config-switch-item has-subtitle"
            role="button"
            tabindex="0"
            @click="hideWithoutUpdates = !hideWithoutUpdates"
            @keydown.space.prevent="hideWithoutUpdates = !hideWithoutUpdates"
            @keydown.enter.prevent="hideWithoutUpdates = !hideWithoutUpdates"
          >
            <div class="migration-config-switch-content">
              <span class="migration-config-switch-title">Hide entries without newer chapters</span>
              <span class="migration-config-switch-subtitle">Only show entry if the match has additional chapters</span>
            </div>
            <Md3Switch
              :model-value="hideWithoutUpdates"
              label="Hide entries without newer chapters"
              tabindex="-1"
              aria-hidden="true"
            />
          </div>

          <div class="migration-config-sheet-divider" />

          <!-- Warning row -->
          <div class="migration-config-warning">
            <span class="material-symbols-rounded migration-config-warning-icon" aria-hidden="true">warning</span>
            <span class="migration-config-warning-text">These options are slow and dangerous and may lead to restrictions from sources</span>
          </div>

          <!-- Switch: Advanced search mode -->
          <div
            class="migration-config-switch-item has-subtitle"
            role="button"
            tabindex="0"
            @click="deepSearchMode = !deepSearchMode"
            @keydown.space.prevent="deepSearchMode = !deepSearchMode"
            @keydown.enter.prevent="deepSearchMode = !deepSearchMode"
          >
            <div class="migration-config-switch-content">
              <span class="migration-config-switch-title">Advanced search mode</span>
              <span class="migration-config-switch-subtitle">Breaks down the title into keywords for a wider search</span>
            </div>
            <Md3Switch
              :model-value="deepSearchMode"
              label="Advanced search mode"
              tabindex="-1"
              aria-hidden="true"
            />
          </div>

          <!-- Switch: Match based on chapter number -->
          <div
            class="migration-config-switch-item has-subtitle"
            role="button"
            tabindex="0"
            @click="prioritizeByChapters = !prioritizeByChapters"
            @keydown.space.prevent="prioritizeByChapters = !prioritizeByChapters"
            @keydown.enter.prevent="prioritizeByChapters = !prioritizeByChapters"
          >
            <div class="migration-config-switch-content">
              <span class="migration-config-switch-title">Match based on chapter number</span>
              <span class="migration-config-switch-subtitle">If enabled, chooses the match furthest ahead. Otherwise, picks the first match by source priority.</span>
            </div>
            <Md3Switch
              :model-value="prioritizeByChapters"
              label="Match based on chapter number"
              tabindex="-1"
              aria-hidden="true"
            />
          </div>
        </div>

        <div class="migration-config-sheet-divider full-width" />
        <div class="migration-config-sheet-actions">
          <button type="button" class="migration-config-continue" @click="onStartMigration">Continue</button>
        </div>
      </v-card>
    </component>

    <!-- The migration itself is not available in the web version. -->
    <v-dialog v-model="stubOpen" max-width="400">
      <div class="migration-config-dialog">
        <h2 class="migration-config-dialog-title">Migration</h2>
        <p class="migration-config-dialog-text">{{ stubText }}</p>
        <div class="migration-config-dialog-actions">
          <button type="button" class="migration-config-dialog-button" @click="stubOpen = false">Close</button>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<style scoped>
@layer app-components {
.migration-config-screen {
  display: block;
  min-height: 100%;
}

/* LoadingScreen(): a centred CircularProgressIndicator without an app bar. */
.migration-config-loading {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
}

.migration-config-toolbar {
  z-index: 2;
}

.migration-config-overflow-menu {
  background: rgb(var(--v-theme-surface-container));
  border-radius: 4px;
}
.migration-config-overflow-menu :deep(.v-list-item-title) {
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
}

/* The list is a FastScrollLazyColumn: the content padding of the scaffold. */
.migration-config-list {
  box-sizing: border-box;
  width: 100%;
  padding-bottom: 96px;
  overflow-y: auto;
}

/* The group header: bodyMedium (14sp/20sp) with a 16dp padding. */
.migration-config-header {
  margin: 0;
  padding: 16px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}

/* ElevatedCard: 16dp horizontal padding, 12dp rounded corners at group borders. */
.migration-config-card {
  position: relative;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  margin: 0 16px;
  background: rgb(var(--v-theme-surface-container-low));
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 1px 3px 1px rgba(0, 0, 0, .15), 0 1px 2px 0 rgba(0, 0, 0, .3);
  border-radius: 0;
  transition: opacity .15s ease, outline-color .15s ease;
}
.migration-config-card.is-first { border-top-left-radius: 12px; border-top-right-radius: 12px; }
.migration-config-card.is-last { border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; }
.migration-config-card.is-first.is-last { border-radius: 12px; }

.migration-config-card.is-dragging {
  opacity: .4;
}
.migration-config-card.is-drag-over {
  outline: 2px dashed rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.migration-config-item {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 56px;
  gap: 8px;
  padding: 8px 16px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  border-radius: 0;
  transition: background-color .15s ease;
}
.migration-config-item.is-first { border-top-left-radius: 12px; border-top-right-radius: 12px; }
.migration-config-item.is-last { border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; }
.migration-config-item.is-first.is-last { border-radius: 12px; }

.migration-config-item:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.migration-config-item:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.migration-config-item.has-drag {
  padding-inline-end: 8px;
}

/* SourceIcon: 40dp with an aspect ratio of 1. */
.migration-config-icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  background: #8888881f;
}
.migration-config-icon-image { width: 40px; height: 40px; object-fit: cover; }
.migration-config-icon-fallback { font-size: 24px; color: rgb(var(--v-theme-on-surface-variant)); }

.migration-config-name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Pill: extraLarge shape (28dp), surfaceContainerHigh, bodySmall text. */
.migration-config-pill {
  flex: 0 0 auto;
  margin-start: 4px;
  padding: 1px 6px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: .4px;
  white-space: nowrap;
}

.migration-config-drag {
  flex: 0 0 auto;
  padding-inline-start: 8px;
  padding-inline-end: 16px;
  font-size: 24px;
  color: rgb(var(--v-theme-on-surface-variant));
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.migration-config-drag:active {
  cursor: grabbing;
}

/* HorizontalDivider with a 16dp horizontal padding. */
.migration-config-divider {
  height: 1px;
  margin: 0 16px;
  background: rgb(var(--v-theme-outline-variant));
}

/* SmallExtendedFloatingActionButton: primaryContainer background, onPrimaryContainer text. */
.migration-config-fab {
  position: fixed;
  right: 16px;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  z-index: 5;
}
.migration-config-fab-button {
  display: inline-flex;
  align-items: center;
  height: 40px;
  min-width: 40px;
  padding: 0 16px;
  border: 0;
  border-radius: 12px;
  background: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
  font-family: inherit;
  cursor: pointer;
  gap: 8px;
  box-shadow: 0 1px 3px 1px rgba(0, 0, 0, .15), 0 1px 2px 0 rgba(0, 0, 0, .3);
  transition: padding .2s cubic-bezier(.2, 0, 0, 1), min-width .2s cubic-bezier(.2, 0, 0, 1), background-color .15s ease;
}
.migration-config-fab-button:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-primary-container)) 92%, black);
}
.migration-config-fab-button.is-collapsed {
  padding: 0 10px;
}
.migration-config-fab-text {
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .1px;
}
.migration-config-fab-icon {
  font-size: 20px;
}

/* --------------------------------------------------------------- the sheet */

.migration-config-sheet {
  background: rgb(var(--v-theme-surface-container-high)) !important;
  border-radius: 28px !important;
}
.migration-config-sheet-scroll {
  max-height: calc(85vh - 72px);
  padding-top: 16px;
  overflow-y: auto;
}

/* Typography.header: bodyMedium on onSurfaceVariant, semibold. */
.migration-config-sheet-header {
  margin: 0;
  padding: 4px 16px 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface-variant));
}

.migration-config-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 16px 8px;
}

.migration-config-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 16px;
  border: 1px solid rgb(var(--v-theme-outline));
  border-radius: 8px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .1px;
  cursor: pointer;
  transition: background-color .15s ease, border-color .15s ease, color .15s ease;
}
.migration-config-chip.is-selected {
  padding-inline-start: 8px;
  padding-inline-end: 16px;
  border-color: transparent;
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}
.migration-config-chip-icon { font-size: 18px; }

/* ListItem with Switch */
.migration-config-switch-item {
  display: flex;
  align-items: center;
  min-height: 56px;
  gap: 16px;
  box-sizing: border-box;
  width: 100%;
  padding: 8px 16px;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  user-select: none;
  background: transparent;
  transition: background-color .15s ease;
}
.migration-config-switch-item.has-subtitle {
  min-height: 72px;
}
.migration-config-switch-item:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.migration-config-switch-item:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.migration-config-switch-item:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
.migration-config-switch-content {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.migration-config-switch-title {
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}
.migration-config-switch-subtitle {
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-top: 2px;
}

.migration-config-sheet-divider {
  height: 1px;
  margin: 4px 0;
  background: rgb(var(--v-theme-outline-variant));
}
.migration-config-sheet-divider.full-width {
  margin: 0;
}

/* Material 3 OutlinedTextField with notched outline. */
.migration-config-field {
  display: flex;
  flex-direction: column;
  padding: 4px 16px;
}
.migration-config-outlined-box {
  position: relative;
  display: flex;
  align-items: center;
  height: 56px;
  box-sizing: border-box;
}
.migration-config-input {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 16px;
  border: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  font-size: 16px;
  line-height: 24px;
  outline: none;
  z-index: 1;
}
.migration-config-label {
  position: absolute;
  left: 16px;
  top: 16px;
  font-size: 16px;
  line-height: 24px;
  color: rgb(var(--v-theme-on-surface-variant));
  pointer-events: none;
  transform-origin: top left;
  transition: transform 150ms cubic-bezier(0, 0, 0.2, 1), color 150ms cubic-bezier(0, 0, 0.2, 1);
  z-index: 2;
}
.migration-config-input:focus ~ .migration-config-label,
.migration-config-input:not(:placeholder-shown) ~ .migration-config-label {
  transform: translateY(-24px) scale(0.75);
}
.migration-config-input:focus ~ .migration-config-label {
  color: rgb(var(--v-theme-primary));
}
.migration-config-outline {
  position: absolute;
  inset: 0;
  pointer-events: none;
  margin: 0;
  padding: 0 12px;
  border: 1px solid rgb(var(--v-theme-outline));
  border-radius: 4px;
  box-sizing: border-box;
  transition: border-color 150ms cubic-bezier(0, 0, 0.2, 1), border-width 150ms cubic-bezier(0, 0, 0.2, 1);
}
.migration-config-outlined-box:focus-within .migration-config-outline {
  border-width: 2px;
  border-color: rgb(var(--v-theme-primary));
}
.migration-config-legend {
  display: block;
  max-width: 0.01px;
  height: 11px;
  padding: 0;
  font-size: 12px;
  line-height: 16px;
  visibility: hidden;
  transition: max-width 50ms cubic-bezier(0, 0, 0.2, 1);
}
.migration-config-legend > span {
  padding: 0 4px;
  display: inline-block;
  opacity: 0;
  white-space: nowrap;
}
.migration-config-input:focus ~ .migration-config-outline > .migration-config-legend,
.migration-config-input:not(:placeholder-shown) ~ .migration-config-outline > .migration-config-legend {
  max-width: 100%;
}
.migration-config-support {
  padding: 4px 16px 0;
  font-size: 12px;
  line-height: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* The warning row: an active coloured icon and an error coloured text. */
.migration-config-warning {
  display: flex;
  align-items: center;
  min-height: 56px;
  gap: 16px;
  box-sizing: border-box;
  width: 100%;
  padding: 8px 16px;
}
.migration-config-warning-icon {
  flex: 0 0 auto;
  font-size: 24px;
  color: #ffc107;
  font-variation-settings: 'FILL' 1;
}
:root[data-theme='dark'] .migration-config-warning-icon,
.v-theme--mihonDark .migration-config-warning-icon {
  color: #ffeb3b;
}
.migration-config-warning-text {
  flex: 1 1 auto;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  color: rgb(var(--v-theme-error));
}

.migration-config-sheet-actions {
  padding: 8px 16px;
}
.migration-config-continue {
  width: 100%;
  height: 40px;
  border: 0;
  border-radius: 20px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .1px;
  cursor: pointer;
  transition: background-color .15s ease;
}
.migration-config-continue:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 90%, black);
}

/* MD3 AlertDialog. */
.migration-config-dialog {
  box-sizing: border-box;
  width: fit-content;
  min-width: 280px;
  max-width: 560px;
  margin: 0 auto;
  padding: 24px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  box-shadow: 0 4px 8px 3px rgba(0, 0, 0, .15), 0 1px 3px 0 rgba(0, 0, 0, .3);
}
.migration-config-dialog-title {
  margin: 0;
  padding-bottom: 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}
.migration-config-dialog-text {
  margin: 0;
  padding-bottom: 24px;
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface-variant));
}
.migration-config-dialog-actions {
  display: flex;
  flex-direction: row-reverse;
  gap: 8px;
}
.migration-config-dialog-button {
  height: 40px;
  min-width: 58px;
  padding: 0 12px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .1px;
  cursor: pointer;
  transition: background-color .15s ease;
}
.migration-config-dialog-button:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent);
}
}
</style>
