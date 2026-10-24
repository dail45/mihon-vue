<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { VBottomSheet, VDialog } from 'vuetify/components'
import type { Manga, MangaStatus } from '@/core/api/types'
import { useSuwayomiStore } from '../stores/suwayomi'
import { useTabletUi } from '@/core/composables/useTabletUi'
import { sourceOf } from '@/core/utils/library'
import { findDuplicateManga, type DuplicateManga } from '@/core/utils/duplicates'

defineOptions({ name: 'DuplicateMangaDialog' })

/**
 * Mirrors `eu/kanade/presentation/manga/DuplicateMangaDialog.kt`.
 *
 * Reference structure (content of the `AdaptiveSheet`):
 *   Column(padding(vertical = TabbedDialogPaddings.Vertical = 8dp).verticalScroll().fillMaxWidth(),
 *          verticalArrangement = spacedBy(MaterialTheme.padding.medium = 16dp)) {
 *     Text(possible_duplicates_title, headlineMedium, horizontalPadding(24dp) + padding(top = 8dp))
 *     Text(possible_duplicates_summary, bodyMedium, horizontalPadding)
 *     LazyRow(spacedBy(8dp), height = getMaximumMangaCardHeight(duplicates), contentPadding = horizontalPadding)
 *     Column(horizontalPadding) { HorizontalDivider(); TextPreferenceWidget("Add anyway", Add) }
 *     OutlinedButton(action_cancel, horizontalPadding + padding(bottom = 16dp), heightIn(min = 56dp))
 *   }
 *
 * The `AdaptiveSheet` is a bottom sheet on phones and a centred 460dp surface on tablets;
 * `useTabletUi()` mirrors Mihon's `isTabletUi()` orientation heuristic.
 */
const props = withDefaults(defineProps<{
  /** The manga that is being added; the duplicates are looked up in the library. */
  manga?: Manga | null
  /** Pre-computed duplicates; when omitted they are derived from the library. */
  duplicates?: DuplicateManga[]
  /**
   * The Suwayomi REST v1 API of the pinned revision (e2ce828) has no migration endpoint,
   * so the migration action falls back to an explicit "not supported" stub.
   */
  migrateSupported?: boolean
}>(), { migrateSupported: false })
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{
  (event: 'confirm'): void
  (event: 'open-manga', manga: Manga): void
  (event: 'migrate', manga: Manga): void
}>()

const server = useSuwayomiStore()
const tablet = useTabletUi()

/** Every library entry of the server, de-duplicated across categories. */
const library = computed<Manga[]>(() => {
  const seen = new Set<number>()
  const all: Manga[] = []
  for (const list of Object.values(server.libraryByCategory)) {
    for (const item of list) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      all.push(item)
    }
  }
  return all
})

/** Either the duplicates handed over by the caller or the ones found in the library. */
const items = computed<DuplicateManga[]>(() => {
  if (props.duplicates) return props.duplicates
  if (!props.manga) return []
  return findDuplicateManga(props.manga, library.value)
})

/** `mihon/i18n/.../base/strings.xml`: ongoing / completed / licensed / publishing_finished / cancelled / on_hiatus / unknown. */
const statusMeta: Record<MangaStatus, { label: string; icon: string; filled?: boolean }> = {
  ONGOING: { label: 'Ongoing', icon: 'schedule' },
  COMPLETED: { label: 'Completed', icon: 'done_all' },
  LICENSED: { label: 'Licensed', icon: 'attach_money' },
  PUBLISHING_FINISHED: { label: 'Publishing finished', icon: 'check' },
  CANCELLED: { label: 'Cancelled', icon: 'close' },
  ON_HIATUS: { label: 'On hiatus', icon: 'pause', filled: true },
  UNKNOWN: { label: 'Unknown', icon: 'block' },
}

function statusOf(manga: Manga) {
  return statusMeta[manga.status] ?? statusMeta.UNKNOWN
}

/** `sourceManager.getOrStub(source)` returns a `StubSource` when the source is not installed. */
function sourceInfo(manga: Manga) {
  const source = sourceOf(manga, server.sources)
  // A source is only known to be missing once the source list has been loaded.
  const stub = !!server.sources.length && !source
  return { name: source?.name ?? manga.sourceId, stub }
}

