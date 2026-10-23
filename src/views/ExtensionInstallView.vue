<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSuwayomiStore } from '../stores/suwayomi'
import { fetchExtensionList, type ExtensionDto } from '../api/extensions'
import ExtensionPill from '../components/ExtensionPill.vue'

/**
 * Extensions — install screen.
 *
 * Reference (Mihon commit 446f6df82c390ab760802c2fce3b677bce3f31c1):
 *  - `app/src/main/java/eu/kanade/tachiyomi/extension/util/ExtensionInstallActivity.kt` (the activity)
 *  - `app/src/main/java/eu/kanade/tachiyomi/extension/util/ExtensionInstaller.kt` (the pipeline it belongs to)
 *  - `app/src/main/java/eu/kanade/tachiyomi/extension/model/InstallStep.kt` (the state machine)
 *  - `app/src/main/java/eu/kanade/presentation/browse/ExtensionsScreen.kt` (the row it drives)
 *  - `app/src/main/java/eu/kanade/presentation/browse/components/BaseBrowseItem.kt` (the row layout)
 *  - `app/src/main/java/eu/kanade/presentation/browse/components/BrowseIcons.kt` (ExtensionIcon)
 *  - `app/src/main/java/eu/kanade/presentation/browse/components/ExtensionPill.kt` (the metadata pills)
 *  - `app/src/main/java/eu/kanade/tachiyomi/ui/browse/extension/ExtensionsTab.kt` (long click / uninstall dialog)
 *  - `presentation-core/.../screens/EmptyScreen.kt`, `.../screens/LoadingScreen.kt`, `.../components/ActionButton.kt`
 *
 * The Android activity renders nothing of its own: it hands the downloaded APK to the system
 * package installer and maps its result back onto the extension row:
 *   RESULT_OK      -> InstallStep.Installed
 *   RESULT_CANCELED-> InstallStep.Idle
 *   anything else  -> InstallStep.Error
 * The visible result is the extension row in its installing state (spinner over the icon,
 * Pending/Downloading/Installing pill, cancel action) and, on failure, the retry action.
 *
 * A browser cannot install an APK extension and the web client is a read-only REST client
 * (no extension management), so the system package installer is reproduced as an honest
 * stub that maps its two buttons onto the two result codes the activity handles.
 */

type InstallStep = 'idle' | 'pending' | 'downloading' | 'installing' | 'installed' | 'error'

/** InstallStep.Pending/Downloading/Installing are the only steps Mihon labels with a pill. */
const STEP_PILL: Partial<Record<InstallStep, string>> = {
  pending: 'Pending',
  downloading: 'Downloading',
  installing: 'Installing',
}

const route = useRoute()
const router = useRouter()
const server = useSuwayomiStore()

const extensions = ref<ExtensionDto[]>([])
const loading = ref(true)
const loadError = ref('')
const step = ref<InstallStep>('idle')
const iconBroken = ref(false)

/** The Android system package installer; replaced by an honest web notice. */
const installerDialog = ref(false)
/** ExtensionUninstallConfirmation (ExtensionsTab.kt:110-139). */
const uninstallDialog = ref(false)
/** Extension details live in their own screen (task 46); not part of this screen. */
const detailsStub = ref(false)

const snackbar = ref('')
let snackbarTimer: number | undefined
let stepTimers: number[] = []

/** EmptyScreen picks a random kaomoji face (getRandomErrorFace). */
const ERROR_FACES = [
  '(･o･;)',
  'Σ(ಠ_ಠ)',
  'ಥ_ಥ',
  '(˘･_･˘)',
  '(；￣Д￣)',
  '(･Д･。',
  '(╬ಠ益ಠ)',
  '(╥﹏╥)',
  '(⋟﹏⋞)',
  'Ò︵Ó',
  ' ˙ᯅ˙)',
  '(¬_¬)',
]
const face = ERROR_FACES[Math.floor(Math.random() * ERROR_FACES.length)]!

/** The EmptyScreen message: the failure reason, or that the extension is unknown to the server. */
const emptyMessage = computed(() => loadError.value
  || 'This extension is not in the extension list reported by your Suwayomi-Server.')

