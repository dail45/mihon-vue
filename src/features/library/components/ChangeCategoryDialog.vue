<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  categoryVisualName,
  nextCategorySelection,
  selectionCategories,
  type CategorySelection,
} from '@/core/utils/categorySelection'

/**
 * Pixel-parity port of `ChangeCategoryDialog` in
 * mihon/app/src/main/java/eu/kanade/presentation/category/components/CategoryDialogs.kt:189-295
 *
 *   @Composable
 *   fun ChangeCategoryDialog(
 *       initialSelection: List<CheckboxState<Category>>,
 *       onDismissRequest: () -> Unit,
 *       onEditCategories: () -> Unit,
 *       onConfirm: (List<Long>, List<Long>) -> Unit,
 *   ) {
 *       if (initialSelection.isEmpty()) {
 *           AlertDialog(
 *               onDismissRequest = onDismissRequest,
 *               confirmButton = {
 *                   tachiyomi...TextButton(onClick = { onDismissRequest(); onEditCategories() }) {
 *                       Text(text = stringResource(MR.strings.action_edit_categories))
 *                   }
 *               },
 *               title = { Text(text = stringResource(MR.strings.action_move_category)) },
 *               text = { Text(text = stringResource(MR.strings.information_empty_category_dialog)) },
 *           )
 *           return
 *       }
 *       var selection by remember { mutableStateOf(initialSelection) }
 *       AlertDialog(
 *           onDismissRequest = onDismissRequest,
 *           confirmButton = {
 *               Row {
 *                   tachiyomi...TextButton(onClick = { onDismissRequest(); onEditCategories() }) {
 *                       Text(text = stringResource(MR.strings.action_edit))
 *                   }
 *                   Spacer(modifier = Modifier.weight(1f))
 *                   tachiyomi...TextButton(onClick = onDismissRequest) {
 *                       Text(text = stringResource(MR.strings.action_cancel))
 *                   }
 *                   tachiyomi...TextButton(
 *                       onClick = {
 *                           onDismissRequest()
 *                           onConfirm(
 *                               selection.filter { it is CheckboxState.State.Checked || it is CheckboxState.TriState.Include }.map { it.value.id },
 *                               selection.filter { it is CheckboxState.State.None || it is CheckboxState.TriState.None }.map { it.value.id },
 *                           )
 *                       },
 *                   ) { Text(text = stringResource(MR.strings.action_ok)) }
 *               }
 *           },
 *           title = { Text(text = stringResource(MR.strings.action_move_category)) },
 *           text = {
 *               Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
 *                   selection.forEach { checkbox ->
 *                       val onChange: (CheckboxState<Category>) -> Unit = { ... }
 *                       Row(
 *                           modifier = Modifier.fillMaxWidth().clickable { onChange(checkbox) },
 *                           verticalAlignment = Alignment.CenterVertically,
 *                       ) {
 *                           when (checkbox) {
 *                               is CheckboxState.TriState -> TriStateCheckbox(state = checkbox.asToggleableState(), onClick = { onChange(checkbox) })
 *                               is CheckboxState.State -> Checkbox(checked = checkbox.isChecked, onCheckedChange = { onChange(checkbox) })
 *                           }
 *                           Text(text = checkbox.value.visualName, modifier = Modifier.padding(horizontal = MaterialTheme.padding.medium))
 *                       }
 *                   }
 *               }
 *           },
 *       )
 *   }
 *
 * Referenced components:
 * - `tachiyomi/presentation/core/components/LabeledCheckbox.kt`:
 *     Row(clip(shapes.small = 8dp).fillMaxWidth().heightIn(min = 48dp).clickable(role = Role.Checkbox),
 *         spacedBy(padding.small = 8dp), verticalAlignment = CenterVertically) {
 *         Checkbox(checked, onCheckedChange = null)
 *         Text(text = label)
 *     }
 * - `tachiyomi/presentation/core/components/material/AlertDialog.kt`:
 *     DialogPadding = 24dp, TitlePadding = 16dp bottom, TextPadding = 24dp bottom,
 *     MinWidth = 280dp, MaxWidth = 560dp, Shape = CornerExtraLarge (28dp).
 *
 * Strings (mihon/i18n/src/commonMain/moko-resources/base/strings.xml):
 *   action_move_category              = "Set categories"                      (L98)
 *   information_empty_category_dialog = "You don't have any categories yet." (L1027)
 *   action_edit_categories            = "Edit categories"                     (L96)
 *   action_edit                       = "Edit"                                (L91)
 *   action_cancel                     = "Cancel"                              (L136)
 *   action_ok                         = "OK"                                  (L137)
 */
const props = defineProps<{ initialSelection: CategorySelection[] }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{
  (event: 'edit-categories'): void
  (event: 'confirm', include: number[], exclude: number[]): void
}>()

// Mihon: `var selection by remember { mutableStateOf(initialSelection) }`
const selection = ref<CategorySelection[]>(props.initialSelection.map(item => ({ ...item })))
watch(open, value => {
  if (value) {
    selection.value = props.initialSelection.map(item => ({ ...item }))
  }
})
watch(
  () => props.initialSelection,
  value => {
    selection.value = value.map(item => ({ ...item }))
  },
  { deep: true },
)

