<script setup lang="ts">
/**
 * Pixel-parity port of Mihon's `UpdatesUiItem`
 * (mihon/app/src/main/java/eu/kanade/presentation/updates/UpdatesUiItem.kt:143-247,
 * pinned commit 446f6df82c390ab760802c2fce3b677bce3f31c1).
 *
 * Reference geometry (androidx.compose.foundation + material3):
 *   Row(modifier.selectedBackground(selected).combinedClickable(onClick, onLongClick)
 *            .height(56.dp).padding(horizontal = MaterialTheme.padding.medium (16dp)),
 *       verticalAlignment = Alignment.CenterVertically)
 *     MangaCover.Square(Modifier.padding(vertical = 6.dp).fillMaxHeight(), shape = extraSmall)
 *       -> 56dp row - 2 * 6dp = 44dp square cover, corner radius 4dp (shapes.extraSmall)
 *     Column(Modifier.padding(horizontal = 16.dp).weight(1f))
 *       Text(mangaTitle, maxLines = 1, bodyMedium, ellipsis,
 *            color = LocalContentColor.copy(alpha = if (read) DISABLED_ALPHA else 1f))
 *       Row(verticalAlignment = CenterVertically)
 *         if (!read) Icon(RoundedFilled.Circle, height 8.dp, padding end 4.dp, tint = primary)
 *         if (bookmark) Icon(RoundedFilled.Bookmark, maxHeight = textHeight - 2.dp, tint = primary)
 *                        + Spacer(2.dp)
 *         Text(chapterName, maxLines = 1, bodySmall, ellipsis, weight(1f, fill = false),
 *              color = LocalContentColor.copy(alpha = textAlpha))
 *         if (readProgress != null) { DotSeparatorText() ; Text(readProgress, alpha = DISABLED_ALPHA) }
 *     ChapterDownloadIndicator(Modifier.padding(start = 4.dp))
 *       -> 40dp state layer, 26dp icon; NOT_DOWNLOADED = DownloadCircle tinted onSurfaceVariant
 *          with the whole box at secondaryItemAlpha (0.78); DOWNLOADED = RoundedFilled.CheckCircle.
 *
 * `DISABLED_ALPHA` = 0.38 and `SECONDARY_ALPHA` = 0.78
 * (mihon/presentation-core/.../components/material/Constants.kt).
 * The selected background is `colorScheme.secondary` at 0.16 (dark) / 0.22 (light)
 * (mihon/presentation-core/.../util/Modifier.kt:29-35).
 *
 * Suwayomi's REST v1 has no per-chapter download queue endpoint (the queue lives behind the
 * GraphQL API), so the download indicator only mirrors the server's `downloaded` flag and its
 * click opens the same honest "not supported in the web version" dialog the bulk bar uses.
 */
import { computed } from 'vue'
import type { MangaChapter } from '@/core/api/types'
import ChapterDownloadIndicator from '@/features/manga/components/ChapterDownloadIndicator.vue'

const props = defineProps<{
  entry: MangaChapter
  /** `UpdatesItem.selected` — draws the selected background. */
  selected?: boolean
  /** `state.selectionMode` — the cover and the download indicator become inert. */
  selectionMode?: boolean
  /** `MR.strings.chapter_progress` — "Page: N" when the chapter was started but not read. */
  readProgress?: string | null
  /** Cover image URL (`MangaCover.Square` data). */
  coverUrl?: string
}>()

const emit = defineEmits<{
  /** `onOpenChapter` — opens the chapter. */
  open: [event?: MouseEvent]
  /** `onUpdateSelected(item, !selected, false)` — a plain tap while the selection is active. */
  'toggle-select': []
  /** `onUpdateSelected(item, !selected, true)` — a long press enters the selection mode. */
  'long-press': []
  /** The cover click of the reference (`onClickCover`) — opens the manga. */
  'open-manga': []
  /** The download indicator click of the reference (`onDownloadChapter`). */
  'download': [action?: 'start' | 'start-now' | 'cancel' | 'delete']
}>()

