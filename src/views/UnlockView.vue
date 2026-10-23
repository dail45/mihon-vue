<script setup lang="ts">
/**
 * Unlock screen — native Android biometric unlock.
 *
 * Reference (Mihon, pinned commit 446f6df):
 *   eu.kanade.tachiyomi.ui.security.UnlockActivity
 *     - "Blank activity with a BiometricPrompt." The activity itself draws no UI.
 *       AndroidManifest.xml:167-170 declares it with
 *       `android:theme="@style/Theme.Tachiyomi"`, `android:exported="false"`.
 *     - onCreate() calls
 *       `startAuthentication(stringResource(MR.strings.unlock_app_title,
 *         stringResource(MR.strings.app_name)), confirmationRequired = false, callback)`.
 *     - The host activity transition is overridden to 0/0, so the prompt appears
 *       without any animation (SecureActivityDelegateImpl.setAppLock()).
 *   eu.kanade.tachiyomi.util.system.AuthenticatorUtil
 *     - startAuthentication() -> startClass2BiometricOrCredentialAuthentication(
 *       title, subtitle = null, confirmationRequired, executor, callback):
 *       the AndroidX BiometricPrompt (Class 2 biometric OR device credential).
 *     - isAuthenticationSupported() = BiometricManager.canAuthenticate(
 *       BIOMETRIC_WEAK or DEVICE_CREDENTIAL) == BIOMETRIC_SUCCESS.
 *     - AuthenticationCallback.onAuthenticationError -> isAuthenticating = false.
 *     - AuthenticationCallback.onAuthenticationSucceeded -> isAuthenticating = false.
 *   eu.kanade.tachiyomi.ui.base.delegate.SecureActivityDelegate
 *     - The lock screen is entered from setAppLock() when
 *       `securityPreferences.useAuthenticator` is on and authentication is supported.
 *     - On success: SecureActivityDelegate.unlock() + UnlockActivity.finish().
 *     - On error: UnlockActivity calls finishAffinity() (the whole task is closed).
 *
 * Strings (i18n/base/strings.xml):
 *   unlock_app_title = "Unlock %s"   (app_name = "Mihon")
 *
 * Web limitation: the prompt is an Android system dialog driven by androidx.biometric
 * (fingerprint / face / device credential). The browser exposes no equivalent API and
 * Suwayomi-Server has no "app lock" contract, so the real authentication flow cannot
 * be reproduced. This view is an accurate visual stand-in for the AndroidX
 * BiometricPrompt (material3) sheet:
 *   - blank theme surface behind, system scrim over it,
 *   - 48dp app icon, headlineSmall title, bodyMedium supporting text,
 *   - MD3 text buttons ("Cancel" / "Use fingerprint") at the bottom,
 * and it states plainly that the feature is unavailable in the web version.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

/** MR.strings.app_name is substituted into MR.strings.unlock_app_title ("Unlock %s"). */
const appName = 'Mihon Vue'
/** MR.strings.unlock_app_title */
const title = computed(() => `Unlock ${appName}`)

/**
 * UnlockActivity.onAuthenticationError() calls finishAffinity(), which closes the
 * whole task. In the browser the closest equivalent is leaving the lock screen, so
 * the cancel action goes back in history and falls back to the library.
 */
function cancel() {
  if (typeof window.history.state?.back === 'string') {
    router.back()
    return
  }
  void router.push('/library')
}
</script>

<template>
  <div class="unlock-screen" role="dialog" aria-modal="true" :aria-label="title">
    <div class="unlock-screen__scrim" />
    <div class="unlock-screen__sheet">
      <div class="unlock-screen__icon" aria-hidden="true">
        <v-icon icon="auto_stories" size="48" class="filled-symbol" />
      </div>

      <h1 class="unlock-screen__title text-headline-small">{{ title }}</h1>

      <p class="unlock-screen__message text-body-medium">
        Biometric unlock is not supported in the web version. The library stays
        available through your Suwayomi server address and browser session.
      </p>

      <div class="unlock-screen__actions">
        <v-btn variant="text" class="unlock-screen__action" @click="cancel">Cancel</v-btn>
        <v-btn variant="text" color="primary" class="unlock-screen__action" disabled>
          Use fingerprint
        </v-btn>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* UnlockActivity is a blank activity on Theme.Tachiyomi that only hosts the
   BiometricPrompt, so the surface behind the prompt is the plain app surface. */
.unlock-screen {
  position: fixed;
  inset: 0;
  /* Above the Vuetify app bar (z-index 4) and the bottom navigation. */
  z-index: 2401;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

/* The system dialog scrim over the blank activity. */
.unlock-screen__scrim {
  position: absolute;
  inset: 0;
  background: rgb(var(--v-theme-on-surface) / 32%);
}

/* AndroidX BiometricPrompt (material3): 28dp corner radius, surfaceContainerHigh,
   elevation level 6, 24dp content padding. */
.unlock-screen__sheet {
  position: relative;
  z-index: 1;
  width: min(400px, calc(100vw - 48px));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  box-shadow: 0 6px 12px rgb(var(--v-theme-on-surface) / 15%);
}

/* Prompt icon: 48dp, centred above the title. */
.unlock-screen__icon {
  display: grid;
  place-items: center;
  color: rgb(var(--v-theme-primary));
}

/* Title: headlineSmall — 24sp / 32sp, onSurface, centred. */
.unlock-screen__title {
  margin-top: 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: 0;
  text-align: center;
  color: rgb(var(--v-theme-on-surface));
}

/* Supporting text: bodyMedium — 14sp / 20sp, onSurfaceVariant, centred. */
.unlock-screen__message {
  margin-top: 8px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: .25px;
  text-align: center;
  color: rgb(var(--v-theme-on-surface-variant));
  max-width: 34ch;
}

/* Action row: MD3 text buttons, labelLarge 14sp / 20sp Medium, end aligned. */
.unlock-screen__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
  margin-top: 24px;
}

.unlock-screen__action {
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .1px;
  text-transform: none;
}
</style>
