<script setup lang="ts">
/**
 * More screen — pixel parity target:
 *   mihon/app/src/main/java/eu/kanade/presentation/more/MoreScreen.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/LogoHeader.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/BasePreferenceWidget.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/TextPreferenceWidget.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/SwitchPreferenceWidget.kt
 *
 * Item order, icons and copy follow MoreScreen.kt exactly:
 *   LogoHeader -> Downloaded only (switch) -> Incognito mode (switch) -> divider ->
 *   Download queue -> Categories -> Statistics -> Data and storage -> divider ->
 *   Settings -> Support Us -> About -> Help
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePreferencesStore } from '../stores/preferences'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { useLibraryUpdateErrorsStore } from '@/features/updates/stores/libraryUpdateErrors'
import { readDownloadQueue, type DownloaderState } from '@/core/api/downloads'
import MorePreferenceWidget from '@/core/components/MorePreferenceWidget.vue'
import { t, pluralStringResource, MR } from '@/core/i18n'
import { MORE_SYMBOLS } from '@/core/assets/moreIcons'

const router = useRouter()
const preferences = usePreferencesStore()
const server = useSuwayomiStore()
const updateErrorsStore = useLibraryUpdateErrorsStore()

/**
 * `pref_incognito_mode` is a Mihon-local reader preference. The Suwayomi REST API has no
 * incognito flag, so the toggle is kept in this browser and the notice explains that the
 * server keeps recording the reading history.
 *
 * The state lives in the preferences store, because the app shell shows the incognito banner of
 * the reference (Banners.kt) while the mode is on.
 */
const incognitoMode = computed({
  get: () => preferences.incognitoMode,
  set: (value: boolean) => { preferences.incognitoMode = value },
})

const notice = ref('')
const noticeOpen = ref(false)
function notify(message: string) { notice.value = message; noticeOpen.value = true }

/** Download queue state for the `Download queue` summary (MoreScreen.kt downloadQueueStateProvider). */
const queueState = ref<DownloaderState>('STOPPED')
const queuePending = ref(0)
async function refreshQueue() {
  try {
    const snapshot = await readDownloadQueue(server.apiUrl)
    queueState.value = snapshot.state
    queuePending.value = snapshot.queue.length
  } catch {
    // The queue summary stays empty when the server cannot be reached; the item still opens.
    queueState.value = 'STOPPED'
    queuePending.value = 0
  }
}
onMounted(() => { void refreshQueue() })
watch(() => server.apiUrl, () => { void refreshQueue() })

/**
 * MoreScreen.kt: subtitle is null for a stopped queue, "Paused" for a paused queue without
 * pending entries, "Paused • N remaining" for a paused queue and "N remaining" while downloading.
 */
const queueSummary = computed(() => {
  if (!queuePending.value) return null
  const rem = pluralStringResource(MR.plurals.download_queue_summary, queuePending.value, queuePending.value)
  if (queueState.value === 'STOPPED') return `${t(MR.strings.paused) || 'Paused'} • ${rem}`
  return rem
})

/** Statistics is a Mihon-local screen; the Suwayomi REST API exposes no statistics endpoint. */
const statsOpen = ref(false)

/**
 * `Download queue` and `Support Us` screens exist in this client but are not routed yet.
 * The route is picked up as soon as the integration task registers it; until then the item
 * explains the situation instead of silently doing nothing.
 */
function hasRoute(path: string): boolean {
  return router.getRoutes().some(route => route.path === path && !route.path.includes(':'))
}
function openScreen(path: string, title: string, unsupported: string) {
  if (hasRoute(path)) { void router.push(path); return }
  notify(unsupported.replace('%s', title))
}

function openDownloadQueue() {
  openScreen('/download-queue', 'Download queue', 'The %s screen is not routed in this build yet.')
}

function openSupportUs() {
  openScreen('/support-us', 'Support Us', 'The %s screen is not routed in this build yet.')
}

function openStatistics() {
  if (hasRoute('/stats')) {
    void router.push('/stats')
    return
  }
  statsOpen.value = true
}

/** Constants.URL_HELP — opens the Mihon troubleshooting guide in a new tab. */
function openHelp() {
  window.open('https://mihon.app/docs/guides/troubleshooting/', '_blank', 'noopener,noreferrer')
}

