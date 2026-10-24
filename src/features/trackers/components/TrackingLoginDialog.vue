<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

/**
 * Pixel-parity port of `TrackingLoginDialog` in
 * mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsTrackingScreen.kt:206-305
 *
 *   AlertDialog(
 *     onDismissRequest = onDismissRequest,
 *     title = {
 *       Row(verticalAlignment = Alignment.CenterVertically) {
 *         Text(text = stringResource(MR.strings.login_title, tracker.name), modifier = Modifier.weight(1f))
 *         IconButton(onClick = onDismissRequest) {
 *           Icon(MaterialSymbols.Rounded.Close, contentDescription = stringResource(MR.strings.action_close))
 *         }
 *       }
 *     },
 *     text = {
 *       Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
 *         OutlinedTextField(
 *           modifier = Modifier.fillMaxWidth().semantics { contentType = ContentType.Username + ContentType.EmailAddress },
 *           state = username,
 *           label = { Text(text = stringResource(uNameStringRes)) },
 *           keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
 *           lineLimits = TextFieldLineLimits.SingleLine,
 *           isError = inputError && !processing,
 *         )
 *         var hidePassword by remember { mutableStateOf(true) }
 *         OutlinedSecureTextField(
 *           modifier = Modifier.fillMaxWidth().semantics { contentType = ContentType.Password },
 *           state = password,
 *           label = { Text(text = stringResource(MR.strings.password)) },
 *           trailingIcon = {
 *             IconButton(onClick = { hidePassword = !hidePassword }) {
 *               Icon(if (hidePassword) MaterialSymbols.RoundedFilled.Visibility
 *                    else MaterialSymbols.RoundedFilled.VisibilityOff, contentDescription = null)
 *             }
 *           },
 *           textObfuscationMode = if (hidePassword) TextObfuscationMode.Hidden else TextObfuscationMode.Visible,
 *           keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
 *           isError = inputError && !processing,
 *         )
 *       }
 *     },
 *     confirmButton = {
 *       Button(
 *         modifier = Modifier.fillMaxWidth(),
 *         enabled = !processing && username.text.isNotBlank() && password.text.isNotBlank(),
 *         onClick = { ... checkLogin ... },
 *       ) {
 *         val id = if (processing) MR.strings.logging_in else MR.strings.login
 *         Text(text = stringResource(id))
 *       }
 *     },
 *   )
 *
 * Strings (mihon/i18n/src/commonMain/moko-resources/base/strings.xml):
 *   login_title  = "Log in to %1$s"   (L730)
 *   username     = "Username"        (L731)
 *   email        = "Email address"   (L732)
 *   password     = "Password"         (L733)
 *   login        = "Login"            (L734)
 *   logging_in   = "Logging in…"      (L735)
 *   login_success= "Logged in"        (L736)
 *   action_close = "Close"            (L160)
 *
 * Material3 metrics used here (compose material3 AlertDialog.kt + TextFieldDefaults.kt + Button.kt):
 * - container = surface-container-high, shape = CornerExtraLarge (28dp), container padding 24dp,
 *   container elevation = Level3 (0 4px 8px 3px / 0 1px 3px 0), tonalElevation 0dp.
 * - title = headlineSmall (24sp / 32sp, weight 400) in on-surface, 16dp bottom padding; the title
 *   slot is a Row with a 48dp IconButton (24dp glyph) on the trailing edge.
 * - the text slot holds a Column with 12dp between the two fields; AlertDialogDefaults.textPadding
 *   adds 24dp below the text block, above the action row.
 * - OutlinedTextField: container height 56dp, shape CornerExtraSmall (4dp), outline 1dp
 *   (2dp focused, 2dp error), content padding 16dp horizontal, minimum width 280dp.
 *   label = bodyLarge (16sp / 24sp) in on-surface-variant while it rests, bodySmall (12sp / 16sp)
 *   once it floats over the outline notch (primary when focused, error when invalid);
 *   input = bodyLarge (16sp / 24sp) in on-surface.
 * - The confirm Button fills the whole width: MD3 filled button, height 40dp, shape CornerFull
 *   (20dp), container = primary, content = on-primary, label = labelLarge (14sp / 20sp, w500).
 *   The disabled state uses on-surface at 38% opacity.
 *
 * Behaviour parity:
 * - the confirm button is enabled only while the processing flag is off and both fields are not
 *   blank (`username.text.isNotBlank() && password.text.isNotBlank()`).
 * - `username` and `password` are initialised from `tracker.getUsername()` / `tracker.getPassword()`,
 *   which are empty for an unlinked tracker, so the web port starts with empty fields.
 * - the password field toggles between the hidden and visible obfuscation mode; the trailing icon
 *   is RoundedFilled.Visibility / RoundedFilled.VisibilityOff (filled symbol variant).
 * - the IME actions are Next on the first field (moves the focus to the password field) and Done
 *   on the password field (submits the form).
 * - Mihon reports the result with a toast (`login_success` on success, the exception message on
 *   failure). The web port uses an MD3 snackbar with the same wording.
 *
 * Server side: the Suwayomi REST/GraphQL API exposes no tracker credentials and no tracker login
 * endpoint, so the login itself cannot be performed in the web client. The dialog is therefore an
 * honest stub: it is opened from the tracking settings, it looks exactly like the reference, and
 * it reports that the action is not supported in the web version instead of pretending to log in.
 */
