<script setup lang="ts">
import { onBeforeUnmount, ref, useId, watch } from 'vue'
import { apiErrorMessage, createSuwayomiApi } from '@/core/api/client'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'

/**
 * Pixel-parity port of `HistoryDeleteDialog` in
 * mihon/app/src/main/java/eu/kanade/presentation/history/components/HistoryDialogs.kt:21-60
 *
 *   var removeEverything by remember { mutableStateOf(false) }
 *   AlertDialog(
 *     title = { Text(text = stringResource(MR.strings.action_remove)) },
 *     text = {
 *       Column(verticalArrangement = Arrangement.spacedBy(MaterialTheme.padding.small)) {
 *         Text(text = stringResource(MR.strings.dialog_with_checkbox_remove_description))
 *         LabeledCheckbox(
 *           label = stringResource(MR.strings.dialog_with_checkbox_reset),
 *           checked = removeEverything,
 *           onCheckedChange = { removeEverything = it },
 *         )
 *       }
 *     },
 *     onDismissRequest = onDismissRequest,
 *     confirmButton = { TextButton(onClick = { onDelete(removeEverything); onDismissRequest() }) {
 *                          Text(text = stringResource(MR.strings.action_remove)) } },
 *     dismissButton = { TextButton(onClick = onDismissRequest) { Text(text = stringResource(MR.strings.action_cancel)) } },
 *   )
 *
 * Strings (mihon/i18n/src/commonMain/moko-resources/base/strings.xml):
 *   action_remove = "Remove", action_cancel = "Cancel"
 *   dialog_with_checkbox_remove_description =
 *     "This will remove the read date of this chapter. Are you sure?"
 *   dialog_with_checkbox_reset = "Reset all chapters for this entry"
 *
 * Material3 metrics used here (compose material3 AlertDialog.kt + DialogTokens.kt + Button.kt):
 * - container = surface-container-high, shape = CornerExtraLarge (28dp), 24dp padding on all sides,
 *   tonal elevation 0dp (flat colour) and shadow elevation 0dp (the Surface inside
 *   AlertDialogContent never passes a shadow elevation, so the dialog is flat).
 * - title = headlineSmall (24sp / 32sp, weight 400, tracking 0) in on-surface, 16dp bottom padding.
 * - supporting text = bodyMedium (14sp / 20sp, tracking 0.0178571429em) in on-surface-variant,
 *   24dp bottom padding above the action row; the inner column spaces its children by 8dp
 *   (MaterialTheme.padding.small).
 * - the action row is right aligned; AlertDialogFlowRow keeps the confirm button (declared
 *   first) on the RIGHT, so visually "Cancel" then "Remove".
 * - buttons = TextButton: min height 40dp, min width 58dp, 12dp horizontal and 8dp vertical
 *   padding, fully rounded (20dp) shape, labelLarge (14sp / 20sp, weight 500) in the primary
 *   colour, 8dp gap between them.
 *
 * The checkbox is the shared `LabeledCheckbox` composable
 * (mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/LabeledCheckbox.kt:20-51):
 * a clipped (8dp radius) row with a minimum height of 48dp that owns the click handling, an 8dp
 * gap and a Material3 Checkbox. The label inherits the text slot content colour
 * (on-surface-variant) and the bodyMedium typography of the Material3 theme. Compose renders the
 * checkbox with the legacy (Material Design 2) geometry because
 * `ComposeMaterial3Flags.isCheckboxStylingFixEnabled` is false in Mihon: a 20dp box with a 2dp
 * radius and a 2dp stroke inside a 24dp footprint.
 *
 * Behaviour (mihon/app/src/main/java/eu/kanade/tachiyomi/ui/history/HistoryTab.kt:80-91):
 *   onDelete(all) -> if (all) viewModel.removeAllFromHistory(mangaId) else viewModel.removeFromHistory(history)
 * Suwayomi-Server has no history table: the history is derived from the chapter read state
 * (`manga.lastReadAt` = max chapter `lastReadAt`). Clearing the read state of the chapter
 * therefore removes exactly the history entry, and clearing every chapter of the manga removes all
 * of its history rows - the same semantics as the reference, implemented with
 * `PATCH /manga/{mangaId}/chapter/{chapterIndex}` (read=false, lastPageRead=0).
 */
const props = withDefaults(
  defineProps<{
    /** Manga that owns the history entry (Mihon: HistoryWithRelations.mangaId). */
    mangaId: number
    /** One-based source index of the chapter behind the entry (Suwayomi REST chapter index). */
    chapterIndex?: number | null
    /** Optional API base URL; defaults to the configured Suwayomi server. */
    apiUrl?: string
  }>(),
  { chapterIndex: null, apiUrl: '' },
)

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{
  (event: 'delete', removeEverything: boolean): void
  (event: 'deleted', removeEverything: boolean): void
  (event: 'error', message: string): void
}>()

