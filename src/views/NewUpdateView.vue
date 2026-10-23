<script setup lang="ts">
/**
 * New update — "What is new" screen.
 *
 * Reference (pinned commit 446f6df):
 *   mihon/app/src/main/java/eu/kanade/presentation/more/NewUpdateScreen.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/screens/InfoScreen.kt
 *   mihon/app/src/main/java/eu/kanade/tachiyomi/ui/more/NewUpdateScreen.kt
 *   mihon/app/src/main/java/eu/kanade/tachiyomi/ui/more/NewUpdateScreenModel.kt
 *
 * Structure of the reference:
 *   InfoScreen(icon = MaterialSymbols.Rounded.Verified,
 *              headingText = "New version available!",
 *              subtitleText = versionName,
 *              acceptText = stage dependent,
 *              rejectText = "Not now",
 *              rejectAction = OutlinedButton { Icon(UpdateDisabled) })
 *     Column(fillMaxWidth, padding(vertical = 24dp))
 *       MarkdownRender(changelogInfo, GFM)
 *       TextButton("Open on GitHub") { Icon(OpenInNew) }
 *   + AlertDialog("Skip %s?" / "Updates often contain bug fixes ...")
 *
 * InfoScreen geometry:
 *   - scrollable Column, paddingValues + padding(top = 48dp) + padding(horizontal = 16dp)
 *   - Icon 48dp, padding(bottom = 8dp), tint = primary
 *   - heading: headlineLarge (32/40, w400)
 *   - subtitle: titleSmall (14/20, w500), secondaryItemAlpha() (alpha .78), padding(vertical = 8dp)
 *   - bottom bar: Column(background = background, hairline top divider = outline,
 *     windowInsetsPadding(NavigationBarDefaults.windowInsets), padding(horizontal = 16dp, vertical = 8dp))
 *       Button(fillMaxWidth, enabled = stage != Downloading)
 *       Row(spacedBy(4dp)) { OutlinedButton(weight 1f); rejectAction(OutlinedButton icon) }
 *
 * The Android updater downloads an APK and hands it to the system package installer.
 * A browser cannot install an APK, so the download/install pipeline is reproduced as an
 * honest simulation that ends in the same "not supported in the web version" notice.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MarkdownRender from '../components/MarkdownRender.vue'

/** NewUpdateScreenModel.Stage. */
export type Stage = 'available' | 'downloading' | 'downloaded' | 'failed'

export interface Props {
  versionName?: string
  changelogInfo?: string
  releaseLink?: string
  downloadLink?: string
  initialStage?: Stage
  initialProgress?: number
}

const props = withDefaults(defineProps<Props>(), {
  versionName: '',
  changelogInfo: '',
  releaseLink: '',
  downloadLink: '',
  initialStage: undefined,
  initialProgress: 0,
})

const router = useRouter()
const route = useRoute()

/** The repository the release is looked up in. */
const RELEASE_REPO = 'dail45/mihon-vue'
const RELEASE_PAGE = `https://github.com/${RELEASE_REPO}/releases`

export interface ReleaseInfo {
  version: string
  changelog: string
  releaseLink: string
  downloadLink?: string
}

/** The reference preview data, used when the release lookup does not return anything. */
const FALLBACK_RELEASE: ReleaseInfo = {
  version: 'v0.5.0',
  changelog: [
    '## What is new',
    '',
    'This web client is a headless REST client for **Suwayomi-Server**.',
    '',
    '### Highlights',
    '- Reader with paged and continuous modes',
    '- Library with categories, compact grid and cover overlays',
    '- Browse, download queue and extension list',
    '',
    '### Notes',
    '- Manga data is fetched from your own server; nothing is scraped here.',
  ].join('\n'),
  releaseLink: RELEASE_PAGE,
}

const release = ref<ReleaseInfo>({ ...FALLBACK_RELEASE })
const loadError = ref('')

const stage = ref<Stage>(props.initialStage ?? 'available')
const downloadProgress = ref(props.initialProgress ?? 0)
const showSkipDialog = ref(false)
const showInstallNotice = ref(false)

let progressTimer: number | undefined

/**
 * The accept button label, exactly as the reference switches on the stage:
 * - Stage.Available: MR.strings.update_check_confirm ("Download")
 * - Stage.Downloading: MR.strings.downloading_with_progress ("Downloading: (%d%%)")
 * - Stage.Downloaded: MR.strings.action_install ("Install")
 * - Stage.Failed: MR.strings.action_retry ("Retry")
 */
const acceptText = computed(() => {
  switch (stage.value) {
    case 'available': return 'Download'
    case 'downloading': return `Downloading: (${downloadProgress.value}%)`
    case 'downloaded': return 'Install'
    case 'failed': return 'Retry'
  }
})

/** canAccept = stage != Stage.Downloading. */
const canAccept = computed(() => stage.value !== 'downloading')