const open = defineModel<boolean>({ required: true })

const props = withDefaults(
  defineProps<{
    /** Tracker name, used in the "Log in to <name>" title. */
    trackerName: string
    /** Label of the first field: "Username" or "Email address" (MR.strings.username / MR.strings.email). */
    usernameLabel?: string
    /** Pre-filled user name (Mihon passes `tracker.getUsername()`). */
    initialUsername?: string
    /** Pre-filled password (Mihon passes `tracker.getPassword()`). */
    initialPassword?: string
    /**
     * Whether the client can actually perform the remote log-in. The Suwayomi GraphQL API
     * exposes the `loginTrackerCredentials` mutation, so the settings screen can pass `true`;
     * the default keeps the honest stub for the callers that cannot log in.
     */
    supported?: boolean
  }>(),
  { usernameLabel: 'Username', initialUsername: '', initialPassword: '', supported: false },
)

const emit = defineEmits<{
  (event: 'login', username: string, password: string, done: (success: boolean) => void): void
}>()

const username = ref(props.initialUsername)
const password = ref(props.initialPassword)
const processing = ref(false)
const inputError = ref(false)
const hidePassword = ref(true)
const focusedField = ref<'username' | 'password' | null>(null)
const usernameInput = ref<HTMLInputElement | null>(null)
const passwordInput = ref<HTMLInputElement | null>(null)
const snackbar = ref('')
let snackbarTimer: ReturnType<typeof setTimeout> | undefined

/** MR.strings.login_title = "Log in to %1$s" */
const title = computed(() => `Log in to ${props.trackerName}`)

/** enabled = !processing && username.text.isNotBlank() && password.text.isNotBlank() */
const canConfirm = computed(
  () => !processing.value && username.value.trim() !== '' && password.value.trim() !== '',
)

/** The field error state is only visible while the request is not running. */
const fieldsInvalid = computed(() => inputError.value && !processing.value)

watch(open, async value => {
  if (!value) return
  /* The Compose dialog leaves the composition when it is dismissed, so its state starts over. */
  username.value = props.initialUsername
  password.value = props.initialPassword
  processing.value = false
  inputError.value = false
  hidePassword.value = true
  focusedField.value = null
  snackbar.value = ''
  await nextTick()
  usernameInput.value?.focus()
})

function showSnackbar(message: string) {
  snackbar.value = message
  if (snackbarTimer) clearTimeout(snackbarTimer)
  snackbarTimer = setTimeout(() => { snackbar.value = '' }, 4000)
}

function dismiss() {
  if (processing.value) return
  open.value = false
}

function onUsernameInput(event: Event) {
  username.value = (event.target as HTMLInputElement).value
}

function onPasswordInput(event: Event) {
  password.value = (event.target as HTMLInputElement).value
}

/** ImeAction.Next on the first field moves the focus to the password field. */
function focusPassword() {
  passwordInput.value?.focus()
}