const server = useSuwayomiStore()
const titleId = useId()
const textId = useId()

const removeEverything = ref(false)
const errorMessage = ref('')
let errorTimer: ReturnType<typeof setTimeout> | undefined

function showError(message: string) {
  errorMessage.value = message
  emit('error', message)
  if (errorTimer) clearTimeout(errorTimer)
  errorTimer = setTimeout(() => {
    errorMessage.value = ''
    errorTimer = undefined
  }, 4000)
}

watch(open, (isOpen) => {
  if (!isOpen) return
  /* The Compose dialog leaves the composition when it is dismissed, so its
     `remember { mutableStateOf(false) }` state starts over on every opening. */
  removeEverything.value = false
  errorMessage.value = ''
  if (errorTimer) {
    clearTimeout(errorTimer)
    errorTimer = undefined
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (errorTimer) clearTimeout(errorTimer)
})

function onToggle() {
  removeEverything.value = !removeEverything.value
}

function baseUrl() {
  return props.apiUrl || server.apiUrl
}

async function onConfirm() {
  /* Mihon: `onDelete(removeEverything); onDismissRequest()` (HistoryDialogs.kt:47-49). */
  const all = removeEverything.value
  emit('delete', all)
  open.value = false

  if (!props.mangaId || (!all && props.chapterIndex == null)) {
    const message = 'This history entry has no chapter to reset. Refresh the history and try again.'
    showError(message)
    return
  }
  const index = props.chapterIndex as number

  try {
    const api = createSuwayomiApi(baseUrl())
    if (all) {
      /* removeAllFromHistory(mangaId): clear the read state of every chapter of the manga.
         The REST DTO exposes the deprecated `read` flag at its default value, so the state
         cannot be probed: every chapter is reset unconditionally. */
      const chapters = await api.chapters(props.mangaId)
      for (const chapter of chapters) {
        await api.modifyChapter(props.mangaId, chapter.index, { read: false, lastPageRead: 0 })
      }
    } else {
      /* removeFromHistory(history): clear the read state of this single chapter. */
      await api.modifyChapter(props.mangaId, index, { read: false, lastPageRead: 0 })
    }
    emit('deleted', all)
  } catch (cause) {
    const message = apiErrorMessage(cause)
    showError(message)
  }
}
</script>

<template>
  <v-dialog
    v-model="open"
    content-class="history-delete-overlay"
    :content-props="{ 'aria-labelledby': titleId, 'aria-describedby': textId }"
  >
    <v-card rounded="28px" color="surface-container-high" variant="flat" class="history-delete-card">
      <!-- DialogTokens.HeadlineFont = HeadlineSmall (24sp / 32sp, w400) in on-surface. -->
      <h2 :id="titleId" class="history-delete-title">Remove</h2>

      <!-- DialogTokens.SupportingTextFont = BodyMedium (14sp / 20sp, w400) in on-surface-variant.
           The column spaces its children by 8dp (MaterialTheme.padding.small). -->
      <div :id="textId" class="history-delete-content">
        <p class="history-delete-text">This will remove the read date of this chapter. Are you sure?</p>

        <!-- LabeledCheckbox: Row(clip(shapes.small = 8dp).fillMaxWidth().heightIn(min = 48.dp)
             .clickable(role = Checkbox), spacedBy(padding.small = 8dp)). -->
        <button
          type="button"
          class="history-delete-checkbox-row"
          role="checkbox"
          :aria-checked="removeEverything"
          @click="onToggle"
        >
          <span class="history-delete-checkbox" :class="{ 'history-delete-checkbox--checked': removeEverything }" aria-hidden="true">
            <svg class="history-delete-check" viewBox="0 0 20 20" focusable="false">
              <polyline points="4,10 8,14 16,6" pathLength="100" />
            </svg>
          </span>
          <span class="history-delete-checkbox-label">Reset all chapters for this entry</span>
        </button>
      </div>

      <!-- Box(align = End) + AlertDialogFlowRow: the confirm button is declared first and
           renders on the RIGHT, the dismiss button ("Cancel") on the LEFT. -->
      <div class="history-delete-actions">
        <button type="button" class="history-delete-button" @click="onConfirm">Remove</button>
        <button type="button" class="history-delete-button" @click="open = false">Cancel</button>
      </div>
    </v-card>
  </v-dialog>

  <!-- Error feedback for a failed Suwayomi mutation; the reference shows a snackbar on the
       History tab (SnackbarHost.kt) instead of an in-dialog message. -->
  <div v-if="errorMessage" class="history-delete-snackbar" role="status" aria-live="polite">
    {{ errorMessage }}
  </div>
</template>

<style>
/* Material3 BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp) around a content sized
   dialog. The Vuetify overlay content is stretched by default and has to be constrained here; the
   card fills the overlay content, so the overlay drives the final width. */
.v-dialog > .history-delete-overlay {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}
/* Compose draws the dialog surface with tonalElevation = 0.dp and Surface's default
   shadowElevation = 0.dp, so the alert dialog is flat and has no drop shadow.
   The card must also hug its content: Vuetify stretches the card inside the flex overlay
   column, while BasicAlertDialog sizes the pane to its content. */
.v-dialog > .history-delete-overlay > .v-card.history-delete-card {
  /* CornerExtraLarge (28dp); Vuetify's dialog stylesheet would otherwise force 4dp. */
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
/* Material3 AlertDialog container: shape = CornerExtraLarge (28dp), container colour =
   surface-container-high, container padding 24dp. */
.history-delete-card {
  box-sizing: border-box;
  padding: 24px;
  max-height: calc(100dvh - 48px);
  overflow-y: auto;
}

/* Title: headlineSmall (24sp / 32sp, weight 400) in on-surface, 16dp bottom padding. */
.history-delete-title {
  margin: 0 0 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
}

/* Supporting text block: bodyMedium in on-surface-variant, 24dp bottom padding, the inner column
   spaces its children by 8dp (MaterialTheme.padding.small). */
.history-delete-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 24px;
}

.history-delete-text {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* LabeledCheckbox: a row with a minimum height of 48dp, clipped to an 8dp radius, that owns the
   click handling (role = Checkbox). It lives inside the dialog text slot, so the label inherits
   the text content colour (on-surface-variant) and the bodyMedium typography. */
.history-delete-checkbox-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 48px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: none;
  font-family: inherit;
  text-align: start;
  cursor: pointer;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}
/* Compose draws the ripple of the row in the content colour of the text slot (on-surface-variant). */
.history-delete-checkbox-row::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0;
  transition: opacity 0.2s ease-out;
  pointer-events: none;
}
.history-delete-checkbox-row:hover::after { opacity: 0.08; }
.history-delete-checkbox-row:active::after { opacity: 0.12; }
.history-delete-checkbox-row:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* Checkbox: legacy Material Design 2 geometry (the Compose styling fix is disabled in Mihon) —
   CheckboxSize = 20dp canvas with CheckboxDefaultPadding = 2dp around it, so the node occupies
   24dp and the drawn box is 20dp with a 2dp stroke centred on its edge and a 2dp radius. */
