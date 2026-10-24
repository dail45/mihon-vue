<script setup lang="ts">
import { TransitionGroup, computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiErrorMessage, createSuwayomiApi } from '@/core/api/client'
import type { Manga, Source } from '@/core/api/types'
import GlobalSearchCardRow from '@/features/browse/components/GlobalSearchCardRow.vue'
import GlobalSearchErrorResultItem from '@/features/browse/components/GlobalSearchErrorResultItem.vue'
import GlobalSearchLoadingResultItem from '@/features/browse/components/GlobalSearchLoadingResultItem.vue'
import GlobalSearchResultItem from '@/features/browse/components/GlobalSearchResultItems.vue'
import GlobalSearchToolbar from '@/features/browse/components/GlobalSearchToolbar.vue'
import { readPreference, writePreference } from '@/features/settings/stores/preferences'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { readMangaNotes } from '@/core/utils/mangaNotes'
import { readMigrationSources } from '@/core/utils/migrationSources'
import { languageName } from '@/features/browse/utils/sourceLanguage'
import { pinnedSourceIds } from '@/core/utils/sourcePins'

/**
 * Pixel-parity port of Mihon's migration search screen.
 *
 * Reference (Mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1):
 * - `presentation/browse/MigrateSearchScreen.kt` -> `MigrateSearchScreen`:
 *   a `Scaffold` whose top bar is `GlobalSearchToolbar` (`hideSourceFilter = true`,
 *   so the "Pinned" / "All" chips and the vertical divider are NOT rendered) and
 *   whose content is `GlobalSearchContent`.
 * - `presentation/browse/GlobalSearchScreen.kt:64` -> `GlobalSearchContent`:
 *   a `LazyColumn` with one item per source; the source title gets a "▶ " marker
 *   when it is the source the manga is migrated from, the subtitle is the
 *   localized language name, and the body is the loading / card row / error state.
 *   Every item carries `Modifier.animateItem()`.
 * - `presentation/browse/components/GlobalSearchToolbar.kt` -> the top app bar
 *   (`SearchToolbar`), the `LinearProgressIndicator` pinned to the bottom of the
 *   bar, the "Has results" filter chip and the trailing `HorizontalDivider`.
 * - `presentation/browse/components/GlobalSearchResultItems.kt` -> header row
 *   geometry, `GlobalSearchLoadingResultItem` and `GlobalSearchErrorResultItem`
 *   (rendered through `GlobalSearchResultItems.vue`).
 * - `presentation/browse/components/GlobalSearchCardRow.kt` -> the horizontal row
 *   of 96dp comfortable grid items (rendered through `GlobalSearchCardRow.vue`).
 * - `tachiyomi/ui/browse/source/globalsearch/SearchViewModel.kt` -> the state
 *   machine: `progress`/`total`, `filteredItems`, `search()` and the sort order.
 * - `tachiyomi/ui/browse/migration/search/MigrateSearchViewModel.kt` -> the
 *   migration specifics: the initial query is the manga title, only the
 *   *migration sources* are searched, and the results are sorted with
 *   `compareBy({ success.isEmpty ?: true }, { migrationSources.indexOf(it.id) })`.
 * - `tachiyomi/ui/browse/migration/search/MigrateSearchScreen.kt` -> the entry
 *   point: `fromSourceId = state.from?.source`, the long click opens the manga
 *   screen of the result, the click opens the migrate dialog.
 * - `mihon/feature/migration/dialog/MigrateMangaDialog.kt` -> the "Select data to
 *   include" dialog opened when a result is tapped, with the `LabeledCheckbox`
 *   rows of the applicable `MigrationFlag`s and the "Show entry" / "Copy" /
 *   "Migrate" action row.
 *
 * The Suwayomi REST API has no migration endpoint (copying or replacing a title
 * between sources is a local-database operation in Mihon), so "Copy" / "Migrate"
 * report the limitation inside the dialog instead of silently doing nothing.
 */
type SourceResult = { status: 'loading' } | { status: 'success'; items: Manga[] } | { status: 'error'; message: string }

const server = useSuwayomiStore()
const route = useRoute()
const router = useRouter()

