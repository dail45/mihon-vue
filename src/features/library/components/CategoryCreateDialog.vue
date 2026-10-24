<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { createCategory } from '@/core/api/categoryCreate'
import { apiErrorMessage, createSuwayomiApi } from '@/core/api/client'
import { useSuwayomiStore } from '../stores/suwayomi'
import { t, MR } from '@/core/i18n'

/**
 * Pixel-parity port of `CategoryCreateDialog` in
 * mihon/app/src/main/java/eu/kanade/presentation/category/components/CategoryDialogs.kt:36-94
 *
 *   @Composable
 *   fun CategoryCreateDialog(
 *       onDismissRequest: () -> Unit,
 *       onCreate: (String) -> Unit,
 *       categories: List<String>,
 *   ) {
 *       var name by remember { mutableStateOf("") }
 *       val focusRequester = remember { FocusRequester() }
 *       val nameAlreadyExists = remember(name) { categories.contains(name) }
 *       AlertDialog(
 *           onDismissRequest = onDismissRequest,
 *           confirmButton = {
 *               TextButton(
 *                   enabled = name.isNotEmpty() && !nameAlreadyExists,
 *                   onClick = { onCreate(name); onDismissRequest() },
 *               ) { Text(text = stringResource(MR.strings.action_add)) }
 *           },
 *           dismissButton = {
 *               TextButton(onClick = onDismissRequest) { Text(text = stringResource(MR.strings.action_cancel)) }
 *           },
 *           title = { Text(text = stringResource(MR.strings.action_add_category)) },
 *           text = {
 *               OutlinedTextField(
 *                   modifier = Modifier.focusRequester(focusRequester),
 *                   value = name,
 *                   onValueChange = { name = it },
 *                   label = { Text(text = stringResource(MR.strings.name)) },
 *                   supportingText = {
 *                       val msgRes = if (name.isNotEmpty() && nameAlreadyExists) {
 *                           MR.strings.error_category_exists
 *                       } else {
 *                           MR.strings.information_required_plain
 *                       }
 *                       Text(text = stringResource(msgRes))
 *                   },
 *                   isError = name.isNotEmpty() && nameAlreadyExists,
 *                   singleLine = true,
 *               )
 *           },
 *       )
 *       LaunchedEffect(focusRequester) { focusRequester.requestFocus() }
 *   }
 *
 * Call site (eu/kanade/tachiyomi/ui/category/CategoryScreen.kt:55-62):
 *   categories = successState.categories.fastMap { it.name },  // every visible category name
 *   onCreate   = { viewModel.createCategory(it) },
 *   and the screen filters the system category out:
 *   `categories.filterNot(Category::isSystemCategory)` (CategoryViewModel.kt:58).
 *
 * Strings (mihon/i18n/src/commonMain/moko-resources/base/strings.xml):
 *   action_add_category     = "Add category"  (L95)
 *   name                    = "Name"          (L14)
 *   action_add              = "Add"           (L92)
 *   action_cancel           = "Cancel"        (L136)
 *   error_category_exists   = "A category with this name already exists!" (L880)
 *   information_required_plain = "*required"  (L1030)
 *
 * Material3 AlertDialog metrics used here (androidx compose material3 AlertDialog.kt,
 * DialogTokens.kt):
 * - shape = CornerExtraLarge (28dp), container = surface-container-high, tonalElevation 0dp,
 *   container elevation = Level3 (0 4px 8px 3px / 0 1px 3px 0).
 * - container padding 24dp on all sides, title bottom padding 16dp, text bottom padding 24dp.
 * - title = headlineSmall (24sp / 32sp, weight 400) in on-surface.
 * - text = bodyMedium (14sp / 20sp) in on-surface-variant.
 * - buttons = labelLarge (14sp / 20sp, weight 500, letterSpacing 0.0071428571em) in primary.
 * - dialog pane: min width 280dp, max width 560dp; the OutlinedTextField has a minimum width of
 *   280dp, so the pane ends up 280dp + 2 * 24dp of container padding wide.
 * - the button row is a FlowRow that is right aligned; the confirm button is emitted first and
 *   the row direction is flipped, so visually the row reads [Cancel] [Add].
 *
 * Material3 OutlinedTextField metrics (TextFieldDefaults.kt):
 * - container height 56dp, shape CornerExtraSmall (4dp), outline 1dp (2dp focused, 2dp error),
 *   minimum width 280dp, content padding 16dp horizontal.
 * - label = bodyLarge (16sp/24sp) in onSurfaceVariant while it rests inside the field, and
 *   bodySmall (12sp/16sp) once it floats over the outline notch (primary when focused, error
 *   when invalid), input = bodyLarge (16sp/24sp) in onSurface,
 *   supporting text = bodySmall (12sp/16sp) in onSurfaceVariant (error when invalid).
 *
 * Server side: Suwayomi-Server exposes the legacy REST v1 endpoint
 * `POST /api/v1/category` with the form field `name`
 * (Suwayomi CategoryController.categoryCreate -> Category.createCategory(userId, name),
 * HTTP 200 on success, HTTP 400 when the name is refused). The component works in two modes:
 *   - an API URL is available (store or prop): the component performs the creation itself and
 *     reports a failure with the MD3 snackbar afterwards;
 *   - no API URL: the component only reports the requested name through the `created` event and
 *     the host performs the mutation.
 */
