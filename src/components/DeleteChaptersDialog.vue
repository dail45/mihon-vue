<script setup lang="ts">
/**
 * Pixel-parity port of the manga "delete chapters" confirmation.
 *
 * Reference:
 *   mihon/app/src/main/java/eu/kanade/presentation/manga/components/MangaDialogs.kt:35-64
 *     AlertDialog(
 *       onDismissRequest = onDismissRequest,
 *       dismissButton = { TextButton(onClick = onDismissRequest) { Text(action_cancel) } },
 *       confirmButton = { TextButton(onClick = { onDismissRequest(); onConfirm() }) { Text(action_ok) } },
 *       title = { Text(are_you_sure) },
 *       text  = { Text(confirm_delete_chapters) },
 *     )
 *
 * The reference is called from
 *   mihon/app/src/main/java/eu/kanade/tachiyomi/ui/manga/MangaScreen.kt:198-206
 *     DeleteChaptersDialog(
 *       onDismissRequest = onDismissRequest,
 *       onConfirm = { viewModel.toggleAllSelection(false); viewModel.deleteChapters(dialog.chapters) },
 *     )
 *
 * Strings (mihon/i18n/src/commonMain/moko-resources/base/strings.xml):
 *   action_cancel = "Cancel" (L136), action_ok = "OK" (L137),
 *   are_you_sure = "Are you sure?" (L834),
 *   confirm_delete_chapters = "Are you sure you want to delete the selected chapters?" (L828).
 *
 * Every metric follows androidx.compose.material3.AlertDialog (AlertDialog.kt),
 * DialogTokens.kt and Button.kt:
 *   - container: surfaceContainerHigh, CornerExtraLarge (28dp), 24dp padding,
 *     280dp min width / 560dp max width. AlertDialogContent builds the Surface with
 *     `tonalElevation` only, so the dialog surface is FLAT: no drop shadow, no tint.
 *   - title: HeadlineSmall (24/32, w400) in OnSurface, 16dp bottom gap
 *   - text: BodyMedium (14/20, w400) in OnSurfaceVariant, 24dp bottom gap
 *   - buttons: TextButton -> 40dp height, 58dp min width, 12dp side padding, full 20dp
 *     shape, LabelLarge (14/20, w500) in Primary, 8% hover / 10% pressed state layers
 *   - AlertDialogFlowRow flips the layout direction, so the confirm button ("OK",
 *     declared first) renders on the RIGHT and the dismiss button ("Cancel") on the
 *     LEFT. The row is right aligned (Box(Modifier.align(Alignment.End))).
 *
 * The confirm handler mirrors the Kotlin order: `onDismissRequest()` runs first and
 * `onConfirm()` right after it.
 *
 * What the reference actually deletes: Mihon routes the confirmation to
 * MangaViewModel.deleteChapters (MangaViewModel.kt:859) -> DownloadManager.deleteChapters
 * (mihon/app/src/main/java/eu/kanade/tachiyomi/data/download/DownloadManager.kt:269),
 * which removes the DOWNLOADED CHAPTER FILES (not the chapter entries of the source).
 * DownloadManager.getChaptersToDelete (same file, line 430) skips bookmarked chapters
 * unless the "remove bookmarked chapters" preference is enabled (default: off).
 * The web client is a headless Suwayomi REST client, so the equivalent server-side
 * operation is DELETE /manga/{mangaId}/chapter/{chapterIndex}
 * (MangaController.chapterDelete -> Chapter.deleteChapter), which removes the
 * downloaded files and clears the downloaded flag.
 *
 * Mihon only logs a failed deletion (MangaViewModel.kt:865, logcat(LogPriority.ERROR)),
 * so the web port reports the failure through the `delete-error` event and the host
 * screen decides how to surface it.
 */
import { computed, useId } from 'vue'
import type { Chapter } from '../api/types'
import { apiErrorMessage } from '../api/client'
import { deleteChapterDownload } from '../api/chapterDownloads'

const props = defineProps<{ mangaId: number; chapters: Chapter[]; apiUrl: string }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ deleted: [ids: number[]]; 'delete-error': [message: string] }>()

