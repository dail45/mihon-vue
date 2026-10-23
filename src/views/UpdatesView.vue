<script setup lang="ts">
/**
 * Updates — the date-ordered feed of the recently fetched library chapters.
 *
 * Pixel-parity port of Mihon's `UpdateScreen`
 * (mihon/app/src/main/java/eu/kanade/presentation/updates/UpdatesScreen.kt, pinned commit
 * 446f6df82c390ab760802c2fce3b677bce3f31c1) together with `UpdatesUiItem.kt`,
 * `UpdatesViewModel.kt` and `AppBar.kt`.
 *
 * Reference structure:
 *   Scaffold(topBar = UpdatesAppBar, bottomBar = UpdatesBottomBar, snackbarHost = SnackbarHost)
 *     when (state.isLoading) LoadingScreen(Modifier.padding(contentPadding))
 *     else PullRefresh(refreshing, onRefresh, enabled = !state.selectionMode) {
 *       if (state.items.isEmpty())
 *         Column(contentPadding.fillMaxSize()) {
 *           UpdatesLastUpdatedHeader(lastUpdated)
 *           EmptyScreen(if (hasActiveFilters) error_no_match else information_no_recent, weight(1f))
 *         }
 *       else FastScrollLazyColumn(contentPadding) {
 *         updatesLastUpdatedItem(lastUpdated)
 *         updatesUiItems(state.getUiModel(), selectionMode, …)
 *       }
 *     }
 *
 * `UpdatesAppBar`: the title is `MR.strings.label_recent_updates` ("Updates") and the actions are
 * FilterList (tinted with `MaterialTheme.colorScheme.active` while filters are on), CalendarMonth
 * (`action_view_upcoming`) and Refresh (`action_update_library`). While the selection is active the
 * bar switches to the action mode of `AppBar.kt`: a Close icon, the number of selected items as
 * the title and the SelectAll / FlipToBack actions.
 *
 * `UpdatesLastUpdatedHeader` (UpdatesUiItem.kt:62-76): Box(padding(horizontal = 16dp,
 * vertical = 8dp)) { Text("Library last updated: %s", fontStyle = Italic) }.
 * `ListGroupHeader` (presentation-core/.../components/ListGroupHeader.kt): Text with 16dp
 * horizontal and 8dp vertical padding, onSurfaceVariant, SemiBold, bodyMedium.
 *
 * Deviations forced by the web platform, all of them visible in the UI:
 *  - "Update library" (the Refresh action and the pull-to-refresh gesture) has no Suwayomi REST
 *    equivalent (GET /update/recentChapters is a feed, not a mutation), so the action opens a
 *    dialog that explains the limitation instead of silently doing nothing.
 *  - The feed is loaded page by page (GET /update/recentChapters/{page}), so a "Load more"
 *    affordance replaces Mihon's single SQL query.
 *  - The search field of the app bar is an addition of this web client (Mihon's Updates screen
 *    has no search field); it filters the already loaded chapters only.
 */
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import { useSuwayomiStore } from '../stores/suwayomi'
import { useUpdatesStore } from '../stores/updates'
import UpdatesAppBar from '../components/UpdatesAppBar.vue'
import UpdatesLastUpdatedHeader from '../components/UpdatesLastUpdatedHeader.vue'
import MihonEmptyScreen from '../components/MihonEmptyScreen.vue'
import UpdatesItemRow from '../components/UpdatesItemRow.vue'
import UpdatesBottomBar from '../components/UpdatesBottomBar.vue'
import UpdatesFilterDialog from '../components/UpdatesFilterDialog.vue'
import UpdatesCalendarDialog from '../components/UpdatesCalendarDialog.vue'
import { deleteDownloadedChapter, dequeueChapterDownload, enqueueChapterDownload, startDownloader } from '../api/downloads'
import { localDateKey, relativeDateText, latestFetchedAt } from '../utils/dates'

const server = useSuwayomiStore()
const updates = useUpdatesStore()
const router = useRouter()
const theme = useTheme()

/** Mihon's `ColorScheme.active` = Color(255,193,7) in light, Color(255,235,59) in dark. */
const activeColor = computed(() => (theme.current.value.dark ? 'rgb(255, 235, 59)' : 'rgb(255, 193, 7)'))

