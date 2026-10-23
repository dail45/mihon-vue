<script lang="ts">
/**
 * The action flags of the Updates bottom bar, mirroring the `takeIf { ... }` guards of
 * `UpdatesScreen.kt:216-248`. They live in `src/utils/updatesBottomActions.ts` so that
 * unit tests can import them without a Vue SFC compiler.
 */
export { updatesBottomActionFlags } from '../utils/updatesBottomActions'
export type { UpdatesBottomActionChapter, UpdatesBottomActionFlags } from '../utils/updatesBottomActions'
</script>

<script setup lang="ts">
/**
 * Pixel-parity port of the Updates bottom action bar.
 *
 * Reference:
 *   mihon/app/src/main/java/eu/kanade/presentation/updates/UpdatesScreen.kt:216-248
 *     `UpdatesBottomBar(selected, onDownloadChapter, onMultiBookmarkClicked,
 *                       onMultiMarkAsReadClicked, onMultiDeleteClicked)`
 *     -> `MangaBottomActionMenu(visible = selected.isNotEmpty(), modifier = Modifier.fillMaxWidth(), ...)`
 *   mihon/app/src/main/java/eu/kanade/presentation/manga/components/MangaBottomActionMenu.kt:69-229
 *     the shared surface / row / button geometry reused by the Updates bar.
 *   mihon/app/src/main/java/eu/kanade/tachiyomi/ui/updates/UpdatesTab.kt:61-81,118-120
 *     the wiring of the bar and `HomeScreen.showBottomNav(!state.selectionMode)` — the app
 *     navigation bar is hidden while the selection (and therefore this bar) is active.
 *   mihon/app/src/main/java/eu/kanade/presentation/updates/UpdatesDeleteConfirmationDialog.kt
 *     the delete confirmation, rendered here by the sibling `UpdatesDeleteDialog.vue`.
 *
 * Which buttons exist is decided exactly like the Kotlin `takeIf { ... }` guards:
 *   onBookmarkClicked        = selected.fastAny { !it.update.bookmark }
 *   onRemoveBookmarkClicked = selected.fastAll { it.update.bookmark }
 *   onMarkAsReadClicked     = selected.fastAny { !it.update.read }
 *   onMarkAsUnreadClicked   = selected.fastAny { it.update.read || it.update.lastPageRead > 0 }
 *   onDownloadClicked       = selected.fastAny { it.downloadStateProvider() != Download.State.DOWNLOADED }
 *   onDeleteClicked         = selected.fastAny { it.downloadStateProvider() == Download.State.DOWNLOADED }
 *
 * The surface is `MaterialTheme.shapes.large` (16dp) with the bottom corners zeroed, the
 * row uses `navigationBars` bottom inset + 8dp horizontal / 12dp vertical padding, and every
 * button is a 48dp box whose weight grows from 1 to 2 while its long-press label is shown.
 *
 * The web client is a headless Suwayomi REST/GraphQL client. The bulk actions map onto the
 * server API:
 *   bookmark / read  -> PATCH /manga/{id}/chapter/{index}   (REST v1 chapter update)
 *   download         -> GraphQL `enqueueChapterDownload`      (Suwayomi download queue)
 *   delete           -> the reference delete confirmation, `DELETE /manga/{id}/chapter/{index}`
 */
import { computed, onUnmounted, ref, watch } from 'vue'
import { createSuwayomiApi, apiErrorMessage } from '../api/client'
import { enqueueChapterDownload, startDownloader } from '../api/downloads'
import { useBottomNavVisibility } from '../composables/useBottomNavVisibility'
import { updatesBottomActionFlags } from '../utils/updatesBottomActions'
import type { MangaChapter } from '../api/types'
import UpdatesDeleteDialog from './UpdatesDeleteDialog.vue'

const props = withDefaults(defineProps<{
  /** Suwayomi REST base URL, e.g. https://host/api/v1 */
  apiUrl: string
  /** The selected update entries (`UpdatesItem` in the reference). */
  selected?: MangaChapter[]
  /** Overrides the reference rule `visible = selected.isNotEmpty()`. */
  visible?: boolean
}>(), { selected: () => [], visible: undefined })

const emit = defineEmits<{
  /** `toggleAllSelection(false)` in UpdatesViewModel.kt after every bulk action. */
  'clear-selection': []
  /** Local chapter state changes so the feed can be updated without a refetch. */
  'update': [changes: { id: number; read?: boolean; bookmarked?: boolean; downloaded?: boolean }[]]
  'error': [message: string]
}>()