/** `pluralStringResource(MR.plurals.manga_num_chapters, count)`: "%1$s chapter" / "%1$s chapters". */
function chapterLabel(count: number) {
  return `${count} ${count === 1 ? 'chapter' : 'chapters'}`
}

/** `stringResource(MR.strings.possible_duplicates_summary)` keeps the empty line between the sentences. */
const summaryText = 'You have entries in your library with a similar name.\n\nSelect an entry to migrate or add anyway.'

/* --------------------------------------------------------------------------
 * Card metrics (DuplicateMangaDialog.kt: MangaCardWidth / MangaDetailsIconWidth
 * and getMaximumMangaCardHeight / calculateMangaCardHeight).
 * ----------------------------------------------------------------------- */

/** `private val MangaCardWidth = 150.dp` */
const CARD_WIDTH = 150
/** `private val MangaDetailsIconWidth = 16.dp` */
const DETAILS_ICON_WIDTH = 16
/** `MaterialTheme.padding.small = 8.dp`, `MaterialTheme.padding.extraSmall = 4.dp` */
const SMALL_PADDING = 8
const EXTRA_SMALL_PADDING = 4
/** `MangaCover.Book.ratio = 2f / 3f` */
const COVER_RATIO = 2 / 3

/** The MD3 type scale used by the card, as { size, lineHeight, weight, letterSpacing }. */
const TYPE = {
  titleSmall: { size: 14, lineHeight: 20, weight: 500, letterSpacing: 0.0071428571 },
  bodySmall: { size: 12, lineHeight: 16, weight: 400, letterSpacing: 0.0333 },
  labelSmall: { size: 11, lineHeight: 16, weight: 500, letterSpacing: 0.0454545 },
} as const

type TypeStyle = { size: number, lineHeight: number, weight: number, letterSpacing: number }

let measureCtx: CanvasRenderingContext2D | null | undefined
function canvasContext(): CanvasRenderingContext2D | null {
  if (measureCtx === undefined) {
    measureCtx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  }
  return measureCtx
}

/**
 * `TextMeasurer.measure(text, style, maxLines, constraints).size.height`.
 * Empty text still occupies a single line of the style (the reference measures the
 * status and source rows with an empty string).
 */
