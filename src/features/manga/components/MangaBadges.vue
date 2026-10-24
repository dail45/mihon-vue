<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Manga } from '@/core/api/types'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { isLocal, sourceOf } from '@/core/utils/library'
import { getFlagSvg } from '@/core/utils/flags'

/**
 * Mirrors Mihon's badge composables.
 *
 * - `presentation/browse/components/BrowseBadges.kt` -> `InLibraryBadge`, used by the
 *   catalogue grids/list as `coverBadgeStart` (or the list `badge` slot).
 * - `presentation/library/components/LibraryBadges.kt` -> `DownloadsBadge` / `UnreadBadge` /
 *   `LanguageBadge`, used by the library grids/list.
 *
 * Both are drawn through `presentation-core/src/main/java/tachiyomi/presentation/core/components/Badges.kt`:
 * a `BadgeGroup` (Row clipped to `MaterialTheme.shapes.extraSmall` = 4dp) that holds `Badge`
 * items. A `Badge` is a `Text` with `bodySmall` typography (12sp / 16sp), `FontWeight.Medium`,
 * a rectangular shape, `horizontal = 3.dp` / `vertical = 1.dp` padding and a container of
 * `colorScheme.secondary` (unread + in-library) or `colorScheme.tertiary`
 * (downloads + local + language), with `onSecondary` / `onTertiary` content.
 *
 * The icon variant is an `InlineTextContent` whose placeholder is `bodySmall.fontSize`
 * (12sp) wide and high, so the glyph is drawn at 12dp and vertically centred.
 *
 * `side` mirrors the call site:
 * - 'start' -> `coverBadgeStart` (grid, top-start).
 * - 'end'   -> `coverBadgeEnd` (grid, top-end).
 * - 'all'   -> the single `BadgeGroup` of `MangaListItem`.
 */
const props = withDefaults(defineProps<{
  manga?: Manga
  enabled?: boolean
  catalogue?: boolean
  side?: 'start' | 'end' | 'all'
}>(), {
  manga: undefined,
  enabled: undefined,
  catalogue: false,
  side: 'start',
})

const prefs = usePreferencesStore()
const server = useSuwayomiStore()
const failedSourceIcons = ref<Set<string>>(new Set())

/** In-library flag: supports explicit `enabled`, wire `inLibrary`, or domain `favorite`. */
const inLibrary = computed(() => {
  if (props.enabled !== undefined) return props.enabled
  if (!props.manga) return false
  return Boolean(props.manga.inLibrary || props.manga.favorite)
})

/** LocalSource.ID == 0 in Mihon; Suwayomi's local source carries id "0" / lang "localsourcelang". */
const local = computed(() => props.manga ? isLocal(props.manga, server.sources) : false)

/**
 * `LibraryViewModel.kt` fills `sourceLanguage` with `source.lang` when the language badge is
 * enabled, independently of the local badge. Mihon's LocalSource declares `lang = "other"`,
 * so a local entry without the local badge shows the "OTHER" code instead of the folder glyph.
 * Suwayomi names the same source "localsourcelang", which is mapped back to Mihon's "other".
 */
const language = computed(() => {
  if (!props.manga) return ''
  const source = sourceOf(props.manga, server.sources)
  if (!source) return ''
  return local.value ? 'other' : source.lang
})

interface BadgeItem {
  key: string
  label: string
  /** Mihon: secondary = unread + in-library, tertiary = downloads + local + language. */
  color: 'secondary' | 'tertiary'
  /** `Badge(imageVector = …)`: the glyph is drawn from the reference vector. */
  icon?: string
  text?: string
  svg?: string
  image?: string
}

