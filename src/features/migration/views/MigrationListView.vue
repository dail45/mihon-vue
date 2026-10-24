<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { apiErrorMessage, createSuwayomiApi } from '@/core/api/client'
import type { Manga, Source } from '@/core/api/types'
import MigrateMangaDialog from '../components/MigrateMangaDialog.vue'
import MigrationExitDialog from '../components/MigrationExitDialog.vue'
import MigrationProgressDialog from '../components/MigrationProgressDialog.vue'
import { readPreference } from '@/features/settings/stores/preferences'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { readMigrationSources } from '@/core/utils/migrationSources'
import { pinnedSourceIds } from '@/core/utils/sourcePins'
import { useMigrationOrchestrator, flagsFromBitmask } from '../composables/useMigrationOrchestrator'

/**
 * Reference: mihon/app/src/main/java/mihon/feature/migration/list/MigrationListScreen.kt
 * and MigrationListScreenContent.kt (revision 446f6df8).
 *
 * Layout (MigrationListScreenContent.kt):
 *  - Scaffold + AppBar: title = "Migration" or "Migration (finished/total)"; two actions,
 *    Copy (content_copy / copy_all) and Migrate (check / done_all), both enabled only when
 *    `migrationComplete` (every item finished and at least one match found). No up button.
 *  - FastScrollLazyColumn with contentPadding = contentPadding + topSmallPaddingValues (8dp top).
 *  - One row per entry: [entry item] [arrow_forward] [result] [action],
 *    weights 1 / 0.2 / 1 / 0.2, row padding start 16dp end 8dp, SpaceBetween, CenterVertically.
 *  - MigrationListItem: Column (widthIn max 150dp, clipped to shapes.small = 8dp, padding 4dp)
 *    with the cover (aspect 2/3, shapes.extraSmall = 4dp), the gradient overlay (bottom 40%),
 *    the title (labelMedium, 2 lines, 8dp padding), the chapter count badge (top start, 4dp),
 *    then the source name (titleSmall) and "Latest: x" (bodyMedium) in a 4dp padded column.
 *  - MigrationListItemResult: searching = centered CircularProgressIndicator in a 2/3 box,
 *    notFound = cover_error image + "No alternatives found", success = the same item layout.
 *  - MigrationListItemAction: searching = close button, otherwise more_vert + dropdown
 *    (Search manually / Don't migrate / Migrate now / Copy now) at DpOffset(8dp, -56dp).
 *
 * MigrationListScreen.kt: the back gesture opens MigrationExitDialog ("Stop migrating?"),
 * the item click opens the manga screen, "Search manually" pushes MigrateSearchScreen.
 *
 * Suwayomi-Server has no migration (copy/move) endpoint, so the migrate/copy actions are
 * honest stubs: the reference dialog opens and reports that the operation is not available
 * in the web version. The alternative-search half of the screen is real and uses the
 * documented GET /source/{id}/search endpoint with the reference similarity threshold.
 */

const server = useSuwayomiStore()
const route = useRoute()
const router = useRouter()

type ResultStatus = 'searching' | 'notFound' | 'success'
interface SearchResult {
  status: ResultStatus
  manga?: Manga
  sourceName?: string
  chapterCount?: number
  latestChapter?: number | null
  confidence?: string
  confidenceScore?: number
}
interface MigrationItem {
  manga: Manga
  sourceName: string
  chapterCount: number
  latestChapter: number | null
  result: SearchResult
}

const items = ref<MigrationItem[]>([])
const error = ref<string | null>(null)
const loading = ref(false)

/* Generation counter: every reload or an aborted run invalidates in-flight answers. */
let generation = 0

/* ------------------------------------------------------------------ helpers */

/** `SourcePreferences.enabledLanguages` (Mihon preference "source_languages"). */
const LANGUAGES_KEY = 'mihon.sourceLanguages'
const HIDE_UNMATCHED_KEY = 'mihon.migration.hideUnmatched'
const HIDE_WITHOUT_UPDATES_KEY = 'mihon.migration.hideWithoutUpdates'
const PRIORITIZE_BY_CHAPTERS_KEY = 'mihon.migration.prioritizeByChapters'

