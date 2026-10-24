<script setup lang="ts">
/**
 * App shell — pixel parity target:
 *   mihon/app/src/main/java/eu/kanade/tachiyomi/ui/main/MainActivity.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/components/Banners.kt
 *
 * The reference `MainActivity` is the container of the whole app. Its responsibilities that have
 * a web counterpart are reproduced here:
 *
 *  - `Scaffold(topBar = AppStateBanners(downloadedOnly, incognito, indexing))` — the state banners
 *    above the content (Banners.kt). See `src/components/AppStateBanners.vue`.
 *  - `statusBarBackgroundColor` — the reference paints the system bars with the colour of the
 *    active banner (indexing -> secondary, downloaded only -> tertiary, incognito -> primary,
 *    otherwise -> surface). The browser equivalent is the `theme-color` meta tag.
 *  - `handleIntentAction(intent, navigator)` — the launcher shortcuts and the deep links of the
 *    reference. A browser has no intent system, so the same entry points are URL parameters,
 *    resolved by `src/utils/deepLinks.ts`.
 *  - `ShowOnboarding()` — the onboarding flow is pushed over the home screen when it was never
 *    completed (`preferences.shownOnboardingFlow`).
 *  - `ShowDonationCampaign()` — the donation sheet, shown once the app has been installed for
 *    6 * 30 days and the campaign was not dismissed yet.
 *  - the navigation bar scrim (`isNavigationBarNeedsScrim()`): a 0.8 alpha `surfaceContainer`
 *    strip behind the system navigation bar.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { version as vuetifyVersion, useDisplay, useTheme } from 'vuetify'
import { useTabletUi } from './composables/useTabletUi'
import { useBottomNavVisibility } from './composables/useBottomNavVisibility'
import { usePreferencesStore } from './stores/preferences'
import { useSuwayomiStore } from './stores/suwayomi'
import { readDownloadQueue } from './api/downloads'
import { resolveDeepLink } from './utils/deepLinks'
import AppStateBanners from './components/AppStateBanners.vue'
import DonationCampaignSheet from './components/DonationCampaignSheet.vue'
import OnboardingView from './views/OnboardingView.vue'
import { stringResource, MR } from './i18n'
import { useAppearancePreferences } from './composables/useAppearancePreferences'

const route = useRoute(), router = useRouter(), preferences = usePreferencesStore(), server = useSuwayomiStore()
const { bottomNavVisible } = useBottomNavVisibility()
const tabletUi = useTabletUi(), { width } = useDisplay()
const theme = useTheme()
const { applyCurrentTheme } = useAppearancePreferences()
const media = window.matchMedia('(prefers-color-scheme: dark)'), systemDark = ref(media.matches)
const updateSystemTheme = (e: MediaQueryListEvent) => { systemDark.value = e.matches }
onMounted(() => {
  media.addEventListener('change', updateSystemTheme)
  applyCurrentTheme()
})
onUnmounted(() => media.removeEventListener('change', updateSystemTheme))
const dark = computed(() => preferences.themeMode === 'dark' || (preferences.themeMode === 'system' && systemDark.value))
watch(dark, value => {
  theme.change(value ? 'mihonDark' : 'mihonLight')
  applyCurrentTheme()
}, { immediate: true })

/**
 * The `theme-color` meta tag paints the browser chrome like the reference paints the system bars:
 * `indexing -> secondary`, `downloadedOnly -> tertiary`, `incognito -> primary`, otherwise the
 * `surface` colour (MainActivity.kt:220-235).
 */
const indexing = ref(false)
const bannerColor = computed(() => {
  const colors = theme.global.current.value.colors
  if (indexing.value) return colors.secondary
  if (preferences.downloadedOnly) return colors.tertiary
  if (preferences.incognitoMode) return colors.primary
  return colors.surface
})
watch(bannerColor, color => {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', String(color))
}, { immediate: true })

const navItems = computed(() => [
  { title: stringResource(MR.strings.label_library) || 'Library', icon: 'collections_bookmark', path: '/library' },
  { title: stringResource(MR.strings.label_recent_updates) || 'Updates', icon: 'update', path: '/updates' },
  { title: stringResource(MR.strings.label_recent_manga) || 'History', icon: 'history', path: '/history' },
  { title: stringResource(MR.strings.browse) || 'Browse', icon: 'explore', path: '/browse' },
  { title: stringResource(MR.strings.label_more) || 'More', icon: 'more_horiz', path: '/more' },
])
const activeNav = computed(() => route.path.startsWith('/manga/') ? '/library' : route.path)
const twoPaneSettings = computed(() => preferences.tabletUiMode === 'always' || (tabletUi.value && width.value >= 600))
const toolbarTitle = computed(() => route.path.startsWith('/settings') && twoPaneSettings.value ? (stringResource(MR.strings.label_settings) || 'Settings') : route.meta.catalogue ? server.sources.find(s => s.id === route.params.sourceId)?.displayName || 'Source' : route.meta.title ? (stringResource(route.meta.title as string) || route.meta.title) : '')
/**
 * SettingsMainScreen.kt renders a search action (MaterialSymbols.Rounded.Search) in the app bar
 * of the settings screen; it opens `SettingsSearchScreen`. The action belongs to the settings
 * list, so it is shown on the settings screen and on the two pane layout, where the list stays
 * visible next to the detail pane.
 */
