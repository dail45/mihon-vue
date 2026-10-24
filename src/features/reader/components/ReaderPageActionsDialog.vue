<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useTabletUi } from '@/core/composables/useTabletUi'
import { useReaderStore } from '@/features/reader/stores/reader'
import SetCoverDialog from './SetCoverDialog.vue'

/**
 * Mihon reference: eu/kanade/presentation/reader/ReaderPageActionsDialog.kt
 *
 *   AdaptiveSheet(onDismissRequest = onDismissRequest) {
 *     Row(modifier = Modifier.padding(vertical = 16.dp),
 *         horizontalArrangement = Arrangement.spacedBy(MaterialTheme.padding.small)) {
 *       ActionButton(Modifier.weight(1f), stringResource(MR.strings.set_as_cover), MaterialSymbols.Rounded.Photo) { showSetCoverDialog = true }
 *       ActionButton(Modifier.weight(1f), stringResource(MR.strings.action_copy_to_clipboard), MaterialSymbols.Rounded.ContentCopy) { onShare(true); onDismissRequest() }
 *       ActionButton(Modifier.weight(1f), stringResource(MR.strings.action_share), MaterialSymbols.Rounded.Share) { onShare(false); onDismissRequest() }
 *       ActionButton(Modifier.weight(1f), stringResource(MR.strings.action_save), MaterialSymbols.Rounded.Save) { onSave(); onDismissRequest() }
 *     }
 *   }
 *   if (showSetCoverDialog) {
 *     SetCoverDialog(onConfirm = { onSetAsCover(); showSetCoverDialog = false }, onDismiss = { showSetCoverDialog = false })
 *   }
 *
 * ActionButton (presentation-core/components/ActionButton.kt) is a TextButton holding a
 * Column(verticalArrangement = spacedBy(MaterialTheme.padding.extraSmall) = 4dp,
 * horizontalAlignment = CenterHorizontally) { Icon(24dp, contentDescription = null);
 * Text(textAlign = TextAlign.Center) }. The buttons carry Modifier.weight(1f), so all four
 * share the row width equally and their labels wrap inside their own column.
 *
 * AdaptiveSheet (presentation-core/components/AdaptiveSheet.kt) is a Compose Dialog window
 * whose content is a Surface with color surfaceContainerHigh and shape extraLarge (28dp),
 * widthIn(max = 460dp):
 *  - tablet UI: Surface centered, systemBarsPadding, padding(vertical = 16dp) OUTSIDE the
 *    surface, so the colored area covers exactly the action row; the content Box fades in
 *    with a 350ms tween;
 *  - phone UI: Surface anchored to the bottom (navigationBarsPadding on the surface, so the
 *    navigation bar strip below it stays transparent), draggable to dismiss with a 56dp
 *    positional threshold and a 350ms tween.
 * The four action buttons call onDismissRequest() directly, so the sheet is removed right away.
 * The tablet outside click fades the content out before the dismissal, and the phone outside
 * click only re-shows an already hidden sheet, so there it has no effect.
 *
 * Web notes:
 *  - "Set as cover" cannot work against Suwayomi REST v1 (there is no cover upload endpoint,
 *    the thumbnail always comes from the source). The reference confirmation dialog is
 *    rendered as-is and reports the limitation through a toast, see SetCoverDialog.vue.
 *  - Copy / Share / Save act on the page image itself, matching the reference behaviour
 *    (image to the clipboard, image to the system share sheet, image to disk).
 */
const props = defineProps<{
  onSetAsCover?: () => void
  onShare?: (toClipboard: boolean) => void
  onSave?: () => void
}>()

const emit = defineEmits<{
  (e: 'set-as-cover'): void
  (e: 'share', toClipboard: boolean): void
  (e: 'save'): void
}>()

const open = defineModel<boolean>({ required: true })
const reader = useReaderStore()
const tablet = useTabletUi()

const setCoverOpen = ref(false)
/** Dismissal animation state: AdaptiveSheet animates out for 350ms before it is removed. */
const closing = ref(false)
const toast = ref(''), toastOpen = ref(false)
const sheet = ref<HTMLElement | null>(null)
const dragStart = ref<number | null>(null), dragOffset = ref(0), dragging = ref(false)
let toastTimer: number | undefined, imageRequest = 0
const pageImage = ref<Blob | null>(null)