function readList(key: string): string[] {
  const raw = readPreference(key)
  if (!raw) return []
  const parsed: unknown = JSON.parse(raw)
  if (Array.isArray(parsed)) return parsed.filter((value): value is string => typeof value === 'string')
  return raw.split(',').map(part => part.trim()).filter(Boolean)
}

function readBool(key: string, fallback = false): boolean {
  const raw = readPreference(key)
  if (raw === null) return fallback
  return raw === 'true'
}

/**
 * Source.getNameForMangaInfo() (mihon/app/.../SourceExtensions.kt:10): the language tag is
 * hidden only when exactly one language is enabled and the source belongs to it.
 */
function sourceLabel(source: Source | null | undefined, sourceId: string): string {
  const resolved = source || server.sources.find(item => item.id === sourceId)
  if (!resolved) return 'Unknown source'
  const enabledLanguages = readList(LANGUAGES_KEY).filter(lang => lang !== 'all' && lang !== 'other')
  const lang = resolved.lang && resolved.lang !== 'localsourcelang' ? resolved.lang.toUpperCase() : 'OTHER'
  const hasOneActiveLanguage = enabledLanguages.length === 1
  if (hasOneActiveLanguage && enabledLanguages.includes(resolved.lang)) return resolved.name
  return `${resolved.name} (${lang})`
}

/** ChapterNumberFormatter.formatChapterNumber: DecimalFormat("#.###"). */
function formatChapterNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return String(Number(value.toFixed(3)))
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost)
    }
    previous = current
  }
  return previous[b.length]
}

/** NormalizedLevenshtein.similarity(): 1 - distance / max(length). */
function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length)
  if (!max) return 1
  return 1 - levenshtein(a, b) / max
}

/** BaseSmartSearchEngine.MIN_ELIGIBLE_THRESHOLD. */
const MIN_ELIGIBLE_THRESHOLD = 0.4

async function chapterInfo(api: ReturnType<typeof createSuwayomiApi>, id: number) {
  try {
    const chapters = await api.chapters(id, false)
    let latest: number | null = null
    for (const chapter of chapters) {
      if (typeof chapter.chapterNumber === 'number' && (latest === null || chapter.chapterNumber > latest)) {
        latest = chapter.chapterNumber
      }
    }
    return { count: chapters.length, latest }
  } catch {
    return { count: 0, latest: null as number | null }
  }
}

function uniqueManga(list: Manga[]): Manga[] {
  const seen = new Set<number>()
  return list.filter(manga => {
    if (seen.has(manga.id)) return false
    seen.add(manga.id)
    return true
  })
}

function requestedIds(): number[] {
  const raw = route.query.ids
  const value = Array.isArray(raw) ? raw.join(',') : typeof raw === 'string' ? raw : ''
  return value.split(',').map(part => Number(part.trim())).filter(id => Number.isInteger(id) && id > 0)
}

/** MigrationListScreen(extraSearchQuery): extra keywords appended to the search query. */
function extraSearchQuery(): string {
  const raw = route.query.extraSearchQuery
  const value = Array.isArray(raw) ? raw.join(' ') : typeof raw === 'string' ? raw : ''
  return value.trim()
}

/* ------------------------------------------------------------------- search */

const api = computed(() => createSuwayomiApi(server.apiUrl))

/**
 * The sources the migration searches: `SourcePreferences.migrationSources` first, then the
 * pinned sources, then every installed source (MigrationConfigViewModel.initSources).
 */
function migrationSources(): Source[] {
  const stored = readMigrationSources()
  const pinned = pinnedSourceIds()
  const ids = stored.length ? stored : pinned.length ? pinned : server.sources.map(source => source.id)
  return server.sources.filter(source => ids.includes(source.id))
}

/**
 * BaseSmartSearchEngine.regularSearch against a single source: the best candidate of the
 * source is returned when its normalized Levenshtein similarity reaches 0.4. A lone candidate
 * is accepted outright (the reference scores it as 1.0).
 */
