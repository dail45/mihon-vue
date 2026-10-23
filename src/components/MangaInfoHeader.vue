<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Manga } from '../api/types'
import MarkdownRender from './MarkdownRender.vue'
import MangaNotesSection from './MangaNotesSection.vue'
import { readMangaNotes } from '../utils/mangaNotes'

/**
 * Pixel-parity port of Mihon's
 * `app/src/main/java/eu/kanade/presentation/manga/components/MangaInfoHeader.kt`
 * (Mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1).
 *
 * Reference elements & structure:
 *  - `MangaInfoBox`:
 *    * Blurred backdrop of the cover at 20% opacity (blur 4-8dp, vertical gradient
 *      transparent -> background).
 *    * `MangaAndSourceTitlesSmall` (phone): Row with 16dp horizontal padding and
 *      `appBarPadding + 16dp` top padding. Cover `sizeIn(maxWidth = 100.dp)` with 2:3 ratio,
 *      `extraSmall` shape (4dp), placeholder `#1F888888`, aligned top. 16dp gap to the
 *      Column with 2dp vertical spacing containing title, author, artist, and status/source.
 *    * `MangaAndSourceTitlesLarge` (tablet): Centered Column, cover at `65%` width (2:3 ratio),
 *      16dp spacer, and centered metadata text (`textAlign = TextAlign.Center`).
 *  - `MangaContentInfo`:
 *    * Title: `titleLarge` (22/28 w400 onSurface), click does global search, long click copies.
 *    * 2dp spacer.
 *    * Author row: `secondaryItemAlpha` (0.78), 16dp `Person` icon + `titleSmall` (14/20 w500)
 *      author text. Click searches author, long click copies author.
 *    * Artist row (only if artist is present and differs from author): `secondaryItemAlpha`,
 *      16dp filled `Brush` icon + `titleSmall` artist text. Click searches, long click copies.
 *    * 2dp spacer.
 *    * Status & Source row: `secondaryItemAlpha`, 16dp status icon (4dp end margin) +
 *      `bodyMedium` (14/20 w400) status text + ` • ` separator (`DotSeparatorText`) +
 *      optional warning icon (if `isStubSource`, 16dp filled `warning` in `error` color) +
 *      `bodyMedium` source name. Click searches source with query `src:"name" lang:lang`.
 *  - `MangaActionRow`:
 *    * Row with 16dp horizontal and 8dp top padding holding 4 weighted `TextButton`s (weight 1f).
 *    * Each button is a centered Column: 20dp icon, 4dp spacer, 12sp text (bodySmall 12/16).
 *    * Shape: `CornerFull` 20dp. Color: `primary` when active, `onSurface` @ 0.38 (`DISABLED_ALPHA`)
 *      when inactive.
 *    * Library button: icon `favorite` (filled heart when active, outline heart when inactive),
 *      text "In library" / "Add to library". Short click toggles library, long click edits category.
 *    * Update interval button: icon `hourglass_empty`, text "N/A" / "Soon" / "%d days".
 *      Active color if custom user interval mode. Short click edits interval.
 *    * Tracking button: icon `check` (if trackers > 0) / `sync` (if 0), text "Tracking" / "%d trackers".
 *      Active color if trackers > 0. Short click opens tracking.
 *    * WebView button: icon `public`, text "WebView". Short click opens web view (or external tab in web),
 *      long click copies manga URL to clipboard.
 *  - `ExpandableMangaDescription`:
 *    * `MangaSummary`: padding 8dp top, 16dp horizontal. Entire block has `clickableNoIndication`
 *      to toggle expanded state.
 *    * Collapsed height: 3 lines of bodyMedium (60px) when notes is blank; 6 lines (120px)
 *      when notes is present.
 *    * Content: `MangaNotesSection` (if notes exist) + `MarkdownRender` (selectable, secondary alpha 0.78).
 *    * Scrim: 24dp height, vertical gradient transparent -> background.
 *    * Caret: 24dp icon (`expand_less` when expanded, `expand_more` when collapsed), tint `onBackground`,
 *      with a radial gradient background (background -> transparent).
 *    * Genre Chips: SuggestionChip look (32dp height, 8dp CornerSmall radius, 1dp outlineVariant border,
 *      12sp bodySmall onSurfaceVariant text). Collapsed: horizontally scrolling row (LazyRow) with 16dp
 *      content padding, 4dp gap. Expanded: FlowRow (wrapped) with 16dp horizontal padding, 4dp gap,
 *      4dp vertical chip padding.
 *    * Chip click: Opens DropdownMenu anchored at the chip with "Search" and "Copy to clipboard".
 */
