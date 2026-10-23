<script setup lang="ts">
/**
 * Settings → Security and privacy.
 *
 * Reference: mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsSecurityScreen.kt
 * (commit 446f6df). Supporting references:
 *   - PreferenceScreen.kt                → group headers, 12dp spacer between groups
 *   - widget/PreferenceGroupHeader.kt    → bodyMedium, secondary colour, 14dp top / 8dp bottom, 16dp horizontal
 *   - widget/BasePreferenceWidget.kt     → 56dp minimum height, 16dp padding, titleLarge @ 16sp
 *   - widget/TextPreferenceWidget.kt     → subtitle bodySmall with SECONDARY_ALPHA (0.78)
 *   - widget/SwitchPreferenceWidget.kt   → trailing MD3 switch, 16dp buffer before the switch
 *   - widget/ListPreferenceWidget.kt     → AlertDialog with radio rows and a "Cancel" confirm button
 *   - widget/InfoWidget.kt               → info icon + bodySmall text, 16dp padding, 16dp spacing
 *   - core/common/.../security/SecurityPreferences.kt → `use_biometric_lock`, `lock_app_after`,
 *     `secure_screen_v2` (INCOGNITO), `hide_notification_content`
 *   - core/common/.../security/PrivacyPreferences.kt  → `crashlytics` (true), `analytics` (true)
 *
 * Screen content (SettingsSecurityScreen.getPreferences()):
 *   1. Group "Security"
 *      - Switch  "Require unlock"        (MR.strings.lock_with_biometrics)
 *      - List    "Lock when idle"         (MR.strings.lock_when_idle), visible only while "Require unlock" is on
 *      - Switch  "Hide notification content" (MR.strings.hide_notification_content)
 *      - List    "Secure screen"           (MR.strings.secure_screen)
 *      - Info    (MR.strings.secure_screen_summary)
 *   2. Group "Analytics and Crash logs"   (MR.strings.pref_firebase), only in telemetry builds
 *      - Switch  "Send crash logs"        + subtitle
 *      - Switch  "Allow analytics"        + subtitle
 *      - Info    (MR.strings.firebase_summary)
 *
 * Android-only parts keep the reference shape and open a dialog stating that the feature is
 * unavailable in the web version instead of silently doing nothing:
 *   - the biometric prompt behind "Require unlock" / "Lock when idle"
 *   - the Crashlytics / Firebase analytics telemetry
 * The browser has no FLAG_SECURE either, so "Secure screen" only covers the hidden-preview half
 * (src/composables/useSecureScreen.ts).
 */
import { computed, ref } from 'vue'
import Md3Switch from '../Md3Switch.vue'
import { useSecurityPreferences } from '../../composables/useSecurityPreferences'
import '../../composables/useSecureScreen'

const { hideNotificationContent, secureScreen, useAuthenticator, lockAppAfter } = useSecurityPreferences()

/* ------------------------------------------------------------------ group 1: Security */

/**
 * "Lock when idle" (SecurityPreferences.lockAppAfter).
 * LockAfterValues in SettingsSecurityScreen.kt: 0 = Always, -1 = Never, otherwise minutes.
 * The entry labels come from MR.strings.lock_always / lock_never and the plural
 * MR.plurals.lock_after_mins ("After %1$s minute" / "After %1$s minutes").
 */
const LOCK_AFTER_ENTRIES = [0, 1, 2, 5, 10, -1]
function lockAfterLabel(value: number) {
  if (value === 0) return 'Always'
  if (value === -1) return 'Never'
  return value === 1 ? 'After 1 minute' : `After ${value} minutes`
}
const lockAfterTitle = computed(() => lockAfterLabel(lockAppAfter.value))
const lockDialogOpen = ref(false)
const lockBodyEl = ref<HTMLElement | null>(null)
const lockCanScrollBackward = ref(false)
const lockCanScrollForward = ref(false)
function updateLockScroll() {
  const el = lockBodyEl.value
  if (!el) return
  lockCanScrollBackward.value = el.scrollTop > 0
  lockCanScrollForward.value = el.scrollTop + el.clientHeight < el.scrollHeight - 1
}
function selectLockAfter(value: number) {
  lockAppAfter.value = value
  lockDialogOpen.value = false
}

/**
 * "Secure screen" (SecurityPreferences.SecureScreenMode):
 * ALWAYS (MR.strings.lock_always), INCOGNITO (MR.strings.pref_incognito_mode), NEVER (MR.strings.lock_never).
 */
