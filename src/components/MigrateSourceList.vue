<script setup lang="ts">
/**
 * Migrate — выбор источников (Mihon parity).
 *
 * Reference: `mihon/app/src/main/java/eu/kanade/presentation/browse/MigrateSourceScreen.kt`
 * (Mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1) and everything it composes:
 *  - `presentation/browse/components/BaseBrowseItem.kt`   (Row + combinedClickable)
 *  - `presentation/browse/components/BaseSourceItem.kt`   (icon / content / action slots)
 *  - `presentation/browse/components/BrowseIcons.kt`      (SourceIcon)
 *  - `presentation-core/.../components/Badges.kt`         (BadgeGroup + Badge)
 *  - `presentation-core/.../components/material/Constants.kt` (padding.small = 8dp, medium = 16dp)
 *  - `presentation-core/.../theme/Typography.kt`          (Typography.header)
 *  - `presentation-core/.../screens/LoadingScreen.kt` + `EmptyScreen.kt`
 *  - `app/.../domain/source/interactor/GetSourcesWithFavoriteCount.kt` (list + sorting)
 *  - `app/.../util/system/LocaleHelper.kt`                (language display names)
 *
 * Reference geometry (dp unless noted):
 *  - `MigrateSourceScreen`: `state.isLoading` -> LoadingScreen, `state.isEmpty` ->
 *    EmptyScreen(MR.strings.information_empty_library), else the list.
 *  - List: `ScrollbarLazyColumn(contentPadding = contentPadding + topSmallPaddingValues)`,
 *    so the column starts with 8dp of top padding; the prompt row is a STICKY header.
 *  - Sticky header: Row, background = colorScheme.background, padding start = 16dp,
 *    vertically centered; `Text` = Typography.header (bodyMedium + onSurfaceVariant +
 *    FontWeight.SemiBold) with weight(1f); then two IconButtons (40dp state layer inside
 *    the 48dp minimum interactive component, 24dp icon, LocalContentColor tint): sorting
 *    mode (SortByAlpha / Numbers) and sorting direction (ArrowUpward / ArrowDownward).
 *  - Item: `BaseBrowseItem` -> Row, combinedClickable (click + long click),
 *    padding horizontal 16dp / vertical 8dp, vertically centered children in the order
 *    icon(), content(), action().
 *  - `SourceIcon` modifier chain `size(48.dp).height(40.dp).aspectRatio(1f)`: `size(48)`
 *    fixes both sides, `height(40)` overrides the height and `aspectRatio(1f)` cannot
 *    satisfy the ratio inside those fixed constraints, so the image node stays 48dp wide
 *    and 40dp tall and the square icon (40dp) is centred in it.
 *  - Content: Column, padding horizontal 16dp, weight(1f): the name
 *    (`source.name.ifBlank { source.id }`, bodyMedium, 1 line, ellipsis) and a Row of
 *    secondary texts (spaced 8dp, centered): the language display name (bodySmall,
 *    secondaryItemAlpha = 0.78) and, for stub sources, "Not installed" (bodySmall,
 *    colorScheme.error).
 *  - Action: `BadgeGroup { Badge(text = "$count") }` -> bodySmall, FontWeight.Medium,
 *    colorScheme.secondary background / onSecondary text, padding 3dp x 1dp; the group
 *    clips its children to shapes.extraSmall (4dp).
 *  - Long press: copies the source id to the clipboard (`copyToClipboard(id, id)`), which
 *    shows the toast "Copied to clipboard:\n<id truncated to 50 chars>".
 *  - Empty state: "Your library is empty" plus a random kaomoji face (displayMedium, 0.78).
 *  - Loading state: centred `CircularProgressIndicator` (40dp, 4dp stroke, primary).
 *  - Sorting: alphabetical (collator, case/accent insensitive) or by total count, stubs
 *    first, and the direction reverses the whole comparator. Mihon keeps both values in
 *    `SourcePreferences`, which Suwayomi does not expose, so they live in the browser.
 *  - The tab that hosts this screen adds an app bar action with the migration help guide
 *    (MaterialSymbols.AutoMirroredRounded.Help -> https://mihon.app/docs/guides/source-migration);
 *    that action belongs to the app bar, not to the screen, and is rendered by the host view.
 *
 * Data note: Mihon lists the sources that hold at least one library entry together with
 * that count (`getSourceIdWithFavoriteCount`: `SELECT source_id, count(*) FROM manga
 * WHERE user_favorite_at IS NOT NULL GROUP BY source_id`) and drops the local source.
 * Suwayomi exposes `/source/list` and the library through the category endpoints, so the
 * same pairs are derived here. A library entry whose source is no longer installed is a
 * stub in Mihon (`getOrStub`), and it is rendered with the warning glyph and the
 * "Not installed" label.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSuwayomiStore } from '../stores/suwayomi'
import { readPreference, writePreference } from '../stores/preferences'
import { getSourceDisplayName } from '../utils/sourceLanguage'
import Md3CircularProgress from './Md3CircularProgress.vue'
import MihonEmptyScreen from './MihonEmptyScreen.vue'
import type { Source } from '../api/types'

const server = useSuwayomiStore()
const router = useRouter()

/**
 * Mihon: `Source.isLocal()` == (id == LocalSource.ID == 0) and the local source declares
 * `lang = "other"`. Suwayomi reports it with id "0" and lang "localsourcelang".
 * `GetSourcesWithFavoriteCount` drops the local source from the migration list.
 */