/** The local search of the web client (Mihon's Updates screen has no search field). */
const query = ref('')

/* ------------------------------------------------------------------ *
 * Selection — `UpdatesViewModel.State.selected` / `selectionMode`
 * ------------------------------------------------------------------ */
const selectedPositions = ref<[number, number]>([-1, -1])
const selectedIds = ref<number[]>([])
const selectedEntries = computed(() =>
  updates.filteredEntries.filter(entry => selectedIds.value.includes(entry.chapter.id)),
)
const selectionMode = computed(() => selectedEntries.value.length > 0)

function toggleSelection(id: number, fromLongPress = false) {
  const items = updates.filteredEntries
  const selectedIndex = items.findIndex(e => e.chapter.id === id)
  if (selectedIndex < 0) return

  const currentSelection = new Set(selectedIds.value)
  const isSelected = currentSelection.has(id)
  const nextSelected = !isSelected

  const firstSelection = currentSelection.size === 0

  if (nextSelected) {
    currentSelection.add(id)
  } else {
    currentSelection.delete(id)
  }

  if (nextSelected && fromLongPress) {
    if (firstSelection) {
      selectedPositions.value = [selectedIndex, selectedIndex]
    } else {
      let start = -1
      let end = -1
      if (selectedIndex < selectedPositions.value[0]) {
        start = selectedIndex + 1
        end = selectedPositions.value[0] - 1
        selectedPositions.value[0] = selectedIndex
      } else if (selectedIndex > selectedPositions.value[1]) {
        start = selectedPositions.value[1] + 1
        end = selectedIndex - 1
        selectedPositions.value[1] = selectedIndex
      }
      if (start !== -1 && end >= start) {
        for (let i = start; i <= end; i++) {
          const item = items[i]
          if (item) currentSelection.add(item.chapter.id)
        }
      }
    }
  } else if (!fromLongPress) {
    if (!nextSelected) {
      if (selectedIndex === selectedPositions.value[0]) {
        selectedPositions.value[0] = items.findIndex(e => currentSelection.has(e.chapter.id))
      } else if (selectedIndex === selectedPositions.value[1]) {
        let last = -1
        for (let i = items.length - 1; i >= 0; i--) {
          if (currentSelection.has(items[i]!.chapter.id)) {
            last = i
            break
          }
        }
        selectedPositions.value[1] = last
      }
    } else {
      if (selectedIndex < selectedPositions.value[0] || selectedPositions.value[0] === -1) {
        selectedPositions.value[0] = selectedIndex
      }
      if (selectedIndex > selectedPositions.value[1]) {
        selectedPositions.value[1] = selectedIndex
      }
    }
  }

  selectedIds.value = Array.from(currentSelection)
}

/** `toggleAllSelection(true)` — selects every loaded chapter. */
function selectAll() {
  selectedIds.value = updates.filteredEntries.map(entry => entry.chapter.id)
  selectedPositions.value = [-1, -1]
}
/** `invertSelection()` — inverts the selection over the loaded chapters. */
function invertSelection() {
  const current = new Set(selectedIds.value)
  selectedIds.value = updates.filteredEntries
    .filter(entry => !current.has(entry.chapter.id))
    .map(entry => entry.chapter.id)
  selectedPositions.value = [-1, -1]
}
/** `onSelectAll(false)` — leaves the selection mode. */
function clearSelection() {
  selectedIds.value = []
  selectedPositions.value = [-1, -1]
}

/* ------------------------------------------------------------------ *
 * The feed
 * ------------------------------------------------------------------ */

/**
 * Mihon's `getUiModel()` inserts a `Header` before the first item of every local date;
 * `relativeDateText` renders the header the way `DateText.kt` does.
 */
const groups = computed(() => {
  const result: { key: string; label: string; entries: typeof updates.entries }[] = []
  for (const entry of updates.filteredEntries) {
    const date = new Date(entry.chapter.fetchedAt * 1000)
    const key = localDateKey(date)
    let group = result.find(item => item.key === key)
    if (!group) {
      group = { key, label: relativeDateText(date), entries: [] }
      result.push(group)
    }
    group.entries.push(entry)
  }
  return result
})

