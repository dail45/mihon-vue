<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Category } from '../api/types'
import { deleteCategory } from '../api/categories'
import { apiErrorMessage } from '../api/client'
import { useSuwayomiStore } from '../stores/suwayomi'

/**
 * Pixel-parity port of `CategoryDeleteDialog` in
 * mihon/app/src/main/java/eu/kanade/presentation/category/components/CategoryDialogs.kt:158-186
 *
 *   @Composable
 *   fun CategoryDeleteDialog(
 *       onDismissRequest: () -> Unit,
 *       onDelete: () -> Unit,
 *       category: String,
 *   ) {
 *       AlertDialog(
 *           onDismissRequest = onDismissRequest,
 *           confirmButton = {
 *               TextButton(onClick = { onDelete(); onDismissRequest() }) {
 *                   Text(text = stringResource(MR.strings.action_ok))
 *               }
 *           },
 *           dismissButton = {
 *               TextButton(onClick = onDismissRequest) {
 *                   Text(text = stringResource(MR.strings.action_cancel))
 *               }
 *           },
 *           title = {
 *               Text(text = stringResource(MR.strings.delete_category))
 *           },
 *           text = {
 *               Text(text = stringResource(MR.strings.delete_category_confirmation, category))
 *           },
 *       )
 *   }
 *
 * Call site (mihon/app/src/main/java/eu/kanade/tachiyomi/ui/category/CategoryScreen.kt:64-69):
 *   is CategoryDialog.Delete -> {
 *       CategoryDeleteDialog(
 *           onDismissRequest = viewModel::dismissDialog,
 *           onDelete = { viewModel.deleteCategory(dialog.category.id) },
 *           category = dialog.category.name,
 *       )
 *   }
 *
 * Strings (mihon/i18n/src/commonMain/moko-resources/base/strings.xml):
 *   delete_category            = "Delete category" (L100)
 *   delete_category_confirmation = "Do you wish to delete the category \"%s\"?" (L99)
 *   action_ok                  = "OK"   (L137)
 *   action_cancel              = "Cancel" (L136)
 *   internal_error             = "InternalError: Check crash logs for further information" (L174)
 *
 * Material3 AlertDialog metrics used here (compose material3 AlertDialog.kt, DialogTokens.kt,
 * Button.kt):
 * - shape = CornerExtraLarge (28dp), container = surface-container-high, tonalElevation 0dp,
 *   container elevation = Level3 (0 4px 8px 3px / 0 1px 3px 0).
 * - container padding 24dp on all sides, title bottom padding 16dp, text bottom padding 24dp.
 * - title = headlineSmall (24sp / 32sp, weight 400) in on-surface.
 * - text = bodyMedium (14sp / 20sp, letterSpacing 0.0178571429em) in on-surface-variant.
 * - buttons = labelLarge (14sp / 20sp, weight 500, letterSpacing 0.0071428571em) in primary.
 * - dialog pane: min width 280dp, max width 560dp; the pane hugs the text.
 * - the button row is a FlowRow that is right aligned; the confirm button is composed first and
 *   the row direction is flipped, so visually the row reads [Cancel] [OK].
 *
 * Behaviour parity:
 * - Mihon dismisses the dialog right after the delete is requested (CategoryDialogs.kt:167-170),
 *   so the web port closes the dialog immediately as well and reports a failure afterwards.
 * - Mihon reports a failed delete with an Android toast carrying `internal_error`
 *   (CategoryScreen.kt:73-79, CategoryViewModel.kt:71-79). The web port shows the same message
 *   in an MD3 snackbar.
 * - The dialog holds no input, so it does not request focus (no FocusRequester in the reference).
 */
const open = defineModel<boolean>({ required: true })

const props = withDefaults(
  defineProps<{
    /** The category that is about to be deleted. */
    category?: Category | null
    /** Suwayomi API URL. When set, the component performs the deletion itself. */
    apiUrl?: string
  }>(),
  { category: null, apiUrl: undefined },
)

const emit = defineEmits<{ (event: 'deleted', category: Category): void }>()

const server = useSuwayomiStore()

/** Suwayomi keeps the default (uncategorized) category under id 0, the same id Mihon uses for
 *  its system category, and both applications hide it from the list. */
const SYSTEM_CATEGORY_ID = 0

const deleting = ref(false)
const snackbar = ref('')
let snackbarTimer: ReturnType<typeof setTimeout> | undefined

const apiUrl = computed(() => props.apiUrl ?? server.apiUrl)

/** stringResource(MR.strings.delete_category_confirmation, category) */
const message = computed(() =>
  props.category ? `Do you wish to delete the category "${props.category.name}"?` : '',
)

watch(open, value => {
  if (!value) return
  deleting.value = false
  snackbar.value = ''
})

