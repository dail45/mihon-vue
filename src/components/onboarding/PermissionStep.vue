<script setup lang="ts">
/**
 * Pixel-parity port of Mihon's onboarding "Permissions" step.
 *
 * Reference: mihon/app/src/main/java/eu/kanade/presentation/more/onboarding/PermissionStep.kt
 *   - `Column { ... }` (no padding on the column itself) holding Material3 `ListItem`s.
 *   - `PermissionCheckbox` = ListItem whose trailing content is
 *     `OutlinedButton(enabled = !granted)` showing `MaterialSymbols.Rounded.Check` tinted
 *     `colorScheme.primary` once granted, otherwise the "Grant" label.
 *   - `PermissionSwitch` = ListItem whose trailing content is a Material3 `Switch`.
 *   - `HorizontalDivider(padding(vertical = 8.dp, horizontal = 16.dp), color = onPrimaryContainer)`
 *     separates the OS permissions from the telemetry switches (only when telemetry is included).
 *   - `ListItemDefaults.colors(containerColor = Color.Transparent)`; headline = bodyLarge,
 *     supporting content = bodyMedium.
 *
 * Material 3 geometry reproduced here (compose/material3 tokens):
 *   - ListItem (expressive overload, `ListItemDefaults.ContentPadding`):
 *     start = ListTokens.ItemLeadingSpace (16dp), end = ListTokens.ItemTrailingSpace (16dp),
 *     top = ItemTopSpace (10dp), bottom = ItemBottomSpace (10dp);
 *     trailing content gets an extra `ItemBetweenSpace` (12dp) gap before it;
 *     two-line item min height = ItemTwoLineContainerHeight (72dp);
 *     headline = bodyLarge (16sp/24sp) in onSurface,
 *     supporting content = bodyMedium (14sp/20sp) in onSurfaceVariant.
 *   - OutlinedButton: min width 58dp, min height 40dp, content padding 24dp horizontal + 8dp
 *     vertical, corner full (20dp), 1dp OutlineVariant border, label labelLarge (14sp/20sp,
 *     weight 500) in onSurfaceVariant, icon 24dp.
 *   - Switch: track 52x32dp, corner full, 2dp outline (unchecked) / transparent (checked),
 *     unchecked track SurfaceContainerHighest with a 16dp Outline thumb at 8dp, checked track
 *     Primary with a 24dp OnPrimary thumb at 24dp. The reference `Switch` has no `thumbContent`,
 *     so the thumb carries no icon.
 *   - HorizontalDivider: 1dp thickness, colour onPrimaryContainer, 8dp vertical padding.
 *
 * Web caveats (Android-only APIs) — stubbed, not hidden:
 *   - "Install apps permission" (APK extension installation) is an Android system permission and
 *     does not exist in the browser -> the button opens an MD3 AlertDialog stating that the
 *     feature is not supported in the web version.
 *   - "Background battery usage" (battery optimisation exemption) is an Android OS setting ->
 *     same "not supported" dialog.
 *   - "Notification permission" is approximated with the standard browser `Notification` API.
 *     The reference only shows that row on Android 13+ (TIRAMISU), which is the only case a
 *     modern browser can map to.
 *   - Crash logs / analytics switches mirror the reference layout and keep the values locally
 *     (reference default is `true` for both); nothing is ever transmitted from the web client.
 */
import { onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{ telemetry?: boolean }>(), { telemetry: true })

const STORAGE_KEY = 'mihon-vue:onboarding:permissions'

/** Notification permission granted state (Android 13+ equivalent). */
const notificationGranted = ref(false)
/** Install-apps permission: never granted in a browser. */
const installGranted = ref(false)
/** Battery optimisation exemption: never granted in a browser. */
const batteryGranted = ref(false)

/** Telemetry switches; persisted locally only. Reference defaults are both `true`. */
const crashlytics = ref(true)
const analytics = ref(true)

const dialogOpen = ref(false)
const dialogTitle = ref('')
const dialogText = ref('')

