<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { renameCategory } from '../api/categoryRename'
import { apiErrorMessage } from '../api/client'
import { useSuwayomiStore } from '../stores/suwayomi'

/**
 * Pixel-parity port of `CategoryRenameDialog` in
 * mihon/app/src/main/java/eu/kanade/presentation/category/components/CategoryDialogs.kt:96-156
 *
 *   @Composable
 *   fun CategoryRenameDialog(
 *       onDismissRequest: () -> Unit,
 *       onRename: (String) -> Unit,
 *       categories: List<String>,
 *       category: String,
 *   ) {
 *       var name by remember { mutableStateOf(category) }
 *       var valueHasChanged by remember { mutableStateOf(false) }
 *       val focusRequester = remember { FocusRequester() }
 *       val nameAlreadyExists = remember(name) { categories.contains(name) }
 *       AlertDialog(
 *           onDismissRequest = onDismissRequest,
 *           confirmButton = {
 *               TextButton(
 *                   enabled = valueHasChanged && name.isNotEmpty() && !nameAlreadyExists,
 *                   onClick = { onRename(name); onDismissRequest() },
 *               ) { Text(text = stringResource(MR.strings.action_ok)) }
 *           },
 *           dismissButton = {
 *               TextButton(onClick = onDismissRequest) { Text(text = stringResource(MR.strings.action_cancel)) }
 *           },
 *           title = { Text(text = stringResource(MR.strings.action_rename_category)) },
 *           text = {
 *               OutlinedTextField(
 *                   modifier = Modifier.focusRequester(focusRequester),
 *                   value = name,
 *                   onValueChange = { valueHasChanged = name != it; name = it },
 *                   label = { Text(text = stringResource(MR.strings.name)) },
 *                   supportingText = {
 *                       val msgRes = if (valueHasChanged && nameAlreadyExists) {
 *                           MR.strings.error_category_exists
 *                       } else {
 *                           MR.strings.information_required_plain
 *                       }
 *                       Text(text = stringResource(msgRes))
 *                   },
 *                   isError = valueHasChanged && nameAlreadyExists,
 *                   singleLine = true,
 *               )
 *           },
 *       )
 *       LaunchedEffect(focusRequester) { focusRequester.requestFocus() }
 *   }
 *
 * Call site (mihon/app/src/main/java/eu/kanade/tachiyomi/ui/category/CategoryScreen.kt:56-63):
 *   CategoryRenameDialog(
 *       onDismissRequest = viewModel::dismissDialog,
 *       onRename = { viewModel.renameCategory(dialog.category, it) },
 *       categories = successState.categories.fastMap { it.name },
 *       category = dialog.category.name,
 *   )
 *
 * Strings (mihon/i18n/src/commonMain/moko-resources/base/strings.xml):
 *   action_rename_category     = "Rename category"  (L97)
 *   name                       = "Name"              (L14)
 *   action_ok                  = "OK"                (L137)
 *   action_cancel              = "Cancel"            (L136)
 *   error_category_exists      = "A category with this name already exists!" (L880)
 *   information_required_plain = "*required"         (L1030)
 *   internal_error             = "InternalError: Check crash logs for further information" (L174)
 *
 * Material3 AlertDialog metrics used here (androidx compose material3 AlertDialog.kt,
 * DialogTokens.kt, Button.kt):
 * - shape = CornerExtraLarge (28dp), container = surface-container-high, tonalElevation 0dp,
 *   container elevation = Level3 (0 4px 8px 3px / 0 1px 3px 0).
 * - container padding 24dp on all sides, title bottom padding 16dp, text bottom padding 24dp.
 * - title = headlineSmall (24sp / 32sp, weight 400) in on-surface.
 * - buttons = labelLarge (14sp / 20sp, weight 500, letterSpacing 0.1sp) in primary.
 * - dialog pane: min width 280dp, max width 560dp; the OutlinedTextField has a minimum width of
 *   280dp, so the pane ends up 280dp + 2 * 24dp of container padding wide.
 * - the button row is a FlowRow that is right aligned; the confirm button is composed first and
 *   the row direction is flipped, so visually the row reads [Cancel] [OK].
 *
 * Material3 OutlinedTextField metrics (TextFieldDefaults.kt):
 * - container height 56dp, shape CornerExtraSmall (4dp), outline 1dp (2dp focused, 2dp error),
 *   minimum width 280dp, content padding 16dp horizontal.
 * - label = bodyLarge (16sp/24sp) in onSurfaceVariant while it rests inside the field, and
 *   bodySmall (12sp/16sp) once it floats over the outline notch (primary when focused, error
 *   when invalid), input = bodyLarge (16sp/24sp) in onSurface,
 *   supporting text = bodySmall (12sp/16sp) in onSurfaceVariant (error when invalid).
 *
 * Behaviour parity:
 * - Mihon dismisses the dialog right after the rename is requested (CategoryDialogs.kt:114-117),
 *   so the web port closes the dialog immediately as well and reports a failure afterwards.
 * - Mihon reports a failed rename with an Android toast carrying `internal_error`
 *   (CategoryScreen.kt:73-79, CategoryViewModel.kt:90-97). The web port shows the same message
 *   in an MD3 snackbar.
 * - The reference passes every category name, including the name of the renamed category itself,
 *   so typing the original name back reports "already exists" exactly like in Mihon.
 *
 * Server side: the legacy REST v1 surface has no category mutation endpoints, so a rename is
 * performed through the Suwayomi GraphQL endpoint (mutation updateCategory). The component works
 * in two modes:
 *   - an API URL is available (store or prop): the component performs the rename itself;
 *   - no API URL: the component only reports the requested name through the `rename` event and
 *     the host performs the mutation.
 */