const props = withDefaults(
  defineProps<{
    /** The manga as returned by the REST API. */
    manga: Manga
    /** Display name of the source the manga comes from. */
    sourceName: string
    /** Id of that source, used for the source scoped search. */
    sourceId: string
    /** Whether the source is not installed / a stub source (Mihon renders warning icon). */
    isStubSource?: boolean
    /** Tablet layout: cover centered at 65% width and text centered. */
    large?: boolean
    /** Whether the update interval is a custom (user defined) one. */
    userInterval?: boolean
    /** Label of the update interval button (Mihon: "N/A", "Soon" or the day count). */
    intervalLabel?: string
    /** Expected days until next update (optional, used if intervalLabel is not provided). */
    nextUpdateDays?: number | null
    /** Number of trackers bound to the manga. */
    trackingCount?: number
    /** URL of the cover image (the server thumbnail endpoint). */
    coverUrl?: string
    /** Server the notes of this manga belong to. */
    apiUrl?: string
    /** App bar padding in dp (top padding above titles). Defaults to 0. */
    appBarPadding?: number
    /** Default expanded state of the description (Mihon: true if from source, or in tablet). */
    defaultExpandState?: boolean
  }>(),
  {
    isStubSource: false,
    large: false,
    userInterval: false,
    intervalLabel: undefined,
    nextUpdateDays: null,
    trackingCount: 0,
    coverUrl: '',
    apiUrl: '',
    appBarPadding: 0,
    defaultExpandState: false,
  },
)

const emit = defineEmits<{
  (event: 'toggle-library'): void
  (event: 'edit-category'): void
  (event: 'edit-interval'): void
  (event: 'open-tracking'): void
  (event: 'open-web-view'): void
  (event: 'open-cover'): void
}>()

const router = useRouter()
const descriptionExpanded = ref(props.defaultExpandState || props.large)
const tagMenuOpen = ref(false)
const selectedTag = ref('')
const selectedTagTarget = ref<HTMLElement | undefined>(undefined)
const searchStubOpen = ref(false)
const stubQuery = ref('')

// Clipboard toast / feedback
const snackbar = ref(false)
const snackbarText = ref('')

// Reactive notes tracking from local storage / API
const notes = ref('')

function reloadNotes() {
  if (props.apiUrl && props.manga.id) {
    notes.value = readMangaNotes(props.apiUrl, props.manga.id).trim()
  } else {
    notes.value = ''
  }
}

watch(
  () => [props.apiUrl, props.manga.id],
  () => reloadNotes(),
  { immediate: true },
)

onMounted(() => {
  reloadNotes()
  if (typeof window !== 'undefined') {
    window.addEventListener('mihon:notes-updated', reloadNotes)
    window.addEventListener('storage', reloadNotes)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('mihon:notes-updated', reloadNotes)
    window.removeEventListener('storage', reloadNotes)
  }
})

const hasNotes = computed(() => !!notes.value.trim())

/** Mihon `MR.strings.unknown_title` / `MR.strings.unknown_author`. */
const title = computed(() => props.manga.title.trim() || 'Unknown title')
const author = computed(() => props.manga.author?.trim() || 'Unknown author')
const artist = computed(() => props.manga.artist?.trim() || '')
const showArtist = computed(() => !!artist.value && artist.value !== props.manga.author?.trim())
const description = computed(() => props.manga.description?.trim() || 'No description')

