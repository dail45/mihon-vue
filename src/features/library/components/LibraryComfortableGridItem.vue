<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Manga } from '@/core/api/types'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import { useSuwayomiStore } from '../stores/suwayomi'
import MangaBadges from '@/features/manga/components/MangaBadges.vue'

/**
 * Pixel-parity implementation of Mihon's `LibraryComfortableGrid.kt` ->
 * `MangaComfortableGridItem` in `CommonMangaItem.kt`.
 *
 * References:
 * - `mihon/app/src/main/java/eu/kanade/presentation/library/components/LibraryComfortableGrid.kt`
 * - `mihon/app/src/main/java/eu/kanade/presentation/library/components/CommonMangaItem.kt`
 * - `mihon/app/src/main/java/eu/kanade/presentation/manga/components/MangaCover.kt`
 * - `mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/Badges.kt`
 *
 * Geometry & design tokens:
 * - `GridItemSelectable`:
 *   - clip `MaterialTheme.shapes.small` (8dp)
 *   - `selectedOutline(isSelected, colorScheme.secondary)` drawn behind content
 *   - `padding(4.dp)`
 *   - content color `onSecondary` when selected, `onSurface` otherwise
 *   - `combinedClickable(onClick, onLongClick)`: 500ms long press with 8px touch slop
 *   - `user-select: none` prevents accidental browser text highlight during touch hold
 * - `MangaGridCover`:
 *   - `aspectRatio(MangaCover.Book.ratio)` = 2 / 3
 *   - `MangaCover.Book`: clipped to `shapes.extraSmall` (4dp)
 *   - placeholder plate `0x1F888888` (`#8888881f`) and `cover_error` SVG icon
 *   - selected cover alpha `GRID_SELECTED_COVER_ALPHA = 0.76`
 *   - badges: start (Downloads, Unread) and end (Language / Local) at `padding(4.dp)`
 * - `GridItemTitle` below the cover:
 *   - `padding(4.dp)`
 *   - typography: `titleSmall` (500 medium, letter spacing 0.1px)
 *   - `fontSize = 12.sp, lineHeight = 18.sp`
 *   - `minLines = 2` (min-height: 36px) ensuring uniform card height across grid rows
 *   - `maxLines = 2`, ellipsis overflow
 * - `ContinueReadingButton`:
 *   - size `ContinueReadingButtonSizeLarge = 32.dp`, icon `ContinueReadingButtonIconSizeLarge = 20.dp`
 *   - `shape = MaterialTheme.shapes.small` (8dp)
 *   - `primaryContainer` 90% alpha, content color `onPrimaryContainer`
 *   - positioned in `MangaGridCover` at `Alignment.BottomEnd` with `padding(6.dp)` (10px from tile edge)
 *   - pointerdown/pointerup isolation preventing horizontal pager swipe conflicts
 */
const props = withDefaults(defineProps<{
  manga: Manga
  nextUnread?: number | null
  selected?: boolean
  selectionMode?: boolean
  panorama?: boolean
}>(), { nextUnread: null, selected: false, selectionMode: false, panorama: false })

const emit = defineEmits<{
  (event: 'toggle', id: number): void
  (event: 'range', id: number): void
  (event: 'no-next-chapter', id: number): void
}>()

const server = useSuwayomiStore()
const prefs = usePreferencesStore()
const isPanorama = computed(() => props.panorama || prefs.libraryDisplay === 'comfortable-panorama')
const broken = ref(false)
watch(() => [server.apiUrl, props.manga.id], () => { broken.value = false })

/**
 * `LibraryComfortableGrid.kt` passes `onClickContinueReading` when
 * `onClickContinueReading != null && libraryItem.unreadCount > 0`.
 * Gated by `prefs.showContinue` from `LibraryTab.kt`.
 */
const showContinue = computed(() => prefs.showContinue && (props.manga.unreadCount ?? 0) > 0)
const continueHref = computed(() => props.nextUnread == null ? '' : `/manga/${props.manga.id}/read/${props.nextUnread}`)

/**
 * `LibraryTab.kt`: when the server has no next chapter the reader is not opened and
 * the `no_next_chapter` snackbar is shown instead.
 */
function onContinueClick(event: MouseEvent) {
  event.preventDefault()
  if (props.nextUnread == null) {
    emit('no-next-chapter', props.manga.id)
  }
}

/** Large resume button for comfortable grid: 32dp size, 20dp icon. */
const continueSize = 32
const continueIcon = 20

/* ------------------------------------------------------------------ *
 * Gestures: Mihon `combinedClickable(onClick, onLongClick)`
 * ------------------------------------------------------------------ */
const LONG_PRESS_MS = 500
const TOUCH_SLOP_PX = 8
let pressTimer: number | undefined
let longPressed = false
let startX = 0
let startY = 0

function onPointerDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  longPressed = false
  startX = event.clientX
  startY = event.clientY
  window.clearTimeout(pressTimer)
  pressTimer = window.setTimeout(() => {
    longPressed = true
    emit('range', props.manga.id)
    try { navigator.vibrate?.(20) } catch { /* haptics are optional */ }
    window.setTimeout(() => { longPressed = false }, 400)
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

function onContextMenu(event: MouseEvent) {
  event.preventDefault()
  emit('range', props.manga.id)
}

function onClick(event: MouseEvent) {
  if (longPressed) {
    // The long press already handled this gesture; the tap must not open the item.
    longPressed = false
    event.preventDefault()
    event.stopPropagation()
    return
  }
  if (props.selectionMode) {
    // `LibraryContent.kt`: a tap toggles the selection while one exists.
    event.preventDefault()
    event.stopPropagation()
    emit('toggle', props.manga.id)
  }
}

function onSpaceKey(event: KeyboardEvent) {
  if (props.selectionMode) {
    event.preventDefault()
    emit('toggle', props.manga.id)
  }
}

onBeforeUnmount(onPointerUp)
</script>

<template>
  <!--
    `GridItemSelectable`: the clickable node is the whole padded box
    (`Box.clip(shapes.small).combinedClickable(...).selectedOutline(...).padding(4.dp)`),
    so the link below carries the 4dp padding while the selection rectangle is
    painted behind the content.
  -->
  <div class="comfortable-tile" :class="{ 'comfortable-tile-selected': selected }">
    <router-link
      :to="`/manga/${manga.id}`"
      class="comfortable-tile-link manga-card"
      :aria-label="`${manga.title}, ${manga.unreadCount ?? 'unknown'} unread chapters`"
      :aria-pressed="selected ? 'true' : undefined"
      @click.capture="onClick"
      @keydown.space="onSpaceKey"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerUp"
      @contextmenu="onContextMenu"
      v-ripple
    >
      <!-- Column { MangaGridCover(...), GridItemTitle(...) } -->
      <div class="comfortable-cover" :class="{ 'comfortable-cover-panorama': isPanorama }">
        <!--
          `MangaCover.Book(modifier = Modifier.fillMaxWidth().alpha(if (isSelected)
          GRID_SELECTED_COVER_ALPHA else coverAlpha), data = coverData)` - the alpha covers
          the whole cover plate, the loaded image as well as the error drawable.
        -->
        <div class="comfortable-cover-media" :class="{ 'comfortable-cover-selected': selected }">
          <v-img
            v-if="!broken"
            :src="server.thumbnailUrl(manga.id)"
            cover
            alt=""
            class="comfortable-cover-image"
            loading="lazy"
            decoding="async"
            @error="broken = true"
          />
          <!--
            MangaCover.kt: the error state is the `cover_error` drawable - a #1F888888 plate
            with the 24dp image vector (inset 48dp) drawn in the same colour.
          -->
          <div v-else class="comfortable-cover-fallback">
            <svg class="comfortable-cover-fallback-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
              <path fill="#8888881f" d="M21,5v6.59l-2.29,-2.3c-0.39,-0.39 -1.03,-0.39 -1.42,0L14,12.59 10.71,9.3c-0.39,-0.39 -1.02,-0.39 -1.41,0L6,12.59 3,9.58L3,5c0,-1.1 0.9,-2 2,-2h14c1.1,0 2,0.9 2,2zM18,11.42l3,3.01L21,19c0,1.1 -0.9,2 -2,2L5,21c-1.1,0 -2,-0.9 -2,-2v-6.58l2.29,2.29c0.39,-0.39 1.02,-0.39 1.41,0l3.3,-3.3 3.29,3.29c0.39,-0.39 1.02,-0.39 1.41,0l3.3,-3.28z" />
            </svg>
          </div>
        </div>
        <!-- MangaGridCover.kt badges: `BadgeGroup(Modifier.padding(4.dp).align(TopStart / TopEnd))`. -->
        <MangaBadges :manga="manga" side="start" class="comfortable-badges-start" />
        <MangaBadges :manga="manga" side="end" class="comfortable-badges-end" />
      </div>

      <!--
        GridItemTitle.kt: placed below the cover with 4dp padding, style = titleSmall,
        fontSize = 12.sp, lineHeight = 18.sp, minLines = 2, maxLines = 2.
      -->
      <div class="comfortable-title">
        <span class="manga-title-text">{{ manga.title }}</span>
      </div>
    </router-link>

    <!--
      ContinueReadingButton.kt: a FilledIconButton (8dp shape) with
      `primaryContainer.copy(alpha = 0.9f)` and `contentColorFor(primaryContainer)`.
      In the comfortable grid it is aligned to the bottom end of the cover with 6dp padding.
      The anchor mirrors the cover geometry (4dp inset, 2:3 ratio) so the button sits exactly
      on the cover plate and does not overlap the title below.
    -->
    <div v-if="showContinue" class="comfortable-cover-anchor" :class="{ 'comfortable-cover-panorama': isPanorama }">
      <router-link
        v-if="continueHref"
        :to="continueHref"
        class="continue-reading comfortable-continue"
        :style="{ width: `${continueSize}px`, height: `${continueSize}px` }"
        :aria-label="`Resume ${manga.title}`"
        v-ripple
        @click.stop
        @pointerdown.stop
        @pointerup.stop
      >
        <v-icon icon="play_arrow" :size="continueIcon" class="filled-symbol" />
      </router-link>
      <button
        v-else
        type="button"
        class="continue-reading comfortable-continue"
        :style="{ width: `${continueSize}px`, height: `${continueSize}px` }"
        :aria-label="`Resume ${manga.title}`"
        v-ripple
        @click.stop="onContinueClick"
        @pointerdown.stop
        @pointerup.stop
      >
        <v-icon icon="play_arrow" :size="continueIcon" class="filled-symbol" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/*
 * GridItemSelectable: `Box.clip(MaterialTheme.shapes.small)` (8dp) + `padding(4.dp)`,
 * with the `selectedOutline` rectangle (colorScheme.secondary) drawn behind the content.
 * The clickable node is the padded box itself, so the padding lives on the link.
 */
.comfortable-tile {
  position: relative;
  min-width: 0;
  border-radius: 8px;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.comfortable-tile-link {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 4px;
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
}

/*
 * `selectedOutline` = `drawBehind { if (isSelected) drawRect(colorScheme.secondary) }`:
 * a full rectangle in the secondary colour painted behind the tile content.
 * LocalContentColor provides onSecondary when selected.
 */
.comfortable-tile-selected {
  background: rgb(var(--v-theme-secondary));
  color: rgb(var(--v-theme-on-secondary));
}

.comfortable-tile-selected .comfortable-title {
  color: rgb(var(--v-theme-on-secondary));
}

/* MangaGridCover: fillMaxWidth + aspectRatio(MangaCover.Book.ratio) = 2/3. In panorama: 16/9. */
.comfortable-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 4px;
  overflow: hidden;
  background: #8888881f;
}

.comfortable-cover.comfortable-cover-panorama {
  aspect-ratio: 16 / 9;
}

/* The cover plate carries the selected alpha (GRID_SELECTED_COVER_ALPHA = 0.76). */
.comfortable-cover-media {
  position: absolute;
  inset: 0;
}

.comfortable-cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.comfortable-cover-image :deep(img) {
  object-fit: cover;
}

/* GRID_SELECTED_COVER_ALPHA = 0.76. */
.comfortable-cover-selected {
  opacity: 0.76;
}

/* `cover_error.xml`: the #1F888888 placeholder plate with the 24dp image glyph. */
.comfortable-cover-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: #8888881f;
}

/* MangaGridCover badges: 4dp padding, top-start / top-end. */
.comfortable-badges-start {
  position: absolute;
  top: 4px;
  left: 4px;
  pointer-events: none;
}

.comfortable-badges-end {
  position: absolute;
  top: 4px;
  right: 4px;
  pointer-events: none;
}

/*
 * GridItemTitle: 12sp / 18sp, titleSmall (Medium / 500), letter spacing 0.1px,
 * minLines = 2, maxLines = 2.
 * min-height: 36px (2 lines * 18px line-height) guarantees aligned heights in the grid row.
 */
.comfortable-title {
  padding: 4px;
  color: rgb(var(--v-theme-on-surface));
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  letter-spacing: 0.1px;
}

.comfortable-title .manga-title-text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  overflow-wrap: anywhere;
  word-break: break-word;
  min-height: 36px;
}