const versionName = computed(() => release.value.version)

async function loadRelease() {
  loadError.value = ''
  try {
    const response = await fetch(`https://api.github.com/repos/${RELEASE_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json() as { tag_name?: string; body?: string; html_url?: string }
    release.value = {
      version: data.tag_name?.trim() || FALLBACK_RELEASE.version,
      changelog: data.body?.trim() || FALLBACK_RELEASE.changelog,
      releaseLink: data.html_url || RELEASE_PAGE,
    }
  } catch (error) {
    // The screen still renders (the reference has no error state for the changelog).
    loadError.value = error instanceof Error ? error.message : 'Release lookup failed.'
    release.value = { ...FALLBACK_RELEASE }
  }
}

/** onOpenInBrowser: opens the release page of the release. */
function openInBrowser() {
  window.open(release.value.releaseLink, '_blank', 'noopener,noreferrer')
}

/**
 * NewUpdateScreenModel.startDownload(): the APK download with its progress ticks.
 * The browser cannot fetch and install an APK, so the state machine is simulated.
 */
function startDownload() {
  if (stage.value === 'downloading') return
  if (progressTimer) window.clearInterval(progressTimer)
  stage.value = 'downloading'
  downloadProgress.value = 0
  progressTimer = window.setInterval(() => {
    downloadProgress.value = Math.min(downloadProgress.value + 7, 100)
    if (downloadProgress.value >= 100) {
      if (progressTimer) window.clearInterval(progressTimer)
      progressTimer = undefined
      stage.value = 'downloaded'
    }
  }, 220)
}

/** The system package installer, replaced by an honest web notice. */
function installUpdate() {
  if (stage.value !== 'downloaded') return
  showInstallNotice.value = true
}

/**
 * The install could not be performed, which is the same outcome the reference reaches
 * when the platform installer refuses the file: Stage.Failed shows the retry action.
 */
function dismissInstallNotice() {
  showInstallNotice.value = false
  stage.value = 'failed'
}

/** onRejectUpdate: the reference pops the screen. */
function rejectUpdate() {
  if (progressTimer) { window.clearInterval(progressTimer); progressTimer = undefined }
  if (router) {
    router.back()
  }
}

/** onSkipUpdate: the version is remembered as skipped and the screen is popped. */
function skipUpdate() {
  showSkipDialog.value = false
  if (progressTimer) { window.clearInterval(progressTimer); progressTimer = undefined }
  try {
    window.localStorage.setItem('mihon-vue:skipped-app-update', versionName.value)
  } catch { /* storage may be unavailable */ }
  if (router) {
    router.back()
  }
}

onMounted(() => {
  document.body.classList.add('new-update-screen-active')

  // Check props or route / history state first
  const state = typeof window !== 'undefined' ? window.history?.state : undefined
  const queryVersion = typeof route?.query?.version === 'string' ? route.query.version : ''
  const queryChangelog = typeof route?.query?.changelog === 'string' ? route.query.changelog : ''
  const queryLink = typeof route?.query?.link === 'string' ? route.query.link : ''

  const resolvedVersion = props.versionName || state?.versionName || queryVersion
  const resolvedChangelog = props.changelogInfo || state?.changelogInfo || queryChangelog
  const resolvedLink = props.releaseLink || state?.releaseLink || queryLink
  const resolvedDownloadLink = props.downloadLink || state?.downloadLink

  if (props.initialStage) {
    stage.value = props.initialStage
  }
  if (props.initialProgress) {
    downloadProgress.value = props.initialProgress
  }

  if (resolvedVersion || resolvedChangelog) {
    release.value = {
      version: resolvedVersion || FALLBACK_RELEASE.version,
      changelog: resolvedChangelog || FALLBACK_RELEASE.changelog,
      releaseLink: resolvedLink || RELEASE_PAGE,
      downloadLink: resolvedDownloadLink,
    }
  } else {
    void loadRelease()
  }
})

onBeforeUnmount(() => {
  document.body.classList.remove('new-update-screen-active')
  if (progressTimer) window.clearInterval(progressTimer)
})
</script>

<template>
  <section class="new-update">
    <!-- InfoScreen: scrollable Column, padding(top = 48dp), padding(horizontal = 16dp). -->
    <div class="new-update-content">
      <!-- Icon: 48dp, padding(bottom = 8dp), tint = primary. -->
      <span class="material-symbols-rounded new-update-icon" aria-hidden="true">verified</span>

      <!-- headlineLarge (32/40, w400). -->
      <h1 class="new-update-heading">New version available!</h1>

      <!-- titleSmall (14/20, w500), secondaryItemAlpha (0.78), padding(vertical = 8dp). -->
      <p class="new-update-subtitle">{{ versionName }}</p>

      <!-- Column(fillMaxWidth, padding(vertical = 24dp)). -->
      <div class="new-update-body">
        <MarkdownRender :content="release.changelog" flavour="gfm" />

        <!-- TextButton("Open on GitHub") { Spacer(4dp); Icon(OpenInNew) }. -->
        <button type="button" class="new-update-link" @click="openInBrowser">
          <span class="new-update-link-label">Open on GitHub</span>
          <span class="material-symbols-rounded new-update-link-icon" aria-hidden="true">open_in_new</span>
        </button>

        <p v-if="loadError" class="new-update-note">
          The release notes could not be loaded from GitHub, so the bundled notes are shown.
        </p>
      </div>
    </div>

    <!-- InfoScreen bottomBar: background, hairline top divider, padding(16dp horizontal, 8dp vertical). -->
    <footer class="new-update-bar">
      <!-- Button(fillMaxWidth, enabled = canAccept). -->
      <button
        type="button"
        class="new-update-accept"
        :disabled="!canAccept"
        @click="stage === 'downloaded' ? installUpdate() : startDownload()"
      >
        {{ acceptText }}
      </button>

      <!-- Row(spacedBy(4dp)) { OutlinedButton(weight 1f); rejectAction(OutlinedButton icon) }. -->
      <div class="new-update-row">
        <button type="button" class="new-update-outlined" @click="rejectUpdate">Not now</button>
        <button
          type="button"
          class="new-update-outlined new-update-outlined--icon"
          aria-label="Skip this version"
          title="Skip this version"
          @click="showSkipDialog = true"
        >
          <span class="material-symbols-rounded" aria-hidden="true">update_disabled</span>
        </button>
      </div>
    </footer>

    <!-- AlertDialog: "Skip %s?" with the reference message. -->
    <v-dialog v-model="showSkipDialog" max-width="560">
      <div class="update-alert-dialog" role="dialog" aria-labelledby="skip-dialog-title">
        <h2 id="skip-dialog-title" class="update-alert-title">Skip {{ versionName }}?</h2>
        <div class="update-alert-content">
          <p class="update-alert-text">
            Updates often contain bug fixes and security improvements. You won't be reminded about
            this version again, but you'll still be notified when a newer one is released.
          </p>
        </div>
        <div class="update-alert-actions">
          <button type="button" class="update-alert-button" @click="showSkipDialog = false">Cancel</button>
          <button type="button" class="update-alert-button update-alert-button--confirm" @click="skipUpdate">OK</button>
        </div>
      </div>
    </v-dialog>

    <!-- The Android package installer, which a browser cannot provide. -->
    <v-dialog v-model="showInstallNotice" max-width="560">
      <div class="update-alert-dialog" role="dialog" aria-labelledby="install-dialog-title">
        <h2 id="install-dialog-title" class="update-alert-title">Install update</h2>
        <div class="update-alert-content">
          <p class="update-alert-text">
            Mihon downloads the update as an APK and hands it to the Android system installer, which
            then replaces the app. A browser has no equivalent API, so the update cannot be installed
            from this page. Reload the app to pick up a newer version.
          </p>
        </div>
        <div class="update-alert-actions">
          <button type="button" class="update-alert-button" @click="openInBrowser">Open in browser</button>
          <button type="button" class="update-alert-button update-alert-button--confirm" @click="dismissInstallNotice">OK</button>
        </div>
      </div>
    </v-dialog>
  </section>
</template>

<style>
/* InfoScreen owns no top app bar and no navigation bar: the reference screen is a single
   Scaffold whose only chrome is the bottom action bar rendered by the screen itself.
   The shared shell bars are hidden and the layout space they reserved is released. */
body.new-update-screen-active .app-toolbar { display: none; }
body.new-update-screen-active .mihon-navigation { display: none; }
body.new-update-screen-active .mihon-rail { display: none; }
/* The inline style of v-main sets the layout insets; the important declaration wins. */
body.new-update-screen-active .v-main {
  --v-layout-top: 0px !important;
  --v-layout-bottom: 0px !important;
  --v-layout-left: 0px !important;
}
</style>

<style scoped>
.new-update {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-surface));
}

/* Column(verticalScroll, fillMaxWidth, padding(top = 48dp), padding(horizontal = 16dp)).
   The reference applies no bottom padding here; the trailing 24dp comes from the
   content column (padding(vertical = 24dp)) that follows the subtitle. */
.new-update-content {
  flex: 1 1 auto;
  box-sizing: border-box;
  overflow-y: auto;
  padding: calc(48px + env(safe-area-inset-top, 0px)) 16px 0;
}

/* Icon(48dp, padding(bottom = 8dp), tint = primary). */
.new-update-icon {
  display: block;
  width: 48px;
  height: 48px;
  margin-bottom: 8px;
  font-size: 48px;
  line-height: 48px;
  color: rgb(var(--v-theme-primary));
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 48;
}

/* headlineLarge: 32sp / 40sp, weight 400. */
.new-update-heading {
  margin: 0;
  font-size: 32px;
  line-height: 40px;
  font-weight: 400;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface));
}

/* titleSmall: 14sp / 20sp, weight 500, secondaryItemAlpha (0.78), padding(vertical = 8dp). */
.new-update-subtitle {
  margin: 0;
  padding: 8px 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .1px;
  color: rgb(var(--v-theme-on-surface));
  opacity: .78;
}

/* Column(fillMaxWidth, padding(vertical = 24dp)). */
.new-update-body {
  display: flex;
  flex-direction: column;
  padding: 24px 0;
}

/* MD3 TextButton: 40dp height, labelLarge (14/20, w500), color = primary. */
.new-update-link {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  height: 40px;
  margin-top: 8px;
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
  text-decoration: none;
}
.new-update-link:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
.new-update-link:active { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 10%, transparent); }
.new-update-link:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
/* Spacer(width = extraSmall = 4dp) between the label and the icon. */
.new-update-link-icon {
  margin-left: 4px;
  font-size: 24px;
  line-height: 24px;
  width: 24px;
  height: 24px;
}

.new-update-note {
  margin: 16px 0 0;
  font-size: 12px;
  line-height: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: .78;
}

/* InfoScreen bottomBar: Column(background, hairline top rule of outline, padding 16dp horizontal, 8dp vertical). */
.new-update-bar {
  flex-shrink: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 16px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid rgb(var(--v-theme-outline));
  background: rgb(var(--v-theme-background));
}

/* MD3 Button: 40dp height, 20dp shape, labelLarge, filled with primary. */
.new-update-accept {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 40px;
  padding: 0 24px;
  border: 0;
  border-radius: 20px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .1px;
  cursor: pointer;
  text-align: center;
  user-select: none;
  transition: background-color 0.15s ease;
}
/* MD3 state layers: 8% on hover, 10% on press, in the onPrimary color. */
.new-update-accept:hover:not(:disabled) { background: color-mix(in srgb, rgb(var(--v-theme-on-primary)) 8%, rgb(var(--v-theme-primary))); }
.new-update-accept:active:not(:disabled) { background: color-mix(in srgb, rgb(var(--v-theme-on-primary)) 10%, rgb(var(--v-theme-primary))); }
.new-update-accept:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
/* DISABLED_ALPHA = .38f. */
.new-update-accept:disabled {
  cursor: default;
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 38%, transparent);
}

/* Row(horizontalArrangement = spacedBy(extraSmall = 4dp)). */
.new-update-row {
  display: flex;
  gap: 4px;
  align-items: center;
  width: 100%;
}

/* MD3 OutlinedButton: 40dp height, 20dp shape, 1dp outline, labelLarge, color = primary. */
.new-update-outlined {
  box-sizing: border-box;
  flex: 1 1 0;
  min-width: 0;
  height: 40px;
  padding: 0 24px;
  border: 1px solid rgb(var(--v-theme-outline));
  border-radius: 20px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .1px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  user-select: none;
  transition: background-color 0.15s ease;
}
.new-update-outlined:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
.new-update-outlined:active { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 10%, transparent); }
.new-update-outlined:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* The rejectAction is an OutlinedButton with only an icon (24dp). An icon-only MD3
   button keeps the 64dp minimum width of the button shape. */
.new-update-outlined--icon {
  flex: 0 0 auto;
  width: 64px;
  min-width: 64px;
  padding: 0 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.new-update-outlined--icon .material-symbols-rounded {
  font-size: 24px;
  line-height: 24px;
  width: 24px;
  height: 24px;
}

/* MD3 AlertDialog: 28dp shape, surfaceContainerHigh, 24dp padding, title headlineSmall. */
.update-alert-dialog {
  box-sizing: border-box;
  align-self: center;
  width: fit-content;
  min-width: min(280px, calc(100vw - 48px));
  max-width: 560px;
  margin: 0 auto;
  overflow-y: auto;
  padding: 24px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, .3), 0 4px 8px 3px rgba(0, 0, 0, .15);
}
.update-alert-title {
  margin: 0;
  padding-bottom: 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  text-align: start;
}
.update-alert-content { display: flex; flex-direction: column; gap: 8px; padding-bottom: 24px; }
.update-alert-text {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: .25px;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: pre-line;
}
/* MD3 AlertDialog actions: the confirm button sits on the right, the dismiss button
   on the left. The reference declares dismissButton = Cancel, confirmButton = OK. */
.update-alert-actions {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
/* MD3 TextButton: 40dp height, 58dp min width, 20dp shape, labelLarge, primary. */
.update-alert-button {
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
  user-select: none;
}
.update-alert-button:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
.update-alert-button:active { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 10%, transparent); }
.update-alert-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
</style>