/** Mihon: `MigrateSearchScreen(mangaId)` – the title that is being migrated. */
const mangaId = computed(() => {
  const raw = route.params.mangaId ?? route.params.id
  const value = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(value) && value > 0 ? value : null
})

/** Mihon: `state.from` – the manga the migration starts from. */
const from = ref<Manga | null>(null)
/** Mihon: `state.searchQuery` – `null` until the manga title is known. */
const searchQuery = ref<string | null>(null)
/** Mihon: `state.onlyShowHasResults`, backed by the global search filter preference. */
const onlyShowHasResults = ref(readPreference('mihon.globalSearch.onlyShowHasResults') === 'true')
/** Mihon: `state.items` – one `SearchItemResult` per searched source. */
const items = ref(new Map<string, SourceResult>())
/** Mihon: the error of the initial manga load (shown instead of the list). */
const loadError = ref('')

/** Guards against a stale response overwriting a newer search. */
let job = 0
/** Mihon: `Dispatchers.IO.limitedParallelism(5)`. */
const parallelism = 5
/** Mihon: `lastQuery` guard against repeating the same search. */
let lastQuery: string | null = null
/** True once the search of the current query has been requested. */
let searchStarted = false

const progress = computed(() => {
  let done = 0
  for (const result of items.value.values()) if (result.status !== 'loading') done++
  return done
})
const total = computed(() => items.value.size)

/**
 * Mihon: `MigrateSearchViewModel.getEnabledSources()` returns the sources stored in
 * `SourcePreferences.migrationSources`. The Suwayomi REST API has no preference
 * endpoint, so the selection is kept locally. When nothing is selected the
 * migration configuration default applies: the pinned sources, otherwise every
 * installed source (`MigrationConfigViewModel.initSources`).
 */
const migrationSourceIds = computed(() => {
  const stored = readMigrationSources()
  if (stored.length) return stored
  const pinned = pinnedSourceIds()
  if (pinned.length) return pinned
  return server.sources.map(source => source.id)
})

/** Mihon: `sortComparator` = empty (or failed) results last, then the migration order. */
const sortedEntries = computed(() => {
  const map = items.value
  const order = migrationSourceIds.value
  const entries = server.sources
    .filter(source => map.has(source.id))
    .map(source => ({ source, result: map.get(source.id)! }))
  entries.sort((a, b) => {
    // Kotlin: `compareBy({ (map[it] as? Success)?.isEmpty ?: true }, { migrationSources.indexOf(it.id) })`
    // — a source whose result is missing or empty sorts last.
    const aEmpty = a.result.status !== 'success' || a.result.items.length === 0
    const bEmpty = b.result.status !== 'success' || b.result.items.length === 0
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1
    const aIdx = order.indexOf(a.source.id)
    const bIdx = order.indexOf(b.source.id)
    const aOrder = aIdx === -1 ? Number.MAX_SAFE_INTEGER : aIdx
    const bOrder = bIdx === -1 ? Number.MAX_SAFE_INTEGER : bIdx
    return aOrder - bOrder
  })
  return entries
})

/** Mihon: `filteredItems = items.filter { result.isVisible(onlyShowHasResults) }`. */
const visibleEntries = computed(() => sortedEntries.value.filter(entry => {
  if (!onlyShowHasResults.value) return true
  return entry.result.status === 'success' && entry.result.items.length > 0
}))

function setResult(sourceId: string, result: SourceResult) {
  const next = new Map(items.value)
  next.set(sourceId, result)
  items.value = next
}

/** Check if this source matches the source the manga is being migrated from. */
function isFromSource(sourceId: string | number): boolean {
  if (!from.value) return false
  const origSourceId = from.value.sourceId ?? from.value.source?.id
  return origSourceId != null && String(sourceId) === String(origSourceId)
}

