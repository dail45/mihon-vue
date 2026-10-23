<script setup lang="ts">
/**
 * Statistics screen — pixel parity target:
 *   mihon/app/src/main/java/eu/kanade/presentation/more/stats/StatsScreenContent.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/stats/components/StatsItem.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/stats/data/StatsData.kt
 *   mihon/app/src/main/java/eu/kanade/tachiyomi/ui/stats/StatsScreen.kt
 *   mihon/app/src/main/java/eu/kanade/tachiyomi/ui/stats/StatsViewModel.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/SectionCard.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/material/Constants.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/screens/LoadingScreen.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/screens/EmptyScreen.kt
 *
 * M3 metrics & specs:
 *  - Scaffold:
 *    * TopAppBar: height 64dp, surface container color (0dp elevation in rest state),
 *      scrolled state adds surfaceContainer elevation tint.
 *    * Navigation up button: 48x48dp interactive touch target, 40dp round state layer (r=20dp),
 *      24dp arrow_back icon (opsz 24, wght 400).
 *    * Title: "Statistics" (MR.strings.label_stats), titleLarge (22sp / 28sp w400 onSurface), single line.
 *  - LazyColumn:
 *    * Content width: max-width 760px centered, 8dp vertical arrangement between items.
 *  - SectionCard (SectionCard.kt):
 *    * Title text: horizontal padding 32dp (MaterialTheme.padding.extraLarge),
 *      style titleSmall (14sp / 20sp w500 onSurface).
 *    * ElevatedCard: horizontal padding 16dp (padding.medium), vertical padding 8dp (padding.small),
 *      shape CornerExtraLarge (28dp), surfaceContainerLow container, Level 1 shadow elevation.
 *    * Column content padding: 16dp (padding.medium).
 *  - StatsOverviewItem (StatsItem.kt):
 *    * Row has height(IntrinsicSize.Min), items have weight(1f).fillMaxHeight().
 *    * Spacing between title, subtitle and spacer: 8dp (padding.small).
 *    * Title: titleLarge (22sp / 28sp w700 bold onSurface).
 *    * Subtitle: bodyMedium (14sp / 20sp w400 onSurface with SECONDARY_ALPHA = 0.78).
 *    * Spacer: weight(1f) pushing icon to bottom.
 *    * Icon: 24x24dp primary color (CollectionsBookmark, Schedule, LocalLibrary).
 *  - StatsItem (StatsItem.kt):
 *    * Items have weight(1f), vertical arrangement spacedBy(8dp).
 *    * Title: bodyMedium (14sp / 20sp w700 bold onSurface).
 *    * Subtitle: labelSmall (11sp / 16sp w500 ls 0.5px onSurface with SECONDARY_ALPHA = 0.78).
 *
 * Platform adaptations (AGENTS.md):
 *  - Production code remains a headless REST/GraphQL client to Suwayomi-Server.
 *  - Suwayomi Server does not keep fine-grained reading duration in seconds, so Read duration
 *    falls back to the exact same "None" placeholder (MR.strings.none) Mihon shows for an empty duration.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSuwayomiStore } from '../stores/suwayomi'
import { readTrackerStats, type TrackerStats, type UpdateRestrictions } from '../api/stats'
import type { Manga } from '../api/types'
import { formatDuration, formatMeanScore } from '../utils/statsFormatters'
import MihonEmptyScreen from '../components/MihonEmptyScreen.vue'
import Md3CircularProgress from '../components/Md3CircularProgress.vue'

export interface OverviewStats {
  libraryMangaCount: number
  totalReadDuration: number
  completedMangaCount: number
}

export interface TitleStats {
  globalUpdateItemCount: number
  startedMangaCount: number
  localMangaCount: number
}

export interface ChapterStats {
  totalChapterCount: number
  readChapterCount: number
  downloadCount: number
}

export interface TrackerStatsData {
  trackedTitleCount: number
  meanScore: number | null
  trackerCount: number
}

const router = useRouter()
const server = useSuwayomiStore()

const loading = ref(true)
const error = ref<string | null>(null)
const isScrolled = ref(false)

const trackerData = ref<TrackerStats>({
  loggedInTrackerCount: 0,
  trackedTitleCount: 0,
  meanScore: null,
})

const restrictions = ref<UpdateRestrictions>({
  excludeCompleted: false,
  excludeEntryWithUnreadChapters: false,
  excludeNotStarted: false,
})

function onWindowScroll() {
  isScrolled.value = window.scrollY > 0
}

/**
 * Distinct library manga list (`StatsViewModel.kt: distinctLibraryManga`).
 */
const distinctLibraryManga = computed<Manga[]>(() => {
  const map = new Map<number, Manga>()
  for (const list of Object.values(server.libraryByCategory)) {
    for (const manga of list) {
      if (!map.has(manga.id)) {
        map.set(manga.id, manga)
      }
    }
  }
  return [...map.values()]
})

