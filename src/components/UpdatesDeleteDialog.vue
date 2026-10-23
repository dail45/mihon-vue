<script setup lang="ts">
/**
 * Pixel-parity port of the Updates delete confirmation.
 *
 * Reference:
 *   mihon/app/src/main/java/eu/kanade/presentation/updates/UpdatesDeleteConfirmationDialog.kt
 *     AlertDialog(
 *       text    = { Text(text = stringResource(MR.strings.confirm_delete_chapters)) },
 *       onDismissRequest = onDismissRequest,
 *       confirmButton = { TextButton(onClick = { onConfirm(); onDismissRequest() }) { Text(action_ok) } },
 *       dismissButton = { TextButton(onClick = onDismissRequest) { Text(action_cancel) } },
 *     )
 *
 * The reference dialog has NEITHER a title NOR an icon, so only the supporting text and
 * the two text buttons are rendered.
 *
 * Strings (mihon/i18n/src/commonMain/moko-resources/base/strings.xml):
 *   confirm_delete_chapters = "Are you sure you want to delete the selected chapters?" (L828)
 *   action_ok = "OK" (L137), action_cancel = "Cancel" (L136)
 *   internal_error = "InternalError: Check crash logs for further information" (L174)
 *
 * Metrics (androidx.compose.material3 AlertDialog.kt, DialogTokens.kt, Button.kt, tokens):
 *   - container: DialogTokens.ContainerColor = SurfaceContainerHigh,
 *     DialogTokens.ContainerShape = CornerExtraLarge (28dp).
 *     AlertDialogContent builds the Surface with `tonalElevation` only and WITHOUT a shadow
 *     elevation, so the MD3 alert dialog is FLAT: no drop shadow, no tonal tint
 *     (DialogTokens.ContainerElevation = Level3 is not applied by AlertDialogContent).
 *   - container padding: AlertDialogDefaults.dialogPadding = 24dp on every side
 *   - pane size: BasicAlertDialog sizeIn(minWidth = 280dp, maxWidth = 560dp)
 *   - text: DialogTokens.SupportingTextFont = BodyMedium (14/20, w400, ls 0.0178571429em),
 *     DialogTokens.SupportingTextColor = OnSurfaceVariant,
 *     AlertDialogDefaults.textPadding = 24dp bottom
 *   - buttons: TextButton -> 40dp height, 58dp min width, 12dp horizontal content padding,
 *     ButtonDefaults.textShape = CornerFull (pill), MaterialTheme.typography.labelLarge
 *     (14/20, w500, ls 0.1sp -> 0.0071428571em), label colour = Primary,
 *     state layers 8% hover / 10% pressed, pressed shape = CornerSmall (8dp)
 *   - AlertDialogFlowRow flips the layout direction, so the confirm button ("OK", declared
 *     first) renders on the RIGHT and the dismiss button ("Cancel") on the LEFT; the row is
 *     right aligned (Box(Modifier.align(Alignment.End))) with an 8dp main-axis gap.
 *
 * Behaviour (mihon/.../tachiyomi/ui/updates/UpdatesTab.kt:85-90 and UpdatesViewModel.kt:356):
 *   - onConfirm runs first, the dialog is dismissed right after it.
 *   - UpdatesViewModel.deleteChapters groups the selection by manga and calls
 *     DownloadManager.deleteChapters, which removes the DOWNLOADED chapter files, and then
 *     clears the whole selection (`toggleAllSelection(false)`).
 *   - DownloadManager.getChaptersToDelete (DownloadManager.kt:430) skips BOOKMARKED chapters
 *     unless the `removeBookmarkedChapters` preference is enabled (default: off,
 *     domain/.../download/service/DownloadPreferences.kt) and skips READ chapters of mangas
 *     in an excluded category. The category rule needs the Mihon category preferences, which
 *     the Suwayomi backend does not expose, so only the bookmarked rule is reproduced here.
 *   - A failure is reported by Mihon with the `internal_error` snackbar
 *     ("InternalError: Check crash logs for further information", strings.xml:174), shown by
 *     the Updates screen host (UpdatesTab.kt:100-105). This component emits `delete-error`
 *     with the very same string so the host can show it.
 *
 * The web client is a headless Suwayomi REST client, so the equivalent server-side operation is
 * `DELETE /manga/{mangaId}/chapter/{chapterIndex}` (MangaController.chapterDelete ->
 * Chapter.deleteChapter -> deleteDownloadedChapters), which removes the downloaded files and
 * clears the downloaded flag.
 */
import { computed, ref, useId } from 'vue'
import type { MangaChapter } from '../api/types'
import { deleteChapterDownload } from '../api/chapterDownloads'

const props = defineProps<{ chapters: MangaChapter[]; apiUrl: string }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ deleted: [ids: number[]]; 'delete-error': [message: string] }>()

const textId = useId()

