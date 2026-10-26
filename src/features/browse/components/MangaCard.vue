<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Manga } from '@/core/api/types'
import { usePreferencesStore, type DisplayMode } from '@/features/settings/stores/preferences'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import MangaBadges from '@/features/manga/components/MangaBadges.vue'

/**
 * Mirrors `presentation/library/components/CommonMangaItem.kt`.
 *
 * - `MangaCompactGridItem` - the title is drawn over the cover (`CoverTextOverlay`); the
 *   cover-only variant (`title = null`) shows the large "Resume" button on the cover.
 * - `MangaComfortableGridItem` - the cover carries the large "Resume" button and the title
 *   is placed below the cover (`GridItemTitle` with 4dp padding).
 * - `GridItemSelectable` - 4dp padding, clipped to `MaterialTheme.shapes.small` and the
 *   `selectedOutline` rectangle painted in `colorScheme.secondary` when the item is selected;
 *   a selected cover uses `GRID_SELECTED_COVER_ALPHA` (0.76) and the content colour becomes
 *   `colorScheme.onSecondary`.
 * - `MangaGridCover` - `fillMaxWidth()` + `aspectRatio(MangaCover.Book.ratio)` = 2/3, with the
 *   badge groups in the top start / top end corners (4dp padding) and the resume button in the
 *   `content` slot (bottom end, 6dp padding).
 */
const props = withDefaults(defineProps<{ manga: Manga; catalogue?: boolean; display?: DisplayMode; nextUnread?: number | null; selected?: boolean; selectionMode?: boolean }>(), { display: 'compact', nextUnread: null, catalogue: false, selected: false, selectionMode: false })
const emit = defineEmits<{ (event: 'toggle', id: number): void; (event: 'range', id: number): void; (event: 'no-next-chapter', id: number): void }>()
const server = useSuwayomiStore(), prefs = usePreferencesStore(), broken = ref(false)
const router = useRouter()
watch(() => [server.apiUrl, props.manga.id], () => { broken.value = false })
/**
 * `LibraryComfortableGrid.kt` passes the resume action when
 * `onClickContinueReading != null && libraryItem.unreadCount > 0`; the preference itself is
 * applied in `LibraryTab.kt` (`state.showMangaContinueButton`).
 */
const showContinue = computed(() => !props.catalogue && prefs.showContinue && (props.manga.unreadCount ?? 0) > 0)
const continueHref = computed(() => props.nextUnread == null ? '' : `/manga/${props.manga.id}/read/${props.nextUnread}`)
/**
 * `LibraryTab.kt`: when the server has no next chapter the reader is not opened and the
 * `no_next_chapter` snackbar is shown instead.
 */
function onContinueClick(event: MouseEvent) {
  // The button is a sibling of the manga link, so the click never reaches the link, but the
  // default action is cancelled anyway so that the tile is not selected by the tap.
  event.preventDefault()
  if (props.nextUnread == null) {
    emit('no-next-chapter', props.manga.id)
    return
  }
  void router.push(`/manga/${props.manga.id}/read/${props.nextUnread}`)
}
// CommonMangaItem.kt: the title overlay exists only in the compact grid; the cover-only
// and the comfortable grid show the large resume button on the cover instead.
// The catalogue is different: `BrowseSourceCompactGrid.kt` always passes the title, so the
// cover-only catalogue grid keeps the overlay as well.
const overlayTitle = computed(() => props.display === 'compact' || (props.catalogue && props.display === 'covers'))
// The compact overlay uses the small button (28dp / 16dp icon), the plain covers the large one (32dp / 20dp).
const continueSize = computed(() => overlayTitle.value ? 'small' : 'large')
const continueIcon = computed(() => overlayTitle.value ? 16 : 20)
// Mihon uses combinedClickable: long press toggles a range selection instead of opening the item.
// In the catalogue the long press is the library action (`BrowseSourceScreen.kt` `onMangaLongClick`),
// so the tile never emits a range selection there: `SourceView` owns that gesture.
const LONG_PRESS_MS = 500
const TOUCH_SLOP_PX = 8
let pressTimer: number | undefined
let longPressed = false
let startX = 0
let startY = 0

function onPointerDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  longPressed = false
  if (props.catalogue) return
  startX = event.clientX
  startY = event.clientY
  if (pressTimer !== undefined) {
    window.clearTimeout(pressTimer)
  }
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
  if (pressTimer !== undefined) {
    window.clearTimeout(pressTimer)
    pressTimer = undefined
  }
}

function onPointerLeave() {
  onPointerUp()
}

function onContextMenu(event: MouseEvent) {
  event.preventDefault()
  if (props.catalogue) return
  if (longPressed) return
  longPressed = true
  emit('range', props.manga.id)
}