const chapter = computed(() => props.entry.chapter)
/** `readProgress` of the reference: only for a started but unread chapter. */
const progress = computed(() => {
  if (props.readProgress) return props.readProgress
  if (chapter.value.read || chapter.value.lastPageRead <= 0) return null
  return `Page: ${chapter.value.lastPageRead + 1}`
})

/** `MangaCover.Square` renders the cover with ContentScale.Crop. */
const coverStyle = computed(() => (props.coverUrl ? { backgroundImage: `url(${props.coverUrl})` } : undefined))

const LONG_PRESS_MS = 500
const TOUCH_SLOP_PX = 8
let pressTimer: number | undefined
let longPressed = false
let startX = 0
let startY = 0

function onPointerDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  window.clearTimeout(pressTimer)
  longPressed = false
  startX = event.clientX
  startY = event.clientY
  pressTimer = window.setTimeout(() => {
    longPressed = true
    emit('long-press')
    try { navigator.vibrate?.(20) } catch { /* haptics are optional in the browser */ }
  }, LONG_PRESS_MS)
}

function onPointerMove(event: PointerEvent) {
  if (pressTimer === undefined) return
  if (Math.hypot(event.clientX - startX, event.clientY - startY) > TOUCH_SLOP_PX) {
    window.clearTimeout(pressTimer)
    pressTimer = undefined
  }
}

function onPointerUp() {
  window.clearTimeout(pressTimer)
  pressTimer = undefined
}

/** A tap that followed a long press must not also open the chapter. */
function onClick(event?: MouseEvent | KeyboardEvent) {
  if (longPressed) { longPressed = false; return }
  if (props.selectionMode && event && 'shiftKey' in event && event.shiftKey) {
    emit('long-press')
    return
  }
  emit('open', event instanceof MouseEvent ? event : undefined)
}

/** ChapterDownloadIndicator reports its actions; the parent owns the download. */
function onDownloadAction(action: 'start' | 'start-now' | 'cancel' | 'delete') {
  emit('download', action)
}
</script>

<template>
  <div
    class="updates-item"
    :class="{ 'is-selected': selected, 'is-read': chapter.read }"
    role="button"
    tabindex="0"
    :aria-label="`${chapter.name} — ${entry.manga.title}`"
    @click="onClick"
    @keydown.enter.prevent="onClick"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointerleave="onPointerUp"
    @pointercancel="onPointerUp"
    @contextmenu.prevent
  >
    <!-- MangaCover.Square: 44dp square, shapes.extraSmall (4dp) corners, ContentScale.Crop. -->
    <button
      v-if="!selectionMode"
      type="button"
      class="updates-item-cover"
      :aria-label="`Open ${entry.manga.title}`"
      @click.stop="emit('open-manga')"
    >
      <span class="updates-item-cover-image" :style="coverStyle" />
    </button>
    <span v-else class="updates-item-cover" aria-hidden="true">
      <span class="updates-item-cover-image" :style="coverStyle" />
    </span>

    <div class="updates-item-text">
      <!-- The whole row is clickable in the reference (`combinedClickable`); the title is a
           real link so the chapter can be opened with the keyboard and with the middle mouse
           button as well. -->
      <router-link
        v-if="!selectionMode"
        class="updates-item-title"
        :to="`/manga/${entry.manga.id}/read/${chapter.index}`"
        :aria-label="`Read ${chapter.name} — ${entry.manga.title}`"
        @click.stop
      >{{ entry.manga.title }}</router-link>
      <p v-else class="updates-item-title">{{ entry.manga.title }}</p>
      <div class="updates-item-subtitle">
        <!-- MaterialSymbols.RoundedFilled.Circle: 8dp high, 4dp end padding, primary tint. -->
        <span v-if="!chapter.read" class="updates-item-unread" role="img" aria-label="Unread" />
        <!-- MaterialSymbols.RoundedFilled.Bookmark: tinted primary, 2dp spacer after it. -->
        <v-icon v-if="chapter.bookmarked" icon="bookmark" size="14" class="updates-item-bookmark" aria-label="Bookmarked" />
        <span class="updates-item-chapter">{{ chapter.name }}</span>
        <template v-if="progress">
          <!-- DotSeparatorText: " • " -->
          <span class="updates-item-separator" aria-hidden="true"> • </span>
          <span class="updates-item-progress">{{ progress }}</span>
        </template>
      </div>
    </div>

    <!-- ChapterDownloadIndicator: 40dp state layer, 26dp icon, 4dp start padding. -->
    <ChapterDownloadIndicator
      v-if="!selectionMode"
      class="updates-item-download"
      :state="chapter.downloaded ? 'downloaded' : 'not-downloaded'"
      :chapter-title="chapter.name"
      @action="onDownloadAction"
    />
    <span v-else class="updates-item-download" aria-hidden="true">
      <ChapterDownloadIndicator
        :state="chapter.downloaded ? 'downloaded' : 'not-downloaded'"
        :chapter-title="chapter.name"
        disabled
      />
    </span>
  </div>
