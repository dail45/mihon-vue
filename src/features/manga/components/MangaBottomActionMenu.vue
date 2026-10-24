<script setup lang="ts">
export type { MangaBottomActionChapter, MangaBottomActionFlags } from '@/core/utils/mangaBottomActions'

/**
 * Pixel-parity port of the Mihon bottom action menus.
 *
 * Reference: mihon/app/src/main/java/eu/kanade/presentation/manga/components/MangaBottomActionMenu.kt
 *  - `MangaBottomActionMenu(visible, onBookmarkClicked, …)` — the chapter selection bar of
 *    the manga screen (`MangaScreen.kt` → `SharedMangaBottomActionMenu`).
 *  - `LibraryBottomActionMenu(visible, onChangeCategoryClicked, …)` — the library
 *    selection bar (`LibraryTab.kt`).
 *
 * Geometry, taken from the reference:
 *  - `Surface(shape = MaterialTheme.shapes.large.copy(bottomEnd = ZeroCornerSize,
 *    bottomStart = ZeroCornerSize), color = surfaceContainerHigh)` → 16dp top corners,
 *    square bottom corners, `surfaceContainerHigh`.
 *  - `Row(modifier = Modifier.padding(navigationBars.only(Bottom).asPaddingValues())
 *    .padding(horizontal = 8.dp, vertical = 12.dp))`.
 *  - `RowScope.Button`: `Box(Modifier.size(48.dp).weight(animatedWeight).combinedClickable(
 *    ripple(bounded = false)))` — the box is 48dp tall, its width is one weight share of
 *    the row (twice the share while the long-press confirmation is shown).
 *  - `Icon(imageVector = icon, contentDescription = title)` — 24dp, `onSurface` tint.
 *  - `Text(style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = Visible)`
 *    — 11sp / 16sp, weight 500, 0.5sp letter spacing; it may overflow the 48dp button.
 *  - `AnimatedVisibility(enter = expandVertically(expandFrom = Bottom) + fadeIn(), …)` for
 *    the label and `expandVertically(expandFrom = Bottom)` / `shrinkVertically(towards
 *    = Bottom)` for the bar itself (the library variant uses a 300ms delayed tween).
 *  - `combinedClickable(onLongClick = …)`: the long press shows the action title and
 *    resets after one second; only one item can be in that state at a time.
 *  - The library variant opens a `DownloadDropdownMenu` (six items) from the download
 *    button and a `DropdownMenu` (Migrate / Delete) from the overflow button, both with
 *    `BottomBarMenuDpOffset = DpOffset(0.dp, 0.dp)`; the reference `DropdownMenu` is
 *    `sizeIn(minWidth = 196.dp, maxWidth = 196.dp)`.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type Variant = 'manga' | 'library'
type ActionKey =
  | 'bookmark'
  | 'remove-bookmark'
  | 'mark-as-read'
  | 'mark-as-unread'
  | 'mark-previous-as-read'
  | 'download'
  | 'delete'
  | 'set-categories'
  | 'migrate'
  | 'more'

const props = withDefaults(defineProps<{
  /** `AnimatedVisibility(visible = …)`. */
  visible: boolean
  /** `MangaBottomActionMenu` (chapter selection) or `LibraryBottomActionMenu` (library selection). */
  variant?: Variant
  /* MangaBottomActionMenu */
  canBookmark?: boolean
  canRemoveBookmark?: boolean
  canMarkAsRead?: boolean
  canMarkAsUnread?: boolean
  canMarkPreviousAsRead?: boolean
  /* Shared */
  canDownload?: boolean
  canDelete?: boolean
  /**
   * `MangaScreen.kt` → `modifier.fillMaxWidth(fillFraction)`: 1f on the phone layout,
   * 0.5f on the expanded (tablet) layout, where the bar is aligned to the end.
   */
  fillFraction?: number
  /**
   * The Suwayomi REST API exposes no downloader queue, no chapter deletion of the local
   * files and no source migration, and the web client keeps no local chapter storage.
   * When an action is not supported by the host, the button is still rendered exactly as
   * in Mihon, but it explains the limitation instead of running the action.
   *
   * Defaults: the download and the migration are unsupported (the API has no endpoint for
   * them), the deletion is supported — the host opens its own confirmation dialog, like
   * `DeleteChaptersDialog.vue` in the manga screen and `DeleteLibraryMangaDialog.vue` in
   * the library.
   */
  downloadUnsupported?: boolean
  deleteUnsupported?: boolean
  migrateUnsupported?: boolean
}>(), {
  variant: 'manga',
  canBookmark: false,
  canRemoveBookmark: false,
  canMarkAsRead: false,
  canMarkAsUnread: false,
  canMarkPreviousAsRead: false,
  canDownload: false,
  canDelete: false,
  fillFraction: 1,
  downloadUnsupported: undefined,
  deleteUnsupported: undefined,
  migrateUnsupported: undefined,
})

