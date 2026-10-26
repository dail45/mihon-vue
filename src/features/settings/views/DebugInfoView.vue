<script setup lang="ts">
/**
 * Debug info screen — pixel parity target:
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/debug/DebugInfoScreen.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/PreferenceScaffold.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/PreferenceScreen.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/PreferenceGroupHeader.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/TextPreferenceWidget.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/BasePreferenceWidget.kt
 *
 * Structure (DebugInfoScreen.kt):
 *   PreferenceScaffold(
 *     titleRes = MR.strings.pref_debug_info,
 *     onBackPressed = navigator::pop,
 *     itemsProvider = {
 *       listOf(
 *         TextPreference(WorkerInfoScreen.TITLE, onClick = push(WorkerInfoScreen)),
 *         TextPreference(BackupSchemaScreen.TITLE, onClick = push(BackupSchemaScreen)),
 *         getAppInfoGroup(),
 *         getDeviceInfoGroup(),
 *       )
 *     }
 *   )
 *
 * Web client adaptations:
 *   - Scaffold & TopAppBar: 64dp height, 0dp elevation, background surface -> surface-container on scroll.
 *   - Navigate up button: 48x48dp interactive area, 40dp round state layer, arrow_back 24dp.
 *   - Title: "Debug information" (titleLarge 22/28sp w400 onSurface).
 *   - AppBar Actions: Share (share 24dp) & Copy to clipboard (content_copy 24dp) with MD3 Snackbar feedback.
 *   - Preference groups:
 *       * App info (Version, Build time, Commit, Installation ID, Profile compilation status, WebView version).
 *       * Device info (Model, User-Agent, Screen resolution & DPI, Android version).
 *       * Server info (Suwayomi server URL, Server version, Server revision, Server channel).
 *       * Memory & storage info (JS heap memory, Storage quota).
 *   - Clicking any preference row copies its value to clipboard with an MD3 Snackbar notice.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchAboutServer } from '@/core/api/serverSettings'
import { appBuildDate, appChannel, appVersion } from '@/constants/appInfo'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'

const router = useRouter()
const server = useSuwayomiStore()

const props = withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})

/* ------------------------------------------------------------------ scroll state */
const isScrolled = ref(false)
function onScroll() {
  isScrolled.value = window.scrollY > 0
}

/* ------------------------------------------------------------------ app info */
const BUILD_TYPE = 'Stable'
const CLIENT_VERSION = appVersion
const versionName = computed(() => `${BUILD_TYPE} v${CLIENT_VERSION}`)
const commitSha = 'abe5cf5'
const appReleaseChannel = appChannel

const buildTime = computed(() => {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(appBuildDate)
  } catch {
    return appBuildDate.toISOString()
  }
})

const INSTALLATION_ID_KEY = 'mihon.installationId'
const installationId = ref('')

function newInstallationId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.floor(Math.random() * 16)
    const value = char === 'x' ? random : ((random & 0x3) | 0x8)
    return value.toString(16)
  })
}

function readInstallationId(): string {
  try {
    const stored = localStorage.getItem(INSTALLATION_ID_KEY)
    if (stored) return stored
  } catch { /* private mode: session-only value */ }
  const generated = newInstallationId()
  try { localStorage.setItem(INSTALLATION_ID_KEY, generated) } catch { /* ignore */ }
  return generated
}

function regenerateInstallationId() {
  const generated = newInstallationId()
  installationId.value = generated
  try { localStorage.setItem(INSTALLATION_ID_KEY, generated) } catch { /* ignore */ }
  notify('Installation ID regenerated')
}

const profileCompilationStatus = 'Not supported'