/** MR.strings.share_page_info = "%1$s: %2$s, page %3$d" (Mihon uses the 1-based page number). */
const pageNumber = computed(() => reader.pageIndex + 1)
const shareText = computed(() => `${reader.manga?.title ?? ''}: ${reader.chapter?.name ?? ''}, page ${pageNumber.value}`)
/** ReaderViewModel.generateFilename(): "${manga.title} - ${chapter.name} - ${page.number}". */
const fileName = computed(() => {
  const title = reader.manga?.title ?? 'Page'
  const chapter = reader.chapter?.name ?? ''
  const base = chapter ? `${title} - ${chapter}` : title
  return `${base} - ${pageNumber.value}`.replace(/[\\/:*?"<>|]/g, '_')
})

/** MR.strings.set_as_cover, action_copy_to_clipboard, action_share, action_save. */
const actions = [
  { key: 'cover', label: 'Set as cover', icon: 'photo' },
  { key: 'copy', label: 'Copy to clipboard', icon: 'content_copy' },
  { key: 'share', label: 'Share', icon: 'share' },
  { key: 'save', label: 'Save', icon: 'save' },
] as const

function showToast(message: string) {
  toast.value = message
  toastOpen.value = true
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toastOpen.value = false }, 4000)
}

/**
 * Dismissal of the sheet.
 *
 * The reference closes the sheet in two different ways:
 *  - the action buttons call `onDismissRequest()` directly, so the Compose Dialog is removed
 *    right away, without any exit animation;
 *  - the phone gesture settles the sheet back to its hidden anchor before the dismissal
 *    follows.
 *
 * The tablet fade-out is not observable in the reference either: `internalOnDismissRequest`
 * sets `targetAlpha = 0f` and calls `onDismissRequest()` in the same coroutine, so the Compose
 * Dialog is removed before the 350ms tween can play. The tablet dismissal is therefore
 * immediate here as well.
 */
function dismissNow() {
  closing.value = false
  open.value = false
}

/**
 * Phone dismissal: the sheet settles back to its hidden anchor (translateY 100%) with the
 * 350ms tween, and the dismissal follows once it settled (the reference collects the settled
 * anchor value in a snapshotFlow and only then calls `onDismissRequest()`).
 */
function dismissAnimated() {
  if (closing.value) return
  closing.value = true
  window.setTimeout(() => { closing.value = false; open.value = false }, 350)
}

/**
 * Outside tap.
 * The reference wraps the whole screen in a clickable Box:
 *  - tablet: `internalOnDismissRequest` sets `targetAlpha = 0f` and calls `onDismissRequest()`;
 *  - phone: `internalOnDismissRequest` animates the sheet to anchor 1 (hidden) when
 *    `settledValue == 0` (shown) and then calls `onDismissRequest()`.
 */
function onScrimClick() {
  if (tablet.value) {
    dismissNow()
  } else {
    dismissAnimated()
  }
}

function handleSetAsCoverConfirm() {
  props.onSetAsCover?.()
  emit('set-as-cover')
}

async function fetchPageImage(): Promise<Blob> {
  const url = reader.pageUrl(reader.pageIndex)
  if (!url) throw new Error('The page is not loaded yet.')
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) throw new Error(`The page image could not be loaded (HTTP ${response.status}).`)
  const blob = await response.blob()
  if (!blob.type.startsWith('image/')) throw new Error('The page response was not an image.')
  return blob
}

async function prefetchPageImage() {
  const request = ++imageRequest
  try {
    const blob = await fetchPageImage()
    if (request !== imageRequest) return
    pageImage.value = blob
  } catch { pageImage.value = null }
}

async function pageBlob(): Promise<Blob> {
  return pageImage.value ?? await fetchPageImage()
}

/** The clipboard only accepts PNG, so other formats are converted through a canvas. */
async function toPng(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot convert the page image.')
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  const png = await new Promise<Blob | null>(resolve => canvas.toBlob(result => resolve(result), 'image/png'))
  if (!png) throw new Error('This browser cannot convert the page image.')
  return png
}

async function copyToClipboard() {
  dismissNow()
  try {
    if (!navigator.clipboard || typeof navigator.clipboard.write !== 'function') throw new Error('Clipboard images are not supported.')
    const png = await toPng(await pageBlob())
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
  } catch {
    showToast('Copying the page image is not supported in this browser.')
  }
}

async function sharePage() {
  dismissNow()
  try {
    const share = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
    if (typeof share.share !== 'function') throw new Error('Sharing is not supported.')
    const blob = await pageBlob()
    const file = new File([blob], fileName.value, { type: blob.type || 'image/png' })
    if (typeof share.canShare === 'function' && !share.canShare({ files: [file] })) throw new Error('Files cannot be shared.')
    await share.share({ files: [file], text: shareText.value, title: reader.manga?.title })
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') return
    showToast('Sharing the page image is not supported in this browser.')
  }
}