const open = defineModel<boolean>({ required: true })

const props = withDefaults(
  defineProps<{
    /** Suwayomi id of the renamed category. */
    categoryId: number
    /** Current name of the renamed category; the field starts with this value. */
    categoryName: string
    /** Every category name, used for the duplicate check (the reference passes all names). */
    categories?: string[]
    /** Suwayomi API URL. When set, the component performs the rename through GraphQL. */
    apiUrl?: string
  }>(),
  { categories: undefined, apiUrl: undefined },
)

const emit = defineEmits<{ (event: 'rename', name: string): void }>()

const server = useSuwayomiStore()

/** Suwayomi keeps the default (uncategorized) category under id 0, the same id Mihon uses for
 *  its system category, and both applications hide it from the list. */
const SYSTEM_CATEGORY_ID = 0

const name = ref(props.categoryName)
const valueHasChanged = ref(false)
const focused = ref(false)
const saving = ref(false)
const snackbar = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
let snackbarTimer: ReturnType<typeof setTimeout> | undefined

/** remember(name) { categories.contains(name) } — the list contains the category's own name. */
const nameAlreadyExists = computed(() => categoryNames.value.includes(name.value))
/** isError = valueHasChanged && nameAlreadyExists */
const isError = computed(() => valueHasChanged.value && nameAlreadyExists.value)
/** enabled = valueHasChanged && name.isNotEmpty() && !nameAlreadyExists */
const canConfirm = computed(
  () => valueHasChanged.value && name.value !== '' && !nameAlreadyExists.value,
)
const supportingText = computed(() =>
  isError.value ? 'A category with this name already exists!' : '*required',
)
const hasValue = computed(() => name.value !== '')

const categoryNames = computed(() =>
  props.categories?.length
    ? props.categories
    : server.categories
        .filter(category => category.id !== SYSTEM_CATEGORY_ID)
        .map(category => category.name),
)
const apiUrl = computed(() => props.apiUrl ?? server.apiUrl)

watch(open, async value => {
  if (!value) return
  name.value = props.categoryName
  valueHasChanged.value = false
  focused.value = false
  saving.value = false
  snackbar.value = ''
  await nextTick()
  /* LaunchedEffect(focusRequester) { focusRequester.requestFocus() }
     The Vuetify dialog renders its content in a transition, so the input may not be mounted
     yet on the first tick; the focus is requested as soon as the element exists. */
  await focusNameField()
})

/** Requests the focus on the name field, waiting for the dialog content to be mounted. */
async function focusNameField() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const input = nameInput.value
    if (input) {
      input.focus()
      /* The field is selected as a whole in the reference, so the caret lands at the end. */
      const length = input.value.length
      input.setSelectionRange(length, length)
      return
    }
    await new Promise(resolve => setTimeout(resolve, 16))
  }
}

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  valueHasChanged.value = value !== name.value
  name.value = value
}

function showSnackbar(message: string) {
  snackbar.value = message
  if (snackbarTimer) clearTimeout(snackbarTimer)
  snackbarTimer = setTimeout(() => { snackbar.value = '' }, 4000)
}

function dismiss() {
  /* TextButton(onClick = onDismissRequest) - the reference always dismisses the dialog. */
  open.value = false
}