const webViewVersion = computed(() => {
  const agent = navigator.userAgent || ''
  const edge = /Edg\/([\d.]+)/.exec(agent)
  const chrome = /Chrome\/([\d.]+)/.exec(agent)
  const firefox = /Firefox\/([\d.]+)/.exec(agent)
  const safari = /Version\/([\d.]+).*Safari/.exec(agent)
  if (edge) return `Edge ${edge[1]}`
  if (chrome) return `Chrome ${chrome[1]}`
  if (firefox) return `Firefox ${firefox[1]}`
  if (safari) return `Safari ${safari[1]}`
  return agent || 'Unknown'
})

/* ---------------------------------------------------------------- device info */
const deviceModel = computed(() => {
  const agent = navigator.userAgent || ''
  const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
  const platform = data?.platform || navigator.platform || 'Unknown'
  const device = /\(([^)]*)\)/.exec(agent)?.[1]?.split(';')[0]?.trim() || 'unknown'
  return `${String(platform).trim()} (${device})`
})

const userAgent = computed(() => navigator.userAgent || 'Unknown')

const screenInfo = computed(() => {
  if (typeof window === 'undefined') return 'Unknown'
  const w = window.screen?.width || 0
  const h = window.screen?.height || 0
  const dpr = window.devicePixelRatio || 1
  const vw = window.innerWidth || 0
  const vh = window.innerHeight || 0
  return `${w}×${h} @ ${dpr}x (Viewport: ${vw}×${vh})`
})

const androidVersion = computed(() => {
  const agent = navigator.userAgent || ''
  const release = /Android\s+([\d.]+)/.exec(agent)?.[1]
  if (!release) {
    const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
    const platform = data?.platform || navigator.platform || 'Desktop'
    return `Not supported in the web version (running on ${platform})`
  }
  const display = /\(([^)]*)\)/.exec(agent)?.[1]?.split(';')[0]?.trim() || 'Unknown'
  return `${release} (${display})`
})

/* ---------------------------------------------------------------- server info */
const serverUrl = computed(() => server.apiUrl || 'Not configured')
const serverVersion = ref('Checking...')
const serverRevision = ref('Checking...')
const serverChannel = ref('Stable')

async function fetchServerAbout() {
  if (!server.apiUrl) {
    serverVersion.value = 'Not connected'
    serverRevision.value = 'N/A'
    serverChannel.value = 'N/A'
    return
  }
  try {
    const res = await fetchAboutServer(server.apiUrl)
    serverVersion.value = String(res.version || res.buildVersion || (server.connected ? 'Connected' : 'Unknown'))
    serverRevision.value = String(res.revision || res.commit || res.buildTime || 'N/A')
    serverChannel.value = String(res.channel || res.buildType || 'Stable')
  } catch {
    serverVersion.value = server.connected ? 'Connected' : 'Unavailable (offline)'
    serverRevision.value = 'N/A'
    serverChannel.value = 'Stable'
  }
}

/* -------------------------------------------------------- memory & storage info */
const memoryInfo = computed(() => {
  const perf = (performance as unknown as { memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number; jsHeapSizeLimit?: number } })
  if (perf?.memory) {
    const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = perf.memory
    return `${formatBytes(usedJSHeapSize || 0)} / ${formatBytes(totalJSHeapSize || 0)} (Limit: ${formatBytes(jsHeapSizeLimit || 0)})`
  }
  return 'Not exposed by browser engine (Chromium only)'
})

const storageInfo = ref('Calculating...')

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

async function updateStorageQuota() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate()
      const usage = estimate.usage || 0
      const quota = estimate.quota || 0
      const pct = quota > 0 ? Math.round((usage / quota) * 100) : 0
      storageInfo.value = `${formatBytes(usage)} used of ${formatBytes(quota)} (${pct}%)`
    } else {
      storageInfo.value = 'StorageManager API not supported'
    }
  } catch {
    storageInfo.value = 'Unable to estimate storage quota'
  }
}

/* ------------------------------------------------------------------ actions & snackbar */
const snackbar = ref('')
let snackbarTimer: number | undefined
function notify(message: string) {
  snackbar.value = message
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
  snackbarTimer = window.setTimeout(() => { snackbar.value = '' }, 3000)
}

