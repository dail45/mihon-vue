<script setup lang="ts">
/**
 * Pixel-parity port of the extension content warning dialog.
 *
 * References (Mihon, pinned commit 446f6df):
 * - `mihon/app/src/main/java/eu/kanade/presentation/browse/components/ContentWarningLabel.kt`
 *   maps `ContentWarning.SAFE | MIXED | NSFW` to a title, a description and a colour:
 *   MIXED -> `MaterialTheme.colorScheme.primary`, NSFW -> `MaterialTheme.colorScheme.error`.
 *   SAFE has no label at all, so there is no warning entry and no dialog.
 * - `mihon/app/src/main/java/eu/kanade/presentation/browse/ExtensionDetailsScreen.kt:457-480`
 *   (`ContentWarningDialog`) opens a Material 3 `AlertDialog`:
 *     title         = Text(label title, style = MaterialTheme.typography.titleMedium)
 *     text          = Text(label description)          // default bodyMedium
 *     confirmButton = TextButton { Text(MR.strings.action_ok) }   // "OK"
 *     onDismissRequest = onClickConfirm                 // tapping outside closes the dialog
 *
 * Strings (`mihon/i18n/src/commonMain/moko-resources/base/strings.xml`):
 *   ext_content_warning_mixed = "Mixed" (L377), ext_content_warning_nsfw = "18+" (L378),
 *   ext_content_warning_mixed_description (L379),
 *   ext_content_warning_nsfw_description (L380), action_ok = "OK" (L137).
 *
 * Material 3 metrics (androidx.compose.material3.AlertDialog.kt + AlertDialogTokens.kt +
 * DialogTokens.kt + Button.kt):
 * - `BasicAlertDialog` wraps the content in a `Box` with
 *   `sizeIn(minWidth = 280.dp, maxWidth = 560.dp)`: the dialog is as wide as its content,
 *   never narrower than 280dp and never wider than 560dp.
 * - the surface uses the container shape (CornerExtraLarge, 28dp) and the container colour
 *   (surfaceContainerHigh). `AlertDialogContent` renders that `Surface` with a tonal
 *   elevation of 0.dp and no shadow elevation, so the surface has no drop shadow and no
 *   primary tonal overlay.
 * - the inner `Column` is padded by `AlertDialogDefaults.dialogPadding` = 24dp on all sides,
 *   the title box adds 16dp of bottom padding, the text box 24dp of bottom padding and the
 *   button box is aligned to the end of the column.
 * - the title uses the explicit `titleMedium` (16sp / 24sp, weight 500, letter spacing 0.15sp)
 *   in the title content colour (onSurface); the default dialog title style would be
 *   headlineSmall, but Mihon overrides it with titleMedium.
 * - the supporting text uses `bodyMedium` (14sp / 20sp, weight 400, letter spacing 0.25sp)
 *   in the text content colour (onSurfaceVariant).
 * - the confirm button is a `TextButton`: 40dp tall, min width 58dp, 12dp horizontal content
 *   padding, a fully rounded shape (20dp) that morphs to 8dp while pressed, `labelLarge`
 *   typography (14sp / 20sp, weight 500, letter spacing 0.1sp) in the primary colour, with
 *   the Material state layer opacities (hover 8%, focus 10%, pressed 10%).
 *
 * The dialog is purely informational: both the "OK" button and the dismiss request only
 * close it, so the web client needs no server call for it.
 */
import { computed, useId } from 'vue'
import { contentWarningLabel, type ContentWarningLevel } from '@/core/utils/contentWarning'

const props = defineProps<{ warning: ContentWarningLevel | null }>()

/** Mirrors Mihon's `showContentWarning` state. */
const open = defineModel<boolean>({ required: true })

const titleId = useId()
const textId = useId()

/** `ContentWarning.label` is null for SAFE, so SAFE never opens this dialog. */
const label = computed(() => (props.warning ? contentWarningLabel(props.warning) : null))
</script>