const isEmpty = computed(() => !loading.value && !error.value && distinctLibraryManga.value.length === 0)

const overview = computed<OverviewStats>(() => {
  const list = distinctLibraryManga.value
  return {
    libraryMangaCount: list.length,
    completedMangaCount: list.filter(m => m.status === 'COMPLETED' && (m.unreadCount ?? 0) === 0).length,
    totalReadDuration: 0,
  }
})

const titles = computed<TitleStats>(() => {
  const list = distinctLibraryManga.value

  const mangaCategoryIds = new Map<number, Set<number>>()
  for (const [catIdStr, mangaList] of Object.entries(server.libraryByCategory)) {
    const catId = Number(catIdStr)
    for (const m of mangaList) {
      let set = mangaCategoryIds.get(m.id)
      if (!set) {
        set = new Set()
        mangaCategoryIds.set(m.id, set)
      }
      set.add(catId)
    }
  }

  const explicitlyIncluded = server.categories.filter(c => c.includeInUpdate === 1).map(c => c.id)
  const explicitlyExcluded = new Set(server.categories.filter(c => c.includeInUpdate === -1).map(c => c.id))

  const globalUpdateCount = list.filter(m => {
    const cats = mangaCategoryIds.get(m.id) ?? new Set()
    const isExcluded = [...cats].some(id => explicitlyExcluded.has(id))
    const isIncluded = explicitlyIncluded.length === 0 || [...cats].some(id => explicitlyIncluded.includes(id))
    if (!isIncluded || isExcluded) return false

    const hasStarted = (m.chapterCount ?? 0) > 0 && (
      (m.lastReadAt ?? 0) > 0 ||
      (m.chapterCount ?? 0) - (m.unreadCount ?? 0) > 0 ||
      m.lastChapterRead !== null
    )

    if (restrictions.value.excludeCompleted && m.status === 'COMPLETED') return false
    if (restrictions.value.excludeEntryWithUnreadChapters && (m.unreadCount ?? 0) !== 0) return false
    if (restrictions.value.excludeNotStarted && (m.chapterCount ?? 0) > 0 && !hasStarted) return false

    return true
  }).length

  const startedCount = list.filter(m => {
    return (m.chapterCount ?? 0) > 0 && (
      (m.lastReadAt ?? 0) > 0 ||
      (m.chapterCount ?? 0) - (m.unreadCount ?? 0) > 0 ||
      m.lastChapterRead !== null
    )
  }).length

  const localCount = list.filter(m => m.sourceId === '0' || m.source?.id === '0').length

  return {
    globalUpdateItemCount: globalUpdateCount,
    startedMangaCount: startedCount,
    localMangaCount: localCount,
  }
})

const chapters = computed<ChapterStats>(() => {
  const list = distinctLibraryManga.value
  let total = 0
  let read = 0
  let download = 0

  for (const m of list) {
    const count = m.chapterCount ?? 0
    const unread = m.unreadCount ?? 0
    total += count
    read += Math.max(0, count - unread)
    download += m.downloadCount ?? 0
  }

  return {
    totalChapterCount: total,
    readChapterCount: read,
    downloadCount: download,
  }
})

const trackers = computed<TrackerStatsData>(() => {
  return {
    trackedTitleCount: trackerData.value.trackedTitleCount,
    meanScore: trackerData.value.meanScore,
    trackerCount: trackerData.value.loggedInTrackerCount,
  }
})

