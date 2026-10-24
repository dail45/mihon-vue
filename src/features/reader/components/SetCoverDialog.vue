<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

/**
 * Mihon reference: eu/kanade/presentation/reader/ReaderPageActionsDialog.kt
 *
 *   private fun SetCoverDialog(onConfirm: () -> Unit, onDismiss: () -> Unit) {
 *     AlertDialog(
 *       text = { Text(stringResource(MR.strings.confirm_set_image_as_cover)) },
 *       confirmButton = { TextButton(onClick = onConfirm) { Text(MR.strings.action_ok) } },
 *       dismissButton = { TextButton(onClick = onDismiss) { Text(MR.strings.action_cancel) } },
 *       onDismissRequest = onDismiss,
 *     )
 *   }
 *
 * The reference dialog carries no title and no icon: only the body text and the two text buttons.
 * It is opened from the "Set as cover" action of the page actions sheet and closed again as soon
 * as the confirmation is made. The result of the action is reported afterwards by the reader
 * toast (cover_updated / notification_first_add_to_library / notification_cover_update_failed).
 *
 * MD3 metrics (androidx.compose.material3.AlertDialog, compose-bom 2026.10.00):
 *  - BasicAlertDialog: Box(sizeIn(minWidth = 280.dp, maxWidth = 560.dp)); the surface hugs its
 *    content, so the 280dp minimum wins for this short body text.
 *  - AlertDialogContent: Surface(shape = extraLarge 28dp, color = surfaceContainerHigh,
 *    tonalElevation = 0.dp) { Column(padding(dialogPadding = 24.dp)) { text, buttons } }.
 *    tonalElevation = 0.dp and no shadow elevation, so the surface has NO drop shadow.
 *  - text: Box(padding(bottom = 24.dp), align Start) { Text(bodyMedium, onSurfaceVariant) }.
 *  - buttons: Box(align End) { AlertDialogFlowRow(mainAxisSpacing = 8.dp) { confirm, dismiss } };
 *    the flow row flips the layout direction, so horizontally the dismiss button ("Cancel") comes
 *    first on the left and the confirm button ("OK") second on the right; when the row wraps, the
 *    confirm button is on the upper line.
 *  - TextButton: height 40dp, minWidth 64dp, contentPadding 12dp/8dp, shape full (20dp),
 *    labelLarge 14sp/20sp Medium, primary label color.
 *
 * Web notes:
 *  - Suwayomi REST v1 (pinned commit e2ce828) exposes no endpoint that uploads a custom cover
 *    image: the thumbnail is fetched from the source and cached by the server, and the only
 *    writable manga fields are the library flag, the categories and the meta map. The
 *    confirmation therefore reports that the action is unavailable in the web version instead of
 *    pretending that the cover changed.
 */
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ (event: 'confirm'): void }>()

const toast = ref(''), toastOpen = ref(false)
const dialog = ref<HTMLElement | null>(null)
let toastTimer: number | undefined

function dismiss() { open.value = false }

function confirm() {
  open.value = false
  toast.value = 'Setting this page as cover art is not supported in the web version.'
  toastOpen.value = true
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toastOpen.value = false }, 4000)
  emit('confirm')
}

/**
 * Back dismissal, matching the reference onDismissRequest. The handler sits on the dialog
 * element itself: the Compose dialog is a separate window, so the back press only closes it
 * and never reaches the page actions sheet underneath.
 */
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  dismiss()
}

watch(open, value => { if (value) void nextTick(() => dialog.value?.focus()) })

onBeforeUnmount(() => { if (toastTimer) window.clearTimeout(toastTimer) })
</script>

<template>
  <div v-if="open" class="set-cover" role="presentation">
    <div class="set-cover-scrim" @click="dismiss" />
    <div
      ref="dialog"
      class="set-cover-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Use this image as cover art?"
      tabindex="-1"
      @click.stop
      @keydown="onKeydown"
    >
      <p class="set-cover-text">Use this image as cover art?</p>
      <div class="set-cover-actions">
        <!-- AlertDialogFlowRow flips the layout direction, so the composed order is
             confirmButton, dismissButton: visually "Cancel" sits left of "OK", and when the row
             wraps the confirm button stays on the upper line. The DOM order below mirrors the
             composition order and the row-reverse flex reproduces the flipped direction. -->
        <button type="button" class="set-cover-button" @click="confirm">OK</button>
        <button type="button" class="set-cover-button" @click="dismiss">Cancel</button>
      </div>
    </div>
  </div>
  <div v-if="toastOpen" class="set-cover-toast" role="status" aria-live="polite">{{ toast }}</div>
</template>

<style scoped>
@layer app-components {
/* Compose Dialog: full screen window with a 32% scrim. */
.set-cover { position: fixed; inset: 0; z-index: 2000; }
.set-cover-scrim { position: absolute; inset: 0; background: #000; opacity: .32; animation: set-cover-fade 200ms ease; }
/* AlertDialogContent: Surface(shape extraLarge 28dp, color surfaceContainerHigh, tonalElevation 0),
   sized by BasicAlertDialog to sizeIn(minWidth 280dp, maxWidth 560dp). */
.set-cover-dialog {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
  /* BasicAlertDialog: sizeIn(minWidth = 280.dp, maxWidth = 560.dp) around a content-sized
     surface, so the short body text still gets the 280dp minimum. */
  width: fit-content;
  min-width: min(280px, calc(100vw - 48px));
  max-width: min(560px, calc(100vw - 48px));
  padding: 24px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface-variant));
  /* AlertDialogContent Surface: tonalElevation = 0.dp and no shadow elevation, so the
     Compose surface has no drop shadow at all. */
  box-shadow: none;
  outline: none;
  animation: set-cover-fade 200ms ease;
}
/* text: Box(padding bottom 24dp, align Start) { Text(bodyMedium 14sp/20sp, onSurfaceVariant) }. */
.set-cover-text {
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}
/* buttons: Box(align End) { AlertDialogFlowRow(mainAxisSpacing 8dp) { confirmButton, dismissButton } }.
   The flow row flips the layout direction, so the dismiss button ("Cancel") is rendered left of
   the confirm button ("OK"); row-reverse reproduces that flip, and the DOM order stays
   confirm-then-dismiss like the composition order. */
.set-cover-actions { display: flex; flex-flow: row-reverse wrap; align-items: center; justify-content: flex-start; gap: 8px; }
/* MD3 TextButton: height 40dp, minWidth 64dp, contentPadding 12dp horizontal / 8dp vertical,
   shape full (20dp), labelLarge 14sp/20sp Medium, primary label color, state layer 8%/10%. */
.set-cover-button {
  min-width: 64px;
  height: 40px;
  padding: 8px 12px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-family: Roboto, sans-serif;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.0071428571em;
  text-transform: none;
  cursor: pointer;
}
.set-cover-button:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
.set-cover-button:active { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 10%, transparent); }
.set-cover-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
/* MD3 snackbar (Mihon toast): inverseSurface, 4dp shape, bodyMedium, 288dp minimum width. */
.set-cover-toast {
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
@keyframes set-cover-fade { from { opacity: 0; } to { opacity: 1; } }
}
</style>
