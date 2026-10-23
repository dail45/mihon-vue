<script setup lang="ts">
/**
 * TrackerLoginView — web port of Mihon's
 * `eu.kanade.tachiyomi.ui.setting.track.TrackLoginActivity`
 * (mihon/app/src/main/java/eu/kanade/tachiyomi/ui/setting/track/TrackLoginActivity.kt)
 * together with its base class
 * `eu.kanade.tachiyomi.ui.setting.track.BaseOAuthLoginActivity`.
 *
 * Reference behaviour (mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1):
 *   BaseOAuthLoginActivity.onCreate {
 *     setComposeContent { LoadingScreen() }
 *     val data = intent.data
 *     if (data == null) returnToSettings() else handleResult(data)
 *   }
 *   TrackLoginActivity.handleResult(uri) {
 *     val data = (uri.encodedQuery ?: uri.encodedFragment)
 *       ?.split("&")?.filter { it.isNotBlank() }
 *       ?.associate { it.split("=", limit = 2).map(Uri::decode)[0] to ...getOrNull(1) }
 *       .orEmpty()
 *     when (uri.host) {
 *       "anilist-auth"      -> handleAniList(data["access_token"])
 *       "comick-auth"       -> handleComick(data["code"], data["state"])
 *       "bangumi-auth"      -> handleBangumi(data["code"])
 *       "mangabaka-auth"    -> handleMangaBaka(data["code"], data["state"])
 *       "myanimelist-auth"  -> handleMyAnimeList(data["code"])
 *       "shikimori-auth"    -> handleShikimori(data["code"])
 *       "hikka-auth"        -> handleHikka(data["reference"])
 *     }
 *     returnToSettings()
 *   }
 *
 *   - the screen itself is only `LoadingScreen()`
 *     (Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() },
 *      mihon/presentation-core/src/main/java/tachiyomi/presentation/core/screens/LoadingScreen.kt:11-18):
 *     there is no app bar, no title, no button, no scrollable content and no
 *     surface container — the activity window shows the theme background.
 *   - the credential is taken from the query, or from the fragment when the query
 *     is empty (AniList returns the token in the fragment).
 *   - a missing credential logs the tracker out (`handleAniList(null)` → logout()).
 *   - Comick/MangaBaka additionally verify the `state` parameter; a wrong or
 *     missing state aborts the login.
 *   - the activity always finishes and returns to the settings screen
 *     (`returnToSettings()` → MainActivity, FLAG_ACTIVITY_CLEAR_TOP | SINGLE_TOP).
 *   - failures are never rendered on this screen: the reference logs them
 *     (`logcat(LogPriority.WARN)`) and the Comick scope error is shown as an
 *     Android toast (LENGTH_LONG) on the next activity.
 *
 * Web adaptation:
 *   - Suwayomi-Server performs the credential exchange itself
 *     (`Tracker.authCallback` → `Tracker.extractToken`), so the client hands the
 *     callback URL to `loginTrackerOAuth` instead of talking to the tracker.
 *   - The activity "intent data" is the route query
 *     `/tracker-login?host=<host>&<credential>=<value>[&state=<value>]`;
 *     `host` mirrors the deep-link hosts of Mihon's intent filters
 *     (mihon/app/src/main/AndroidManifest.xml:182-212).
 *   - Trackers Mihon knows but Suwayomi does not implement (Comick, MangaBaka,
 *     Hikka) are reported as unsupported instead of being hidden.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Md3CircularProgress from '../components/Md3CircularProgress.vue'
import { useSuwayomiStore } from '../stores/suwayomi'
import {
  loginTrackerOAuth,
  logoutTracker,
  parseTrackerCallback,
  SUWAYOMI_TRACKER_IDS,
  trackerCallbackUrl,
} from '../api/trackerLogin'

const route = useRoute()
const router = useRouter()
const server = useSuwayomiStore()

type Phase = 'loading' | 'unsupported' | 'error'

const phase = ref<Phase>('loading')
const trackerName = ref('')
/** The Android toast of the reference (Comick scope error), rendered as a toast. */
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
let returnTimer: ReturnType<typeof setTimeout> | undefined

/** The callback host: `?host=anilist-auth` (Mihon's deep-link host). */
const host = computed(() => String(route.query.host ?? ''))

/** Mihon-only trackers; Suwayomi-Server does not implement them. */
const MIHON_ONLY_HOSTS: Record<string, string> = {
  'comick-auth': 'Comick',
  'mangabaka-auth': 'MangaBaka',
  'hikka-auth': 'Hikka',
}

/** Display names of the trackers Suwayomi implements. */
const TRACKER_NAMES: Record<string, string> = {
  'anilist-auth': 'AniList',
  'myanimelist-auth': 'MyAnimeList',
  'shikimori-auth': 'Shikimori',
  'bangumi-auth': 'Bangumi',
}

/** Android `Toast.LENGTH_LONG` (~3.5 s). */
const TOAST_DURATION = 3500

