<script setup lang="ts">
import { computed } from 'vue'

// Reference: mihon/app/src/main/java/mihon/feature/migration/list/components/MigrationMangaDialog.kt
//   androidx.compose.material3.AlertDialog(
//     onDismissRequest,
//     title = Text(pluralStringResource(copy ? copyTitle : migrateTitle, count = totalCount, totalCount)),
//     text  = if (skippedCount > 0) Text(pluralStringResource(skipText, count = skippedCount, skippedCount)),
//     confirmButton = TextButton(copy ? copyLabel : migrateLabel) { onMigrate() },
//     dismissButton = TextButton(cancelLabel) { onDismissRequest() },
//   )
// Called from MigrationListScreen.kt with MigrationListViewModel.Dialog.Migrate(copy, totalCount, skippedCount).
// The Mihon strings (mihon/i18n/src/commonMain/moko-resources/base/plurals.xml:100-111 and
// strings.xml:1108-1110):
//   migrateTitle: one "Migrate %1$d entry?" / other "Migrate %1$d entries?"
//   copyTitle:    one "Copy %1$d entry?"    / other "Copy %1$d entries?"
//   skipText:     one "An entry was skipped" / other "%1$d entries were skipped"
//   migrateLabel "Migrate", copyLabel "Copy", cancelLabel "Cancel".
//
// The plain androidx.compose.material3.AlertDialog is used (not Mihon's custom AlertDialogContent),
// so the geometry is the MD3 default: container shape CornerExtraLarge (28dp), container color
// surfaceContainerHigh, container elevation level 3, container padding 24dp, title padding bottom 16dp,
// text padding bottom 24dp, title = headlineSmall (24sp/32sp) in onSurface, body = bodyMedium
// (14sp/20sp) in onSurfaceVariant, buttons = labelLarge (14sp/500) in primary, button spacing 8dp,
// dialog min width 280dp / max width 560dp.
// AlertDialogFlowRow composes the confirm button first but flips the layout direction, so on screen
// "Cancel" sits on the left and "Migrate"/"Copy" on the right.

const open = defineModel<boolean>({ required: true })
const props = withDefaults(
  defineProps<{
    /** MigrationListViewModel.Dialog.Migrate.copy — true for the copy action, false for migrate. */
    copy?: boolean
    /** MigrationListViewModel.Dialog.Migrate.totalCount — number of entries to migrate. */
    totalCount: number
    /** MigrationListViewModel.Dialog.Migrate.skippedCount — entries whose source was not found. */
    skippedCount?: number
    /**
     * Whether the host can actually run the migration. Suwayomi-Server exposes no migration
     * endpoint, so the body slot shows the "not supported" notice and the confirm action is a
     * no-op unless the host opts in.
     */
    supported?: boolean
  }>(),
  { copy: false, skippedCount: 0, supported: false },
)
const emit = defineEmits<{ (event: 'migrate'): void }>()

// English plural rules: quantity "one" for a count of exactly 1, "other" otherwise.
const title = computed(() => {
  const count = props.totalCount
  const noun = count === 1 ? 'entry' : 'entries'
  const action = props.copy ? 'Copy' : 'Migrate'
  return `${action} ${count} ${noun}?`
})

// The reference renders the text slot only when skippedCount > 0.
const skippedText = computed(() => {
  const count = props.skippedCount
  if (count <= 0) return ''
  return count === 1 ? 'An entry was skipped' : `${count} entries were skipped`
})

const confirmLabel = computed(() => (props.copy ? 'Copy' : 'Migrate'))

/**
 * Suwayomi-Server's REST v1 API (pinned revision e2ce828) has no endpoint that migrates or copies
 * entries between sources, so the web client cannot perform the action the reference performs.
 * The dialog still opens and looks like the reference; the body slot states the limitation
 * instead of silently doing nothing.
 */
const unsupportedText =
  'Migration is not supported in the web version: the Suwayomi REST API has no endpoint that migrates or copies entries between sources.'

