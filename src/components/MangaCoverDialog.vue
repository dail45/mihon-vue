<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * Mihon reference: eu/kanade/presentation/manga/components/MangaCoverDialog.kt
 * (pinned revision 446f6df82c390ab760802c2fce3b677bce3f31c1)
 *
 *   Dialog(usePlatformDefaultWidth = false, decorFitsSystemWindows = false) {
 *     Scaffold(containerColor = Color.Transparent, snackbarHost = { SnackbarHost(...) }, bottomBar = { ... }) {
 *       Box(fillMaxSize().clickableNoIndication(onDismissRequest)) { ReaderPageImageView }
 *     }
 *   }
 *
 * Reference facts that drive this implementation:
 *  - In Android Compose, Dialog displays over a dimmed backdrop (default dimAmount 0.6f).
 *    The Scaffold containerColor is Color.Transparent, so the underlying screen is visible
 *    under the dimming scrim, around the cover bitmap.
 *  - The whole content area is a dismiss target (clickableNoIndication, no ripple) and single
 *    click on the image dismisses the dialog as well (onViewClicked = onDismissRequest).
 *  - ReaderPageImageView supports zoom with zoomDuration = 500ms; double-clicking toggles
 *    zoom between 1x and 2.5x, and dragging allows panning when zoomed in.
 *  - bottomBar = Row(fillMaxWidth().padding(4.dp).navigationBarsPadding()) with two
 *    "ActionsPill" groups separated by a weighted Spacer:
 *      * left pill:  one Close IconButton (MaterialSymbols.Rounded.Close).
 *      * right pill: Share and Save IconButtons (AppBarActions -> each wrapped in a
 *        PlainTooltip anchored Above), then the Edit IconButton.
 *  - ActionsPill = Row(clip(MaterialTheme.shapes.extraLarge (28dp)),
 *    background(colorScheme.background.copy(alpha = 0.95f))).
 *  - The icon is 24dp inside a 48dp touch target with M3 hover/active state layers.
 *  - The Edit button logic:
 *      !favorite && !isLocal -> onEditClick(EditCoverAction.ADD_TO_LIBRARY)
 *      isCustomCover         -> open DropdownMenu ("Edit" / "Delete")
 *      else                  -> onEditClick(EditCoverAction.EDIT)
 *  - ADD_TO_LIBRARY shows the warning snackbar:
 *    "Please add the entry to your library before doing this"
 *  - DropdownMenu (eu.kanade.presentation.components.DropdownMenu): fixed width 196dp,
 *    offset DpOffset(8.dp, 0.dp), shape CornerExtraSmall (4dp), surfaceContainer,
 *    anchored above the bottom bar, items 48dp bodyLarge with hover/active state layers.
 *  - Clicking outside the DropdownMenu closes the menu without closing the dialog.
 *  - Escape key closes the DropdownMenu first if open, or closes the dialog.
 *  - Snackbars (SnackbarHost in the dialog Scaffold, above the bottom bar) use inverseSurface
 *    / inverseOnSurface, 4dp shape, bodyMedium text and a "Dismiss" action (inversePrimary)
 *    because every snackbar is shown with `withDismissAction = true`.
 *
 * Web notes:
 *  - Suwayomi REST v1 exposes no endpoint to upload or delete a custom cover.
 *    The Edit / Delete entries are accurate stubs: they open/execute and report that the
 *    action is unsupported in the web version.
 *  - Share uses the Web Share API (with save fallback) and Save downloads the image blob.
 */
const open = defineModel<boolean>({ required: true })

const props = withDefaults(defineProps<{
  /** Cover image URL (server thumbnail endpoint). */
  src: string
  /** Title of the manga, used for the shared/saved file name. */
  title: string
  /** Whether the manga is already in the library (drives the Edit button behaviour). */
  inLibrary: boolean
  /** Whether the manga belongs to a local source (never true for remote sources). */
  isLocal?: boolean
  /** Whether the manga currently uses a custom cover. */
  isCustomCover?: boolean
}>(), {
  isLocal: false,
  isCustomCover: false,
})

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'addToLibrary'): void
}>()

const menuOpen = ref(false)
const snackbar = ref('')
const snackbarOpen = ref(false)
const imageFailed = ref(false)
let snackbarTimer: number | undefined

// Zoom state (ReaderPageImageView parity: zoomDuration = 500)
const isZoomed = ref(false)
const zoomScale = ref(1)
const zoomTranslateX = ref(0)
const zoomTranslateY = ref(0)
let singleClickTimer: number | undefined
let isDragging = false
let startX = 0
let startY = 0
let currentTranslateX = 0
let currentTranslateY = 0
let hasMoved = false

const fileName = computed(() => `${props.title.replace(/[\\/:*?"<>|]/g, '_') || 'cover'}.jpg`)

