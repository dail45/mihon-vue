<script setup lang="ts">
/**
 * Mihon reference (pinned commit 446f6df):
 * mihon/app/src/main/java/eu/kanade/presentation/browse/ExtensionsScreen.kt
 *   -> `private fun ExtensionTrustDialog(onClickConfirm, onClickDismiss, onDismissRequest)`
 *      (lines 623-648), opened from lines 265-289 when the tapped extension is
 *      `Extension.NotLoaded.Reason.Untrusted`.
 *
 * androidx.compose.material3.AlertDialog with:
 *   title         = Text(MR.strings.untrusted_extension)       -> "Untrusted extension"
 *   text          = Text(MR.strings.untrusted_extension_message)
 *   confirmButton = TextButton(MR.strings.ext_trust)           -> "Trust"
 *   dismissButton = TextButton(MR.strings.ext_uninstall)       -> "Uninstall"
 *   onDismissRequest = onDismissRequest (tap outside / back closes the dialog only)
 *
 * Base-locale strings: mihon/i18n/src/commonMain/moko-resources/base/strings.xml
 *   (lines 352 `ext_trust`, 364 `ext_uninstall`, 368 `untrusted_extension`,
 *   369 `untrusted_extension_message`).
 *
 * Stock MD3 `AlertDialog` layout (androidx.compose.material3.AlertDialogImpl /
 * AlertDialogContent, androidx-main):
 *   Surface(containerColor = surfaceContainerHigh, shape = CornerExtraLarge 28dp,
 *           tonalElevation = 0.dp, shadowElevation = 0.dp)
 *     Column(padding(all = 24.dp))
 *       title Box(padding(bottom = 16.dp), align = Start)  -> DialogTokens.HeadlineFont (HeadlineSmall)
 *       text  Box(padding(bottom = 24.dp), align = Start)  -> DialogTokens.SupportingTextFont (BodyMedium)
 *       buttons Box(align = End) -> AlertDialogFlowRow(mainAxisSpacing = 8.dp,
 *                 crossAxisSpacing = 8.dp) with a flipped layout direction, so the confirm
 *                 button (composed first) renders rightmost and the dismiss button to its left.
 *
 * Both actions of the reference install or remove an Android package and mark it trusted in the
 * system package manager. Suwayomi-Server exposes no REST contract for that and the web client is a
 * headless REST client, so the dialog is rendered exactly like the reference and the two actions
 * report that the operation is unavailable in the web version instead of pretending to have
 * changed the extension.
 */
import { computed, ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Name of the untrusted extension, used in the notice only. */
    extensionName?: string | null
  }>(),
  { extensionName: null },
)

const emit = defineEmits<{ (event: 'trust'): void; (event: 'uninstall'): void }>()

/** `open` mirrors Mihon's `notLoadedState` for the untrusted extension. */
const open = defineModel<boolean>({ required: true })

const titleId = useId()
const textId = useId()

/** MR.strings.untrusted_extension */
const TITLE = 'Untrusted extension'
/** MR.strings.untrusted_extension_message */
const MESSAGE = 'Malicious extensions can read any stored login credentials or execute arbitrary code.\n\nBy trusting this extension, you accept these risks.'
/** MR.strings.ext_trust */
const TRUST = 'Trust'
/** MR.strings.ext_uninstall */
const UNINSTALL = 'Uninstall'

const label = computed(() => props.extensionName?.trim() || 'this extension')

/** Inline notice shown instead of performing the package-manager action. */
const notice = ref('')

watch(open, value => {
  if (value) notice.value = ''
})

function trust() {
  emit('trust')
  notice.value = `Trusting "${label.value}" is not supported in the web version. Extensions are installed as Android packages by the Mihon app; manage them on your Suwayomi-Server instead.`
}

function uninstall() {
  emit('uninstall')
  notice.value = `Removing "${label.value}" is not supported in the web version. Suwayomi-Server's REST API has no extension management endpoint.`
}
</script>