async function runSearch(query: string, force = false) {
  const trimmed = query.trim()
  // Mihon: `if (query.isNullOrBlank()) return`.
  if (!trimmed) return
  // Mihon: the same query is a no-op unless forced.
  if (!force && lastQuery === trimmed) return
  const ids = migrationSourceIds.value
  const sources = server.sources.filter(source => ids.includes(source.id))
  // Without sources there is nothing to query; the watcher on the source list retries later.
  if (!sources.length) {
    // Mihon: `updateItems(sources.associateWith { ... })` clears the list.
    items.value = new Map()
    return
  }
  lastQuery = trimmed
  searchStarted = true
  const current = ++job
  // When a new search is initiated, all sources are marked as loading.
  items.value = new Map(sources.map(source => [source.id, { status: 'loading' } as SourceResult]))
  const api = createSuwayomiApi(server.apiUrl)
  const queue = [...sources]
  const worker = async () => {
    while (queue.length) {
      const source = queue.shift()!
      try {
        const page = await api.sourceCatalogue(source.id, 'search', 1, trimmed)
        if (current !== job) return
        // Mihon: `distinctBy { it.url }`.
        const seen = new Set<string>()
        const titles = page.mangaList.filter(manga => (seen.has(manga.url) ? false : (seen.add(manga.url), true)))
        setResult(source.id, { status: 'success', items: titles })
      } catch (error) {
        if (current !== job) return
        setResult(source.id, { status: 'error', message: apiErrorMessage(error) || 'Unknown error' })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallelism, Math.max(queue.length, 1)) }, worker))
}

function onSearch(value: string) {
  searchQuery.value = value
  void runSearch(value, true)
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
  if (route.query.fromList) {
    void router.push({
      path: '/migrate/list',
      query: {
        ids: (route.query.returnIds as string) || String(mangaId.value),
        extraSearchQuery: (route.query.extraSearchQuery as string) || undefined,
      },
    })
    return
  }
  void router.push('/browse')
}

/**
 * Mihon: `onClickSource` opens the per-source search screen of that source
 * (`MigrateSourceSearchScreen`). The web client opens the source catalogue of
 * that source in search mode instead.
 */
function sourceRoute(source: Source) {
  const query: Record<string, string> = {}
  if (searchQuery.value) {
    query.mode = 'search'
    query.q = searchQuery.value
  }
  if (route.query.fromList) {
    query.fromList = 'true'
    if (route.query.returnIds) query.returnIds = String(route.query.returnIds)
    if (route.query.extraSearchQuery) query.extraSearchQuery = String(route.query.extraSearchQuery)
  }
  return { path: `/browse/source/${source.id}`, query }
}

// --- MigrateMangaDialog -----------------------------------------------------------------

/** Mihon: `state.dialog` = `SearchViewModel.Dialog.Migrate(target, current)`. */
const dialogTarget = ref<Manga | null>(null)
const dialogOpen = computed({
  get: () => dialogTarget.value !== null,
  set: (value: boolean) => { if (!value) dialogTarget.value = null },
})
/**
 * Mihon: `state.selectedFlags` – `SourcePreferences.migrationFlags`, which defaults to
 * `MigrationFlag.entries.toSet()` (every flag) and is persisted on every migration.
 */
const selectedFlags = ref<string[]>(readMigrationFlags())
/** Mihon: `current.notes.isNotBlank()` – the notes of the entry that is being migrated. */
const hasNotes = computed(() => {
  if (!mangaId.value) return false
  return readMangaNotes(server.apiUrl, mangaId.value).trim().length > 0
})
/** Mihon: `state.isMigrating` – the dialog shows a loading screen while it runs. */
const migrating = ref(false)
/** The honest stub message, shown in place of the migration. */
const migrationError = ref('')

/**
 * Mihon: `MigrateDialogViewModel.init()` -> `applicableFlags`, built in the order of
 * `MigrationFlag.entries` (CHAPTER, CATEGORY, CUSTOM_COVER, NOTES, REMOVE_DOWNLOAD):
 * - CHAPTER and CATEGORY always apply.
 * - CUSTOM_COVER applies when `current.hasCustomCover(coverCache)`. The Suwayomi REST v1
 *   payload carries no such flag and the server has no custom-cover endpoint, so the
 *   web client cannot detect it and the flag is not offered.
 * - NOTES applies when `current.notes.isNotBlank()`. Mihon stores the notes in its local
 *   database; the web client keeps them in browser storage (`mangaNotes.ts`), so the
 *   flag can be evaluated exactly like the reference.
 * - REMOVE_DOWNLOAD applies when `downloadManager.getDownloadCount(current) > 0`, which the
 *   REST payload exposes as `downloadCount`.
 */