const SECURE_SCREEN_ENTRIES = [
  { value: 'always', label: 'Always' },
  { value: 'incognito', label: 'Incognito mode' },
  { value: 'never', label: 'Never' },
] as const
const secureScreenTitle = computed(
  () => SECURE_SCREEN_ENTRIES.find(entry => entry.value === secureScreen.value)?.label ?? 'Incognito mode',
)
const secureScreenDialogOpen = ref(false)
const secureScreenBodyEl = ref<HTMLElement | null>(null)
const secureScreenCanScrollBackward = ref(false)
const secureScreenCanScrollForward = ref(false)
function updateSecureScreenScroll() {
  const el = secureScreenBodyEl.value
  if (!el) return
  secureScreenCanScrollBackward.value = el.scrollTop > 0
  secureScreenCanScrollForward.value = el.scrollTop + el.clientHeight < el.scrollHeight - 1
}
const secureScreenNoticeOpen = ref(false)
function selectSecureScreen(value: string) {
  secureScreen.value = value as typeof secureScreen.value
  secureScreenDialogOpen.value = false
  if (value !== 'never') {
    secureScreenNoticeOpen.value = true
  }
}

/**
 * "Require unlock" (SecurityPreferences.useAuthenticator). The reference shows the row only on
 * devices with an authenticator and prompts with `AuthenticatorUtil.authenticate` before it is
 * applied. A browser has neither, so the switch is kept but the prompt is replaced by a dialog
 * that states the feature is unavailable in the web version.
 */
const biometricDialogOpen = ref(false)
function onRequireUnlock(value: boolean) {
  useAuthenticator.value = value
  if (value) biometricDialogOpen.value = true
}

/**
 * "Hide notification content" (SecurityPreferences.hideNotificationContent).
 * Web notifications cannot hide content on lock screen independently of browser/OS settings.
 */
const notificationNoticeOpen = ref(false)
function onToggleNotificationContent(value: boolean) {
  hideNotificationContent.value = value
  if (value) notificationNoticeOpen.value = true
}

/* ------------------------------------------------------------------ group 2: telemetry */

/**
 * "Send crash logs" / "Allow analytics" (PrivacyPreferences.crashlytics / analytics, default true).
 * The telemetry group only exists in builds with `include-telemetry`; the web client never ships
 * Crashlytics or Firebase, so the switches explain that instead of reporting data.
 */
const TELEMETRY_STUB = {
  crashlytics: {
    title: 'Send crash logs',
    body: 'The web version does not collect or send crash logs. No diagnostics data leaves your browser.',
  },
  analytics: {
    title: 'Allow analytics',
    body: 'The web version does not collect or send usage analytics. No analytics data leaves your browser.',
  },
} as const
type TelemetryKey = keyof typeof TELEMETRY_STUB
const telemetryEnabled = ref<Record<TelemetryKey, boolean>>({ crashlytics: true, analytics: true })
const telemetryDialog = ref<TelemetryKey | null>(null)
function onTelemetryChange(key: TelemetryKey, value: boolean) {
  telemetryEnabled.value = { ...telemetryEnabled.value, [key]: value }
  if (value) telemetryDialog.value = key
}
</script>