const LOCAL_LANG = 'localsourcelang'
function isLocal(source: Source) { return source.id === '0' || source.lang === LOCAL_LANG || source.lang === 'other' }

/**
 * The library entries of every category, deduplicated by manga id, grouped by source.
 * `getSourceIdWithFavoriteCount` counts the library entries of a source.
 */
const libraryCounts = computed<Record<string, number>>(() => {
  const seen = new Map<number, string>()
  for (const list of Object.values(server.libraryByCategory)) {
    for (const manga of list) if (!seen.has(manga.id)) seen.set(manga.id, manga.sourceId)
  }
  const counts: Record<string, number> = {}
  for (const sourceId of seen.values()) counts[sourceId] = (counts[sourceId] ?? 0) + 1
  return counts
})

/* `SourcePreferences.migrationSortingMode` / `migrationSortingDirection` have no
   Suwayomi counterpart, so both values live in the browser storage. */
type SortingMode = 'ALPHABETICAL' | 'TOTAL'
type SortingDirection = 'ASCENDING' | 'DESCENDING'
const MODE_KEY = 'mihon.migration.sortingMode'
const DIRECTION_KEY = 'mihon.migration.sortingDirection'

const savedMode = readPreference(MODE_KEY)
const savedDirection = readPreference(DIRECTION_KEY)
const sortingMode = ref<SortingMode>(savedMode === 'TOTAL' ? 'TOTAL' : 'ALPHABETICAL')
const sortingDirection = ref<SortingDirection>(savedDirection === 'DESCENDING' ? 'DESCENDING' : 'ASCENDING')

function toggleSortingMode() {
  sortingMode.value = sortingMode.value === 'ALPHABETICAL' ? 'TOTAL' : 'ALPHABETICAL'
  writePreference(MODE_KEY, sortingMode.value)
}
function toggleSortingDirection() {
  sortingDirection.value = sortingDirection.value === 'ASCENDING' ? 'DESCENDING' : 'ASCENDING'
  writePreference(DIRECTION_KEY, sortingDirection.value)
}

/* `SortUtil.compareToWithCollator`: Collator with PRIMARY strength (case and accent
   insensitive). */
const collator = new Intl.Collator(undefined, { sensitivity: 'base' })

interface MigrateItem {
  /** `null` for a stub: a library entry whose source is no longer installed. */
  source: Source | null
  sourceId: string
  name: string
  lang: string
  isStub: boolean
  count: number
}

const items = computed<MigrateItem[]>(() => {
  const rows: MigrateItem[] = []
  for (const [sourceId, count] of Object.entries(libraryCounts.value)) {
    if (count <= 0) continue
    // `GetSourcesWithFavoriteCount` drops the local source (`Source.isLocal()` == id 0).
    if (sourceId === '0') continue
    const source = server.sources.find(entry => entry.id === sourceId) ?? null
    if (source && isLocal(source)) continue
    rows.push({
      source,
      sourceId,
      name: source ? source.name : '',
      lang: source ? source.lang : '',
      // Mihon: `sourceManager.getOrStub(sourceId)` -> a source that is not installed
      // becomes a StubSource with an empty name and language.
      isStub: !source,
      count,
    })
  }
  /*
   * `GetSourcesWithFavoriteCount.sortFn(direction, mode)`: the comparator returns -1 for a
   * stub against a non-stub in both modes, otherwise the name (lower-cased, collated) or the
   * entry count. `Collections.reverseOrder(sortFn)` for DESCENDING negates the whole
   * comparison, so the stub rule is reversed as well.
   */
  const compare = (a: MigrateItem, b: MigrateItem): number => {
    if (a.isStub !== b.isStub) return a.isStub ? -1 : 1
    if (sortingMode.value === 'TOTAL') return a.count - b.count
    return collator.compare(a.name.toLowerCase(), b.name.toLowerCase())
  }
  const direction = sortingDirection.value === 'DESCENDING' ? -1 : 1
  return rows.sort((a, b) => direction * compare(a, b))
})

