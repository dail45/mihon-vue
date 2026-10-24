<script setup lang="ts">
/**
 * Pixel-parity port of Mihon's
 * `eu.kanade.presentation.manga.components.MangaChapterListItem.kt`
 * (Mihon revision 446f6df82c390ab760802c2fce3b677bce3f31c1).
 *
 * Reference structure:
 *
 *   SwipeableActionsBox(clipToBounds(), swipeThreshold = 56.dp,
 *                      backgroundUntilSwipeThreshold = surfaceContainerLowest) {
 *     Row(selectedBackground(selected)
 *         .combinedClickable(onClick, onLongClick)
 *         .padding(start = 16.dp, top = 12.dp, end = 8.dp, bottom = 12.dp)) {
 *       Column(weight(1f), spacedBy(6.dp)) {
 *         Row(spacedBy(2.dp), CenterVertically) {
 *           if (!read)    Icon(RoundedFilled.Circle, height 8.dp, padding end 4.dp, tint primary)
 *           if (bookmark) Icon(RoundedFilled.Bookmark, sizeIn(maxHeight = textHeight - 2.dp), tint primary)
 *           Text(title, bodyMedium, maxLines 1, Ellipsis,
 *                color = contentColor.copy(alpha = if (read) DISABLED_ALPHA else 1f))
 *         }
 *         Row {  // bodySmall, SECONDARY_ALPHA (DISABLED_ALPHA when read)
 *           date • readProgress • scanlator
 *         }
 *       }
 *       ChapterDownloadIndicator(enabled = downloadIndicatorEnabled, padding(start = 4.dp))
 *     }
 *   }
 *
 * Constants (mihon/presentation-core/.../material/Constants.kt):
 *   DISABLED_ALPHA = .38f, SECONDARY_ALPHA = .78f,
 *   padding.medium = 16.dp, padding.small = 8.dp, padding.extraSmall = 4.dp.
 *
 * `selectedBackground` (mihon/presentation-core/.../util/Modifier.kt:30) colours the row with
 * `colorScheme.secondary` at alpha .22 (light) / .16 (dark).
 *
 * The swipe actions of the reference come from `getSwipeAction()`:
 *   - swipe from the start edge (content moves right) -> `chapterSwipeStartAction`
 *   - swipe from the end edge (content moves left)  -> `chapterSwipeEndAction`
 * Mihon swaps the two preference names: `chapterSwipeStartAction` reads
 * `swipeToEndAction` ("pref_chapter_swipe_end_action", default ToggleBookmark) and
 * `chapterSwipeEndAction` reads `swipeToStartAction` ("pref_chapter_swipe_start_action",
 * default ToggleRead) — see MangaViewModel.kt:173-174 and LibraryPreferences.kt:206-234.
 */
import { computed, ref } from 'vue'
import type { Chapter } from '@/core/api/types'
import ChapterDownloadIndicator, { type ChapterDownloadIndicatorAction, type ChapterDownloadIndicatorState } from './ChapterDownloadIndicator.vue'

export type ChapterSwipeAction = 'toggle-read' | 'toggle-bookmark' | 'download' | 'disabled'

const props = withDefaults(defineProps<{
  chapter?: Chapter
  title: string
  /** `relativeDateText(chapter.dateUpload)`; null when the source has no upload date. */
  date?: string | null
  readProgress?: string | null
  scanlator?: string | null
  sourceName?: string | null
  selected?: boolean
  /** `downloadIndicatorEnabled = !isAnyChapterSelected && !manga.isLocal()`. */
  downloadIndicatorEnabled?: boolean
  swipeStartAction?: ChapterSwipeAction
  swipeEndAction?: ChapterSwipeAction
  /** The chapter is read -> the title/subtitle use DISABLED_ALPHA. */
  read?: boolean
  bookmark?: boolean
  /** Download state of the chapter, drawn by `ChapterDownloadIndicator`. */
  downloadState?: ChapterDownloadIndicatorState
  downloadProgress?: number
  /** Href of the reader route of the chapter. */
  href?: string
  /** The click is handled by the host (selection mode), the link must not navigate. */
  intercept?: boolean
}>(), {
  chapter: undefined,
  date: null,
  readProgress: null,
  scanlator: null,
  sourceName: null,
  selected: false,
  downloadIndicatorEnabled: true,
  swipeStartAction: 'disabled',
  swipeEndAction: 'disabled',
  read: false,
  bookmark: false,
  downloadState: 'not-downloaded',
  downloadProgress: 0,
  href: '',
  intercept: false,
})

const emit = defineEmits<{
  (event: 'click', e?: MouseEvent): void
  (event: 'longpress'): void
  (event: 'swipe', action: ChapterSwipeAction): void
  (event: 'download', action: ChapterDownloadIndicatorAction): void
}>()