async function confirm() {
  if (!canConfirm.value) return
  processing.value = true
  if (props.supported) {
    /* The caller performs the real login and reports the result through the callback. */
    emit('login', username.value, password.value, (success: boolean) => {
      if (success) {
        inputError.value = false
        open.value = false
        showSnackbar('Logged in')
      } else {
        inputError.value = true
      }
      processing.value = false
    })
    return
  }
  try {
    /* Suwayomi-Server exposes no tracker credentials and no tracker login endpoint, so the
       reference `tracker.login(username, password)` cannot be performed in the web client.
       The dialog reports this honestly instead of pretending the login succeeded. */
    await Promise.resolve()
    inputError.value = false
    showSnackbar('Tracker login is not supported in the web version: the Suwayomi REST API has no tracker account endpoint.')
  } finally {
    processing.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" content-class="tracking-login-overlay" aria-labelledby="tracking-login-title">
    <div class="tracking-login-dialog">
      <!-- Title slot: Row (verticalAlignment = CenterVertically) with the headline text and a
           48dp IconButton that closes the dialog. -->
      <div class="tracking-login-title-row">
        <h2 id="tracking-login-title" class="tracking-login-title">{{ title }}</h2>
        <button type="button" class="tracking-login-close" aria-label="Close" @click="dismiss">
          <span class="material-symbols-rounded tracking-login-close-icon" aria-hidden="true">close</span>
        </button>
      </div>

      <!-- Text slot: Column with 12dp between the two OutlinedTextFields. -->
      <div class="tracking-login-content">
        <div
          class="tracking-login-field"
          :class="{
            'is-error': fieldsInvalid,
            'is-focused': focusedField === 'username',
            'has-value': username !== '',
          }"
        >
          <input
            id="tracking-login-username"
            ref="usernameInput"
            type="text"
            class="tracking-login-input"
            :value="username"
            autocomplete="username"
            enterkeyhint="next"
            :aria-invalid="fieldsInvalid"
            @input="onUsernameInput"
            @focus="focusedField = 'username'"
            @blur="focusedField = null"
            @keydown.enter.prevent="focusPassword"
          />
          <label for="tracking-login-username" class="tracking-login-label">{{ usernameLabel }}</label>
        </div>

        <div
          class="tracking-login-field"
          :class="{
            'is-error': fieldsInvalid,
            'is-focused': focusedField === 'password',
            'has-value': password !== '',
          }"
        >
          <input
            id="tracking-login-password"
            ref="passwordInput"
            :type="hidePassword ? 'password' : 'text'"
            class="tracking-login-input tracking-login-input--password"
            :value="password"
            autocomplete="current-password"
            enterkeyhint="done"
            :aria-invalid="fieldsInvalid"
            @input="onPasswordInput"
            @focus="focusedField = 'password'"
            @blur="focusedField = null"
            @keydown.enter.prevent="confirm"
          />
          <label for="tracking-login-password" class="tracking-login-label">Password</label>
          <!-- OutlinedSecureTextField trailingIcon: IconButton toggling the obfuscation mode.
               RoundedFilled.Visibility / RoundedFilled.VisibilityOff (filled symbol variant). -->
          <button
            type="button"
            class="tracking-login-visibility"
            :aria-label="hidePassword ? 'Show password' : 'Hide password'"
            @click="hidePassword = !hidePassword"
          >
            <span
              class="material-symbols-rounded tracking-login-visibility-icon"
              :class="{ 'filled-symbol': true }"
              aria-hidden="true"
            >{{ hidePassword ? 'visibility' : 'visibility_off' }}</span>
          </button>
        </div>
      </div>

      <!-- Confirm button: a full width MD3 filled Button. -->
      <button type="button" class="tracking-login-confirm" :disabled="!canConfirm" @click="confirm">
        {{ processing ? 'Logging in…' : 'Login' }}
      </button>
    </div>
  </v-dialog>
  <div v-if="snackbar" class="tracking-login-snackbar" role="status" aria-live="polite">
    {{ snackbar }}
  </div>
</template>

