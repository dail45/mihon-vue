<script lang="ts">
/**
 * Mihon reference (pinned commit 446f6df):
 * mihon/app/src/main/java/eu/kanade/presentation/browse/ExtensionsScreen.kt
 *   -> `private fun ExtensionNotLoadedDialog(reason, onClickUninstall, onDismissRequest)`
 *      (lines 572-621), shown from lines 265-288 when the tapped extension is
 *      `Extension.NotLoaded` with a reason other than `Untrusted`.
 *
 * androidx.compose.material3.AlertDialog with:
 *   title   = Text(MR.strings.ext_not_loaded_dialog)        -> "Couldn't load"
 *   text    = Column(Arrangement.spacedBy(padding.small = 8.dp)) {
 *                Text(reason.descriptionRes)                  -> the reason specific message
 *                if (reason is Reason.Failed) {
 *                    Text(reason.message, bodySmall, FontFamily.Monospace, onSurfaceVariant)
 *                    TextButton(MR.strings.ext_copy_stacktrace, contentPadding = PaddingValues(0.dp))
 *                }
 *            }
 *   confirmButton = TextButton(MR.strings.action_ok)          -> "OK"
 *   dismissButton = TextButton(MR.strings.ext_uninstall)      -> "Uninstall"
 *   onDismissRequest = onDismissRequest
 *
 * The reason is `Extension.NotLoaded.Reason`, defined in
 * mihon/domain/src/main/java/eu/kanade/tachiyomi/extension/model/Extension.kt:
 *   Untrusted(signatureHash) | Filtered | Unsigned | UnsupportedLibVersion | Malformed | Failed(message, stackTrace)
 *
 * Base-locale strings: mihon/i18n/src/commonMain/moko-resources/base/strings.xml (lines 356-364).
 */
/**
 * `Untrusted` is deliberately absent: the reference routes that reason to `ExtensionTrustDialog`
 * (ExtensionsScreen.kt lines 267-278) and never to this dialog.
 */
export type ExtensionNotLoadedReason = 'filtered' | 'unsigned' | 'unsupported' | 'malformed' | 'failed'
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const open = defineModel<boolean>({ required: true })
const props = withDefaults(
  defineProps<{
    /** The loader reason. `undefined` means the REST API did not report one. */
    reason?: ExtensionNotLoadedReason
    /** `Reason.Failed.message`: the root error message. */
    message?: string
    /** `Reason.Failed.stackTrace`: copied to the clipboard by the "Copy stack trace" action. */
    stackTrace?: string
    /**
     * Whether the host can really remove the extension. Suwayomi-Server's REST API exposes no
     * extension management endpoint, so a host without one reports the limitation instead of
     * pretending the extension was removed.
     */
    canUninstall?: boolean
  }>(),
  { reason: undefined, message: '', stackTrace: '', canUninstall: false },
)
const emit = defineEmits<{ (event: 'uninstall'): void }>()

/** MR.strings.ext_not_loaded_dialog */
const TITLE = 'Couldn\'t load'
/** MR.strings.action_ok */
const OK = 'OK'
/** MR.strings.ext_uninstall */
const UNINSTALL = 'Uninstall'
/** MR.strings.ext_copy_stacktrace */
const COPY_STACK_TRACE = 'Copy stack trace'
/** MR.strings.copied_to_clipboard */
const COPIED_TO_CLIPBOARD = 'Copied to clipboard:'
/** MR.strings.clipboard_copy_error */
const CLIPBOARD_COPY_ERROR = 'Failed to copy to clipboard'

/**
 * `Extension.NotLoaded.Reason.descriptionRes`, base locale. The reference always knows the
 * reason; Suwayomi's REST payload does not, so the failed-loading message is the closest match.
 */