const applicableFlags = computed(() => {
  const flags = ['chapters', 'categories']
  if (hasNotes.value) flags.push('notes')
  if ((from.value?.downloadCount ?? 0) > 0) flags.push('delete_downloaded')
  return flags
})

const flagLabels: Record<string, string> = {
  chapters: 'Chapters',
  categories: 'Categories',
  custom_cover: 'Custom cover',
  notes: 'Notes',
  delete_downloaded: 'Delete downloaded',
}

/** Mihon: `SourcePreferences.migrationFlags` (a bit mask) persisted between sessions. */
function readMigrationFlags(): string[] {
  const raw = readPreference('mihon.migration.flags')
  if (!raw) {
    // Mihon: `MigrationFlag.entries.toSet()` is the default of the preference.
    return ['chapters', 'categories', 'custom_cover', 'notes', 'delete_downloaded']
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}

function writeMigrationFlags(flags: string[]) {
  writePreference('mihon.migration.flags', JSON.stringify(flags))
}

function toggleFlag(flag: string) {
  selectedFlags.value = selectedFlags.value.includes(flag)
    ? selectedFlags.value.filter(value => value !== flag)
    : [...selectedFlags.value, flag]
  writeMigrationFlags(selectedFlags.value)
}

/** Mihon: `onClickItem` opens the migrate dialog when no migration list is on the stack. */
function onClickItem(manga: Manga) {
  if (route.query.fromList) {
    void router.push({
      path: '/migrate/list',
      query: {
        ids: (route.query.returnIds as string) || String(mangaId.value),
        extraSearchQuery: (route.query.extraSearchQuery as string) || undefined,
        matchCurrent: String(mangaId.value),
        matchTarget: String(manga.id),
      },
    })
    return
  }
  migrationError.value = ''
  dialogTarget.value = manga
}

/** Mihon: `onLongClickItem` opens the manga screen of the result. */
function onLongClickItem(manga: Manga) {
  void router.push(`/manga/${manga.id}`)
}

/** Mihon: `onClickTitle` – dismiss the dialog and open the target entry. */
function showTarget() {
  const target = dialogTarget.value
  dialogTarget.value = null
  if (target) void router.push(`/manga/${target.id}`)
}

/**
 * Mihon: `viewModel.migrateManga(replace)` – the copy / replace of a title
 * between sources. The Suwayomi REST API has no such endpoint (Mihon writes
 * into its own local database), so the action shows the loading screen of the
 * reference and then reports the limitation.
 */
function requestMigration(replace: boolean) {
  if (migrating.value) return
  migrating.value = true
  migrationError.value = ''
  window.setTimeout(() => {
    migrating.value = false
    migrationError.value = `${replace ? 'Migrate' : 'Copy'} is not supported in the web version: the Suwayomi REST API has no endpoint that migrates or copies entries between sources.`
  }, 400)
}

onMounted(async () => {
  if (!server.sources.length && !server.loadingSources) await server.loadSources()
  if (!mangaId.value) return
  const api = createSuwayomiApi(server.apiUrl)
  try {
    const manga = await api.manga(mangaId.value)
    from.value = manga
    // Mihon: `searchQuery = manga.title` followed by `search()`.
    searchQuery.value = manga.title
    void runSearch(manga.title)
  } catch (error) {
    loadError.value = apiErrorMessage(error)
  }
})

// The sources arrive asynchronously; the search can only start once they are known.
watch(
  () => server.sources,
  list => {
    if (list.length && searchQuery.value?.trim() && !searchStarted) void runSearch(searchQuery.value)
  },
)
</script>

<template>
  <div class="migrate-search">
    <GlobalSearchToolbar
      :search-query="searchQuery"
      :progress="progress"
      :total="total"
      source-filter="PinnedOnly"
      :only-show-has-results="onlyShowHasResults"
      hide-source-filter
      @navigate-up="goUp"
      @update:search-query="searchQuery = $event"
      @search="onSearch"
      @toggle-results="onToggleResults"
    />

    <p v-if="loadError" class="migrate-load-error" role="alert">{{ loadError }}</p>

    <TransitionGroup name="msi" tag="div" class="migrate-search-list" role="list" aria-label="Migration search results">
      <article v-for="entry in visibleEntries" :key="entry.source.id" class="msi" role="listitem">
        <GlobalSearchResultItem
          :title="isFromSource(entry.source.id) ? `▶ ${entry.source.name}` : entry.source.name"
          :subtitle="languageName(entry.source.lang)"
          :to="sourceRoute(entry.source)"
        >
          <GlobalSearchCardRow
            v-if="entry.result.status === 'success'"
            :titles="entry.result.items"
            :on-click="onClickItem"
            :on-long-click="onLongClickItem"
          />

          <GlobalSearchLoadingResultItem v-else-if="entry.result.status === 'loading'" />

          <GlobalSearchErrorResultItem v-else :message="entry.result.message" />
        </GlobalSearchResultItem>
      </article>
    </TransitionGroup>

    <!-- MigrateMangaDialog: the reference returns from the dialog composable while
         `state.isMigrating` and paints a `LoadingScreen` over the whole screen, so the
         dialog itself is hidden during the migration. -->
    <v-dialog
      v-if="!migrating"
      v-model="dialogOpen"
      max-width="560"
      content-class="migrate-dialog-overlay"
      aria-labelledby="migrate-dialog-title"
    >
      <div v-if="dialogTarget" class="migrate-dialog" role="dialog" aria-modal="true" aria-labelledby="migrate-dialog-title">
        <h2 id="migrate-dialog-title" class="migrate-dialog-title">Select data to include</h2>

        <div class="migrate-dialog-text">
          <!-- Column(Modifier.verticalScroll(rememberScrollState())) of LabeledCheckbox rows. -->
          <div class="migrate-flags" role="group" aria-label="Data to include">
            <label v-for="flag in applicableFlags" :key="flag" class="migrate-flag">
              <span class="migrate-checkbox-wrap">
                <input
                  type="checkbox"
                  class="migrate-checkbox-input"
                  :checked="selectedFlags.includes(flag)"
                  @change="toggleFlag(flag)"
                />
                <span class="migrate-checkbox" :class="{ 'migrate-checkbox--checked': selectedFlags.includes(flag) }">
                  <svg class="migrate-checkbox-mark" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                    <polyline points="4,10 8,14 16,6" pathLength="100" />
                  </svg>
                </span>
              </span>
              <span class="migrate-flag-label">{{ flagLabels[flag] }}</span>
            </label>
          </div>
          <p v-if="migrationError" class="migrate-dialog-error" role="alert">{{ migrationError }}</p>
        </div>

        <!-- FlowRow(spacedBy(extraSmall)) { "Show entry"; Spacer(weight 1f); "Copy"; "Migrate" } -->
        <div class="migrate-dialog-actions">
          <button type="button" class="migrate-text-button" @click="showTarget">Show entry</button>
          <span class="migrate-actions-spacer" />
          <button type="button" class="migrate-text-button" @click="requestMigration(false)">Copy</button>
          <button type="button" class="migrate-text-button" @click="requestMigration(true)">Migrate</button>
        </div>
      </div>
    </v-dialog>

    <!-- MigrateMangaDialog: `LoadingScreen(background.copy(alpha = 0.7f))` while the migration runs. -->
    <div v-if="migrating" class="migrate-loading" role="progressbar" aria-label="Migrating">
      <v-progress-circular indeterminate color="primary" size="40" width="4" />
    </div>
  </div>
</template>

<style scoped>
/* The screen owns its own top bar: the 64dp app bar plus the 32dp filter chip row and the
   1dp divider of `GlobalSearchToolbar`. */
.migrate-search {
  min-height: calc(100dvh - 97px);
}

/* The LazyColumn of `GlobalSearchContent`: the leaving item of the sort animation is taken
   out of the flow, so the list needs a positioning context. */
.migrate-search-list {
  position: relative;
  padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
}

.migrate-load-error {
  margin: 0;
  padding: 16px;
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-error));
}