function showUnsupported(title: string, text: string) {
  dialogTitle.value = title
  dialogText.value = text
  dialogOpen.value = true
}

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as { crashlytics?: boolean; analytics?: boolean }
    if (typeof parsed.crashlytics === 'boolean') crashlytics.value = parsed.crashlytics
    if (typeof parsed.analytics === 'boolean') analytics.value = parsed.analytics
  } catch {
    /* ignore malformed local state */
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ crashlytics: crashlytics.value, analytics: analytics.value }))
  } catch {
    /* storage may be unavailable */
  }
}

function onToggleCrashlytics(value: boolean) {
  crashlytics.value = value
  persist()
}

function onToggleAnalytics(value: boolean) {
  analytics.value = value
  persist()
}

function onGrantInstall() {
  showUnsupported(
    'Install apps permission',
    'Installing apps is an Android system permission and is not supported in the web version. Source extensions are managed on your Suwayomi-Server.',
  )
}

function onGrantBattery() {
  showUnsupported(
    'Background battery usage',
    'Exempting the app from battery optimisation is an Android system setting and is not supported in the web version.',
  )
}

async function onGrantNotifications() {
  if (typeof Notification === 'undefined') {
    showUnsupported(
      'Notification permission',
      'This browser does not expose the Notification API, so notifications cannot be enabled in the web version.',
    )
    return
  }
  try {
    const result = await Notification.requestPermission()
    notificationGranted.value = result === 'granted'
  } catch {
    showUnsupported(
      'Notification permission',
      'The browser refused the notification permission request.',
    )
  }
}

onMounted(() => {
  loadStored()
  notificationGranted.value = typeof Notification !== 'undefined' && Notification.permission === 'granted'
})
</script>

<template>
  <div class="permission-step">
    <!-- PermissionCheckbox: install apps permission -->
    <div class="permission-item">
      <div class="permission-item__text">
        <p class="permission-item__title">Install apps permission</p>
        <p class="permission-item__subtitle">To install source extensions.</p>
      </div>
      <div class="permission-item__trailing">
        <button
          type="button"
          class="permission-button"
          :disabled="installGranted"
          :aria-label="installGranted ? 'Install apps permission granted' : 'Grant install apps permission'"
          @click="onGrantInstall"
        >
          <span v-if="installGranted" class="material-symbols-rounded permission-button__icon" aria-hidden="true">check</span>
          <span v-else class="permission-button__label">Grant</span>
        </button>
      </div>
    </div>

    <!-- PermissionCheckbox: notification permission (reference shows it on Android 13+) -->
    <div class="permission-item">
      <div class="permission-item__text">
        <p class="permission-item__title">Notification permission</p>
        <p class="permission-item__subtitle">Get notified for library updates and more.</p>
      </div>
      <div class="permission-item__trailing">
        <button
          type="button"
          class="permission-button"
          :disabled="notificationGranted"
          :aria-label="notificationGranted ? 'Notification permission granted' : 'Grant notification permission'"
          @click="onGrantNotifications"
        >
          <span v-if="notificationGranted" class="material-symbols-rounded permission-button__icon" aria-hidden="true">check</span>
          <span v-else class="permission-button__label">Grant</span>
        </button>
      </div>
    </div>

    <!-- PermissionCheckbox: battery optimisation exemption -->
    <div class="permission-item">
      <div class="permission-item__text">
        <p class="permission-item__title">Background battery usage</p>
        <p class="permission-item__subtitle">Avoid interruptions to long-running library updates, downloads, and backup restores.</p>
      </div>
      <div class="permission-item__trailing">
        <button
          type="button"
          class="permission-button"
          :disabled="batteryGranted"
          :aria-label="batteryGranted ? 'Background battery usage granted' : 'Grant background battery usage'"
          @click="onGrantBattery"
        >
          <span v-if="batteryGranted" class="material-symbols-rounded permission-button__icon" aria-hidden="true">check</span>
          <span v-else class="permission-button__label">Grant</span>
        </button>
      </div>
    </div>

    <!-- HorizontalDivider(padding(vertical = 8.dp, horizontal = 16.dp), color = onPrimaryContainer) -->
    <div v-if="props.telemetry" class="permission-divider" role="separator" />

    <!-- PermissionSwitch: crashlytics -->
    <div v-if="props.telemetry" class="permission-item">
      <div class="permission-item__text">
        <p class="permission-item__title">Send crash logs</p>
        <p class="permission-item__subtitle">Send anonymized crash logs to the developers.</p>
      </div>
      <div class="permission-item__trailing">
        <button
          type="button"
          class="permission-switch"
          role="switch"
          :aria-checked="crashlytics"
          aria-label="Send crash logs"
          @click="onToggleCrashlytics(!crashlytics)"
        >
          <span class="permission-switch__track">
            <span class="permission-switch__thumb" />
          </span>
        </button>
      </div>
    </div>

    <!-- PermissionSwitch: analytics -->
    <div v-if="props.telemetry" class="permission-item">
      <div class="permission-item__text">
        <p class="permission-item__title">Allow analytics</p>
        <p class="permission-item__subtitle">Send anonymized usage data to improve app features.</p>
      </div>
      <div class="permission-item__trailing">
        <button
          type="button"
          class="permission-switch"
          role="switch"
          :aria-checked="analytics"
          aria-label="Allow analytics"
          @click="onToggleAnalytics(!analytics)"
        >
          <span class="permission-switch__track">
            <span class="permission-switch__thumb" />
          </span>
        </button>
      </div>
    </div>

    <!-- Stub for the Android-only system permissions. -->
    <v-dialog v-model="dialogOpen" max-width="360">
      <v-card rounded="28px" color="surface-container-high">
        <v-card-title class="permission-dialog__title">{{ dialogTitle }}</v-card-title>
        <v-card-text class="permission-dialog__text">{{ dialogText }}</v-card-text>
        <v-card-actions class="permission-dialog__actions">
          <v-spacer />
          <v-btn variant="text" color="primary" @click="dialogOpen = false">OK</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