function dismiss() {
  if (menuOpen.value) {
    menuOpen.value = false
    return
  }
  open.value = false
}

function showSnackbar(message: string) {
  snackbar.value = message
  snackbarOpen.value = true
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
  snackbarTimer = window.setTimeout(() => { snackbarOpen.value = false }, 4000)
}

function resetZoom() {
  isZoomed.value = false
  zoomScale.value = 1
  zoomTranslateX.value = 0
  zoomTranslateY.value = 0
}

function handleImageClick() {
  if (hasMoved) {
    hasMoved = false
    return
  }
  if (isZoomed.value) {
    resetZoom()
    return
  }
  if (singleClickTimer) {
    window.clearTimeout(singleClickTimer)
    singleClickTimer = undefined
    toggleZoom()
    return
  }
  singleClickTimer = window.setTimeout(() => {
    singleClickTimer = undefined
    dismiss()
  }, 250)
}

function toggleZoom() {
  if (singleClickTimer) {
    window.clearTimeout(singleClickTimer)
    singleClickTimer = undefined
  }
  if (isZoomed.value) {
    resetZoom()
  } else {
    isZoomed.value = true
    zoomScale.value = 2.5
    zoomTranslateX.value = 0
    zoomTranslateY.value = 0
  }
}

function handleImagePointerDown(e: PointerEvent) {
  if (!isZoomed.value) return
  isDragging = true
  hasMoved = false
  startX = e.clientX
  startY = e.clientY
  currentTranslateX = zoomTranslateX.value
  currentTranslateY = zoomTranslateY.value
  ;(e.target as HTMLElement)?.setPointerCapture?.(e.pointerId)
}

function handleImagePointerMove(e: PointerEvent) {
  if (!isDragging) return
  const dx = e.clientX - startX
  const dy = e.clientY - startY
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
    hasMoved = true
  }
  zoomTranslateX.value = currentTranslateX + dx
  zoomTranslateY.value = currentTranslateY + dy
}

function handleImagePointerUp(e: PointerEvent) {
  if (!isDragging) return
  isDragging = false
  ;(e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId)
}

/** Mihon: shareCover(context) - Android shares the saved cover file. */
async function shareCover() {
  try {
    const response = await fetch(props.src)
    if (!response.ok) throw new Error(String(response.status))
    const blob = await response.blob()
    const file = new File([blob], fileName.value, { type: blob.type || 'image/jpeg' })
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: props.title })
    } else if (nav.share) {
      await nav.share({ title: props.title, url: props.src })
    } else {
      saveCover()
      return
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return
    // Mihon: MR.strings.error_sharing_cover
    showSnackbar('Error sharing cover')
  }
}

/** Mihon: saveCover(context) - writes the cover to the device. */
async function saveCover() {
  try {
    const response = await fetch(props.src)
    if (!response.ok) throw new Error(String(response.status))
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName.value
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    // Mihon: MR.strings.cover_saved
    showSnackbar('Cover saved')
  } catch {
    // Mihon: MR.strings.error_saving_cover
    showSnackbar('Error saving cover')
  }
}

/**
 * Mihon Edit button:
 *   when {
 *     !manga.favorite && !manga.isLocal() -> onEditClick(EditCoverAction.ADD_TO_LIBRARY)
 *     isCustomCover                       -> expanded = true
 *     else                                -> onEditClick(EditCoverAction.EDIT)
 *   }
 */
function onEditClick() {
  if (!props.inLibrary && !props.isLocal) {
    // Mihon: MR.strings.notification_first_add_to_library
    showSnackbar('Please add the entry to your library before doing this')
    emit('addToLibrary')
    return
  }
  if (props.isCustomCover) {
    menuOpen.value = true
  } else {
    editCover()
  }
}

function editCover() {
  menuOpen.value = false
  emit('edit')
  // Suwayomi REST v1 has no custom cover upload endpoint
  showSnackbar('Editing the cover is not supported in the web version.')
}

function deleteCover() {
  menuOpen.value = false
  emit('delete')
  // Suwayomi REST v1 has no custom cover delete endpoint
  showSnackbar('Deleting a custom cover is not supported in the web version.')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !open.value) return
  event.stopPropagation()
  // A Compose popup consumes the back press first, so the menu closes before the dialog.
  if (menuOpen.value) {
    menuOpen.value = false
    return
  }
  dismiss()
}