async function searchSource(manga: Manga, source: Source): Promise<{ candidate: Manga; score: number } | null> {
  const query = [manga.title, extraSearchQuery()].filter(Boolean).join(' ')
  let list: Manga[]
  try {
    const page = await api.value.sourceCatalogue(source.id, 'search', 1, query)
    list = page.mangaList || []
  } catch {
    return null
  }
  if (!list.length) return null
  const scored = list
    .filter(candidate => candidate.id > 0)
    .map(candidate => ({
      candidate,
      score: list.length === 1 ? 1 : similarity(manga.title, candidate.title),
    }))
    .filter(entry => entry.score >= MIN_ELIGIBLE_THRESHOLD)
  if (!scored.length) return null
  const best = scored.reduce((a, b) => {
    if (Math.abs(b.score - a.score) < 0.001) {
      return (b.candidate.chapterCount ?? 0) > (a.candidate.chapterCount ?? 0) ? b : a
    }
    return b.score > a.score ? b : a
  })
  /* The reference rejects the entry itself: the same url in the same source is not a match. */
  if (best.candidate.url && best.candidate.url === manga.url && source.id === manga.sourceId) return null
  return best
}

/**
 * MigrationListViewModel.runMigrations: without migrationPrioritizeByChapters the sources are
 * searched in order and the first source with a match wins; with the preference every source is
 * searched and the match with the highest latest chapter number wins.
 */
async function findAlternative(
  manga: Manga,
  prioritizeByChapters: boolean,
): Promise<{ manga: Manga; source: Source; score: number } | null> {
  const sources = migrationSources().filter(source => (
    source.id !== manga.sourceId
    && source.id !== '0'
    && source.lang !== 'localsourcelang'
  ))
  if (!prioritizeByChapters) {
    for (const source of sources) {
      const match = await searchSource(manga, source)
      if (match) return { manga: match.candidate, source, score: match.score }
    }
    return null
  }
  const matches: { manga: Manga; source: Source; score: number }[] = []
  for (const source of sources) {
    const match = await searchSource(manga, source)
    if (match) matches.push({ manga: match.candidate, source, score: match.score })
  }
  if (!matches.length) return null
  const infos = await Promise.all(matches.map(match => chapterInfo(api.value, match.manga.id)))
  let bestIndex = -1
  let bestLatest = 0
  matches.forEach((_match, index) => {
    const info = infos[index]!
    /* A match without chapters is not a usable target. */
    if (!info.count) return
    if (bestIndex === -1 || (info.latest ?? 0) > bestLatest) {
      bestIndex = index
      bestLatest = info.latest ?? 0
    }
  })
  if (bestIndex === -1) return null
  return matches[bestIndex]!
}

async function run(request: number) {
  const library = uniqueManga(Object.values(server.libraryByCategory).flat())
  const wanted = requestedIds()
  const selected = wanted.length ? library.filter(manga => wanted.includes(manga.id)) : library

  const hideUnmatched = readBool(HIDE_UNMATCHED_KEY)
  const hideWithoutUpdates = readBool(HIDE_WITHOUT_UPDATES_KEY)
  const prioritizeByChapters = readBool(PRIORITIZE_BY_CHAPTERS_KEY)

  items.value = selected.map(manga => ({
    manga,
    sourceName: sourceLabel(manga.source, manga.sourceId),
    chapterCount: manga.chapterCount ?? 0,
    latestChapter: null,
    result: { status: 'searching' },
  }))

  for (const item of items.value) {
    if (request !== generation) return
    const info = await chapterInfo(api.value, item.manga.id)
    if (request !== generation) return
    item.chapterCount = info.count
    item.latestChapter = info.latest
  }

  for (const item of items.value) {
    if (request !== generation) return
    const match = await findAlternative(item.manga, prioritizeByChapters)
    if (request !== generation) return
    if (!match) {
      item.result = { status: 'notFound' }
      /* migrationHideUnmatched: the entry leaves the list. */
      if (hideUnmatched) removeItem(item)
      continue
    }
    const info = await chapterInfo(api.value, match.manga.id)
    if (request !== generation) return
    const confidenceScore = Math.round((match.score ?? 1) * 100)
    item.result = {
      status: 'success',
      manga: match.manga,
      sourceName: sourceLabel(match.source, match.source.id),
      chapterCount: info.count,
      latestChapter: info.latest,
      confidence: `${confidenceScore}% match`,
      confidenceScore,
    }
    /* migrationHideWithoutUpdates: the target has no chapter beyond the current one. */
    if (hideWithoutUpdates && (info.latest ?? 0) <= (item.latestChapter ?? 0)) removeItem(item)
  }
}

