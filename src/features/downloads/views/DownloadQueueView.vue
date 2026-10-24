<script setup lang="ts">
/**
 * Download queue screen.
 * Reference: mihon/app/src/main/java/eu/kanade/tachiyomi/ui/download/DownloadQueueScreen.kt
 *            mihon/app/src/main/java/eu/kanade/presentation/download/DownloadQueueList.kt
 *            mihon/app/src/main/java/eu/kanade/tachiyomi/ui/download/DownloadQueueViewModel.kt
 *
 * The Suwayomi REST v1 surface has no download endpoints, so the queue is read
 * and mutated through the GraphQL endpoint (src/api/downloads.ts).
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { useDownloadQueue, type QueueSort } from '../composables/useDownloadQueue'
import type { DownloadQueueEntry } from '@/core/api/downloads'
import MihonEmptyScreen from '@/core/components/MihonEmptyScreen.vue'

const server = useSuwayomiStore()
const router = useRouter()
const theme = useTheme()
const queue = useDownloadQueue(server.apiUrl)

const dragKind = ref<'section' | 'download' | null>(null)
const dragSectionId = ref<string | null>(null)
const dragChapterId = ref<number | null>(null)
const overChapterId = ref<number | null>(null)
const overSectionId = ref<string | null>(null)

const fabExpanded = ref(true)
const snackbar = ref(false)
const listEl = ref<HTMLElement | null>(null)
const isScrolled = ref(false)
let lastScrollTop = 0

const sortMenuOpen = ref(false)
const uploadSubMenuOpen = ref(false)
const chapterSubMenuOpen = ref(false)
const overflowMenuOpen = ref(false)

const dark = computed(() => Boolean(theme.global.current.value.dark))

const firstDownload = computed(() => queue.sections.value[0]?.downloads[0])
const lastSection = computed(() => queue.sections.value[queue.sections.value.length - 1])
const lastDownload = computed(() => lastSection.value?.downloads[lastSection.value.downloads.length - 1])

const canMoveToTop = (entry: DownloadQueueEntry) =>
  Boolean(firstDownload.value && entry.chapter.id !== firstDownload.value.chapter.id)

const canMoveToBottom = (entry: DownloadQueueEntry) =>
  Boolean(lastDownload.value && entry.chapter.id !== lastDownload.value.chapter.id)

function pageCount(entry: DownloadQueueEntry) {
  return entry.chapter.pageCount || 0
}

/** PagesProgress.downloadedPages — pages already stored for this chapter. */
function downloadedPages(entry: DownloadQueueEntry) {
  const count = pageCount(entry)
  return count > 0 ? Math.round((entry.progress || 0) * count / 100) : 0
}

/** PagesProgress.fraction (percent 0..100). */
function progressPercent(entry: DownloadQueueEntry) {
  const count = pageCount(entry)
  if (!count) return 0
  return Math.min(100, Math.max(0, entry.progress || 0))
}

watch(() => server.apiUrl, () => {
  void queue.refresh()
})

onMounted(() => {
  void queue.refresh()
  queue.poll()
})

onBeforeUnmount(() => {
  queue.dispose()
})

function notify(message: string) {
  queue.notice.value = message
  snackbar.value = true
}

watch(queue.notice, value => {
  if (value) snackbar.value = true
})

function onSortClick(sortBy: QueueSort) {
  queue.sortQueue(sortBy)
  notify('Queue reordered.')
  sortMenuOpen.value = false
  uploadSubMenuOpen.value = false
  chapterSubMenuOpen.value = false
}

function onCancelAllClick() {
  clearQueue()
  overflowMenuOpen.value = false
}

function cancel(entry: DownloadQueueEntry) {
  queue.cancel(entry)
  notify('Download cancelled.')
}

function cancelSeries(entry: DownloadQueueEntry) {
  queue.cancelSeries(entry)
  notify('Downloads cancelled for this series.')
}

function moveToTop(entry: DownloadQueueEntry) {
  queue.move(entry, true)
  notify('Moved to top.')
}

function moveToBottom(entry: DownloadQueueEntry) {
  queue.move(entry, false)
  notify('Moved to bottom.')
}