<template>
  <div class="security-settings">
    <!-- PreferenceGroup(MR.strings.pref_security) -->
    <h2 class="pref-group-header">Security</h2>

    <!-- SwitchPreference(securityPreferences.useAuthenticator) -->
    <div
      class="pref-row pref-row--click"
      role="button"
      tabindex="0"
      data-pref="Require unlock"
      @click="onRequireUnlock(!useAuthenticator)"
      @keydown.space.prevent="onRequireUnlock(!useAuthenticator)"
      @keydown.enter.prevent="onRequireUnlock(!useAuthenticator)"
    >
      <div class="pref-text">
        <div class="pref-title">Require unlock</div>
      </div>
      <Md3Switch :model-value="useAuthenticator" label="Require unlock" @update:model-value="onRequireUnlock" />
    </div>

    <!-- ListPreference(securityPreferences.lockAppAfter): visible only while the app lock is on. -->
    <div
      v-if="useAuthenticator"
      class="pref-row pref-row--click"
      role="button"
      tabindex="0"
      data-pref="Lock when idle"
      @click="lockDialogOpen = true"
      @keydown.space.prevent="lockDialogOpen = true"
      @keydown.enter.prevent="lockDialogOpen = true"
    >
      <div class="pref-text">
        <div class="pref-title">Lock when idle</div>
        <div class="pref-subtitle">{{ lockAfterTitle }}</div>
      </div>
    </div>

    <!-- SwitchPreference(securityPreferences.hideNotificationContent) -->
    <div
      class="pref-row pref-row--click"
      role="button"
      tabindex="0"
      data-pref="Hide notification content"
      @click="onToggleNotificationContent(!hideNotificationContent)"
      @keydown.space.prevent="onToggleNotificationContent(!hideNotificationContent)"
      @keydown.enter.prevent="onToggleNotificationContent(!hideNotificationContent)"
    >
      <div class="pref-text">
        <div class="pref-title">Hide notification content</div>
      </div>
      <Md3Switch
        :model-value="hideNotificationContent"
        label="Hide notification content"
        @update:model-value="onToggleNotificationContent"
      />
    </div>

    <!-- ListPreference(securityPreferences.secureScreen) -->
    <div
      class="pref-row pref-row--click"
      role="button"
      tabindex="0"
      data-pref="Secure screen"
      @click="secureScreenDialogOpen = true"
      @keydown.space.prevent="secureScreenDialogOpen = true"
      @keydown.enter.prevent="secureScreenDialogOpen = true"
    >
      <div class="pref-text">
        <div class="pref-title">Secure screen</div>
        <div class="pref-subtitle">{{ secureScreenTitle }}</div>
      </div>
    </div>

    <!-- InfoPreference(MR.strings.secure_screen_summary) -->
    <div class="pref-info">
      <span class="material-symbols-rounded pref-info-icon">info</span>
      <span>Secure screen hides app contents when switching apps and block screenshots</span>
    </div>

    <!-- PreferenceScreen.kt: 12dp spacer between the preference groups. -->
    <div class="pref-group-spacer" />

    <!-- PreferenceGroup(MR.strings.pref_firebase) -->
    <h2 class="pref-group-header">Analytics and Crash logs</h2>

    <!-- SwitchPreference(privacyPreferences.crashlytics) -->
    <div
      class="pref-row pref-row--click"
      role="button"
      tabindex="0"
      data-pref="Send crash logs"
      @click="onTelemetryChange('crashlytics', !telemetryEnabled.crashlytics)"
      @keydown.space.prevent="onTelemetryChange('crashlytics', !telemetryEnabled.crashlytics)"
      @keydown.enter.prevent="onTelemetryChange('crashlytics', !telemetryEnabled.crashlytics)"
    >
      <div class="pref-text">
        <div class="pref-title">Send crash logs</div>
        <div class="pref-subtitle">Send anonymized crash logs to the developers.</div>
      </div>
      <Md3Switch
        :model-value="telemetryEnabled.crashlytics"
        label="Send crash logs"
        @update:model-value="value => onTelemetryChange('crashlytics', Boolean(value))"
      />
    </div>

    <!-- SwitchPreference(privacyPreferences.analytics) -->
    <div
      class="pref-row pref-row--click"
      role="button"
      tabindex="0"
      data-pref="Allow analytics"
      @click="onTelemetryChange('analytics', !telemetryEnabled.analytics)"
      @keydown.space.prevent="onTelemetryChange('analytics', !telemetryEnabled.analytics)"
      @keydown.enter.prevent="onTelemetryChange('analytics', !telemetryEnabled.analytics)"
    >
      <div class="pref-text">
        <div class="pref-title">Allow analytics</div>
        <div class="pref-subtitle">Send anonymized usage data to improve app features.</div>
      </div>
      <Md3Switch
        :model-value="telemetryEnabled.analytics"
        label="Allow analytics"
        @update:model-value="value => onTelemetryChange('analytics', Boolean(value))"
      />
    </div>

    <!-- InfoPreference(MR.strings.firebase_summary) -->
    <div class="pref-info">
      <span class="material-symbols-rounded pref-info-icon">info</span>
      <span>Sending crash logs and analytics will allow us to identify and fix issues, improve performance, and make future updates more relevant to your needs</span>
    </div>

    <!-- ListPreferenceWidget.kt: AlertDialog, radio rows, one "Cancel" confirm button. -->
    <v-dialog v-model="lockDialogOpen" max-width="560">
      <v-card v-if="lockDialogOpen" class="pref-dialog" rounded="28px" color="surface-container-high" elevation="0">
        <h3 class="pref-dialog-title">Lock when idle</h3>
        <div class="pref-dialog-wrap">
          <div ref="lockBodyEl" class="pref-dialog-body" role="radiogroup" aria-label="Lock when idle" @scroll.passive="updateLockScroll">
            <button
              v-for="value in LOCK_AFTER_ENTRIES"
              :key="value"
              type="button"
              class="pref-dialog-row"
              role="radio"
              :aria-checked="lockAppAfter === value"
              @click="selectLockAfter(value)"
            >
              <span class="pref-radio" :class="{ 'pref-radio--on': lockAppAfter === value }" aria-hidden="true"><i /></span>
              <span class="pref-dialog-label">{{ lockAfterLabel(value) }}</span>
            </button>
          </div>
          <div v-if="lockCanScrollBackward" class="pref-dialog-divider is-top" aria-hidden="true" />
          <div v-if="lockCanScrollForward" class="pref-dialog-divider is-bottom" aria-hidden="true" />
        </div>
        <div class="pref-dialog-actions">
          <v-btn variant="text" color="primary" class="pref-dialog-button" @click="lockDialogOpen = false">Cancel</v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- ListPreferenceWidget.kt: the "Secure screen" radio dialog. -->
    <v-dialog v-model="secureScreenDialogOpen" max-width="560">
      <v-card v-if="secureScreenDialogOpen" class="pref-dialog" rounded="28px" color="surface-container-high" elevation="0">
        <h3 class="pref-dialog-title">Secure screen</h3>
        <div class="pref-dialog-wrap">
          <div ref="secureScreenBodyEl" class="pref-dialog-body" role="radiogroup" aria-label="Secure screen" @scroll.passive="updateSecureScreenScroll">
            <button
              v-for="entry in SECURE_SCREEN_ENTRIES"
              :key="entry.value"
              type="button"
              class="pref-dialog-row"
              role="radio"
              :aria-checked="secureScreen === entry.value"
              @click="selectSecureScreen(entry.value)"
            >
              <span class="pref-radio" :class="{ 'pref-radio--on': secureScreen === entry.value }" aria-hidden="true"><i /></span>
              <span class="pref-dialog-label">{{ entry.label }}</span>
            </button>
          </div>
          <div v-if="secureScreenCanScrollBackward" class="pref-dialog-divider is-top" aria-hidden="true" />
          <div v-if="secureScreenCanScrollForward" class="pref-dialog-divider is-bottom" aria-hidden="true" />
        </div>
        <div class="pref-dialog-actions">
          <v-btn variant="text" color="primary" class="pref-dialog-button" @click="secureScreenDialogOpen = false">Cancel</v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- Stub for the Android biometric prompt (AuthenticatorUtil.authenticate). -->
    <v-dialog v-model="biometricDialogOpen" max-width="560">
      <v-card v-if="biometricDialogOpen" class="pref-dialog" rounded="28px" color="surface-container-high" elevation="0">
        <h3 class="pref-dialog-title">Require unlock</h3>
        <div class="pref-dialog-body">
          <p class="pref-dialog-text">Unlocking the app with biometrics is an Android feature and is not available in the web version. Protect your library with the authentication of your Suwayomi server instead.</p>
        </div>
        <div class="pref-dialog-actions">
          <v-btn variant="text" color="primary" class="pref-dialog-button" @click="biometricDialogOpen = false">Close</v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- Stub for Android FLAG_SECURE window flag limitation in browser. -->
    <v-dialog v-model="secureScreenNoticeOpen" max-width="560">
      <v-card v-if="secureScreenNoticeOpen" class="pref-dialog" rounded="28px" color="surface-container-high" elevation="0">
        <h3 class="pref-dialog-title">Secure screen</h3>
        <div class="pref-dialog-body">
          <p class="pref-dialog-text">Web browsers do not support Android's FLAG_SECURE window flag to block screenshots. Mihon Web hides and blurs the screen when switching tabs or apps, but cannot prevent OS-level screenshots.</p>
        </div>
        <div class="pref-dialog-actions">
          <v-btn variant="text" color="primary" class="pref-dialog-button" @click="secureScreenNoticeOpen = false">OK</v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- Stub for Android system notification privacy in browser. -->
    <v-dialog v-model="notificationNoticeOpen" max-width="560">
      <v-card v-if="notificationNoticeOpen" class="pref-dialog" rounded="28px" color="surface-container-high" elevation="0">
        <h3 class="pref-dialog-title">Hide notification content</h3>
        <div class="pref-dialog-body">
          <p class="pref-dialog-text">System-level lock screen notification redaction is an Android feature. Web notifications cannot be hidden on the lock screen independently of browser notification settings.</p>
        </div>
        <div class="pref-dialog-actions">
          <v-btn variant="text" color="primary" class="pref-dialog-button" @click="notificationNoticeOpen = false">OK</v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- Stub for the Crashlytics / Firebase telemetry of the reference build. -->
    <v-dialog :model-value="telemetryDialog !== null" max-width="560" @update:model-value="value => { if (!value) telemetryDialog = null }">
      <v-card v-if="telemetryDialog" class="pref-dialog" rounded="28px" color="surface-container-high" elevation="0">
        <h3 class="pref-dialog-title">{{ TELEMETRY_STUB[telemetryDialog].title }}</h3>
        <div class="pref-dialog-body">
          <p class="pref-dialog-text">{{ TELEMETRY_STUB[telemetryDialog].body }}</p>
        </div>
        <div class="pref-dialog-actions">
          <v-btn variant="text" color="primary" class="pref-dialog-button" @click="telemetryDialog = null">Close</v-btn>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.security-settings {
  display: flex;
  flex-direction: column;
}

