<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Manga } from '@/core/api/types'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import MangaBadges from '@/features/manga/components/MangaBadges.vue'

/**
 * Mirrors `presentation/browse/components/GlobalSearchCardRow.kt`
 * (Mihon commit 446f6df82c390ab760802c2fce3b677bce3f31c1).
 *
 * Reference geometry (dp = px at 1x):
 * - The row is a `LazyRow` with `contentPadding = PaddingValues(small = 8dp)` and
 *   `horizontalArrangement = Arrangement.spacedBy(extraSmall = 4dp)`.
 * - An empty result list renders `EmptyResultItem`: a `Text` ("No results found")
 *   with `padding(horizontal = medium = 16dp, vertical = small = 8dp)` and the
 *   default `bodyLarge` typography (16sp / 24sp / 0.5sp / Regular).
 * - Every entry is a `Box(Modifier.width(96.dp))` holding a
 *   `MangaComfortableGridItem` (`library/components/CommonMangaItem.kt`):
 *   - `GridItemSelectable` clips the item to `MaterialTheme.shapes.small`
 *     (8dp, MD3 `ShapeTokens.CornerSmall`), handles click/long click and adds
 *     `padding(4.dp)`.
 *   - The cover is `MangaCover.Book` (aspect ratio 2/3, clipped to
 *     `MaterialTheme.shapes.extraSmall` = 4dp) and takes the favourite dim
 *     (`CommonMangaItemDefaults.BrowseFavoriteCoverAlpha = 0.34f`).
 *   - `coverBadgeStart` draws `InLibraryBadge` (`BrowseBadges.kt`) inside a
 *     `BadgeGroup` (`presentation-core/.../components/Badges.kt`) padded 4dp at
 *     the top-start corner: `secondary` container, `onSecondary` content,
 *     `bodySmall` typography (12sp / 16sp / 0.4sp / Medium), 3dp horizontal and
 *     1dp vertical padding, 12dp icon, group clipped to `extraSmall` (4dp).
 *   - The title sits under the cover with `padding(4.dp)`, `titleSmall` typography
 *     with `fontSize = 12.sp` / `lineHeight = 18.sp`, `minLines = 2`,
 *     `maxLines = 3` (the row asks for `titleMaxLines = 3`), ellipsis overflow.
 *
 * The reference favourite flag is `Manga.favorite`; the Suwayomi REST client
 * exposes the same flag as `inLibrary`.
 */
const props = withDefaults(defineProps<{
  /** `GlobalSearchCardRow.kt` -> `titles: List<Manga>`. */
  titles: Manga[]
  /** `GlobalSearchCardRow.kt` -> `onClick: (Manga) -> Unit`. */
  onClick?: (manga: Manga) => void
  /** `GlobalSearchCardRow.kt` -> `onLongClick: (Manga) -> Unit`. */
  onLongClick?: (manga: Manga) => void
}>(), {
  onClick: undefined,
  onLongClick: undefined,
})

const server = useSuwayomiStore()
const router = useRouter()

const broken = ref(new Set<number>())
watch(() => server.apiUrl, () => { broken.value = new Set<number>() })

/** Compose `combinedClickable` reports the long click after 500ms as well. */
const longPressDelay = 500
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let longPressFired = false

