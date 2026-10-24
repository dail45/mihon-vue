<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Manga } from '@/core/api/types'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import { useSuwayomiStore } from '../stores/suwayomi'
import MangaBadges from '@/features/manga/components/MangaBadges.vue'

/**
 * Mihon `presentation/library/components/LibraryCompactGrid.kt` ->
 * `MangaCompactGridItem` in `presentation/library/components/CommonMangaItem.kt`,
 * used by the `CompactGrid` and the `CoverOnlyGrid` library display modes.
 *
 * Geometry taken from the reference:
 * - `GridItemSelectable`: `Box.clip(MaterialTheme.shapes.small)` (= 8dp) with
 *   `selectedOutline(isSelected, colorScheme.secondary)` and `padding(4.dp)`.
 * - `MangaGridCover`: `Box.fillMaxWidth().aspectRatio(MangaCover.Book.ratio)` (= 2/3),
 *   cover shape `MaterialTheme.shapes.extraSmall` (= 4dp).
 * - `CoverTextOverlay`: the bottom 33% of the cover, vertical gradient transparent -> 0xAA000000,
 *   bottom corners rounded 4dp, title (`titleSmall`, 12sp / 18sp, white, black shadow)
 *   padded 8dp and, for the compact grid, the small continue button (28dp / 16dp icon)
 *   with 6dp end/bottom padding at the end of the title row.
 * - Cover-only grid: the large continue button (32dp / 20dp icon) aligned bottom-end
 *   with 6dp padding.
 * - Selected cover alpha: `GRID_SELECTED_COVER_ALPHA` = 0.76.
 */
const props = withDefaults(defineProps<{
  manga: Manga
  /** `compact` draws the title overlay, `covers` is the cover-only grid. */
  display?: 'compact' | 'covers'
  nextUnread?: number | null
  selected?: boolean
  selectionMode?: boolean
}>(), { display: 'compact', nextUnread: null, selected: false, selectionMode: false })

const emit = defineEmits<{
  (event: 'toggle', id: number): void
  (event: 'range', id: number): void
  (event: 'no-next-chapter', id: number): void
}>()

const server = useSuwayomiStore()
const prefs = usePreferencesStore()
const broken = ref(false)
watch(() => [server.apiUrl, props.manga.id], () => { broken.value = false })

/** `LibraryPager.kt`: `showTitle = displayMode is LibraryDisplayMode.CompactGrid`. */
const showTitle = computed(() => props.display === 'compact')
/**
 * `LibraryCompactGrid.kt` only offers the resume action when the entry actually has
 * unread chapters (`libraryItem.unreadCount > 0`); the button itself is additionally
 * gated by the "show continue reading button" preference in `LibraryTab.kt`.
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
/** `ContinueReadingButtonSizeSmall` 28dp / `IconSizeSmall` 16dp, large 32dp / 20dp. */
const continueSize = computed(() => showTitle.value ? 28 : 32)
const continueIcon = computed(() => showTitle.value ? 16 : 20)

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
  if (longPressed) return
  longPressed = true
  emit('range', props.manga.id)
}

