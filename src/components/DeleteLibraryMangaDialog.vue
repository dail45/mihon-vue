<script setup lang="ts">
/**
 * Pixel-parity port of `DeleteLibraryMangaDialog`.
 *
 * Reference:
 *   mihon/app/src/main/java/eu/kanade/presentation/library/DeleteLibraryMangaDialog.kt
 *     var list by remember { mutableStateOf(buildList<CheckboxState.State<StringResource>> {
 *       add(CheckboxState.State.None(MR.strings.manga_from_library))
 *       if (!containsLocalManga) { add(CheckboxState.State.None(MR.strings.downloaded_chapters)) }
 *     }) }
 *     AlertDialog(
 *       onDismissRequest = onDismissRequest,
 *       dismissButton = { TextButton(onClick = onDismissRequest) { Text(MR.strings.action_cancel) } },
 *       confirmButton = {
 *         TextButton(
 *           enabled = list.any { it.isChecked },
 *           onClick = {
 *             onDismissRequest()
 *             onConfirm(list[0].isChecked, list.getOrElse(1) { CheckboxState.State.None(0) }.isChecked)
 *           },
 *         ) { Text(MR.strings.action_ok) }
 *       },
 *       title = { Text(MR.strings.action_remove) },
 *       text = {
 *         Column {
 *           list.forEach { state ->
 *             LabeledCheckbox(
 *               label = stringResource(state.value),
 *               checked = state.isChecked,
 *               onCheckedChange = { state.next() toggles the binary state },
 *             )
 *           }
 *         }
 *       },
 *     )
 *
 * Reference strings (mihon i18n base/strings.xml):
 *   action_remove = "Remove", action_cancel = "Cancel", action_ok = "OK",
 *   manga_from_library = "From library", downloaded_chapters = "Downloaded chapters".
 *
 * The label rows are `LabeledCheckbox`
 * (mihon/presentation-core/.../components/LabeledCheckbox.kt):
 *   Row(
 *     modifier = Modifier.clip(MaterialTheme.shapes.small).fillMaxWidth()
 *       .heightIn(min = 48.dp).clickable(role = Role.Checkbox, onClick = { onCheckedChange(!checked) }),
 *     verticalAlignment = Alignment.CenterVertically,
 *     horizontalArrangement = Arrangement.spacedBy(MaterialTheme.padding.small), // 8dp
 *   ) { Checkbox(checked = checked, onCheckedChange = null); Text(text = label) }
 * The whole row is clickable, the checkbox itself is not, the row is clipped with an 8dp
 * radius (MaterialTheme.shapes.small) and is at least 48dp tall.
 *
 * Material3 metrics used here (compose material3 AlertDialog.kt, DialogTokens.kt,
 * Checkbox.kt, Button.kt):
 *   - container: surface-container-high, CornerExtraLarge (28dp), tonalElevation 0dp
 *     (so no drop shadow), padding 24dp, min width 280dp / max width 560dp
 *   - title: headlineSmall (24sp / 32sp, w400) in on-surface, 16dp bottom gap
 *   - text slot: bodyMedium (14sp / 20sp) in on-surface-variant, 24dp bottom gap
 *   - buttons: TextButton -> 40dp height, 58dp min width, 12dp side padding, pill shape,
 *     labelLarge (14sp / 20sp, w500) in primary; the confirm button ("OK") is disabled
 *     (OnSurfaceVariant at 38%) while no row is checked
 *   - AlertDialogFlowRow flips the layout direction, so the dismiss button ("Cancel")
 *     renders on the LEFT and the confirm button ("OK") on the RIGHT
 *   - Checkbox (Mihon keeps the MD2 style, ComposeMaterial3Flags.isCheckboxStylingFixEnabled
 *     is false): 20dp box with 2dp padding on every side (24dp footprint), 2dp outline in
 *     on-surface-variant, 2dp corner radius, checked = solid primary box with an on-primary
 *     check mark (4,10) -> (8,14) -> (16,6), 2dp stroke, square caps.
 */
import { computed, ref, useId, watch } from 'vue'
import type { Manga } from '../api/types'

const props = withDefaults(defineProps<{
  /** The manga the dialog acts on (`dialog.manga` of the reference). */
  manga?: Manga[]
  /** `containsLocalManga = dialog.manga.any(Manga::isLocal)`. */
  containsLocalManga?: boolean
}>(), { containsLocalManga: false })

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ (event: 'confirm', deleteManga: boolean, deleteChapters: boolean): void }>()