const selected = computed(() => props.selected ?? [])
const visible = computed(() => props.visible ?? selected.value.length > 0)

/* ------------------------------------------------------------------ *
 * Action visibility (the Kotlin `takeIf` guards)
 * ------------------------------------------------------------------ */
const flags = computed(() => updatesBottomActionFlags(selected.value.map(entry => entry.chapter)))
const canBookmark = computed(() => flags.value.canBookmark)
const canRemoveBookmark = computed(() => flags.value.canRemoveBookmark)
const canMarkAsRead = computed(() => flags.value.canMarkAsRead)
const canMarkAsUnread = computed(() => flags.value.canMarkAsUnread)
const canDownload = computed(() => flags.value.canDownload)
const canDelete = computed(() => flags.value.canDelete)

interface Action {
  key: 'bookmark' | 'remove-bookmark' | 'mark-as-read' | 'mark-as-unread' | 'download' | 'delete'
  /** Index into the `confirm` state list; fixed positions like the Kotlin `confirm` list. */
  index: number
  /** `MR.strings.action_*` of the reference base strings.xml. */
  title: string
  icon: string
}

const actions = computed<Action[]>(() => {
  const list: Action[] = []
  if (canBookmark.value) list.push({ key: 'bookmark', index: 0, title: 'Bookmark chapter', icon: 'bookmark_add' })
  if (canRemoveBookmark.value) list.push({ key: 'remove-bookmark', index: 1, title: 'Unbookmark chapter', icon: 'bookmark_remove' })
  if (canMarkAsRead.value) list.push({ key: 'mark-as-read', index: 2, title: 'Mark as read', icon: 'done_all' })
  if (canMarkAsUnread.value) list.push({ key: 'mark-as-unread', index: 3, title: 'Mark as unread', icon: 'remove_done' })
  if (canDownload.value) list.push({ key: 'download', index: 5, title: 'Download', icon: 'download' })
  if (canDelete.value) list.push({ key: 'delete', index: 6, title: 'Delete', icon: 'delete' })
  return list
})

/* ------------------------------------------------------------------ *
 * Long press confirmation
 *
 * `combinedClickable(onLongClick = …)`: a long press shows the action title under
 * the icon and resets after one second. Only one item can be in that state.
 * ------------------------------------------------------------------ */
const LONG_PRESS_MS = 500
const CONFIRM_RESET_MS = 1000
const TOUCH_SLOP_PX = 8
const confirm = ref<boolean[]>([false, false, false, false, false, false, false])
let pressTimer: number | undefined
let resetTimer: number | undefined
let longPressed = false
let startX = 0
let startY = 0

function triggerLongClick(action: Action) {
  longPressed = true
  confirm.value = confirm.value.map((_, index) => index === action.index)
  try { navigator.vibrate?.(20) } catch { /* haptics are optional in the browser */ }
  if (resetTimer !== undefined) window.clearTimeout(resetTimer)
  resetTimer = window.setTimeout(() => {
    // `confirm[toConfirmIndex] = false` — only the pressed entry is cleared.
    const next = confirm.value.slice()
    next[action.index] = false
    confirm.value = next
    resetTimer = undefined
  }, CONFIRM_RESET_MS)
}

function onPressStart(action: Action) {
  window.clearTimeout(pressTimer)
  longPressed = false
  pressTimer = window.setTimeout(() => {
    triggerLongClick(action)
  }, LONG_PRESS_MS)
}

function onPressEnd() {
  window.clearTimeout(pressTimer)
  pressTimer = undefined
}

function onPointerMove(event: PointerEvent) {
  if (pressTimer === undefined) return
  if (Math.hypot(event.clientX - startX, event.clientY - startY) > TOUCH_SLOP_PX) {
    window.clearTimeout(pressTimer)
    pressTimer = undefined
  }
}

function onClick(action: Action) {
  if (longPressed) { longPressed = false; return }
  if (busy.value) return
  switch (action.key) {
    case 'bookmark': void runBookmark(true); break
    case 'remove-bookmark': void runBookmark(false); break
    case 'mark-as-read': void runRead(true); break
    case 'mark-as-unread': void runRead(false); break
    case 'download': void runDownload(); break
    case 'delete': deleteOpen.value = true; break
  }
}