function onClick(event: MouseEvent) {
  if (longPressed) {
    // The long press already handled this gesture; the tap must not open the item.
    longPressed = false
    event.preventDefault()
    return
  }
  if (props.selectionMode) {
    // `LibraryContent.kt`: a tap toggles the selection while one exists.
    event.preventDefault()
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
  <div class="compact-tile" :class="{ 'compact-tile-selected': selected }">
    <router-link
      :to="`/manga/${manga.id}`"
      class="compact-tile-link"
      :aria-label="`${manga.title}, ${manga.unreadCount ?? 'unknown'} unread chapters`"
      :aria-pressed="selected ? 'true' : undefined"
      @click="onClick"
      @keydown.space="onSpaceKey"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerUp"
      @contextmenu="onContextMenu"
      v-ripple
    >
      <!-- MangaGridCover.kt: fillMaxWidth + aspectRatio(MangaCover.Book.ratio = 2f/3f). -->
      <div class="compact-cover">
        <!--
          `MangaCover.Book(modifier = Modifier.fillMaxWidth().alpha(if (isSelected)
          GRID_SELECTED_COVER_ALPHA else coverAlpha), data = coverData)` - the alpha covers
          the whole cover plate, the loaded image as well as the error drawable.
        -->
        <div class="compact-cover-media" :class="{ 'compact-cover-selected': selected }">
          <v-img
            v-if="!broken"
            :src="server.thumbnailUrl(manga.id)"
            cover
            alt=""
            class="compact-cover-image"
            @error="broken = true"
          />
          <!--
            MangaCover.kt: the error state is the `cover_error` drawable - a #1F888888 plate
            with the 24dp image vector (inset 48dp) drawn in the same colour.
          -->
          <div v-else class="compact-cover-fallback">
            <svg class="compact-cover-fallback-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
              <path fill="#8888881f" d="M21,5v6.59l-2.29,-2.3c-0.39,-0.39 -1.03,-0.39 -1.42,0L14,12.59 10.71,9.3c-0.39,-0.39 -1.02,-0.39 -1.41,0L6,12.59 3,9.58L3,5c0,-1.1 0.9,-2 2,-2h14c1.1,0 2 0.9 2 2zM18,11.42l3,3.01L21,19c0,1.1 -0.9,2 -2,2L5,21c-1.1,0 -2,-0.9 -2,-2v-6.58l2.29,2.29c0.39,0.39 1.02,0.39 1.41,0l3.3,-3.3 3.29,3.29c0.39,0.39 1.02,0.39 1.41,0l3.3,-3.28z" />
            </svg>
          </div>
        </div>
        <!-- CoverTextOverlay.kt: a gradient clipped to the bottom rounded corners of the cover. -->
        <span v-if="showTitle" class="compact-overlay" />
        <!-- GridItemTitle.kt: 12sp / 18sp, weight Medium, white with a black shadow, minLines = 1. -->
        <div v-if="showTitle" class="compact-title" :class="{ 'has-continue': showContinue }">
          <span class="manga-title-text">{{ manga.title }}</span>
        </div>
        <!-- MangaGridCover.kt badges: `BadgeGroup(Modifier.padding(4.dp).align(TopStart / TopEnd))`. -->
        <MangaBadges :manga="manga" side="start" class="compact-badges-start" />
        <MangaBadges :manga="manga" side="end" class="compact-badges-end" />
      </div>
    </router-link>
    <!--
      ContinueReadingButton.kt: a FilledIconButton (8dp shape) with
      `primaryContainer.copy(alpha = 0.9f)` and `contentColorFor(primaryContainer)`.
      In the compact grid it sits at the end of the title row, in the cover-only grid
      it is aligned to the bottom end of the cover; both use 6dp padding.
    -->
    <router-link
      v-if="showContinue && continueHref"
      :to="continueHref"
      class="continue-reading compact-continue"
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
      v-else-if="showContinue"
      type="button"
      class="continue-reading compact-continue"
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
</template>

<style scoped>
/*
 * GridItemSelectable: `Box.clip(MaterialTheme.shapes.small)` (8dp) + `padding(4.dp)`,
 * with the `selectedOutline` rectangle (colorScheme.secondary) drawn behind the content.
 * The clickable node is the padded box itself, so the padding lives on the link.
 */
.compact-tile {
  position: relative;
  min-width: 0;
  border-radius: 8px;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.compact-tile-link {
  position: relative;
  display: block;
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
.compact-tile-selected {
  background: rgb(var(--v-theme-secondary));
  color: rgb(var(--v-theme-on-secondary));
}

/* MangaGridCover: fillMaxWidth + aspectRatio(MangaCover.Book.ratio) = 2/3. */
.compact-cover {
  position: relative;
  aspect-ratio: 2 / 3;
  border-radius: 4px;
  overflow: hidden;
  background: #8888881f;
}

/* The cover plate carries the selected alpha (GRID_SELECTED_COVER_ALPHA = 0.76). */
.compact-cover-media {
  position: absolute;
  inset: 0;
}

.compact-cover-image {
  width: 100%;
  height: 100%;
}

/* GRID_SELECTED_COVER_ALPHA = 0.76. */
.compact-cover-selected {
  opacity: 0.76;
}

/* `cover_error.xml`: the #1F888888 placeholder plate with the 24dp image glyph. */
.compact-cover-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: #8888881f;
}

/*
 * CoverTextOverlay: `fillMaxHeight(0.33f)` box at the bottom of the cover with a vertical
 * gradient transparent -> 0xAA000000 and 4dp rounded bottom corners.
 */
.compact-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 33%;
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
  background: linear-gradient(to bottom, transparent, #000a);
  pointer-events: none;
}

/*
 * GridItemTitle: 12sp / 18sp, white, black shadow, `titleSmall` weight, at most 2 lines.
 * The title sits in the overlay row; the resume button keeps 28dp + 6dp of space.
 */
.compact-title {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 8px;
  color: #fff;
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  letter-spacing: 0.1px;
  text-shadow: 0 0 4px #000;
  pointer-events: none;
}

.compact-title .manga-title-text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/*
 * The title row of `CoverTextOverlay` holds the resume button at its end
 * (`ContinueReadingButtonSizeSmall` 28dp + `ContinueReadingButtonGridPadding` 6dp), so the
 * title text keeps 34dp + its own 8dp padding = 42dp of free space on the right side.
 */
.compact-title.has-continue {
  padding-right: 42px;
}

/* MangaGridCover badges: 4dp padding, top-start / top-end. */
.compact-badges-start {
  position: absolute;
  top: 4px;
  left: 4px;
  pointer-events: none;
}

.compact-badges-end {
  position: absolute;
  top: 4px;
  right: 4px;
  pointer-events: none;
}

/*
 * ContinueReadingButton: FilledIconButton with `MaterialTheme.shapes.small` (8dp),
 * `primaryContainer.copy(alpha = 0.9f)` and `contentColorFor(primaryContainer)`.
 * The compact grid places it at the end of the title row (28dp, 6dp end/bottom padding),
 * the cover-only grid aligns it bottom-end (32dp, 6dp padding).
 */
.compact-continue {
  position: absolute;
  right: 10px;
  bottom: 10px;
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

.compact-continue:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-primary-container)) 8%, color-mix(in srgb, rgb(var(--v-theme-primary-container)) 90%, transparent));
}
</style>