const titleId = useId()
const bodyId = useId()

/** `CheckboxState.State.None` for both rows: the dialog starts with nothing checked. */
const deleteManga = ref(false)
const deleteChapters = ref(false)

/** The reference composable leaves the composition when the dialog is dismissed, so the
 *  `remember`ed state is recreated (unchecked) every time the dialog opens. */
watch(open, visible => { if (visible) { deleteManga.value = false; deleteChapters.value = false } })

/** `TextButton(enabled = list.any { it.isChecked })`. */
const canConfirm = computed(() => deleteManga.value || deleteChapters.value)

/** The "Downloaded chapters" row only exists when the selection holds no local manga. */
const showChaptersRow = computed(() => !props.containsLocalManga)

/** `TextButton(onClick = { onDismissRequest(); onConfirm(...) })`: dismiss first, confirm after. */
function confirm() {
  if (!canConfirm.value) return
  open.value = false
  emit('confirm', deleteManga.value, deleteChapters.value)
}
</script>

<template>
  <v-dialog
    v-model="open"
    content-class="delete-library-manga-overlay"
    :content-props="{ 'aria-labelledby': titleId, 'aria-describedby': bodyId }"
  >
    <v-card
      rounded="28px"
      color="surface-container-high"
      variant="flat"
      class="delete-library-manga-card"
    >
      <!-- DialogTokens.HeadlineFont = HeadlineSmall (24sp / 32sp, w400) in on-surface. -->
      <h2 :id="titleId" class="delete-library-manga-title">Remove</h2>

      <!-- DialogTokens.SupportingTextFont = BodyMedium (14sp / 20sp) in on-surface-variant. -->
      <div :id="bodyId" class="delete-library-manga-content">
        <!-- LabeledCheckbox: 48dp tall row, 8dp gap, 8dp clipped, the whole row is clickable. -->
        <div
          class="delete-library-manga-row"
          role="checkbox"
          tabindex="0"
          :aria-checked="deleteManga"
          @click="deleteManga = !deleteManga"
          @keydown.enter.prevent="deleteManga = !deleteManga"
          @keydown.space.prevent="deleteManga = !deleteManga"
        >
          <!-- Checkbox: 20dp box inside a 24dp footprint (2dp padding on every side). -->
          <span class="delete-library-manga-checkbox" :class="{ 'is-checked': deleteManga }" aria-hidden="true">
            <svg class="delete-library-manga-check" viewBox="0 0 20 20" focusable="false">
              <polyline points="4,10 8,14 16,6" pathLength="100" />
            </svg>
          </span>
          <span class="delete-library-manga-label">From library</span>
        </div>

        <div
          v-if="showChaptersRow"
          class="delete-library-manga-row"
          role="checkbox"
          tabindex="0"
          :aria-checked="deleteChapters"
          @click="deleteChapters = !deleteChapters"
          @keydown.enter.prevent="deleteChapters = !deleteChapters"
          @keydown.space.prevent="deleteChapters = !deleteChapters"
        >
          <span class="delete-library-manga-checkbox" :class="{ 'is-checked': deleteChapters }" aria-hidden="true">
            <svg class="delete-library-manga-check" viewBox="0 0 20 20" focusable="false">
              <polyline points="4,10 8,14 16,6" pathLength="100" />
            </svg>
          </span>
          <span class="delete-library-manga-label">Downloaded chapters</span>
        </div>
      </div>

      <!--
        Box(align = End) + AlertDialogFlowRow: the flow row flips the layout direction, so the
        confirm button ("OK", declared first) is rendered on the RIGHT and the dismiss button
        ("Cancel") on the LEFT. `row-reverse` reproduces that flip in the web layout.
      -->
      <div class="delete-library-manga-actions">
        <button
          type="button"
          class="delete-library-manga-button delete-library-manga-button-confirm"
          :disabled="!canConfirm"
          @click="confirm"
        >OK</button>
        <button type="button" class="delete-library-manga-button" @click="open = false">Cancel</button>
      </div>
    </v-card>
  </v-dialog>
</template>