const open = defineModel<boolean>({ required: true })

const props = defineProps<{
  /** Every category name, used for the duplicate check (the reference passes all names). */
  categories?: string[]
  /** Suwayomi API URL. When set, the component performs the creation through REST. */
  apiUrl?: string
}>()

const emit = defineEmits<{ (event: 'created', name: string): void }>()

const server = useSuwayomiStore()

const name = ref('')
const focused = ref(false)
const creating = ref(false)
const nameInput = ref<HTMLInputElement | null>(null)
const snackbar = ref('')
let snackbarTimer: ReturnType<typeof setTimeout> | undefined

/** Suwayomi keeps the default (uncategorized) category under id 0, the same id Mihon uses for
 *  its system category, and both applications hide it from the list. */
const SYSTEM_CATEGORY_ID = 0

/** remember(name) { categories.contains(name) } */
const nameAlreadyExists = computed(() => categoryNames.value.includes(name.value))
/** enabled = name.isNotEmpty() && !nameAlreadyExists */
const canConfirm = computed(() => name.value !== '' && !nameAlreadyExists.value)
/** isError = name.isNotEmpty() && nameAlreadyExists */
const isError = computed(() => name.value !== '' && nameAlreadyExists.value)
const supportingText = computed(() =>
  isError.value ? (t(MR.strings.error_category_exists) || 'A category with this name already exists!') : (t(MR.strings.information_required_plain) || '*required'),
)
const hasValue = computed(() => name.value !== '')

const categoryNames = computed(() =>
  props.categories !== undefined
    ? props.categories
    : server.categories
        .filter(category => category.id !== SYSTEM_CATEGORY_ID)
        .map(category => category.name),
)
const apiUrl = computed(() => props.apiUrl ?? server.apiUrl)

watch(
  open,
  async value => {
    if (!value) {
      name.value = ''
      focused.value = false
      creating.value = false
      return
    }
    name.value = ''
    focused.value = false
    creating.value = false
    snackbar.value = ''
    await nextTick()
    /* LaunchedEffect(focusRequester) { focusRequester.requestFocus() }
       The Vuetify dialog renders its content in a transition, so the input may not be mounted
       yet on the first tick; the focus is requested as soon as the element exists. */
    await focusNameField()
  },
  { immediate: true },
)

/** Requests the focus on the name field, waiting for the dialog content to be mounted. */
async function focusNameField() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const input = nameInput.value
    if (input) {
      input.focus()
      /* The field starts empty in the reference, so the caret lands at the start. */
      input.setSelectionRange(0, 0)
      return
    }
    await new Promise(resolve => setTimeout(resolve, 16))
  }
}

function onInput(event: Event) {
  name.value = (event.target as HTMLInputElement).value
}

function onEnter() {
  if (canConfirm.value) {
    confirm()
  } else if (name.value === '') {
    dismiss()
  }
}

function showSnackbar(message: string) {
  snackbar.value = message
  if (snackbarTimer) clearTimeout(snackbarTimer)
  snackbarTimer = setTimeout(() => { snackbar.value = '' }, 4000)
}

function dismiss() {
  if (creating.value) return
  open.value = false
}