const loading = computed(() => server.loadingSources || server.loadingLibrary)
const isEmpty = computed(() => !loading.value && items.value.length === 0)

/* `SourceIcon`: the server delivers the icon of an installed source. */
const serverBase = computed(() => server.apiUrl.replace(/\/api\/v1\/?$/, ''))
function iconUrl(source: Source) {
  if (!source.iconUrl) return ''
  return /^https?:\/\//.test(source.iconUrl) ? source.iconUrl : `${serverBase.value}${source.iconUrl}`
}
function onIconError(event: Event) {
  const wrapper = (event.target as HTMLElement).parentElement
  if (wrapper) wrapper.classList.add('is-broken')
}

/* Click opens the migration screen of the source; long press copies its id. */
const MIGRATE_MANGA_PATH = '/migrate/source/:sourceId'
function routeExists(path: string) {
  return router.getRoutes().some(route => route.path === path)
}
const stubOpen = ref(false)
function openSource(item: MigrateItem) {
  if (longPressed.value) { longPressed.value = false; return }
  const ids: number[] = []
  for (const list of Object.values(server.libraryByCategory)) {
    for (const manga of list) {
      if (String(manga.sourceId) === item.sourceId && !ids.includes(manga.id)) {
        ids.push(manga.id)
      }
    }
  }
  if (routeExists(MIGRATE_MANGA_PATH)) {
    void router.push({
      path: MIGRATE_MANGA_PATH.replace(':sourceId', encodeURIComponent(item.sourceId)),
      query: ids.length ? { ids: ids.join(',') } : {},
    })
    return
  }
  // Migrating the library entries to another source needs the migration endpoint of
  // Suwayomi-Server, which the REST v1 contract does not expose.
  stubOpen.value = true
}

const TOUCH_SLOP_PX = 8
let pressTimer: number | undefined
const longPressed = ref(false)
let startX = 0
let startY = 0

function pressStart(event: PointerEvent, item: MigrateItem) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  longPressed.value = false
  startX = event.clientX
  startY = event.clientY
  if (pressTimer) window.clearTimeout(pressTimer)
  pressTimer = window.setTimeout(() => {
    pressTimer = undefined
    longPressed.value = true
    copySourceId(item)
    try { navigator.vibrate?.(40) } catch { /* optional haptic feedback */ }
  }, 500)
}

function pressMove(event: PointerEvent) {
  if (pressTimer === undefined) return
  if (Math.hypot(event.clientX - startX, event.clientY - startY) > TOUCH_SLOP_PX) {
    window.clearTimeout(pressTimer)
    pressTimer = undefined
  }
}

function pressEnd() {
  if (pressTimer) { window.clearTimeout(pressTimer); pressTimer = undefined }
}

function onContextMenu(item: MigrateItem) {
  pressEnd()
  longPressed.value = false
  copySourceId(item)
}

/* Android 13+ confirms the copy with a system overlay, older versions show the toast
   "Copied to clipboard:\n%1$s". The web build shows the same message in a snackbar.
   `String.truncateCenter(50)` shortens the copied value the same way. */
const snackbar = ref('')
let snackbarTimer: number | undefined
/** `StringExtensions.truncateCenter(count = 50, replacement = "...")`. */
function truncateCenter(value: string, count = 50): string {
  if (value.length <= count) return value
  const pieceLength = Math.floor((count - 3) / 2)
  return `${value.slice(0, pieceLength)}...${value.slice(-pieceLength)}`
}
function copySourceId(item: MigrateItem) {
  const sourceId = item.sourceId
  void navigator.clipboard?.writeText(sourceId).catch(() => undefined)
  snackbar.value = `Copied to clipboard:\n${truncateCenter(sourceId)}`
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
  snackbarTimer = window.setTimeout(() => { snackbar.value = '' }, 4000)
}

