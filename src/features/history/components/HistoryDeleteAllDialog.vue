<script setup lang="ts">
import { onBeforeUnmount, ref, useId, watch } from 'vue'

/**
 * Pixel-parity port of `HistoryDeleteAllDialog` in
 * mihon/app/src/main/java/eu/kanade/presentation/history/components/HistoryDialogs.kt:62-89
 *
 *   AlertDialog(
 *     title = { Text(text = stringResource(MR.strings.action_remove_everything)) },
 *     text = { Text(text = stringResource(MR.strings.clear_history_confirmation)) },
 *     onDismissRequest = onDismissRequest,
 *     confirmButton = { TextButton(onClick = { onDelete(); onDismissRequest() }) {
 *                           Text(text = stringResource(MR.strings.action_ok)) } },
 *     dismissButton = { TextButton(onClick = onDismissRequest) {
 *                           Text(text = stringResource(MR.strings.action_cancel)) } },
 *   )
 *
 * Strings (mihon/i18n/src/commonMain/moko-resources/base/strings.xml):
 *   action_remove_everything = "Remove everything"
 *   clear_history_confirmation = "Are you sure? All history will be lost."
 *   action_ok = "OK", action_cancel = "Cancel"
 *
 * Material3 AlertDialog metrics (androidx.compose.material3 AlertDialog.kt, DialogTokens.kt,
 * Button.kt, Surface.kt):
 * - the container is a `Surface` with shape = CornerExtraLarge (28dp), colour = surface-container-high
 *   and `tonalElevation = 0.dp`; `shadowElevation` is not passed, so it defaults to 0.dp and the
 *   dialog draws NO drop shadow (DialogTokens.ContainerElevation = Level3 only feeds the
 *   *tonal* elevation of a `surface` coloured container, which is not the case here).
 * - container padding 24dp on all sides; the title slot adds 16dp below itself, the text slot
 *   adds 24dp below itself and the action row is right aligned inside the same 24dp padding.
 * - title = headlineSmall (24sp / 32sp, weight 400, tracking 0) in on-surface.
 * - supporting text = bodyMedium (14sp / 20sp, tracking 0.0178571429em) in on-surface-variant.
 * - BasicAlertDialog sizes the pane with sizeIn(minWidth = 280dp, maxWidth = 560dp) and the
 *   pane hugs its content.
 * - the action row is an AlertDialogFlowRow with 8dp spacing; the layout direction is flipped,
 *   so the confirm button ("OK", declared first) is rendered on the RIGHT and the dismiss button
 *   ("Cancel") on the LEFT; when the row does not fit, the confirm button ends up on top.
 * - TextButton: labelLarge (14sp / 20sp, weight 500, tracking 0.0071428571em) in primary,
 *   container height 40dp, minimum width 58dp, content padding 12dp horizontal / 8dp vertical,
 *   CornerFull shape (pill -> 20dp radius at 40dp height), pressed shape CornerSmall (8dp),
 *   8% hover state layer, 10% pressed state layer, no elevation.
 *
 * Behaviour (mihon/app/src/main/java/eu/kanade/presentation/history/HistoryTab.kt:92-97):
 * the confirm button calls `onDelete()` and then dismisses the dialog; Mihon then shows the
 * "History deleted" snackbar (MR.strings.clear_history_completed) on the History tab.
 *
 * Suwayomi-Server keeps the history in the chapter table, so the history rows are derived from
 * the chapter read state. There is no route that clears the history the way Mihon clears its own
 * history table: the closest equivalent would be un-reading every chapter of every title
 * (PATCH /manga/{mangaId}/chapter/{chapterIndex} with read=false), which is a different and
 * destructive operation than the reference one, which keeps the reading progress.
 *
 * The dialog therefore behaves exactly like the reference when `canDelete` is true; by default
 * the confirm action is an honest stub: the dialog opens and looks exactly like the reference,
 * but the action reports that the operation is not supported in the web version instead of
 * pretending to delete anything.
 */
const props = withDefaults(defineProps<{
  /** Whether the Suwayomi REST API can actually clear the history. */
  canDelete?: boolean
}>(), { canDelete: false })

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{
  (event: 'delete'): void
  (event: 'error', message: string): void
}>()

const titleId = useId()
const textId = useId()

/* Feedback channel for the action: the Suwayomi REST API cannot clear the history. */
const notice = ref('')
/* Material3 snackbar duration for a snackbar without an action: 4 seconds (Short). */
let noticeTimer: ReturnType<typeof setTimeout> | undefined

watch(open, (isOpen) => {
  /* The Compose dialog leaves the composition when it is dismissed, so nothing survives it. */
  if (isOpen) {
    notice.value = ''
    if (noticeTimer) {
      clearTimeout(noticeTimer)
      noticeTimer = undefined
    }
  }
})

onBeforeUnmount(() => {
  if (noticeTimer) clearTimeout(noticeTimer)
})

function onDismiss() {
  /* onDismissRequest */
  open.value = false
}