async function confirm() {
  if (!canConfirm.value || saving.value) return
  const requested = name.value
  /* TextButton(onClick = { onRename(name); onDismissRequest() }) - Mihon dismisses first and
     runs the rename in the background, exactly like the reference. */
  open.value = false
  if (!apiUrl.value) {
    // The host owns the mutation.
    emit('rename', requested)
    return
  }
  saving.value = true
  try {
    await renameCategory(apiUrl.value, props.categoryId, requested)
    server.categories = server.categories.map(category =>
      category.id === props.categoryId ? { ...category, name: requested } : category,
    )
    emit('rename', requested)
  } catch (error) {
    /* Mihon reports the failure with a toast carrying `internal_error`
       ("InternalError: Check crash logs for further information"). The web port keeps the
       `internal_error` wording and points at the server logs instead of the crash logs. */
    showSnackbar(`InternalError: could not rename the category. ${apiErrorMessage(error)}`)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="560" aria-labelledby="category-rename-title">
    <div class="category-rename-dialog">
      <!-- DialogTokens.HeadlineFont = HeadlineSmall (24sp/32sp, w400), HeadlineColor = OnSurface. -->
      <h2 id="category-rename-title" class="category-rename-title">Rename category</h2>

      <!-- AlertDialogDefaults.textPadding = 24dp bottom; the text slot holds the OutlinedTextField. -->
      <div class="category-rename-content">
        <div
          class="category-rename-field"
          :class="{ 'is-error': isError, 'is-focused': focused, 'has-value': hasValue }"
        >
          <input
            id="category-rename-name"
            ref="nameInput"
            type="text"
            class="category-rename-input"
            :value="name"
            autocomplete="off"
            :aria-invalid="isError"
            aria-describedby="category-rename-support"
            @input="onInput"
            @focus="focused = true"
            @blur="focused = false"
          />
          <label for="category-rename-name" class="category-rename-label">Name</label>
        </div>
        <p id="category-rename-support" class="category-rename-support" :class="{ 'is-error': isError }">
          {{ supportingText }}
        </p>
      </div>

      <!-- Box(align = End) + AlertDialogFlowRow: the confirm button is composed first and the
           layout direction is flipped, so "OK" ends up rightmost and "Cancel" to its left. -->
      <div class="category-rename-actions">
        <button type="button" class="category-rename-button" :disabled="!canConfirm" @click="confirm">OK</button>
        <button type="button" class="category-rename-button" @click="dismiss">Cancel</button>
      </div>
    </div>
  </v-dialog>
  <div v-if="snackbar" class="category-rename-snackbar" role="status" aria-live="polite">
    {{ snackbar }}
  </div>
</template>

<style scoped>
@layer app-components {
  /* Surface: DialogTokens.ContainerColor = SurfaceContainerHigh, ContainerShape = CornerExtraLarge (28dp),
     ContainerElevation = Level3, container padding 24dp, min width 280dp / max width 560dp. */
  .category-rename-dialog {
    box-sizing: border-box;
    /* The overlay content is a flex row, so the pane has to centre itself instead of
       stretching to the full 560dp of the dialog pane. */
    align-self: center;
    width: fit-content;
    /* The pane hosts a 280dp wide OutlinedTextField plus 2 * 24dp of container padding. */
    min-width: min(328px, calc(100vw - 48px));
    max-width: 560px;
    margin: 0 auto;
    padding: 24px;
    border-radius: 28px;
    background: rgb(var(--v-theme-surface-container-high));
    color: rgb(var(--v-theme-on-surface));
    box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px 0 rgba(0, 0, 0, 0.3);
  }
  .category-rename-title {
    margin: 0 0 16px;
    font-size: 24px;
    line-height: 32px;
    font-weight: 400;
    letter-spacing: normal;
    color: rgb(var(--v-theme-on-surface));
    text-align: start;
  }
  /* AlertDialogDefaults.textPadding = 24dp bottom. */
  .category-rename-content { margin-bottom: 24px; }

  /* Material3 OutlinedTextField: container height 56dp, shape CornerExtraSmall (4dp),
     outline 1dp (2dp focused, 2dp error), minimum width 280dp, floating label over the
     outline notch, input bodyLarge (16sp/24sp), supporting text bodySmall (12sp/16sp). */
  .category-rename-field {
    position: relative;
    min-width: 280px;
  }
  .category-rename-input {
    box-sizing: border-box;
    width: 100%;
    height: 56px;
    /* Resting: the input text is vertically centred (16dp from the top).
       Floating: the text drops below the floated label (24dp from the top). */
    padding: 15px 16px;
    border: 1px solid rgb(var(--v-theme-outline));
    border-radius: 4px;
    background: transparent;
    font-family: inherit;
    font-size: 16px;
    line-height: 24px;
    font-weight: 400;
    letter-spacing: 0.03125em;
    color: rgb(var(--v-theme-on-surface));
    caret-color: rgb(var(--v-theme-primary));
    outline: none;
    transition: border-color 0.15s ease-in-out, border-width 0.15s ease-in-out,
      padding 0.15s ease-in-out;
  }
  .category-rename-field.is-focused .category-rename-input,
  .category-rename-field.has-value .category-rename-input {
    /* Floating state: the input text drops below the floated label. The 2dp outline is
       included in the box, so 22 + 2 = 24dp of top padding and 8dp of bottom padding. */
    padding: 22px 15px 8px;
  }
  .category-rename-field.is-focused .category-rename-input {
    border-color: rgb(var(--v-theme-primary));
    border-width: 2px;
  }
  .category-rename-field.is-error .category-rename-input {
    border-color: rgb(var(--v-theme-error));
    border-width: 2px;
    padding-left: 15px;
  }
  /* The label sits in the outline notch: 4dp gap on each side, aligned with the input start. */
  .category-rename-label {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    padding: 0 4px;
    background: rgb(var(--v-theme-surface-container-high));
    font-size: 16px;
    line-height: 20px;
    font-weight: 400;
    letter-spacing: 0.03125em;
    color: rgb(var(--v-theme-on-surface-variant));
    pointer-events: none;
    transition: top 0.15s ease-in-out, font-size 0.15s ease-in-out, line-height 0.15s ease-in-out,
      color 0.15s ease-in-out;
  }
  .category-rename-field.is-focused .category-rename-label,
  .category-rename-field.has-value .category-rename-label {
    /* The floated label is centred on the top outline of the field, so it straddles the
       1dp/2dp border line instead of sitting inside the box. */
    top: -8px;
    font-size: 12px;
    line-height: 16px;
    letter-spacing: 0.0333333333em;
  }
  /* The label colour follows the MD3 rule: primary while focused, error while invalid and
     on-surface-variant in every other state (resting or floated, focused or not). */
  .category-rename-field.is-focused .category-rename-label { color: rgb(var(--v-theme-primary)); }
  .category-rename-field.is-error .category-rename-label { color: rgb(var(--v-theme-error)); }
  /* Supporting text: bodySmall (12sp/16sp), 4dp above the field, aligned with the input start. */
  .category-rename-support {
    margin: 4px 0 0;
    padding: 0 16px;
    font-size: 12px;
    line-height: 16px;
    font-weight: 400;
    letter-spacing: 0.0333333333em;
    color: rgb(var(--v-theme-on-surface-variant));
  }
  .category-rename-support.is-error { color: rgb(var(--v-theme-error)); }
  /* AlertDialogFlowRow flips the layout direction, so the confirm button renders rightmost. */
  .category-rename-actions {
    display: flex;
    flex-direction: row-reverse;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 8px;
    row-gap: 8px;
  }
  /* MD3 TextButton: height 40dp, min width 58dp, content padding 12dp, shape = CornerFull (20dp),
     label = labelLarge (14sp/20sp, w500) in primary. */
  .category-rename-button {
    position: relative;
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
    cursor: pointer;
    overflow: hidden;
  }
  .category-rename-button::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background-color: currentColor;
    opacity: 0;
    transition: opacity 0.2s ease-in-out;
    pointer-events: none;
  }
  @media (hover: hover) {
    .category-rename-button:hover::after { opacity: 0.08; }
  }
  .category-rename-button:active::after { opacity: 0.12; }
  .category-rename-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
  .category-rename-button:disabled {
    color: rgb(var(--v-theme-on-surface));
    opacity: 0.38;
    cursor: default;
  }

  /* MD3 snackbar, matching the snackbar used by the other category dialogs. */
  .category-rename-snackbar {
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
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.28), 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  /* Narrow viewports: the pane may not exceed the available width, so the fixed 280dp field
     minimum is dropped below the 280dp + 2 * 24dp container padding of the dialog. */
  @media (max-width: 328px) {
    .category-rename-dialog { min-width: 0; max-width: 100%; }
    .category-rename-field { min-width: 0; }
  }
}
</style>