/**
 * MigrationListScreen.kt:40-50: `LaunchedEffect(matchOverride)`
 * Applies a manual selection chosen from `MigrateSearchScreen`.
 */
async function useMangaForMigration(currentId: number, targetId: number) {
  const item = items.value.find(entry => entry.manga.id === currentId)
  if (!item) return
  item.result = { status: 'searching' }
  try {
    const targetManga = await api.value.manga(targetId)
    const info = await chapterInfo(api.value, targetId)
    if (info.count === 0) {
      item.result = { status: 'notFound' }
      notify('No chapters found, this entry cannot be used for migration')
      return
    }
    const source = server.sources.find(s => s.id === targetManga.sourceId)
    const matchScore = similarity(item.manga.title, targetManga.title)
    const confidenceScore = Math.round(matchScore * 100)
    item.result = {
      status: 'success',
      manga: targetManga,
      sourceName: sourceLabel(source, targetManga.sourceId),
      chapterCount: info.count,
      latestChapter: info.latest,
      confidence: `${confidenceScore}% match`,
      confidenceScore,
    }
  } catch {
    item.result = { status: 'notFound' }
    notify('No chapters found, this entry cannot be used for migration')
  }
}

async function load() {
  const request = ++generation
  error.value = null
  loading.value = true
  try {
    if (!server.sources.length) await server.loadSources()
    if (!Object.keys(server.libraryByCategory).length) await server.loadLibrary()
    if (request !== generation) return
    await run(request)
    if (request !== generation) return
    const matchCurrent = Number(route.query.matchCurrent)
    const matchTarget = Number(route.query.matchTarget)
    if (matchCurrent && matchTarget) {
      await useMangaForMigration(matchCurrent, matchTarget)
    }
    if (items.value.length === 0) {
      stopAndLeave()
    }
  } catch (reason) {
    if (request === generation) error.value = apiErrorMessage(reason)
  } finally {
    if (request === generation) loading.value = false
  }
}

watch(() => [server.apiUrl, route.query.ids, route.query.extraSearchQuery, route.query.matchCurrent, route.query.matchTarget], () => { void load() })
onMounted(() => { void load() })

/* ------------------------------------------------------------------- state */

/* MigrationListViewModel.State.finishedCount: entries whose search finished. */
const finishedCount = computed(() => items.value.filter(item => item.result.status !== 'searching').length)

/* MigrationListViewModel.migrationComplete: nothing searching and at least one match. */
const migrationComplete = computed(() => (
  items.value.length > 0
  && items.value.every(item => item.result.status !== 'searching')
  && items.value.some(item => item.result.status === 'success')
))

const title = computed(() => (items.value.length
  ? `Migration (${finishedCount.value}/${items.value.length})`
  : 'Migration'))

const copyIcon = computed(() => (items.value.length === 1 ? 'content_copy' : 'copy_all'))
const migrateIcon = computed(() => (items.value.length === 1 ? 'check' : 'done_all'))

/* --------------------------------------------------------------- app bar actions */

const orchestrator = useMigrationOrchestrator()
const FLAGS_KEY = 'mihon.migration.flags'
const FLAG = { CHAPTER: 0b00001, CATEGORY: 0b00010, CUSTOM_COVER: 0b01000, NOTES: 0b100000, REMOVE_DOWNLOAD: 0b10000 }
const DEFAULT_FLAGS = FLAG.CHAPTER | FLAG.CATEGORY | FLAG.CUSTOM_COVER | FLAG.NOTES | FLAG.REMOVE_DOWNLOAD

function getMigrationFlags() {
  const stored = readPreference(FLAGS_KEY)
  const bitmask = stored !== null && Number.isFinite(Number(stored)) ? Number(stored) : DEFAULT_FLAGS
  return flagsFromBitmask(bitmask)
}

const migrateDialogOpen = ref(false)
const migrateDialogCopy = ref(false)
const skippedCount = computed(() => items.value.filter(item => item.result.status === 'notFound').length)

const progressOpen = ref(false)

