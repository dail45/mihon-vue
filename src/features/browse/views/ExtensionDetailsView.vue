<script setup lang="ts">
/**
 * Extension details screen.
 *
 * Reference (Mihon commit 446f6df82c390ab760802c2fce3b677bce3f31c1):
 *  - `app/src/main/java/eu/kanade/presentation/browse/ExtensionDetailsScreen.kt` (the screen)
 *  - `app/src/main/java/eu/kanade/tachiyomi/ui/browse/extension/details/ExtensionDetailsViewModel.kt`
 *  - `app/src/main/java/eu/kanade/domain/extension/interactor/GetExtensionSources.kt`
 *  - `app/src/main/java/eu/kanade/presentation/components/Banners.kt` (WarningBanner)
 *  - `app/src/main/java/eu/kanade/presentation/components/AppBar.kt` (AppBar / AppBarActions)
 *  - `app/src/main/java/eu/kanade/presentation/more/settings/widget/BasePreferenceWidget.kt`
 *  - `app/src/main/java/eu/kanade/presentation/more/settings/widget/TextPreferenceWidget.kt`
 *  - `app/src/main/java/eu/kanade/presentation/browse/components/BrowseIcons.kt` (ExtensionIcon)
 *  - `app/src/main/java/eu/kanade/presentation/browse/components/ExtensionPill.kt`
 *
 * Structure (top -> bottom), exactly as in the reference:
 *  - AppBar: title "Extension info" (`label_extension_info`), up button and an overflow menu
 *    with three `AppBar.OverflowAction` entries: "Enable all", "Disable all", "Clear cookies".
 *  - `ScrollbarLazyColumn`:
 *      1. `WarningBanner(obsolete_extension_message)` when the extension is orphaned.
 *      2. `DetailsHeader`:
 *           - a clickable header block (112dp icon, name, package name, store name, private
 *             pill) that copies the extension debug information to the clipboard,
 *           - a row of three `InfoText` columns (Version / Language / Warning) separated by
 *             vertical dividers,
 *           - "Uninstall" (outlined) and "App info" (filled) buttons,
 *           - the "Incognito mode" `TextPreferenceWidget` and a horizontal divider.
 *      3. one `SourceSwitchPreference` per source of the extension.
 *  - `ContentWarningDialog` when the warning info text is tapped.
 *
 * Web limits (the production client is a headless REST client for Suwayomi-Server):
 *  - Suwayomi-Server has no extension management API, so "Uninstall" and "Clear cookies"
 *    cannot be executed on the server. They keep the reference layout and open an honest notice.
 *  - The Android "App info" intent (system app details screen) does not exist in a browser.
 *  - Extension incognito flag and source enable/disable states are kept in browser preferences
 *    (`mihon.incognitoExtensions` and `mihon.disabledSources`), fully shared with BrowseView.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { fetchExtensionList, type ExtensionDto } from '@/core/api/extensions'
import { languageName } from '../utils/sourceLanguage'
import { contentWarningLabel, extensionContentWarning, type ContentWarningLevel } from '@/core/utils/contentWarning'
import { readPreference, writePreference } from '@/features/settings/stores/preferences'
import ExtensionPill from '../components/ExtensionPill.vue'
import ContentWarningDialog from '../components/ContentWarningDialog.vue'
import Md3Switch from '@/core/components/Md3Switch.vue'

const route = useRoute()
const router = useRouter()
const server = useSuwayomiStore()

const extensions = ref<ExtensionDto[]>([])
const loading = ref(true)
const loadError = ref('')
const iconBroken = ref(false)

/** `showContentWarning` of the reference screen. */
const showContentWarning = ref(false)
/** The overflow menu of the app bar. */
const overflowOpen = ref(false)
/** The honest notice for the actions the REST API cannot execute. */
const noticeTitle = ref('Not supported in the web version')
const notice = ref('')
const noticeOpen = ref(false)
function showNotice(title: string, message: string) {
  noticeTitle.value = title
  notice.value = message
  noticeOpen.value = true
}
/** Mihon's `State.Uninstalled`. */
const uninstalled = ref(false)

const snackbar = ref('')
let snackbarTimer: number | undefined