/** Mihon: `if (initialSelection.isEmpty())` -> the "no categories yet" branch. */
const empty = computed(() => props.initialSelection.length === 0)

/** Mihon: CheckboxState.TriState.asToggleableState() -> Exclude = Indeterminate, Include = On. */
function isChecked(item: CategorySelection) {
  return item.kind === 'state' ? item.checked : item.state === 'include'
}
/** Mihon: CheckboxState.TriState.Exclude renders the indeterminate mark. */
function isIndeterminate(item: CategorySelection) {
  return item.kind === 'tri' && item.state === 'exclude'
}

function onChange(index: number) {
  // Mihon: `mutableList[index] = it.next(); selection = mutableList.toList()`
  selection.value = selection.value.map((item, i) => (i === index ? nextCategorySelection(item) : item))
}

function dismiss() {
  open.value = false
}

function onEditCategories() {
  // Mihon: onDismissRequest(); onEditCategories()
  dismiss()
  emit('edit-categories')
}

function onConfirm() {
  // Mihon: onDismissRequest(); onConfirm(include, exclude)
  const { include, exclude } = selectionCategories(selection.value)
  dismiss()
  emit('confirm', include, exclude)
}
</script>

<template>
  <v-dialog
    v-model="open"
    max-width="560"
    :class="['change-category-dialog', { 'change-category-dialog--full': !empty }]"
    :aria-label="empty ? 'Set categories' : undefined"
    :aria-labelledby="!empty ? 'ccd-title' : undefined"
  >
    <div class="ccd-dialog" :class="{ 'ccd-dialog--full': !empty }">
      <!-- Mihon: title = Text(stringResource(MR.strings.action_move_category)) -->
      <h2 id="ccd-title" class="ccd-title">Set categories</h2>

      <!-- Mihon: text = Text(stringResource(MR.strings.information_empty_category_dialog)) -->
      <p v-if="empty" class="ccd-body">You don't have any categories yet.</p>

      <!-- Mihon: Column(Modifier.verticalScroll(rememberScrollState())) of clickable LabeledCheckbox rows -->
      <div v-else class="ccd-list" role="group" aria-label="Categories">
        <div
          v-for="(item, index) in selection"
          :key="item.category.id"
          class="ccd-row"
          role="checkbox"
          tabindex="0"
          :aria-checked="isChecked(item) ? true : isIndeterminate(item) ? 'mixed' : false"
          :aria-label="categoryVisualName(item.category)"
          @click="onChange(index)"
          @keydown.enter.prevent="onChange(index)"
          @keydown.space.prevent="onChange(index)"
        >
          <!--
            Mihon: Checkbox / TriStateCheckbox with 24dp footprint, 20dp box, 2dp stroke and corner radius.
            In LabeledCheckbox, click is handled on the row level without separate clickable node.
          -->
          <span class="ccd-checkbox" aria-hidden="true">
            <span
              class="ccd-box"
              :class="{
                'ccd-box--on': isChecked(item),
                'ccd-box--mixed': isIndeterminate(item),
              }"
            >
              <!--
                Mihon Checkbox: (4,10) -> (8,14) -> (16,6) with 2dp square-capped stroke in 20dp canvas.
              -->
              <svg
                v-if="isChecked(item)"
                class="ccd-check"
                viewBox="0 0 20 20"
                focusable="false"
                aria-hidden="true"
              >
                <path
                  d="M4 10 L8 14 L16 6"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="square"
                  stroke-linejoin="miter"
                />
              </svg>
              <!--
                Mihon TriStateCheckbox (Indeterminate / Exclude): horizontal line (4,10) -> (16,10)
                with 2dp square-capped stroke.
              -->
              <svg
                v-else-if="isIndeterminate(item)"
                class="ccd-check"
                viewBox="0 0 20 20"
                focusable="false"
                aria-hidden="true"
              >
                <path
                  d="M4 10 L16 10"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="square"
                />
              </svg>
            </span>
          </span>

          <!-- Mihon: Text(checkbox.value.visualName) in bodyMedium -->
          <span class="ccd-label">{{ categoryVisualName(item.category) }}</span>
        </div>
      </div>

      <div class="ccd-actions" :class="{ 'ccd-actions--end': empty }">
        <template v-if="empty">
          <!-- Mihon: confirmButton = TextButton { onDismissRequest(); onEditCategories() } -->
          <button type="button" class="ccd-button" @click="onEditCategories">Edit categories</button>
        </template>
        <template v-else>
          <!-- Mihon: Row { TextButton(Edit), Spacer(Modifier.weight(1f)), TextButton(Cancel), TextButton(OK) } -->
          <button type="button" class="ccd-button" @click="onEditCategories">Edit</button>
          <span class="ccd-spacer" />
          <button type="button" class="ccd-button" @click="dismiss">Cancel</button>
          <button type="button" class="ccd-button" @click="onConfirm">OK</button>
        </template>
      </div>
    </div>
  </v-dialog>
</template>