function moveSeriesToTop(entry: DownloadQueueEntry) {
  queue.moveSeries(entry, true)
  notify('Series moved to top.')
}

function moveSeriesToBottom(entry: DownloadQueueEntry) {
  queue.moveSeries(entry, false)
  notify('Series moved to bottom.')
}

function clearQueue() {
  queue.clear()
  notify('Queue cleared.')
}

function toggleDownloader() {
  if (queue.isRunning.value) {
    queue.pause()
    notify('Downloader paused.')
  } else {
    queue.start()
    notify('Downloader started.')
  }
}

function onScroll() {
  const el = listEl.value
  if (!el) return
  isScrolled.value = el.scrollTop > 0
  // DownloadQueueScreen.kt nested scroll connection:
  // onPreScroll sets fabExpanded = available.y >= 0.
  // Scrolling up toward top (delta < 0, finger drags down) -> expanded = true.
  // Scrolling down into content (delta > 0, finger drags up) -> expanded = false.
  const delta = el.scrollTop - lastScrollTop
  lastScrollTop = el.scrollTop
  if (delta > 0) {
    fabExpanded.value = false
  } else if (delta < 0) {
    fabExpanded.value = true
  }
}

function onDragStart(kind: 'section' | 'download', event: DragEvent, sectionId: string, chapterId?: number) {
  dragKind.value = kind
  dragSectionId.value = sectionId
  dragChapterId.value = chapterId ?? null
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(chapterId ?? sectionId))
  }
}

function onDragEnd() {
  dragKind.value = null
  dragSectionId.value = null
  dragChapterId.value = null
  overChapterId.value = null
  overSectionId.value = null
}

function onDragOverChapter(event: DragEvent, sectionId: string, chapterId: number) {
  if (dragKind.value !== 'download') return
  // DownloadQueueList.kt: a dragged download only swaps rows inside its own section.
  if (dragSectionId.value !== sectionId) return
  event.preventDefault()
  overChapterId.value = chapterId
}

function onDropChapter(targetChapterId: number) {
  if (
    dragKind.value === 'download' &&
    dragChapterId.value !== null &&
    dragChapterId.value !== targetChapterId &&
    queue.sections.value.find(s => s.id === dragSectionId.value)?.downloads.some(d => d.chapter.id === targetChapterId)
  ) {
    const entry = queue.entries.value.find(e => e.chapter.id === dragChapterId.value)
    if (entry) queue.reorderWithinSection(entry, targetChapterId)
  }
  overChapterId.value = null
}

function onDragOverSection(event: DragEvent, sectionId: string) {
  if (dragKind.value !== 'section') return
  event.preventDefault()
  overSectionId.value = sectionId
}

function onDropSection(targetSectionId: string) {
  if (dragKind.value === 'section' && dragSectionId.value) {
    queue.reorderSection(dragSectionId.value, targetSectionId)
  }
  overSectionId.value = null
}

function navigateUp() {
  if (typeof window.history.state?.back === 'string') {
    router.back()
  } else {
    void router.push('/more')
  }
}
</script>