/* Mihon reports a failed fetch with `Event.FailedFetchingSourcesWithCount`; the web
   build surfaces it in a snackbar with a retry action. */
const errorSnackbar = ref('')
let errorTimer: number | undefined
function notifyError(message: string) {
  errorSnackbar.value = message
  if (errorTimer) window.clearTimeout(errorTimer)
  errorTimer = window.setTimeout(() => { errorSnackbar.value = '' }, 6000)
}

function reload() {
  void server.loadSources()
  void server.loadLibrary()
}

watch(() => server.sourcesError, error => { if (error) notifyError(`Internal error: ${error}`) })
watch(() => server.libraryError, error => { if (error) notifyError(`Internal error: ${error}`) })
watch(() => server.apiUrl, () => { void server.loadSources(); void server.loadLibrary() })
onMounted(() => {
  if (!server.sources.length) void server.loadSources()
  if (!Object.keys(server.libraryByCategory).length) void server.loadLibrary()
})

onBeforeUnmount(() => {
  if (pressTimer) window.clearTimeout(pressTimer)
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
  if (errorTimer) window.clearTimeout(errorTimer)
})
</script>

<template>
  <div class="migrate-source-screen">
    <!-- LoadingScreen: centred CircularProgressIndicator. -->
    <div v-if="loading" class="migrate-loading" role="status" aria-label="Loading sources">
      <Md3CircularProgress label="Loading sources" />
    </div>

    <!-- EmptyScreen: kaomoji face (displayMedium) above the centred message. -->
    <MihonEmptyScreen v-else-if="isEmpty" message="Your library is empty" class="migrate-empty" />

    <div v-else class="migrate-list" role="list">
      <!-- Sticky header: prompt + sorting mode + sorting direction. -->
      <div class="migrate-header">
        <span class="migrate-header-title">Select a source to migrate from</span>
        <button
          type="button"
          class="migrate-header-action"
          :title="sortingMode === 'ALPHABETICAL' ? 'Alphabetically' : 'Total entries'"
          :aria-label="sortingMode === 'ALPHABETICAL' ? 'Alphabetically' : 'Total entries'"
          @click="toggleSortingMode"
        >
          <span class="material-symbols-rounded" aria-hidden="true">{{ sortingMode === 'ALPHABETICAL' ? 'sort_by_alpha' : 'numbers' }}</span>
        </button>
        <button
          type="button"
          class="migrate-header-action"
          :title="sortingDirection === 'ASCENDING' ? 'Ascending' : 'Descending'"
          :aria-label="sortingDirection === 'ASCENDING' ? 'Ascending' : 'Descending'"
          @click="toggleSortingDirection"
        >
          <span class="material-symbols-rounded" aria-hidden="true">{{ sortingDirection === 'ASCENDING' ? 'arrow_upward' : 'arrow_downward' }}</span>
        </button>
      </div>

      <!-- `Modifier.animateItem()`: the rows fade and shift when the order changes. -->
      <TransitionGroup tag="div" name="migrate-item" class="migrate-items">
        <div
          v-for="item in items"
          :key="'migrate-' + item.sourceId"
          class="migrate-item"
          role="button"
          tabindex="0"
          :aria-label="item.name || item.sourceId"
          @click="openSource(item)"
          @keydown.enter.prevent="openSource(item)"
          @keydown.space.prevent="openSource(item)"
          @pointerdown="pressStart($event, item)"
          @pointermove="pressMove($event)"
          @pointerup="pressEnd"
          @pointerleave="pressEnd"
          @pointercancel="pressEnd"
          @contextmenu.prevent="onContextMenu(item)"
        >
          <span class="migrate-item-icon-wrap" :class="{ 'is-broken': !item.source || !iconUrl(item.source) }">
            <!-- SourceIcon for a stub source: the filled warning glyph in the error color. -->
            <span v-if="item.isStub" class="migrate-item-icon-stub material-symbols-rounded" aria-hidden="true">warning</span>
            <img
              v-else
              class="migrate-item-icon"
              :src="iconUrl(item.source!)"
              alt=""
              loading="lazy"
              @error="onIconError"
            />
            <span v-if="!item.isStub" class="migrate-item-icon-fallback material-symbols-rounded" aria-hidden="true">public</span>
          </span>

          <span class="migrate-item-content">
            <!-- `source.name.ifBlank { source.id.toString() }`. -->
            <span class="migrate-item-name">{{ item.name || item.sourceId }}</span>
            <span class="migrate-item-meta">
              <span v-if="item.lang" class="migrate-item-lang">{{ getSourceDisplayName(item.lang) }}</span>
              <span v-if="item.isStub" class="migrate-item-stub">Not installed</span>
            </span>
          </span>

          <!-- BadgeGroup { Badge(text = "$count") }. -->
          <span class="migrate-badge-group">
            <span class="migrate-badge">{{ item.count }}</span>
          </span>
        </div>
      </TransitionGroup>
    </div>

    <!-- MD3 snackbar: the clipboard confirmation (an Android toast in the reference). -->
    <div v-if="snackbar" class="migrate-snackbar" role="status" aria-live="polite">
      <span class="migrate-snackbar-text">{{ snackbar }}</span>
    </div>

    <!-- MD3 snackbar with a retry action for a failed source/library fetch. -->
    <div v-if="errorSnackbar" class="migrate-snackbar" role="status" aria-live="polite">
      <span class="migrate-snackbar-text">{{ errorSnackbar }}</span>
      <button type="button" class="migrate-snackbar-action" @click="reload(); errorSnackbar = ''">Retry</button>
    </div>

    <!--
      Stub for the migration screen of a source (`MigrateMangaScreen` in the reference).
      Suwayomi-Server exposes no endpoint that migrates library entries between sources, so
      the dialog opens with the MD3 AlertDialog geometry and states the limitation instead of
      silently doing nothing.
    -->
    <v-dialog v-model="stubOpen" max-width="560" aria-labelledby="migrate-source-stub-title" aria-describedby="migrate-source-stub-text">
      <div class="migrate-stub-dialog">
        <h2 id="migrate-source-stub-title" class="migrate-stub-title">Migrate</h2>
        <div id="migrate-source-stub-text" class="migrate-stub-content">
          <p class="migrate-stub-message">
            Migrating library entries to another source is not supported in the web version:
            the Suwayomi REST API has no endpoint that migrates or copies entries between sources.
          </p>
        </div>
        <div class="migrate-stub-actions">
          <button type="button" class="migrate-stub-button" @click="stubOpen = false">Close</button>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<style scoped>