async function startBatchMigration() {
  const targets = items.value
    .filter(item => item.result.status === 'success' && item.result.manga)
    .map(item => ({ current: item.manga, target: item.result.manga! }))

  if (!targets.length) {
    notify('No items available to migrate')
    return
  }

  progressOpen.value = true
  const replace = !migrateDialogCopy.value
  const success = await orchestrator.migrate(targets, {
    replace,
    flags: getMigrationFlags(),
  })

  progressOpen.value = false
  if (success) {
    notify(`${replace ? 'Migrated' : 'Copied'} ${targets.length} entries successfully`)
    stopAndLeave()
  } else if (orchestrator.error.value) {
    notify(orchestrator.error.value)
  }
}

function cancelBatchMigration() {
  orchestrator.cancel()
  progressOpen.value = false
}

/* ------------------------------------------------------------------ actions */

function openManga(id: number) {
  void router.push(`/manga/${id}`)
}

const snackbar = ref('')
let snackbarTimer: number | undefined
function notify(message: string) {
  snackbar.value = message
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
  snackbarTimer = window.setTimeout(() => { snackbar.value = '' }, 6000)
}

/* Suwayomi-Server exposes no migration endpoint: the reference action reports the limitation. */
const UNSUPPORTED = 'Migration is not supported in the web version: the Suwayomi REST API has no endpoint that migrates or copies entries between sources.'
void UNSUPPORTED

/* Per entry "Migrate now" / "Copy now" (MigrationListViewModel.migrateNow). */
async function migrateNow(item: MigrationItem, replace: boolean) {
  if (item.result.status !== 'success' || !item.result.manga) return

  progressOpen.value = true
  const success = await orchestrator.migrate(
    [{ current: item.manga, target: item.result.manga }],
    { replace, flags: getMigrationFlags() },
  )

  progressOpen.value = false
  if (success) {
    notify(`${replace ? 'Migrated' : 'Copied'} "${item.manga.title}" successfully`)
    removeItem(item)
  } else if (orchestrator.error.value) {
    notify(orchestrator.error.value)
  }
}

/* "Don't migrate" (MigrationListViewModel.removeManga): the entry leaves the list. */
function removeItem(item: MigrationItem) {
  items.value = items.value.filter(entry => entry.manga.id !== item.manga.id)
  if (items.value.length === 0) {
    stopAndLeave()
  }
}
function skip(item: MigrationItem) {
  removeItem(item)
}

/* "Search manually" pushes MigrateSearchScreen(migrationItem.manga.id). */
const MIGRATE_SEARCH_PATH = '/migrate/manga/:mangaId'
function routeExists(path: string) {
  return router.getRoutes().some(route => route.path === path)
}
function searchManually(item: MigrationItem) {
  if (routeExists(MIGRATE_SEARCH_PATH)) {
    void router.push({
      path: MIGRATE_SEARCH_PATH.replace(':mangaId', encodeURIComponent(String(item.manga.id))),
      query: {
        fromList: 'true',
        returnIds: requestedIds().join(','),
        extraSearchQuery: extraSearchQuery() || undefined,
      },
    })
    return
  }
  notify(`Searching for a manual match of "${item.manga.title}" is not available in the web version.`)
}

/* ---------------------------------------------------------------- exit dialog */

/* BackHandler(true) { viewModel.showExitDialog() } */
const exitOpen = ref(false)
/* Set while the confirmed exit leaves the screen, so the guard does not fire twice. */
let leaving = false
function requestExit() {
  exitOpen.value = true
}
function stopAndLeave() {
  exitOpen.value = false
  leaving = true
  generation++
  void router.back()
}
onBeforeRouteLeave(to => {
  if (leaving) return true
  /* The reference intercepts every back gesture; pushing child detail screens keeps the list alive. */
  if (to.path.startsWith('/manga/') || to.path.startsWith('/migrate/manga/')) {
    return true
  }
  requestExit()
  return false
})
</script>