async function confirm() {
  if (!canConfirm.value || creating.value) return
  const requested = name.value
  /* TextButton(onClick = { onCreate(name); onDismissRequest() }) - the dialog is dismissed first
     and the creation runs in the background, exactly like the reference. */
  open.value = false
  if (!apiUrl.value) {
    // The host owns the mutation.
    emit('created', requested)
    return
  }
  creating.value = true
  try {
    await createCategory(apiUrl.value, requested)
    const refreshed = (await createSuwayomiApi(apiUrl.value).categories()).sort(
      (a, b) => a.order - b.order,
    )
    server.categories = refreshed
    if (!refreshed.some(category => category.name === requested)) {
      /* The server silently ignores a name it refuses (for example a duplicate that only
         differs in case, or the reserved name "Default"). */
      showSnackbar('InternalError: the server did not create the category.')
      return
    }
    emit('created', requested)
  } catch (error) {
    /* Mihon reports the failure with a toast carrying `internal_error`
       ("InternalError: Check crash logs for further information"). The web port keeps the
       `internal_error` wording and points at the server logs instead of the crash logs. */
    showSnackbar(`InternalError: could not create the category. ${apiErrorMessage(error)}`)
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <v-dialog
    v-model="open"
    :persistent="creating"
    max-width="560"
    aria-labelledby="category-create-title"
  >
    <form class="category-create-dialog" @submit.prevent="onEnter" @keydown.esc.prevent="dismiss">
      <!-- DialogTokens.HeadlineFont = HeadlineSmall (24sp/32sp, w400), HeadlineColor = OnSurface. -->
      <h2 id="category-create-title" class="category-create-title">{{ t(MR.strings.action_add_category) || 'Add category' }}</h2>

      <!-- AlertDialogDefaults.textPadding = 24dp bottom; the text slot holds the OutlinedTextField. -->
      <div class="category-create-content">
        <div
          class="category-create-field"
          :class="{ 'is-error': isError, 'is-focused': focused, 'has-value': hasValue }"
        >
          <input
            id="category-create-name"
            ref="nameInput"
            type="text"
            class="category-create-input"
            :value="name"
            autocomplete="off"
            autofocus
            :aria-invalid="isError"
            aria-describedby="category-create-support"
            @input="onInput"
            @focus="focused = true"
            @blur="focused = false"
            @keydown.enter.prevent="onEnter"
            @keydown.esc.prevent="dismiss"
          />
          <label for="category-create-name" class="category-create-label">{{ t(MR.strings.name) || 'Name' }}</label>
        </div>
        <p
          id="category-create-support"
          class="category-create-support"
          :class="{ 'is-error': isError }"
        >
          {{ supportingText }}
        </p>
      </div>

      <!-- Box(align = End) + AlertDialogFlowRow: the confirm button is composed first and the
           layout direction is flipped, so "Add" ends up rightmost and "Cancel" to its left. -->
      <div class="category-create-actions">
        <button type="submit" class="category-create-button" :disabled="!canConfirm">
          {{ t(MR.strings.action_add) || 'Add' }}
        </button>
        <button type="button" class="category-create-button" @click="dismiss">{{ t(MR.strings.action_cancel) || 'Cancel' }}</button>
      </div>
    </form>
  </v-dialog>
  <Transition name="snackbar-fade">
    <div v-if="snackbar" class="category-create-snackbar" role="status" aria-live="polite">
      {{ snackbar }}
    </div>
  </Transition>
</template>

<style scoped>
@layer app-components {
  /* Surface: DialogTokens.ContainerColor = SurfaceContainerHigh, ContainerShape = CornerExtraLarge
     (28dp), ContainerElevation = Level3, container padding 24dp, min width 280dp / max width 560dp. */
  .category-create-dialog {
    box-sizing: border-box;
    /* The overlay content is a flex container, so the pane centres itself instead of
       stretching to the full 560dp of the dialog pane. */
    align-self: center;
    width: fit-content;
    /* The pane hosts a 280dp wide OutlinedTextField plus 2 * 24dp of container padding. */
    min-width: min(328px, calc(100vw - 48px));
    max-width: min(560px, calc(100vw - 48px));
    margin: 0 auto;
    padding: 24px;
    border-radius: 28px;
    background: rgb(var(--v-theme-surface-container-high));
    color: rgb(var(--v-theme-on-surface));
    box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px 0 rgba(0, 0, 0, 0.3);
  }
  /* DialogTokens.HeadlineFont = HeadlineSmall (24sp/32sp, weight 400) in OnSurface. */
  .category-create-title {
    margin: 0 0 16px;
    font-size: 24px;
    line-height: 32px;
    font-weight: 400;
    letter-spacing: normal;
    color: rgb(var(--v-theme-on-surface));
    text-align: start;
  }
  /* AlertDialogDefaults.textPadding = 24dp bottom. */
  .category-create-content { margin-bottom: 24px; }

  /* Material3 OutlinedTextField: container height 56dp, shape CornerExtraSmall (4dp),
     outline 1dp (2dp focused, 2dp error), minimum width 280dp, floating label over the
     outline notch, input bodyLarge (16sp/24sp), supporting text bodySmall (12sp/16sp).

     Compose geometry (androidx.compose.material3.internal.TextFieldImpl):
     - `Modifier.topPaddingForLabelCutout` adds a top padding of `minimizedLabelHalfHeight`
       (bodySmall.lineHeight / 2 = 8dp) to the whole field, so the outline starts 8dp below
       the top of the field and the label (16dp tall) straddles the outline, 8dp above and
       8dp below it.
     - The label rests at the start edge (Cutout expandedAlignment = Start) and floats to the
       same start edge (minimizedAlignment = Start + 16dp content padding), so the text of the
       label always starts 16dp from the left border, with a 4dp cutout gap on each side.
     - The single line input text is vertically centred while the label rests and drops below
       the floated label once the field is focused or filled. */
  .category-create-field {
    position: relative;
    min-width: min(280px, calc(100vw - 96px));
    /* `Modifier.topPaddingForLabelCutout` reserves `minimizedLabelHalfHeight`
       (bodySmall.lineHeight / 2 = 8dp) above the outline so the floating label can straddle
       the top border. */
    padding-top: 8px;
  }
  .category-create-input {
    box-sizing: border-box;
    width: 100%;
    height: 56px;
    /* Pristine (empty and unfocused): the label rests inside the field, so the input text is
       vertically centred in the 56dp container (15 + 24 + 15 = 54 = 56 - 2 * 1dp border) and
       16dp from the inner edge of the outline.
       Floating (focused or filled): the label moves into the outline notch and the input text
       drops below it (24dp from the top of the container, 8dp above the bottom). */
    padding: 15px 16px;
    /* TextFieldDefaults.outlinedTextFieldColors: unfocusedBorderColor = colorScheme.outline
       (not outlineVariant), 1dp. Shape: CornerSmall (8dp). */
    border: 1px solid rgb(var(--v-theme-outline));
    border-radius: 8px;
    background: transparent;
    font-family: inherit;
    font-size: 16px;
    line-height: 24px;
    font-weight: 400;
    letter-spacing: 0.03125em;
    color: rgb(var(--v-theme-on-surface));
    caret-color: rgb(var(--v-theme-primary));
    outline: none;
    transition: border-color 0.15s cubic-bezier(0.2, 0, 0, 1),
      border-width 0.15s cubic-bezier(0.2, 0, 0, 1),
      padding 0.15s cubic-bezier(0.2, 0, 0, 1);
  }
  /* Floating / Focused state: the label floats on the top outline, so the input text stays
     vertically centred in the 56dp container. */
  .category-create-field.has-value:not(.is-focused) .category-create-input {
    padding: 15px 16px;
  }
  /* Focused: the outline thickens to 2dp and turns primary. */
  .category-create-field.is-focused .category-create-input {
    padding: 14px 15px;
    border-color: rgb(var(--v-theme-primary));
    border-width: 2px;
  }
  /* The error outline uses the 1dp unfocused thickness until the field is focused; the error
     colour wins over the primary one in every state. */
  .category-create-field.is-error .category-create-input {
    border-color: rgb(var(--v-theme-error));
    /* OutlinedTextFieldTokens.ErrorFocusCaretColor = colorScheme.error. */
    caret-color: rgb(var(--v-theme-error));
  }
  /* The label rests inside the field, aligned with the input start (MD3 keeps the resting
     label at the start, unlike MD2 which centred it), and floats into the outline notch:
     the cutout gap is 4dp on each side and the text of the label starts 16dp from the
     left border. */
  .category-create-label {
    position: absolute;
    /* Resting (expanded) label: aligned with the start of the input text, 16dp from the
       border, so the 4dp cutout padding of the label puts the text at 16dp. */
    left: 12px;
    /* Vertically centred in the 56dp container, which starts 8dp below the top of the field
       (the cutout padding): 8 + (56 - 24) / 2 = 24dp. */
    top: 24px;
    padding: 0 4px;
    /* While the label rests inside the field the outline is continuous, so the label must not
       punch a hole into it. The background only appears when the label floats over the border. */
    background: transparent;
    font-size: 16px;
    line-height: 24px;
    font-weight: 400;
    letter-spacing: 0.03125em;
    color: rgb(var(--v-theme-on-surface-variant));
    pointer-events: none;
    white-space: nowrap;
    transition: top 0.15s cubic-bezier(0.2, 0, 0, 1),
      left 0.15s cubic-bezier(0.2, 0, 0, 1),
      font-size 0.15s cubic-bezier(0.2, 0, 0, 1),
      line-height 0.15s cubic-bezier(0.2, 0, 0, 1),
      color 0.15s cubic-bezier(0.2, 0, 0, 1),
      background-color 0.15s cubic-bezier(0.2, 0, 0, 1);
  }
  .category-create-field.is-focused .category-create-label,
  .category-create-field.has-value .category-create-label {
    /* The floating label straddles the top border of the container: the 8dp cutout padding
       above the border and 8dp below it, with a 4dp gap on each side of the label text
       (OutlinedTextFieldInnerPadding). */
    left: 8px;
    top: 0;
    padding: 0 4px;
    background: rgb(var(--v-theme-surface-container-high));
    font-size: 12px;
    line-height: 16px;
    letter-spacing: 0.0333333333em;
  }
  .category-create-field.is-focused .category-create-label { color: rgb(var(--v-theme-primary)); }
  .category-create-field.is-error .category-create-label { color: rgb(var(--v-theme-error)); }
  /* Supporting text: bodySmall (12sp/16sp), 4dp below the field, aligned with the input
     start (16dp). */
  .category-create-support {
    margin: 4px 0 0;
    padding: 0 16px;
    font-size: 12px;
    line-height: 16px;
    font-weight: 400;
    letter-spacing: 0.0333333333em;
    color: rgb(var(--v-theme-on-surface-variant));
  }
  .category-create-support.is-error { color: rgb(var(--v-theme-error)); }

  /* AlertDialogFlowRow flips the layout direction, so the confirm button renders rightmost. */
  .category-create-actions {
    display: flex;
    flex-direction: row-reverse;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 8px;
    row-gap: 8px;
  }
  /* MD3 TextButton: height 40dp, min width 58dp, content padding 12dp horizontal / 8dp vertical,
     shape = CornerFull (20dp), label = labelLarge (14sp/20sp, w500) in primary. */
  .category-create-button {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    height: 40px;
    min-width: 58px;
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
    cursor: pointer;
    overflow: hidden;
    -webkit-tap-highlight-color: transparent;
  }
  .category-create-button::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background-color: currentColor;
    opacity: 0;
    transition: opacity 0.2s cubic-bezier(0.2, 0, 0, 1);
    pointer-events: none;
  }
  @media (hover: hover) {
    .category-create-button:hover::after { opacity: 0.08; }
  }
  .category-create-button:active::after { opacity: 0.12; }
  .category-create-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
  .category-create-button:disabled {
    color: rgb(var(--v-theme-on-surface));
    opacity: 0.38;
    cursor: default;
  }

  /* MD3 snackbar, matching the snackbar used by the other category dialogs. */
  .category-create-snackbar {
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

  .snackbar-fade-enter-active,
  .snackbar-fade-leave-active {
    transition: opacity 0.2s cubic-bezier(0.2, 0, 0, 1), transform 0.2s cubic-bezier(0.2, 0, 0, 1);
  }
  .snackbar-fade-enter-from,
  .snackbar-fade-leave-to {
    opacity: 0;
    transform: translate(-50%, 8px);
  }
}
</style>
