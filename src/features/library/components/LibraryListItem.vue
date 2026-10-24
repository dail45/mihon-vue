<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Manga } from '@/core/api/types'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import { useSuwayomiStore } from '../stores/suwayomi'
import MangaBadges from '@/features/manga/components/MangaBadges.vue'

/**
 * Pixel-parity implementation of Mihon's `LibraryList.kt` and `MangaListItem` in `CommonMangaItem.kt`.
 *
 * References:
 * - `mihon/app/src/main/java/eu/kanade/presentation/library/components/LibraryList.kt`
 * - `mihon/app/src/main/java/eu/kanade/presentation/library/components/CommonMangaItem.kt` (`MangaListItem`)
 * - `mihon/presentation-core/src/main/java/tachiyomi/presentation/core/util/Modifier.kt` (`selectedBackground`)
 * - `mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/Badges.kt` (`BadgeGroup`)
 * - `mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/VerticalFastScroller.kt`
 * - `mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/LazyList.kt` (`FastScrollLazyColumn`)
 *
 * Geometry & design tokens:
 * - Row:
 *   - Height: 56.dp (56px)
 *   - Padding: horizontal = 16.dp, vertical = 8.dp (56px height - 16px vertical padding = 40px content height)
 *   - `selectedBackground(isSelected)`: secondary tint behind row (alpha 0.16 dark, 0.22 light)
 *   - `combinedClickable`: 500ms long press with 8px touch slop; context menu (right-click) triggers range selection
 *   - `v-ripple`: Material 3 ink ripple across the row
 *   - `user-select: none`: prevents text selection during press/gesture
 * - Cover (`MangaCover.Square`):
 *   - fillMaxHeight() = 40px, aspectRatio = 1:1 (40px x 40px)
 *   - clip shape: `shapes.extraSmall` (4dp)
 *   - placeholder: `0x1F888888` (`#8888881f`)
 *   - error: bare plate `#8888881f` (cover_error 48dp insets on 40dp square leaves bare plate)
 *   - alpha: 1.0f in Library; 0.34f in Catalogue for favorites (`BrowseFavoriteCoverAlpha`)
 * - Title (`Text`):
 *   - typography: `bodyMedium` (14sp / 20sp, weight 400, letter spacing 0.25px)
 *   - color: `onSurface`
 *   - padding horizontal 16.dp: 16px between cover and title, 16px between title and badges
 *   - maxLines = 2, TextOverflow.Ellipsis
 *   - weight(1f): flex-grow 1
 * - Badges (`BadgeGroup(content = badge)`):
 *   - clip shape: `shapes.extraSmall` (4dp)
 *   - content: DownloadsBadge (tertiary), UnreadBadge (secondary), LanguageBadge (tertiary)
 * - Continue Reading Button (`ContinueReadingButton`):
 *   - size: `ContinueReadingButtonSizeSmall` (28.dp), icon: `ContinueReadingButtonIconSizeSmall` (16.dp)
 *   - shape: `shapes.small` (8dp)
 *   - containerColor: `primaryContainer.copy(alpha = 0.9f)`, contentColor: `onPrimaryContainer`
 *   - start spacing: `ContinueReadingButtonListSpacing` (8.dp)
 *   - end spacing: 16dp (from row's horizontal padding)
 *   - isolated click/touch: prevents bubbling to row
 */
const props = withDefaults(defineProps<{
  manga: Manga
  catalogue?: boolean
  nextUnread?: number | null
  selected?: boolean
  selectionMode?: boolean
}>(), {
  catalogue: false,
  nextUnread: null,
  selected: false,
  selectionMode: false,
})

const emit = defineEmits<{
  (event: 'toggle', id: number): void
  (event: 'range', id: number): void
  (event: 'no-next-chapter', id: number): void
}>()

const router = useRouter()
const server = useSuwayomiStore()
const prefs = usePreferencesStore()
const broken = ref(false)

watch(() => [server.apiUrl, props.manga.id], () => { broken.value = false })

/**
 * `LibraryList.kt`:
 * `onClickContinueReading = if (onClickContinueReading != null && libraryItem.unreadCount > 0)`
 */
const showContinue = computed(() => {
  if (props.catalogue || !prefs.showContinue) return false
  return (props.manga.unreadCount ?? 0) > 0
})

const continueHref = computed(() => {
  if (props.nextUnread == null) return ''
  return `/manga/${props.manga.id}/read/${props.nextUnread}`
})

const coverAlpha = computed(() => {
  if (props.catalogue && props.manga.inLibrary) return 0.34
  return 1
})