const pkgName = computed(() => String(route.params.pkgName ?? ''))
const extension = computed<ExtensionDto | null>(() => extensions.value.find(item => item.pkgName === pkgName.value) ?? null)

const serverBase = computed(() => server.apiUrl.replace(/\/api\/v1\/?$/, ''))
function iconUrl(item: ExtensionDto) {
  if (!item.iconUrl) return ''
  return /^https?:\/\//.test(item.iconUrl) ? item.iconUrl : `${serverBase.value}${item.iconUrl}`
}

/** Extension.NotLoaded.Reason / Loaded.isObsolete drive the "Orphaned" pill. */
const isObsolete = computed(() => extension.value?.obsolete === true)
const hasUpdate = computed(() => extension.value?.hasUpdate === true)
const installed = computed(() => extension.value?.installed === true)

/** The sources this extension provides, as reported by the server's source list. */
const sources = computed(() => server.sources.filter(source => source.iconUrl?.includes(extension.value?.pkgName ?? '')))

/* LocaleHelper.getSourceDisplayName equivalent, same as BrowseView. */
function languageName(lang: string): string {
  if (!lang) return ''
  const normalized = lang === 'zh-CN' ? 'zh-Hans' : lang === 'zh-TW' ? 'zh-Hant' : lang
  try {
    const name = new Intl.DisplayNames([navigator.language || 'en'], { type: 'language' }).of(normalized)
    if (name && name !== normalized) return name.charAt(0).toUpperCase() + name.slice(1)
  } catch { /* Intl.DisplayNames cannot resolve this tag */ }
  return normalized.toUpperCase()
}

/**
 * The store the listing belongs to. Mihon shows the store name under the extension name
 * (ExtensionItemContent), the server only reports the repository URL.
 */
function storeName(repo: string | null): string | null {
  if (!repo) return null
  try {
    const url = new URL(repo)
    const owner = url.pathname.split('/').filter(Boolean)[0]
    if (url.hostname === 'github.com' && owner) return owner.charAt(0).toUpperCase() + owner.slice(1)
    return url.hostname
  } catch { return null }
}

/** ExtensionItemMetadata "facts": language display name and version name, joined by a bullet. */
const facts = computed(() => {
  const item = extension.value
  if (!item) return ''
  // Mihon only shows the language for a Loaded extension; versionName comes with it.
  const parts = [installed.value ? languageName(item.lang) : '', item.versionName].filter(part => part && part.length > 0)
  return parts.join(' • ')
})

interface Pill { text: string; color: 'primary' | 'error' | 'on-surface-variant' }
/** ExtensionItemMetadata "notable": install step, orphaned state, content warning. */
const pills = computed<Pill[]>(() => {
  const item = extension.value
  if (!item) return []
  const result: Pill[] = []
  const stepPill = STEP_PILL[step.value]
  if (stepPill) result.push({ text: stepPill, color: 'primary' })
  if (isObsolete.value) result.push({ text: 'Orphaned', color: 'error' })
  // ContentWarning.NSFW is the error-coloured "18+" label.
  if (item.isNsfw) result.push({ text: '18+', color: 'error' })
  return result
})

/** InstallStep.isCompleted(): Installed, Error or Idle. */
const completed = computed(() => step.value === 'installed' || step.value === 'error' || step.value === 'idle')
/** animateDpAsState(targetValue = if (idle) 0.dp else 8.dp). */
const iconPadding = computed(() => (completed.value ? '0px' : '8px'))

function notify(message: string) {
  snackbar.value = message
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
  snackbarTimer = window.setTimeout(() => { snackbar.value = '' }, 6000)
}

function clearStepTimers() {
  for (const timer of stepTimers) window.clearTimeout(timer)
  stepTimers = []
}

/**
 * Reproduces Mihon's install pipeline state machine.
 * Pending -> Downloading -> Installing, then the platform installer takes over.
 */