function onClickDelete() {
  /* onDelete() first, then onDismissRequest(), exactly as in the reference. */
  emit('delete')
  onDismiss()
  if (props.canDelete) return
  const msg = 'Clearing the whole history is not supported in the web version: the Suwayomi REST API has no history delete endpoint.'
  notice.value = msg
  emit('error', msg)
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = ''
    noticeTimer = undefined
  }, 4000)
}
</script>

<template>
  <v-dialog
    v-model="open"
    content-class="history-delete-all-overlay"
    :content-props="{ 'aria-labelledby': titleId, 'aria-describedby': textId }"
  >
    <v-card
      rounded="28px"
      color="surface-container-high"
      variant="flat"
      class="history-delete-all-card"
    >
      <h2 :id="titleId" class="history-delete-all-title">Remove everything</h2>
      <p :id="textId" class="history-delete-all-text">Are you sure? All history will be lost.</p>
      <div class="history-delete-all-actions">
        <button type="button" class="history-delete-all-button" @click="onClickDelete">OK</button>
        <button type="button" class="history-delete-all-button" @click="onDismiss">Cancel</button>
      </div>
    </v-card>
  </v-dialog>
  <Transition name="history-delete-all-snackbar-fade">
    <div v-if="notice" class="history-delete-all-snackbar" role="status" aria-live="polite">{{ notice }}</div>
  </Transition>
</template>

<style>
/* Material3 BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp) around a content sized
   dialog. The Vuetify overlay content is stretched by default and has to be constrained here; the
   card fills the overlay content, so the overlay drives the final width. */
.v-dialog > .v-overlay__content.history-delete-all-overlay,
.v-dialog > .history-delete-all-overlay {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}

/* Material3 AlertDialog container: Surface(shape = CornerExtraLarge, color = surface-container-high,
   tonalElevation = 0.dp). `shadowElevation` is not passed to the Surface, so it stays at 0.dp and
   the container is drawn WITHOUT a drop shadow (the Vuetify card elevation must be removed). */
.v-dialog > .v-overlay__content.history-delete-all-overlay > .v-card.history-delete-all-card,
.v-dialog > .history-delete-all-overlay > .v-card.history-delete-all-card {
  border-radius: 28px;
  box-shadow: none;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
  flex: 0 0 auto;
  align-self: center;
  width: fit-content;
}
</style>

<style scoped>
@layer app-components {
/* Material3 AlertDialog container: shape = CornerExtraLarge (28dp), container colour =
   surface-container-high, container padding 24dp on all sides. */
.history-delete-all-card {
  box-sizing: border-box;
  align-self: center;
  width: fit-content;
  min-width: min(280px, calc(100vw - 48px));
  max-width: 560px;
  max-height: calc(100dvh - 48px);
  overflow-y: auto;
  padding: 24px;
  /* The card must hug its content instead of stretching to the overlay height. */
  flex: 0 0 auto;
}

/* Title: headlineSmall (24sp / 32sp, weight 400) in on-surface, 16dp bottom padding. */
.history-delete-all-title {
  margin: 0 0 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
}

/* Supporting text: bodyMedium (14sp / 20sp, tracking 0.0178571429em) in on-surface-variant,
   24dp bottom padding above the action row. */
.history-delete-all-text {
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* AlertDialogFlowRow: the row is right aligned with 8dp between the buttons; the layout
   direction is flipped, so the first child (the confirm button "OK") is drawn on the right and
   the dismiss button "Cancel" on the left. */
.history-delete-all-actions {
  display: flex;
  flex-direction: row-reverse;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: center;
  gap: 8px;
}

/* MD3 TextButton: container height 40dp, minimum width 58dp, content padding 12dp horizontal
   and 8dp vertical, CornerFull shape (20dp radius at 40dp height), labelLarge typography
   (14sp / 20sp, weight 500) in the primary colour, no elevation. */
.history-delete-all-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 58px;
  height: 40px;
  padding: 8px 12px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.0071428571em;
  text-transform: none;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  overflow: hidden;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: border-radius 0.1s ease-in-out;
}
/* MD3 state layer: 8% on hover, 10% while pressed. */
.history-delete-all-button::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}
.history-delete-all-button:hover::after { opacity: 0.08; }
.history-delete-all-button:active::after { opacity: 0.1; }
/* PressedContainerShape of the small button tokens is CornerSmall (8dp). */
.history-delete-all-button:active { border-radius: 8px; }
.history-delete-all-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* Web-only notice for the action the Suwayomi REST API cannot perform. It follows the
   Material3 snackbar metrics: inverse-surface container, 4dp corner radius, 14dp/16dp padding,
   minimum width 288dp, bodyMedium text and Level3 elevation. */
.history-delete-all-snackbar {
  position: fixed;
  left: 50%;
  bottom: calc(80px + 16px);
  transform: translateX(-50%);
  z-index: 2600;
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
  box-shadow: 0 3px 6px rgba(0, 0, 0, .28), 0 1px 2px rgba(0, 0, 0, .2);
}

.history-delete-all-snackbar-fade-enter-active,
.history-delete-all-snackbar-fade-leave-active {
  transition: opacity 0.2s cubic-bezier(0.2, 0, 0, 1), transform 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.history-delete-all-snackbar-fade-enter-from,
.history-delete-all-snackbar-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
}
</style>