@layer app-components {
  /* Column { ... } — the step content is transparent, the onboarding screen paints the surface. */
  .permission-step {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  /*
   * Material3 ListItem (expressive overload, ListItemDefaults.ContentPadding):
   *   - start = ItemLeadingSpace 16dp, end = ItemTrailingSpace 16dp
   *   - top = ItemTopSpace 10dp, bottom = ItemBottomSpace 10dp
   *   - two line item: min height ItemTwoLineContainerHeight 72dp
   *   - headline = bodyLarge (16sp / 24sp) in onSurface
   *   - supporting content = bodyMedium (14sp / 20sp) in onSurfaceVariant
   *   - container colour is Color.Transparent
   */
  .permission-item {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    min-height: 72px;
    padding: 10px 16px;
  }

  .permission-item__text {
    flex: 1 1 auto;
    min-width: 0;
  }

  .permission-item__title {
    margin: 0;
    color: rgb(var(--v-theme-on-surface));
    font-family: Roboto, sans-serif;
    font-size: 16px;
    line-height: 24px;
    font-weight: 400;
    letter-spacing: 0.03125em;
  }

  .permission-item__subtitle {
    margin: 0;
    color: rgb(var(--v-theme-on-surface-variant));
    font-family: Roboto, sans-serif;
    font-size: 14px;
    line-height: 20px;
    font-weight: 400;
    letter-spacing: 0.0178571em;
  }

  /* TrailingDecorator: padding(start = ItemBetweenSpace 12dp) before the trailing content. */
  .permission-item__trailing {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    padding-left: 12px;
  }

  /*
   * Material3 OutlinedButton:
   *   - min width 58dp, min height 40dp, corner full (20dp), 1dp OutlineVariant border
   *   - content padding 24dp horizontal, 8dp vertical
   *   - label = labelLarge (14sp / 20sp, weight 500) in onSurfaceVariant
   *   - disabled: label onSurfaceVariant at 38%, border OutlineVariant at 10%
   */
  .permission-button {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    min-width: 58px;
    padding: 8px 24px;
    border: 1px solid rgb(var(--v-theme-outline-variant));
    border-radius: 20px;
    background: transparent;
    color: rgb(var(--v-theme-on-surface-variant));
    font-family: Roboto, sans-serif;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    letter-spacing: 0.0071428571em;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color .2s cubic-bezier(.2, 0, 0, 1);
  }

  /* MD3 state layer on the content colour: 8% on hover, 10% while pressed. */
  @media (hover: hover) {
    .permission-button:hover:not(:disabled) {
      background: color-mix(in srgb, rgb(var(--v-theme-on-surface-variant)) 8%, transparent);
    }
  }

  .permission-button:active:not(:disabled) {
    background: color-mix(in srgb, rgb(var(--v-theme-on-surface-variant)) 10%, transparent);
  }

  .permission-button:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: 2px;
  }

  .permission-button:disabled {
    color: color-mix(in srgb, rgb(var(--v-theme-on-surface-variant)) 38%, transparent);
    border-color: color-mix(in srgb, rgb(var(--v-theme-outline-variant)) 10%, transparent);
    cursor: default;
  }

  .permission-button__label {
    display: inline-block;
  }

  /* MaterialSymbols.Rounded.Check, 24dp, tinted colorScheme.primary. */
  .permission-button__icon {
    width: 24px;
    height: 24px;
    font-size: 24px;
    line-height: 24px;
    color: rgb(var(--v-theme-primary));
  }

  /*
   * Material3 Switch (no thumbContent in the reference, so the thumb carries no icon):
   *   - track 52x32dp, corner full, 2dp outline when unchecked / transparent when checked
   *   - unchecked: track SurfaceContainerHighest, 16dp Outline thumb at 8dp
   *   - checked: track Primary, 24dp OnPrimary thumb at 24dp
   */
  .permission-switch {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    touch-action: manipulation;
  }

  .permission-switch:focus-visible {
    outline: 2px solid rgb(var(--v-theme-secondary));
    outline-offset: 2px;
  }

  .permission-switch__track {
    position: relative;
    box-sizing: border-box;
    display: inline-block;
    width: 52px;
    height: 32px;
    border-radius: 16px;
    background: rgb(var(--v-theme-surface-container-highest));
    box-shadow: inset 0 0 0 2px rgb(var(--v-theme-outline));
    transition: background-color .2s cubic-bezier(.2, 0, 0, 1), box-shadow .2s cubic-bezier(.2, 0, 0, 1);
  }

  .permission-switch__thumb {
    position: absolute;
    top: 8px;
    left: 8px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgb(var(--v-theme-outline));
    transition: transform .2s cubic-bezier(.2, 0, 0, 1), width .2s cubic-bezier(.2, 0, 0, 1),
      height .2s cubic-bezier(.2, 0, 0, 1), background-color .2s cubic-bezier(.2, 0, 0, 1);
  }

  @media (hover: hover) {
    .permission-switch:hover:not([aria-checked='true']) .permission-switch__thumb {
      background: rgb(var(--v-theme-on-surface-variant));
    }

    .permission-switch:hover[aria-checked='true'] .permission-switch__thumb {
      background: rgb(var(--v-theme-primary-container));
    }
  }

  /* The checked track has no outline (checkedBorderColor = Color.Transparent). */
  .permission-switch[aria-checked='true'] .permission-switch__track {
    background: rgb(var(--v-theme-primary));
    box-shadow: none;
  }

  .permission-switch[aria-checked='true'] .permission-switch__thumb {
    width: 24px;
    height: 24px;
    top: 4px;
    left: 24px;
    background: rgb(var(--v-theme-on-primary));
  }

  /* HorizontalDivider: 1dp thickness, colour onPrimaryContainer, 8dp vertical padding. */
  .permission-divider {
    height: 1px;
    margin: 8px 16px;
    background-color: rgb(var(--v-theme-on-primary-container));
  }

  /* MD3 AlertDialog: surface-container-high, CornerExtraLarge (28dp), title headlineSmall
     (24sp/32sp) in on-surface, text bodyMedium (14sp/20sp) in on-surface-variant. */
  .permission-dialog__title {
    font-size: 24px;
    line-height: 32px;
    font-weight: 400;
  }

  .permission-dialog__text {
    font-size: 14px;
    line-height: 20px;
    color: rgb(var(--v-theme-on-surface-variant));
  }

  .permission-dialog__actions {
    justify-content: flex-end;
  }
}
</style>
