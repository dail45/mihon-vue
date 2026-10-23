<script setup lang="ts">
/**
 * Pixel-parity port of the tracker log-out dialog.
 *
 * Reference:
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsTrackingScreen.kt
 *   lines 324-364:
 *
 *     @Composable
 *     private fun TrackingLogoutDialog(
 *         tracker: Tracker,
 *         onDismissRequest: () -> Unit,
 *     ) {
 *         val context = LocalContext.current
 *         AlertDialog(
 *             onDismissRequest = onDismissRequest,
 *             title = {
 *                 Text(
 *                     text = stringResource(MR.strings.logout_title, tracker.name),
 *                     textAlign = TextAlign.Center,
 *                     modifier = Modifier.fillMaxWidth(),
 *                 )
 *             },
 *             confirmButton = {
 *                 Row(horizontalArrangement = Arrangement.spacedBy(MaterialTheme.padding.extraSmall)) {
 *                     OutlinedButton(
 *                         modifier = Modifier.weight(1f),
 *                         onClick = onDismissRequest,
 *                     ) {
 *                         Text(text = stringResource(MR.strings.action_cancel))
 *                     }
 *                     Button(
 *                         modifier = Modifier.weight(1f),
 *                         onClick = {
 *                             tracker.logout()
 *                             onDismissRequest()
 *                             context.toast(MR.strings.logout_success)
 *                         },
 *                         colors = ButtonDefaults.buttonColors(
 *                             containerColor = MaterialTheme.colorScheme.error,
 *                             contentColor = MaterialTheme.colorScheme.onError,
 *                         ),
 *                     ) {
 *                         Text(text = stringResource(MR.strings.logout))
 *                     }
 *                 }
 *             },
 *         )
 *     }
 *
 * The dialog is opened from the tracker rows of the settings screen
 * (`logout = { dialog = LogoutDialog(trackerManager.mangaBaka) }`, SettingsTrackingScreen.kt:145).
 *
 * Material3 metrics used here (androidx.compose.material3 AlertDialog.kt, DialogTokens.kt,
 * Button.kt, Shapes.kt):
 *   - container: surface-container-high, CornerExtraLarge (28dp), container elevation Level3
 *     (key shadow 0 1px 3px @30%, ambient shadow 0 4px 8px 3px @15%), padding 24dp
 *   - the dialog has NO text slot, so only the 16dp title padding separates the title
 *     from the button row (no 24dp text padding is added)
 *   - title: headlineSmall (24sp / 32sp, w400) in on-surface, centered, full width
 *   - buttons: the confirm slot holds a single Row, so the flow row has one item; the Row is
 *     laid out with the dialog's max width (560 - 2*24 = 512dp) and both buttons use
 *     Modifier.weight(1f), so each button takes half of the row minus the 4dp gap
 *   - Row spacing: MaterialTheme.padding.extraSmall = 4dp
 *   - OutlinedButton: 40dp height, 1dp outline in outline, CornerFull (20dp),
 *     labelLarge (14sp / 20sp, w500) in primary
 *   - Button (filled) with containerColor = error and contentColor = onError
 *
 * Reference strings (mihon/i18n/src/commonMain/moko-resources/base/strings.xml):
 *   logout_title = "Log out from %1$s?" (line 737)
 *   logout = "Log out" (line 738)
 *   logout_success = "You are now logged out" (line 739)
 *   action_cancel = "Cancel" (line 136)
 */
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  /** `tracker.name` of the reference: the service the dialog belongs to. */
  trackerName: string
  /**
   * Whether the client can actually perform the remote log-out. Tracker credentials live in
   * the Suwayomi server and Mihon's trackers are not part of the REST contract used here, so
   * the web client cannot log out. The dialog still opens and looks identical, but the
   * confirmation reports that the action is not supported instead of claiming success.
   */
  supported?: boolean
}>(), { supported: false })

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{
  (event: 'logout', trackerName: string, done: (success: boolean) => void): void
}>()

/** `stringResource(MR.strings.logout_title, tracker.name)`. */
const title = computed(() => `Log out from ${props.trackerName}?`)

/** `context.toast(MR.strings.logout_success)` - an Android toast, rendered here as an MD3 snackbar. */
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

watch(open, value => { if (value) toast.value = '' })

function showToast(message: string) {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 4000)
}

/** `OutlinedButton(onClick = onDismissRequest)`. */
function onCancel() {
  open.value = false
}