<template>
  <v-dialog
    v-model="open"
    content-class="ext-trust-overlay"
    :content-props="{ 'aria-labelledby': titleId, 'aria-describedby': textId }"
  >
    <v-card class="ext-trust-card" color="surface-container-high" rounded="28px">
      <!-- DialogTokens.HeadlineFont = HeadlineSmall (24/32, w400); DialogTokens.HeadlineColor = OnSurface. -->
      <h2 :id="titleId" class="ext-trust-title">{{ TITLE }}</h2>

      <!-- AlertDialogDefaults.textPadding = 24dp bottom; the text slot holds the supporting text. -->
      <div class="ext-trust-content">
        <!-- DialogTokens.SupportingTextFont = BodyMedium (14/20, w400); DialogTokens.SupportingTextColor = OnSurfaceVariant. -->
        <p :id="textId" class="ext-trust-text">{{ MESSAGE }}</p>

        <!-- The Android package-manager action is unavailable in the web version. -->
        <p v-if="notice" class="ext-trust-unsupported" role="alert">{{ notice }}</p>
      </div>

      <!-- Box(align = End) + AlertDialogFlowRow: the confirm button is the first child and renders rightmost. -->
      <div class="ext-trust-actions">
        <button type="button" class="ext-trust-button" @click="trust">{{ TRUST }}</button>
        <button type="button" class="ext-trust-button" @click="uninstall">{{ UNINSTALL }}</button>
      </div>
    </v-card>
  </v-dialog>
</template>

<style>
/* Material3 BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp) around a content sized
   dialog. The Vuetify overlay content is stretched by default and has to be constrained here. */
.v-dialog > .ext-trust-overlay {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}
/* Compose draws the dialog surface with tonalElevation = 0.dp and without a shadow elevation,
   so the alert dialog has no drop shadow. */
.v-dialog > .ext-trust-overlay > .ext-trust-card { box-shadow: none; }
</style>

<style scoped>
@layer app-components {
/* Surface: DialogTokens.ContainerColor = SurfaceContainerHigh, DialogTokens.ContainerShape =
   CornerExtraLarge (28dp), DialogTokens.ContainerElevation = ElevationTokens.Level3, container
   padding 24dp, min width 280dp / max width 560dp. */
.ext-trust-card {
  padding: 24px;
  overflow-y: auto;
  max-height: calc(100dvh - 48px);
}
/* Title slot: DialogTokens.HeadlineFont = HeadlineSmall (24sp / 32sp, weight 400, letter spacing 0)
   in DialogTokens.HeadlineColor (onSurface). The title box adds 16dp of bottom padding. */
.ext-trust-title {
  margin: 0 0 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
  text-align: start;
}
/* AlertDialogDefaults.textPadding = 24dp bottom. */
.ext-trust-content { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
/* DialogTokens.SupportingTextFont = BodyMedium (14sp / 20sp, weight 400, letter spacing 0.25sp)
   in DialogTokens.SupportingTextColor (onSurfaceVariant). */
.ext-trust-text {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: pre-line;
}
/* Inline notice for the unavailable package-manager action: BodyMedium in the error colour. */
.ext-trust-unsupported {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-error));
}
/* AlertDialogFlowRow flips the layout direction, so the confirm button renders rightmost.
   Row-reverse keeps the confirm button first in the accessibility order. */
.ext-trust-actions { display: flex; flex-direction: row-reverse; flex-wrap: wrap; justify-content: flex-start; gap: 8px; row-gap: 8px; }
/* MD3 text button: 40dp height, min width 58dp (ButtonDefaults.MinWidth), 12dp side padding
   (ButtonDefaults.TextButtonContentPadding), full 20dp shape, LabelLarge (14/20, w500), primary. */
.ext-trust-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  min-width: 58px;
  padding: 0 12px;
  border: 0;
  border-radius: 20px;
  background: none;
  color: rgb(var(--v-theme-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  cursor: pointer;
}
.ext-trust-button:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
.ext-trust-button:active { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 10%, transparent); }
.ext-trust-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
}
</style>