// The Kotlin surface leaves the composition when the menu hides, which resets `confirm`.
watch(visible, value => {
  if (!value) {
    window.clearTimeout(pressTimer)
    window.clearTimeout(resetTimer)
    confirm.value = [false, false, false, false, false, false, false]
  }
})

/* ------------------------------------------------------------------ *
 * Bulk actions
 *
 * `bookmarkUpdates` / `markUpdatesRead` in UpdatesViewModel.kt write the chapter
 * state and then call `toggleAllSelection(false)`.
 * ------------------------------------------------------------------ */
const busy = ref(false)
const api = computed(() => createSuwayomiApi(props.apiUrl))

async function runBookmark(bookmark: boolean) {
  // `updates.filterNot { it.update.bookmark == bookmark }`
  const targets = selected.value.filter(entry => entry.chapter.bookmarked !== bookmark)
  if (!targets.length) { finish([]); return }
  busy.value = true
  const changes: { id: number; read?: boolean; bookmarked?: boolean }[] = []
  try {
    for (const entry of targets) {
      await api.value.modifyChapter(entry.manga.id, entry.chapter.index, { bookmarked: bookmark })
      changes.push({ id: entry.chapter.id, bookmarked: bookmark })
    }
    finish(changes)
  } catch (cause) { fail(cause) } finally { busy.value = false }
}

async function runRead(read: boolean) {
  // SetReadStatus.kt: read -> only unread chapters; unread -> read or partially read ones.
  const targets = selected.value.filter(entry => (read ? !entry.chapter.read : entry.chapter.read || entry.chapter.lastPageRead > 0))
  if (!targets.length) { finish([]); return }
  busy.value = true
  const changes: { id: number; read?: boolean; bookmarked?: boolean }[] = []
  try {
    for (const entry of targets) {
      // Marking as unread also resets the stored page (SetReadStatus.kt: lastPageRead = 0).
      await api.value.modifyChapter(entry.manga.id, entry.chapter.index, read ? { read: true } : { read: false, lastPageRead: 0 })
      changes.push({ id: entry.chapter.id, read })
    }
    finish(changes)
  } catch (cause) { fail(cause) } finally { busy.value = false }
}

/**
 * `onDownloadChapter(selected, ChapterDownloadAction.START)` ->
 * `UpdatesViewModel.downloadChapters(items, START)` -> `downloadManager.downloadChapters(...)`.
 *
 * Suwayomi exposes the same queue through GraphQL: `enqueueChapterDownload(id)`.
 * Mihon's `downloadManager` picks the queued chapters up on its own, so the server
 * downloader is started as well; the selection is cleared afterwards.
 */
async function runDownload() {
  const targets = selected.value.filter(entry => !entry.chapter.downloaded)
  if (!targets.length) { finish([]); return }
  busy.value = true
  try {
    for (const entry of targets) {
      await enqueueChapterDownload(props.apiUrl, entry.chapter.id)
    }
    await startDownloader(props.apiUrl)
    showSnackbar(`Queued ${targets.length} chapter${targets.length === 1 ? '' : 's'} for download.`)
    finish([])
  } catch (cause) { fail(cause) } finally { busy.value = false }
}

/** `toggleAllSelection(false)` after a successful bulk action. */
function finish(changes: { id: number; read?: boolean; bookmarked?: boolean }[]) {
  if (changes.length) emit('update', changes)
  emit('clear-selection')
}

function fail(cause: unknown) {
  const message = apiErrorMessage(cause)
  showSnackbar(message)
  emit('error', message)
}

/* ------------------------------------------------------------------ *
 * Delete confirmation (UpdatesDeleteConfirmationDialog.kt)
 * ------------------------------------------------------------------ */
const deleteOpen = ref(false)
const snackbar = ref('')
let snackbarTimer: number | undefined

function showSnackbar(message: string) {
  snackbar.value = message
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
  snackbarTimer = window.setTimeout(() => { snackbar.value = '' }, 6000)
}

function onDeleted(ids: number[]) {
  deleteOpen.value = false
  // `deleteChapters` removes the downloaded file, so the chapter is no longer downloaded.
  finish(ids.map(id => ({ id, downloaded: false })))
}

function onDeleteError(message: string) {
  showSnackbar(message)
  emit('error', message)
}