function startInstall() {
  if (!extension.value || !completed.value) return
  clearStepTimers()
  step.value = 'pending'
  stepTimers.push(window.setTimeout(() => { step.value = 'downloading' }, 700))
  stepTimers.push(window.setTimeout(() => { step.value = 'installing' }, 1400))
  stepTimers.push(window.setTimeout(() => { installerDialog.value = true }, 2100))
}

/** RESULT_CANCELED -> InstallStep.Idle. */
function cancelInstall() {
  clearStepTimers()
  installerDialog.value = false
  step.value = 'idle'
}

/** The installer reported a failure -> InstallStep.Error, which shows the retry action. */
function dismissInstaller() {
  installerDialog.value = false
  step.value = 'error'
  notify('The extension installer reported a failure. Installing APK extensions is not supported in the web version.')
}

function retry() {
  step.value = 'idle'
  startInstall()
}

function openDetails() {
  detailsStub.value = true
}

/** Extension.Available secondary action: open the source website (no in-app web view in the web). */
function openWebView() {
  const source = sources.value.find(item => item.baseUrl)
  if (!source?.baseUrl) {
    notify('This extension provides no source on your server, so there is nothing to open.')
    return
  }
  window.open(source.baseUrl, '_blank', 'noopener,noreferrer')
}

function confirmUninstall() {
  uninstallDialog.value = false
  notify('Removing extensions is not supported in the web version. Manage extensions on your Suwayomi-Server.')
}

function onRowClick() {
  const item = extension.value
  if (!item) return
  if (installed.value) openDetails()
  else startInstall()
}

/* combinedClickable: a long press on an available extension installs it, on an installed one
   it asks for the uninstall confirmation (ExtensionsTab.kt:62-73). */
let pressTimer: number | undefined
let longPressed = false
function pressStart() {
  longPressed = false
  if (pressTimer) window.clearTimeout(pressTimer)
  pressTimer = window.setTimeout(() => {
    pressTimer = undefined
    longPressed = true
    if (installed.value) uninstallDialog.value = true
    else startInstall()
  }, 500)
}
function pressEnd() {
  if (pressTimer) { window.clearTimeout(pressTimer); pressTimer = undefined }
}
function rowClick() {
  if (longPressed) { longPressed = false; return }
  onRowClick()
}
function rowLongPress() {
  if (longPressed) { longPressed = false; return }
  if (installed.value) uninstallDialog.value = true
  else startInstall()
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    // The sources list tells us which sources this extension provides (the web view action).
    if (!server.sources.length) void server.loadSources()
    extensions.value = await fetchExtensionList(server.apiUrl)
    iconBroken.value = false
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Cannot reach Suwayomi. Check the server address and whether it is running.'
  } finally {
    loading.value = false
  }
}

watch(() => server.apiUrl, () => { void load() })
onMounted(() => { void load() })
onUnmounted(() => { clearStepTimers(); if (snackbarTimer) window.clearTimeout(snackbarTimer) })
</script>