function confirm() {
  if (!props.supported) {
    // The limitation is already stated in the body slot; the dialog stays open so the notice
    // stays visible and the entry can be dismissed with "Cancel".
    return
  }
  emit('migrate')
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="560" aria-labelledby="migrate-manga-title" aria-describedby="migrate-manga-text">
    <div class="migrate-manga-dialog">
      <!-- DialogTokens.HeadlineFont = HeadlineSmall (24/32, w400), HeadlineColor = OnSurface, aligned Start. -->
      <h2 id="migrate-manga-title" class="migrate-manga-title">{{ title }}</h2>

      <!-- DialogTokens.SupportingTextFont = BodyMedium (14/20, w400), SupportingTextColor = OnSurfaceVariant.
           The reference keeps the text slot empty when nothing was skipped, but the slot itself
           (and its 24dp bottom padding) is always present. -->
      <div id="migrate-manga-text" class="migrate-manga-content">
        <p v-if="skippedText" class="migrate-manga-text">{{ skippedText }}</p>
        <p v-if="!supported" class="migrate-manga-unsupported" role="alert">{{ unsupportedText }}</p>
      </div>

      <!-- Box(align = End) + AlertDialogFlowRow: confirm first in composition order, rendered rightmost. -->
      <div class="migrate-manga-actions">
        <button type="button" class="migrate-manga-button migrate-manga-button-confirm" @click="confirm">{{ confirmLabel }}</button>
        <button type="button" class="migrate-manga-button" @click="open = false">Cancel</button>
      </div>
    </div>
  </v-dialog>
</template>

<style scoped>
@layer app-components {
  /* Surface: DialogTokens.ContainerColor = SurfaceContainerHigh, ContainerShape = CornerExtraLarge (28dp),
     ContainerElevation = Level3, container padding 24dp. */
  .migrate-manga-dialog {
    box-sizing: border-box;
    /* The AlertDialog surface wraps its content and is centered in the dialog window. */
    align-self: center;
    width: fit-content;
    /* BasicAlertDialog: sizeIn(minWidth = DialogMinWidth = 280dp, maxWidth = DialogMaxWidth = 560dp). */
    min-width: 280px;
    max-width: 560px;
    margin: 0 auto;
    padding: 24px;
    border-radius: 28px;
    background: rgb(var(--v-theme-surface-container-high));
    /* MD3 elevation level 3: key shadow 0 1px 3px 0 @30%, ambient shadow 0 4px 8px 3px @15%. */
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, .3), 0 4px 8px 3px rgba(0, 0, 0, .15);
  }
  .migrate-manga-title {
    margin: 0;
    /* TitlePadding = 16dp bottom. */
    padding-bottom: 16px;
    font-size: 24px;
    line-height: 32px;
    font-weight: 400;
    letter-spacing: 0;
    color: rgb(var(--v-theme-on-surface));
    text-align: start;
  }
  /* AlertDialogDefaults.TextPadding = 24dp bottom. The reference always composes the text slot
     (empty when nothing was skipped), and the slot box keeps its 24dp bottom padding, so the gap
     between the title/empty text and the button row is always present. */
  .migrate-manga-content { display: flex; flex-direction: column; gap: 8px; padding-bottom: 24px; }
  .migrate-manga-text {
    margin: 0;
    font-size: 14px;
    line-height: 20px;
    font-weight: 400;
    /* BodyMedium letter spacing = 0.25sp. */
    letter-spacing: .25px;
    color: rgb(var(--v-theme-on-surface-variant));
  }
  .migrate-manga-unsupported {
    margin: 0;
    font-size: 14px;
    line-height: 20px;
    font-weight: 400;
    letter-spacing: .25px;
    color: rgb(var(--v-theme-error));
  }
  /* AlertDialogFlowRow flips the layout direction, so the confirm button renders rightmost. */
  .migrate-manga-actions { display: flex; flex-direction: row-reverse; flex-wrap: wrap; justify-content: flex-start; gap: 8px; row-gap: 8px; }
  /* MD3 TextButton: height 40dp, min width 58dp, content padding 12dp horizontal,
     shape = CornerFull (20dp), label = labelLarge (14sp/20sp, w500) in primary. */
  .migrate-manga-button {
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
    /* labelLarge letter spacing = 0.1sp. */
    letter-spacing: .1px;
    cursor: pointer;
  }
  .migrate-manga-button:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
  .migrate-manga-button:active { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 10%, transparent); }
  .migrate-manga-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
  /* Narrow viewports: the 280dp dialog minimum is dropped below the 280dp + 2 * 24dp container
     padding, so the dialog never overflows the window. */
  @media (max-width: 328px) {
    .migrate-manga-dialog { min-width: 0; max-width: 100%; }
  }
}
</style>