const DESCRIPTIONS: Record<ExtensionNotLoadedReason, string> = {
  filtered: 'This extension\'s content warning isn\'t one you chose to load, so its sources aren\'t available.',
  unsigned: 'This extension isn\'t signed, so there\'s no signature to check it against.',
  unsupported: 'This extension was built for a version of the extension library this app version can\'t load. Updating the app or the extension may help.',
  malformed: 'This extension is missing information the app needs to load it.',
  failed: 'This extension threw an error while loading, so none of its sources are available.',
}

const description = computed(() => DESCRIPTIONS[props.reason ?? 'failed'])
/** `reason is Extension.NotLoaded.Reason.Failed` gates the message and the copy action. */
const isFailed = computed(() => props.reason === 'failed')

/** Toast shown for the clipboard result (the reference uses an Android toast) and for the
 *  web-only limitation of the uninstall action. */
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

watch(open, value => {
  if (value) toast.value = ''
})

/** StringExtensions.kt: truncateCenter(count) keeps the middle of the text. */
function truncateCenter(value: string, count: number): string {
  if (value.length <= count) return value
  const pieceLength = Math.floor((count - 3) / 2)
  return `${value.slice(0, pieceLength)}...${value.slice(-pieceLength)}`
}

function showToast(message: string) {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 4000)
}

async function copyStackTrace() {
  const text = props.stackTrace
  // Context.copyToClipboard returns early on a blank content.
  if (!text || !text.trim()) return
  try {
    await navigator.clipboard.writeText(text)
    showToast(`${COPIED_TO_CLIPBOARD}\n${truncateCenter(text, 50)}`)
  } catch {
    showToast(CLIPBOARD_COPY_ERROR)
  }
}

function uninstall() {
  if (!props.canUninstall) {
    // Suwayomi-Server's REST API exposes no endpoint that removes an extension, so the action is
    // reported as unsupported instead of silently doing nothing.
    showToast('Uninstalling an extension is not supported in the web version: Suwayomi\'s REST API has no extension management endpoint.')
    return
  }
  emit('uninstall')
  open.value = false
}
</script>

<template>
  <v-dialog
    v-model="open"
    content-class="ext-not-loaded-overlay"
    :content-props="{ 'aria-labelledby': 'ext-not-loaded-title', 'aria-describedby': 'ext-not-loaded-text' }"
  >
    <v-card class="ext-not-loaded-card" color="surface-container-high" rounded="28px">
      <!-- DialogTokens.HeadlineFont = HeadlineSmall (24/32, w400); DialogTokens.HeadlineColor = OnSurface. -->
      <h2 id="ext-not-loaded-title" class="ext-not-loaded-title">{{ TITLE }}</h2>

      <!-- AlertDialogDefaults.textPadding = 24dp bottom; the text column uses padding.small = 8dp spacing. -->
      <div class="ext-not-loaded-content">
        <!-- DialogTokens.SupportingTextFont = BodyMedium (14/20, w400); DialogTokens.SupportingTextColor = OnSurfaceVariant. -->
        <p id="ext-not-loaded-text" class="ext-not-loaded-text">{{ description }}</p>

        <!-- Reason.Failed only: the root message in bodySmall monospace, then the copy action. -->
        <template v-if="isFailed">
          <p class="ext-not-loaded-stack">{{ message }}</p>
          <button type="button" class="ext-not-loaded-copy" @click="copyStackTrace">{{ COPY_STACK_TRACE }}</button>
        </template>
      </div>

      <!-- Box(align = End) + AlertDialogFlowRow: the confirm button is the first child and renders rightmost. -->
      <div class="ext-not-loaded-actions">
        <button type="button" class="ext-not-loaded-button" @click="open = false">{{ OK }}</button>
        <button type="button" class="ext-not-loaded-button" @click="uninstall">{{ UNINSTALL }}</button>
      </div>
    </v-card>
  </v-dialog>
  <div v-if="toast" class="ext-not-loaded-toast" role="status" aria-live="polite">{{ toast }}</div>
</template>

<style>
/* Material3 BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp) around a content sized
   dialog. The Vuetify overlay content is stretched by default and has to be constrained here. */