async function savePage() {
  dismissNow()
  try {
    const blob = await pageBlob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName.value
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    showToast('Picture saved')
  } catch {
    showToast('The page image could not be saved.')
  }
}

function runAction(key: string) {
  if (key === 'cover') {
    setCoverOpen.value = true
    return
  }
  if (key === 'copy') {
    props.onShare?.(true)
    emit('share', true)
    void copyToClipboard()
    return
  }
  if (key === 'share') {
    props.onShare?.(false)
    emit('share', false)
    void sharePage()
    return
  }
  if (key === 'save') {
    props.onSave?.()
    emit('save')
    void savePage()
  }
}

/** BackHandler of the reference: dismisses the sheet, but never the nested cover dialog. */
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !open.value || setCoverOpen.value) return
  // Keep the key event inside the dialog, the reader page handles Escape on its own.
  event.stopPropagation()
  // Tablet: the reference BackHandler fades the content out before it dismisses.
  // Phone: the reference BackHandler animates the sheet to its hidden anchor and dismisses it
  // once it settled.
  dismissAnimated()
}

/** Drag to dismiss (phone): 56dp threshold, matching AdaptiveSheet's anchoredDraggable. */
function onTouchStart(event: TouchEvent) {
  if (tablet.value) return
  dragStart.value = event.touches[0]?.clientY ?? null
  dragOffset.value = 0
  dragging.value = true
}
function onTouchMove(event: TouchEvent) {
  if (tablet.value || dragStart.value === null) return
  const delta = (event.touches[0]?.clientY ?? dragStart.value) - dragStart.value
  if (delta <= 0) { dragOffset.value = 0; return }
  dragOffset.value = delta
}
function onTouchEnd() {
  if (tablet.value || dragStart.value === null) return
  dragStart.value = null
  dragging.value = false
  // Positional threshold of the reference fling behaviour: 56dp. Above it the sheet settles
  // back to its hidden anchor and the dismissal follows.
  if (dragOffset.value > 56) { dragOffset.value = 0; dismissAnimated(); return }
  // Below the threshold the sheet settles back to its shown anchor.
  dragOffset.value = 0
}

watch(open, value => {
  if (value) {
    closing.value = false
    dragOffset.value = 0
    void prefetchPageImage()
    void nextTick(() => sheet.value?.focus())
  } else {
    setCoverOpen.value = false
  }
})

onBeforeUnmount(() => { if (toastTimer) window.clearTimeout(toastTimer) })
</script>

