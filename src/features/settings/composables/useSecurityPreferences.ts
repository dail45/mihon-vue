/**
 * Security-related preferences that have no Suwayomi server counterpart.
 *
 * Reference: mihon/core/common/src/main/kotlin/eu/kanade/tachiyomi/core/security/SecurityPreferences.kt
 * (`hide_notification_content`, `secure_screen_v2`).
 *
 * Only harmless, local UI flags are stored. No credentials, no tokens, no server state.
 */
import { ref, watch } from 'vue'
import { readPreference, writePreference } from '../stores/preferences'

export type SecureScreenMode = 'always' | 'incognito' | 'never'

const HIDE_NOTIFICATION_KEY = 'mihon.security.hideNotificationContent'
const SECURE_SCREEN_KEY = 'mihon.security.secureScreen'
// SecurityPreferences.kt: `use_biometric_lock` (default false) and `lock_app_after` (default 0).
const USE_AUTHENTICATOR_KEY = 'mihon.security.useAuthenticator'
const LOCK_APP_AFTER_KEY = 'mihon.security.lockAppAfter'

export function readSecureScreenMode(): SecureScreenMode {
  const raw = readPreference(SECURE_SCREEN_KEY)
  return raw === 'always' || raw === 'incognito' || raw === 'never' ? raw : 'incognito'
}

export function useSecurityPreferences() {
  const hideNotificationContent = ref(readPreference(HIDE_NOTIFICATION_KEY) === 'true')
  watch(hideNotificationContent, value => writePreference(HIDE_NOTIFICATION_KEY, String(value)))

  const secureScreen = ref<SecureScreenMode>(readSecureScreenMode())
  watch(secureScreen, value => writePreference(SECURE_SCREEN_KEY, value))

  // App lock: the biometric prompt itself is Android-only, but the preference state and
  // the "lock when idle" list stay in sync with the reference defaults.
  const useAuthenticator = ref(readPreference(USE_AUTHENTICATOR_KEY) === 'true')
  watch(useAuthenticator, value => writePreference(USE_AUTHENTICATOR_KEY, String(value)))

  const storedLockAppAfter = Number(readPreference(LOCK_APP_AFTER_KEY))
  const lockAppAfter = ref(Number.isInteger(storedLockAppAfter) ? storedLockAppAfter : 0)
  watch(lockAppAfter, value => writePreference(LOCK_APP_AFTER_KEY, String(value)))

  return { hideNotificationContent, secureScreen, useAuthenticator, lockAppAfter }
}