.v-dialog > .ext-not-loaded-overlay {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}
/* Compose draws the dialog surface with tonalElevation = 0.dp and without a shadow elevation,
   so the alert dialog has no drop shadow. */
.v-dialog > .ext-not-loaded-overlay > .ext-not-loaded-card { box-shadow: none; }
</style>

<style scoped>
@layer app-components {
/* Surface: DialogTokens.ContainerColor = SurfaceContainerHigh, DialogTokens.ContainerShape = CornerExtraLarge
   (28dp), DialogTokens.ContainerElevation = ElevationTokens.Level3 (the AlertDialog tonal elevation is 0dp,
   so the container colour carries no primary tint), container padding 24dp,
   min width 280dp / max width 560dp. */
.ext-not-loaded-card {
  padding: 24px;
  overflow-y: auto;
  max-height: calc(100dvh - 48px);
}
/* Title slot: DialogTokens.HeadlineFont = HeadlineSmall (24sp / 32sp, weight 400, letter spacing 0)
   in DialogTokens.HeadlineColor (onSurface). The title box adds 16dp of bottom padding. */
.ext-not-loaded-title {
  margin: 0 0 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
  text-align: start;
}
/* AlertDialogDefaults.textPadding = 24dp bottom; Column(Arrangement.spacedBy(padding.small = 8.dp)). */
.ext-not-loaded-content { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
/* DialogTokens.SupportingTextFont = BodyMedium (14sp / 20sp, weight 400, letter spacing 0.25sp)
   in DialogTokens.SupportingTextColor (onSurfaceVariant). */
.ext-not-loaded-text {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: pre-line;
}
/* Failure message: MaterialTheme.typography.bodySmall (12sp / 16sp, weight 400, letter spacing 0.4sp)
   in FontFamily.Monospace, in onSurfaceVariant. */
.ext-not-loaded-stack {
  margin: 0;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.4px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-family: 'Roboto Mono', 'DejaVu Sans Mono', ui-monospace, monospace;
  overflow-wrap: anywhere;
}
/* TextButton with contentPadding = PaddingValues(0.dp): no side padding, 40dp height,
   labelLarge (14sp / 20sp, weight 500, letter spacing 0.1sp) in the primary colour. */
.ext-not-loaded-copy {
  position: relative;
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  min-width: 58px;
  padding: 0;
  border: 0;
  border-radius: 20px;
  background: none;
  color: rgb(var(--v-theme-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  text-align: start;
  cursor: pointer;
  overflow: hidden;
}
.ext-not-loaded-copy::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}
.ext-not-loaded-copy:hover::after { opacity: 0.08; }
.ext-not-loaded-copy:active::after { opacity: 0.1; }
.ext-not-loaded-copy:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
/* AlertDialogFlowRow flips the layout direction, so the confirm button renders rightmost.
   Row-reverse keeps the confirm button first in the accessibility order. */
.ext-not-loaded-actions { display: flex; flex-direction: row-reverse; flex-wrap: wrap; justify-content: flex-start; gap: 8px; row-gap: 8px; }
/* MD3 text button: 40dp height, min width 58dp (ButtonDefaults.MinWidth), 12dp side padding,
   full 20dp shape, LabelLarge (14/20, w500), primary label. */
.ext-not-loaded-button {
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
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}
.ext-not-loaded-button::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}
.ext-not-loaded-button:hover::after { opacity: 0.08; }
.ext-not-loaded-button:active::after { opacity: 0.1; }
.ext-not-loaded-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
/* Material 3 snackbar: inverseSurface container, inverseOnSurface text, 4dp radius, 48dp min height. */
.ext-not-loaded-toast {
  position: fixed;
  left: 50%;
  bottom: calc(80px + 16px);
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  max-width: min(560px, calc(100vw - 32px));
  min-width: min(344px, calc(100vw - 32px));
  min-height: 48px;
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  white-space: pre-line;
  box-shadow: 0 3px 6px rgba(0, 0, 0, .28), 0 1px 2px rgba(0, 0, 0, .2);
}
}
</style>