watch(open, value => {
  if (value) {
    imageFailed.value = false
    menuOpen.value = false
    resetZoom()
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
  if (singleClickTimer) window.clearTimeout(singleClickTimer)
  document.body.style.overflow = ''
})
</script>

<template>
  <Transition name="cover-dialog-fade">
    <div
      v-if="open"
      class="cover-dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="`${title} cover`"
      @click="dismiss"
    >
      <!-- Backdrop click interceptor for DropdownMenu: clicking outside menu closes menu without closing dialog -->
      <div
        v-if="menuOpen"
        class="cover-menu-scrim"
        aria-hidden="true"
        @click.stop="menuOpen = false"
      />

      <!-- Image Surface: centered, safe-area padded -->
      <div class="cover-dialog-surface">
        <img
          v-if="!imageFailed"
          class="cover-dialog-image"
          :class="{ 'is-zoomed': isZoomed }"
          :src="src"
          :alt="`${title} cover`"
          :style="{
            transform: `translate(${zoomTranslateX}px, ${zoomTranslateY}px) scale(${zoomScale})`,
          }"
          @click.stop="handleImageClick"
          @dblclick.stop="toggleZoom"
          @pointerdown="handleImagePointerDown"
          @pointermove="handleImagePointerMove"
          @pointerup="handleImagePointerUp"
          @pointercancel="handleImagePointerUp"
          @error="imageFailed = true"
        />
        <div v-else class="cover-dialog-error" @click.stop>
          <span class="material-symbols-rounded" aria-hidden="true">image_not_supported</span>
          <p>Cover image is unavailable.</p>
        </div>
      </div>

      <!-- Bottom Bar: Row(fillMaxWidth, padding 4dp, navigationBarsPadding) -->
      <div class="cover-dialog-bottom" @click.stop>
        <!-- Left ActionsPill: Close button -->
        <div class="cover-pill">
          <button
            type="button"
            class="cover-icon-button"
            aria-label="Close"
            @click="dismiss"
          >
            <span class="material-symbols-rounded" aria-hidden="true">close</span>
          </button>
        </div>

        <!-- Right ActionsPill: Share, Save, Edit -->
        <div class="cover-pill cover-pill-actions">
          <!-- Share button with PlainTooltip -->
          <span class="cover-tooltip-anchor">
            <button
              type="button"
              class="cover-icon-button"
              aria-label="Share"
              @click="shareCover"
            >
              <span class="material-symbols-rounded" aria-hidden="true">share</span>
            </button>
            <span class="cover-tooltip" role="tooltip">Share</span>
          </span>

          <!-- Save button with PlainTooltip -->
          <span class="cover-tooltip-anchor">
            <button
              type="button"
              class="cover-icon-button"
              aria-label="Save"
              @click="saveCover"
            >
              <span class="material-symbols-rounded" aria-hidden="true">save</span>
            </button>
            <span class="cover-tooltip" role="tooltip">Save</span>
          </span>

          <!-- Edit button and DropdownMenu -->
          <div class="cover-menu-anchor">
            <button
              type="button"
              class="cover-icon-button"
              aria-label="Edit cover"
              @click="onEditClick"
            >
              <span class="material-symbols-rounded" aria-hidden="true">edit</span>
            </button>

            <!-- DropdownMenu: 196dp width, anchored above the pill -->
            <div
              v-if="menuOpen"
              class="cover-menu"
              role="menu"
              aria-label="Edit cover options"
              @click.stop
            >
              <button
                type="button"
                class="cover-menu-item"
                role="menuitem"
                @click="editCover"
              >
                Edit
              </button>
              <button
                type="button"
                class="cover-menu-item"
                role="menuitem"
                @click="deleteCover"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- SnackbarHost: above bottomBar, centered -->
      <div
        v-if="snackbarOpen"
        class="cover-snackbar"
        role="status"
        aria-live="polite"
        @click.stop
      >
        <span class="cover-snackbar-text">{{ snackbar }}</span>
        <button
          type="button"
          class="cover-snackbar-action"
          @click="snackbarOpen = false"
        >
          Dismiss
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
@layer app-components {
/* Dialog fade animation */
.cover-dialog-fade-enter-active,
.cover-dialog-fade-leave-active {
  transition: opacity 200ms ease;
}
.cover-dialog-fade-enter-from,
.cover-dialog-fade-leave-to {
  opacity: 0;
}

/* Dialog window: usePlatformDefaultWidth = false, decorFitsSystemWindows = false.
   The Compose Dialog window applies Android's standard 0.6 dim amount over the screen. */
.cover-dialog {
  position: fixed;
  inset: 0;
  z-index: 2400;
  background: rgba(0, 0, 0, 0.6);
  user-select: none;
}

/* DropdownMenu scrim: clicking outside the menu closes the menu without closing the dialog. */
.cover-menu-scrim {
  position: fixed;
  inset: 0;
  z-index: 25;
  background: transparent;
}

/* The reference AndroidView is padded with the status bar and the bottom bar insets
   (view.updatePadding(top = statusBarPaddingPx, bottom = bottomPaddingPx)), so the
   cover is centred inside that area and never runs under the system bars. */
.cover-dialog-surface {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: env(safe-area-inset-top);
  padding-bottom: calc(56px + env(safe-area-inset-bottom));
  box-sizing: border-box;
  overflow: hidden;
}

/* ReaderPageImageView: centered, fully visible (object-fit: contain), zoom transition 500ms. */
.cover-dialog-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  cursor: zoom-in;
  transition: transform 500ms cubic-bezier(0.2, 0, 0, 1);
  transform-origin: center center;
  touch-action: none;
}
.cover-dialog-image.is-zoomed {
  cursor: grab;
}
.cover-dialog-image.is-zoomed:active {
  cursor: grabbing;
}