/**
 * `Badge(imageVector = …)` (Badges.kt) draws the `ImageVector` inside an
 * `InlineTextContent` whose placeholder is `bodySmall.fontSize` (12sp) wide and high, so the
 * vector is scaled into a 12dp box exactly like `ContentScale.Fit` does in Compose.
 *
 * The paths are the reference vectors of the pinned Mihon commit
 * (`mihon/icons/material-symbols/src/main/valkyrieResources/rounded/*.svg`, Material Symbols
 * Rounded v329): `collections_bookmark` (BrowseBadges.kt -> `InLibraryBadge`) and `folder`
 * (LibraryBadges.kt -> `LanguageBadge`). They are inlined instead of taken from the bundled
 * Material Symbols font so the drawn ink matches the reference vector (the font ligature is
 * rendered from the baseline and does not reproduce the 960-unit viewport exactly).
 */
const ICON_PATHS: Record<string, string> = {
  // Material Symbols Rounded 'collections_bookmark', v329.
  collections_bookmark: 'M320-320h480v-480h-80v245q0 12-10 18t-20-1l-49-29q-10-6-21.5-6t-20.5 6l-49 29q-11 7-20.5 1t-9.5-18v-245H320v480Zm0 80q-33 0-56.5-23.5T240-320v-480q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320ZM160-80q-33 0-56.5-23.5T80-160v-520q0-17 11.5-28.5T120-720q17 0 28.5 11.5T160-680v520h520q17 0 28.5 11.5T720-120q0 17-11.5 28.5T680-80H160Zm160-720v480-480Zm200 245q0 12 9.5 18t20.5-1l49-29q9-6 20.5-6t21.5 6l49 29q10 7 20 1t10-18q0 12-10 18t-20-1l-49-29q-10-6-21.5-6t-20.5 6l-49 29q-11 7-20.5 1t-9.5-18Z',
  // Material Symbols Rounded 'folder', v329.
  folder: 'M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h207q16 0 30.5 6t25.5 17l57 57h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z',
}

const badges = computed<BadgeItem[]>(() => {
  if (props.catalogue) {
    // BrowseBadges.kt: only `InLibraryBadge(enabled = manga.favorite)`.
    if (props.side === 'end' || !inLibrary.value) return []
    return [{ key: 'in-library', label: 'In library', color: 'secondary', icon: 'collections_bookmark' }]
  }
  const manga = props.manga
  if (!manga) return []

  const items: BadgeItem[] = []
  if (props.side !== 'end') {
    // LibraryBadges.kt: DownloadsBadge then UnreadBadge, in this order.
    if (prefs.downloadBadge && (manga.downloadCount ?? 0) > 0) {
      items.push({ key: 'downloads', label: `${manga.downloadCount} downloaded chapters`, color: 'tertiary', text: String(manga.downloadCount) })
    }
    if (prefs.unreadBadge && (manga.unreadCount ?? 0) > 0) {
      items.push({ key: 'unread', label: `${manga.unreadCount} unread chapters`, color: 'secondary', text: String(manga.unreadCount) })
    }
  }
  if (props.side !== 'start') {
    // LibraryBadges.kt: LanguageBadge - folder glyph for a local source, else the language code.
    // The two preferences are independent in Mihon, so the code is used when the local
    // badge is switched off and the language badge is on.
    if (local.value && prefs.localBadge) {
      items.push({ key: 'local', label: 'Local source', color: 'tertiary', icon: 'folder' })
    } else if (prefs.languageBadge && language.value) {
      const flagSvg = prefs.useLangIcon ? getFlagSvg(language.value) : null
      if (flagSvg) {
        items.push({ key: 'language', label: `Language ${language.value.toUpperCase()}`, color: 'tertiary', svg: flagSvg })
      } else {
        items.push({ key: 'language', label: `Language ${language.value.toUpperCase()}`, color: 'tertiary', text: language.value.toUpperCase() })
      }
    }
    if (prefs.sourceBadge && manga.sourceId && !local.value && !failedSourceIcons.value.has(manga.sourceId)) {
      const source = sourceOf(manga, server.sources)
      const iconUrl = `${server.apiUrl}/source/${encodeURIComponent(manga.sourceId)}/icon`
      items.push({ key: 'source', label: source?.name ? `Source: ${source.name}` : 'Source icon', color: 'tertiary', image: iconUrl })
    }
  }
  return items
})
</script>