/*
 * MangaGridCover `content` slot: ContinueReadingButton aligned to BottomEnd with 6dp padding.
 * The cover anchor mirrors the cover geometry (4dp tile inset, 2:3 ratio).
 */
.comfortable-cover-anchor {
  position: absolute;
  top: 4px;
  left: 4px;
  right: 4px;
  aspect-ratio: 2 / 3;
  pointer-events: none;
}

.comfortable-cover-anchor.comfortable-cover-panorama {
  aspect-ratio: 16 / 9;
}

/*
 * ContinueReadingButton: FilledIconButton with `MaterialTheme.shapes.small` (8dp),
 * `primaryContainer.copy(alpha = 0.9f)` and `contentColorFor(primaryContainer)`.
 * Aligned to bottom-end with 6dp padding inside the cover plate.
 */
.comfortable-continue {
  position: absolute;
  right: 6px;
  bottom: 6px;
  pointer-events: auto;
  z-index: 1;
  display: grid;
  place-items: center;
  border: 0;
  outline: none;
  padding: 0;
  cursor: pointer;
  border-radius: 8px;
  text-decoration: none;
  background: color-mix(in srgb, rgb(var(--v-theme-primary-container)) 90%, transparent);
  color: rgb(var(--v-theme-on-primary-container));
  transition: background 0.15s ease;
}

.comfortable-continue:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-primary-container)) 8%, color-mix(in srgb, rgb(var(--v-theme-primary-container)) 90%, transparent));
}
</style>