const emit = defineEmits<{
  (event: 'bookmark'): void
  (event: 'remove-bookmark'): void
  (event: 'mark-as-read'): void
  (event: 'mark-as-unread'): void
  (event: 'mark-previous-as-read'): void
  (event: 'download', action?: string): void
  (event: 'delete'): void
  (event: 'set-categories'): void
  (event: 'migrate'): void
}>()

const downloadUnsupported = computed(() => props.downloadUnsupported ?? true)
const deleteUnsupported = computed(() => props.deleteUnsupported ?? false)
const migrateUnsupported = computed(() => props.migrateUnsupported ?? true)

interface Action {
  key: ActionKey
  /** Index into the `confirm` state list; fixed positions like the Kotlin `confirm` list. */
  index: number
  title: string
  icon: string
  /** `toConfirm = false` (the overflow button of the library menu has no confirmation). */
  confirmable: boolean
}

/**
 * The buttons of the reference, in the reference order, with the reference strings
 * (`MR.strings.*` of the reference base `strings.xml` / `plurals.xml`).
 */
const actions = computed<Action[]>(() => {
  if (props.variant === 'manga') {
    const list: Action[] = []
    if (props.canBookmark) list.push({ key: 'bookmark', index: 0, title: 'Bookmark chapter', icon: 'bookmark_add', confirmable: true })
    if (props.canRemoveBookmark) list.push({ key: 'remove-bookmark', index: 1, title: 'Unbookmark chapter', icon: 'bookmark_remove', confirmable: true })
    if (props.canMarkAsRead) list.push({ key: 'mark-as-read', index: 2, title: 'Mark as read', icon: 'done_all', confirmable: true })
    if (props.canMarkAsUnread) list.push({ key: 'mark-as-unread', index: 3, title: 'Mark as unread', icon: 'remove_done', confirmable: true })
    if (props.canMarkPreviousAsRead) list.push({ key: 'mark-previous-as-read', index: 4, title: 'Mark previous as read', icon: 'done_previous', confirmable: true })
    if (props.canDownload) list.push({ key: 'download', index: 5, title: 'Download', icon: 'download', confirmable: true })
    if (props.canDelete) list.push({ key: 'delete', index: 6, title: 'Delete', icon: 'delete', confirmable: true })
    return list
  }
  // `LibraryBottomActionMenu` always renders the first three buttons and its callbacks
  // are not nullable.
  const list: Action[] = [
    { key: 'set-categories', index: 0, title: 'Set categories', icon: 'label', confirmable: true },
    { key: 'mark-as-read', index: 1, title: 'Mark as read', icon: 'done_all', confirmable: true },
    { key: 'mark-as-unread', index: 2, title: 'Mark as unread', icon: 'remove_done', confirmable: true },
  ]
  if (props.canDownload) {
    list.push({ key: 'download', index: 3, title: 'Download', icon: 'download', confirmable: true })
    // `itemOverflow` is `onDownloadClicked != null`: Migrate and Delete move into the overflow menu.
    list.push({ key: 'more', index: -1, title: 'More', icon: 'more_vert', confirmable: false })
  } else {
    list.push({ key: 'migrate', index: 4, title: 'Migrate', icon: 'swap_calls', confirmable: true })
    list.push({ key: 'delete', index: 5, title: 'Delete', icon: 'delete', confirmable: true })
  }
  return list
})

/* ------------------------------------------------------------------ *
 * Long press confirmation
 *
 * `combinedClickable(onLongClick = …)`: a long press shows the action title under the icon
 * and resets after one second. Only one item can be in that state at a time.
 * ------------------------------------------------------------------ */