/** Mihon maps the `SManga` status constants (string or number) to an icon and a label. */
const STATUS_MAP: Record<string, { icon: string; label: string; filled?: boolean }> = {
  // String constants
  ONGOING: { icon: 'schedule', label: 'Ongoing' },
  COMPLETED: { icon: 'done_all', label: 'Completed' },
  LICENSED: { icon: 'attach_money', label: 'Licensed' },
  PUBLISHING_FINISHED: { icon: 'check', label: 'Publishing finished' },
  CANCELLED: { icon: 'close', label: 'Cancelled' },
  ON_HIATUS: { icon: 'pause', label: 'On hiatus', filled: true },
  UNKNOWN: { icon: 'block', label: 'Unknown' },
  // Numeric constants (SManga companion object 0..6)
  '1': { icon: 'schedule', label: 'Ongoing' },
  '2': { icon: 'done_all', label: 'Completed' },
  '3': { icon: 'attach_money', label: 'Licensed' },
  '4': { icon: 'check', label: 'Publishing finished' },
  '5': { icon: 'close', label: 'Cancelled' },
  '6': { icon: 'pause', label: 'On hiatus', filled: true },
  '0': { icon: 'block', label: 'Unknown' },
}

const status = computed(() => {
  const raw = String(props.manga.status ?? 'UNKNOWN')
  return STATUS_MAP[raw] ?? { icon: 'block', label: 'Unknown' }
})

const tags = computed(() => props.manga.genre ?? [])

/** Interval button label formatting matching Mihon MR.strings / MR.plurals */
const formattedIntervalLabel = computed(() => {
  if (props.intervalLabel != null) return props.intervalLabel
  if (props.nextUpdateDays == null) return 'N/A'
  if (props.nextUpdateDays === 0) return 'Soon'
  return props.nextUpdateDays === 1 ? '1 day' : `${props.nextUpdateDays} days`
})

/** Tracking button label formatting matching Mihon MR.strings.manga_tracking_tab and MR.plurals.num_trackers */
const formattedTrackingLabel = computed(() => {
  const count = props.trackingCount ?? 0
  if (count === 0) return 'Tracking'
  return count === 1 ? '1 tracker' : `${count} trackers`
})

function routeExists(path: string) {
  return router.getRoutes().some(route => route.path === path)
}

/** Mihon `doSearch(query, global = true)`: search the title in every source. */
function searchGlobal(query: string) {
  const value = query.trim()
  if (!value) return
  if (routeExists('/browse/global-search')) {
    void router.push({ path: '/browse/global-search', query: { q: value } })
    return
  }
  stubQuery.value = value
  searchStubOpen.value = true
}

/** Mihon `doSearch(query, global = false)`: search inside the manga's own source. */
function searchInSource(query: string) {
  const value = query.trim()
  if (!value) return
  if (props.sourceId && routeExists('/browse/source/:sourceId')) {
    void router.push({ path: `/browse/source/${props.sourceId}`, query: { mode: 'search', q: value } })
    return
  }
  searchGlobal(value)
}

/** Mihon `Source.query()`: `src:"name" lang:lang` (or `srcid:id` without a name). */
function sourceQuery() {
  const name = props.sourceName.trim()
  return name ? `src:"${name}"` : `srcid:${props.sourceId}`
}

async function copyToClipboard(value: string, feedbackLabel?: string) {
  const text = value.trim()
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    snackbarText.value = feedbackLabel ? `Copied to clipboard: ${feedbackLabel}` : `Copied to clipboard:\n${text}`
    snackbar.value = true
  } catch {
    /* clipboard unavailable in this context */
  }
}