function truncateCenter(value: string, count: number): string {
  if (value.length <= count) return value
  const replacement = '...'
  const pieceLength = Math.floor((count - replacement.length) / 2)
  return `${value.slice(0, pieceLength)}${replacement}${value.slice(value.length - pieceLength)}`
}

async function copyRow(_label: string, value: string) {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    notify(`Copied to clipboard:\n${truncateCenter(value, 50)}`)
  } catch {
    notify('Failed to copy to clipboard')
  }
}

async function copyInstallationId() {
  const value = installationId.value
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    notify(`Copied to clipboard:\n${truncateCenter(value, 50)}`)
  } catch {
    notify('Failed to copy to clipboard')
  }
}

function getFullDebugInfoText(): string {
  const now = new Date()
  return [
    'Mihon Vue Debug Information',
    '===========================',
    '',
    '[App info]',
    `Version: ${versionName.value}`,
    `Channel: ${appReleaseChannel}`,
    `Build time: ${buildTime.value}`,
    `Commit: ${commitSha}`,
    `Installation ID: ${installationId.value}`,
    `Profile compilation status: ${profileCompilationStatus}`,
    `WebView version: ${webViewVersion.value}`,
    '',
    '[Device info]',
    `Model: ${deviceModel.value}`,
    `User-Agent: ${userAgent.value}`,
    `Screen resolution & DPI: ${screenInfo.value}`,
    `Android version: ${androidVersion.value}`,
    '',
    '[Server info]',
    `Suwayomi server URL: ${serverUrl.value}`,
    `Server version: ${serverVersion.value}`,
    `Server revision: ${serverRevision.value}`,
    `Server channel: ${serverChannel.value}`,
    '',
    '[Memory & storage info]',
    `JS heap memory: ${memoryInfo.value}`,
    `Storage quota: ${storageInfo.value}`,
    `Timestamp: ${now.toISOString()}`,
  ].join('\n')
}

async function shareDebugInfo() {
  const text = getFullDebugInfoText()
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Debug information',
        text,
      })
      return
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return
    }
  }
  await copyAllDebugInfo()
}

async function copyAllDebugInfo() {
  const text = getFullDebugInfoText()
  try {
    await navigator.clipboard.writeText(text)
    notify('Debug information copied to clipboard')
  } catch {
    notify('Failed to copy to clipboard')
  }
}

function handleNavigateUp() {
  if (window.history.state?.back) {
    router.back()
  } else {
    void router.push('/settings/advanced')
  }
}

/* Worker info / Backup file schema navigate to their own screens. */
const workerInfoRoute = '/settings/debug/worker'
const backupSchemaRoute = '/settings/debug/backup-schema'
const stub = ref('')
const STUB_TEXT: Record<string, string> = {
  [workerInfoRoute]: 'Worker info',
  [backupSchemaRoute]: 'Backup file schema',
}

function openDetail(path: string) {
  void router.push(path).catch(() => {
    stub.value = path
  })
}

function closeStub() {
  stub.value = ''
}

onMounted(() => {
  installationId.value = readInstallationId()
  window.addEventListener('scroll', onScroll, { passive: true })
  updateStorageQuota()
  fetchServerAbout()
})

defineExpose({
  shareDebugInfo,
  copyAllDebugInfo,
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
})
</script>

