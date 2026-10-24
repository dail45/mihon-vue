<script setup lang="ts">
/**
 * Root Application Container — theme provider and layout host.
 *
 * Pixel parity target:
 *   mihon/app/src/main/java/eu/kanade/tachiyomi/ui/main/MainActivity.kt
 *
 * Structural layout concerns (navigation rails, bottom bars, global app bar,
 * banners) are encapsulated inside `src/app/layouts/` (DefaultLayout, ReaderLayout,
 * SettingsLayout, FullscreenLayout).
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { version as vuetifyVersion, useTheme } from 'vuetify'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { readDownloadQueue } from '@/core/api/downloads'
import { resolveDeepLink } from '@/core/utils/deepLinks'
import DonationCampaignSheet from '@/core/components/DonationCampaignSheet.vue'
import OnboardingView from '@/features/onboarding/views/OnboardingView.vue'
import { useAppearancePreferences } from '@/features/settings/composables/useAppearancePreferences'
import { DefaultLayout, ReaderLayout, FullscreenLayout } from '@/layouts'

// Primary navigation destinations: '/library', '/updates', '/history', '/browse', '/more'
// Routed back handler integration: route.path === '/stats'

const route = useRoute(), router = useRouter(), preferences = usePreferencesStore(), server = useSuwayomiStore()
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

/* ------------------------------------------------------------------ deep links -- */
const restoreBackupNotice = ref(false)
function applyDeepLink() {
  const target = resolveDeepLink(window.location.search)
  if (!target) return
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
async function renewDownloadCache() {
  if (!server.apiUrl) return
  indexing.value = true
  try { await readDownloadQueue(server.apiUrl) } catch { /* the server may not expose the queue */ }
  finally { indexing.value = false }
}
onMounted(() => { void renewDownloadCache() })

/* ----------------------------------------------------------------- onboarding -- */
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
const DONATION_ELIGIBILITY_MS = 6 * 30 * 24 * 60 * 60 * 1000
const donationOpen = ref(false)
onMounted(() => {
  if (preferences.donationCampaignShown) return
  if (Date.now() - preferences.installTime >= DONATION_ELIGIBILITY_MS) donationOpen.value = true
})
function dismissDonation() { preferences.setDonationCampaignShown() }

const layoutComponent = computed(() => {
  if (onboardingVisible.value) return FullscreenLayout
  if (route.meta.reader || route.meta.layout === 'reader') return ReaderLayout
  if (route.meta.layout === 'fullscreen') return FullscreenLayout
  return DefaultLayout
})
</script>

<template>
  <v-app :data-vuetify-version="vuetifyVersion">
    <a class="skip-link" href="#main-content">Skip to content</a>

    <component :is="layoutComponent" :indexing="indexing">
      <router-view />
    </component>

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
.mihon-onboarding {
  position: fixed;
  inset: 0;
  z-index: 9999;
  overflow-y: auto;
  background: rgb(var(--v-theme-background));
}
</style>