.cover-dialog-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: rgb(var(--v-theme-on-surface));
  font-size: 14px;
  line-height: 20px;
}
.cover-dialog-error .material-symbols-rounded {
  font-size: 48px;
}

/* bottomBar: Row(fillMaxWidth, padding 4dp, navigationBarsPadding). */
.cover-dialog-bottom {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  padding: 4px;
  padding-bottom: calc(4px + env(safe-area-inset-bottom));
  box-sizing: border-box;
  pointer-events: none;
  z-index: 20;
}

/* ActionsPill: Row(clip(shapes.extraLarge = 28dp), background(colorScheme.background, alpha 0.95)). */
.cover-pill {
  display: flex;
  align-items: center;
  border-radius: 28px;
  background: rgb(var(--v-theme-background) / 0.95);
  pointer-events: auto;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
.cover-pill-actions {
  position: relative;
  margin-left: auto;
}

/* IconButton: 48dp touch target, 24dp icon. The Scaffold container color is Transparent, so
   contentColorFor() yields Unspecified and the icons keep the theme content color (onSurface).
   M3 state layers: hover 8%, active 12%. */
.cover-icon-button {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  border-radius: 50%;
  transition: background-color 150ms ease;
}
.cover-icon-button .material-symbols-rounded {
  font-size: 24px;
  line-height: 1;
}
.cover-icon-button:hover {
  background: rgb(var(--v-theme-on-surface) / 0.08);
}
.cover-icon-button:active {
  background: rgb(var(--v-theme-on-surface) / 0.12);
}
.cover-icon-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* DropdownMenu anchored on the Edit button: Mihon DropdownMenu uses a fixed 196dp width
   (sizeIn(minWidth = 196.dp, maxWidth = 196.dp)). Anchored above the pill to avoid bottom overflow. */
.cover-menu-anchor {
  position: relative;
  display: flex;
}
.cover-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  width: 196px;
  max-width: calc(100vw - 16px);
  padding: 8px 0;
  border-radius: 4px;
  background: rgb(var(--v-theme-surface-container));
  box-shadow: 0 3px 6px rgba(0, 0, 0, .28), 0 1px 2px rgba(0, 0, 0, .2);
  z-index: 30;
}

/* PlainTooltip (AppBarActions -> TooltipBox anchored Above): inverseSurface container,
   inverseOnSurface label, 4dp shape, labelSmall 12sp, padding 4dp/8dp. */
.cover-tooltip-anchor {
  position: relative;
  display: inline-flex;
}
.cover-tooltip {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-family: Roboto, sans-serif;
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity .1s linear;
}
.cover-tooltip-anchor:hover .cover-tooltip,
.cover-tooltip-anchor:focus-within .cover-tooltip {
  opacity: 1;
  visibility: visible;
}

/* DropdownMenuItem: height 48dp, horizontal padding 12dp, bodyLarge 16sp/24sp, onSurface. */
.cover-menu-item {
  display: block;
  width: 100%;
  height: 48px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  text-align: left;
  color: rgb(var(--v-theme-on-surface));
  font-family: Roboto, sans-serif;
  font-size: 16px;
  line-height: 24px;
  cursor: pointer;
  transition: background-color 150ms ease;
}
.cover-menu-item:hover {
  background: rgb(var(--v-theme-on-surface) / 0.08);
}
.cover-menu-item:active {
  background: rgb(var(--v-theme-on-surface) / 0.12);
}

/* SnackbarHost: inverseSurface, 4dp shape, bodyMedium, 288dp minimum width, Dismiss action. */
.cover-snackbar {
  position: absolute;
  left: 50%;
  bottom: calc(60px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  min-width: 288px;
  max-width: min(560px, calc(100vw - 32px));
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  box-shadow: 0 3px 6px rgba(0, 0, 0, .28), 0 1px 2px rgba(0, 0, 0, .2);
  z-index: 40;
}
.cover-snackbar-text {
  flex: 1 1 auto;
}
.cover-snackbar-action {
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  padding: 0;
  color: rgb(var(--v-theme-inverse-primary));
  font-family: Roboto, sans-serif;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .1px;
  cursor: pointer;
}
.cover-snackbar-action:hover {
  text-decoration: underline;
}
}
</style>