<style scoped>
@layer app-components {
  /* Material3 AlertDialog container: shape = CornerExtraLarge (28dp), container colour =
     surface-container-high, container padding 24dp, elevation = Level3. */
  .tracking-login-dialog {
    box-sizing: border-box;
    width: fit-content;
    min-width: min(328px, calc(100vw - 48px));
    max-width: min(560px, calc(100vw - 48px));
    margin: 0 auto;
    padding: 24px;
    border-radius: 28px;
    background: rgb(var(--v-theme-surface-container-high));
    color: rgb(var(--v-theme-on-surface));
    box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px 0 rgba(0, 0, 0, 0.3);
  }

  /* Title slot: Row with a 48dp IconButton on the trailing edge. */
  .tracking-login-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }
  /* Title: headlineSmall (24sp / 32sp, weight 400) in on-surface. */
  .tracking-login-title {
    flex: 1 1 auto;
    min-width: 0;
    margin: 0;
    font-size: 24px;
    line-height: 32px;
    font-weight: 400;
    letter-spacing: normal;
    color: rgb(var(--v-theme-on-surface));
    text-align: start;
  }
  /* IconButton: 48dp touch target, 24dp glyph, on-surface in the title slot. */
  .tracking-login-close {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    margin: -12px -12px -12px 0;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: rgb(var(--v-theme-on-surface));
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    position: relative;
  }
  .tracking-login-close::after {
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
    .tracking-login-close:hover::after { opacity: 0.08; }
  }
  .tracking-login-close:active::after { opacity: 0.12; }
  .tracking-login-close:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
  .tracking-login-close-icon { font-size: 24px; line-height: 1; }

  /* Text slot: the Column with 12dp between the fields, plus the 24dp bottom padding of
     AlertDialogDefaults.textPadding. */
  .tracking-login-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
  }

  /* Material3 OutlinedTextField: container height 56dp, shape CornerExtraSmall (4dp),
     outline 1dp (2dp focused, 2dp error), content padding 16dp horizontal, minimum width 280dp. */
  .tracking-login-field { position: relative; min-width: 280px; }
  .tracking-login-input {
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
  /* The trailing visibility IconButton takes 48dp on the trailing edge. */
  .tracking-login-input--password { padding-right: 48px; }
  .tracking-login-field.is-focused .tracking-login-input,
  .tracking-login-field.has-value .tracking-login-input {
    padding-top: 23px;
    padding-bottom: 7px;
  }
  .tracking-login-field.is-focused .tracking-login-input {
    border-color: rgb(var(--v-theme-primary));
    border-width: 2px;
  }
  .tracking-login-field.is-error .tracking-login-input {
    border-color: rgb(var(--v-theme-error));
    border-width: 2px;
    padding-left: 15px;
  }
  /* The label rests in the outline notch: 4dp gap on each side, aligned with the input start. */
  .tracking-login-label {
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
  .tracking-login-field.is-focused .tracking-login-label,
  .tracking-login-field.has-value .tracking-login-label {
    top: 0;
    font-size: 12px;
    line-height: 16px;
    letter-spacing: 0.0333333333em;
  }
  .tracking-login-field.is-focused .tracking-login-label { color: rgb(var(--v-theme-primary)); }
  .tracking-login-field.is-error .tracking-login-label { color: rgb(var(--v-theme-error)); }

  /* The trailing IconButton of the secure field: 48dp touch target, 24dp filled glyph. */
  .tracking-login-visibility {
    position: absolute;
    right: 0;
    top: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: rgb(var(--v-theme-on-surface-variant));
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .tracking-login-visibility:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
  .tracking-login-visibility-icon { font-size: 24px; line-height: 1; }

  /* MD3 filled Button: height 40dp, shape CornerFull (20dp), container = primary,
     content = on-primary, label = labelLarge (14sp / 20sp, weight 500). */
  .tracking-login-confirm {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: 100%;
    height: 40px;
    padding: 0 24px;
    border: 0;
    border-radius: 20px;
    background: rgb(var(--v-theme-primary));
    color: rgb(var(--v-theme-on-primary));
    font-family: inherit;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    letter-spacing: 0.0071428571em;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    -webkit-tap-highlight-color: transparent;
  }
  .tracking-login-confirm::after {
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
    .tracking-login-confirm:hover::after { opacity: 0.08; }
  }
  .tracking-login-confirm:active::after { opacity: 0.12; }
  .tracking-login-confirm:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
  /* Disabled state: on-surface at 38% opacity. */
  .tracking-login-confirm:disabled {
    background: rgb(var(--v-theme-on-surface));
    color: rgb(var(--v-theme-surface));
    opacity: 0.38;
    cursor: default;
  }

  /* MD3 snackbar, matching the snackbar used by the other dialogs. */
  .tracking-login-snackbar {
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

  /* Narrow viewports: the fixed 280dp field minimum is dropped below the dialog minimum. */
  @media (max-width: 328px) {
    .tracking-login-dialog { min-width: 0; max-width: 100%; }
    .tracking-login-field { min-width: 0; }
  }
}
</style>

<style>
/* Material3 AlertDialog pane: minWidth 280dp / maxWidth 560dp, size to the content. */
.v-dialog > .tracking-login-overlay {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}
/* Compose draws the dialog surface with tonalElevation = 0.dp and without a shadow elevation. */
.v-dialog > .tracking-login-overlay > .v-card { box-shadow: none; }
</style>