// --- Long press handler helper for touch & desktop mouse -------------------
function createLongPressHandler(onLongPress: () => void, onClick?: () => void) {
  let timer: number | null = null
  let didLongPress = false
  let startX = 0
  let startY = 0

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    didLongPress = false
    startX = e.clientX
    startY = e.clientY
    timer = window.setTimeout(() => {
      didLongPress = true
      onLongPress()
    }, 500)
  }

  function onPointerMove(e: PointerEvent) {
    if (!timer) return
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > 8) {
      clearTimeout(timer)
      timer = null
    }
  }

  function onPointerUp() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function onPointerCancel() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault()
    onLongPress()
  }

  function handleClick(e: MouseEvent) {
    if (didLongPress) {
      didLongPress = false
      e.stopPropagation()
      return
    }
    if (onClick) onClick()
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onContextMenu,
    handleClick,
  }
}

// Long press / click handlers
const titleHandler = createLongPressHandler(
  () => void copyToClipboard(title.value),
  () => searchGlobal(title.value),
)

const authorHandler = createLongPressHandler(
  () => void copyToClipboard(author.value),
  () => searchGlobal(author.value),
)

const artistHandler = createLongPressHandler(
  () => void copyToClipboard(artist.value),
  () => searchGlobal(artist.value),
)

const sourceHandler = createLongPressHandler(
  () => void copyToClipboard(props.sourceName),
  () => searchInSource(sourceQuery()),
)

const libraryButtonHandler = createLongPressHandler(
  () => emit('edit-category'),
  () => emit('toggle-library'),
)

const webViewButtonHandler = createLongPressHandler(
  () => {
    const url = props.manga.realUrl || props.manga.url || ''
    if (url) {
      void copyToClipboard(url)
    }
  },
  () => {
    const url = props.manga.realUrl || props.manga.url || ''
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
    emit('open-web-view')
  },
)

function onTagClick(tag: string, event: MouseEvent) {
  selectedTag.value = tag
  selectedTagTarget.value = event.currentTarget as HTMLElement
  tagMenuOpen.value = true
}

function searchTag() {
  tagMenuOpen.value = false
  searchGlobal(selectedTag.value)
}

async function copyTag() {
  tagMenuOpen.value = false
  await copyToClipboard(selectedTag.value)
}
</script>

