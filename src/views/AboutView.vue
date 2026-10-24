<script setup lang="ts">
/**
 * About screen — pixel parity target:
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/about/AboutScreen.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/LogoHeader.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/TextPreferenceWidget.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/BasePreferenceWidget.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/LinkIcon.kt
 *   mihon/icons/simple-icons/src/main/valkyrieResources/ (discord, x, facebook, reddit, github)
 *   mihon/icons/material-symbols/src/main/valkyrieResources/rounded/public.svg
 *
 * Reference structure (AboutScreen.kt):
 *   Scaffold(
 *     topBar = { scrollBehavior ->
 *       AppBar(
 *         title = stringResource(MR.strings.pref_category_about),
 *         navigateUp = if (handleBack != null) handleBack::invoke else null,
 *         scrollBehavior = scrollBehavior,
 *       )
 *     },
 *   ) { contentPadding ->
 *     ScrollbarLazyColumn(contentPadding = contentPadding) {
 *       item { LogoHeader(iconPadding = PaddingValues(vertical = 56.dp)) }   // 64dp icon + HorizontalDivider
 *       item { TextPreferenceWidget(title = "Version", subtitle = getVersionName(withBuildDate = true)) }
 *       item { TextPreferenceWidget(title = "Check for updates", widget = CircularProgressIndicator(28.dp, 3.dp)) }
 *       item { TextPreferenceWidget(title = "What's new") }                  // only when !BuildConfig.DEBUG
 *       item { TextPreferenceWidget(title = "Open source licenses") }
 *       item { TextPreferenceWidget(title = "Privacy policy") }
 *       item { HorizontalDivider() }
 *       item { Row(vertical = 8.dp, centered) { LinkIcon x6 } }
 *     }
 *   }
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSuwayomiStore } from '../stores/suwayomi'
import { appBuildDate, appChannel, appVersion } from '../constants/appInfo'
// Registers the "/about/licenses" route of the OpenSourceLicensesScreen (see aboutLicensesRoute.ts).
import './aboutLicensesRoute'
// Registers the "/about/update" & "/new-update" route of the NewUpdateScreen (see aboutUpdateRoute.ts).
import './aboutUpdateRoute'

const props = withDefaults(defineProps<{
  standalone?: boolean
}>(), {
  standalone: undefined,
})

const route = useRoute()
const router = useRouter()
const server = useSuwayomiStore()

/** Whether this view renders its own TopAppBar (when on /about route or explicitly standalone). */
const showTopBar = computed(() => {
  if (props.standalone !== undefined) return props.standalone
  return route.path === '/about'
})

function handleBack() {
  if (window.history.state?.back) {
    router.back()
  } else {
    void router.push('/more')
  }
}

/** MR.strings.pref_category_about */
const aboutTitle = 'About'
/** MR.strings.version */
const versionTitle = 'Version'
/** MR.strings.check_for_updates */
const checkUpdatesTitle = 'Check for updates'
/** MR.strings.whats_new */
const whatsNewTitle = "What's new"
/** MR.strings.licenses */
const licensesTitle = 'Open source licenses'
/** MR.strings.privacy_policy */
const privacyTitle = 'Privacy policy'
/** MR.strings.website */
const websiteLabel = 'Website'

/**
 * The repository the release is looked up in.
 */
const RELEASE_REPO = 'dail45/mihon-vue'

/** The privacy policy of the project (AboutScreen.kt: openUri("https://mihon.app/privacy/")). */
const PRIVACY_URL = 'https://mihon.app/privacy/'

/** BuildConfig.BUILD_TYPE. The web client ships as the stable channel. */
const channel = appChannel

/**
 * getFormattedBuildTime(): the build timestamp, formatted with the system locale.
 * The reference uses `UiPreferences.dateTimeFormat`, which with the default preferences
 * is a SHORT localized date, a space and a SHORT localized time.
 */
const buildTime = computed(() => {
  try {
    const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(appBuildDate)
    const time = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(appBuildDate)
    return `${date} ${time}`
  } catch {
    return appBuildDate.toISOString()
  }
})

/** getVersionName(withBuildDate = true): "Stable v0.5.0 (<build time>)". */
const versionLabel = computed(() => `${channel} v${appVersion} (${buildTime.value})`)