<template>
  <!--
    Badges.kt: `BadgeGroup` is always created by the caller (`CommonMangaItem.kt` renders
    `BadgeGroup(Modifier.padding(4.dp).align(...))` for both corners, and `MangaListItem`
    renders `BadgeGroup(content = badge)`), so the group element exists even when every
    badge inside it is hidden by a preference or a zero count.
  -->
  <span class="manga-badge-group">
    <span
      v-for="badge in badges"
      :key="badge.key"
      class="manga-badge"
      :class="[
        badge.svg ? 'bg-transparent manga-badge-flag-container' : (badge.color === 'tertiary' ? 'bg-tertiary' : 'bg-secondary'),
        { 'manga-badge-icon-container': Boolean(badge.image) }
      ]"
      :aria-label="badge.label"
    >
      <!--
        Badges.kt `Badge(imageVector = …)`: the vector is drawn inside an
        `InlineTextContent` placeholder of `bodySmall.fontSize` (12sp) square, vertically
        centred, and tinted with `onSecondary` / `onTertiary` (`currentColor`).
      -->
      <svg
        v-if="badge.icon"
        class="manga-badge-icon"
        viewBox="0 -960 960 960"
        width="12"
        height="12"
        aria-hidden="true"
        focusable="false"
      ><path :d="ICON_PATHS[badge.icon]" fill="currentColor" /></svg>
      <span
        v-else-if="badge.svg"
        class="manga-badge-flag"
        v-html="badge.svg"
      />
      <img
        v-else-if="badge.image"
        class="manga-badge-favicon"
        :src="badge.image"
        alt=""
        loading="lazy"
        @error="props.manga?.sourceId && failedSourceIcons.add(props.manga.sourceId)"
      />
      <template v-else>{{ badge.text }}</template>
    </span>
  </span>
</template>

<style scoped>
/* Badges.kt: BadgeGroup is a Row clipped to shapes.extraSmall (4dp). */
.manga-badge-group {
  display: inline-flex;
  align-items: flex-start;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  box-sizing: border-box;
  user-select: none;
}

/* Badges.kt: Badge is a bodySmall Text (12sp / 16sp, Medium) with a rectangular shape
   and 3dp horizontal / 1dp vertical padding inside the clipped group. */
.manga-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  padding: 1px 3px;
  border-radius: 0;
  box-sizing: border-box;
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: 0.4px;
  white-space: nowrap;
  user-select: none;
}

/* Badges.kt `Badge(imageVector = …)`: placeholder is 12sp x 12sp square, vertically centred. */
.manga-badge-icon {
  display: block;
  flex: 0 0 auto;
  width: 12px;
  height: 12px;
}

/* Badges.kt colors:
   - secondary = in-library, unread
   - tertiary = downloads, local, language */
.manga-badge.bg-secondary {
  background-color: rgb(var(--v-theme-secondary));
  color: rgb(var(--v-theme-on-secondary));
}

.manga-badge.bg-tertiary {
  background-color: rgb(var(--v-theme-tertiary));
  color: rgb(var(--v-theme-on-tertiary));
}
.manga-badge.bg-transparent {
  background-color: transparent;
}

.manga-badge-flag-container {
  padding: 0 1px;
}

.manga-badge-flag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 14px;
  width: 20px;
  border-radius: 2px;
  overflow: hidden;
  box-shadow: 0 0 1px rgba(0, 0, 0, 0.4);
}

.manga-badge-flag :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.manga-badge-icon-container {
  padding: 1px 2px;
}

.manga-badge-favicon {
  display: block;
  width: 14px;
  height: 14px;
  object-fit: contain;
  border-radius: 2px;
}
</style>