const settingsSearchAction = computed(() => route.path.startsWith('/settings') && route.path !== '/settings/search' && (route.path === '/settings' || twoPaneSettings.value))
function back() {
  if (route.path === '/about/licenses') { void router.push('/about'); return }
  if (route.path.startsWith('/settings/debug/')) { void router.push('/settings/advanced/debug'); return }
  if (route.path.startsWith('/settings/advanced/')) { void router.push('/settings/advanced'); return }
  if (route.path.startsWith('/settings/')) { void router.push('/settings'); return }
  if (route.path === '/settings' || route.path === '/about' || route.path === '/categories' || route.path === '/download-queue' || route.path === '/support-us' || route.path === '/stats') { void router.push('/more'); return }
  if (route.meta.catalogue) { void router.push('/browse'); return }
  /* The screens opened from the Browse tab actions return to the tab they came from. */
  if (route.path.startsWith('/browse/')) { void router.push('/browse'); return }
  if (typeof window.history.state?.back === 'string' && window.history.state.back.startsWith('/browse/source/')) { router.back(); return }
  void router.push('/library')
}

/* ------------------------------------------------------------------ deep links -- */

/**
 * `handleIntentAction` (MainActivity.kt:592-667). The reference receives launcher shortcuts and
 * deep links as Android intents; the web shell receives them as URL parameters, so the mapping
 * lives in `src/utils/deepLinks.ts` and the resolved target is applied here.
 */
const restoreBackupNotice = ref(false)
function applyDeepLink() {
  const target = resolveDeepLink(window.location.search)
  if (!target) return
  /* The parameters are consumed once: the address bar keeps a clean URL. */
  window.history.replaceState({}, '', window.location.pathname)
  if (target.stub === 'restore-backup') {
    restoreBackupNotice.value = true
    void router.push(target.path)
    return
  }
  if (target.replace) void router.replace(target.path)
  else void router.push(target.path)
}
onMounted(() => {
  applyDeepLink()
  window.addEventListener('popstate', applyDeepLink)
})
onUnmounted(() => window.removeEventListener('popstate', applyDeepLink))

/* -------------------------------------------------------------- state banners -- */

/**
 * `downloadCache.isInitializing` (MainActivity.kt:218) is the "Checking downloads" banner of the
 * reference. The web client has no local download cache, so the banner is shown while the client
 * renews its view of the server download state - the closest equivalent of the reference job.
 */
async function renewDownloadCache() {
  if (!server.apiUrl) return
  indexing.value = true
  try { await readDownloadQueue(server.apiUrl) } catch { /* the server may not expose the queue */ }
  finally { indexing.value = false }
}
onMounted(() => { void renewDownloadCache() })

/* ----------------------------------------------------------------- onboarding -- */

/**
 * `ShowOnboarding()` (MainActivity.kt:417-426): the onboarding flow is pushed over the home
 * screen while `preferences.shownOnboardingFlow` is false. The reference blocks the back gesture
 * until the flow is completed (`BackHandler(enabled = !shownOnboardingFlow)`).
 */
const onboardingVisible = ref(!preferences.onboardingShown)
function finishOnboarding() {
  preferences.setOnboardingShown()
  onboardingVisible.value = false
}
function restoreBackupFromOnboarding() {
  finishOnboarding()
  void router.push('/settings/data')
}

/* ---------------------------------------------------------- donation campaign -- */

/**
 * `ShowDonationCampaign()` (MainActivity.kt:428-546): the sheet is shown when the app has been
 * installed for 6 * 30 days and the campaign was not dismissed yet. The first visit time replaces
 * the Android `firstInstallTime`.
 */