/* PreferenceGroupHeader.kt: bodyMedium (14/20), colorScheme.secondary, 14dp top / 8dp bottom, 16dp horizontal. */
.pref-group-header {
  margin: 0;
  padding: 14px 16px 8px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  color: rgb(var(--v-theme-secondary));
}

/* BasePreferenceWidget.kt: 56dp minimum height, 16dp padding on all sides. */
.pref-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 56px;
  padding: 16px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  transition: background-color 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.pref-row--click { cursor: pointer; }
.pref-row--click:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.pref-row--click:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent); }
.pref-row--click:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }
.pref-text { flex: 1 1 auto; min-width: 0; }
/* titleLarge with TitleFontSize = 16sp. */
.pref-title {
  font-size: 16px;
  line-height: 28px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
/* bodySmall subtitle with SECONDARY_ALPHA (0.78). */
.pref-subtitle {
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  opacity: .78;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 10;
}

/* InfoWidget.kt: 16dp padding, 16dp spacing, info icon + bodySmall text, SECONDARY_ALPHA. */
.pref-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  font-size: 12px;
  line-height: 16px;
  color: rgb(var(--v-theme-on-surface));
  opacity: .78;
}
/* The icon keeps the MD3 Icon default tint (onSurfaceVariant). */
.pref-info-icon {
  font-size: 24px;
  line-height: 24px;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* PreferenceScreen.kt: 12dp spacer between the preference groups. */
.pref-group-spacer { height: 12px; }

/* MD3 AlertDialog: 24dp padding, surfaceContainerHigh container, headlineSmall title, bodyMedium text. */
.pref-dialog {
  padding: 24px;
  background: rgb(var(--v-theme-surface-container-high));
  border-radius: 28px !important;
  color: rgb(var(--v-theme-on-surface));
}
.pref-dialog-title {
  margin: 0 0 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}
.pref-dialog-wrap {
  position: relative;
}
.pref-dialog-body {
  display: flex;
  flex-direction: column;
  max-height: 320px;
  overflow-y: auto;
}
.pref-dialog-divider {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: rgb(var(--v-theme-outline-variant));
  pointer-events: none;
}
.pref-dialog-divider.is-top { top: 0; }
.pref-dialog-divider.is-bottom { bottom: 0; }
.pref-dialog-text {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface-variant));
}
/* ListPreferenceWidget.DialogRow: clip(small) + selectable + minimumInteractiveComponentSize (48dp). */
.pref-dialog-row {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 0 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: background-color 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.pref-dialog-row:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.pref-dialog-row:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent); }
.pref-dialog-row:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }
/* MD3 RadioButton: 20dp outer circle, 10dp inner dot. */
.pref-radio {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
  transition: border-color 0.2s;
}
.pref-radio--on { border-color: rgb(var(--v-theme-primary)); }
.pref-radio i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
  display: none;
}
.pref-radio--on i { display: block; }
/* bodyLarge label, 24dp after the radio button. */
.pref-dialog-label {
  margin-inline-start: 24px;
  font-size: 16px;
  line-height: 24px;
  color: rgb(var(--v-theme-on-surface));
}
.pref-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 24px;
}
.pref-dialog-button {
  min-width: 64px;
  height: 40px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-transform: none;
  border-radius: 20px;
}
</style>