<template>
  <v-dialog
    v-if="label"
    v-model="open"
    content-class="content-warning-overlay"
    :content-props="{ 'aria-labelledby': titleId, 'aria-describedby': textId }"
  >
    <v-card class="content-warning-card" color="surface-container-high" rounded="28px">
      <!-- Mihon sets the title style explicitly: titleMedium (16sp / 24sp, weight 500). -->
      <h2 :id="titleId" class="content-warning-title">{{ label.title }}</h2>
      <!-- The supporting text keeps the default bodyMedium of the dialog text slot. -->
      <p :id="textId" class="content-warning-text">{{ label.description }}</p>
      <!-- Box(align = End): the single confirm button sits at the end of the column. -->
      <div class="content-warning-actions">
        <button type="button" class="content-warning-button" @click="open = false">OK</button>
      </div>
    </v-card>
  </v-dialog>
</template>

<style>
/*
 * Material 3 `BasicAlertDialog` constrains the dialog with
 * `sizeIn(minWidth = 280.dp, maxWidth = 560.dp)`. The Vuetify overlay content is stretched
 * by default and has to be constrained here.
 */
.v-dialog > .content-warning-overlay {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}

/*
 * `AlertDialogContent` draws its `Surface` without a shadow elevation and with
 * `tonalElevation = 0.dp`, so the Material 3 alert dialog surface has no drop shadow and
 * keeps the plain surfaceContainerHigh fill. The Vuetify dialog card also stretches to the
 * full overlay height and scrolls, while the Compose surface is content sized and clipped
 * to its 28dp shape.
 */
.v-dialog > .content-warning-overlay > .content-warning-card {
  box-shadow: none;
  flex: 0 0 auto;
  overflow: hidden;
}
</style>

<style scoped>
@layer app-components {
/*
 * Material 3 `AlertDialog` surface: shape = CornerExtraLarge (28dp), container colour =
 * surfaceContainerHigh, container padding 24dp on every side.
 */
.content-warning-card {
  box-sizing: border-box;
  padding: 24px;
  color: rgb(var(--v-theme-on-surface));
}

/*
 * Title slot: Mihon sets `style = MaterialTheme.typography.titleMedium` explicitly
 * (16sp / 24sp, weight 500, letter spacing 0.15sp); the colour is the dialog
 * `titleContentColor` = onSurface. The title box adds 16dp of bottom padding and is
 * aligned to the start of the column.
 */
.content-warning-title {
  margin: 0 0 16px;
  font-family: var(--v-font-body, Roboto, sans-serif);
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  letter-spacing: 0.15px;
  color: rgb(var(--v-theme-on-surface));
  text-align: start;
}

/*
 * Supporting text slot: the default dialog text style = bodyMedium
 * (14sp / 20sp, weight 400, letter spacing 0.25sp), coloured with the dialog
 * `textContentColor` = onSurfaceVariant. The text box adds 24dp of bottom padding.
 */
.content-warning-text {
  margin: 0 0 24px;
  font-family: var(--v-font-body, Roboto, sans-serif);
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface-variant));
}

/*
 * Buttons slot: a `Box` aligned to the end of the column that holds the confirm
 * `TextButton`. `AlertDialogFlowRow` spaces the buttons by 8dp on the main axis.
 */
.content-warning-actions {
  display: flex;
  flex-direction: row-reverse;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 8px;
}

/*
 * Material 3 `TextButton`: container height 40dp, min width 58dp, 12dp horizontal content
 * padding, a fully rounded shape (20dp for a 40dp tall button) and `labelLarge` typography
 * (14sp / 20sp, weight 500, letter spacing 0.1sp) in the primary colour.
 */
.content-warning-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  min-width: 58px;
  padding: 0 12px;
  border: none;
  border-radius: 20px;
  background: transparent;
  font-family: var(--v-font-body, Roboto, sans-serif);
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  text-transform: none;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  overflow: hidden;
  transition: border-radius 0.1s ease-in-out;
}

/* The pressed shape morphs to CornerSmall (8dp), like the Compose button shapes. */
.content-warning-button:active { border-radius: 8px; }

/* Material 3 state layer: 8% on hover, 10% while pressed, 10% on focus. */
.content-warning-button::after {
  content: '';
  position: absolute;
  inset: 0;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}
.content-warning-button:hover::after { opacity: 0.08; }
.content-warning-button:active::after { opacity: 0.1; }
.content-warning-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
}
</style>