<template>
  <div class="manga-info-header" :class="{ 'manga-info-header--large': large }">
    <!-- MangaInfoBox: backdrop fills only the titles hero box (cover + title + author/artist/status) -->
    <div class="manga-info-box">
      <!-- Backdrop: blurred cover at 20% opacity with a vertical gradient to the background. -->
      <div class="manga-info-backdrop" aria-hidden="true">
        <img
          class="manga-info-backdrop-image"
          :src="coverUrl || manga.thumbnailUrl || ''"
          alt=""
          loading="lazy"
        />
        <div class="manga-info-backdrop-scrim" />
      </div>

      <!-- MangaAndSourceTitlesSmall / MangaAndSourceTitlesLarge -->
      <div
        class="manga-info-titles"
        :style="appBarPadding ? { paddingTop: `calc(${appBarPadding}px + 16px)` } : undefined"
      >
        <!-- MangaCover.Book (aspect ratio 2:3, CornerExtraSmall = 4dp) -->
        <button
          class="manga-info-cover"
          type="button"
          aria-label="Manga cover"
          @click="$emit('open-cover')"
        >
          <img
            class="manga-info-cover-image"
            :src="coverUrl || manga.thumbnailUrl || ''"
            :alt="title"
            loading="eager"
          />
        </button>

        <!-- MangaContentInfo -->
        <div class="manga-info-content">
          <!-- Title: titleLarge (22sp / 28sp w400) -->
          <h1
            class="manga-info-title"
            :title="title"
            @pointerdown="titleHandler.onPointerDown"
            @pointermove="titleHandler.onPointerMove"
            @pointerup="titleHandler.onPointerUp"
            @pointercancel="titleHandler.onPointerCancel"
            @contextmenu="titleHandler.onContextMenu"
            @click="titleHandler.handleClick"
          >
            {{ title }}
          </h1>

          <!-- Spacer 2dp -->
          <div class="manga-info-spacer-2dp" />

          <!-- Author row: secondaryItemAlpha (0.78), 16dp person icon, titleSmall (14sp / 20sp w500) -->
          <div class="manga-info-row">
            <span class="manga-info-icon material-symbols-rounded" aria-hidden="true">person</span>
            <span
              class="manga-info-author"
              :title="author"
              @pointerdown="authorHandler.onPointerDown"
              @pointermove="authorHandler.onPointerMove"
              @pointerup="authorHandler.onPointerUp"
              @pointercancel="authorHandler.onPointerCancel"
              @contextmenu="authorHandler.onContextMenu"
              @click="authorHandler.handleClick"
            >
              {{ author }}
            </span>
          </div>

          <!-- Artist row: secondaryItemAlpha (0.78), 16dp filled brush icon, titleSmall (14sp / 20sp w500) -->
          <div v-if="showArtist" class="manga-info-row">
            <span class="manga-info-icon manga-info-icon--filled material-symbols-rounded" aria-hidden="true">brush</span>
            <span
              class="manga-info-author"
              :title="artist"
              @pointerdown="artistHandler.onPointerDown"
              @pointermove="artistHandler.onPointerMove"
              @pointerup="artistHandler.onPointerUp"
              @pointercancel="artistHandler.onPointerCancel"
              @contextmenu="artistHandler.onContextMenu"
              @click="artistHandler.handleClick"
            >
              {{ artist }}
            </span>
          </div>

          <!-- Spacer 2dp -->
          <div class="manga-info-spacer-2dp" />

          <!-- Status & Source row: secondaryItemAlpha (0.78), 16dp status icon, bodyMedium (14sp / 20sp w400) -->
          <div class="manga-info-row manga-info-status-row">
            <span
              class="manga-info-icon manga-info-status-icon material-symbols-rounded"
              :class="{ 'manga-info-icon--filled': status.filled }"
              aria-hidden="true"
            >
              {{ status.icon }}
            </span>
            <span class="manga-info-status">{{ status.label }}</span>
            <span class="manga-info-dot" aria-hidden="true"> • </span>
            <span
              v-if="isStubSource"
              class="manga-info-icon manga-info-icon--stub material-symbols-rounded"
              title="Source not installed"
              aria-hidden="true"
            >
              warning
            </span>
            <span
              class="manga-info-source"
              :title="sourceName"
              @pointerdown="sourceHandler.onPointerDown"
              @pointermove="sourceHandler.onPointerMove"
              @pointerup="sourceHandler.onPointerUp"
              @pointercancel="sourceHandler.onPointerCancel"
              @contextmenu="sourceHandler.onContextMenu"
              @click="sourceHandler.handleClick"
            >
              {{ sourceName }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- OUTSIDE MangaInfoBox: Action row, Description, Tags -->
    <div class="manga-info-body">
      <!-- MangaActionRow: 16dp horizontal / 8dp top padding, 4 weighted TextButtons (weight 1f) -->
      <div class="manga-action-row">
        <!-- 1. Favorite button: "In library" / "Add to library", long-click edits category -->
        <button
          type="button"
          class="manga-action-button"
          :class="{ 'manga-action-button--active': manga.inLibrary }"
          @pointerdown="libraryButtonHandler.onPointerDown"
          @pointermove="libraryButtonHandler.onPointerMove"
          @pointerup="libraryButtonHandler.onPointerUp"
          @pointercancel="libraryButtonHandler.onPointerCancel"
          @contextmenu="libraryButtonHandler.onContextMenu"
          @click="libraryButtonHandler.handleClick"
        >
          <span
            class="manga-action-icon material-symbols-rounded"
            :class="{ 'manga-action-icon--filled': manga.inLibrary }"
            aria-hidden="true"
          >
            favorite
          </span>
          <span class="manga-action-label">{{ manga.inLibrary ? 'In library' : 'Add to library' }}</span>
        </button>

        <!-- 2. Interval button: "N/A" / "Soon" / "%d days", active if user interval -->
        <button
          type="button"
          class="manga-action-button"
          :class="{ 'manga-action-button--active': userInterval }"
          @click="$emit('edit-interval')"
        >
          <span class="manga-action-icon material-symbols-rounded" aria-hidden="true">hourglass_empty</span>
          <span class="manga-action-label">{{ formattedIntervalLabel }}</span>
        </button>

        <!-- 3. Tracking button: "Tracking" / "%d trackers", active if trackers > 0 -->
        <button
          type="button"
          class="manga-action-button"
          :class="{ 'manga-action-button--active': (trackingCount ?? 0) > 0 }"
          @click="$emit('open-tracking')"
        >
          <span class="manga-action-icon material-symbols-rounded" aria-hidden="true">
            {{ (trackingCount ?? 0) > 0 ? 'check' : 'sync' }}
          </span>
          <span class="manga-action-label">{{ formattedTrackingLabel }}</span>
        </button>

        <!-- 4. WebView button: "WebView", long-click copies URL -->
        <button
          type="button"
          class="manga-action-button"
          @pointerdown="webViewButtonHandler.onPointerDown"
          @pointermove="webViewButtonHandler.onPointerMove"
          @pointerup="webViewButtonHandler.onPointerUp"
          @pointercancel="webViewButtonHandler.onPointerCancel"
          @contextmenu="webViewButtonHandler.onContextMenu"
          @click="webViewButtonHandler.handleClick"
        >
          <span class="manga-action-icon material-symbols-rounded" aria-hidden="true">public</span>
          <span class="manga-action-label">WebView</span>
        </button>
      </div>

      <!-- ExpandableMangaDescription: MangaSummary (notes + description) -->
      <div
        class="manga-summary"
        :class="{
          'manga-summary--expanded': descriptionExpanded,
          'manga-summary--has-notes': hasNotes,
        }"
        @click="descriptionExpanded = !descriptionExpanded"
      >
        <div class="manga-summary-actual" :class="{ 'manga-summary-actual--collapsed': !descriptionExpanded }">
          <MangaNotesSection
            class="manga-summary-notes"
            :manga-id="manga.id"
            :api-url="apiUrl"
            :expanded="descriptionExpanded"
            @click.stop
          />
          <div class="manga-summary-text">
            <MarkdownRender
              :content="description"
              flavour="simple"
              :load-images="false"
              dimmed
              eol-as-new-line
            />
          </div>
        </div>

        <!-- Scrim with centered caret: 24dp height, placed at bottom -->
        <div class="manga-summary-scrim" aria-hidden="true">
          <div
            class="manga-summary-caret"
            :aria-label="descriptionExpanded ? 'Collapse' : 'Expand'"
          >
            <span
              class="material-symbols-rounded manga-summary-caret-icon"
              :class="{ 'manga-summary-caret-icon--expanded': descriptionExpanded }"
              aria-hidden="true"
            >expand_more</span>
          </div>
        </div>
      </div>

      <!-- Tags: SuggestionChips in LazyRow (collapsed) or FlowRow (expanded) -->
      <div
        v-if="tags.length"
        class="manga-tags"
        :class="{ 'manga-tags--expanded': descriptionExpanded }"
      >
        <button
          v-for="tag in tags"
          :key="tag"
          type="button"
          class="manga-tag-chip"
          @click="onTagClick(tag, $event)"
        >
          {{ tag }}
        </button>
      </div>
    </div>

    <!-- DropdownMenu of the tag chip: "Search" / "Copy to clipboard", anchored to chip -->
    <v-menu
      v-model="tagMenuOpen"
      :target="selectedTagTarget"
      location="bottom start"
      :close-on-content-click="true"
    >
      <v-list class="manga-tag-menu" density="compact" rounded="md" elevation="2">
        <v-list-item title="Search" @click="searchTag" />
        <v-list-item title="Copy to clipboard" @click="copyTag" />
      </v-list>
    </v-menu>

    <!-- Stub for global search fallback -->
    <v-dialog v-model="searchStubOpen" max-width="480">
      <v-card rounded="xl">
        <v-card-title class="d-flex align-center">
          Global search
          <v-spacer />
          <v-btn icon="close" variant="text" aria-label="Close" @click="searchStubOpen = false" />
        </v-card-title>
        <v-card-text>
          <p class="text-body-medium mb-2">Searching every source at once is not supported in the web version.</p>
          <p class="text-body-medium text-on-surface-variant">
            The Suwayomi REST API exposes the catalogue search per source only. Run "{{ stubQuery }}" inside one of the sources instead.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" variant="text" @click="searchStubOpen = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- MD3 Snackbar for clipboard copy feedback -->
    <v-snackbar
      v-model="snackbar"
      :timeout="2000"
      location="bottom center"
      color="inverse-surface"
      class="manga-copy-snackbar"
    >
      <span class="text-inverse-on-surface">{{ snackbarText }}</span>
    </v-snackbar>
  </div>