<template>
  <div class="debug-screen" :class="{ 'debug-screen--embedded': embedded }" aria-label="Debug information">
    <!-- TopAppBar (Scaffold.topBar = AppBar, 64dp, surface container, navigateUp 48dp, titleLarge 22/28sp w400) -->
    <header v-if="!embedded" class="debug-toolbar" :class="{ 'debug-toolbar--scrolled': isScrolled }">
      <button
        type="button"
        class="debug-nav-btn"
        aria-label="Navigate up"
        title="Navigate up"
        @click="handleNavigateUp"
      >
        <v-icon icon="arrow_back" size="24" />
      </button>
      <h1 class="debug-toolbar-title">Debug information</h1>
      <div class="debug-toolbar-actions">
        <div class="debug-action-wrap">
          <button
            type="button"
            class="debug-action-btn"
            aria-label="Share"
            title="Share"
            @click="shareDebugInfo"
          >
            <v-icon icon="share" size="24" />
          </button>
          <span class="debug-action-tooltip" role="tooltip">Share</span>
        </div>
        <div class="debug-action-wrap">
          <button
            type="button"
            class="debug-action-btn"
            aria-label="Copy to clipboard"
            title="Copy to clipboard"
            @click="copyAllDebugInfo"
          >
            <v-icon icon="content_copy" size="24" />
          </button>
          <span class="debug-action-tooltip" role="tooltip">Copy to clipboard</span>
        </div>
      </div>
    </header>

    <!-- PreferenceScreen: ScrollbarLazyColumn of preference items and groups. -->
    <div class="debug-list">
      <!-- Worker info / Backup file schema: the two navigable rows above the groups. -->
      <div
        class="pref-row pref-row--clickable"
        role="button"
        tabindex="0"
        @click="openDetail(workerInfoRoute)"
        @keydown.enter="openDetail(workerInfoRoute)"
      >
        <div class="pref-column">
          <span class="pref-title">Worker info</span>
        </div>
      </div>
      <div
        class="pref-row pref-row--clickable"
        role="button"
        tabindex="0"
        @click="openDetail(backupSchemaRoute)"
        @keydown.enter="openDetail(backupSchemaRoute)"
      >
        <div class="pref-column">
          <span class="pref-title">Backup file schema</span>
        </div>
      </div>

      <!-- PreferenceGroup("App info") -->
      <section class="pref-group">
        <!-- PreferenceGroupHeader("App info") -->
        <p class="pref-group-header">App info</p>

        <!-- TextPreference("Version") -->
        <div
          class="pref-row pref-row--clickable"
          role="button"
          tabindex="0"
          @click="copyRow('Version', versionName)"
          @keydown.enter="copyRow('Version', versionName)"
        >
          <div class="pref-column">
            <span class="pref-title">Version</span>
            <span class="pref-subtitle">{{ versionName }}</span>
          </div>
        </div>

        <!-- TextPreference("Build time") -->
        <div
          class="pref-row pref-row--clickable"
          role="button"
          tabindex="0"
          @click="copyRow('Build time', buildTime)"
          @keydown.enter="copyRow('Build time', buildTime)"
        >
          <div class="pref-column">
            <span class="pref-title">Build time</span>
            <span class="pref-subtitle">{{ buildTime }}</span>
          </div>
        </div>

        <!-- TextPreference("Commit") -->
        <div
          class="pref-row pref-row--clickable"
          role="button"
          tabindex="0"
          @click="copyRow('Commit', commitSha)"
          @keydown.enter="copyRow('Commit', commitSha)"
        >
          <div class="pref-column">
            <span class="pref-title">Commit</span>
            <span class="pref-subtitle pref-subtitle--mono">{{ commitSha }}</span>
          </div>
        </div>

        <!-- TextPreference("Installation ID") with the Autorenew IconButton widget. -->
        <div
          class="pref-row pref-row--clickable"
          role="button"
          tabindex="0"
          @click="copyInstallationId"
          @keydown.enter="copyInstallationId"
        >
          <div class="pref-column">
            <span class="pref-title">Installation ID</span>
            <span class="pref-subtitle pref-subtitle--mono">{{ installationId }}</span>
          </div>
          <span class="pref-widget">
            <button
              type="button"
              class="pref-widget-button"
              aria-label="Regenerate installation ID"
              title="Regenerate installation ID"
              @click.stop="regenerateInstallationId"
            >
              <v-icon icon="autorenew" size="24" />
            </button>
          </span>
        </div>

        <!-- TextPreference("Profile compilation status") -->
        <div
          class="pref-row pref-row--clickable"
          role="button"
          tabindex="0"
          @click="copyRow('Profile compilation status', profileCompilationStatus)"
          @keydown.enter="copyRow('Profile compilation status', profileCompilationStatus)"
        >
          <div class="pref-column">
            <span class="pref-title">Profile compilation status</span>
            <span class="pref-subtitle">{{ profileCompilationStatus }}</span>
          </div>
        </div>

        <!-- TextPreference("WebView version") -->
        <div
          class="pref-row pref-row--clickable"
          role="button"
          tabindex="0"
          @click="copyRow('WebView version', webViewVersion)"
          @keydown.enter="copyRow('WebView version', webViewVersion)"
        >
          <div class="pref-column">
            <span class="pref-title">WebView version</span>
            <span class="pref-subtitle">{{ webViewVersion }}</span>
          </div>
        </div>
      </section>

      <!-- PreferenceGroup("Device info") -->
      <section class="pref-group">
        <!-- PreferenceGroupHeader("Device info") -->
        <p class="pref-group-header">Device info</p>

        <!-- TextPreference("Model") -->
        <div
          class="pref-row pref-row--clickable"
          role="button"
          tabindex="0"
          @click="copyRow('Model', deviceModel)"
          @keydown.enter="copyRow('Model', deviceModel)"
        >
          <div class="pref-column">
            <span class="pref-title">Model</span>
            <span class="pref-subtitle">{{ deviceModel }}</span>
          </div>
        </div>

        <!-- TextPreference("User-Agent") -->
        <div
          class="pref-row pref-row--clickable"
          role="button"
          tabindex="0"
          @click="copyRow('User-Agent', userAgent)"
          @keydown.enter="copyRow('User-Agent', userAgent)"
        >
          <div class="pref-column">
            <span class="pref-title">User-Agent</span>
            <span class="pref-subtitle pref-subtitle--mono">{{ userAgent }}</span>
          </div>
        </div>

        <!-- TextPreference("Screen resolution & DPI") -->
        <div
          class="pref-row pref-row--clickable"
          role="button"
          tabindex="0"
          @click="copyRow('Screen resolution & DPI', screenInfo)"
          @keydown.enter="copyRow('Screen resolution & DPI', screenInfo)"
        >
          <div class="pref-column">
            <span class="pref-title">Screen resolution & DPI</span>
            <span class="pref-subtitle pref-subtitle--mono">{{ screenInfo }}</span>
          </div>
        </div>

        <!-- TextPreference("Android version") -->
        <div
          class="pref-row pref-row--clickable"
          role="button"
          tabindex="0"
          @click="copyRow('Android version', androidVersion)"
          @keydown.enter="copyRow('Android version', androidVersion)"
        >
          <div class="pref-column">
            <span class="pref-title">Android version</span>
            <span class="pref-subtitle">{{ androidVersion }}</span>
          </div>
        </div>
      </section>

      <!-- PreferenceGroup("Server info") -->
      <section class="pref-group">
        <p class="pref-group-header">Server info</p>

        <!-- TextPreference("Suwayomi server URL") -->
        <div
          class="pref-row pref-row--clickable"
          role="button"
          tabindex="0"
          @click="copyRow('Suwayomi server URL', serverUrl)"
          @keydown.enter="copyRow('Suwayomi server URL', serverUrl)"
        >
          <div class="pref-column">
            <span class="pref-title">Suwayomi server URL</span>
            <span class="pref-subtitle pref-subtitle--mono">{{ serverUrl }}</span>
          </div>
        </div>

        <!-- TextPreference("Server version") -->
        <div
          class="pref-row pref-row--clickable"
          role="button"
          tabindex="0"
          @click="copyRow('Server version', serverVersion)"
          @keydown.enter="copyRow('Server version', serverVersion)"
        >
          <div class="pref-column">
            <span class="pref-title">Server version</span>
            <span class="pref-subtitle">{{ serverVersion }}</span>
          </div>
        </div>

        <!-- TextPreference("Server revision") -->
        <div
          class="pref-row pref-row--clickable"
          role="button"
          tabindex="0"
          @click="copyRow('Server revision', serverRevision)"
          @keydown.enter="copyRow('Server revision', serverRevision)"
        >
          <div class="pref-column">
            <span class="pref-title">Server revision</span>
            <span class="pref-subtitle pref-subtitle--mono">{{ serverRevision }}</span>
          </div>
        </div>

        <!-- TextPreference("Server channel") -->
        <div
          class="pref-row pref-row--clickable"
          role="button"
          tabindex="0"
          @click="copyRow('Server channel', serverChannel)"
          @keydown.enter="copyRow('Server channel', serverChannel)"
        >
          <div class="pref-column">
            <span class="pref-title">Server channel</span>
            <span class="pref-subtitle">{{ serverChannel }}</span>
          </div>
        </div>
      </section>

      <!-- PreferenceGroup("Memory & storage info") -->
      <section class="pref-group">
        <p class="pref-group-header">Memory & storage info</p>

        <!-- TextPreference("JS heap memory") -->
        <div
          class="pref-row pref-row--clickable"
          role="button"
          tabindex="0"
          @click="copyRow('JS heap memory', memoryInfo)"
          @keydown.enter="copyRow('JS heap memory', memoryInfo)"
        >
          <div class="pref-column">
            <span class="pref-title">JS heap memory</span>
            <span class="pref-subtitle pref-subtitle--mono">{{ memoryInfo }}</span>
          </div>
        </div>

        <!-- TextPreference("Storage quota") -->
        <div
          class="pref-row pref-row--clickable"
          role="button"
          tabindex="0"
          @click="copyRow('Storage quota', storageInfo)"
          @keydown.enter="copyRow('Storage quota', storageInfo)"
        >
          <div class="pref-column">
            <span class="pref-title">Storage quota</span>
            <span class="pref-subtitle pref-subtitle--mono">{{ storageInfo }}</span>
          </div>
        </div>
      </section>
    </div>

    <!-- Stub dialog for sibling screens if route not found -->
    <v-dialog :model-value="!!stub" content-class="debug-overlay" @update:model-value="closeStub">
      <div class="stub-dialog">
        <h2 class="stub-title">{{ stub ? STUB_TEXT[stub] : '' }}</h2>
        <div class="stub-content">
          <p class="stub-text">
            This screen is not available in the web version yet. It reports Android internals
            that a browser cannot expose.
          </p>
        </div>
        <div class="stub-actions">
          <button type="button" class="stub-button" @click="closeStub">OK</button>
        </div>
      </div>
    </v-dialog>

    <!-- MD3 snackbar -->
    <div v-if="snackbar" class="debug-snackbar" role="status" aria-live="polite">
      <span class="snackbar-text">{{ snackbar }}</span>
    </div>
  </div>