<template>
  <div
    v-if="open"
    class="reader-page-actions"
    :class="{ 'reader-page-actions--closing': closing }"
    role="presentation"
    @keydown="onKeydown"
  >
    <div class="reader-page-actions-scrim" @click="onScrimClick" />
    <div
      ref="sheet"
      tabindex="-1"
      class="reader-page-actions-sheet"
      :class="{ 'reader-page-actions-sheet--tablet': tablet, 'reader-page-actions-sheet--phone': !tablet }"
      role="dialog"
      aria-modal="true"
      aria-label="Page actions"
      @click.stop
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <div
        class="reader-page-actions-surface"
        :class="{ 'reader-page-actions-surface--dragging': dragging }"
        :style="dragOffset ? { transform: `translateY(${dragOffset}px)` } : undefined"
      >
        <div class="reader-page-actions-row">
          <button
            v-for="action in actions"
            :key="action.key"
            v-ripple
            type="button"
            class="reader-page-action"
            :title="action.label"
            :aria-label="action.label"
            @click="runAction(action.key)"
          >
            <span class="reader-page-action-icon material-symbols-rounded" aria-hidden="true">{{ action.icon }}</span>
            <span class="reader-page-action-label">{{ action.label }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
  <SetCoverDialog v-model="setCoverOpen" @confirm="handleSetAsCoverConfirm" />
  <div v-if="toastOpen" class="reader-page-actions-snackbar" role="status" aria-live="polite">{{ toast }}</div>
</template>

<style scoped>
@layer app-components {
/* AdaptiveSheet: Compose Dialog window, dimAmount 0.32, content Surface with
   color surfaceContainerHigh, shape extraLarge (28dp), widthIn(max = 460dp). */
.reader-page-actions { position: fixed; inset: 0; z-index: 1900; }
/* Compose Dialog window dim: dimAmount 0.32, shown without an animation. */
.reader-page-actions-scrim { position: absolute; inset: 0; background: #000; opacity: .32; }
/* Positioning wrapper. The Compose Surface (color, shape, shadow) is the inner element, because
   AdaptiveSheet applies systemBarsPadding and padding(vertical = 16dp) around the Surface. */
.reader-page-actions-sheet {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  outline: none;
}
/* Compose Surface: color surfaceContainerHigh, shape extraLarge (28dp), tonalElevation 0 and
   shadowElevation 0, so the surface itself carries no drop shadow. The reference sizes the
   Surface with widthIn(max = 460.dp); the four weighted buttons fill that width. */
.reader-page-actions-surface {
  width: 100%;
  max-width: 460px;
  box-sizing: border-box;
  background: rgb(var(--v-theme-surface-container-high));
  border-radius: 28px;
  overflow: hidden;
  box-shadow: none;
  transition: transform 350ms cubic-bezier(0.4, 0, 0.2, 1), opacity 350ms cubic-bezier(0.4, 0, 0.2, 1);
}
/* While the sheet is dragged the reference follows the finger without a settle animation. */
.reader-page-actions-surface--dragging { transition: none; }
/* Tablet dismissal: the reference fades the whole content Box out with the 350ms tween. */
.reader-page-actions--closing .reader-page-actions-sheet--tablet .reader-page-actions-surface {
  opacity: 0;
}
/* Phone dismissal: the reference settles the sheet back to its hidden anchor. */
.reader-page-actions--closing .reader-page-actions-sheet--phone .reader-page-actions-surface {
  transform: translateY(100%);
}
/* Tablet UI: centered Surface, systemBarsPadding, padding(vertical = 16.dp) outside the
   surface, so the colored surface covers exactly the action row. The content Box fades in
   with the 350ms tween (FastOutSlowIn easing). */
.reader-page-actions-sheet--tablet {
  top: 0;
  bottom: 0;
  align-items: center;
  animation: reader-page-actions-fade 350ms cubic-bezier(0.4, 0, 0.2, 1);
}
.reader-page-actions-sheet--tablet .reader-page-actions-surface { margin: 16px 0; }
/* Phone UI: bottom anchored Surface. The reference applies navigationBarsPadding to the Surface
   modifier, so the padding is OUTSIDE the drawn shape: the colored surface stops above the
   navigation bar and the strip below it stays transparent. */
.reader-page-actions-sheet--phone {
  bottom: 0;
  align-items: flex-end;
}
.reader-page-actions-sheet--phone .reader-page-actions-surface {
  margin-bottom: env(safe-area-inset-bottom);
  animation: reader-page-actions-rise 350ms cubic-bezier(0.4, 0, 0.2, 1);
}
/* Row(modifier = Modifier.padding(vertical = 16.dp),
   horizontalArrangement = Arrangement.spacedBy(MaterialTheme.padding.small) = 8dp. */
.reader-page-actions-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 16px 0;
}
/* ActionButton: TextButton { Column(spacedBy = 4dp, CenterHorizontally) { Icon; Text } }.
   Modifier.weight(1f) distributes all 4 buttons equally.
   MD3 TextButton: shape Full (20dp), minHeight 40dp, contentPadding 8dp vertical,
   labelMedium (12sp / 16sp / Medium / 0.5sp), primary. */
.reader-page-action {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  min-height: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 6px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-family: Roboto, sans-serif;
  cursor: pointer;
  overflow: hidden;
  text-decoration: none;
  user-select: none;
  -webkit-user-select: none;
  transition: background-color 150ms cubic-bezier(0.4, 0, 0.2, 1);
}
.reader-page-action:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
.reader-page-action:active { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 12%, transparent); }
.reader-page-action:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.reader-page-action-icon {
  font-size: 24px;
  line-height: 1;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.reader-page-action-label {
  display: block;
  width: 100%;
  max-width: 100%;
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* MD3 snackbar (Mihon toast): inverseSurface, 4dp shape, bodyMedium. */
.reader-page-actions-snackbar {
  position: fixed;
  left: 50%;
  bottom: calc(24px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 2100;
  min-width: 288px;
  max-width: min(560px, calc(100vw - 32px));
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  box-shadow: 0 3px 6px rgba(0, 0, 0, .28), 0 1px 2px rgba(0, 0, 0, .2);
}
@keyframes reader-page-actions-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes reader-page-actions-rise { from { transform: translateY(100%); } to { transform: translateY(0); } }
}
</style>