</template>

<style scoped>
@layer app-components {
/* MangaInfoBox: the backdrop fills only the titles hero box (cover + title + metadata). */
.manga-info-header {
  position: relative;
  background: transparent;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
}
.manga-info-box {
  position: relative;
  overflow: hidden;
  background: transparent;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
.manga-info-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
.manga-info-backdrop-image {
  position: absolute;
  inset: -16px;
  width: calc(100% + 32px);
  height: calc(100% + 32px);
  object-fit: cover;
  filter: blur(8px);
  opacity: 0.2;
}
.manga-info-backdrop-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0), rgb(var(--v-theme-background)));
}
.manga-info-body {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

/* MangaAndSourceTitlesSmall: 16dp horizontal padding, appBarPadding + 16dp top. */
.manga-info-titles {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 16px 0;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

/* MangaCover.Book: aspectRatio 2/3, clip(MaterialTheme.shapes.extraSmall = 4dp). */
.manga-info-cover {
  flex: none;
  width: 100px;
  max-width: 100px;
  aspect-ratio: 2 / 3;
  padding: 0;
  border: 0;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(136, 136, 136, 0.12);
  cursor: pointer;
  align-self: flex-start;
}
.manga-info-cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.manga-info-content {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.manga-info-spacer-2dp {
  height: 2px;
  flex: none;
}

/* Title: MaterialTheme.typography.titleLarge (22sp / 28sp w400). */
.manga-info-title {
  margin: 0;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  overflow-wrap: anywhere;
  user-select: text;
}

/* Author / artist row: icon + titleSmall (14sp / 20sp w500), alpha 0.78 (secondaryItemAlpha). */
.manga-info-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  opacity: 0.78;
}

.manga-info-icon,
.manga-info-icon.material-symbols-rounded {
  flex: none;
  width: 16px !important;
  height: 16px !important;
  font-size: 16px !important;
  line-height: 16px !important;
  font-variation-settings: 'opsz' 16, 'wght' 400;
  color: rgb(var(--v-theme-on-surface));
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.manga-info-icon--filled {
  font-variation-settings: 'FILL' 1, 'opsz' 16, 'wght' 400;
}
.manga-info-icon--stub {
  color: rgb(var(--v-theme-error));
  font-variation-settings: 'FILL' 1, 'opsz' 16, 'wght' 400;
  padding-right: 4px;
}

.manga-info-author {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.00714em;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  user-select: text;
}

/* Status row: icon (4dp end padding) + bodyMedium status + " • " + source name. */
.manga-info-status-row {
  gap: 0;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}
.manga-info-status-icon {
  padding-right: 4px;
}
.manga-info-status {
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 0 1 auto;
}
.manga-info-dot {
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface));
  flex: none;
  white-space: pre;
}
.manga-info-source {
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 0 1 auto;
}

/* MangaActionRow: 16dp horizontal, 8dp top padding. */
.manga-action-row {
  display: flex;
  padding: 8px 16px 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

/* MangaActionButton: TextButton with a centered Column (20dp icon, 4dp spacer, 12sp label). */
.manga-action-button {
  flex: 1 1 0;
  min-width: 0;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 4px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  /* DISABLED_ALPHA = 0.38 on onSurface. */
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 38%, transparent);
  font-family: inherit;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}
.manga-action-button::after {
  content: '';
  position: absolute;
  inset: 0;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}
.manga-action-button:hover::after {
  opacity: 0.08;
}
.manga-action-button:active::after {
  opacity: 0.12;
}
.manga-action-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
.manga-action-button--active {
  color: rgb(var(--v-theme-primary));
}
.manga-action-icon {
  width: 20px;
  height: 20px;
  font-size: 20px;
  line-height: 20px;
  font-variation-settings: 'FILL' 0;
}
.manga-action-icon--filled {
  font-variation-settings: 'FILL' 1;
}
.manga-action-label {
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.0333333333em;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ExpandableMangaDescription: 8dp top, 16dp horizontal padding. */
.manga-summary {
  position: relative;
  padding: 8px 16px 0;
  cursor: pointer;
  overflow: hidden;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
  padding: 8px 16px 0;
  cursor: pointer;
  overflow: hidden;
}

/* The description text is bodyMedium with secondaryItemAlpha (0.78). */
.manga-summary-text {
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface));
  overflow-wrap: anywhere;
  user-select: text;
}