/** `swipeActionThreshold = 56.dp` */
const SWIPE_THRESHOLD = 56
/** Long press (`combinedClickable(onLongClick = …)`): 500ms matching Android LongPress. */
const LONG_PRESS_MS = 500

const offset = ref(0)
const isDragging = ref(false)
let startX = 0
let startY = 0
let pointerId: number | null = null
let swiped = false
let suppressClick = false
let pressTimer: number | undefined
let thresholdCrossed = false

function clearLongPress() {
  if (pressTimer !== undefined) {
    window.clearTimeout(pressTimer)
    pressTimer = undefined
  }
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  if ((event.target as HTMLElement)?.closest?.('.chapter-download, .manga-chapter-item__download, .manga-chapter-item__download-wrap')) {
    event.stopPropagation()
    return
  }

  startX = event.clientX
  startY = event.clientY
  pointerId = event.pointerId
  isDragging.value = false
  swiped = false
  thresholdCrossed = false

  clearLongPress()
  pressTimer = window.setTimeout(() => {
    pressTimer = undefined
    suppressClick = true
    try { navigator.vibrate?.(20) } catch { /* haptics are optional in the browser */ }
    emit('longpress')
  }, LONG_PRESS_MS)
}

function onPointerMove(event: PointerEvent) {
  if (pointerId !== event.pointerId) return
  const deltaX = event.clientX - startX
  const deltaY = event.clientY - startY

  if (Math.hypot(deltaX, deltaY) > 8) {
    clearLongPress()
  }

  // If the gesture is predominantly vertical, allow normal scrolling and don't swipe
  if (!isDragging.value && Math.abs(deltaY) > Math.abs(deltaX)) {
    return
  }

  if (Math.abs(deltaX) < 6) return
  const allowed = deltaX > 0 ? props.swipeStartAction !== 'disabled' : props.swipeEndAction !== 'disabled'
  if (!allowed) return

  isDragging.value = true
  swiped = true
  offset.value = Math.max(-96, Math.min(96, deltaX))

  const passed = Math.abs(offset.value) >= SWIPE_THRESHOLD
  if (passed && !thresholdCrossed) {
    thresholdCrossed = true
    try { navigator.vibrate?.(10) } catch {}
  } else if (!passed && thresholdCrossed) {
    thresholdCrossed = false
  }
}

function onPointerUp(event: PointerEvent) {
  if (pointerId !== event.pointerId) return
  const wasDragging = isDragging.value
  isDragging.value = false
  pointerId = null
  thresholdCrossed = false
  clearLongPress()

  if (wasDragging) {
    const action = offset.value > 0 ? props.swipeStartAction : props.swipeEndAction
    const passed = Math.abs(offset.value) >= SWIPE_THRESHOLD
    offset.value = 0
    if (passed && action !== 'disabled') {
      emit('swipe', action)
    }
  }
}

function onClick(event: MouseEvent) {
  // A click on the download indicator belongs to the indicator, not to the chapter row.
  if ((event.target as HTMLElement)?.closest?.('.chapter-download, .manga-chapter-item__download, .manga-chapter-item__download-wrap')) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  if (swiped) {
    swiped = false
    return
  }
  if (suppressClick) {
    suppressClick = false
    event.preventDefault()
    return
  }

  // Shift+click triggers selection / range selection (long press equivalent on desktop)
  if (event.shiftKey) {
    event.preventDefault()
    emit('longpress')
    return
  }

  // Allow middle click or Ctrl/Cmd click to open in new tab
  if (event.button !== 0 || event.ctrlKey || event.metaKey) {
    return
  }

  event.preventDefault()
  emit('click', event)
}

function onKeySelect() {
  emit('click')
}

function onContextMenu() {
  emit('longpress')
}

const activeAction = computed<ChapterSwipeAction>(() => {
  if (offset.value > 0) return props.swipeStartAction
  if (offset.value < 0) return props.swipeEndAction
  return 'disabled'
})

const swipeIcon = computed<string | null>(() => {
  const action = activeAction.value
  if (action === 'toggle-read') return props.read ? 'remove_done' : 'check'
  if (action === 'toggle-bookmark') return props.bookmark ? 'bookmark_remove' : 'bookmark_add'
  if (action === 'download') {
    const s = String(props.downloadState || '').toLowerCase().replace(/_/g, '-')
    if (s === 'queue' || s === 'queued' || s === 'downloading') return 'file_download_off'
    if (s === 'downloaded') return 'delete'
    return 'download'
  }
  return null
})
</script>