.migrate-source-screen {
  display: block;
  min-height: 100%;
}

/* ScrollbarLazyColumn contentPadding: topSmallPaddingValues = 8dp on top. */
.migrate-list {
  padding-top: 8px;
  padding-bottom: 96px;
}

/*
 * Sticky header: background = colorScheme.background, padding start 16dp; the two
 * IconButtons (48dp) close the row without an end padding.
 */
.migrate-header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  background: rgb(var(--v-theme-background));
  padding-inline-start: 16px;
}

/* Typography.header = bodyMedium + onSurfaceVariant + FontWeight.SemiBold. */
.migrate-header-title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface-variant));
  /* The reference Text has no maxLines: it wraps inside the weighted slot. */
  overflow-wrap: break-word;
}

/*
 * IconButton: the MD3 40dp state layer inside the 48dp minimum interactive component,
 * with a 24dp icon and the LocalContentColor tint (onSurface).
 */
.migrate-header-action {
  position: relative;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 0;
  border-radius: 24px;
  background: none;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
}
.migrate-header-action::before {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 20px;
  background: currentColor;
  opacity: 0;
  transition: opacity .2s ease-in-out;
  pointer-events: none;
}
.migrate-header-action:hover::before { opacity: .08; }
.migrate-header-action:active::before { opacity: .12; }
.migrate-header-action:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
.migrate-header-action .material-symbols-rounded { font-size: 24px; width: 24px; height: 24px; }

/*
 * BaseBrowseItem: Row, padding horizontal 16dp / vertical 8dp, vertically centered.
 * The icon slot is 48dp tall, so the row is 48 + 8 + 8 = 64dp high.
 */
.migrate-item {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  min-height: 64px;
  padding: 8px 16px;
  cursor: pointer;
  user-select: none;
  background: transparent;
  border: 0;
  text-align: start;
}
.migrate-item:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 4%, transparent); }
.migrate-item:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent); }
.migrate-item:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

/* Modifier.animateItem(): appearing and disappearing rows fade, remaining rows slide into place. */
.migrate-item-enter-active,
.migrate-item-leave-active {
  transition: opacity 0.2s ease;
}
.migrate-item-enter-from,
.migrate-item-leave-to {
  opacity: 0;
}
.migrate-item-leave-active {
  position: absolute;
  width: 100%;
}
.migrate-item-move {
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
}