<template>
  <div class="migration-screen">
    <!-- AppBar: no up button, title + the two batch actions (enabled only when migrationComplete). -->
    <v-app-bar flat height="64" color="surface" class="migration-toolbar">
      <v-app-bar-title class="text-title-large font-weight-regular">{{ title }}</v-app-bar-title>
      <v-btn :icon="copyIcon" variant="text" color="on-surface" aria-label="Copy" :disabled="!migrationComplete" @click="migrateDialogCopy = true; migrateDialogOpen = true" />
      <v-btn :icon="migrateIcon" variant="text" color="on-surface" aria-label="Migrate" :disabled="!migrationComplete" @click="migrateDialogCopy = false; migrateDialogOpen = true" />
    </v-app-bar>

    <p v-if="error" class="migration-error" role="alert">{{ error }}</p>

    <!-- The reference shows no global progress bar: every row carries its own spinner. -->
    <div class="migration-list" :aria-busy="loading">
      <div v-for="item in items" :key="item.manga.id" class="migration-row">
        <!-- MigrationListItem: the entry that is about to be migrated. -->
        <div class="migration-slot">
          <button type="button" class="migration-item migration-item-button" :aria-label="item.manga.title" @click="openManga(item.manga.id)">
            <div class="migration-cover">
              <v-img :src="server.thumbnailUrl(item.manga.id)" :aspect-ratio="2 / 3" cover alt="" class="migration-cover-image" />
              <span class="migration-shade" />
              <span class="migration-cover-title">{{ item.manga.title }}</span>
              <span class="migration-badge-group"><span class="migration-badge">{{ item.chapterCount }}</span></span>
            </div>
            <div class="migration-item-text">
              <p class="migration-source">{{ item.sourceName }}</p>
              <p class="migration-latest">{{ item.latestChapter === null ? 'Latest: Unknown' : `Latest: ${formatChapterNumber(item.latestChapter)}` }}</p>
            </div>
          </button>
        </div>

        <span class="migration-arrow material-symbols-rounded" aria-hidden="true">arrow_forward</span>

        <!-- MigrationListItemResult -->
        <div class="migration-slot">
          <div v-if="item.result.status === 'searching'" class="migration-searching">
            <v-progress-circular indeterminate color="primary" size="40" width="4" />
          </div>
          <div v-else-if="item.result.status === 'notFound'" class="migration-not-found">
            <!-- R.drawable.cover_error: placeholder background (#1F888888) with the centered 24dp vector -->
            <div class="migration-cover migration-cover-empty">
              <svg class="migration-empty-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
                <path
                  fill="currentColor"
                  d="M21,5v6.59l-2.29,-2.3c-0.39,-0.39 -1.03,-0.39 -1.42,0L14,12.59 10.71,9.3c-0.39,-0.39 -1.02,-0.39 -1.41,0L6,12.59 3,9.58L3,5c0,-1.1 0.9,-2 2,-2h14c1.1,0 2,0.9 2,2zM18,11.42l3,3.01L21,19c0,1.1 -0.9,2 -2,2L5,21c-1.1,0 -2,-0.9 -2,-2v-6.58l2.29,2.29c0.39,0.39 1.02,0.39 1.41,0l3.3,-3.3 3.29,3.29c0.39,0.39 1.02,0.39 1.41,0l3.3,-3.28z"
                />
              </svg>
            </div>
            <p class="migration-not-found-text">No alternatives found</p>
          </div>
          <button v-else type="button" class="migration-item migration-item-button" :aria-label="item.result.manga?.title" @click="openManga(item.result.manga!.id)">
            <div class="migration-cover">
              <v-img :src="server.thumbnailUrl(item.result.manga!.id)" :aspect-ratio="2 / 3" cover alt="" class="migration-cover-image" />
              <span class="migration-shade" />
              <span class="migration-cover-title">{{ item.result.manga!.title }}</span>
              <span class="migration-badge-group">
                <span v-if="item.result.confidence" class="migration-confidence-badge">{{ item.result.confidence }}</span>
                <span class="migration-badge">{{ item.result.chapterCount ?? 0 }}</span>
              </span>
            </div>
            <div class="migration-item-text">
              <p class="migration-source">{{ item.result.sourceName }}</p>
              <p class="migration-latest">{{ item.result.latestChapter === null || item.result.latestChapter === undefined ? 'Latest: Unknown' : `Latest: ${formatChapterNumber(item.result.latestChapter)}` }}</p>
            </div>
          </button>
        </div>

        <!-- MigrationListItemAction -->
        <div class="migration-action">
          <v-btn v-if="item.result.status === 'searching'" icon="close" variant="text" aria-label="Don't migrate" @click="skip(item)" />
          <template v-else-if="items.length === 1 && item.result.status === 'success'">
            <v-btn
              icon="check"
              variant="text"
              color="primary"
              aria-label="Migrate"
              title="Migrate"
              @click="migrateNow(item, true)"
            />
            <v-menu location="bottom start" :offset="[8, -56]">
              <template #activator="{ props }">
                <v-btn v-bind="props" icon="more_vert" variant="text" aria-label="More options" />
              </template>
              <v-list class="migration-menu-list">
                <v-list-item class="migration-menu-item" title="Search manually" @click="searchManually(item)" />
                <v-list-item class="migration-menu-item" title="Don't migrate" @click="skip(item)" />
                <v-list-item class="migration-menu-item" title="Migrate now" @click="migrateNow(item, true)" />
                <v-list-item class="migration-menu-item" title="Copy now" @click="migrateNow(item, false)" />
              </v-list>
            </v-menu>
          </template>
          <v-menu v-else location="bottom start" :offset="[8, -56]">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon="more_vert" variant="text" aria-label="More options" />
            </template>
            <v-list class="migration-menu-list">
              <v-list-item class="migration-menu-item" title="Search manually" @click="searchManually(item)" />
              <v-list-item class="migration-menu-item" title="Don't migrate" @click="skip(item)" />
              <v-list-item v-if="item.result.status === 'success'" class="migration-menu-item" title="Migrate now" @click="migrateNow(item, true)" />
              <v-list-item v-if="item.result.status === 'success'" class="migration-menu-item" title="Copy now" @click="migrateNow(item, false)" />
            </v-list>
          </v-menu>
        </div>
      </div>
    </div>

    <!-- MigrationMangaDialog: confirm the batch migration / copy. The confirm action opens the
         progress dialog of the reference, which carries the honest limitation notice. -->
    <MigrateMangaDialog
      v-model="migrateDialogOpen"
      supported
      :copy="migrateDialogCopy"
      :total-count="items.length"
      :skipped-count="skippedCount"
      @migrate="startBatchMigration"
    />

    <!-- MigrationProgressDialog: active transactional progress reporting. -->
    <MigrationProgressDialog
      v-model="progressOpen"
      :progress="orchestrator.progress.value"
      :step-label="orchestrator.currentStep.value?.stepLabel"
      :current-manga-title="orchestrator.currentStep.value?.currentMangaTitle"
      @cancel="cancelBatchMigration"
    />

    <!-- MigrationExitDialog: the reference asks before leaving the migration. -->
    <MigrationExitDialog v-model="exitOpen" @exit="stopAndLeave" />

    <div v-if="snackbar" class="migration-snackbar" role="status" aria-live="polite">
      <span class="migration-snackbar-text">{{ snackbar }}</span>
      <v-btn variant="text" color="inverse-primary" class="migration-snackbar-action" @click="snackbar = ''">Dismiss</v-btn>
    </div>
  </div>
</template>

<style scoped>
@layer app-components {
.migration-screen { display: block; }

.migration-toolbar :deep(.v-toolbar__title) { font-size: 22px; font-weight: 400; }

/* IconButton disabled state uses DISABLED_ALPHA = .38. */
.migration-toolbar :deep(.v-btn--disabled) { opacity: .38; }

/* FastScrollLazyColumn contentPadding = contentPadding + topSmallPaddingValues (8dp top). */
.migration-list { padding-top: 8px; padding-bottom: 16px; }

/* Row: fillMaxWidth, padding start 16dp end 8dp, SpaceBetween, CenterVertically. */
.migration-row {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  box-sizing: border-box;
  width: 100%;
  padding-left: 16px;
  padding-right: 8px;
  animation: migration-item-in .18s ease-out;
}
@keyframes migration-item-in { from { opacity: 0; } to { opacity: 1; } }

/* weight(1f).align(Top).fillMaxHeight() */
.migration-slot { flex: 1 1 0; min-width: 0; align-self: flex-start; }

/* weight(0.2f) */
.migration-arrow {
  flex: 0.2 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  font-size: 24px;
  line-height: 1;
  color: rgb(var(--v-theme-on-surface));
}

/* MigrationListItem: Column, widthIn(max 150dp), clipped to shapes.small (8dp), padding 4dp. */
.migration-item {
  box-sizing: border-box;
  width: 100%;
  max-width: 150px;
  padding: 4px;
  border-radius: 8px;
}
.migration-item-button {
  display: block;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.migration-item-button:hover {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.migration-item-button:active {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.migration-item-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* Box: fillMaxWidth, aspectRatio(2f/3f); MangaCover.Book uses shapes.extraSmall (4dp). */
.migration-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 4px;
  overflow: hidden;
  background: #8888881f;
}
.migration-cover-image { width: 100%; height: 100%; }
/* R.drawable.cover_error: the placeholder colour #1F888888 fills the whole cover. */
.migration-cover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #8888881f;
  color: rgba(136, 136, 136, 0.4);
}
.migration-empty-icon {
  width: 24px;
  height: 24px;
}

/* Gradient overlay: bottom 40% of the cover, transparent to colorScheme.background. */
.migration-shade {
  position: absolute;
  inset: auto 0 0;
  height: 40%;
  background: linear-gradient(transparent, rgb(var(--v-theme-background)));
  pointer-events: none;
}

/* Title over the cover: labelMedium (12sp/16sp, Medium), 8dp padding, 2 lines. */
.migration-cover-title {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
}

/* BadgeGroup (clipped to shapes.extraSmall) + Badge (bodySmall Medium, 3dp/1dp padding). */
.migration-badge-group {
  position: absolute;
  top: 4px;
  left: 4px;
  display: inline-flex;
  align-items: flex-start;
  border-radius: 4px;
  overflow: hidden;
}
.migration-confidence-badge {
  display: inline-block;
  padding: 1px 4px;
  border-radius: 4px 0 0 4px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
}
.migration-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  padding: 1px 3px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: .4px;
  white-space: nowrap;
  background: rgb(var(--v-theme-secondary));
  color: rgb(var(--v-theme-on-secondary));
}

/* Column(padding 4dp) with spacedBy(2dp): source name (titleSmall) and "Latest: x" (bodyMedium). */
.migration-item-text { display: flex; flex-direction: column; gap: 2px; padding: 4px; }
.migration-source {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.migration-latest {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Searching: Box(widthIn max 150dp, aspect 2/3) with a centered CircularProgressIndicator. */
.migration-searching {
  display: grid;
  place-items: center;
  width: 100%;
  max-width: 150px;
  aspect-ratio: 2 / 3;
}

/* NotFound: Column(widthIn max 150dp, padding 4dp) with the error cover and the label. */
.migration-not-found { box-sizing: border-box; width: 100%; max-width: 150px; padding: 4px; }
.migration-not-found-text {
  margin: 0;
  padding: 4px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}

/* MigrationListItemAction: weight(0.2f); the Row is CenterVertically, so the action box is
   vertically centred inside the row. */
.migration-action {
  flex: 0.2 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
}
/* IconButton inside the list inherits LocalContentColor (the scaffold content colour). */
.migration-action :deep(.v-btn) { color: rgb(var(--v-theme-on-surface)); }

.migration-menu-list {
  background: rgb(var(--v-theme-surface-container)) !important;
  border-radius: 4px;
}
.migration-menu-item {
  min-height: 48px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: .25px;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
}
.migration-menu-item:hover {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.migration-error {
  margin: 0;
  padding: 16px;
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-error));
}

/* MD3 AlertDialog: surfaceContainerHigh, 28dp shape, 24dp padding, headlineSmall title. */
.migration-exit-dialog {
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
.migration-exit-title {
  margin: 0;
  padding-bottom: 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  text-align: start;
}
.migration-exit-text {
  margin: 0;
  padding-bottom: 24px;
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface-variant));
}
/* AlertDialogFlowRow renders the confirm button rightmost. */
.migration-exit-actions { display: flex; flex-direction: row-reverse; flex-wrap: wrap; justify-content: flex-start; gap: 8px; }
.migration-exit-button {
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
}
.migration-exit-button:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
.migration-exit-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* MD3 snackbar. */
.migration-snackbar {
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
.migration-snackbar-text { flex: 1 1 auto; }
}
</style>