/* Modifier.animateItem(): the item fades and slides into place when the list is reordered by
   the sort comparator or when a source switches from loading to a result. */
.msi-enter-active {
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}

.msi-leave-active {
  transition: opacity 150ms ease-in, transform 150ms ease-in;
  position: absolute;
}

.msi-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.msi-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.msi-move {
  transition: transform 200ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .msi-enter-active,
  .msi-leave-active,
  .msi-move {
    transition: none;
  }
}

/* MD3 AlertDialog: container shape CornerExtraLarge (28dp), color surfaceContainerHigh,
   container elevation level 3, container padding 24dp, title headlineSmall (24/32),
   text bodyMedium (14/20), buttons labelLarge (14/500) in primary. */
.migrate-dialog {
  box-sizing: border-box;
  width: fit-content;
  min-width: 280px;
  max-width: 560px;
  margin: 0 auto;
  padding: 24px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px 0 rgba(0, 0, 0, 0.3);
}

.migrate-dialog-title {
  margin: 0;
  padding-bottom: 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  text-align: start;
}

.migrate-dialog-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface-variant));
}

.migrate-dialog-error {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  color: rgb(var(--v-theme-error));
}

/* LabeledCheckbox: Row(clip(small = 8dp), fillMaxWidth, heightIn(min = 48dp), spacedBy(small = 8dp)). */
.migrate-flags {
  display: flex;
  flex-direction: column;
  /* The reference wraps the flags into a `Column(Modifier.verticalScroll(...))`. */
  max-height: 320px;
  overflow-y: auto;
}