function measureHeight(text: string, style: TypeStyle, maxLines: number, maxWidth: number): number {
  const ctx = canvasContext()
  if (!ctx) {
    // Fallback: a single line when the text roughly fits, otherwise maxLines.
    const perChar = style.size * 0.55
    const lines = Math.min(maxLines, Math.max(1, Math.ceil((text.length * perChar) / Math.max(1, maxWidth))))
    return lines * style.lineHeight
  }
  ctx.font = `${style.weight} ${style.size}px Roboto, sans-serif`
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${style.letterSpacing}em`
  ctx.textBaseline = 'top'
  if (!text) return style.lineHeight
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current)
      current = word
      if (lines.length >= maxLines) break
    } else {
      current = candidate
    }
  }
  if (lines.length < maxLines) lines.push(current)
  return Math.min(lines.length, maxLines) * style.lineHeight
}

/**
 * `calculateMangaCardHeight(...)`:
 *   2 * smallPadding + coverHeight + titleHeight + authorHeight + artistHeight
 *   + statusHeight + sourceHeight + 5 * extraSmallPadding
 */
function cardHeight(manga: Manga): number {
  const width = CARD_WIDTH - 2 * SMALL_PADDING
  const coverHeight = width / COVER_RATIO
  const detailsWidth = width - DETAILS_ICON_WIDTH - EXTRA_SMALL_PADDING
  const titleHeight = measureHeight(manga.title ?? '', TYPE.titleSmall, 2, width)
  const author = (manga.author ?? '').trim()
  const artist = (manga.artist ?? '').trim()
  const authorHeight = author ? measureHeight(author, TYPE.bodySmall, 2, detailsWidth) : 0
  const artistHeight = (artist && artist !== author) ? measureHeight(artist, TYPE.bodySmall, 2, detailsWidth) : 0
  // The reference measures the status and source rows with an empty string.
  const statusHeight = measureHeight('', TYPE.bodySmall, 2, detailsWidth)
  const sourceHeight = measureHeight('', TYPE.labelSmall, 1, width)
  return 2 * SMALL_PADDING
    + coverHeight
    + titleHeight
    + authorHeight
    + artistHeight
    + statusHeight
    + sourceHeight
    + 5 * EXTRA_SMALL_PADDING
}

/** `getMaximumMangaCardHeight(duplicates)`: the height of the LazyRow. */
const rowHeight = computed(() => {
  if (!items.value.length) return 0
  return Math.max(...items.value.map(item => cardHeight(item.manga)))
})

/** Covers that failed to load fall back to the `cover_error` drawable. */
const broken = ref<Record<number, boolean>>({})

/* combinedClickable: a long press opens the entry, a plain click migrates it. */
let pressTimer: number | undefined
let longPressed = false
function onPointerDown(item: DuplicateManga) {
  longPressed = false
  pressTimer = window.setTimeout(() => { longPressed = true; emit('open-manga', item.manga) }, 500)
}
function onPointerUp() {
  if (pressTimer !== undefined) { window.clearTimeout(pressTimer); pressTimer = undefined }
}
function onPointerLeave() { onPointerUp() }
/** A long press on the web raises the context menu; it plays the role of `onLongClick`. */
function onContextMenu(event: MouseEvent, item: DuplicateManga) {
  event.preventDefault()
  longPressed = true
  onPointerUp()
  emit('open-manga', item.manga)
}
function onClick(event: MouseEvent, item: DuplicateManga) {
  if (longPressed) { event.preventDefault(); longPressed = false; return }
  // The reference dismisses the sheet first, then starts the migration flow.
  open.value = false
  emit('migrate', item.manga)
  if (!props.migrateSupported) requestMigrate(item.manga)
}
onBeforeUnmount(onPointerUp)

/**
 * Migration is a Mihon-only feature: the Suwayomi REST v1 API of the pinned revision
 * (e2ce828) exposes no migration endpoint (`MangaAPI` / `SourceController` have none),
 * so the action opens an honest stub instead of silently doing nothing.
 */
const pendingMigrate = ref<Manga | null>(null)
const migrateStubOpen = ref(false)
function requestMigrate(manga: Manga) {
  pendingMigrate.value = manga
  // The reference closes the sheet first, then opens the migration flow.
  window.setTimeout(() => { migrateStubOpen.value = true }, 0)
}
watch(migrateStubOpen, value => { if (!value) pendingMigrate.value = null })

/* The phone sheet is draggable to dismiss (AdaptiveSheet, anchoredDraggable, 56dp threshold). */
const body = ref<HTMLElement | null>(null)
let dragStart: number | null = null
function onTouchStart(event: TouchEvent) {
  if (tablet.value) return
  if (body.value && body.value.scrollTop > 0) { dragStart = null; return }
  dragStart = event.touches[0]!.clientY
}
function onTouchEnd(event: TouchEvent) {
  if (dragStart === null) { dragStart = null; return }
  if (event.changedTouches[0]!.clientY - dragStart > 56) open.value = false
  dragStart = null
}

/* The duplicates are looked up in the library, so it has to be loaded when the sheet opens. */
watch(open, value => {
  if (!value) return
  if (!server.loadingLibrary && !library.value.length) void server.loadLibrary()
  if (!server.sources.length) void server.loadSources()
})
</script>

<template>
  <component
    :is="tablet ? VDialog : VBottomSheet"
    v-model="open"
    max-width="460"
    content-class="duplicate-sheet-content"
    aria-label="Possible duplicates"
  >
    <v-card
      class="duplicate-sheet"
      :class="tablet ? 'duplicate-sheet-tablet' : 'duplicate-sheet-phone'"
      color="surface-container-high"
    >
      <div ref="body" class="duplicate-sheet-body" @touchstart="onTouchStart" @touchend="onTouchEnd">
        <div class="duplicate-column">
          <!-- Text(possible_duplicates_title, headlineMedium, horizontalPadding + padding(top = 8dp)) -->
          <h2 class="duplicate-title">Possible duplicates</h2>

          <!-- Text(possible_duplicates_summary, bodyMedium, horizontalPadding) -->
          <p class="duplicate-summary">{{ summaryText }}</p>

          <!-- LazyRow(spacedBy(8dp), height = maximum card height, contentPadding = 24dp).
               The row has a fixed height, and the items stretch to it (the reference card
               ends with a Spacer(weight = 1f) that pushes the source row to the bottom). -->
          <div class="duplicate-row" role="list" :style="{ height: `${rowHeight}px` }">
            <div
              v-for="item in items"
              :key="item.manga.id"
              class="duplicate-card"
              role="listitem"
              :aria-label="`${item.manga.title}, ${chapterLabel(item.chapterCount)}`"
              @pointerdown="onPointerDown(item)"
              @pointerup="onPointerUp"
              @pointerleave="onPointerLeave"
              @pointercancel="onPointerUp"
              @contextmenu="onContextMenu($event, item)"
              @click="onClick($event, item)"
            >
              <div class="duplicate-cover">
                <img
                  v-if="!broken[item.manga.id]"
                  class="duplicate-cover-image"
                  :src="server.thumbnailUrl(item.manga.id)"
                  :alt="item.manga.title"
                  loading="lazy"
                  @error="broken[item.manga.id] = true"
                >
                <div v-else class="duplicate-cover-fallback"><v-icon icon="broken_image" size="24" /></div>
                <!-- BadgeGroup(padding(4dp), align TopStart) { Badge(secondary, onSecondary, manga_num_chapters) } -->
                <span class="duplicate-badge-group">
                  <span class="duplicate-badge">{{ chapterLabel(item.chapterCount) }}</span>
                </span>
              </div>

              <!-- Text(manga.title, titleSmall, maxLines = 2) -->
              <p class="duplicate-card-title">{{ item.manga.title }}</p>

              <!-- MangaDetailRow(author, Person, maxLines = 2) -->
              <div v-if="item.manga.author" class="duplicate-detail">
                <span class="material-symbols-rounded duplicate-detail-icon" aria-hidden="true">person</span>
                <span class="duplicate-detail-text">{{ item.manga.author }}</span>
              </div>

              <!-- MangaDetailRow(artist, RoundedFilled.Brush, maxLines = 2) -->
              <div v-if="item.manga.artist && item.manga.artist !== item.manga.author" class="duplicate-detail">
                <span class="material-symbols-rounded duplicate-detail-icon duplicate-icon-filled" aria-hidden="true">brush</span>
                <span class="duplicate-detail-text">{{ item.manga.artist }}</span>
              </div>

              <!-- MangaDetailRow(status, status icon, maxLines = 1) -->
              <div class="duplicate-detail">
                <span
                  class="material-symbols-rounded duplicate-detail-icon"
                  :class="{ 'duplicate-icon-filled': statusOf(item.manga).filled }"
                  aria-hidden="true"
                >{{ statusOf(item.manga).icon }}</span>
                <span class="duplicate-detail-text duplicate-detail-text-single">{{ statusOf(item.manga).label }}</span>
              </div>

              <!-- Row(Arrangement.Center) { Icon(16dp, error) when the source is a stub; Text(source.name, labelSmall) } -->
              <div class="duplicate-source">
                <span
                  v-if="sourceInfo(item.manga).stub"
                  class="material-symbols-rounded duplicate-source-warning duplicate-icon-filled"
                  aria-hidden="true"
                >warning</span>
                <span class="duplicate-source-text">{{ sourceInfo(item.manga).name }}</span>
              </div>
            </div>
          </div>

          <!-- Column(horizontalPadding) { HorizontalDivider(); TextPreferenceWidget("Add anyway", Add) } -->
          <div class="duplicate-actions">
            <div class="duplicate-divider" />
            <button type="button" class="duplicate-add" @click="open = false; emit('confirm')">
              <span class="duplicate-add-icon-box">
                <span class="material-symbols-rounded duplicate-add-icon" aria-hidden="true">add</span>
              </span>
              <span class="duplicate-add-text">Add anyway</span>
            </button>
          </div>

          <!-- OutlinedButton(action_cancel, horizontalPadding + padding(bottom = 16dp), heightIn(min = 56dp)) -->
          <button type="button" class="duplicate-cancel" @click="open = false">Cancel</button>
        </div>
      </div>
    </v-card>
  </component>

  <!-- Migration stub: the Suwayomi REST API exposes no migration endpoint. -->
  <v-dialog v-model="migrateStubOpen" max-width="400">
    <v-card class="duplicate-stub" color="surface-container-high">
      <h2 class="duplicate-stub-title">Migrate</h2>
      <p class="duplicate-stub-text">
        Migrating “{{ pendingMigrate?.title }}” to another source is not supported in the web version: the Suwayomi REST API exposes no migration endpoint.
      </p>
      <div class="duplicate-stub-actions">
        <button type="button" class="duplicate-stub-button" @click="migrateStubOpen = false">Cancel</button>
      </div>
    </v-card>
  </v-dialog>
</template>

<style>
/* The phone sheet is flush with the bottom of the viewport (no dialog margin). */
.duplicate-sheet-content.v-bottom-sheet__content { margin: 0 !important; }
</style>

<style scoped>
@layer app-components {
/* AdaptiveSheet: Surface(shape = extraLarge = 28dp, color = surfaceContainerHigh), max width 460dp. */
.duplicate-sheet {
  margin: 0 auto;
  max-width: 460px;
  padding: 0;
  border-radius: 28px !important;
  background: rgb(var(--v-theme-surface-container-high));
  overflow: hidden;
}
/* Tablet: systemBarsPadding() + padding(vertical = 16dp). */
.duplicate-sheet-tablet { padding: 16px 0; }
/* Phone: the sheet sits above the navigation bar (navigationBarsPadding()). */
.duplicate-sheet-phone { margin-bottom: env(safe-area-inset-bottom); }

.duplicate-sheet-tablet .duplicate-sheet-body { max-height: calc(100dvh - 32px); }
.duplicate-sheet-phone .duplicate-sheet-body { max-height: calc(100dvh - 24px); }
.duplicate-sheet-body { overflow-y: auto; }
/* Column(padding(vertical = 8dp).verticalScroll().fillMaxWidth(), spacedBy(16dp)) */
.duplicate-column { display: flex; flex-direction: column; gap: 16px; padding: 8px 0; }

/* Text(possible_duplicates_title, headlineMedium = 28sp/36sp, padding(top = 8dp), horizontal 24dp) */
.duplicate-title {
  margin: 0;
  padding: 8px 24px 0;
  font-family: var(--v-font-heading, var(--v-font-body, Roboto, sans-serif));
  font-size: 28px;
  line-height: 36px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
}
/* Text(possible_duplicates_summary, bodyMedium = 14sp/20sp, horizontal 24dp) */
.duplicate-summary {
  margin: 0;
  padding: 0 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface));
  white-space: pre-line;
}

/* LazyRow(horizontalArrangement = spacedBy(8dp), contentPadding = 24dp, height = max card height) */
.duplicate-row { display: flex; align-items: stretch; gap: 8px; padding: 0 24px; overflow-x: auto; scrollbar-width: none; }
.duplicate-row::-webkit-scrollbar { display: none; }
/* DuplicateMangaListItem: Column(width 150dp, clip(shapes.medium = 12dp), background(surface), padding(8dp)) */
.duplicate-card {
  flex: 0 0 150px;
  width: 150px;
  display: flex;
  flex-direction: column;
  padding: 8px;
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
}
/* MangaCover.Book: fillMaxWidth, aspectRatio(2/3), clip(extraSmall = 4dp), placeholder #1F888888 */
.duplicate-cover { position: relative; width: 100%; aspect-ratio: 2 / 3; border-radius: 4px; overflow: hidden; background: #8888881f; }
.duplicate-cover-image { display: block; width: 100%; height: 100%; object-fit: cover; }
.duplicate-cover-fallback { display: grid; place-items: center; width: 100%; height: 100%; background: #8888881f; }
/* BadgeGroup(clip(shapes.extraSmall = 4dp)) + Badge(secondary/onSecondary, bodySmall, padding(3dp, 1dp)) */
.duplicate-badge-group { position: absolute; top: 4px; left: 4px; display: inline-flex; border-radius: 4px; overflow: hidden; }
.duplicate-badge {
  padding: 1px 3px;
  background: rgb(var(--v-theme-secondary));
  color: rgb(var(--v-theme-on-secondary));
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: 0.0333em;
  white-space: nowrap;
}
/* Text(manga.title, titleSmall = 14sp/20sp, maxLines = 2) after Spacer(4dp) */
.duplicate-card-title {
  margin: 4px 0 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.0071428571em;
  color: rgb(var(--v-theme-on-surface));
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
}
/* MangaDetailRow: Row(alpha = 0.78, padding(top = 4dp), spacedBy(4dp)) { Icon(16dp); Text(bodySmall) } */
.duplicate-detail { display: flex; align-items: center; gap: 4px; padding-top: 4px; opacity: .78; }
.duplicate-detail-icon { flex: 0 0 16px; width: 16px; height: 16px; font-size: 16px; line-height: 16px; }
.duplicate-detail-text {
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.0333em;
  color: rgb(var(--v-theme-on-surface));
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
}
/* The status row uses the default maxLines = 1 of MangaDetailRow. */
.duplicate-detail-text-single { -webkit-line-clamp: 1; }
/* Row(Arrangement.Center) { Icon(16dp, error) when the source is a stub; Text(source.name, labelSmall) }
   preceded by Spacer(weight = 1f), so the source row is pinned to the bottom of the card. */
.duplicate-source { display: flex; align-items: center; justify-content: center; margin-top: auto; }
.duplicate-source-warning { flex: 0 0 16px; width: 16px; height: 16px; font-size: 16px; line-height: 16px; color: rgb(var(--v-theme-error)); }
.duplicate-source-text {
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: 0.0454545em;
  color: rgb(var(--v-theme-on-surface));
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Material Symbols "RoundedFilled" variants are drawn with the filled axis. */
.duplicate-icon-filled { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }

/* Column(horizontalPadding = 24dp) { HorizontalDivider(); TextPreferenceWidget("Add anyway", Add) } */
.duplicate-actions { padding: 0 24px; }
/* HorizontalDivider: 1dp, outlineVariant. */
.duplicate-divider { height: 1px; background: rgb(var(--v-theme-outline-variant)); }
/* TextPreferenceWidget: Row(minHeight = 56dp), icon Box(padding(start = 16dp, end = 8dp)),
   Column(padding(vertical = 16dp)) { Text(titleLarge with fontSize = 16sp, padding(horizontal = 16dp)) } */
.duplicate-add {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 56px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  text-align: start;
  cursor: pointer;
}
.duplicate-add:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.duplicate-add:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 10%, transparent); }
.duplicate-add-icon-box { display: flex; align-items: center; padding: 0 8px 0 16px; }
.duplicate-add-icon { font-size: 24px; line-height: 24px; color: rgb(var(--v-theme-primary)); }
.duplicate-add-text {
  /* The reference pads the title horizontally by 16dp; the vertical 16dp lives on the
     wrapping Column, which is reproduced by the 56dp row height. */
  padding: 0 16px;
  font-size: 16px;
  /* titleLarge keeps its 24sp line height; only the font size is overridden to 16sp. */
  line-height: 24px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
/* OutlinedButton(action_cancel): heightIn(min = 56dp), fillMaxWidth, horizontal 24dp, bottom 16dp,
   shape = cornerFull (20dp), 1dp outline, bodyLarge in primary. */
.duplicate-cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  width: calc(100% - 48px);
  min-height: 56px;
  margin: 0 24px 16px;
  padding: 4px 24px;
  border: 1px solid rgb(var(--v-theme-outline));
  border-radius: 20px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-family: inherit;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.03125em;
  cursor: pointer;
}
.duplicate-cancel:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
.duplicate-cancel:active { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 10%, transparent); }

/* Migration stub dialog (MD3 AlertDialog geometry). */
.duplicate-stub {
  border-radius: 28px !important;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, .15), 0 4px 8px 3px rgba(0, 0, 0, .15) !important;
  padding: 24px;
  min-width: 280px;
}
.duplicate-stub-title {
  margin: 0 0 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}
.duplicate-stub-text {
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}
.duplicate-stub-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.duplicate-stub-button {
  height: 40px;
  min-width: 58px;
  padding: 0 12px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.0071428571em;
  cursor: pointer;
}
.duplicate-stub-button:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
}
</style>