/* ------------------------------------------------------------------ *
 * Gestures (Mihon `combinedClickable(onClick = …, onLongClick = …)`)
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
  if (props.catalogue) return
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
  if (props.catalogue) return
  if (longPressed) return
  longPressed = true
  emit('range', props.manga.id)
}

function onLinkClick(event: MouseEvent) {
  if (longPressed) {
    longPressed = false
    event.preventDefault()
    return
  }
  if (props.selectionMode) {
    event.preventDefault()
    emit('toggle', props.manga.id)
  }
}

function onRowClick() {
  if (longPressed) {
    longPressed = false
    return
  }
  if (props.selectionMode) {
    emit('toggle', props.manga.id)
  } else {
    void router.push(`/manga/${props.manga.id}`)
  }
}

function onSpaceKey(event: KeyboardEvent) {
  if (props.selectionMode) {
    event.preventDefault()
    emit('toggle', props.manga.id)
  }
}

function onEnterKey(event: KeyboardEvent) {
  if (props.selectionMode) {
    event.preventDefault()
    emit('toggle', props.manga.id)
  }
}

function onContinueClick(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  emit('no-next-chapter', props.manga.id)
}

onBeforeUnmount(onPointerUp)
</script>

<template>
  <div
    class="manga-list-row"
    :class="{ 'is-selected': selected }"
    v-ripple
    @click="onRowClick"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @pointerleave="onPointerUp"
    @contextmenu="onContextMenu"
  >
    <!--
      MangaListItem: Row(fillMaxWidth, height = 56dp, padding = (horizontal = 16dp, vertical = 8dp))
      The primary interactive link covers the cover, title, and badges.
    -->
    <router-link
      :to="`/manga/${manga.id}`"
      class="manga-list-link"
      :class="{ 'manga-list-link-selectable': selectionMode }"
      :role="selectionMode ? 'button' : undefined"
      :tabindex="selectionMode ? 0 : undefined"
      :aria-pressed="selectionMode ? (selected ? 'true' : 'false') : undefined"
      :aria-label="manga.title"
      @click.stop="onLinkClick"
      @keydown.space="onSpaceKey"
      @keydown.enter="onEnterKey"
    >
      <!--
        MangaCover.Square: fillMaxHeight() = 40px, aspectRatio = 1f (40x40),
        clip shape: shapes.extraSmall (4dp). Placeholder plate #8888881f.
      -->
      <v-img
        v-if="!broken"
        :src="server.thumbnailUrl(manga.id)"
        class="list-cover-image"
        :style="{ opacity: coverAlpha }"
        width="40"
        min-width="40"
        height="40"
        cover
        alt=""
        loading="lazy"
        decoding="async"
        @error="broken = true"
      />
      <span
        v-else
        class="list-cover-fallback"
        :style="{ opacity: coverAlpha }"
        aria-hidden="true"
      />

      <!--
        MangaListItem.kt: Text(text = title, modifier = Modifier.padding(horizontal = 16.dp).weight(1f),
        style = MaterialTheme.typography.bodyMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
      -->
      <span class="manga-list-title">{{ manga.title }}</span>

      <!-- BadgeGroup(content = badge): DownloadsBadge, UnreadBadge, LanguageBadge -->
      <MangaBadges :manga="manga" :catalogue="catalogue" side="all" class="list-badges" />
    </router-link>

    <!--
      ContinueReadingButton: FilledIconButton(size = 28dp, iconSize = 16dp, shape = shapes.small 8dp,
      colors = containerColor primaryContainer 90% alpha, contentColor onPrimaryContainer,
      modifier = Modifier.padding(start = ContinueReadingButtonListSpacing = 8.dp))
    -->
    <router-link
      v-if="showContinue && continueHref"
      :to="continueHref"
      class="continue-reading list-continue"
      :aria-label="`Resume ${manga.title}`"
      v-ripple
      @click.stop
      @pointerdown.stop
      @pointerup.stop
    >
      <v-icon icon="play_arrow" size="16" class="filled-symbol" />
    </router-link>
    <button
      v-else-if="showContinue"
      type="button"
      class="continue-reading list-continue"
      :aria-label="`Resume ${manga.title}`"
      v-ripple
      @click.stop="onContinueClick"
      @pointerdown.stop
      @pointerup.stop
    >
      <v-icon icon="play_arrow" size="16" class="filled-symbol" />
    </button>
  </div>
</template>

<style scoped>
/*
 * MangaListItem:
 * Row(modifier = Modifier.selectedBackground(isSelected).height(56.dp).combinedClickable(...).padding(horizontal = 16.dp, vertical = 8.dp))
 */
.manga-list-row {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 56px;
  min-width: 0;
  padding: 0 16px;
  box-sizing: border-box;
  overflow: hidden;
  user-select: none;
  cursor: pointer;
  background: transparent;
}

/* Modifier.selectedBackground(isSelected): secondary tint (0.16 dark, 0.22 light) */
.manga-list-row.is-selected {
  background: color-mix(in srgb, rgb(var(--v-theme-secondary)) 22%, transparent);
}
.v-theme--mihonDark .manga-list-row.is-selected {
  background: color-mix(in srgb, rgb(var(--v-theme-secondary)) 16%, transparent);
}

.manga-list-link {
  display: flex;
  align-items: center;
  flex: 1 1 0;
  min-width: 0;
  height: 56px;
  padding: 0;
  color: rgb(var(--v-theme-on-surface));
  text-decoration: none;
  box-sizing: border-box;
}

/* MangaCover.Square: 40x40, shapes.extraSmall = 4dp */
.list-cover-image {
  flex: 0 0 40px;
  width: 40px;
  min-width: 40px;
  max-width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  box-sizing: border-box;
}

.list-cover-fallback {
  display: grid;
  place-items: center;
  flex: 0 0 40px;
  width: 40px;
  min-width: 40px;
  max-width: 40px;
  height: 40px;
  background: #8888881f;
  border-radius: 4px;
  overflow: hidden;
  box-sizing: border-box;
}

/* Text: bodyMedium (14sp / 20sp w400, letterSpacing 0.25sp, color: onSurface) */
/* Text.padding(horizontal = 16.dp): 16px from cover, 16px from badges */
.manga-list-title {
  min-width: 0;
  flex: 1 1 0;
  margin: 0 16px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface));
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
}

.list-badges {
  flex-shrink: 0;
}

/* ContinueReadingButton: 28dp x 28dp, 8dp shape, 8dp start spacing */
.continue-reading.list-continue {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  margin-left: 8px;
}
</style>