<template>
  <section class="download-queue">
    <!-- TopAppBar with navigateUp (ArrowBack), title content and actions (pinnedScrollBehavior elevation). -->
    <header class="queue-toolbar" :class="{ 'is-scrolled': isScrolled }">
      <button
        class="queue-icon-button"
        type="button"
        aria-label="Navigate up"
        title="Navigate up"
        @click="navigateUp"
      >
        <v-icon icon="arrow_back" size="24" />
      </button>

      <div class="queue-title-row">
        <h1 class="queue-title">Download queue</h1>
        <span
          v-if="queue.downloadCount.value > 0"
          class="queue-pill"
          :class="{ 'queue-pill-dark': dark }"
        >
          {{ queue.downloadCount.value }}
        </span>
      </div>

      <template v-if="queue.downloadCount.value > 0">
        <!-- Sort dropdown menu with nested By upload date / By chapter number items -->
        <v-menu
          v-model="sortMenuOpen"
          location="bottom end"
          :close-on-content-click="false"
          content-class="queue-menu"
        >
          <template #activator="{ props: sortProps }">
            <button
              class="queue-icon-button"
              type="button"
              aria-label="Sort"
              title="Sort"
              v-bind="sortProps"
            >
              <v-icon icon="sort" size="24" />
            </button>
          </template>

          <v-list density="compact" class="queue-menu-list">
            <v-menu
              v-model="uploadSubMenuOpen"
              location="end top"
              :offset="[-8, 0]"
              content-class="queue-menu"
            >
              <template #activator="{ props: subUploadProps }">
                <v-list-item
                  v-bind="subUploadProps"
                  title="By upload date"
                  append-icon="arrow_right"
                  class="queue-menu-item"
                />
              </template>
              <v-list density="compact" class="queue-menu-list">
                <v-list-item
                  title="Newest"
                  class="queue-menu-item"
                  @click="onSortClick('upload-newest')"
                />
                <v-list-item
                  title="Oldest"
                  class="queue-menu-item"
                  @click="onSortClick('upload-oldest')"
                />
              </v-list>
            </v-menu>

            <v-menu
              v-model="chapterSubMenuOpen"
              location="end top"
              :offset="[-8, 0]"
              content-class="queue-menu"
            >
              <template #activator="{ props: subChapterProps }">
                <v-list-item
                  v-bind="subChapterProps"
                  title="By chapter number"
                  append-icon="arrow_right"
                  class="queue-menu-item"
                />
              </template>
              <v-list density="compact" class="queue-menu-list">
                <v-list-item
                  title="Ascending"
                  class="queue-menu-item"
                  @click="onSortClick('chapter-asc')"
                />
                <v-list-item
                  title="Descending"
                  class="queue-menu-item"
                  @click="onSortClick('chapter-desc')"
                />
              </v-list>
            </v-menu>
          </v-list>
        </v-menu>

        <!-- Overflow menu with "Cancel all" -->
        <v-menu
          v-model="overflowMenuOpen"
          location="bottom end"
          content-class="queue-menu"
        >
          <template #activator="{ props: overflowProps }">
            <button
              class="queue-icon-button"
              type="button"
              aria-label="More options"
              title="More options"
              v-bind="overflowProps"
            >
              <v-icon icon="more_vert" size="24" />
            </button>
          </template>
          <v-list density="compact" class="queue-menu-list">
            <v-list-item
              title="Cancel all"
              class="queue-menu-item"
              @click="onCancelAllClick"
            />
          </v-list>
        </v-menu>
      </template>
    </header>

    <!-- Loading state -->
    <div
      v-if="queue.loading.value && !queue.downloadCount.value"
      class="queue-loading"
      role="status"
      aria-label="Loading download queue"
    >
      <v-progress-circular indeterminate size="40" width="4" color="primary" />
    </div>

    <!-- Error state -->
    <v-alert
      v-else-if="queue.error.value"
      type="error"
      variant="tonal"
      class="queue-error"
    >
      {{ queue.error.value }}
    </v-alert>

    <!-- Empty screen state: MihonEmptyScreen ("No downloads") -->
    <div v-else-if="!queue.downloadCount.value" class="queue-empty-wrap">
      <MihonEmptyScreen message="No downloads" />
    </div>

    <!-- Download queue list with sections -->
    <div v-else ref="listEl" class="queue-list" @scroll="onScroll">
      <section
        v-for="section in queue.sections.value"
        :key="section.id"
        class="queue-section"
        :class="{ 'queue-section-over': overSectionId === section.id }"
        @dragover="onDragOverSection($event, section.id)"
        @drop="onDropSection(section.id)"
      >
        <!-- DownloadQueueHeader.kt: Surface(padding top = 8.dp) -->
        <div class="queue-header">
          <div
            class="queue-header-surface"
            :class="{ 'queue-dragging': dragKind === 'section' && dragSectionId === section.id }"
          >
            <p class="queue-group-header">{{ section.name }} ({{ section.downloads.length }})</p>
            <span
              class="queue-drag-handle"
              draggable="true"
              role="button"
              tabindex="0"
              aria-label="Reorder source"
              @dragstart="onDragStart('section', $event, section.id)"
              @dragend="onDragEnd"
            >
              <v-icon icon="drag_handle" size="24" />
            </span>
          </div>
        </div>

        <!-- Downloads of section: hidden while section is dragged -->
        <template v-if="dragKind !== 'section'">
          <div
            v-for="entry in section.downloads"
            :key="entry.chapter.id"
            class="queue-item"
            :class="{ 'queue-dragging': dragKind === 'download' && dragChapterId === entry.chapter.id }"
            @dragover="onDragOverChapter($event, section.id, entry.chapter.id)"
            @drop="onDropChapter(entry.chapter.id)"
          >
            <span
              class="queue-drag-handle"
              draggable="true"
              role="button"
              tabindex="0"
              aria-label="Reorder download"
              @dragstart="onDragStart('download', $event, section.id, entry.chapter.id)"
              @dragend="onDragEnd"
            >
              <v-icon icon="drag_handle" size="24" />
            </span>

            <div class="queue-item-body">
              <div class="queue-item-title-row">
                <p class="queue-manga-title">{{ entry.manga.title }}</p>
                <p v-if="pageCount(entry) > 0" class="queue-pages">
                  {{ downloadedPages(entry) }}/{{ pageCount(entry) }}
                </p>
              </div>

              <p class="queue-chapter-name">{{ entry.chapter.name }}</p>

              <!-- LinearProgressIndicator: 4dp track, animated primary indicator -->
              <div class="queue-progress-track">
                <div
                  class="queue-progress-bar"
                  :style="{ width: `${progressPercent(entry)}%` }"
                />
              </div>
            </div>

            <!-- DownloadQueueItemMenu: DropdownMenu (196dp) -->
            <v-menu location="bottom end" content-class="queue-menu">
              <template #activator="{ props: itemMenuProps }">
                <button
                  class="queue-icon-button queue-item-menu"
                  type="button"
                  aria-label="Menu"
                  v-bind="itemMenuProps"
                >
                  <v-icon icon="more_vert" size="24" />
                </button>
              </template>
              <v-list density="compact" class="queue-menu-list">
                <v-list-item
                  v-if="canMoveToTop(entry)"
                  title="Move to top"
                  class="queue-menu-item"
                  @click="moveToTop(entry)"
                />
                <v-list-item
                  title="Move series to top"
                  class="queue-menu-item"
                  @click="moveSeriesToTop(entry)"
                />
                <v-list-item
                  v-if="canMoveToBottom(entry)"
                  title="Move to bottom"
                  class="queue-menu-item"
                  @click="moveToBottom(entry)"
                />
                <v-list-item
                  title="Move series to bottom"
                  class="queue-menu-item"
                  @click="moveSeriesToBottom(entry)"
                />
                <v-list-item
                  title="Cancel"
                  class="queue-menu-item"
                  @click="cancel(entry)"
                />
                <v-list-item
                  title="Cancel all for this series"
                  class="queue-menu-item"
                  @click="cancelSeries(entry)"
                />
              </v-list>
            </v-menu>
          </div>
        </template>
      </section>
    </div>

    <!-- SmallExtendedFloatingActionButton: Pause while running, Resume otherwise -->
    <Transition name="queue-fab-anim">
      <button
        v-if="queue.downloadCount.value > 0"
        class="queue-fab"
        :class="{ 'is-expanded': fabExpanded }"
        type="button"
        :aria-label="queue.isRunning.value ? 'Pause' : 'Resume'"
        @click="toggleDownloader"
      >
        <v-icon
          :icon="queue.isRunning.value ? 'pause' : 'play_arrow'"
          class="queue-fab-icon"
        />
        <span class="queue-fab-label">{{ queue.isRunning.value ? 'Pause' : 'Resume' }}</span>
      </button>
    </Transition>

    <!-- Feedback snackbar -->
    <v-snackbar
      v-model="snackbar"
      timeout="3000"
      location="bottom"
      class="queue-snackbar"
    >
      {{ queue.notice.value }}
    </v-snackbar>
  </section>