const LONG_PRESS_MS = 500
const CONFIRM_RESET_MS = 1000
const confirm = ref<boolean[]>([false, false, false, false, false, false, false])
let pressTimer: number | undefined
let resetTimer: number | undefined
let longPressed = false
let startX = 0
let startY = 0

function isConfirming(action: Action) {
  return action.index >= 0 && confirm.value[action.index] === true
}

function clearTimers() {
  window.clearTimeout(pressTimer)
  window.clearTimeout(resetTimer)
  pressTimer = undefined
  resetTimer = undefined
}

function onPressStart(action: Action, event?: PointerEvent) {
  clearTimers()
  longPressed = false
  if (event) {
    startX = event.clientX
    startY = event.clientY
  }
  // The overflow button of the library menu has `onLongClick = {}`: it is not confirmable.
  if (!action.confirmable) return
  pressTimer = window.setTimeout(() => {
    longPressed = true
    // `confirm.indices.forEach { i -> confirm[i] = i == toConfirmIndex }`
    confirm.value = confirm.value.map((_, index) => index === action.index)
    try { navigator.vibrate?.(20) } catch { /* haptics are optional in the browser */ }
    resetTimer = window.setTimeout(() => {
      confirm.value = confirm.value.map((_, index) => index !== action.index)
    }, CONFIRM_RESET_MS)
  }, LONG_PRESS_MS)
}

function onPointerMove(event: PointerEvent) {
  if (pressTimer === undefined) return
  const dx = event.clientX - startX
  const dy = event.clientY - startY
  if (Math.hypot(dx, dy) > 10) {
    onPressEnd()
  }
}

function onPressEnd() {
  window.clearTimeout(pressTimer)
  pressTimer = undefined
}

/**
 * The click handler of the reference buttons.
 *
 * `combinedClickable` consumes a long press, so the click handler does not run afterwards.
 * The library variant toggles its download dropdown and opens its overflow menu instead of
 * running an action.
 */
function onClick(action: Action) {
  if (longPressed) { longPressed = false; return }
  if (action.key === 'more') { toggleMenu('overflow', overflowActivator.value); return }
  if (action.key === 'download' && props.variant === 'library') {
    toggleMenu('download', downloadActivator.value)
    return
  }
  switch (action.key) {
    case 'bookmark': emit('bookmark'); break
    case 'remove-bookmark': emit('remove-bookmark'); break
    case 'mark-as-read': emit('mark-as-read'); break
    case 'mark-as-unread': emit('mark-as-unread'); break
    case 'mark-previous-as-read': emit('mark-previous-as-read'); break
    case 'set-categories': emit('set-categories'); break
    case 'migrate':
      if (migrateUnsupported.value) { stubAction.value = 'migrate'; break }
      emit('migrate')
      break
    case 'delete':
      if (deleteUnsupported.value) { stubAction.value = 'delete'; break }
      emit('delete')
      break
    case 'download':
      if (downloadUnsupported.value) { stubAction.value = 'download'; break }
      emit('download')
      break
  }
}

// The Kotlin composable leaves the composition when the menu hides, which resets `confirm`.
watch(() => props.visible, visible => {
  if (!visible) {
    clearTimers()
    longPressed = false
    confirm.value = [false, false, false, false, false, false, false]
    closeMenu()
    stubAction.value = null
  }
})

/* ------------------------------------------------------------------ *
 * The app navigation bar
 *
 * `LibraryTab.kt:266`: `HomeScreen.showBottomNav(!state.selectionMode)` — while the
 * library selection (and therefore this bar) is active, the app navigation bar is
 * hidden. The manga screen is a separate route that has no app navigation bar.
 * ------------------------------------------------------------------ */
watch(
  () => props.visible && props.variant === 'library',
  active => { document.body.classList.toggle('manga-bottom-action-library-active', active) },
  { immediate: true },
)
onBeforeUnmount(() => {
  document.body.classList.remove('manga-bottom-action-library-active')
})

/* ------------------------------------------------------------------ *
 * Dropdown menus of the library variant
 *
 * `DownloadDropdownMenu` (six items) and `DropdownMenu` (Migrate / Delete) of the
 * reference, both anchored to their button with `DpOffset(0.dp, 0.dp)`. The reference
 * `DropdownMenu` is `sizeIn(minWidth = 196.dp, maxWidth = 196.dp)`.
 * ------------------------------------------------------------------ */