const checking = ref(false)
const snackbar = ref('')
const snackbarOpen = ref(false)
let snackbarTimer: number | undefined

function notify(message: string) {
  if (snackbarTimer !== undefined) window.clearTimeout(snackbarTimer)
  snackbar.value = message
  snackbarOpen.value = true
  snackbarTimer = window.setTimeout(() => {
    snackbarOpen.value = false
    snackbarTimer = undefined
  }, 3000)
}

/** CrashLogUtil.getDebugInfo(): the debug information copied by the "Version" row. */
function debugInfo(): string {
  const now = new Date()
  return [
    `App ID: app.mihon.vue`,
    `App version: ${appVersion} (${channel}, ${appBuildDate.toISOString()})`,
    `Server address: ${server.apiUrl.value || 'None'}`,
    `User agent: ${navigator.userAgent}`,
    `Current time: ${now.toISOString()}`,
  ].join('\n')
}

/** onPreferenceClick of the "Version" row: copyToClipboard("Debug information", deviceInfo). */
async function copyDebugInfo() {
  const info = debugInfo()
  try {
    await navigator.clipboard.writeText(info)
    notify('Copied to clipboard')
  } catch {
    notify('Could not copy to clipboard')
  }
}

/**
 * checkVersion(): the release lookup behind "Check for updates".
 * The reference checks the Android release and opens the update screen; here the
 * latest published release of this client is compared with the running version.
 */
async function checkForUpdates() {
  if (checking.value) return
  checking.value = true
  try {
    const response = await fetch(`https://api.github.com/repos/${RELEASE_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json() as { tag_name?: string; body?: string; html_url?: string }
    const latest = (data.tag_name ?? '').trim().replace(/^v/, '')
    if (latest && latest !== appVersion) {
      // onAvailableUpdate: the reference pushes the NewUpdateScreen.
      void router.push({
        path: '/new-update',
        state: {
          versionName: data.tag_name?.trim() || `v${latest}`,
          changelogInfo: data.body?.trim() || '',
          releaseLink: data.html_url || `https://github.com/${RELEASE_REPO}/releases`,
        },
      })
    } else {
      // GetApplicationRelease.Result.NoNewUpdate -> context.toast(update_check_no_new_updates)
      notify('No new updates available')
    }
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Update check failed')
  } finally {
    checking.value = false
  }
}

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** The "What's new" row navigates to the NewUpdateScreen (/new-update). */
function openWhatsNew() {
  void router.push('/new-update')
}

/** The "Open source licenses" row navigates to the OpenSourceLicensesScreen. */
function openLicenses() {
  if (showTopBar.value) {
    void router.push('/about/licenses')
  } else {
    void router.push('/settings/about/licenses')
  }
}

/**
 * SimpleIcons paths matching Mihon valkyrieResources (24x24 viewBox) for the link row.
 */
const ICONS = {
  discord: 'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z',
  x: 'M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z',
  facebook: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
  reddit: 'M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z',
  github: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
}

interface LinkEntry {
  key: string
  label: string
  url: string
  /** Material symbol name for the website entry, a SimpleIcons path for the brands. */
  symbol?: string
  path?: string
}

const links: LinkEntry[] = [
  { key: 'website', label: websiteLabel, url: 'https://mihon.app', symbol: 'public' },
  { key: 'discord', label: 'Discord', url: 'https://discord.gg/mihon', path: ICONS.discord },
  { key: 'x', label: 'X', url: 'https://x.com/mihonapp', path: ICONS.x },
  { key: 'facebook', label: 'Facebook', url: 'https://facebook.com/mihonapp', path: ICONS.facebook },
  { key: 'reddit', label: 'Reddit', url: 'https://www.reddit.com/r/mihonapp', path: ICONS.reddit },
  { key: 'github', label: 'GitHub', url: 'https://github.com/mihonapp', path: ICONS.github },
]
</script>