async function loadStats() {
  loading.value = true
  error.value = null
  try {
    if (!server.connected || Object.keys(server.libraryByCategory).length === 0) {
      await server.loadLibrary()
    }
    const mangaIds = distinctLibraryManga.value.map(m => m.id)
    if (mangaIds.length > 0) {
      try {
        const stats = await readTrackerStats(server.apiUrl, mangaIds)
        trackerData.value = stats.trackers
        restrictions.value = stats.restrictions
      } catch {
        trackerData.value = {
          loggedInTrackerCount: 0,
          trackedTitleCount: 0,
          meanScore: null,
        }
        restrictions.value = {
          excludeCompleted: false,
          excludeEntryWithUnreadChapters: false,
          excludeNotStarted: false,
        }
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

function goBack() {
  if (typeof window.history.state?.back === 'string') {
    router.back()
    return
  }
  void router.push('/more')
}

onMounted(() => {
  document.body.classList.add('stats-screen-active')
  window.addEventListener('scroll', onWindowScroll, { passive: true })
  onWindowScroll()
  void loadStats()
})

onBeforeUnmount(() => {
  document.body.classList.remove('stats-screen-active')
  window.removeEventListener('scroll', onWindowScroll)
})
</script>

<template>
  <div class="stats-screen">
    <!-- TopAppBar (AppBar.kt): height 64dp, surface container, up navigation icon, title Statistics. -->
    <header class="stats-toolbar" :class="{ 'is-scrolled': isScrolled }">
      <button
        type="button"
        class="stats-nav-btn"
        aria-label="Navigate up"
        title="Navigate up"
        @click="goBack"
      >
        <span class="material-symbols-rounded stats-nav-icon" aria-hidden="true">arrow_back</span>
      </button>
      <h1 class="stats-toolbar-title">Statistics</h1>
    </header>

    <!-- LoadingScreen (LoadingScreen.kt): centered M3 CircularProgressIndicator (40dp, stroke 4dp). -->
    <div v-if="loading" class="stats-loading" role="status" aria-label="Loading statistics">
      <Md3CircularProgress />
    </div>

    <!-- Error state: EmptyScreen with error message. -->
    <MihonEmptyScreen
      v-else-if="error"
      class="stats-empty"
      :message="error"
    />

    <!-- Empty library: EmptyScreen with "Your library is empty" (MR.strings.information_empty_library). -->
    <MihonEmptyScreen
      v-else-if="isEmpty"
      class="stats-empty"
      message="Your library is empty"
    />

    <!-- StatsScreenContent (StatsScreenContent.kt): LazyColumn with spacedBy(8dp). -->
    <div v-else class="stats-content">
      <!-- Section 1: Overview (MR.strings.label_overview_section) -->
      <section class="stats-section" aria-labelledby="section-overview">
        <h2 id="section-overview" class="stats-section-title">Overview</h2>
        <div class="stats-card">
          <div class="stats-row stats-row--overview">
            <div class="stats-overview-item">
              <span class="stats-overview-title">{{ overview.libraryMangaCount }}</span>
              <span class="stats-overview-subtitle">In library</span>
              <div class="stats-spacer" aria-hidden="true" />
              <span class="material-symbols-rounded stats-overview-icon" aria-hidden="true">collections_bookmark</span>
            </div>
            <div class="stats-overview-item">
              <span class="stats-overview-title">{{ formatDuration(overview.totalReadDuration) }}</span>
              <span class="stats-overview-subtitle">Read duration</span>
              <div class="stats-spacer" aria-hidden="true" />
              <span class="material-symbols-rounded stats-overview-icon" aria-hidden="true">schedule</span>
            </div>
            <div class="stats-overview-item">
              <span class="stats-overview-title">{{ overview.completedMangaCount }}</span>
              <span class="stats-overview-subtitle">Completed entries</span>
              <div class="stats-spacer" aria-hidden="true" />
              <span class="material-symbols-rounded stats-overview-icon" aria-hidden="true">local_library</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 2: Entries (MR.strings.label_titles_section) -->
      <section class="stats-section" aria-labelledby="section-entries">
        <h2 id="section-entries" class="stats-section-title">Entries</h2>
        <div class="stats-card">
          <div class="stats-row">
            <div class="stats-item">
              <span class="stats-item-title">{{ titles.globalUpdateItemCount }}</span>
              <span class="stats-item-subtitle">In global update</span>
            </div>
            <div class="stats-item">
              <span class="stats-item-title">{{ titles.startedMangaCount }}</span>
              <span class="stats-item-subtitle">Started</span>
            </div>
            <div class="stats-item">
              <span class="stats-item-title">{{ titles.localMangaCount }}</span>
              <span class="stats-item-subtitle">Local</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3: Chapters (MR.strings.chapters) -->
      <section class="stats-section" aria-labelledby="section-chapters">
        <h2 id="section-chapters" class="stats-section-title">Chapters</h2>
        <div class="stats-card">
          <div class="stats-row">
            <div class="stats-item">
              <span class="stats-item-title">{{ chapters.totalChapterCount }}</span>
              <span class="stats-item-subtitle">Total</span>
            </div>
            <div class="stats-item">
              <span class="stats-item-title">{{ chapters.readChapterCount }}</span>
              <span class="stats-item-subtitle">Read</span>
            </div>
            <div class="stats-item">
              <span class="stats-item-title">{{ chapters.downloadCount }}</span>
              <span class="stats-item-subtitle">Downloaded</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 4: Trackers (MR.strings.label_tracker_section) -->
      <section class="stats-section" aria-labelledby="section-trackers">
        <h2 id="section-trackers" class="stats-section-title">Trackers</h2>
        <div class="stats-card">
          <div class="stats-row">
            <div class="stats-item">
              <span class="stats-item-title">{{ trackers.trackedTitleCount }}</span>
              <span class="stats-item-subtitle">Tracked entries</span>
            </div>
            <div class="stats-item">
              <span class="stats-item-title">{{ formatMeanScore(trackers.trackedTitleCount, trackers.meanScore) }}</span>
              <span class="stats-item-subtitle">Mean score</span>
            </div>
            <div class="stats-item">
              <span class="stats-item-title">{{ trackers.trackerCount }}</span>
              <span class="stats-item-subtitle">Used</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style>
/* When StatsView owns the top bar, hide shell bar and reset main top padding. */
body.stats-screen-active .app-toolbar { display: none; }
body.stats-screen-active .v-main { padding-top: 0; }
</style>

<style scoped>
@layer app-components {
.stats-screen {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

/* AppBar.kt / TopAppBarDefaults.SmallTopAppBarHeight: 64dp, surface container color. */
.stats-toolbar {
  position: sticky;
  top: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 4px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.stats-toolbar.is-scrolled {
  background: rgb(var(--v-theme-surface-container));
}

/* Material3 TopAppBar navigation icon slot: 48dp container (40dp state layer), 24dp icon. */
.stats-nav-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 24px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.stats-nav-btn::before {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 20px;
  background: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}

@media (hover: hover) {
  .stats-nav-btn:hover::before {
    opacity: 0.08;
  }
}

.stats-nav-btn:active::before {
  opacity: 0.12;
}

.stats-nav-btn:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.stats-nav-icon {
  font-size: 24px;
  line-height: 24px;
  width: 24px;
  height: 24px;
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* TopAppBar title: titleLarge (22sp / 28sp w400 Regular onSurface), single line with ellipsis. */
.stats-toolbar-title {
  margin: 0;
  padding: 0 4px;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* LoadingScreen.kt: Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) */
.stats-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  min-height: calc(100vh - 64px);
}

.stats-empty {
  flex: 1 1 auto;
  min-height: calc(100vh - 64px);
}

/* LazyColumn: spacedBy(8dp), max-width 760px centered. */
.stats-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 8px 0 24px;
  box-sizing: border-box;
}

.stats-section {
  display: flex;
  flex-direction: column;
  width: 100%;
}

/* SectionCard.kt: titleRes padding(horizontal = MaterialTheme.padding.extraLarge = 32dp), titleSmall. */
.stats-section-title {
  margin: 0;
  padding: 0 32px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  color: rgb(var(--v-theme-on-surface));
}

/*
 * SectionCard.kt ElevatedCard:
 *   modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)
 *   shape = MaterialTheme.shapes.extraLarge (CornerExtraLarge = 28dp)
 *   ElevatedCard background = surfaceContainerLow, Level 1 shadow elevation
 *   Column padding = 16.dp (MaterialTheme.padding.medium)
 */
.stats-card {
  margin: 8px 16px;
  padding: 16px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-low));
  box-shadow: 0 1px 3px 1px rgba(0, 0, 0, 0.15), 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  box-sizing: border-box;
}

/* Row: horizontal alignment of 3 stats items */
.stats-row {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  width: 100%;
}

/* Overview section: Row(modifier = Modifier.height(IntrinsicSize.Min)) */
.stats-row--overview {
  min-height: 96px;
}

/*
 * BaseStatsItem / StatsOverviewItem:
 *   Column(modifier = Modifier.weight(1f).fillMaxHeight(),
 *          verticalArrangement = Arrangement.spacedBy(8.dp),
 *          horizontalAlignment = Alignment.CenterHorizontally)
 */
.stats-overview-item {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  text-align: center;
  gap: 8px;
}

/* titleLarge (22sp / 28sp), bold (FontWeight.Bold = 700), single line with ellipsis. */
.stats-overview-title {
  font-size: 22px;
  line-height: 28px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

/* bodyMedium (14sp / 20sp w400), color onSurface with SECONDARY_ALPHA (0.78). */
.stats-overview-subtitle {
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  color: rgba(var(--v-theme-on-surface), 0.78);
  text-align: center;
}

/* Spacer(modifier = Modifier.weight(1f)) */
.stats-spacer {
  flex-grow: 1;
  min-height: 8px;
}

/* Icon: 24dp, tint primary */
.stats-overview-icon {
  font-size: 24px;
  line-height: 24px;
  width: 24px;
  height: 24px;
  color: rgb(var(--v-theme-primary));
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/*
 * StatsItem (Entries, Chapters, Trackers):
 *   Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp))
 */
.stats-item {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  text-align: center;
  gap: 8px;
}

/* bodyMedium (14sp / 20sp), bold (FontWeight.Bold = 700), single line with ellipsis. */
.stats-item-title {
  font-size: 14px;
  line-height: 20px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

/* labelSmall (11sp / 16sp w500, letterSpacing 0.5px), onSurface with SECONDARY_ALPHA (0.78). */
.stats-item-subtitle {
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: 0.5px;
  color: rgba(var(--v-theme-on-surface), 0.78);
  text-align: center;
}
}
</style>