/* ------------------------------------------------------------------ *
 * The app navigation bar is hidden while the selection bar is active
 * (UpdatesTab.kt: `HomeScreen.showBottomNav(!state.selectionMode)`).
 * `state.selectionMode` is `selected.isNotEmpty()` (UpdatesViewModel.kt:506),
 * the very condition that shows this bar.
 * ------------------------------------------------------------------ */
const { showBottomNav } = useBottomNavVisibility()
watch(visible, value => {
  showBottomNav(!value)
}, { immediate: true })
onUnmounted(() => {
  showBottomNav(true)
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
})

/* ------------------------------------------------------------------ *
 * Ripple (Compose `ripple(bounded = false)`)
 * ------------------------------------------------------------------ */
function onPointerDown(event: PointerEvent, action: Action) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  if (busy.value) return
  startX = event.clientX
  startY = event.clientY

  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const radius = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y))
  const ripple = document.createElement('span')
  ripple.className = 'updates-action-ripple'
  ripple.style.left = `${x}px`
  ripple.style.top = `${y}px`
  ripple.style.width = `${radius * 2}px`
  ripple.style.height = `${radius * 2}px`
  target.appendChild(ripple)
  window.setTimeout(() => ripple.remove(), 600)

  onPressStart(action)
}
</script>

<template>
  <div
    class="updates-bottom-bar"
    :class="{ 'is-visible': visible }"
    :aria-hidden="visible ? undefined : 'true'"
  >
    <div class="updates-bottom-bar-clip">
      <div class="updates-bottom-bar-surface" role="toolbar" aria-label="Updates actions">
        <div class="updates-bottom-bar-row">
          <div
            v-for="action in actions"
            :key="action.key"
            class="updates-action"
            :class="{ 'is-confirming': confirm[action.index] }"
          >
            <button
              type="button"
              class="updates-action-inner"
              :aria-label="action.title"
              :disabled="busy"
              :aria-busy="busy ? 'true' : undefined"
              @click="onClick(action)"
              @pointerdown="onPointerDown($event, action)"
              @pointermove="onPointerMove"
              @pointerup="onPressEnd"
              @pointerleave="onPressEnd"
              @pointercancel="onPressEnd"
              @contextmenu.prevent
            >
              <span class="updates-action-state-layer" aria-hidden="true" />
              <span class="updates-action-column">
                <span class="updates-action-icon" aria-hidden="true">
                  <v-icon :icon="action.icon" size="24" />
                </span>
                <span class="updates-action-label-wrap" :class="{ 'is-visible': confirm[action.index] }">
                  <span class="updates-action-label">{{ action.title }}</span>
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Scaffold(snackbarHost = { SnackbarHost(snackbarHostState) }) of UpdatesScreen.kt:96. -->
  <div
    v-if="snackbar"
    class="updates-action-snackbar"
    :class="{ 'is-visible': visible }"
    role="status"
    aria-live="polite"
  >{{ snackbar }}</div>

  <UpdatesDeleteDialog
    v-model="deleteOpen"
    :chapters="selected"
    :api-url="apiUrl"
    @deleted="onDeleted"
    @delete-error="onDeleteError"
  />
</template>