/** The chapters that survive the local search of the web client. */
const visibleGroups = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase()
  if (!needle) return groups.value
  return groups.value
    .map(group => ({
      ...group,
      entries: group.entries.filter(entry =>
        `${entry.manga.title} ${entry.chapter.name}`.toLocaleLowerCase().includes(needle)),
    }))
    .filter(group => group.entries.length)
})
/**
 * Mihon's `lastUpdated` (`libraryPreferences.lastUpdatedTimestamp`). Suwayomi exposes no
 * equivalent field, so the newest chapter fetch of the feed stands in for it; an empty feed
 * renders the reference's "Never" branch.
 *
 * The reference timestamp is a property of the library, not of the filtered list, so the
 * unfiltered feed is the source here — a filter must not change the header.
 */
const lastUpdatedTimestamp = computed(() =>
  latestFetchedAt(updates.entries.map(entry => entry.chapter.fetchedAt)),
)

/* ------------------------------------------------------------------ *
 * App bar actions
 * ------------------------------------------------------------------ */
const filterOpen = ref(false)
const calendarOpen = ref(false)
/** "Update library" has no Suwayomi REST equivalent; the dialog explains the limitation. */
const updateStubOpen = ref(false)

/* ------------------------------------------------------------------ *
 * Pull to refresh (the `PullRefresh` of the reference)
 * ------------------------------------------------------------------ */
const PULL_THRESHOLD = 72
let pullStart = 0
let pullDistance = 0
const pullOffset = ref(0)

function onTouchStart(event: TouchEvent) {
  if (selectionMode.value) return
  const container = event.currentTarget as HTMLElement
  if (container.scrollTop > 0) return
  pullStart = event.touches[0]?.clientY ?? 0
  pullDistance = 0
}
function onTouchMove(event: TouchEvent) {
  if (selectionMode.value || !pullStart) return
  const container = feedRef.value ?? (event.currentTarget as HTMLElement)
  if (container.scrollTop > 0) { pullStart = 0; pullDistance = 0; pullOffset.value = 0; return }
  const delta = (event.touches[0]?.clientY ?? 0) - pullStart
  if (delta <= 0) { pullDistance = 0; pullOffset.value = 0; return }
  pullDistance = Math.min(delta, PULL_THRESHOLD * 1.5)
  pullOffset.value = Math.min(pullDistance, PULL_THRESHOLD)
}
function onTouchEnd() {
  if (selectionMode.value || !pullStart) { pullStart = 0; return }
  const triggered = pullDistance >= PULL_THRESHOLD
  pullStart = 0
  pullDistance = 0
  pullOffset.value = 0
  if (triggered) runUpdateLibrary()
}

/**
 * The reference calls `onUpdateLibrary()` and shows the pull indicator for one second.
 * Suwayomi has no library-update endpoint, so the honest stub dialog opens instead.
 */
function runUpdateLibrary() {
  updateStubOpen.value = true
}

/* ------------------------------------------------------------------ *
 * FastScrollLazyColumn (VerticalFastScroller.kt)
 * ------------------------------------------------------------------ */
const feedRef = ref<HTMLElement | null>(null)
const handleVisible = ref(false)
const handleTop = ref(0)
let handleTimer: number | undefined
let dragStartY = 0
let dragStartScroll = 0
let dragging = false

function onFeedScroll() {
  const el = feedRef.value
  if (!el) return
  const scrollable = el.scrollHeight - el.clientHeight
  if (scrollable <= 0) {
    handleVisible.value = false
    return
  }
  const ratio = el.scrollTop / scrollable
  const trackHeight = el.clientHeight - 48
  handleTop.value = Math.min(Math.max(ratio, 0), 1) * trackHeight
  handleVisible.value = true
  if (handleTimer) window.clearTimeout(handleTimer)
  handleTimer = window.setTimeout(() => {
    if (!dragging) handleVisible.value = false
  }, 2000)
}