type MenuKind = 'download' | 'overflow'
const menuKind = ref<MenuKind | null>(null)
const menuRect = ref({ left: 0, top: 0 })
/** Viewport height, kept reactive so the menu can be placed above its activator. */
const viewportHeight = ref(0)
/** The menu opens above its activator: `bottom` is the distance to the viewport bottom. */
const menuBottom = computed(() => Math.max(0, viewportHeight.value - menuRect.value.top))

function updateViewportHeight() {
  viewportHeight.value = window.innerHeight
}
const overflowActivator = ref<HTMLElement | null>(null)
const downloadActivator = ref<HTMLElement | null>(null)

/** `DownloadDropdownMenuItems` of the reference (`MR.plurals.download_amount`). */
const downloadOptions = [
  { key: 'NEXT_1_CHAPTER', label: 'Next chapter' },
  { key: 'NEXT_5_CHAPTERS', label: 'Next 5 chapters' },
  { key: 'NEXT_10_CHAPTERS', label: 'Next 10 chapters' },
  { key: 'NEXT_25_CHAPTERS', label: 'Next 25 chapters' },
  { key: 'UNREAD_CHAPTERS', label: 'Unread' },
  { key: 'BOOKMARKED_CHAPTERS', label: 'Bookmarked' },
]

const menuItems = computed(() => {
  if (menuKind.value === 'download') return downloadOptions
  return [
    { key: 'migrate', label: 'Migrate' },
    { key: 'delete', label: 'Delete' },
  ]
})

/**
 * The reference anchors the menu at the top-left of the button and lets the popup
 * reposition itself above the bottom bar. The menu is therefore placed right above the
 * button, aligned to its start edge.
 */
function openMenu(kind: MenuKind, activator: HTMLElement | null) {
  if (!activator) return
  const rect = activator.getBoundingClientRect()
  menuRect.value = { left: rect.left, top: rect.top }
  menuKind.value = kind
}

function closeMenu() {
  menuKind.value = null
}

/** `downloadExpanded = !downloadExpanded` / `overflowMenuOpen = true` of the reference. */
function toggleMenu(kind: MenuKind, activator: HTMLElement | null) {
  if (menuKind.value === kind) { closeMenu(); return }
  openMenu(kind, activator)
}

function onMenuItem(key: string) {
  const kind = menuKind.value
  closeMenu()
  if (kind === 'download') {
    if (downloadUnsupported.value) { stubAction.value = 'download'; return }
    emit('download', key)
    return
  }
  if (key === 'migrate') {
    if (migrateUnsupported.value) { stubAction.value = 'migrate'; return }
    emit('migrate')
    return
  }
  if (deleteUnsupported.value) { stubAction.value = 'delete'; return }
  emit('delete')
}

/** Binds the dropdown activators to their buttons, like the reference `content` slot. */
function setActivator(key: ActionKey, element: unknown) {
  const el = (element ?? null) as HTMLElement | null
  if (key === 'more') overflowActivator.value = el
  else if (key === 'download') downloadActivator.value = el
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!menuKind.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('.manga-action-menu')) return
  if (target?.closest('.manga-action')) return
  closeMenu()
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('keydown', onKeyDown)
  updateViewportHeight()
  window.addEventListener('resize', updateViewportHeight)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', updateViewportHeight)
})

/* ------------------------------------------------------------------ *
 * Unsupported actions (web stub)
 * ------------------------------------------------------------------ */
const stubAction = ref<'download' | 'delete' | 'migrate' | null>(null)
const stubOpen = computed({
  get: () => stubAction.value !== null,
  set: value => { if (!value) stubAction.value = null },
})
const stubTitle = computed(() => {
  if (stubAction.value === 'download') return 'Download'
  if (stubAction.value === 'delete') return 'Delete'
  return 'Migrate'
})
const stubText = computed(() => {
  if (stubAction.value === 'download') {
    return 'Downloading chapters is not supported in the web version: the Suwayomi REST API does not expose the downloader, and the web client keeps no local chapter storage.'
  }
  if (stubAction.value === 'delete') {
    return 'Deleting downloaded chapters is not supported in the web version: the web client keeps no local chapter storage, so there is nothing to delete.'
  }
  return 'Migrating a title to another source is not supported in the web version: the Suwayomi REST API exposes no migration endpoint, and the web client does not manage sources or extensions.'
})