<style scoped>
@layer app-components {
/* AnimatedVisibility(visible, enter = expandVertically(expandFrom = Bottom), exit = shrinkVertically(shrinkTowards = Bottom)) */
.updates-bottom-bar {
  position: fixed;
  left: var(--v-layout-left, 0px);
  right: 0;
  bottom: 0;
  z-index: 1100;
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 300ms cubic-bezier(0.2, 0, 0, 1);
  pointer-events: none;
}
.updates-bottom-bar.is-visible {
  grid-template-rows: 1fr;
  pointer-events: auto;
}
.updates-bottom-bar-clip {
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
/* Surface: MaterialTheme.shapes.large with the bottom corners zeroed, color = surfaceContainerHigh. */
.updates-bottom-bar-surface {
  background: rgb(var(--v-theme-surface-container-high));
  border-radius: 16px 16px 0 0;
  color: rgb(var(--v-theme-on-surface));
}
/* Row: navigationBars bottom inset + 8dp horizontal / 12dp vertical padding. */
.updates-bottom-bar-row {
  display: flex;
  align-items: center;
  padding: 12px 8px calc(12px + env(safe-area-inset-bottom, 0px));
}
/* RowScope.weight: every button gets one share of the row, the confirming one twice. */
.updates-action {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  justify-content: center;
  transition: flex-grow 250ms cubic-bezier(0.2, 0, 0, 1);
}
.updates-action.is-confirming {
  flex-grow: 2;
}
/* Box(Modifier.size(48.dp).weight(animatedWeight), contentAlignment = Center):
   the box is 48dp tall and as wide as its weight share; the clickable area covers the
   whole share. */
.updates-action-inner {
  position: relative;
  width: 100%;
  height: 48px;
  padding: 0;
  border: 0;
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: inherit;
  overflow: visible;
  -webkit-tap-highlight-color: transparent;
}
.updates-action-inner:disabled {
  opacity: 0.38;
  cursor: default;
  pointer-events: none;
}
/* Material 3 state layers (hover 8%, focus/active 12%) */
.updates-action-state-layer {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 48px;
  height: 48px;
  border-radius: 24px;
  background-color: transparent;
  pointer-events: none;
  transition: background-color 150ms cubic-bezier(0.2, 0, 0, 1), width 250ms cubic-bezier(0.2, 0, 0, 1);
}
.updates-action.is-confirming .updates-action-state-layer {
  width: 100%;
}
@media (hover: hover) {
  .updates-action-inner:hover .updates-action-state-layer {
    background-color: rgba(var(--v-theme-on-surface), 0.08);
  }
}
.updates-action-inner:focus-visible .updates-action-state-layer {
  background-color: rgba(var(--v-theme-on-surface), 0.12);
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
.updates-action-inner:active .updates-action-state-layer {
  background-color: rgba(var(--v-theme-on-surface), 0.12);
}
/*
 * Column(verticalArrangement = Center, horizontalAlignment = CenterHorizontally).
 * The Column is centred in the weighted Box, so the label ends up centred in the button
 * and may overflow it (`TextOverflow.Visible`).
 */
.updates-action-column {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
}
.updates-action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  line-height: 1;
  flex: 0 0 auto;
}
.updates-action-icon :deep(.v-icon) {
  font-size: 24px;
}
/* AnimatedVisibility(enter = expandVertically(expandFrom = Top) + fadeIn(), exit = shrinkVertically(shrinkTowards = Top) + fadeOut()). */
.updates-action-label-wrap {
  display: block;
  /* The label lives in the weighted Box, so it is as wide as the button share. */
  width: 100%;
  height: 0;
  overflow: hidden;
  opacity: 0;
  transition: height 200ms cubic-bezier(0.2, 0, 0, 1), opacity 150ms ease-out;
}
.updates-action-label-wrap.is-visible {
  height: 16px;
  opacity: 1;
}
.updates-action-label {
  display: block;
  width: 100%;
  line-height: 16px;
  /* MaterialTheme.typography.labelSmall: 11sp / 16sp, Medium, 0.5sp letter spacing. */
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.5px;
  white-space: nowrap;
  /* TextOverflow.Visible: the label may overflow its box. */
  overflow: visible;
  text-align: center;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0;
  transition: opacity 150ms ease-out;
}
.updates-action-label-wrap.is-visible .updates-action-label {
  opacity: 1;
}
/* Compose `ripple(bounded = false)`: an unbounded circle from the touch point. */
.updates-action-ripple {
  position: absolute;
  z-index: 0;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.12;
  pointer-events: none;
  transform: translate(-50%, -50%) scale(0);
  animation: updates-action-ripple 500ms ease-out forwards;
}
@keyframes updates-action-ripple {
  to { transform: translate(-50%, -50%) scale(1); opacity: 0; }
}
/* MD3 Snackbar: inverseSurface container, inverseOnSurface content, CornerExtraSmall (4dp),
   level 3 elevation, 48dp minimum height, 16dp horizontal padding. */
.updates-action-snackbar {
  position: fixed;
  left: 50%;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  z-index: 1200;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  min-height: 48px;
  max-width: min(560px, calc(100% - 32px));
  padding: 8px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 4px 8px 3px rgba(0, 0, 0, 0.15);
  transition: bottom 300ms cubic-bezier(0.2, 0, 0, 1);
}
/* The Scaffold places the snackbar above the bottom bar. */
.updates-action-snackbar.is-visible {
  bottom: calc(88px + env(safe-area-inset-bottom, 0px));
}
}
</style>