const DONATION_ELIGIBILITY_MS = 6 * 30 * 24 * 60 * 60 * 1000
const donationOpen = ref(false)
onMounted(() => {
  if (preferences.donationCampaignShown) return
  if (Date.now() - preferences.installTime >= DONATION_ELIGIBILITY_MS) donationOpen.value = true
})
function dismissDonation() { preferences.setDonationCampaignShown() }
</script>
<template>
  <v-app :data-vuetify-version="vuetifyVersion">
    <a class="skip-link" href="#main-content">Skip to content</a>

    <!--
      AppStateBanners (Banners.kt): the state banners of the reference Scaffold top bar. They sit
      above the app bar of the current screen, exactly like the `topBar` slot of the reference.
    -->
    <AppStateBanners
      v-if="!onboardingVisible"
      :downloaded-only="preferences.downloadedOnly"
      :incognito="preferences.incognitoMode"
      :indexing="indexing"
    />

    <v-navigation-drawer v-if="!onboardingVisible && tabletUi && !route.meta.detail" permanent width="80" color="surface-container" elevation="0" class="mihon-rail" aria-label="Main navigation">
      <div class="d-flex flex-column justify-center h-100">
        <v-btn v-for="item in navItems" :key="item.path" :to="item.path" :active="activeNav === item.path" :color="activeNav === item.path ? 'on-secondary-container' : 'on-surface-variant'" :aria-label="item.title" :aria-current="activeNav === item.path ? 'page' : undefined" variant="text" height="72" rounded="0" class="pa-0 rail-button">
          <span class="navigation-icon" :class="{ 'bg-secondary-container': activeNav === item.path }"><v-icon :icon="item.icon" /></span><span class="text-body-medium mt-1 navigation-label">{{ item.title }}</span>
        </v-btn>
      </div>
    </v-navigation-drawer>
    <!--
      The manga detail screen renders its own MangaToolbar (Mihon: MangaToolbar.kt) and the notes
      screen renders its own app bar, so the global one is hidden for those routes.
    -->
    <v-app-bar v-if="!onboardingVisible && !route.meta.reader && !route.meta.catalogue && !route.meta.ownToolbar && !route.meta.hideToolbar && !['/library', '/browse', '/updates', '/history', '/more'].includes(route.path)" flat height="64" color="surface" class="app-toolbar">
      <v-btn v-if="route.meta.detail" icon="arrow_back" :aria-label="route.meta.catalogue ? 'Back to sources' : 'Back'" @click="back" />
      <v-app-bar-title class="text-title-large font-weight-regular">
        {{ toolbarTitle }}
        <v-chip v-if="route.path === '/library' && server.connected" size="small" class="ml-2" variant="tonal" :aria-label="`${server.totalLibraryCount} manga in library`">{{ server.totalLibraryCount }}</v-chip>
      </v-app-bar-title>
      <v-btn
        v-if="settingsSearchAction"
        icon="search"
        variant="text"
        aria-label="Search settings"
        @click="router.push('/settings/search')"
      />
    </v-app-bar>
    <v-main v-if="!onboardingVisible" id="main-content" tabindex="-1"><router-view /></v-main>
    <v-bottom-navigation v-if="!onboardingVisible && !route.meta.detail && !tabletUi && bottomNavVisible" :model-value="activeNav" grow height="80" color="on-secondary-container" bg-color="surface-container" elevation="0" class="mihon-navigation" aria-label="Main navigation">
      <v-btn v-for="item in navItems" :key="item.path" :value="item.path" :to="item.path" :aria-label="item.title" :aria-current="activeNav === item.path ? 'page' : undefined">
        <span class="navigation-icon" :class="{ 'bg-secondary-container': activeNav === item.path }"><v-icon :icon="item.icon" /></span>
        <span class="mt-1 text-body-medium font-weight-medium navigation-label">{{ item.title }}</span>
      </v-btn>
    </v-bottom-navigation>

    <!--
      The navigation bar scrim of the reference (MainActivity.kt:280-290): a `surfaceContainer`
      strip with an 0.8 alpha behind the system navigation bar.
    -->
    <div v-if="!onboardingVisible" class="mihon-nav-scrim" aria-hidden="true" />

    <!-- ShowOnboarding(): the onboarding flow is pushed over the home screen. -->
    <div v-if="onboardingVisible" class="mihon-onboarding">
      <OnboardingView
        :on-complete="finishOnboarding"
        :on-restore-backup="restoreBackupFromOnboarding"
      />
    </div>

    <!-- ShowDonationCampaign(): the donation sheet of the reference. -->
    <DonationCampaignSheet v-model:open="donationOpen" @dismiss="dismissDonation" />

    <!-- The Android-only backup restore of the reference has no web counterpart. -->
    <v-snackbar v-model="restoreBackupNotice" timeout="6000" location="bottom">
      Restoring a .tachibk backup is not supported in the web version: Mihon restores the archive
      into its local database, while this client keeps no local database.
    </v-snackbar>
  </v-app>
</template>

<style scoped>
/*
 * The navigation bar scrim (MainActivity.kt:280-290): a `surfaceContainer` strip with an 0.8
 * alpha behind the system navigation bar (`isNavigationBarNeedsScrim()`).
 */
.mihon-nav-scrim {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3;
  height: env(safe-area-inset-bottom, 0px);
  background: rgba(var(--v-theme-surface-container), 0.8);
  pointer-events: none;
}

/*
 * ShowOnboarding() (MainActivity.kt:417-426): the onboarding flow covers the app while it runs.
 */
.mihon-onboarding {
  position: fixed;
  inset: 0;
  z-index: 9999;
  overflow-y: auto;
  background: rgb(var(--v-theme-background));
}
</style>