function toggleDownloadedOnly() {
  preferences.downloadedOnly = !preferences.downloadedOnly
}

function toggleIncognito() {
  incognitoMode.value = !incognitoMode.value
  if (incognitoMode.value) {
    notify('Incognito mode is not supported in the web version: the Suwayomi REST API has no incognito flag, so the server keeps recording the reading history.')
  }
}
</script>

<template>
  <div class="more-screen">
    <!-- The reference screen has no visible title: the logo header is the only header. The
         screen title stays available to assistive technology. -->
    <h1 class="sr-only">Mihon Vue</h1>
    <!-- LogoHeader.kt: Column centered, Icon(painterResource(ic_mihon), padding(vertical = 32.dp),
         size(64.dp), tint = onSurface), then HorizontalDivider(). -->
    <div class="more-logo">
      <svg class="more-logo-mark" viewBox="0 0 148 141" width="64" height="64" aria-hidden="true">
        <path :d="MORE_SYMBOLS.mihonLogo" fill="currentColor" />
      </svg>
    </div>
    <!-- HorizontalDivider(): 1dp, colorScheme.outlineVariant. -->
    <v-divider color="outline-variant" :opacity="1" />

    <MorePreferenceWidget
      title="Downloaded only"
      subtitle="Filters all entries in your library"
      icon="cloud_off"
      switch
      :checked="preferences.downloadedOnly"
      @click="toggleDownloadedOnly"
    />
    <MorePreferenceWidget
      title="Incognito mode"
      subtitle="Pauses reading history"
      :icon-path="MORE_SYMBOLS.eyeglasses2"
      switch
      :checked="incognitoMode"
      @click="toggleIncognito"
    />

    <v-divider color="outline-variant" :opacity="1" />

    <MorePreferenceWidget
      v-if="!preferences.showNavUpdates"
      :title="t(MR.strings.label_recent_updates) || 'Updates'"
      icon="update"
      @click="router.push('/updates')"
    />
    <MorePreferenceWidget
      v-if="!preferences.showNavHistory"
      :title="t(MR.strings.label_recent_manga) || 'History'"
      icon="history"
      @click="router.push('/history')"
    />

    <MorePreferenceWidget
      title="Download queue"
      :subtitle="queueSummary"
      :badge="queuePending || undefined"
      icon="download"
      @click="openDownloadQueue"
    />
    <MorePreferenceWidget title="Categories" icon="label" @click="router.push('/categories')" />
    <MorePreferenceWidget title="Statistics" :icon-path="MORE_SYMBOLS.queryStats" @click="openStatistics" />
    <MorePreferenceWidget
      title="Library update errors"
      :badge="updateErrorsStore.errorCount || undefined"
      badge-color="error"
      icon="new_releases"
      @click="router.push('/updates/errors')"
    />
    <MorePreferenceWidget title="Data and storage" icon="storage" @click="router.push('/settings/data')" />

    <v-divider color="outline-variant" :opacity="1" />

    <MorePreferenceWidget title="Settings" icon="settings" @click="router.push('/settings')" />
    <MorePreferenceWidget title="Support Us" :icon-path="MORE_SYMBOLS.volunteerActivism" @click="openSupportUs" />
    <MorePreferenceWidget title="About" icon="info" @click="router.push('/about')" />
    <MorePreferenceWidget title="Help" icon="help" @click="openHelp" />

    <v-dialog v-model="statsOpen" max-width="420">
      <v-card>
        <v-card-title class="text-title-large font-weight-regular">Statistics</v-card-title>
        <v-card-text>
          <p class="text-body-medium">
            Statistics are not supported in the web version: the Suwayomi REST API exposes no
            statistics endpoint, and the web client keeps no local reading database.
            Use the server web interface or the Suwayomi-UI dashboard for these numbers.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" color="primary" @click="statsOpen = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="noticeOpen" timeout="6000" location="bottom">
      {{ notice }}
      <template #actions>
        <v-btn variant="text" color="primary" @click="noticeOpen = false">Dismiss</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<style scoped>
/* Scaffold + ScrollbarLazyColumn: the list scrolls with the page content. */
.more-screen {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding-bottom: 24px;
}

/* LogoHeader.kt: Column(fillMaxWidth, horizontalAlignment = CenterHorizontally). */
.more-logo {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 32px 0;
  color: rgb(var(--v-theme-on-surface));
}
</style>