function onHandlePointerDown(event: PointerEvent) {
  const el = feedRef.value
  if (!el) return
  dragging = true
  dragStartY = event.clientY
  dragStartScroll = el.scrollTop
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onHandlePointerMove(event: PointerEvent) {
  const el = feedRef.value
  if (!el || !dragging) return
  const span = Math.max(1, el.clientHeight - 48)
  const scale = (el.scrollHeight - el.clientHeight) / span
  el.scrollTop = dragStartScroll + (event.clientY - dragStartY) * scale
}

function onHandlePointerUp(event: PointerEvent) {
  dragging = false
  ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
  if (handleTimer) window.clearTimeout(handleTimer)
  handleTimer = window.setTimeout(() => {
    handleVisible.value = false
  }, 2000)
}

/* ------------------------------------------------------------------ *
 * Row interactions
 * ------------------------------------------------------------------ */
function onRowOpen(entry: typeof updates.entries[number], event?: MouseEvent) {
  if (selectionMode.value) {
    const fromRange = event?.shiftKey ?? false
    toggleSelection(entry.chapter.id, fromRange)
    return
  }
  void router.push(`/manga/${entry.manga.id}/read/${entry.chapter.index}`)
}
function onRowLongPress(entry: typeof updates.entries[number]) {
  toggleSelection(entry.chapter.id, true)
}
function onRowManga(entry: typeof updates.entries[number]) {
  if (selectionMode.value) return
  void router.push(`/manga/${entry.manga.id}`)
}

/**
 * `ChapterDownloadIndicator` reports a `ChapterDownloadAction` (START / START_NOW / CANCEL /
 * DELETE). The download queue is reachable through the Suwayomi GraphQL API, so the actions
 * are performed against the server and the feed is refreshed afterwards.
 */
const snackbar = ref('')
let snackbarTimer: number | undefined
function showSnackbar(message: string) {
  snackbar.value = message
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
  snackbarTimer = window.setTimeout(() => { snackbar.value = '' }, 4000)
}
async function onDownloadAction(entry: { manga: { id: number }; chapter: { id: number; name: string } }, action: 'start' | 'start-now' | 'cancel' | 'delete') {
  const apiUrl = server.apiUrl
  try {
    if (action === 'start' || action === 'start-now') {
      await enqueueChapterDownload(apiUrl, entry.chapter.id)
      if (action === 'start-now') await startDownloader(apiUrl)
    } else if (action === 'cancel') {
      await dequeueChapterDownload(apiUrl, entry.chapter.id)
    } else if (action === 'delete') {
      await deleteDownloadedChapter(apiUrl, entry.chapter.id)
    }
    showSnackbar(action === 'start' || action === 'start-now' ? 'Chapter queued for download' : action === 'cancel' ? 'Download cancelled' : 'Chapter deleted')
    await updates.refresh(apiUrl)
  } catch (cause) {
    showSnackbar(cause instanceof Error ? cause.message : 'The server rejected the request.')
  }
}

/** The bulk actions of the bottom bar report the changed chapter state. */
function onBulkUpdate(changes: { id: number; read?: boolean; bookmarked?: boolean; downloaded?: boolean }[]) {
  updates.patch(changes)
}

/* ------------------------------------------------------------------ *
 * Lifecycle
 * ------------------------------------------------------------------ */
watch(() => server.apiUrl, () => {
  selectedIds.value = []
  void updates.refresh(server.apiUrl)
}, { immediate: true })

/** `BackHandler(enabled = state.selectionMode) { onSelectAll(false) }` — Escape leaves the mode. */
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && selectionMode.value) {
    event.preventDefault()
    clearSelection()
  }
}
window.addEventListener('keydown', onKeydown)
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
  updates.dispose()
})
</script>