/*
 * SourceIcon: BaseSourceItem's icon passes Modifier.size(48.dp) inside BaseBrowseItem.
 * Slot is 48x48dp, image is centered with object-fit: contain.
 */
.migrate-item-icon-wrap {
  position: relative;
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
}
.migrate-item-icon { width: 48px; height: 48px; object-fit: contain; display: block; }
.migrate-item-icon-wrap.is-broken .migrate-item-icon { display: none; }
.migrate-item-icon-fallback { display: none; font-size: 40px; color: rgb(var(--v-theme-on-surface-variant)); }
.migrate-item-icon-wrap.is-broken .migrate-item-icon-fallback { display: block; }
/* The filled warning glyph of a stub source, tinted with colorScheme.error. */
.migrate-item-icon-stub {
  width: 40px;
  height: 40px;
  font-size: 40px;
  line-height: 40px;
  color: rgb(var(--v-theme-error));
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* Content: Column with 16dp horizontal padding, weight(1f). */
.migrate-item-content {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  flex-direction: column;
  padding: 0 16px;
}

/* bodyMedium: 14sp / 20sp, weight 400, 1 line with ellipsis. */
.migrate-item-name {
  display: block;
  min-width: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Row of secondary texts, spaced by 8dp, vertically centered. */
.migrate-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

/* bodySmall with secondaryItemAlpha (0.78). */
.migrate-item-lang {
  min-width: 0;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.4px;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.78;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* The "Not installed" label of a stub source: bodySmall, error color, 0.78 alpha. */
.migrate-item-stub {
  min-width: 0;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.4px;
  color: rgb(var(--v-theme-error));
  opacity: 0.78;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/*
 * BadgeGroup: a Row clipped to shapes.extraSmall (4dp).
 * Badge: bodySmall, FontWeight.Medium, colorScheme.secondary background with
 * onSecondary text, padding 3dp horizontal / 1dp vertical, rectangular shape.
 */
.migrate-badge-group {
  display: inline-flex;
  align-items: flex-start;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
}
.migrate-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  padding: 1px 3px;
  background: rgb(var(--v-theme-secondary));
  color: rgb(var(--v-theme-on-secondary));
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: 0.4px;
  white-space: nowrap;
}

/* LoadingScreen: centred CircularProgressIndicator. */
.migrate-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100dvh - 220px);
}

/* EmptyScreen: centered in browse pane. */
.migrate-empty {
  min-height: calc(100dvh - 220px);
}

/* MD3 snackbar (inverse surface). */
.migrate-snackbar {
  position: fixed;
  left: 50%;
  bottom: calc(80px + 16px);
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: min(560px, calc(100vw - 32px));
  min-width: 288px;
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0.25px;
  box-shadow: 0 3px 6px rgba(0, 0, 0, .28), 0 1px 2px rgba(0, 0, 0, .2);
}
.migrate-snackbar-text { flex: 1 1 auto; white-space: pre-line; }
.migrate-snackbar-action {
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: none;
  color: rgb(var(--v-theme-inverse-primary));
  font: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  cursor: pointer;
}

/*
 * Stub dialog for the missing Suwayomi migration endpoint. It uses the plain MD3
 * AlertDialog geometry: container surfaceContainerHigh, shape cornerExtraLarge (28dp),
 * elevation level 3, padding 24dp, title headlineSmall (24/32) in onSurface with 16dp
 * bottom padding, body bodyMedium (14/20) in onSurfaceVariant with 24dp bottom padding
 * and a labelLarge (14/20, w500) text button in primary.
 */
.migrate-stub-dialog {
  box-sizing: border-box;
  align-self: center;
  width: fit-content;
  min-width: 280px;
  max-width: 560px;
  margin: 0 auto;
  padding: 24px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, .3), 0 4px 8px 3px rgba(0, 0, 0, .15);
}
.migrate-stub-title {
  margin: 0;
  padding-bottom: 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  text-align: start;
}
.migrate-stub-content { display: flex; flex-direction: column; gap: 8px; padding-bottom: 24px; }
.migrate-stub-message {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: .25px;
  color: rgb(var(--v-theme-on-surface-variant));
}
.migrate-stub-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; row-gap: 8px; }
.migrate-stub-button {
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
  letter-spacing: .1px;
  cursor: pointer;
}
.migrate-stub-button:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
.migrate-stub-button:active { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 10%, transparent); }
.migrate-stub-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
</style>