</template>

<style scoped>
@layer app-components {
/* Row: height 56dp, horizontal padding 16dp, centered vertically. */
.updates-item {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  height: 56px;
  padding: 0 16px;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface));
  -webkit-tap-highlight-color: transparent;
}
/* selectedBackground(selected): colorScheme.secondary at 0.16 (dark) / 0.22 (light via main.scss). */
.updates-item.is-selected {
  background: color-mix(in srgb, rgb(var(--v-theme-secondary)) 22%, transparent);
}
.updates-item:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 4%, transparent); }
.updates-item.is-selected:hover { background: color-mix(in srgb, rgb(var(--v-theme-secondary)) 26%, transparent); }

/* MangaCover.Square: 56dp row - 2 * 6dp vertical padding = 44dp square, 4dp radius. */
.updates-item-cover {
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  margin: 6px 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  overflow: hidden;
  background: rgb(136 136 136 / 12%);
  display: block;
  cursor: pointer;
}
.updates-item-cover-image {
  display: block;
  width: 100%;
  height: 100%;
  background-color: rgb(136 136 136 / 12%);
  background-size: cover;
  background-position: center;
}

/* Column: horizontal padding 16dp, weight 1f. */
.updates-item-text {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
/* Text(mangaTitle): bodyMedium (14sp / 20sp, weight 400), single line, ellipsis. */
.updates-item-title {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-decoration: none;
}
/* Text(chapterName): bodySmall (12sp / 16sp, weight 400). */
.updates-item-subtitle {
  display: flex;
  align-items: center;
  min-width: 0;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.0333333333em;
  color: rgb(var(--v-theme-on-surface));
}
.updates-item.is-read .updates-item-title,
.updates-item.is-read .updates-item-subtitle {
  /* LocalContentColor.copy(alpha = DISABLED_ALPHA) */
  color: rgb(var(--v-theme-on-surface) / 0.38);
}
/* MaterialSymbols.RoundedFilled.Circle: 8dp high, 4dp end padding, primary tint. */
.updates-item-unread {
  flex: 0 0 8px;
  width: 8px;
  height: 8px;
  margin-inline-end: 4px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
}
/* MaterialSymbols.RoundedFilled.Bookmark: primary tint, followed by a 2dp spacer. */
.updates-item-bookmark {
  flex: 0 0 auto;
  margin-inline-end: 2px;
  color: rgb(var(--v-theme-primary));
}
.updates-item-bookmark :deep(.v-icon__svg),
.updates-item-bookmark :deep(.material-symbols-rounded) { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20; }
.updates-item-chapter {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* DotSeparatorText: " • " */
.updates-item-separator { flex: 0 0 auto; }
/* The read progress is drawn at DISABLED_ALPHA. */
.updates-item-progress {
  flex: 0 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: rgb(var(--v-theme-on-surface) / 0.38);
}

/* ChapterDownloadIndicator: 40dp state layer with a 26dp icon and a 4dp start padding. */
.updates-item-download {
  flex: 0 0 auto;
}
}
</style>