</template>

<style>
/* Material3 BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp) around a content sized
   dialog. The Vuetify overlay content is stretched by default and has to be constrained here. */
.v-dialog > .debug-overlay {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}
</style>

<style scoped>
@layer app-components {
.debug-screen {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  min-height: 100%;
}

/* TopAppBar: 64dp tall, surface container color at 0dp elevation, transitions on scroll */
.debug-toolbar {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 4px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  transition: background-color 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.debug-toolbar--scrolled {
  background: rgb(var(--v-theme-surface-container));
}

.debug-nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  transition: background-color 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.debug-nav-btn:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.debug-nav-btn:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.debug-nav-btn:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.debug-toolbar-title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 0 4px;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.debug-toolbar-actions {
  display: flex;
  align-items: center;
}

.debug-action-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.debug-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  transition: background-color 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.debug-action-btn:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.debug-action-btn:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.debug-action-btn:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.debug-action-tooltip {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
  transition: opacity 0.15s ease;
}
.debug-action-wrap:last-child .debug-action-tooltip {
  left: auto;
  right: 0;
  transform: none;
}
.debug-action-wrap:hover .debug-action-tooltip,
.debug-action-wrap:focus-within .debug-action-tooltip {
  opacity: 1;
  visibility: visible;
}

/* PreferenceScreen: the list scrolls with the page; the group spacing below is 12dp. */
.debug-list {
  display: flex;
  flex-direction: column;
  padding-bottom: 24px;
}

/* PreferenceScreen: a PreferenceGroup is followed by a Spacer(12dp) unless it is the last item. */
.pref-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;
}
.pref-group:last-child {
  margin-bottom: 0;
}

/* BasePreferenceWidget: Row(minHeight = 56dp), Column(padding vertical 16dp). */
.pref-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 56px;
  border: 0;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  text-align: start;
  font: inherit;
}
/* Rows with an onClick are clickable (BasePreferenceWidget only enables the ripple then). */
.pref-row--clickable {
  cursor: pointer;
  transition: background-color 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.pref-row--clickable:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.pref-row--clickable:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.pref-row--clickable:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

/* The title/subtitle column takes the remaining width (Modifier.weight(1f)) and carries the
   vertical padding (PrefsVerticalPadding = 16dp). */
.pref-column {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 16px 0;
}

/* BasePreferenceWidget title: titleLarge with TitleFontSize = 16.sp, maxLines 2, ellipsis. */
.pref-title {
  padding: 0 16px;
  font-size: 16px;
  line-height: 28px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  text-overflow: ellipsis;
}

/* TextPreferenceWidget subtitle: bodySmall (12sp / 16sp, tracking 0.4sp) with
   secondaryItemAlpha (.78) and maxLines = 10. */
.pref-subtitle {
  padding: 0 16px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: .4px;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: .78;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 10;
  -webkit-box-orient: vertical;
  overflow-wrap: anywhere;
}
.pref-subtitle--mono {
  font-family: 'Roboto Mono', ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;
}

/* BasePreferenceWidget widget slot: Box(padding end = 16dp). */
.pref-widget {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  padding: 0 16px;
}

/* IconButton: 40dp container, 24dp icon, primary tint, 40dp circle state layer. */
.pref-widget-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  min-width: 40px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  transition: background-color 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.pref-widget-button:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent);
}
.pref-widget-button:active {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 12%, transparent);
}
.pref-widget-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