<template>
  <section class="updates-screen">
    <!--
      The Scaffold of the reference: the content area fills the space that the app bar leaves
      (`v-main` already reserves the app bar height), and the feed column scrolls inside it.
    -->
    <!--
      UpdatesScreen.kt:169-213 + AppBar.kt:67-164: the app bar shows the title "Updates" with
      the FilterList / CalendarMonth / Refresh actions, and switches to the action mode (a Close
      icon, the selection counter as the title and the SelectAll / FlipToBack actions) while the
      selection is active. The action-mode container is `surfaceColorAtElevation(3.dp)`.
    -->
    <UpdatesAppBar
      :selected-count="selectedEntries.length"
      :has-filters="updates.hasActiveFilters"
      :active-color="activeColor"
      :loading="updates.loading"
      :search-query="query || null"
      @update:search-query="query = $event ?? ''"
      @filter="filterOpen = true"
      @calendar="router.push('/upcoming')"
      @update-library="runUpdateLibrary"
      @select-all="selectAll"
      @invert-selection="invertSelection"
      @cancel-selection="clearSelection"
    />

    <!-- LoadingScreen(Modifier.padding(contentPadding)) -->
    <div v-if="updates.loading && !updates.entries.length" class="updates-loading" aria-label="Loading updates">
      <v-progress-circular indeterminate color="primary" size="48" width="4" />
    </div>

    <!-- The empty branch of the reference: the last-updated header and the EmptyScreen. -->
    <div v-else-if="!visibleGroups.length" class="updates-empty">
      <UpdatesLastUpdatedHeader :last-updated="lastUpdatedTimestamp" />
      <MihonEmptyScreen
        class="updates-empty-screen"
        :message="updates.hasActiveFilters || query ? 'No match found' : 'No recent updates'"
      >
        <v-btn
          v-if="query"
          variant="text"
          color="primary"
          class="updates-empty-button"
          @click="query = ''"
        >Clear filters</v-btn>
      </MihonEmptyScreen>
    </div>

    <!-- FastScrollLazyColumn(contentPadding) -->
    <div
      v-else
      ref="feedRef"
      class="updates-feed"
      @scroll.passive="onFeedScroll"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend.passive="onTouchEnd"
      @touchcancel.passive="onTouchEnd"
    >
      <!-- Floating pull indicator matching Compose PullRefreshIndicator -->
      <div
        v-if="pullOffset"
        class="updates-pull-indicator"
        :style="{ transform: `translate(-50%, ${pullOffset}px)` }"
        aria-hidden="true"
      >
        <v-progress-circular indeterminate color="primary" size="24" width="2.5" />
      </div>

      <!-- updatesLastUpdatedItem(lastUpdated) of UpdatesUiItem.kt:51-60 -->
      <UpdatesLastUpdatedHeader :last-updated="lastUpdatedTimestamp" />

      <template v-for="group in visibleGroups" :key="group.key">
        <!-- ListGroupHeader: 16dp horizontal, 8dp vertical padding, onSurfaceVariant, SemiBold. -->
        <h2 class="updates-group-header">{{ group.label }}</h2>
        <UpdatesItemRow
          v-for="entry in group.entries"
          :key="`${entry.manga.id}:${entry.chapter.id}`"
          :entry="entry"
          :selected="selectedIds.includes(entry.chapter.id)"
          :selection-mode="selectionMode"
          :cover-url="server.thumbnailUrl(entry.manga.id)"
          @open="onRowOpen(entry, $event)"
          @toggle-select="toggleSelection(entry.chapter.id, false)"
          @long-press="onRowLongPress(entry)"
          @open-manga="onRowManga(entry)"
          @download="action => onDownloadAction(entry, action ?? 'start')"
        />
      </template>

      <div class="updates-footer">
        <v-alert v-if="updates.error" type="error" variant="tonal" class="mb-4 text-start">{{ updates.error }}</v-alert>
        <v-btn
          v-if="updates.hasNextPage"
          :loading="updates.loading"
          color="primary"
          variant="tonal"
          class="updates-load-more"
          @click="updates.loadMore()"
        >Load more updates</v-btn>
      </div>

      <!-- FastScrollLazyColumn handle (VerticalFastScroller.kt: 48dp length, 6dp width, 3dp radius). -->
      <button
        type="button"
        class="updates-fast-scroll"
        :class="{ 'is-visible': handleVisible }"
        :style="{ transform: `translateY(${handleTop}px)` }"
        aria-label="Fast scroll"
        @pointerdown="onHandlePointerDown"
        @pointermove="onHandlePointerMove"
        @pointerup="onHandlePointerUp"
        @pointercancel="onHandlePointerUp"
      />
    </div>

    <UpdatesBottomBar
      :api-url="server.apiUrl"
      :selected="selectedEntries"
      @clear-selection="clearSelection"
      @update="onBulkUpdate"
    />

    <UpdatesFilterDialog v-model="filterOpen" />
    <UpdatesCalendarDialog v-model="calendarOpen" />

    <!-- The honest stub of the "Update library" action. -->
    <v-dialog v-model="updateStubOpen" max-width="560">
      <v-card rounded="28px" color="surface-container-high" class="updates-stub-card">
        <div class="updates-stub-content">
          <p class="updates-stub-text">
            Updating the library is not supported in the web version. Suwayomi's REST API has no endpoint to trigger a library update, so the Refresh action and the pull to refresh gesture only reload the chapters the server already fetched.
          </p>
          <div class="updates-stub-actions">
            <v-btn variant="text" color="primary" class="updates-stub-button" @click="updateStubOpen = false">Cancel</v-btn>
            <v-btn variant="text" color="primary" class="updates-stub-button" @click="updateStubOpen = false; void updates.refresh(server.apiUrl)">OK</v-btn>
          </div>
        </div>
      </v-card>
    </v-dialog>

    <!-- Scaffold(snackbarHost = { SnackbarHost(snackbarHostState) }) of UpdatesScreen.kt:96. -->
    <div
      v-if="snackbar"
      class="updates-snackbar"
      :class="{ 'has-bottom-bar': selectionMode }"
      role="status"
      aria-live="polite"
    >{{ snackbar }}</div>
  </section>