/*
 * Mihon `MangaSummary`:
 * Shrunk height is 3 lines of bodyMedium (60px) when no notes,
 * or 6 lines (120px) when notes exist.
 */
.manga-summary-actual {
  overflow: hidden;
  transition: max-height 0.35s cubic-bezier(0.2, 0, 0, 1);
}
.manga-summary-actual--collapsed {
  max-height: 60px;
}
.manga-summary--has-notes .manga-summary-actual--collapsed {
  max-height: 120px;
}
.manga-summary--expanded .manga-summary-actual {
  max-height: 3000px;
}

.manga-summary-notes {
  margin-bottom: 4px;
}

/* Bottom 24dp scrim with centered caret flip icon: overlays bottom text row when collapsed */
.manga-summary-scrim {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 24px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0), rgb(var(--v-theme-background)));
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 2;
  transition: background 0.25s ease;
}
.manga-summary--expanded .manga-summary-scrim {
  position: relative;
  background: transparent;
}
.manga-summary-caret-icon {
  display: inline-block;
  transition: transform 0.3s cubic-bezier(0.2, 0, 0, 1);
}
.manga-summary-caret-icon--expanded {
  transform: rotate(180deg);
}
.manga-summary-caret {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(var(--v-theme-background)) 0%, rgba(0, 0, 0, 0) 70%);
  color: rgb(var(--v-theme-on-background));
  pointer-events: auto;
  cursor: pointer;
}
.manga-summary-caret .material-symbols-rounded {
  font-size: 24px;
  line-height: 24px;
}

/* Tags: SuggestionChip look, bodySmall label, 12dp vertical padding, 4dp chip padding. */
.manga-tags {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
  overflow-x: auto;
  scrollbar-width: none;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
.manga-tags::-webkit-scrollbar {
  display: none;
}
.manga-tags--expanded {
  flex-wrap: wrap;
  overflow-x: visible;
}

.manga-tag-chip {
  flex: none;
  margin: 4px 0;
  height: 32px;
  padding: 0 16px;
  border: 1px solid rgb(var(--v-theme-outline-variant));
  border-radius: 8px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  font-family: inherit;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.0333333333em;
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease-in-out;
}
.manga-tag-chip:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.manga-tag-chip:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.manga-tag-chip:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* Large (tablet) layout: centered cover at 65% width and centered texts. */
.manga-info-header--large .manga-info-titles {
  flex-direction: column;
  align-items: center;
}
.manga-info-header--large .manga-info-cover {
  width: 65%;
  max-width: 280px;
  margin: 0 auto;
}
.manga-info-header--large .manga-info-content {
  align-items: center;
  text-align: center;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
.manga-info-header--large .manga-info-row {
  justify-content: center;
  max-width: 100%;
}
</style>