function onClick(event: MouseEvent) {
  if (longPressed) { event.preventDefault(); longPressed = false; return }
  if (props.selectionMode) { event.preventDefault(); emit('toggle', props.manga.id) }
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
  <div class="manga-tile" :class="[`manga-tile-${display}`, { 'manga-tile-selected': selected }]">
    <!--
      `GridItemSelectable`: `Box.clip(shapes.small).combinedClickable(onClick, onLongClick)`.
      `combinedClickable` draws the M3 ripple indication, so the tile is a ripple host.
      The 4dp padding of the reference box lives on the link, so the whole tile - padding
      included - is the clickable and the ripple target, exactly like `Box.padding(4.dp)`.
    -->
    <!-- v-ripple replaced by CSS :hover / :active for performance -->
    <router-link
      :to="`/manga/${manga.id}`"
      class="manga-card manga-tile-link"
      :class="`manga-card-${display}`"
      :aria-label="catalogue ? `${manga.title}${manga.inLibrary ? ', in library' : ''}` : `${manga.title}, ${manga.unreadCount ?? 'unknown'} unread chapters`"
      :aria-pressed="selected ? 'true' : undefined"
      @click="onClick"
      @keydown.space="onSpaceKey"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerLeave"
      @contextmenu="onContextMenu"
    >
      <!-- MangaGridCover.kt: fillMaxWidth + aspectRatio(MangaCover.Book.ratio = 2f/3f). -->
      <div class="manga-grid-cover">
        <!--
          `MangaCover.Book` clips the image itself to `MaterialTheme.shapes.extraSmall` (4dp).
          The cover box is not clipped, so the badge groups keep their own shape.
        -->
        <div class="manga-cover-media" :class="{ 'manga-cover-selected': selected }">
          <img
            v-if="!broken"
            :src="server.thumbnailUrl(manga.id)"
            alt=""
            class="manga-cover-image"
            loading="lazy"
            decoding="async"
            :class="{
              'in-library-cover': catalogue && manga.inLibrary,
              'in-library-cover-fav': catalogue && !manga.inLibrary && Boolean(manga.favorite),
            }"
            @error="broken = true"
          />
          <!--
            MangaCover.kt: the error state is the `cover_error` drawable - a #1F888888 plate with the
            24dp "hide image" vector (fillColor @color/cover_placeholder = #8888881f) centered inside it.
          -->
          <div
            v-else
            class="cover-fallback"
            :class="{
              'in-library-cover': catalogue && manga.inLibrary,
              'in-library-cover-fav': catalogue && !manga.inLibrary && Boolean(manga.favorite),
            }"
          >
            <svg class="cover-fallback-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
              <path fill="#8888881f" d="M21,5v6.59l-2.29,-2.3c-0.39,-0.39 -1.03,-0.39 -1.42,0L14,12.59 10.71,9.3c-0.39,-0.39 -1.02,-0.39 -1.41,0L6,12.59 3,9.58L3,5c0,-1.1 0.9,-2 2,-2h14c1.1,0 2,0.9 2,2zM18,11.42l3,3.01L21,19c0,1.1 -0.9,2 -2,2L5,21c-1.1,0 -2,-0.9 -2,-2v-6.58l2.29,2.29c0.39,-0.39 1.02,-0.39 1.41,0l3.3,-3.3 3.29,3.29c0.39,-0.39 1.02,-0.39 1.41,0l3.3,-3.28z" />
            </svg>
          </div>
        </div>
        <!-- CoverTextOverlay.kt: a gradient clipped to the bottom rounded corners of the cover. -->
        <span v-if="overlayTitle" class="manga-shade" />
        <!-- GridItemTitle.kt: 12sp / 18sp, weight Medium, white with a black shadow, minLines = 1. -->
        <div v-if="overlayTitle" class="manga-title manga-title-overlay" :class="{ 'has-continue': showContinue }">
          <span class="manga-title-text">{{ manga.title }}</span>
        </div>
        <MangaBadges :manga="manga" :catalogue="catalogue" side="start" class="grid-badges-start" />
        <MangaBadges v-if="!catalogue" :manga="manga" :catalogue="catalogue" side="end" class="grid-badges-end" />
        <!-- Selection checkmark overlay -->
        <div v-if="selected" class="selection-overlay" aria-hidden="true">
          <div class="selection-check-badge">
            <v-icon icon="check" size="20" color="on-primary" />
          </div>
        </div>
      </div>
      <!-- GridItemTitle.kt below the cover: minLines = 2, maxLines = 2, 4dp padding. -->
      <div v-if="display === 'comfortable'" class="manga-title manga-title-below">
        <span class="manga-title-text">{{ manga.title }}</span>
      </div>
    </router-link>
    <!--
      `MangaGridCover` draws the resume button in the `content` slot
      (`Modifier.padding(6.dp).align(Alignment.BottomEnd)`): inside the cover box, before the
      badge groups. The anchor mirrors the cover geometry (the 4dp inset of the tile and the
      2:3 ratio of the cover), so the button lands on the bottom end corner of the cover.
    -->
    <div v-if="showContinue" class="manga-cover-anchor">
      <router-link
        v-if="continueHref"
        :to="continueHref"
        class="continue-reading"
        :class="`continue-reading-${continueSize}`"
        :aria-label="manga.title ? `Resume ${manga.title}` : 'Resume'"
        @click.stop
        @pointerdown.stop
        @pointerup.stop
      >
        <v-icon icon="play_arrow" :size="continueIcon" class="filled-symbol" />
      </router-link>
      <button
        v-else
        type="button"
        class="continue-reading"
        :class="`continue-reading-${continueSize}`"
        :aria-label="manga.title ? `Resume ${manga.title}` : 'Resume'"
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
.manga-tile {
  contain: layout paint style;
}

.manga-cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.manga-tile-selected {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
  border-radius: 8px;
}

.selection-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-primary), 0.22);
  border-radius: 4px;
  z-index: 4;
  pointer-events: none;
}

.selection-check-badge {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}
</style>