<template>
  <a
    class="v-list-item manga-chapter-item"
    :class="{
      'is-selected': selected,
      'is-read': read,
      'is-dragging': isDragging,
      'is-swiping': offset !== 0
    }"
    :href="href || undefined"
    :aria-label="title"
    tabindex="0"
    @click="onClick"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @pointerleave="onPointerUp"
    @keydown.space.prevent="onKeySelect"
    @keydown.enter.prevent="onKeySelect"
    @contextmenu.prevent="onContextMenu"
  >
    <!-- Swipe action background (revealed during drag/swipe) -->
    <div
      v-if="swipeIcon"
      class="manga-chapter-item__swipe"
      :class="{
        'is-start': offset > 0,
        'is-end': offset < 0,
        'is-threshold-reached': Math.abs(offset) >= SWIPE_THRESHOLD
      }"
      aria-hidden="true"
    >
      <span class="manga-chapter-item__swipe-icon">
        <v-icon :icon="swipeIcon" size="24" />
      </span>
    </div>

    <div
      class="manga-chapter-item__content"
      :style="{ transform: offset ? `translateX(${offset}px)` : undefined }"
    >
      <div class="manga-chapter-item__column">
        <div class="manga-chapter-item__title-row">
          <!-- Unread dot: RoundedFilled.Circle, 8dp high, primary, padding end 4dp. -->
          <span v-if="!read" class="manga-chapter-item__unread" aria-label="Unread" />
          <!-- RoundedFilled.Bookmark, tint primary, height = text height - 2dp = 18dp. -->
          <svg
            v-if="bookmark"
            class="manga-chapter-item__bookmark"
            viewBox="0 -960 960 960"
            width="18"
            height="18"
            aria-label="Bookmarked"
          >
            <path
              d="m480-240-168 72q-40 17-76-6.5T200-241v-519q0-33 23.5-56.5T280-840h400q33 0 56.5 23.5T760-760v519q0 43-36 66.5t-76 6.5l-168-72Z"
              fill="currentColor"
            />
          </svg>
          <span class="manga-chapter-item__title">{{ title }}</span>
          <span v-if="sourceName" class="manga-chapter-item__source-chip">{{ sourceName }}</span>
        </div>

        <div v-if="date || readProgress || scanlator" class="manga-chapter-item__subtitle">
          <template v-if="date">
            <span class="manga-chapter-item__date">{{ date }}</span>
            <span v-if="readProgress || scanlator" class="manga-chapter-item__separator"> • </span>
          </template>
          <span v-if="readProgress" class="manga-chapter-item__progress">{{ readProgress }}</span>
          <span v-if="readProgress && scanlator" class="manga-chapter-item__separator"> • </span>
          <span v-if="scanlator" class="manga-chapter-item__scanlator">{{ scanlator }}</span>
        </div>
      </div>

      <!-- ChapterDownloadIndicator: enabled = downloadIndicatorEnabled, padding start 4dp -->
      <div
        class="manga-chapter-item__download-wrap"
        @click.stop.prevent
        @pointerdown.stop
        @pointerup.stop
      >
        <ChapterDownloadIndicator
          class="manga-chapter-item__download"
          :state="downloadState"
          :progress="downloadProgress"
          :chapter-title="title"
          :disabled="!downloadIndicatorEnabled"
          @action="emit('download', $event)"
        />
      </div>
    </div>
  </a>
</template>

<style scoped>
@layer app-components {
.manga-chapter-item {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: stretch;
  width: 100%;
  max-width: 100%;
  min-height: 56px;
  margin: 0;
  padding: 0;
  border-width: 0;
  border-radius: 0;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  touch-action: pan-y;
  background-color: transparent;
}

/* Background for selected item: Mihon Modifier.selectedBackground()
   Uses colorScheme.secondary with alpha 0.22 (light) / 0.16 (dark) */
.manga-chapter-item.is-selected .manga-chapter-item__content {
  background-color: rgba(var(--v-theme-secondary), 0.22);
}
.v-theme--mihonDark .manga-chapter-item.is-selected .manga-chapter-item__content,
.v-theme--dark .manga-chapter-item.is-selected .manga-chapter-item__content {
  background-color: rgba(var(--v-theme-secondary), 0.16);
}

@supports (background-color: color-mix(in srgb, red, blue)) {
  .manga-chapter-item.is-selected .manga-chapter-item__content {
    background-color: color-mix(in srgb, rgb(var(--v-theme-secondary)) 22%, rgb(var(--v-theme-surface)));
  }
  .v-theme--mihonDark .manga-chapter-item.is-selected .manga-chapter-item__content,
  .v-theme--dark .manga-chapter-item.is-selected .manga-chapter-item__content {
    background-color: color-mix(in srgb, rgb(var(--v-theme-secondary)) 16%, rgb(var(--v-theme-surface)));
  }
}

/* Swipe action background revealed beneath content */
.manga-chapter-item__swipe {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  background-color: rgb(var(--v-theme-surface-container-lowest));
  color: rgb(var(--v-theme-on-surface-variant));
  transition: background-color 150ms ease, color 150ms ease;
}
.manga-chapter-item__swipe.is-start {
  justify-content: flex-start;
}
.manga-chapter-item__swipe.is-end {
  justify-content: flex-end;
}
.manga-chapter-item__swipe.is-threshold-reached {
  background-color: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
}
.manga-chapter-item__swipe-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: 0 16px;
}