function returnToSettings() {
  // Mihon: returnToSettings() → MainActivity with CLEAR_TOP | SINGLE_TOP.
  void router.replace({ path: '/settings/tracking' })
}

/** The reference reports a failure with an Android toast, then leaves the screen. */
function showToast(message: string) {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, TOAST_DURATION)
}

/** Mihon: `returnToSettings()` is called after the callback was handled. */
function returnAfterToast() {
  if (returnTimer) clearTimeout(returnTimer)
  returnTimer = setTimeout(() => returnToSettings(), TOAST_DURATION)
}

onMounted(async () => {
  const callbackHost = host.value
  if (!callbackHost) {
    // BaseOAuthLoginActivity: intent.data == null → returnToSettings().
    returnToSettings()
    return
  }

  const mihonOnly = MIHON_ONLY_HOSTS[callbackHost]
  if (mihonOnly) {
    // Mihon supports these trackers, Suwayomi-Server does not implement them.
    trackerName.value = mihonOnly
    phase.value = 'unsupported'
    return
  }

  const trackerId = SUWAYOMI_TRACKER_IDS[callbackHost]
  if (!trackerId) {
    phase.value = 'unsupported'
    return
  }

  // The credential may arrive in the query or in the fragment (AniList).
  const location = window.location
  const parsed = parseTrackerCallback({
    host: callbackHost,
    search: location.search,
    hash: location.hash,
  })
  const credential = parsed?.credential ?? null
  trackerName.value = TRACKER_NAMES[callbackHost] ?? callbackHost

  if (!credential) {
    // Mihon: handleAniList(null) / handleMyAnimeList(null) → tracker.logout().
    try {
      await logoutTracker(server.apiUrl, trackerId)
    } catch {
      // A failed logout must not block the return to the settings screen.
    }
    showToast(`${trackerName.value} did not return a login token and was logged out.`)
    phase.value = 'error'
    returnAfterToast()
    return
  }

  try {
    await loginTrackerOAuth(server.apiUrl, trackerId, trackerCallbackUrl(callbackHost, credential))
  } catch (error) {
    // Mihon: `logcat(LogPriority.WARN)` — the reference shows no error on this screen.
    showToast(`${trackerName.value} login failed. ${error instanceof Error ? error.message : ''}`.trim())
    phase.value = 'error'
    returnAfterToast()
    return
  }
  // Mihon: returnToSettings() right after the credential was handled.
  returnToSettings()
})

onUnmounted(() => {
  if (toastTimer) clearTimeout(toastTimer)
  if (returnTimer) clearTimeout(returnTimer)
})
</script>

<template>
  <!--
    Surface(Modifier.fillMaxSize()): the activity window covers the whole
    screen, so the app bar and the bottom navigation of the shell are hidden.
    The background is the theme background (`android:colorBackground`).
  -->
  <div class="tracker-login">
    <!-- LoadingScreen(): Box(fillMaxSize, contentAlignment = Alignment.Center) { CircularProgressIndicator() } -->
    <div class="tracker-login__content">
      <Md3CircularProgress class="tracker-login__indicator" />

      <!--
        A tracker that Suwayomi-Server does not implement cannot log in at
        all: the honest stub keeps the reference look and explains the reason.
      -->
      <p v-if="phase === 'unsupported'" class="tracker-login__message">
        {{
          trackerName
            ? `${trackerName} login is not supported in the web version. Suwayomi-Server does not implement this tracker.`
            : 'This tracker login link is not supported in the web version.'
        }}
      </p>
    </div>

    <!-- Android toast of the reference (`toast(e.message, Toast.LENGTH_LONG)`). -->
    <div v-if="toast" class="tracker-login__toast" role="status" aria-live="polite">
      {{ toast }}
    </div>
  </div>
</template>

<style scoped>
@layer app-components {
/* The native screen is a separate activity without any chrome, so the whole
   window is covered: the theme background, no app bar, no bottom navigation. */
.tracker-login {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}

/* Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) */
.tracker-login__content {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding-left: calc(env(safe-area-inset-left, 0px) + 24px);
  padding-right: calc(env(safe-area-inset-right, 0px) + 24px);
  text-align: center;
}

/* CircularProgressIndicator(): 40dp diameter, 4dp round-capped arc. */
.tracker-login__indicator {
  display: block;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  line-height: 0;
}

/* The default text style of the reference is `bodySmall` (setComposeContent
   provides LocalTextStyle = MaterialTheme.typography.bodySmall). */
.tracker-login__message {
  margin: 0;
  max-width: 100%;
  font-family: var(--v-font-body, 'Roboto', sans-serif);
  /* bodySmall: 12sp / 16sp / 400 / 0.4sp */
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.4px;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* Android toast: a small dark rounded card at the bottom of the window. */
.tracker-login__toast {
  position: fixed;
  left: 50%;
  bottom: 48px;
  transform: translateX(-50%);
  z-index: 2;
  box-sizing: border-box;
  max-width: min(560px, calc(100vw - 32px));
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.28), 0 1px 2px rgba(0, 0, 0, 0.2);
}
}
</style>