<template>
  <div class="extension-install">
    <!-- LoadingScreen: centered CircularProgressIndicator. -->
    <div v-if="loading" class="extension-loading" role="status" aria-label="Loading extension">
      <v-progress-circular indeterminate color="primary" size="40" width="4" />
    </div>

    <!-- EmptyScreen: kaomoji face + centered message + ActionButton. -->
    <div v-else-if="loadError || !extension" class="extension-empty">
      <p class="empty-face">{{ face }}</p>
      <p class="empty-message">{{ emptyMessage }}</p>
      <div class="empty-actions">
        <v-btn
          v-if="loadError"
          variant="text"
          class="empty-action"
          @click="load"
        >
          <span class="empty-action-inner">
            <span class="material-symbols-rounded empty-action-icon" aria-hidden="true">refresh</span>
            <span class="empty-action-label">Try again</span>
          </span>
        </v-btn>
        <v-btn
          v-else
          variant="text"
          class="empty-action"
          @click="router.back()"
        >
          <span class="empty-action-inner">
            <span class="material-symbols-rounded empty-action-icon" aria-hidden="true">arrow_back</span>
            <span class="empty-action-label">Back to extensions</span>
          </span>
        </v-btn>
      </div>
    </div>

    <template v-else>
      <!-- ExtensionItem: BaseBrowseItem row (16dp horizontal / 8dp vertical padding). -->
      <div
        class="extension-row"
        role="button"
        tabindex="0"
        :aria-label="`${extension.name}. ${extension.installed ? 'Installed' : 'Available'}.`"
        @click="rowClick"
        @keydown.enter="rowClick"
        @pointerdown="pressStart"
        @pointerup="pressEnd"
        @pointerleave="pressEnd"
        @pointercancel="pressEnd"
        @contextmenu.prevent="rowLongPress"
      >
        <!-- ExtensionItemIcon: 48dp box, spinner (2dp stroke) over the icon while installing. -->
        <div class="extension-icon-wrap">
          <v-progress-circular v-if="!completed" indeterminate color="primary" size="48" width="2" />
          <div class="extension-icon-inner" :style="{ padding: iconPadding }">
            <img
              v-if="!iconBroken && iconUrl(extension)"
              class="extension-icon"
              :class="{ 'is-loaded': installed }"
              :src="iconUrl(extension)"
              alt=""
              loading="lazy"
              @error="iconBroken = true"
            />
            <!-- ExtensionIcon error painter for an Available extension: R.drawable.cover_error,
                 a flat @color/cover_placeholder box. A Loaded extension falls back to the
                 default source icon instead (R.mipmap.ic_default_source). -->
            <span v-else-if="installed" class="material-symbols-rounded extension-icon-default" aria-hidden="true">extension</span>
            <span v-else class="extension-icon-fallback" aria-hidden="true" />
          </div>
        </div>

        <!-- ExtensionItemContent: name (bodyMedium), store (bodySmall), metadata pills. -->
        <div class="extension-content">
          <p class="extension-name">{{ extension.name }}</p>
          <p v-if="storeName(extension.repo)" class="extension-store">{{ storeName(extension.repo) }}</p>
          <div class="extension-metadata">
            <span v-if="facts" class="extension-facts">{{ facts }}</span>
            <ExtensionPill v-for="pill in pills" :key="pill.text" :text="pill.text" :color="pill.color" />
          </div>
        </div>

        <!-- ExtensionItemActions: cancel while installing, secondary + primary action otherwise. -->
        <div class="extension-actions">
          <v-btn
            v-if="!completed"
            icon="close"
            variant="text"
            class="extension-action-btn"
            aria-label="Cancel"
            @click.stop="cancelInstall"
          />
          <template v-else>
            <!-- Extension.Available secondary action: open the source in a web view. -->
            <v-btn
              v-if="!installed && sources.length"
              icon="public"
              variant="text"
              class="extension-action-btn"
              aria-label="Open in WebView"
              @click.stop="openWebView"
            />
            <!-- Extension.Loaded secondary action: settings (the extension details screen). -->
            <v-btn
              v-else-if="installed"
              icon="settings"
              variant="text"
              class="extension-action-btn"
              aria-label="Settings"
              @click.stop="openDetails"
            />
            <v-btn
              v-if="step === 'error'"
              icon="refresh"
              variant="text"
              class="extension-action-btn"
              aria-label="Retry"
              @click.stop="retry"
            />
            <v-btn
              v-else-if="!installed"
              icon="download"
              variant="text"
              class="extension-action-btn"
              aria-label="Install"
              @click.stop="startInstall"
            />
            <v-btn
              v-else-if="hasUpdate"
              icon="download"
              variant="text"
              class="extension-action-btn"
              aria-label="Update"
              @click.stop="startInstall"
            />
          </template>
        </div>
      </div>
    </template>

    <!-- Stands in for the Android system package installer that ExtensionInstallActivity starts.
         The two buttons map onto the two result codes the activity handles:
         Cancel -> RESULT_CANCELED -> InstallStep.Idle, a failed install -> InstallStep.Error. -->
    <v-dialog v-model="installerDialog" content-class="ext-install-overlay">
      <div class="ext-install-dialog">
        <h2 class="ext-install-title">Install extension</h2>
        <div class="ext-install-content">
          <p class="ext-install-text">
            Installing an extension requires the Android package installer. Mihon downloads the
            extension APK and hands it to the system installer, which reports the result back to
            the app. A browser has no equivalent API, and this web client stays a read-only REST
            client, so the install pipeline above is a simulation of Mihon's states.
          </p>
          <p class="ext-install-text">Manage extensions on your Suwayomi-Server instead.</p>
        </div>
        <div class="ext-install-actions">
          <button type="button" class="ext-install-button" @click="cancelInstall">Cancel</button>
          <button type="button" class="ext-install-button" @click="dismissInstaller">OK</button>
        </div>
      </div>
    </v-dialog>

    <!-- ExtensionUninstallConfirmation (ExtensionsTab.kt:110-139). -->
    <v-dialog v-model="uninstallDialog" content-class="ext-install-overlay">
      <div class="ext-install-dialog">
        <h2 class="ext-install-title">Remove Extension?</h2>
        <div class="ext-install-content">
          <p class="ext-install-text">Do you really want to remove "{{ extension?.name }}" extension?</p>
        </div>
        <div class="ext-install-actions">
          <button type="button" class="ext-install-button" @click="confirmUninstall">Remove</button>
          <button type="button" class="ext-install-button" @click="uninstallDialog = false">Cancel</button>
        </div>
      </div>
    </v-dialog>

    <!-- Extension details are a separate screen (task 46). -->
    <v-dialog v-model="detailsStub" content-class="ext-install-overlay">
      <div class="ext-install-dialog">
        <h2 class="ext-install-title">Extension details</h2>
        <div class="ext-install-content">
          <p class="ext-install-text">
            The extension details screen is not available in the web version yet.
          </p>
        </div>
        <div class="ext-install-actions">
          <button type="button" class="ext-install-button" @click="detailsStub = false">Close</button>
        </div>
      </div>
    </v-dialog>

    <div v-if="snackbar" class="extension-snackbar" role="status" aria-live="polite">
      <span class="snackbar-text">{{ snackbar }}</span>
    </div>
  </div>