</template>

<style scoped>
@layer app-components {
.download-queue {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 100%;
  background: rgb(var(--v-theme-background));
}

/* AppBar.kt: TopAppBar, 64dp tall, flat surface, pinnedScrollBehavior elevation */
.queue-toolbar {
  position: fixed;
  top: 0;
  inset-inline-start: var(--v-layout-left, 0px);
  inset-inline-end: var(--v-layout-right, 0px);
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 0;
  height: 64px;
  padding: 0 4px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.queue-toolbar.is-scrolled {
  background: rgb(var(--v-theme-surface-container));
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.queue-title-row {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  padding-left: 12px;
}

/* AppBarTitle: titleLarge (22sp / 28sp, Regular 400). */
.queue-title {
  flex: 0 1 auto;
  min-width: 0;
  margin: 0;
  padding: 0 4px;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Pill.kt: shapes.extraLarge surface, 6dp/1dp inner padding, 14sp text, 8dp start margin */
.queue-pill {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  margin-inline-start: 8px;
  padding: 1px 6px;
  border-radius: 9999px;
  font-size: 14px;
  line-height: 20px;
  background: color-mix(in srgb, rgb(var(--v-theme-on-background)) 8%, transparent);
  color: rgb(var(--v-theme-on-surface));
}

.queue-pill-dark {
  background: color-mix(in srgb, rgb(var(--v-theme-on-background)) 12%, transparent);
}

/* IconButton: 40dp state layer inside 48dp minimum interactive component, 24dp icon */
.queue-icon-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 24px;
  background: none;
  color: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.queue-icon-button::before {
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
  .queue-icon-button:hover::before {
    opacity: 0.08;
  }
}

.queue-icon-button:active::before {
  opacity: 0.12;
}

.queue-icon-button:focus-visible::before {
  opacity: 0.12;
}

/* IconButton inside item row: 40dp box */
.queue-item-menu {
  width: 40px;
  height: 40px;
  border-radius: 20px;
}

.queue-item-menu::before {
  inset: 0;
}

/* DropdownMenu.kt: min/max width 196dp, shape 4dp, surfaceContainer, elevation 2 */
:deep(.queue-menu) {
  width: 196px;
  min-width: 196px;
  max-width: 196px;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12);
}

.queue-menu-list {
  width: 196px;
  min-width: 196px;
  max-width: 196px;
  padding: 0;
  background: rgb(var(--v-theme-surface-container));
}

.queue-menu-item {
  min-height: 48px;
  padding: 0 12px;
}

.queue-menu-list :deep(.v-list-item) {
  min-height: 48px;
  padding: 0 12px;
}

.queue-menu-list :deep(.v-list-item-title) {
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}

.queue-menu-list :deep(.v-list-item__prepend) {
  display: none;
}

.queue-menu-list :deep(.v-list-item__append) {
  margin-inline-start: 0;
  align-self: center;
}

/* Scaffold contentPadding: 64dp top bar offset, 88dp bottom padding to clear FAB */
.queue-list {
  flex: 1 1 auto;
  overflow-y: auto;
  padding-top: 64px;
  padding-bottom: calc(88px + env(safe-area-inset-bottom));
}

/* DownloadQueueHeader.kt: Surface(padding top = 8.dp) */
.queue-header {
  padding-top: 8px;
}

.queue-header-surface {
  display: flex;
  align-items: center;
  padding: 0 8px 0 0;
  background: rgb(var(--v-theme-background));
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.queue-header-surface.queue-dragging {
  background: rgb(var(--v-theme-surface-container-high));
  box-shadow: 0 6px 10px 4px rgba(0, 0, 0, 0.15), 0 2px 3px 0 rgba(0, 0, 0, 0.15);
}

/* ListGroupHeader.kt: horizontal 16dp, vertical 8dp, onSurfaceVariant, SemiBold 600, bodyMedium */
.queue-group-header {
  flex: 1 1 0;
  min-width: 0;
  margin: 0;
  padding: 8px 16px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface-variant));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-section-over .queue-header-surface {
  background: rgb(var(--v-theme-surface-container-high));
}

/* DownloadQueueItem: row padding start 8dp, end 4dp, vertical 0 */
.queue-item {
  display: flex;
  align-items: center;
  padding: 0 4px 0 8px;
  background: rgb(var(--v-theme-background));
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.queue-item.queue-dragging {
  background: rgb(var(--v-theme-surface-container-high));
  box-shadow: 0 6px 10px 4px rgba(0, 0, 0, 0.15), 0 2px 3px 0 rgba(0, 0, 0, 0.15);
}

/* DragHandle: 24dp icon with 8dp padding (40x40dp box) */
.queue-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 8px;
  flex-shrink: 0;
  cursor: grab;
  color: rgb(var(--v-theme-on-surface));
  touch-action: none;
}

.queue-drag-handle:active,
.queue-drag-handle[draggable="true"]:active {
  cursor: grabbing;
}

/* Column between DragHandle and Menu: vertical padding 8dp, gap 4dp */
.queue-item-body {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0;
}

.queue-item-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Manga title: bodyMedium (14/20sp w400, onSurface) */
.queue-manga-title {
  flex: 1 1 0;
  min-width: 0;
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Downloaded pages: bodySmall (12/16sp w400, onSurfaceVariant) */
.queue-pages {
  flex-shrink: 0;
  margin: 0;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* Chapter name: bodySmall (12/16sp w400, onSurface) */
.queue-chapter-name {
  margin: 0;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* LinearProgressIndicator: 4dp track (surfaceVariant), primary indicator */
.queue-progress-track {
  position: relative;
  width: 100%;
  margin-top: 4px;
  height: 4px;
  border-radius: 2px;
  background: rgb(var(--v-theme-surface-variant));
  overflow: hidden;
}

.queue-progress-bar {
  height: 100%;
  border-radius: 2px;
  background: rgb(var(--v-theme-primary));
  transition: width 0.3s ease;
}

/* Empty screen wrapper */
.queue-empty-wrap {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 64px;
}

.queue-loading {
  flex: 1 1 auto;
  display: grid;
  place-items: center;
  padding: 64px 24px 0;
}

.queue-error {
  margin: 72px 16px 0;
}

/* SmallExtendedFloatingActionButton (ExtendedFabSmallTokens):
   ContainerHeight 56dp, min width 56dp, CornerLarge (16dp),
   Container = primaryContainer, content = onPrimaryContainer,
   Elevation Level 3, Hover Level 4. */
.queue-fab {
  position: fixed;
  inset-inline-end: calc(16px + var(--v-layout-right, 0px));
  bottom: calc(16px + env(safe-area-inset-bottom));
  z-index: 5;
  display: inline-flex;
  align-items: center;
  height: 56px;
  min-width: 56px;
  padding: 0 16px;
  border: none;
  border-radius: 16px;
  overflow: hidden;
  background: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px 0 rgba(0, 0, 0, 0.15);
  transition: box-shadow 0.2s ease-in-out;
  -webkit-tap-highlight-color: transparent;
}

@media (hover: hover) {
  .queue-fab:hover {
    box-shadow: 0 6px 10px 4px rgba(0, 0, 0, 0.15), 0 2px 3px 0 rgba(0, 0, 0, 0.15);
  }
}

.queue-fab:active {
  box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px 0 rgba(0, 0, 0, 0.15);
}

.queue-fab:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.queue-fab::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}

@media (hover: hover) {
  .queue-fab:hover::after {
    opacity: 0.08;
  }
}

.queue-fab:active::after {
  opacity: 0.12;
}

.queue-fab:focus-visible::after {
  opacity: 0.1;
}

.queue-fab-icon {
  flex: 0 0 auto;
  font-size: 24px;
  line-height: 24px;
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.queue-fab-label {
  max-width: 0;
  margin: 0;
  overflow: hidden;
  white-space: nowrap;
  opacity: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  letter-spacing: 0.15px;
  transition: max-width 0.2s cubic-bezier(0.2, 0, 0, 1), opacity 0.15s linear, margin 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.queue-fab.is-expanded .queue-fab-label {
  max-width: 200px;
  margin: 0 0 0 8px;
  opacity: 1;
}

/* FAB enter/leave transition */
.queue-fab-anim-enter-active,
.queue-fab-anim-leave-active {
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s linear;
  transform-origin: bottom right;
}

.queue-fab-anim-enter-from,
.queue-fab-anim-leave-to {
  transform: scale(0.8);
  opacity: 0;
}

.queue-snackbar {
  position: fixed;
  left: calc((100% + var(--v-layout-left, 0px) - var(--v-layout-right, 0px)) / 2);
  bottom: calc(var(--v-layout-bottom, 0px) + 16px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  z-index: 12;
}
}
</style>