.history-delete-checkbox {
  position: relative;
  box-sizing: border-box;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}
.history-delete-checkbox::before {
  content: '';
  position: absolute;
  inset: 2px;
  box-sizing: border-box;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
  border-radius: 2px;
  background: transparent;
  transition: background-color 0.1s ease-out, border-color 0.1s ease-out;
}
/* Checked: the box fill and the border share the primary colour, so the whole box is filled
   in the primary colour. */
.history-delete-checkbox--checked::before {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary));
}
/* Check mark: (4,10) -> (8,14) -> (16,6) of the 20dp canvas, 2dp stroke, square caps, on-primary. */
.history-delete-check {
  position: absolute;
  z-index: 1;
  inset: 2px;
  width: 20px;
  height: 20px;
  overflow: visible;
}
.history-delete-check polyline {
  fill: none;
  stroke: rgb(var(--v-theme-on-primary));
  stroke-width: 2;
  stroke-linecap: square;
  stroke-linejoin: miter;
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  transition: stroke-dashoffset 0.1s ease-out;
}
.history-delete-checkbox--checked .history-delete-check polyline { stroke-dashoffset: 0; }

.history-delete-checkbox-label {
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* Action row: right aligned, 8dp between the buttons. AlertDialogFlowRow keeps the confirm
   button (declared first) on the right and the dismiss button on the left. */
.history-delete-actions {
  display: flex;
  flex-direction: row-reverse;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: center;
  gap: 8px;
}

/* TextButton: min height 40dp, min width 58dp, 12dp horizontal and 8dp vertical padding, fully
   rounded shape, labelLarge typography in the primary colour. */
.history-delete-button {
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
  -webkit-tap-highlight-color: transparent;
  transition: border-radius 0.1s ease-in-out;
}
/* MD3 state layer: 8% on hover, 10% while pressed; the pressed shape is CornerSmall (8dp). */
.history-delete-button::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}
.history-delete-button:hover::after { opacity: 0.08; }
.history-delete-button:active::after { opacity: 0.1; }
.history-delete-button:active { border-radius: 8px; }
.history-delete-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* Web-only feedback for a failed Suwayomi mutation (the reference uses a snackbar host). */
.history-delete-snackbar {
  position: fixed;
  left: 50%;
  bottom: calc(80px + 16px);
  transform: translateX(-50%);
  z-index: 2600;
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
</style>