<style>
/* BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp) around a content sized dialog. */
.v-dialog > .v-overlay__content.delete-library-manga-overlay {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}
/* Compose draws the dialog surface with tonalElevation 0.dp and no shadow elevation. */
.v-dialog > .v-overlay__content.delete-library-manga-overlay > .v-card {
  box-shadow: none;
  border-radius: 28px;
  flex: 0 0 auto;
  align-self: center;
  width: fit-content;
}
</style>

<style scoped>
@layer app-components {
/* Material3 BasicAlertDialog: the container padding is 24dp on every side. */
.delete-library-manga-card {
  box-sizing: border-box;
  padding: 24px;
  max-height: calc(100dvh - 48px);
  overflow-y: auto;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
}

/* DialogTokens.HeadlineFont = HeadlineSmall (24sp / 32sp, w400) in on-surface,
   AlertDialogDefaults.TitlePadding = 16dp bottom. */
.delete-library-manga-title {
  margin: 0 0 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
}

/* DialogTokens.SupportingTextFont = BodyMedium (14sp / 20sp) in on-surface-variant,
   AlertDialogDefaults.textPadding = 24dp bottom. */
.delete-library-manga-content {
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* LabeledCheckbox: Row(clip(shapes.small = 8dp).fillMaxWidth().heightIn(min = 48.dp)
   .clickable(role = Checkbox), spacedBy(padding.small = 8dp)). */
.delete-library-manga-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 48px;
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
/* Compose draws the click indication of the row in the content colour of the label. */
.delete-library-manga-row::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-out;
  pointer-events: none;
}
.delete-library-manga-row:hover::after { opacity: 0.08; }
.delete-library-manga-row:active::after { opacity: 0.12; }
.delete-library-manga-row:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* Checkbox: the Compose canvas is 20dp wide and carries a 2dp padding on every side, so the
   control occupies a 24dp footprint inside the row. */
.delete-library-manga-checkbox {
  position: relative;
  box-sizing: border-box;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  padding: 2px;
}
/* Unchecked: transparent box with a 2dp on-surface-variant outline and a 2dp corner radius. */
.delete-library-manga-checkbox::before {
  content: '';
  display: block;
  box-sizing: border-box;
  width: 20px;
  height: 20px;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
  border-radius: 2px;
  background: transparent;
  transition: background-color 0.1s ease-out, border-color 0.1s ease-out;
}
/* Checked: solid primary box. */
.delete-library-manga-checkbox.is-checked::before {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary));
}
/* Check mark: (4,10) -> (8,14) -> (16,6), 2dp stroke, square caps, on-primary colour. */
.delete-library-manga-check {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  overflow: visible;
  pointer-events: none;
}
.delete-library-manga-check polyline {
  fill: none;
  stroke: rgb(var(--v-theme-on-primary));
  stroke-width: 2;
  stroke-linecap: square;
  stroke-linejoin: miter;
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  transition: stroke-dashoffset 0.2s ease-out;
}
.delete-library-manga-checkbox.is-checked .delete-library-manga-check polyline { stroke-dashoffset: 0; }

/* The label of LabeledCheckbox inherits the bodyMedium style of the dialog text slot. */
.delete-library-manga-label {
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* Box(align = End) + AlertDialogFlowRow(mainAxisSpacing = 8dp, crossAxisSpacing = 8dp).
   The flow row flips the layout direction, so the confirm button ends up on the right. */
.delete-library-manga-actions {
  display: flex;
  flex-direction: row-reverse;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: center;
  gap: 8px;
}

/* Material3 TextButton: 40dp height, 58dp min width, 12dp side padding, CornerFull shape,
   labelLarge (14sp / 20sp, w500) in primary, 8% hover / 10% pressed state layer. */
.delete-library-manga-button {
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
/* ButtonSmallTokens.PressedContainerShape = CornerSmall (8dp) while pressed. */
.delete-library-manga-button:active { border-radius: 8px; }
.delete-library-manga-button::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}
.delete-library-manga-button:hover::after { opacity: 0.08; }
.delete-library-manga-button:active::after { opacity: 0.1; }
.delete-library-manga-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
/* Material3 disabled text button: OnSurface at 38% (DISABLED_ALPHA = 0.38f). */
.delete-library-manga-button:disabled {
  cursor: default;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.38;
  pointer-events: none;
}
}
</style>