function showSnackbar(message: string) {
  snackbar.value = message
  if (snackbarTimer) clearTimeout(snackbarTimer)
  snackbarTimer = setTimeout(() => { snackbar.value = '' }, 4000)
}

function dismiss() {
  /* TextButton(onClick = onDismissRequest) */
  if (deleting.value) return
  open.value = false
}

async function confirm() {
  const category = props.category
  if (!category || deleting.value) return
  /* TextButton(onClick = { onDelete(); onDismissRequest() }) - Mihon dismisses first. */
  open.value = false
  if (category.id === SYSTEM_CATEGORY_ID) {
    showSnackbar('InternalError: the default category cannot be deleted.')
    return
  }
  if (!apiUrl.value) {
    // The host owns the mutation.
    emit('deleted', category)
    return
  }
  deleting.value = true
  try {
    /* Suwayomi-Server: DELETE /api/v1/category/{categoryId} -> Category.removeCategory(userId,
       categoryId), HTTP 200 (Suwayomi CategoryController.categoryDelete). */
    await deleteCategory(apiUrl.value, category.id)
    server.categories = server.categories.filter(item => item.id !== category.id)
    emit('deleted', category)
  } catch (error) {
    /* Mihon reports the failure with a toast carrying `internal_error`
       ("InternalError: Check crash logs for further information"). The web port keeps the
       `internal_error` wording and points at the server logs instead of the crash logs. */
    showSnackbar(`InternalError: could not delete the category. ${apiErrorMessage(error)}`)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="560" aria-labelledby="category-delete-title">
    <div class="category-delete-dialog">
      <!-- DialogTokens.HeadlineFont = HeadlineSmall (24sp/32sp, w400), HeadlineColor = OnSurface. -->
      <h2 id="category-delete-title" class="category-delete-title">Delete category</h2>

      <!-- AlertDialogDefaults.textPadding = 24dp bottom below the text slot. -->
      <p class="category-delete-text">{{ message }}</p>

      <!-- Box(align = End) + AlertDialogFlowRow: the confirm button is composed first and the
           layout direction is flipped, so "OK" ends up rightmost and "Cancel" to its left. -->
      <div class="category-delete-actions">
        <button type="button" class="category-delete-button" @click="confirm">OK</button>
        <button type="button" class="category-delete-button" @click="dismiss">Cancel</button>
      </div>
    </div>
  </v-dialog>
  <div v-if="snackbar" class="category-delete-snackbar" role="status" aria-live="polite">
    {{ snackbar }}
  </div>
</template>

<style scoped>
@layer app-components {
  /* Surface: DialogTokens.ContainerColor = SurfaceContainerHigh, ContainerShape = CornerExtraLarge
     (28dp), ContainerElevation = Level3, container padding 24dp, min width 280dp / max width 560dp. */
  .category-delete-dialog {
    box-sizing: border-box;
    width: fit-content;
    min-width: min(280px, calc(100vw - 48px));
    max-width: min(560px, calc(100vw - 48px));
    margin: 0 auto;
    padding: 24px;
    border-radius: 28px;
    background: rgb(var(--v-theme-surface-container-high));
    color: rgb(var(--v-theme-on-surface));
    box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px 0 rgba(0, 0, 0, 0.3);
  }
  /* DialogTokens.HeadlineFont = HeadlineSmall (24sp/32sp, weight 400) in OnSurface. */
  .category-delete-title {
    margin: 0 0 16px;
    font-size: 24px;
    line-height: 32px;
    font-weight: 400;
    letter-spacing: normal;
    color: rgb(var(--v-theme-on-surface));
    text-align: start;
  }
  /* Text slot: bodyMedium (14sp/20sp, tracking 0.0178571429em) in OnSurfaceVariant,
     24dp bottom padding above the action row. */
  .category-delete-text {
    margin: 0 0 24px;
    font-size: 14px;
    line-height: 20px;
    font-weight: 400;
    letter-spacing: 0.0178571429em;
    color: rgb(var(--v-theme-on-surface-variant));
  }

  /* AlertDialogFlowRow flips the layout direction, so the confirm button renders rightmost. */
  .category-delete-actions {
    display: flex;
    flex-direction: row-reverse;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 8px;
    row-gap: 8px;
  }
  /* MD3 TextButton: height 40dp, min width 58dp, content padding 12dp horizontal / 8dp vertical,
     shape = CornerFull (20dp radius at 40dp height), label = labelLarge (14sp/20sp, w500) in primary. */
  .category-delete-button {
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
  .category-delete-button::after {
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
    .category-delete-button:hover::after { opacity: 0.08; }
  }
  .category-delete-button:active::after { opacity: 0.12; }
  .category-delete-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
  .category-delete-button:disabled {
    color: rgb(var(--v-theme-on-surface));
    opacity: 0.38;
    cursor: default;
  }

  /* MD3 snackbar, matching the snackbar used by the other category dialogs. */
  .category-delete-snackbar {
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
}
</style>