/** Mihon deletes the local download files of the selected chapters
 * (DownloadManager.deleteChapters) and skips the bookmarked ones by default
 * (DownloadManager.getChaptersToDelete, preference `removeBookmarkedChapters` = false). */
const downloadable = computed(() => props.chapters.filter(entry => entry.chapter.downloaded && !entry.chapter.bookmarked))

const busy = ref(false)

/** `TextButton(onClick = { onConfirm(); onDismissRequest() })` — confirm first, dismiss after. */
function confirm() {
  if (busy.value) return
  const targets = downloadable.value
  busy.value = true
  void (async () => {
    const deletedIds: number[] = []
    try {
      for (const entry of targets) {
        await deleteChapterDownload(props.apiUrl, entry.manga.id, entry.chapter.index)
        deletedIds.push(entry.chapter.id)
      }
      emit('deleted', deletedIds)
    } catch {
      emit('delete-error', 'InternalError: Check crash logs for further information')
    } finally {
      busy.value = false
    }
  })()
  open.value = false
}
</script>

<template>
  <v-dialog
    v-model="open"
    content-class="updates-delete-overlay"
    :content-props="{ 'aria-describedby': textId }"
  >
    <!-- AlertDialogContent draws a flat Surface: no shadow elevation, no tonal overlay. -->
    <v-card
      class="updates-delete-card"
      color="surface-container-high"
      variant="flat"
      rounded="28px"
    >
      <!-- DialogTokens.SupportingTextFont = BodyMedium (14/20, w400); SupportingTextColor = OnSurfaceVariant. -->
      <p :id="textId" class="updates-delete-text">Are you sure you want to delete the selected chapters?</p>

      <!-- Box(align = End) + AlertDialogFlowRow: the confirm button is the first child and renders rightmost. -->
      <div class="updates-delete-actions">
        <button type="button" class="updates-delete-button" @click="confirm">OK</button>
        <button type="button" class="updates-delete-button" @click="open = false">Cancel</button>
      </div>
    </v-card>
  </v-dialog>
</template>

<style>
/* Material3 BasicAlertDialog applies sizeIn(minWidth = 280dp, maxWidth = 560dp) to the dialog pane.
   The Vuetify overlay content is stretched by default and has to be constrained here. */
.v-dialog > .updates-delete-overlay {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}
/* Compose draws the dialog surface with tonalElevation = 0.dp and Surface's default
   shadowElevation = 0.dp, so the alert dialog is flat and has no drop shadow.
   The card must also hug its content: Vuetify stretches the card inside the flex overlay
   column, while BasicAlertDialog sizes the pane to its content. */
.v-dialog > .updates-delete-overlay > .v-card.updates-delete-card {
  /* CornerExtraLarge (28dp); Vuetify's dialog stylesheet would otherwise force 4dp. */
  border-radius: 28px;
  box-shadow: none;
  flex: 0 0 auto;
  align-self: center;
  width: fit-content;
}
</style>

<style scoped>
@layer app-components {
/* Surface: DialogTokens.ContainerColor = SurfaceContainerHigh, DialogTokens.ContainerShape =
   CornerExtraLarge (28dp), container padding 24dp (AlertDialogDefaults.dialogPadding). */
.updates-delete-card {
  box-sizing: border-box;
  padding: 24px;
  max-height: calc(100dvh - 48px);
  overflow-y: auto;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
}
/* DialogTokens.SupportingTextFont = BodyMedium (14/20, w400, ls 0.0178571429em);
   DialogTokens.SupportingTextColor = OnSurfaceVariant; AlertDialogDefaults.textPadding = 24dp bottom. */
.updates-delete-text {
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}
/* AlertDialogFlowRow flips the layout direction, so the confirm button renders rightmost.
   Row-reverse keeps the confirm button first in the accessibility order; the row is right aligned
   (Box(Modifier.align(Alignment.End))) and the main axis gap is 8dp (ButtonsMainAxisSpacing). */
.updates-delete-actions {
  display: flex;
  flex-direction: row-reverse;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: center;
  gap: 8px;
}
/* MD3 text button: 40dp height, 58dp min width, 12dp side padding, ButtonDefaults.textShape =
   CornerFull (pill), labelLarge (14/20, w500, ls 0.1sp) in Primary. */
.updates-delete-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 58px;
  height: 40px;
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
  text-transform: none;
  cursor: pointer;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
  transition: border-radius 0.1s ease-in-out;
}
/* Compose draws the state layer in the content colour of the label. */
.updates-delete-button::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-out;
  pointer-events: none;
}
/* MD3 state layer: 8% on hover, 10% while pressed; the pressed shape is CornerSmall (8dp). */
.updates-delete-button:hover::after { opacity: 0.08; }
.updates-delete-button:active::after { opacity: 0.1; }
.updates-delete-button:active { border-radius: 8px; }
.updates-delete-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
}
</style>