</template>

<style>
/* Material3 BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp) around a content sized
   dialog. The Vuetify overlay content is stretched by default and has to be constrained here. */
.v-dialog > .ext-install-overlay {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}
/* Compose draws the dialog surface with tonalElevation = 0.dp and without a shadow elevation. */
.v-dialog > .ext-install-overlay > .ext-install-dialog { box-shadow: none; }
</style>

<style scoped>
.extension-install {
  position: relative;
  height: calc(100dvh - var(--v-layout-top, 0px));
  background: rgb(var(--v-theme-background));
}

/* BaseBrowseItem: 16dp horizontal / 8dp vertical padding, vertically centered content. */
.extension-row {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  min-height: 64px;
  padding: 8px 16px;
  cursor: pointer;
  user-select: none;
}
.extension-row:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 4%, transparent); }
.extension-row:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }

/* ExtensionItemIcon: 48dp box, icon clipped to shapes.extraSmall (4dp). */
.extension-icon-wrap {
  position: relative;
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
}
/* The icon fills the box (matchParentSize) and is inset by the animated padding. */
.extension-icon-inner {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  transition: padding 150ms ease;
}
.extension-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  border-radius: 4px;
  background: #1f888888;
}
/* A Loaded extension is not clipped (ExtensionIcon has no clip modifier for it) and has no
   placeholder tint. */
.extension-icon.is-loaded {
  border-radius: 0;
  background: transparent;
}
/* R.mipmap.ic_default_source fallback for a Loaded extension. */
.extension-icon-default {
  font-size: 48px;
  line-height: 48px;
  color: rgb(var(--v-theme-on-surface-variant));
}
/* ExtensionIcon error painter (R.drawable.cover_error): a flat @color/cover_placeholder box. */
.extension-icon-fallback {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 4px;
  background: #1f888888;
}