<template>
  <section class="about-screen" :aria-label="aboutTitle">
    <!-- TopAppBar with navigate up button and title (AboutScreen.kt: Scaffold.topBar = AppBar) -->
    <header v-if="showTopBar" class="about-top-bar">
      <button
        type="button"
        class="about-nav-btn"
        aria-label="Navigate up"
        @click="handleBack"
      >
        <span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
      </button>
      <h1 class="about-top-title">{{ aboutTitle }}</h1>
    </header>

    <!-- LogoHeader.kt: Column(center) { Icon(ic_mihon, 64dp, padding(vertical = 56dp)); HorizontalDivider() } -->
    <div class="about-logo-header">
      <div class="about-logo-wrap">
        <svg class="about-logo" viewBox="0 0 148 141" width="64" height="64" aria-hidden="true">
          <path
            fill="currentColor"
            d="M20.3,27.59L19.22,2.63C22.47,3.25 26.35,3.41 35.18,3.41C45.87,3.41 59.97,2.79 67.26,1.86C70.36,1.55 71.6,1.08 73.61,0L90.35,14.26C88.8,16.43 88.34,17.36 86.63,21.7C85.24,25.11 78.88,44.79 76.4,53.16C87.87,55.48 94.22,57.19 102.9,60.75C103.99,53.16 104.14,49.13 104.14,35.33C104.14,31.77 103.99,29.75 103.52,26.5L130.49,27.43C129.71,31.15 129.56,32.7 129.4,38.74C128.78,53.31 128.16,60.28 126.61,70.82C137.31,76.25 137.31,76.25 142.73,79.19C145.52,80.74 146.14,81.05 148,81.67L139.01,110.65C134.67,106.78 128.63,102.59 119.79,97.63C112.05,116.07 99.18,129.56 79.66,140.25C73.15,131.57 68.19,126.3 60.28,120.11C71.75,114.68 77.02,111.27 83.07,105.54C88.96,99.8 92.83,94.22 96.55,85.86C86.63,81.36 80.28,79.35 69.27,77.02C62.92,95.93 57.81,108.02 53.31,115.3C47.27,125.06 39.05,130.18 29.6,130.18C22.32,130.18 14.88,126.92 9.45,121.35C3.25,114.99 0,106.16 0,95.93C0,80.74 7.28,67.57 19.99,59.35C28.21,54.09 36.88,51.76 50.68,50.99C53.47,41.84 55.79,33.94 57.96,25.11C51.14,25.73 42.62,26.19 32.23,26.66C26.66,26.81 24.8,26.97 20.3,27.59ZM43.86,74.7C36.57,75.94 32.23,78.26 28.36,83.22C25.42,86.63 24.02,90.66 24.02,95C24.02,99.8 26.35,103.37 29.29,103.37C32.85,103.37 36.88,95.31 43.86,74.7Z"
          />
        </svg>
      </div>
      <hr class="about-divider" />
    </div>

    <!-- TextPreferenceWidget(title = "Version", subtitle = getVersionName(withBuildDate = true)) -->
    <button type="button" class="about-item" @click="copyDebugInfo">
      <span class="about-item-text">
        <span class="about-item-title">{{ versionTitle }}</span>
        <span class="about-item-subtitle">{{ versionLabel }}</span>
      </span>
    </button>

    <!-- TextPreferenceWidget(title = "Check for updates", widget = CircularProgressIndicator(28.dp, 3.dp)) -->
    <button type="button" class="about-item" @click="checkForUpdates">
      <span class="about-item-text">
        <span class="about-item-title">{{ checkUpdatesTitle }}</span>
      </span>
      <span class="about-item-widget">
        <v-progress-circular
          v-if="checking"
          indeterminate
          size="28"
          width="3"
          color="primary"
          aria-label="Checking for updates"
        />
      </span>
    </button>

    <!-- TextPreferenceWidget(title = "What's new") -> NewUpdateScreen (/new-update) -->
    <button type="button" class="about-item" @click="openWhatsNew">
      <span class="about-item-text">
        <span class="about-item-title">{{ whatsNewTitle }}</span>
      </span>
    </button>

    <!-- TextPreferenceWidget(title = "Open source licenses") -> OpenSourceLicensesScreen (/about/licenses) -->
    <button type="button" class="about-item" @click="openLicenses">
      <span class="about-item-text">
        <span class="about-item-title">{{ licensesTitle }}</span>
      </span>
    </button>

    <!-- TextPreferenceWidget(title = "Privacy policy") -> openUri("https://mihon.app/privacy/") -->
    <button type="button" class="about-item" @click="openExternal(PRIVACY_URL)">
      <span class="about-item-text">
        <span class="about-item-title">{{ privacyTitle }}</span>
      </span>
    </button>

    <!-- HorizontalDivider (1dp outlineVariant) -->
    <hr class="about-divider" />

    <!-- Row(vertical padding = 8dp, centered) { LinkIcon x6 } -->
    <div class="about-links" role="group" aria-label="Social links">
      <button
        v-for="link in links"
        :key="link.key"
        type="button"
        class="about-link"
        :aria-label="link.label"
        @click="openExternal(link.url)"
      >
        <span v-if="link.symbol" class="material-symbols-rounded about-link-symbol" aria-hidden="true">{{ link.symbol }}</span>
        <svg v-else class="about-link-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path :d="link.path" fill="currentColor" />
        </svg>
      </button>
    </div>

    <v-snackbar
      v-model="snackbarOpen"
      :timeout="-1"
      color="inverse-surface"
      location="bottom"
      rounded="xs"
      class="about-snackbar"
    >
      <span class="about-snackbar-text">{{ snackbar }}</span>
      <template #actions>
        <v-btn color="inverse-primary" variant="text" @click="snackbarOpen = false">Close</v-btn>
      </template>
    </v-snackbar>
  </section>