const titleId = useId()
const textId = useId()

/** DownloadManager.deleteChapters only removes files of downloaded chapters, and
 * DownloadManager.getChaptersToDelete skips bookmarked chapters by default. */
const targets = computed(() => props.chapters.filter(entry => entry.downloaded && !entry.bookmarked))

/** `TextButton(onClick = { onDismissRequest(); onConfirm() })` — dismiss first, confirm after. */
function confirm() {
  const selected = targets.value
  open.value = false
  if (!selected.length) {
    // Nothing is downloaded, so there is no file to remove; Mihon still clears the selection.
    emit('deleted', [])
    return
  }
  void (async () => {
    const deletedIds: number[] = []
    try {
      for (const entry of selected) {
        await deleteChapterDownload(props.apiUrl, props.mangaId, entry.index)
        deletedIds.push(entry.id)
      }
      emit('deleted', deletedIds)
    } catch (cause) {
      emit('delete-error', apiErrorMessage(cause))
    }
  })()
}
</script>

<template>
  <v-dialog
    v-model="open"
    max-width="560"
    :content-props="{ 'aria-labelledby': titleId, 'aria-describedby': textId }"
  >
    <!-- AlertDialogContent draws a flat Surface: no shadow elevation, no tonal overlay. -->
    <v-card
      class="delete-chapters-dialog"
      color="surface-container-high"
      variant="flat"
      rounded="28px"
    >
      <!-- DialogTokens.HeadlineFont = HeadlineSmall (24/32, w400); HeadlineColor = OnSurface. -->
      <h2 :id="titleId" class="delete-chapters-title">Are you sure?</h2>
      <!-- DialogTokens.SupportingTextFont = BodyMedium (14/20, w400); SupportingTextColor = OnSurfaceVariant. -->
      <p :id="textId" class="delete-chapters-text">Are you sure you want to delete the selected chapters?</p>
      <!-- Box(align = End) + AlertDialogFlowRow: the confirm button is the first child and renders rightmost. -->
      <div class="delete-chapters-actions">
        <button type="button" class="delete-chapters-button" @click="confirm">OK</button>
        <button type="button" class="delete-chapters-button" @click="open = false">Cancel</button>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
@layer app-components {
/* Surface: DialogTokens.ContainerColor = SurfaceContainerHigh, ContainerShape = CornerExtraLarge (28dp),
   container padding 24dp, min width 280dp / max width 560dp.
   AlertDialogContent draws the Surface with tonalElevation = 0.dp and without a shadow elevation,
   so the MD3 alert dialog is flat: no drop shadow and no tonal tint. */
.delete-chapters-dialog {
  box-sizing: border-box;
  align-self: center;
  width: fit-content;
  min-width: min(280px, 100%);
  max-width: min(560px, 100%);
  max-height: calc(100dvh - 48px);
  overflow-y: auto;
  padding: 24px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
  box-shadow: none;
}
/* DialogTokens.HeadlineFont = HeadlineSmall (24/32, w400); TitlePadding = 16dp bottom. */
.delete-chapters-title {
  margin: 0 0 16px;
  font-family: var(--v-font-heading, var(--v-font-body, Roboto, sans-serif));
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
}
/* DialogTokens.SupportingTextFont = BodyMedium (14/20, w400); AlertDialogDefaults.textPadding = 24dp bottom. */
.delete-chapters-text {
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}
/* AlertDialogFlowRow flips the layout direction, so the confirm button renders rightmost.
   Row-reverse keeps the confirm button first in the accessibility order. */
.delete-chapters-actions {
  display: flex;
  flex-direction: row-reverse;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 8px;
}
/* MD3 text button: 40dp height, 58dp min width, 12dp side padding, full 20dp shape,
   LabelLarge (14/20, w500) in Primary. */
.delete-chapters-button {
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
  letter-spacing: 0.0071428571em;
  text-transform: none;
  cursor: pointer;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}
/* Compose draws the state layer in the content colour of the label. */
.delete-chapters-button::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}
.delete-chapters-button:hover::after { opacity: 0.08; }
.delete-chapters-button:active::after { opacity: 0.1; }
.delete-chapters-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
}
</style>