<style>
/*
 * Mihon: androidx.compose.material3.AlertDialog + tachiyomi.presentation.core.components.material.AlertDialog
 *   - Container padding: 24dp (DialogPadding = 24.dp)
 *   - Title bottom margin: 16dp (TitlePadding = 16.dp)
 *   - Content bottom margin / Actions top spacing: 24dp (TextPadding = 24.dp)
 *   - Actions bottom padding: 24dp (part of container padding)
 *   - Container shape: CornerExtraLarge (28dp)
 *   - Container color: surfaceContainerHigh
 *   - MinWidth = 280dp, MaxWidth = 560dp
 *   - Title: headlineSmall (24sp / 32sp, w400) on onSurface
 *   - Text / Labels: bodyMedium (14sp / 20sp, w400, letter-spacing 0.0178571429em) on onSurfaceVariant
 *   - Actions: labelLarge (14sp / 20sp, w500, letter-spacing 0.0071428571em) on primary
 *   - LabeledCheckbox: min-height 48dp, 8dp shapes.small clip, 8dp gap
 * Global stylesheet because v-dialog content is teleported to document body.
 */
.change-category-dialog .v-overlay__content {
  min-width: min(280px, calc(100vw - 48px));
  max-width: min(560px, calc(100vw - 48px));
}
.change-category-dialog--full .v-overlay__content {
  width: min(560px, calc(100vw - 48px));
}
.ccd-dialog {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: fit-content;
  margin: 0 auto;
  min-width: min(280px, calc(100vw - 48px));
  max-width: min(560px, calc(100vw - 48px));
  max-height: calc(100vh - 48px);
  padding: 24px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px 0 rgba(0, 0, 0, 0.3);
  overflow: hidden;
}
.ccd-dialog--full {
  width: 100%;
}
/* Mihon: MaterialTheme.typography.headlineSmall, content color onSurface. */
.ccd-title {
  flex: none;
  margin: 0 0 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
}
/* Mihon: MaterialTheme.typography.bodyMedium, content color onSurfaceVariant. */
.ccd-body {
  flex: none;
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}
/* Mihon: Column(Modifier.verticalScroll(rememberScrollState())) inside the dialog text slot. */
.ccd-list {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  margin-bottom: 24px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--v-theme-on-surface-variant), 0.38) transparent;
}
.ccd-list::-webkit-scrollbar {
  width: 4px;
}
.ccd-list::-webkit-scrollbar-track {
  background: transparent;
}
.ccd-list::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface-variant), 0.38);
  border-radius: 4px;
}
/*
 * LabeledCheckbox (tachiyomi/presentation/core/components/LabeledCheckbox.kt):
 * Row(clip(shapes.small = 8dp).fillMaxWidth().heightIn(min = 48dp).clickable(role = Role.Checkbox),
 *     spacedBy(padding.small = 8dp), verticalAlignment = CenterVertically)
 */
.ccd-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 48px;
  padding: 0;
  border-radius: 8px;
  color: rgb(var(--v-theme-on-surface-variant));
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
}
/* Compose ripple/state-layer bounded by the 8dp clipped row in onSurfaceVariant. */
.ccd-row::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.15s ease-in-out;
  pointer-events: none;
}
.ccd-row:hover::after {
  opacity: 0.08;
}
.ccd-row:active::after {
  opacity: 0.12;
}
.ccd-row:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
/* Checkbox slot: 24dp footprint, 20dp box with 2dp border and 2dp radius. */
.ccd-checkbox {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  pointer-events: none;
}
.ccd-box {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  /* Unchecked outline = onSurfaceVariant, 2dp stroke; checked = primary fill. */
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
  border-radius: 2px;
  background: transparent;
  color: rgb(var(--v-theme-on-primary));
  transition: background-color 0.12s ease-in-out, border-color 0.12s ease-in-out;
}
.ccd-box--on,
.ccd-box--mixed {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary));
}
.ccd-check {
  display: block;
  width: 20px;
  height: 20px;
  overflow: visible;
  pointer-events: none;
}
/* Label: bodyMedium typography, inherits onSurfaceVariant. */
.ccd-label {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: inherit;
  word-break: break-word;
}
/*
 * Actions block:
 * - Empty state: lone "Edit categories" button right-aligned (justify-content: flex-end)
 * - Non-empty state: Row { TextButton(Edit), Spacer(1f), TextButton(Cancel), TextButton(OK) }
 *   with 8dp gap between buttons
 */
.ccd-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}
.ccd-actions--end {
  justify-content: flex-end;
}
.ccd-spacer {
  flex: 1 1 auto;
}
/* tachiyomi TextButton: transparent, primary, labelLarge, 58x40dp min, 20dp pill shape. */
.ccd-button {
  position: relative;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  min-height: 40px;
  padding: 8px 12px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.0071428571em;
  text-align: center;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.ccd-button::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: rgb(var(--v-theme-primary));
  opacity: 0;
  transition: opacity 0.12s ease-in-out;
  pointer-events: none;
}
.ccd-button:hover::before {
  opacity: 0.08;
}
.ccd-button:active::before {
  opacity: 0.12;
}
.ccd-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
</style>