.migrate-flag {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 8px;
  border-radius: 8px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

:deep(.migrate-dialog-overlay) {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}

.migrate-flag:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

/* MD3 Checkbox: the box is centred in its 24dp footprint (2dp padding on every side). */
.migrate-checkbox-wrap {
  position: relative;
  flex: none;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
}

.migrate-checkbox-input {
  position: absolute;
  inset: 0;
  width: 24px;
  height: 24px;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

/* Checkbox: 20dp box, 2dp corner radius, 2dp outline in on-surface-variant. */
.migrate-checkbox {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
  border-radius: 2px;
  background: transparent;
  color: rgb(var(--v-theme-on-primary));
}

.migrate-checkbox--checked {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgb(var(--v-theme-primary));
}

/* The check mark of the checkbox: (4,10) -> (8,14) -> (16,6), 2dp stroke, square caps. */
.migrate-checkbox-mark {
  width: 20px;
  height: 20px;
  overflow: visible;
  opacity: 0;
}

.migrate-checkbox-mark polyline {
  fill: none;
  stroke: rgb(var(--v-theme-on-primary));
  stroke-width: 2;
  stroke-linecap: square;
  stroke-linejoin: miter;
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  transition: stroke-dashoffset 0.2s ease-out;
}

.migrate-checkbox--checked .migrate-checkbox-mark {
  opacity: 1;
}

.migrate-checkbox--checked .migrate-checkbox-mark polyline {
  stroke-dashoffset: 0;
}

.migrate-checkbox-input:focus-visible + .migrate-checkbox {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* The label of LabeledCheckbox inherits the bodyMedium style of the dialog text slot. */
.migrate-flag-label {
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* MD3 TextButton: height 40dp, min width 58dp, content padding 12dp horizontal,
   shape CornerFull (20dp), label labelLarge (14sp/20sp, w500) in primary. */
.migrate-dialog-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.migrate-actions-spacer {
  flex: 1 1 auto;
}

.migrate-text-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  height: 40px;
  padding: 0 12px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: 0.1px;
  text-transform: none;
  cursor: pointer;
}

.migrate-text-button:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent);
}

.migrate-text-button:active {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 10%, transparent);
}

.migrate-text-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* LoadingScreen: the background of the screen at 70% alpha with a centred progress.
   The overlay sits above the dialog scrim of the MD3 AlertDialog. */
.migrate-loading {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, rgb(var(--v-theme-background)) 70%, transparent);
}
</style>