/* ------------------------------------------------------------------ *
 * Ripple (Compose `ripple(bounded = false)`)
 * ------------------------------------------------------------------ */
function onPointerDown(event: PointerEvent) {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const radius = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y))
  const ripple = document.createElement('span')
  ripple.className = 'manga-action-ripple'
  ripple.style.left = `${x}px`
  ripple.style.top = `${y}px`
  ripple.style.width = `${radius * 2}px`
  ripple.style.height = `${radius * 2}px`
  target.appendChild(ripple)
  window.setTimeout(() => ripple.remove(), 600)
}

/**
 * Custom Material Symbols 'done_previous' (Apache-2.0, same path as the reference icon
 * `mihon/icons/custom-material-symbols/.../rounded/done_previous.svg`). It is not part of
 * the bundled Material Symbols font, so it is drawn inline.
 */
const DONE_PREVIOUS_PATH = 'M790 -730C779.8 -730 769.5 -726.1 761.7 -718.3L360 -316.6L360 -316.6L198.3 -478.3C190.5 -486.1 180.2 -490 170 -490C159.8 -490 149.5 -486.1 141.7 -478.3C126.1 -462.7 126.1 -437.3 141.7 -421.7L331.7 -231.7C339.5 -223.9 349.8 -220 360 -220C370.2 -220 380.5 -223.9 388.3 -231.7L818.3 -661.7C833.9 -677.3 833.9 -702.7 818.3 -718.3C810.5 -726.1 800.2 -730 790 -730ZM720 -420C697.9 -420 680 -402.1 680 -380L680 -226.6L628.3 -278.3C620.5 -286.1 610.2 -290 600 -290C589.8 -290 579.5 -286.1 571.7 -278.3C556.1 -262.7 556.1 -237.3 571.7 -221.7L691.7 -101.7L691.7 -101.7C691.8 -101.7 691.8 -101.6 691.8 -101.6L691.8 -101.6C695.6 -97.8 700 -95 704.7 -93L704.7 -93C709.4 -91.1 714.6 -90 720 -90C725.4 -90 730.6 -91.1 735.3 -93L735.3 -93C740 -95 744.4 -97.8 748.2 -101.6L748.2 -101.6C748.2 -101.6 748.2 -101.7 748.3 -101.7L748.3 -101.7L868.3 -221.7C883.9 -237.3 883.9 -262.7 868.3 -278.3C860.5 -286.1 850.2 -290 840 -290C829.8 -290 819.5 -286.1 811.7 -278.3L760 -226.6L760 -380C760 -402.1 742.1 -420 720 -420Z'
</script>

<template>
  <div
    class="manga-bottom-action"
    :class="[`manga-bottom-action-${variant}`, { 'is-visible': visible }]"
    :style="{ '--manga-bottom-action-fill': fillFraction }"
    :aria-hidden="visible ? undefined : 'true'"
  >
    <div class="manga-bottom-action-clip">
      <div class="manga-bottom-action-surface" role="toolbar" aria-label="Selection actions">
        <div class="manga-bottom-action-row">
          <div
            v-for="action in actions"
            :key="action.key"
            class="manga-action"
            :class="{ 'is-confirming': isConfirming(action) }"
          >
            <button
              :ref="(el) => setActivator(action.key, el)"
              type="button"
              class="manga-action-inner"
              :aria-label="action.title"
              @click="onClick(action)"
              @pointerdown="onPointerDown($event); onPressStart(action, $event)"
              @pointermove="onPointerMove"
              @pointerup="onPressEnd"
              @pointerleave="onPressEnd"
              @pointercancel="onPressEnd"
              @contextmenu.prevent
            >
              <span class="manga-action-column">
                <span class="manga-action-icon" aria-hidden="true">
                  <svg
                    v-if="action.icon === 'done_previous'"
                    class="manga-action-svg"
                    viewBox="0 -960 960 960"
                    width="24"
                    height="24"
                    focusable="false"
                  ><path :d="DONE_PREVIOUS_PATH" fill="currentColor" /></svg>
                  <v-icon v-else :icon="action.icon" size="24" />
                </span>
                <span class="manga-action-label-wrap" :class="{ 'is-visible': isConfirming(action) }">
                  <span class="manga-action-label">{{ action.title }}</span>
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!--
      `DownloadDropdownMenu` / `DropdownMenu` of the library variant. The reference anchors
      the menu at the start edge of the button and lets the popup move it above the bar.
    -->
    <div
      v-if="menuKind"
      class="manga-action-menu"
      role="menu"
      :style="{ left: `${menuRect.left}px`, bottom: `${menuBottom}px` }"
    >
      <button
        v-for="item in menuItems"
        :key="item.key"
        type="button"
        class="manga-action-menu-item"
        role="menuitem"
        @click="onMenuItem(item.key)"
      >{{ item.label }}</button>
    </div>
  </div>

  <!-- MD3 AlertDialog: the notice for the actions the web client cannot perform. -->
  <v-dialog v-model="stubOpen" max-width="560" :aria-label="stubTitle">
    <div class="manga-action-dialog">
      <p class="manga-action-dialog-text">{{ stubText }}</p>
      <div class="manga-action-dialog-actions">
        <button type="button" class="manga-action-dialog-button" @click="stubOpen = false">OK</button>
      </div>
    </div>
  </v-dialog>