</template>

<style scoped>
/* ScrollbarLazyColumn: the screen is a plain scrolling list without extra insets. */
.about-screen {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding-bottom: 24px;
}

/* AppBar.kt: TopAppBar, height 64dp, titleLarge typography (22/28sp w400), navigateUp 48dp IconButton. */
.about-top-bar {
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 4px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  position: sticky;
  top: 0;
  z-index: 2;
}

.about-nav-btn {
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

.about-nav-btn:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.about-nav-btn:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}

.about-top-title {
  margin: 0;
  padding-left: 4px;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* LogoHeader.kt: Column(fillMaxWidth, horizontalAlignment = CenterHorizontally). */
.about-logo-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.about-logo-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 56px 0;
  width: 100%;
}

/* Icon(painter = ic_mihon, tint = onSurface, size = 64.dp). */
.about-logo {
  color: rgb(var(--v-theme-on-surface));
  width: 64px;
  height: 64px;
}

/* Material3 HorizontalDivider: 1dp, outlineVariant. */
.about-divider {
  width: 100%;
  height: 1px;
  margin: 0;
  border: none;
  background: rgb(var(--v-theme-outline-variant));
}

/* BasePreferenceWidget: Row(sizeIn(minHeight = 56.dp), fillMaxWidth, clickable). */
.about-item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 56px;
  padding: 0;
  border: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  text-align: start;
  cursor: pointer;
  font: inherit;
  transition: background-color 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.about-item:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.about-item:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}

.about-item:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

/* Column(weight = 1f, padding(vertical = 16.dp)). */
.about-item-text {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 16px 0;
}

/* titleLarge (fontSize overridden to 16.sp), maxLines = 2, TextOverflow.Ellipsis. */
.about-item-title {
  padding: 0 16px;
  font-size: 16px;
  line-height: 28px;
  font-weight: 400;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface));
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* bodySmall (12sp / 16sp, letterSpacing 0.4sp) with secondaryItemAlpha() (0.78), maxLines = 10. */
.about-item-subtitle {
  padding: 0 16px;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.4px;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.78;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 10;
  overflow: hidden;
  overflow-wrap: anywhere;
}

/* Box(padding(end = 16.dp)) holding the trailing widget. */
.about-item-widget {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding-right: 16px;
}

/* Row(fillMaxWidth, padding(vertical = 8.dp), Arrangement.Center). */
.about-links {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  width: 100%;
}

/* LinkIcon: IconButton(padding(4.dp)) with a 24dp icon tinted primary.
   MD3 IconButton: 48dp minimum interactive size, circular shape (border-radius 50%),
   4dp padding/margin as specified in LinkIcon.kt. */
.about-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin: 4px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  transition: background-color 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.about-link:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent);
}

.about-link:active {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 12%, transparent);
}

.about-link:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.about-link-symbol {
  font-size: 24px;
  line-height: 24px;
}

.about-link-icon {
  display: block;
}

.about-snackbar-text {
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-inverse-on-surface));
}
</style>