/* ExtensionItemContent: 16dp start padding, name (bodyMedium) + store (bodySmall). */
.extension-content {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  flex-direction: column;
  padding-left: 16px;
}
.extension-name {
  min-width: 0;
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.extension-store {
  min-width: 0;
  margin: 0;
  font-size: 12px;
  line-height: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ExtensionItemMetadata: FlowRow, 4dp horizontal / 2dp vertical spacing. */
.extension-metadata {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 4px;
  row-gap: 2px;
}
.extension-facts {
  min-width: 0;
  max-width: 100%;
  font-size: 12px;
  line-height: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ExtensionItemActions: 8dp spacing between the icon buttons.
   Compose IconButton is a 48dp touch target with a 24dp icon, matching
   .v-btn--icon.v-btn--density-default (36 + 12 = 48px). */
.extension-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.extension-action-btn {
  width: 48px !important;
  height: 48px !important;
  min-width: 48px !important;
  padding: 0 !important;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* LoadingScreen: centered CircularProgressIndicator. */
.extension-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100dvh - 320px);
}

/* EmptyScreen: kaomoji face + centered message + ActionButton. */
.extension-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100dvh - 320px);
  padding: 0 24px;
  text-align: center;
}
/* displayMedium (45/52) with secondaryItemAlpha (78%). */
.empty-face { margin: 0; font-size: 45px; line-height: 52px; color: rgb(var(--v-theme-on-surface)); opacity: .78; }
/* bodyMedium (14/20) with secondaryItemAlpha, 24dp above the baseline of the previous line. */
.empty-message { margin: 24px 0 0; font-size: 14px; line-height: 20px; color: rgb(var(--v-theme-on-surface)); opacity: .78; }
.empty-actions { display: flex; gap: 8px; margin-top: 24px; width: 100%; }
.empty-action { flex: 1 1 0; min-width: 0 !important; }
/* ActionButton: a TextButton with a Column(4dp spacing) holding the 24dp Icon and the title.
   The title uses the TextButton's own labelLarge typography. */
.empty-action-inner { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.empty-action-icon { font-size: 24px; line-height: 24px; }
.empty-action-label { font-size: 14px; line-height: 20px; font-weight: 500; letter-spacing: .1px; }

/* Material 3 AlertDialog (androidx.compose.material3.AlertDialogImpl / AlertDialogContent):
   Surface(shape = CornerExtraLarge 28dp, color = surfaceContainerHigh), Column(padding 24dp),
   title Box(bottom 16dp), text Box(bottom 24dp), buttons Box(align = End) with an AlertDialogFlowRow
   whose main/cross axis spacing is 8dp. Width is constrained to 280dp..560dp. */
.ext-install-dialog {
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
/* DialogTokens.HeadlineFont = HeadlineSmall (24/32, w400), DialogTokens.HeadlineColor = OnSurface. */
.ext-install-title {
  margin: 0;
  padding-bottom: 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface));
  text-align: start;
}
/* AlertDialogDefaults.textPadding = 24dp bottom. */
.ext-install-content { display: flex; flex-direction: column; gap: 8px; padding-bottom: 24px; }
/* DialogTokens.SupportingTextFont = BodyMedium (14/20, w400), color = OnSurfaceVariant. */
.ext-install-text {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: .25px;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: pre-line;
}
/* Material3 AlertDialog lays the buttons out at the end of the row: the dismiss button comes
   first (left) and the confirm button last (right), 8dp apart. */
.ext-install-actions {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  row-gap: 8px;
}
/* MD3 TextButton: 40dp height, 58dp min width, 20dp shape, LabelLarge (14/20, w500), primary. */
.ext-install-button {
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
}
.ext-install-button:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
.ext-install-button:active { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 10%, transparent); }
.ext-install-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* MD3 snackbar: inverseSurface container, inverseOnSurface text, 4dp radius, 48dp min height. */
.extension-snackbar {
  position: fixed;
  left: 50%;
  bottom: calc(80px + 16px);
  transform: translateX(-50%);
  z-index: 1000;
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
  box-shadow: 0 3px 6px rgba(0, 0, 0, .28), 0 1px 2px rgba(0, 0, 0, .2);
}
.snackbar-text { flex: 1 1 auto; }
</style>