</template>

<style scoped>
@layer app-components {
/* AnimatedVisibility(expandVertically(expandFrom = Bottom) / shrinkVertically(towards Bottom)). */
.manga-bottom-action {
  position: fixed;
  inset-inline-start: var(--v-layout-left, 0px);
  inset-inline-end: var(--v-layout-right, 0px);
  bottom: 0;
  z-index: 1100;
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 250ms cubic-bezier(0.2, 0, 0, 1);
  pointer-events: none;
}
.manga-bottom-action.is-visible {
  grid-template-rows: 1fr;
  pointer-events: auto;
}
/* LibraryBottomActionMenu: `expandVertically(animationSpec = tween(delayMillis = 300))` on
   enter, `shrinkVertically(animationSpec = tween())` on exit (no delay). */
.manga-bottom-action-library {
  transition: grid-template-rows 300ms cubic-bezier(0.2, 0, 0, 1);
}
.manga-bottom-action-library.is-visible {
  transition: grid-template-rows 300ms cubic-bezier(0.2, 0, 0, 1) 300ms;
}
/*
 * The clip is the `AnimatedVisibility` viewport. Its content is bottom aligned, so the
 * bar grows upwards from the screen bottom — `expandVertically(expandFrom = Bottom)` /
 * `shrinkVertically(shrinkTowards = Bottom)`: the bottom edge of the surface stays pinned
 * to the screen bottom while the top edge moves.
 */
.manga-bottom-action-clip {
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
/* Surface: MaterialTheme.shapes.large (16dp) with the bottom corners zeroed, surfaceContainerHigh. */
.manga-bottom-action-surface {
  flex: 0 0 auto;
  width: calc(100% * var(--manga-bottom-action-fill, 1));
  /* MangaScreen.kt (expanded layout): `wrapContentWidth(Alignment.End)`. */
  margin-left: auto;
  background: rgb(var(--v-theme-surface-container-high));
  border-radius: 16px 16px 0 0;
  color: rgb(var(--v-theme-on-surface));
}
/* Row: navigation bar inset + 8dp horizontal / 12dp vertical padding. */
.manga-bottom-action-row {
  display: flex;
  align-items: center;
  padding: 12px 8px calc(12px + env(safe-area-inset-bottom, 0px));
}
/* RowScope.weight: every button gets one share of the row, the confirming one twice. */
.manga-action {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  justify-content: center;
  transition: flex-grow 250ms cubic-bezier(0.2, 0, 0, 1);
}
.manga-action.is-confirming {
  flex-grow: 2;
}
/* Box(Modifier.size(48.dp), contentAlignment = Center): the box is 48dp tall and as wide
   as its weight share; the clickable area covers the whole share. */
.manga-action-inner {
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
.manga-action-inner::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background: currentColor;
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms cubic-bezier(0.2, 0, 0, 1);
}
.manga-action-inner:hover::before {
  opacity: 0.08;
}
.manga-action-inner:focus-visible::before {
  opacity: 0.12;
}
.manga-action-inner:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
  border-radius: 8px;
}
/*
 * Column(verticalArrangement = Center, horizontalAlignment = CenterHorizontally).
 * The Column is centred in the weighted Box, so the label ends up centred in the button
 * and may overflow it (`TextOverflow.Visible`).
 */
.manga-action-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
}
.manga-action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  line-height: 1;
  flex: 0 0 auto;
}
.manga-action-icon :deep(.v-icon) {
  font-size: 24px;
}
.manga-action-svg {
  display: block;
  width: 24px;
  height: 24px;
  fill: currentColor;
}
/* AnimatedVisibility(enter = expandVertically(expandFrom = Top) + fadeIn()).
   The label is measured with the width of the weighted Box, so it is centred in the
   button and may overflow it (`TextOverflow.Visible`). */