function clearLongPress() {
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function onPointerDown(event: PointerEvent, manga: Manga) {
  if (event.button !== 0) return
  clearLongPress()
  longPressFired = false
  longPressTimer = setTimeout(() => {
    longPressTimer = null
    longPressFired = true
    if (props.onLongClick) props.onLongClick(manga)
    else void router.push(`/manga/${manga.id}`)
  }, longPressDelay)
}

function onActivate(event: MouseEvent, manga: Manga) {
  if (longPressFired) {
    // The long press already handled the item; swallow the trailing click.
    longPressFired = false
    event.preventDefault()
    return
  }
  // Leave modified clicks (new tab, new window, download) to the browser.
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  if (props.onClick) props.onClick(manga)
  else void router.push(`/manga/${manga.id}`)
}

function mangaHref(manga: Manga) {
  return router.resolve(`/manga/${manga.id}`).href
}

onBeforeUnmount(clearLongPress)
</script>

<template>
  <p v-if="!props.titles.length" class="global-search-empty">No results found</p>
  <ul v-else class="global-search-row" role="list" aria-label="Search results">
    <li v-for="manga in props.titles" :key="manga.id" class="global-search-row-item">
      <a
        :href="mangaHref(manga)"
        class="global-search-card"
        :aria-label="manga.inLibrary ? `${manga.title}, in library` : manga.title"
        @pointerdown="onPointerDown($event, manga)"
        @pointerup="clearLongPress"
        @pointerleave="clearLongPress"
        @pointercancel="clearLongPress"
        @click="onActivate($event, manga)"
      >
        <div class="global-search-cover">
          <v-img
            v-if="!broken.has(manga.id)"
            :src="server.thumbnailUrl(manga.id)"
            :aspect-ratio="2 / 3"
            class="global-search-cover-image"
            :class="{ 'global-search-cover-favorite': manga.inLibrary }"
            cover
            alt=""
            @error="broken.add(manga.id)"
          />
          <div v-else class="global-search-cover-fallback"><v-icon icon="broken_image" size="24" /></div>
          <MangaBadges :manga="manga" catalogue side="start" class="global-search-badges" />
        </div>
        <div class="global-search-title"><span class="global-search-title-text">{{ manga.title }}</span></div>
      </a>
    </li>
  </ul>
</template>

<style scoped>
/* EmptyResultItem: Text with padding(horizontal = 16dp, vertical = 8dp),
   default `bodyLarge` typography (16sp / 24sp / 0.5sp). */
.global-search-empty {
  margin: 0;
  padding: 8px 16px;
  font-size: 16px;
  line-height: 24px;
  letter-spacing: 0.5px;
  color: rgb(var(--v-theme-on-surface));
}

/* LazyRow: contentPadding = PaddingValues(small = 8dp) — applied on every side
   of the lazy row — and horizontalArrangement = spacedBy(extraSmall = 4dp). */
.global-search-row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin: 0;
  padding: 8px;
  list-style: none;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.global-search-row::-webkit-scrollbar {
  display: none;
}

/* Box(Modifier.width(96.dp)) around the grid item. */
.global-search-row-item {
  flex: 0 0 auto;
  width: 96px;
}

/* GridItemSelectable: clip(MaterialTheme.shapes.small = 8dp) + padding(4dp).
   The 96dp width belongs to the outer Box; the 4dp padding is part of the
   selectable item, so the cover itself is 88dp wide. */
.global-search-card {
  display: block;
  position: relative;
  width: 100%;
  padding: 4px;
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
  overflow: hidden;
}
/* combinedClickable draws a ripple over the item; the web equivalent is an
   MD3 state layer that shows while the item is hovered or pressed. */
.global-search-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: rgb(var(--v-theme-on-surface));
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease-out;
}
.global-search-card:hover::after {
  opacity: 0.08;
}
.global-search-card:active::after {
  opacity: 0.12;
}

/* MangaGridCover: fillMaxWidth + aspectRatio(MangaCover.Book = 2/3);
   MangaCover.Book clips to MaterialTheme.shapes.extraSmall (4dp). */
.global-search-cover {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 4px;
  overflow: hidden;
  background: #8888881f;
}
.global-search-cover-image {
  width: 100%;
  height: 100%;
}
/* CommonMangaItemDefaults.BrowseFavoriteCoverAlpha = 0.34f */
.global-search-cover-favorite {
  opacity: 0.34;
}
/* cover_error drawable: the placeholder colour plus a centred 24dp glyph. The
   reference paints the glyph with the same 12% placeholder colour, which makes
   it almost invisible, so the same hue is used at full alpha here. */
.global-search-cover-fallback {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  background: #8888881f;
  color: #888888;
}

/* Badges.kt: `MangaGridCover` places the `BadgeGroup` 4dp from the top-start corner of the
   cover. The group itself is clipped to shapes.extraSmall (4dp) and the badge inside is a
   bodySmall Text (12sp / 16sp / 0.4sp / Medium) with 3dp horizontal and 1dp vertical
   padding around a 12dp icon; the shared `MangaBadges` component draws it. */
.global-search-badges {
  position: absolute;
  top: 4px;
  left: 4px;
}

/* GridItemTitle: padding(4dp), 12sp/18sp, minLines 2, maxLines 3.
   minLines 2 = 2 x 18sp = 36dp of text plus 4dp padding on both sides. */
.global-search-title {
  display: block;
  padding: 4px;
  min-height: 44px;
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  /* GridItemTitle.kt: `style = MaterialTheme.typography.titleSmall` -> MD3 titleSmall
     tracking is 0.4sp (the explicit fontSize/lineHeight override only the size). */
  letter-spacing: 0.4px;
  color: rgb(var(--v-theme-on-surface));
}
.global-search-title-text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  overflow-wrap: anywhere;
}
</style>
