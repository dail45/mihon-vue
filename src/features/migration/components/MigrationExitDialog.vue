<script setup lang="ts">
// Reference: mihon/app/src/main/java/mihon/feature/migration/list/components/MigrationExitDialog.kt
//   androidx.compose.material3.AlertDialog(
//     onDismissRequest = onDismissRequest,
//     title   = Text(stringResource(MR.strings.migrationListScreen_exitDialogTitle)),
//     confirmButton = TextButton(stringResource(MR.strings.migrationListScreen_exitDialog_stopLabel)) { exitMigration() },
//     dismissButton = TextButton(stringResource(MR.strings.migrationListScreen_exitDialog_cancelLabel)) { onDismissRequest() },
//   )
// The reference dialog carries no icon, no supporting text and no extra parameters: only a title
// and two text buttons.
//
// Mihon strings (mihon/i18n/src/commonMain/moko-resources/base/strings.xml:1105-1107):
//   migrationListScreen.exitDialogTitle       = "Stop migrating?"
//   migrationListScreen.exitDialog.stopLabel   = "Stop"
//   migrationListScreen.exitDialog.cancelLabel = "Cancel"
//
// The host is the migration list screen: MigrationListScreen.kt:95-100 renders this dialog for
// MigrationListViewModel.Dialog.Exit with onDismissRequest = viewModel::dismissDialog and
// exitMigration = navigator::pop; the screen also installs BackHandler(true) { viewModel.showExitDialog() }
// (MigrationListScreen.kt:104-106), so the back button opens the dialog instead of leaving the screen.
//
// The plain androidx.compose.material3.AlertDialog is used (not Mihon's custom AlertDialogContent),
// so the geometry is the MD3 default: container shape CornerExtraLarge (28dp), container color
// surfaceContainerHigh, container elevation level 3, container padding 24dp, title padding bottom 16dp,
// title = headlineSmall (24sp/32sp) in onSurface, buttons = labelLarge (14sp/500) in primary,
// button spacing 8dp, dialog min width 280dp / max width 560dp.
// AlertDialogFlowRow composes the confirm button first but flips the layout direction, so on screen
// "Cancel" sits on the left and "Stop" on the right.

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ (event: 'exit'): void }>()

function confirm() {
  // exitMigration in the reference pops the migration screen: the dialog is gone and the screen
  // is left behind, so the web client emits the event and closes the dialog.
  emit('exit')
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="560" scrollable aria-labelledby="migration-exit-title">
    <div class="migration-exit-dialog">
      <!-- DialogTokens.HeadlineFont = HeadlineSmall (24/32, w400), DialogTokens.HeadlineColor = OnSurface, aligned Start. -->
      <h2 id="migration-exit-title" class="migration-exit-title">Stop migrating?</h2>

      <!-- Box(align = End) + AlertDialogFlowRow: confirm first in composition order, rendered rightmost. -->
      <div class="migration-exit-actions">
        <button type="button" class="migration-exit-button migration-exit-button-confirm" @click="confirm">Stop</button>
        <button type="button" class="migration-exit-button" @click="open = false">Cancel</button>
      </div>
    </div>
  </v-dialog>
</template>

<style scoped>
@layer app-components {
  /* Surface: DialogTokens.ContainerColor = SurfaceContainerHigh, DialogTokens.ContainerShape = CornerExtraLarge (28dp),
     DialogTokens.ContainerElevation = Level3, AlertDialogDefaults.dialogPadding = 24dp. */
  .migration-exit-dialog {
    box-sizing: border-box;
    /* The AlertDialog surface wraps its content and is centered in the dialog window. */
    align-self: center;
    width: fit-content;
    /* BasicAlertDialog: sizeIn(minWidth = DialogMinWidth = 280dp, maxWidth = DialogMaxWidth = 560dp).
       The min width is capped by the viewport so the dialog never overflows a narrow screen. */
    min-width: min(280px, calc(100vw - 48px));
    max-width: 560px;
    margin: 0 auto;
    padding: 24px;
    border-radius: 28px;
    background: rgb(var(--v-theme-surface-container-high));
    /* MD3 elevation level 3: key shadow 0 1px 3px 0 @30%, ambient shadow 0 4px 8px 3px @15%. */
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, .3), 0 4px 8px 3px rgba(0, 0, 0, .15);
  }
  .migration-exit-title {
    margin: 0;
    /* TitlePadding = 16dp bottom. */
    padding-bottom: 16px;
    font-size: 24px;
    line-height: 32px;
    font-weight: 400;
    color: rgb(var(--v-theme-on-surface));
    text-align: start;
  }
  /* AlertDialogFlowRow flips the layout direction, so the confirm button renders rightmost. */
  .migration-exit-actions { display: flex; flex-direction: row-reverse; flex-wrap: wrap; justify-content: flex-start; gap: 8px; row-gap: 8px; }
  /* MD3 TextButton: height 40dp (ButtonSmallTokens.ContainerHeight), min width 58dp,
     content padding 12dp horizontal, shape = CornerFull (20dp),
     label = labelLarge (14sp/20sp, w500) in primary (DialogTokens.ActionLabelTextColor). */
  .migration-exit-button {
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
    cursor: pointer;
    transition: border-radius 0.1s ease-in-out;
  }
  .migration-exit-button:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
  .migration-exit-button:active { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 10%, transparent); border-radius: 4px; }
  .migration-exit-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
}
</style>