.manga-action-label-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 0;
  overflow: visible;
  opacity: 0;
  pointer-events: none;
  transition: height 200ms cubic-bezier(0.2, 0, 0, 1), opacity 150ms ease-out;
}
.manga-action-label-wrap.is-visible {
  height: 16px;
  opacity: 1;
}
.manga-action-label {
  display: inline-block;
  /* MaterialTheme.typography.labelSmall: 11sp / 16sp, Medium, 0.5sp letter spacing. */
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: 0.5px;
  white-space: nowrap;
  /* TextOverflow.Visible: the label may overflow its box. */
  overflow: visible;
  text-align: center;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0;
  flex-shrink: 0;
  transition: opacity 150ms ease-out;
}
.manga-action-label-wrap.is-visible .manga-action-label {
  opacity: 1;
}
/* Compose `ripple(bounded = false)`: an unbounded circle from the touch point. */
.manga-action-ripple {
  position: absolute;
  z-index: 0;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.12;
  pointer-events: none;
  transform: translate(-50%, -50%) scale(0);
  animation: manga-action-ripple 500ms ease-out forwards;
}
@keyframes manga-action-ripple {
  to { transform: translate(-50%, -50%) scale(1); opacity: 0; }
}
/* The icon and the label stay above the ripple layer. */
.manga-action-column {
  position: relative;
  z-index: 1;
}
/*
 * DropdownMenu of the reference: `sizeIn(minWidth = 196.dp, maxWidth = 196.dp)`,
 * MD3 `MenuTokens.ContainerShape` = corner extra small (4dp), `ContainerColor` = surface
 * container, `ContainerElevation` = level 2, `DropdownMenuVerticalPadding` = 8dp,
 * `DropdownMenuItemContentPadding` = horizontal 12dp, `MenuListItemContainerHeight` = 48dp.
 */
.manga-action-menu {
  position: fixed;
  z-index: 1200;
  width: 196px;
  padding: 8px 0;
  border-radius: 4px;
  background: rgb(var(--v-theme-surface-container));
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, .3), 0 1px 3px 1px rgba(0, 0, 0, .15);
}
.manga-action-menu-item {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 48px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: inherit;
  font-family: inherit;
  /* MD3 `bodyLarge`: 16sp / 24sp, weight 400. */
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  text-align: left;
  cursor: pointer;
}
.manga-action-menu-item:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
/* Surface: DialogTokens.ContainerColor = SurfaceContainerHigh, ContainerShape = CornerExtraLarge (28dp),
   ContainerElevation = Level3, container padding 24dp. */
.manga-action-dialog {
  box-sizing: border-box;
  align-self: center;
  width: fit-content;
  min-width: 280px;
  max-width: 560px;
  max-height: calc(100dvh - 48px);
  overflow-y: auto;
  padding: 24px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, .3), 0 4px 8px 3px rgba(0, 0, 0, .15);
}
/* DialogTokens.SupportingTextFont = BodyMedium (14/20, w400); AlertDialogDefaults.textPadding = 24dp bottom. */
.manga-action-dialog-text {
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface-variant));
}
.manga-action-dialog-actions {
  display: flex;
  flex-direction: row-reverse;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 8px;
}
/* MD3 text button: 40dp height, 12dp side padding, pill shape, LabelLarge (14/20, w500), primary label. */
.manga-action-dialog-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
  cursor: pointer;
  transition: border-radius 0.1s ease-in-out;
}
.manga-action-dialog-button:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
.manga-action-dialog-button:active { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 10%, transparent); border-radius: 4px; }
.manga-action-dialog-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
}
/*
 * LibraryTab.kt: `HomeScreen.showBottomNav(!state.selectionMode)` hides the app navigation
 * bar while the library selection bar is visible.
 */
:global(body.manga-bottom-action-library-active .mihon-navigation) {
  display: none;
}
</style>