/* PreferenceGroupHeader: bodyMedium (14sp / 20sp, tracking 0.25sp), secondary color,
   14dp top / 8dp bottom padding. */
.pref-group-header {
  margin: 0;
  padding: 14px 16px 8px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .25px;
  color: rgb(var(--v-theme-secondary));
}

/* Material 3 AlertDialog */
.stub-dialog {
  box-sizing: border-box;
  align-self: center;
  width: fit-content;
  min-width: min(280px, calc(100vw - 48px));
  max-width: 560px;
  max-height: calc(100dvh - 48px);
  margin: 0 auto;
  overflow-y: auto;
  padding: 24px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
}
.stub-title {
  margin: 0;
  padding-bottom: 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}
.stub-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 24px;
}
.stub-text {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: .25px;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: pre-line;
}
.stub-actions {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  row-gap: 8px;
}
.stub-button {
  height: 40px;
  min-width: 58px;
  padding: 0 12px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .1px;
  cursor: pointer;
  transition: background-color 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.stub-button:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent);
}
.stub-button:active {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 12%, transparent);
}

/* MD3 snackbar */
.debug-snackbar {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: min(560px, calc(100vw - 32px));
  min-width: min(344px, calc(100vw - 32px));
  min-height: 48px;
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  white-space: pre-line;
  box-shadow: 0 3px 6px rgba(0, 0, 0, .28), 0 1px 2px rgba(0, 0, 0, .2);
}
.snackbar-text {
  flex: 1 1 auto;
}
}
</style>