</template>

<style scoped>
@layer app-components {
.updates-screen {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

/* IconButton of material3: a 48dp touch target with a 24dp icon. */
.updates-app-bar__action { width: 48px; height: 48px; }
.updates-app-bar__action :deep(.v-icon) { font-size: 24px; width: 24px; height: 24px; }

/* LoadingScreen: a centered CircularProgressIndicator inside the content area. */
.updates-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  min-height: 0;
}
/* The empty branch of the reference: the header on top, the EmptyScreen filling the rest. */
.updates-empty {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
.updates-empty-screen { flex: 1 1 auto; }
/* UpdatesLastUpdatedHeader: Box(padding(horizontal = 16dp, vertical = 8dp)) with an italic Text.
   The reference sets no explicit style, so the Text uses the default `bodyLarge`
   (16sp / 24sp, weight 400, 0.5sp letter spacing) and the default content color. */
.updates-last-updated {
  margin: 0;
  padding: 8px 16px;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.03125em;
  font-style: italic;
  color: rgb(var(--v-theme-on-surface));
}
/* ListGroupHeader: onSurfaceVariant, SemiBold, bodyMedium, 16dp / 8dp padding. */
.updates-group-header {
  margin: 0;
  padding: 8px 16px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}
/* The feed scrolls like the FastScrollLazyColumn of the reference. */
.updates-feed {
  position: relative;
  flex: 1 1 auto;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 24px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
}
/* Floating pull indicator matching Compose PullRefreshIndicator */
.updates-pull-indicator {
  position: absolute;
  top: -36px;
  left: 50%;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgb(var(--v-theme-surface-container-high));
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  pointer-events: none;
  transition: transform 100ms ease-out;
}
.updates-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
}
.updates-load-more { min-width: 140px; }
/* FastScrollLazyColumn handle (VerticalFastScroller.kt) */
.updates-fast-scroll {
  position: absolute;
  right: 2px;
  top: 0;
  width: 6px;
  height: 48px;
  border-radius: 3px;
  border: 0;
  padding: 0;
  background: rgb(var(--v-theme-primary));
  opacity: 0;
  transition: opacity 200ms ease-out;
  pointer-events: none;
  cursor: pointer;
  z-index: 10;
}
.updates-fast-scroll.is-visible {
  opacity: 0.6;
  pointer-events: auto;
}
.updates-fast-scroll:hover,
.updates-fast-scroll:active {
  opacity: 1;
}
/* AlertDialog: surfaceContainerHigh, CornerExtraLarge (28dp), 24dp padding. */
.updates-stub-card { min-width: min(280px, 100%); }
.updates-stub-content { padding: 24px; }
.updates-stub-text {
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}
.updates-stub-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.updates-stub-button { --v-btn-height: 40px; min-width: 58px; height: 40px; border-radius: 9999px; }
.updates-empty-button { --v-btn-height: 40px; height: 40px; }
/* MD3 Snackbar: inverseSurface container, inverseOnSurface content, 4dp corners. */
.updates-snackbar {
  position: fixed;
  left: 50%;
  bottom: calc(80px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  z-index: 1200;
  max-width: min(560px, calc(100% - 32px));
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.28), 0 1px 2px rgba(0, 0, 0, 0.2);
  transition: bottom 250ms cubic-bezier(0.2, 0, 0, 1);
}
.updates-snackbar.has-bottom-bar {
  bottom: calc(88px + env(safe-area-inset-bottom, 0px));
}
}
</style>