/**
 * `Button(onClick = { tracker.logout(); onDismissRequest(); context.toast(logout_success) })`:
 * Mihon performs the log-out first, dismisses the dialog and only then shows the toast.
 */
function onConfirm() {
  open.value = false
  if (props.supported) {
    emit('logout', props.trackerName, (success: boolean) => {
      showToast(success ? 'You are now logged out' : 'Logging out of a tracking service failed.')
    })
  } else {
    showToast('Logging out of a tracking service is not supported in the web client.')
  }
}
</script>

<template>
  <v-dialog v-model="open" content-class="tracking-logout-overlay" aria-labelledby="tracking-logout-title">
    <div class="tracking-logout-dialog">
      <!--
        DialogTokens.HeadlineFont = HeadlineSmall (24sp / 32sp, w400) in on-surface.
        There is no text slot, so only the 16dp title padding separates the title from
        the button row.
      -->
      <h2 id="tracking-logout-title" class="tracking-logout-title">{{ title }}</h2>

      <!--
        The confirm slot holds a single Row with spacing 4dp; both buttons use weight(1f),
        so each of them fills half of the 512dp content width.
      -->
      <div class="tracking-logout-actions">
        <button type="button" class="tracking-logout-button tracking-logout-button--outlined" @click="onCancel">Cancel</button>
        <button type="button" class="tracking-logout-button tracking-logout-button--confirm" @click="onConfirm">Log out</button>
      </div>
    </div>
  </v-dialog>
  <div v-if="toast" class="tracking-logout-snackbar" role="status" aria-live="polite">{{ toast }}</div>
</template>

<style scoped>
@layer app-components {
/* Material3 BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp) around a content sized
   dialog. DialogTokens.ContainerColor = SurfaceContainerHigh, ContainerShape = CornerExtraLarge
   (28dp), ContainerElevation = Level3, dialog padding 24dp.
   The two buttons of the confirm slot use Modifier.weight(1f), so the row fills the whole
   content width and the dialog takes its maximum width of 560dp. */
.tracking-logout-dialog {
  box-sizing: border-box;
  align-self: center;
  width: min(560px, calc(100vw - 48px));
  min-width: min(280px, calc(100vw - 48px));
  max-width: min(560px, calc(100vw - 48px));
  margin: 0 auto;
  padding: 24px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
  /* MD3 elevation level 3: key shadow 0 1px 3px @30%, ambient shadow 0 4px 8px 3px @15%. */
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, .3), 0 4px 8px 3px rgba(0, 0, 0, .15);
}

/* DialogTokens.HeadlineFont = HeadlineSmall (24sp / 32sp, w400) in on-surface.
   The reference aligns the title in the center and lets it fill the dialog width.
   The title slot keeps the 16dp title padding; there is no text slot, so no extra
   24dp text padding is added below it. */
.tracking-logout-title {
  margin: 0 0 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
  text-align: center;
}

/* The confirm slot holds a single Row(horizontalArrangement = spacedBy(padding.extraSmall = 4dp))
   whose children use Modifier.weight(1f), so both buttons share the row equally. */
.tracking-logout-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  width: 100%;
}

/* Material3 button base: 40dp height, CornerFull (20dp radius), labelLarge
   (14sp / 20sp, w500). */
.tracking-logout-button {
  position: relative;
  display: inline-flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  height: 40px;
  padding: 0 12px;
  border-radius: 20px;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.0071428571em;
  cursor: pointer;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}
.tracking-logout-button::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}
.tracking-logout-button:hover::after { opacity: 0.08; }
.tracking-logout-button:active::after { opacity: 0.1; }
.tracking-logout-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* OutlinedButton: transparent container, 1dp outline in outline, label in primary. */
.tracking-logout-button--outlined {
  border: 1px solid rgb(var(--v-theme-outline));
  background: transparent;
  color: rgb(var(--v-theme-primary));
}

/* Button with containerColor = error and contentColor = onError. */
.tracking-logout-button--confirm {
  border: 1px solid transparent;
  background: rgb(var(--v-theme-error));
  color: rgb(var(--v-theme-on-error));
}

/* MD3 snackbar, matching the snackbar used by the other dialogs. */
.tracking-logout-snackbar {
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
  box-shadow: 0 3px 6px rgba(0, 0, 0, .28), 0 1px 2px rgba(0, 0, 0, .2);
}
}
</style>

<style>
/* Material3 AlertDialog pane: minWidth 280dp / maxWidth 560dp. */
.v-dialog > .tracking-logout-overlay {
  width: min(560px, calc(100% - 48px));
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}
</style>