/* Content row: Row.padding(start = 16.dp, top = 12.dp, end = 8.dp, bottom = 12.dp) */
.manga-chapter-item__content {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  padding: 12px 8px 12px 16px;
  background-color: rgb(var(--v-theme-surface));
  transition: transform 200ms cubic-bezier(0.2, 0, 0, 1);
  will-change: transform;
}
.manga-chapter-item.is-dragging .manga-chapter-item__content {
  transition: none;
}

/* M3 State Layers: hover 8%, pressed/active 12% onSurface */
.manga-chapter-item__content::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-color: rgb(var(--v-theme-on-surface));
  opacity: 0;
  transition: opacity 120ms linear;
}
.manga-chapter-item:hover:not(.is-dragging) .manga-chapter-item__content::after {
  opacity: 0.08;
}
.manga-chapter-item:active:not(.is-dragging) .manga-chapter-item__content::after {
  opacity: 0.12;
}
.manga-chapter-item:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

/* Column(verticalArrangement = Arrangement.spacedBy(6.dp)) */
.manga-chapter-item__column {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Row 1: Title Row: Row(horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) */
.manga-chapter-item__title-row {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

/* Unread Circle: MaterialSymbols.RoundedFilled.Circle, height 8.dp, padding end 4.dp, tint primary */
.manga-chapter-item__unread {
  flex: none;
  width: 8px;
  height: 8px;
  margin-inline-end: 4px;
  border-radius: 50%;
  background-color: rgb(var(--v-theme-primary));
}

/* Bookmark icon: MaterialSymbols.RoundedFilled.Bookmark, sizeIn(maxHeight = textHeight - 2.dp), tint primary */
.manga-chapter-item__bookmark {
  flex: none;
  width: 18px;
  height: 18px;
  color: rgb(var(--v-theme-primary));
}

/* Title text: MaterialTheme.typography.bodyMedium: 14sp / 20sp w400, letter-spacing 0.25px (0.017857em) */
.manga-chapter-item__title {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface));
}
.manga-chapter-item.is-read .manga-chapter-item__title {
  /* DISABLED_ALPHA = 0.38 */
  color: rgba(var(--v-theme-on-surface), 0.38);
}

/* Source origin chip: e.g. [MangaDex] */
.manga-chapter-item__source-chip {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  line-height: 14px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 4px;
  background-color: rgb(var(--v-theme-surface-container-highest));
  color: rgb(var(--v-theme-on-surface-variant));
  border: 1px solid rgba(var(--v-theme-outline), 0.2);
  white-space: nowrap;
  flex-shrink: 0;
  margin-inline-start: 6px;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.manga-chapter-item.is-read .manga-chapter-item__source-chip {
  opacity: 0.6;
}

/* Subtitle Row: MaterialTheme.typography.bodySmall: 12sp / 16sp w400, letter-spacing 0.4px (0.033333em) */
.manga-chapter-item__subtitle {
  display: flex;
  align-items: baseline;
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.4px;
  /* SECONDARY_ALPHA = 0.78 */
  color: rgba(var(--v-theme-on-surface), 0.78);
}
.manga-chapter-item.is-read .manga-chapter-item__subtitle {
  /* DISABLED_ALPHA = 0.38 when chapter is read */
  color: rgba(var(--v-theme-on-surface), 0.38);
}

.manga-chapter-item__date,
.manga-chapter-item__scanlator {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* readProgress is always DISABLED_ALPHA (0.38) in Compose */
.manga-chapter-item__progress {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: rgba(var(--v-theme-on-surface), 0.38);
}

/* DotSeparatorText: " • " */
.manga-chapter-item__separator {
  flex: none;
  white-space: pre;
}

.manga-chapter-item__download-wrap {
  flex: none;
  display: flex;
  align-items: center;
}

/* ChapterDownloadIndicator: Modifier.padding(start = 4.dp) */
.manga-chapter-item__download {
  flex: none;
  margin-inline-start: 4px;
}
}
</style>