/** Mihon keeps the incognito flag per package name (`preferences.incognitoExtensions`). */
const INCOGNITO_KEY = 'mihon.incognitoExtensions'
/** Disabled sources set (`preferences.disabledSources`). */
const DISABLED_SOURCES_KEY = 'mihon.disabledSources'

function readDisabledSources(): string[] {
  try {
    const raw = localStorage.getItem(DISABLED_SOURCES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch { return [] }
}

const disabledSources = ref<string[]>(readDisabledSources())

function writeDisabledSources(ids: string[]) {
  disabledSources.value = ids
  try {
    localStorage.setItem(DISABLED_SOURCES_KEY, JSON.stringify(ids))
  } catch { /* storage quota or private mode */ }
}

const pkgName = computed(() => String(route.params.pkgName ?? ''))
const extension = computed<ExtensionDto | null>(
  () => extensions.value.find(item => item.pkgName === pkgName.value) ?? null,
)

/**
 * Mihon knows whether the extension apk is shared (installed from a store, so the system app
 * details screen applies) or private (a locally installed apk). Suwayomi-Server installs the
 * extensions itself and reports the repository a listing came from, so an extension without a
 * repository is the closest observable equivalent of a private one.
 */
const isShared = computed(() => !!extension.value?.repo)

const serverBase = computed(() => server.apiUrl.replace(/\/api\/v1\/?$/, ''))
function iconUrl(item: ExtensionDto) {
  if (!item.iconUrl) return ''
  return /^https?:\/\//.test(item.iconUrl) ? item.iconUrl : `${serverBase.value}${item.iconUrl}`
}

/** The store the listing belongs to; Mihon shows `extension.store.name` as a link. */
function storeName(repo: string | null): string | null {
  if (!repo) return null
  try {
    const url = new URL(repo)
    const owner = url.pathname.split('/').filter(Boolean)[0]
    if (url.hostname === 'github.com' && owner) return owner.charAt(0).toUpperCase() + owner.slice(1)
    return url.hostname
  } catch { return null }
}

/** The website the store name links to (`extension.store.contact.website`). */
function storeWebsite(repo: string | null): string | null {
  if (!repo) return null
  try {
    const url = new URL(repo)
    if (url.hostname === 'github.com') return `https://github.com/${url.pathname.split('/').filter(Boolean)[0] ?? ''}`
    return url.hostname
  } catch { return null }
}

/**
 * `LocaleHelper.getSourceDisplayName(lang)`: "all" -> "Multi", "other" -> "Other", otherwise the
 * locale display name in its own language.
 */
function displayLanguage(lang: string): string {
  if (!lang) return 'Other'
  if (lang === 'all') return 'Multi'
  if (lang === 'other' || lang === 'localsourcelang') return 'Other'
  return languageName(lang)
}

/** The sources this extension provides, as reported by the server's source list. */
const extensionSources = computed(() =>
  server.sources.filter(source => source.iconUrl?.includes(pkgName.value) ?? false),
)

/**
 * `GetExtensionSources`: `labelAsName` is true when the extension has more than one source and
 * they are not all the same language; the row then shows the source name instead of the
 * language. The sort order is `compareBy({ !it.enabled }, { name or language })`.
 */
interface SourceRow {
  id: string
  title: string
  sortKey: string
  isConfigurable: boolean
  enabled: boolean
}
const sourceRows = computed<SourceRow[]>(() => {
  const rows = extensionSources.value
  const isMultiSource = rows.length > 1
  // GetExtensionSources: an extension whose sources all carry the same name is a
  // single-language extension, so the rows show the language instead of the name.
  const isMultiLangSingleSource = isMultiSource
    && new Set(rows.map(row => row.name)).size === 1
  const labelAsName = isMultiSource && !isMultiLangSingleSource
  return rows
    .map(row => ({
      id: row.id,
      // `source.source.toString()` = "Name (LANG)" for a named source.
      title: labelAsName ? `${row.name} (${row.lang.toUpperCase()})` : displayLanguage(row.lang),
      // The reference sorts by the raw name or by the lowercased language display name.
      sortKey: (labelAsName ? row.name : displayLanguage(row.lang)).toLowerCase(),
      isConfigurable: row.isConfigurable,
      enabled: !disabledSources.value.includes(row.id),
    }))
    .sort((a, b) => Number(!a.enabled) - Number(!b.enabled)
      || a.sortKey.localeCompare(b.sortKey))
})

/** The content warning label of the extension; null for SAFE (no warning entry at all). */
const warningLevel = computed<ContentWarningLevel | null>(() =>
  extension.value ? extensionContentWarning(extension.value) : null,
)
const warningLabel = computed(() => (warningLevel.value ? contentWarningLabel(warningLevel.value) : null))

/** The incognito flag of this extension, kept in this browser. */
const incognito = ref(false)
function readIncognito() {
  try {
    const raw = readPreference(INCOGNITO_KEY)
    const list = raw ? JSON.parse(raw) : []
    incognito.value = Array.isArray(list) && list.includes(pkgName.value)
  } catch { incognito.value = false }
}
function setIncognito(value: boolean) {
  let list: string[] = []
  try {
    const raw = readPreference(INCOGNITO_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) list = parsed.map(String)
  } catch { list = [] }
  list = value ? [...new Set([...list, pkgName.value])] : list.filter(item => item !== pkgName.value)
  writePreference(INCOGNITO_KEY, JSON.stringify(list))
  incognito.value = value
}

function notify(message: string) {
  snackbar.value = message
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
  snackbarTimer = window.setTimeout(() => { snackbar.value = '' }, 4000)
}

/**
 * Extracts libVersion from versionName (e.g. "1.4.25" -> "1.4").
 */
function getLibVersion(versionName: string): string {
  const parts = versionName.split('.')
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`
  return versionName
}

/**
 * The header block is clickable and copies the extension debug information to the clipboard
 * (`DetailsHeader`, ExtensionDetailsScreen.kt:215-245).
 */
function copyDebugInfo() {
  const item = extension.value
  if (!item) return
  const libVersion = getLibVersion(item.versionName)
  const warningText = warningLevel.value ? warningLevel.value.toUpperCase() : 'SAFE'
  const lines = [
    `Extension name: ${item.name} (lang: ${item.lang}; package: ${item.pkgName})`,
    `Extension version: ${item.versionName} (lib: ${libVersion}; version code: ${item.versionCode})`,
    `Content warning: ${warningText}`,
    '',
    `Update available: ${item.hasUpdate}`,
    `Orphaned: ${item.obsolete}`,
    `Shared: ${isShared.value}`,
  ]
  if (item.repo) lines.push(`Repository: ${item.repo}`)
  const text = lines.join('\n')
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => notify('Extension debug information copied to clipboard'),
      () => notify(text),
    )
  } else {
    notify(text)
  }
}

function openStore() {
  const website = storeWebsite(extension.value?.repo ?? null)
  if (!website) {
    showNotice(
      'Not supported in the web version',
      'The web client cannot open the store page of this extension.',
    )
    return
  }
  window.open(website, '_blank', 'noopener,noreferrer')
}

function openSourcePreferences(sourceId: string) {
  void router.push(`/browse/source/${sourceId}/preferences`)
}

function toggleSource(sourceId: string) {
  const current = new Set(disabledSources.value)
  if (current.has(sourceId)) {
    current.delete(sourceId)
  } else {
    current.add(sourceId)
  }
  writeDisabledSources([...current])
}

function toggleAll(enable: boolean) {
  const current = new Set(disabledSources.value)
  const extSourceIds = extensionSources.value.map(s => s.id)
  if (enable) {
    for (const id of extSourceIds) current.delete(id)
  } else {
    for (const id of extSourceIds) current.add(id)
  }
  writeDisabledSources([...current])
}

function goBack() {
  const back = typeof window.history.state?.back === 'string' ? window.history.state.back : ''
  if (back) { router.back(); return }
  void router.push('/browse')
}

/* --- Actions the Suwayomi REST API cannot execute ------------------------------------------- */

/** `onClickUninstall` - the Android package manager removes the extension APK. */
function uninstallExtension() {
  showNotice(
    'Not supported in the web version',
    'Removing an extension is not supported in the web version: Suwayomi-Server exposes no '
    + 'extension management API, and the extension runs on the server. Remove it in the '
    + 'server configuration instead.',
  )
}

/** `onClickClearCookies` - Mihon clears the OkHttp cookie jar of the extension. */
function clearCookies() {
  showNotice(
    'Not supported in the web version',
    'Clearing cookies is not supported in the web version: the cookies live in the cookie jar '
    + 'of the Suwayomi-Server, not in this browser.',
  )
}

/** The Android intent that opens the system app details screen. */
function openAppInfo() {
  showNotice(
    'Not supported in the web version',
    'The Android application details screen is not available in the web version: the extension '
    + 'runs inside the Suwayomi-Server, not as an installed app.',
  )
}

async function load() {
  loading.value = true
  loadError.value = ''
  uninstalled.value = false
  try {
    if (!server.sources.length) void server.loadSources()
    extensions.value = await fetchExtensionList(server.apiUrl)
    iconBroken.value = false
    const item = extensions.value.find(entry => entry.pkgName === pkgName.value)
    if (!item) uninstalled.value = true
  } catch (error) {
    loadError.value = error instanceof Error
      ? error.message
      : 'Cannot reach Suwayomi. Check the server address and whether it is running.'
  } finally {
    loading.value = false
  }
  readIncognito()
  disabledSources.value = readDisabledSources()
}

watch(() => server.apiUrl, () => { void load() })
watch(pkgName, () => { void load() })
onMounted(() => { void load() })
onUnmounted(() => { if (snackbarTimer) window.clearTimeout(snackbarTimer) })
</script>

<template>
  <div class="ext-details">
    <!-- AppBar: title "Extension info", up button and the overflow menu. -->
    <v-app-bar flat height="64" color="surface" class="ext-details-toolbar">
      <v-btn icon="arrow_back" aria-label="Back" @click="goBack" />
      <v-app-bar-title class="text-title-large font-weight-regular">Extension info</v-app-bar-title>

      <!-- AppBarActions: only overflow actions, so a single MoreVert button. -->
      <v-menu v-model="overflowOpen" max-width="196">
        <template #activator="{ props }">
          <v-btn v-bind="props" icon="more_vert" aria-label="More options" />
        </template>
        <v-list>
          <v-list-item title="Enable all" @click="overflowOpen = false; toggleAll(true)" />
          <v-list-item title="Disable all" @click="overflowOpen = false; toggleAll(false)" />
          <v-list-item title="Clear cookies" @click="overflowOpen = false; clearCookies()" />
        </v-list>
      </v-menu>
    </v-app-bar>

    <!-- LoadingScreen.kt: centered CircularProgressIndicator. -->
    <div v-if="loading" class="ext-details-loading" role="status" aria-label="Loading extension">
      <v-progress-circular indeterminate color="primary" size="40" width="4" />
    </div>

    <!-- State.Uninstalled: the extension is unknown to the server. -->
    <div v-else-if="loadError || uninstalled || !extension" class="ext-details-empty">
      <p class="ext-details-empty-message">{{ loadError || 'No results found' }}</p>
      <button type="button" class="ext-details-empty-action" @click="goBack">Back</button>
    </div>

    <!-- ScrollbarLazyColumn(contentPadding = paddingValues). -->
    <div v-else class="ext-details-scroll">
      <!-- WarningBanner(obsolete_extension_message): error background, 16dp padding. -->
      <p v-if="extension.obsolete" class="ext-details-banner">
        This extension is not associated with any store. It will not receive updates, may not
        function properly, and can cause issues with the app. Uninstalling it is recommended.
      </p>

      <!-- DetailsHeader -->
      <div class="ext-details-header">
        <!-- The clickable header block copies the extension debug information. -->
        <div
          class="ext-details-identity"
          role="button"
          tabindex="0"
          aria-label="Copy extension debug information"
          @click="copyDebugInfo"
          @keydown.enter="copyDebugInfo"
        >
          <!-- ExtensionIcon: 112dp, not clipped for a loaded extension. -->
          <img
            v-if="!iconBroken && iconUrl(extension)"
            class="ext-details-icon"
            :src="iconUrl(extension)"
            alt=""
            @error="iconBroken = true"
          />
          <span v-else class="material-symbols-rounded ext-details-icon ext-details-icon--fallback" aria-hidden="true">extension</span>

          <p class="ext-details-name">{{ extension.name }}</p>
          <p class="ext-details-package">{{ extension.pkgName }}</p>

          <!-- extension.store.name: a labelLarge link to the store page. -->
          <button
            v-if="storeName(extension.repo)"
            type="button"
            class="ext-details-store"
            @click.stop="openStore"
          >
            {{ storeName(extension.repo) }}
          </button>

          <!-- ExtensionPill("Private") for an extension that is not shared. -->
          <ExtensionPill v-if="!isShared" text="Private" class="ext-details-pill" />
        </div>

        <!-- The three InfoText columns: version, language and the content warning. -->
        <div class="ext-details-infos">
          <div class="ext-details-info">
            <p class="ext-details-info-primary">{{ extension.versionName }}</p>
            <p class="ext-details-info-secondary">Version</p>
          </div>
          <span class="ext-details-info-divider" aria-hidden="true" />
          <div class="ext-details-info">
            <p class="ext-details-info-primary">{{ displayLanguage(extension.lang) }}</p>
            <p class="ext-details-info-secondary">Language</p>
          </div>
          <template v-if="warningLabel">
            <span class="ext-details-info-divider" aria-hidden="true" />
            <button
              type="button"
              class="ext-details-info ext-details-info--clickable"
              @click="showContentWarning = true"
            >
              <p
                class="ext-details-info-primary"
                :class="{
                  'is-error': warningLabel.color === 'error',
                  'is-primary': warningLabel.color === 'primary',
                }"
              >{{ warningLabel.title }}</p>
              <p class="ext-details-info-secondary">Warning ⓘ</p>
            </button>
          </template>
        </div>

        <!-- The action row: "Uninstall" (outlined) and "App info" (filled). -->
        <div class="ext-details-actions">
          <button type="button" class="ext-details-button ext-details-button--outlined" @click="uninstallExtension">
            Uninstall
          </button>
          <button v-if="isShared" type="button" class="ext-details-button ext-details-button--filled" @click="openAppInfo">
            App info
          </button>
        </div>

        <!-- TextPreferenceWidget: "Incognito mode". -->
        <div class="ext-details-pref">
          <span class="ext-details-pref-icon" aria-hidden="true">
            <!-- Material Symbols Rounded 'eyeglasses_2' (Mihon reference) -->
            <svg viewBox="0 -960 960 960" focusable="false">
              <path
                d="M218-320q-42 0-75.5-27T100-416L71-550h-4q-17 2-29.5-9T23-587q-2-17 9.5-29T61-630q62-5 108-7.5t84-2.5q65 0 105 6t72 21q14 7 26.5 10t23.5 3q11 0 21.5-3t24.5-9q33-15 76-21.5t114-6.5q46 0 97 2.5t87 6.5q17 2 28 14t9 29q-2 17-14 28t-29 9h-4l-30 136q-9 42-42 68.5T743-320h-89q-42 0-74-25.5T538-411l-27-107h-61l-27 107q-11 41-43 66t-73 25h-89Zm-40-112q3 14 14 23t25 9h89q14 0 25-8.5t14-21.5l31-121q-27-5-61-6.5t-62-1.5q-23 0-49.5.5T154-556l24 124Zm437 2q3 13 14 21.5t25 8.5h89q14 0 25-9t14-23l26-125q-20-1-46-1.5t-46-.5q-30 0-66.5 1.5T584-551l31 121Z"
              />
            </svg>
          </span>
          <div class="ext-details-pref-text">
            <p class="ext-details-pref-title">Incognito mode</p>
            <p class="ext-details-pref-subtitle">Pause reading history for extension</p>
          </div>
          <div class="ext-details-pref-widget">
            <Md3Switch :model-value="incognito" label="Incognito mode" @update:model-value="setIncognito" />
          </div>
        </div>
        <hr class="ext-details-divider" />
      </div>

      <!-- SourceSwitchPreference: one row per source of the extension. -->
      <div
        v-for="source in sourceRows"
        :key="source.id"
        class="ext-details-source"
        role="button"
        tabindex="0"
        @click="toggleSource(source.id)"
        @keydown.enter="toggleSource(source.id)"
        @keydown.space.prevent="toggleSource(source.id)"
      >
        <div class="ext-details-pref-text">
          <p class="ext-details-pref-title">{{ source.title }}</p>
        </div>
        <div class="ext-details-pref-widget ext-details-source-widget">
          <button
            v-if="source.isConfigurable"
            type="button"
            class="ext-details-source-settings"
            aria-label="Settings"
            @click.stop="openSourcePreferences(source.id)"
          >
            <span class="material-symbols-rounded" aria-hidden="true">settings</span>
          </button>
          <Md3Switch
            :model-value="source.enabled"
            :label="source.title"
            @update:model-value="toggleSource(source.id)"
          />
        </div>
      </div>
    </div>

    <!-- ContentWarningDialog: opened by the warning info text. -->
    <ContentWarningDialog v-model="showContentWarning" :warning="warningLevel" />

    <!-- The honest notice for the actions the REST API cannot execute. -->
    <v-dialog v-model="noticeOpen" content-class="ext-details-overlay">
      <div class="ext-details-dialog">
        <h2 class="ext-details-dialog-title">{{ noticeTitle }}</h2>
        <p class="ext-details-dialog-text">{{ notice }}</p>
        <div class="ext-details-dialog-actions">
          <button type="button" class="ext-details-dialog-button" @click="noticeOpen = false">OK</button>
        </div>
      </div>
    </v-dialog>

    <div v-if="snackbar" class="ext-details-snackbar" role="status" aria-live="polite">
      <span class="ext-details-snackbar-text">{{ snackbar }}</span>
    </div>
  </div>
</template>

<style>
/* Material3 BasicAlertDialog: min 280dp, max 560dp, content sized. */
.v-dialog > .ext-details-overlay {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}
/* Compose draws the dialog surface with tonalElevation = 0.dp and without a shadow elevation. */
.v-dialog > .ext-details-overlay > .ext-details-dialog { box-shadow: none; }
</style>

<style scoped>
/* The screen fills the area below the 64dp app bar (the app bar is a layout item). */
.ext-details {
  position: relative;
  min-height: calc(100dvh - 64px);
  background: rgb(var(--v-theme-background));
}

.ext-details-toolbar :deep(.v-toolbar__title) {
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
}

/* ScrollbarLazyColumn: the content scrolls inside the screen, below the 64dp app bar. */
.ext-details-scroll {
  height: calc(100dvh - 64px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: 24px;
}
.ext-details-scroll::-webkit-scrollbar {
  width: 4px;
}
.ext-details-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.ext-details-scroll::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 20%, transparent);
  border-radius: 2px;
}

/* WarningBanner: error background, onError content, 16dp padding, bodyMedium. */
.ext-details-banner {
  margin: 0;
  padding: 16px;
  background: rgb(var(--v-theme-error));
  color: rgb(var(--v-theme-on-error));
  font-size: 14px;
  line-height: 20px;
  letter-spacing: .0178571em;
  text-align: center;
}

/* DetailsHeader: the identity block (16dp horizontal, 16dp top, 8dp bottom). */
.ext-details-header { display: block; }

.ext-details-identity {
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  padding: 16px 16px 8px;
  text-align: center;
  cursor: pointer;
  user-select: none;
  transition: background-color .15s ease;
}
.ext-details-identity:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 4%, transparent); }
.ext-details-identity:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 10%, transparent); }
.ext-details-identity:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }

/* ExtensionIcon: 112dp box; a loaded extension is not clipped. */
.ext-details-icon {
  width: 112px;
  height: 112px;
  object-fit: contain;
  display: block;
}
.ext-details-icon--fallback {
  display: grid;
  place-items: center;
  font-size: 112px;
  line-height: 112px;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* Text(name, headlineSmall): 24sp / 32sp, weight 400, centered. */
.ext-details-name {
  margin: 0;
  padding: 0;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: 0;
  text-align: center;
  color: rgb(var(--v-theme-on-surface));
}

/* Text(pkgName, bodySmall): 12sp / 16sp, onSurfaceVariant, centered. */
.ext-details-package {
  margin: 0;
  font-size: 12px;
  line-height: 16px;
  letter-spacing: .0333333em;
  text-align: center;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* Text(store.name, labelLarge): 14sp / 20sp, weight 500, primary, 4dp/2dp padding, radius 8dp. */
.ext-details-store {
  margin: 4px 0 0;
  padding: 2px 4px;
  border: none;
  border-radius: 8px;
  background: none;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .00625em;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
}
.ext-details-store:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
.ext-details-store:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }

.ext-details-pill { margin-top: 8px; }

/* The InfoText row: 16dp horizontal, 8dp vertical, evenly spaced. */
.ext-details-infos {
  display: flex;
  align-items: center;
  justify-content: space-evenly;
  box-sizing: border-box;
  width: 100%;
  padding: 8px 16px;
}

.ext-details-info {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: none;
  font-family: inherit;
  text-align: center;
  cursor: default;
}
.ext-details-info--clickable {
  cursor: pointer;
  background: transparent;
}
.ext-details-info--clickable:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }

/* InfoText primary: titleSmall, 14sp / 20sp, weight 500, maxLines 2, ellipsis. */
.ext-details-info-primary {
  margin: 0;
  max-width: 100%;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .0092857em;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.ext-details-info-primary.is-error { color: rgb(var(--v-theme-error)); }
.ext-details-info-primary.is-primary { color: rgb(var(--v-theme-primary)); }

/* InfoText secondary: bodySmall, 12sp / 16sp, onSurface at 50%. */
.ext-details-info-secondary {
  margin: 0;
  font-size: 12px;
  line-height: 16px;
  letter-spacing: .0333333em;
  color: rgb(var(--v-theme-on-surface));
  opacity: .5;
}

/* InfoDivider: a vertical divider 24dp tall with 8dp horizontal padding. */
.ext-details-info-divider {
  flex: 0 0 auto;
  width: 1px;
  height: 24px;
  margin: 0 8px;
  background: rgb(var(--v-theme-outline-variant));
}

/* The action row: 16dp horizontal, 8dp top, 16dp between the buttons. */
.ext-details-actions {
  display: flex;
  gap: 16px;
  box-sizing: border-box;
  width: 100%;
  padding: 8px 16px 0;
}

/* MD3 buttons: 40dp tall, fully rounded (20dp), labelLarge (14sp / 20sp, weight 500). */
.ext-details-button {
  flex: 1 1 0;
  min-width: 0;
  height: 40px;
  padding: 0 24px;
  border-radius: 20px;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .00625em;
  cursor: pointer;
  transition: background-color .15s ease, box-shadow .15s ease;
}
.ext-details-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.ext-details-button--outlined {
  border: 1px solid rgb(var(--v-theme-outline));
  background: none;
  color: rgb(var(--v-theme-primary));
}
.ext-details-button--outlined:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
.ext-details-button--outlined:active { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 12%, transparent); }
.ext-details-button--filled {
  border: none;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.ext-details-button--filled:hover { box-shadow: 0 1px 2px rgba(0, 0, 0, .3), 0 2px 6px 2px rgba(0, 0, 0, .15); }
.ext-details-button--filled:active { box-shadow: 0 1px 2px rgba(0, 0, 0, .3), 0 2px 6px 2px rgba(0, 0, 0, .15); }

/* BasePreferenceWidget: Row(minHeight 56dp). */
.ext-details-pref,
.ext-details-source {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  min-height: 56px;
  padding: 0;
  border: none;
  background: none;
  text-align: start;
  font-family: inherit;
  color: rgb(var(--v-theme-on-surface));
}

/* Incognito row has 8dp horizontal padding modifier from DetailsHeader. */
.ext-details-pref {
  padding: 0 8px;
}

/* SourceSwitchPreference: full width, clickable row with M3 hover/active state layers. */
.ext-details-source {
  cursor: pointer;
  user-select: none;
  transition: background-color .15s ease;
}
.ext-details-source:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 4%, transparent); }
.ext-details-source:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 10%, transparent); }
.ext-details-source:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }

/* The icon slot: 16dp start padding, 8dp end padding, primary tint, 24dp icon. */
.ext-details-pref-icon {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: 48px;
  height: 48px;
  padding: 0 8px 0 16px;
  color: rgb(var(--v-theme-primary));
}
.ext-details-pref-icon svg { width: 24px; height: 24px; fill: currentColor; }

/* The title column: weight 1f, 16dp vertical padding, 16dp horizontal title padding. */
.ext-details-pref-text {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 16px;
}
/* The title: titleLarge with fontSize 16sp (line height 24sp), maxLines 2, ellipsis. */
.ext-details-pref-title {
  margin: 0;
  padding: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: .009375em;
  color: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
/* The subtitle: bodySmall, 12sp / 16sp, with secondary item alpha (0.78). */
.ext-details-pref-subtitle {
  margin: 0;
  padding: 0;
  font-size: 12px;
  line-height: 16px;
  letter-spacing: .0333333em;
  color: inherit;
  opacity: .78;
}

/* The widget slot: 16dp end padding. */
.ext-details-pref-widget {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding-inline-end: 16px;
}
.ext-details-source-widget { gap: 0; }

/* The source settings IconButton: 48dp touch target, 24dp icon, onSurface tint. */
.ext-details-source-settings {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  transition: background-color .15s ease;
}
.ext-details-source-settings:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.ext-details-source-settings:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent); }
.ext-details-source-settings:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }
.ext-details-source-settings .material-symbols-rounded { font-size: 24px; line-height: 24px; }

/* HorizontalDivider: 1dp outlineVariant. */
.ext-details-divider {
  margin: 0;
  border: none;
  border-top: 1px solid rgb(var(--v-theme-outline-variant));
}

/* LoadingScreen: centered CircularProgressIndicator. */
.ext-details-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100dvh - 64px);
}

/* State.Uninstalled: a centered message. */
.ext-details-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100dvh - 64px);
  padding: 0 24px;
  text-align: center;
}
.ext-details-empty-message {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: .0178571em;
  color: rgb(var(--v-theme-on-surface));
  opacity: .78;
}
.ext-details-empty-action {
  margin-top: 16px;
  height: 40px;
  padding: 0 24px;
  border: none;
  border-radius: 20px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  cursor: pointer;
}

/* Material3 BasicAlertDialog: 24dp padding, CornerExtraLarge (28dp), surfaceContainerHigh. */
.ext-details-dialog {
  box-sizing: border-box;
  min-width: min(280px, calc(100vw - 48px));
  max-width: min(560px, calc(100vw - 48px));
  padding: 24px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
}
/* headlineSmall: 24sp / 32sp, weight 400. */
.ext-details-dialog-title {
  margin: 0 0 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: 0;
}
/* bodyMedium: 14sp / 20sp, onSurfaceVariant. */
.ext-details-dialog-text {
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: .0178571em;
  color: rgb(var(--v-theme-on-surface-variant));
}
.ext-details-dialog-actions { display: flex; justify-content: flex-end; }
/* TextButton: 40dp tall, min width 58dp, 12dp horizontal padding, 20dp radius. */
.ext-details-dialog-button {
  height: 40px;
  min-width: 58px;
  padding: 0 12px;
  border: none;
  border-radius: 20px;
  background: none;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .00625em;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  transition: background-color .15s ease;
}
.ext-details-dialog-button:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
.ext-details-dialog-button:active { border-radius: 8px; background: color-mix(in srgb, rgb(var(--v-theme-primary)) 10%, transparent); }
.ext-details-dialog-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* MD3 snackbar: inverseSurface, 4dp radius, 14dp/16dp padding. */
.ext-details-snackbar {
  position: fixed;
  left: calc((100% + var(--v-layout-left, 0px) - var(--v-layout-right, 0px)) / 2);
  bottom: calc(var(--v-layout-bottom, 0px) + 16px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  z-index: 1000;
  max-width: min(560px, calc(100vw - 32px));
  min-width: 288px;
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  box-shadow: 0 3px 6px rgba(0, 0, 0, .28), 0 1px 2px rgba(0, 0, 0, .2);
}
</style>
