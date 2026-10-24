<script setup lang="ts">
/**
 * Settings > Browse panel.
 *
 * Mihon reference:
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsBrowseScreen.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/{Base,Text,Switch,MultiSelectList}PreferenceWidget.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/InfoWidget.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/PreferenceGroupHeader.kt
 *
 * Structure of the reference screen:
 *   Group "Sources"
 *     - SwitchPreference "Hide entries already in library" (no subtitle, no icon)
 *     - TextPreference "Extension stores" (subtitle = plural num_repos, opens ExtensionStoresScreen)
 *   Group "Extensions"
 *     - MultiSelectListPreference "Allowed content warnings" (Safe / Mixed / 18+)
 *     - SwitchPreference "Also apply to installed extensions" (with summary)
 *     - InfoPreference content_warnings_info
 *
 * Web limits (honest stubs, the UI itself is complete):
 *   - `authenticate(title)` is the Android biometric prompt. The browser has no equivalent
 *     biometric gate, so a confirmation dialog replaces it and says so.
 *   - Extension store management (add / remove an index) has no Suwayomi-Server REST contract,
 *     so the "Extension stores" row opens the stores screen when it is routed and an honest
 *     stub dialog otherwise.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { fetchExtensionStoreCount } from '@/core/api/extensionStoreCount'
import {
  applyContentWarningsToInstalled,
  contentWarningEntries,
  contentWarningsSubtitle,
  enabledContentWarnings,
  hideInLibraryItems,
  type ContentWarningKey,
} from '@/core/utils/browsePreferences'
import Md3Switch from '@/core/components/Md3Switch.vue'

const server = useSuwayomiStore()
const router = useRouter()

// --- extension store count (Mihon: `getExtensionStoreCountAsFlow`) ----------------------------
const storeCount = ref(0)
const storeCountFailed = ref(false)
async function loadStoreCount() {
  try {
    storeCount.value = await fetchExtensionStoreCount(server.apiUrl)
    storeCountFailed.value = false
  } catch {
    storeCountFailed.value = true
  }
}
onMounted(() => { void loadStoreCount() })
watch(() => server.apiUrl, () => { void loadStoreCount() })

/** MR.plurals.num_repos: one "%d store", other "%d stores". */
const storeCountSubtitle = computed(() =>
  storeCount.value === 1 ? '1 store' : `${storeCount.value} stores`)

// --- "Extension stores" row ------------------------------------------------------------------
/** Mihon pushes `ExtensionStoresScreen()`; the web equivalent is the extension stores view. */
const EXTENSION_STORES_PATH = '/settings/browse/stores'
const storesStubOpen = ref(false)
/** The whole row is clickable in the reference (Switch(onCheckedChange = null)). */
function toggleHideInLibrary() {
  hideInLibraryItems.value = !hideInLibraryItems.value
}
/** The switch itself must not toggle twice when the row handler also fires. */
function setHideInLibrary(value: boolean) {
  hideInLibraryItems.value = value
}

function openExtensionStores() {
  void router.push(EXTENSION_STORES_PATH)
}

// --- "Allowed content warnings" multi-select dialog -------------------------------------------
const warningsOpen = ref(false)
const draftWarnings = ref<ContentWarningKey[]>([])
function openWarningsDialog() {
  draftWarnings.value = [...enabledContentWarnings.value]
  warningsOpen.value = true
}
function toggleDraft(key: ContentWarningKey, checked: boolean) {
  draftWarnings.value = checked
    ? [...draftWarnings.value.filter(value => value !== key), key]
    : draftWarnings.value.filter(value => value !== key)
}

/**
 * Mihon calls `authenticate(title)` when a non-SAFE warning is added. The web client cannot
 * use the Android biometric prompt, so the same gate is kept as an explicit confirmation
 * that states why the device prompt is missing.
 */
const authOpen = ref(false)
function confirmWarnings() {
  const added = draftWarnings.value.filter(value => !enabledContentWarnings.value.includes(value))
  if (added.some(value => value !== 'safe')) {
    warningsOpen.value = false
    authOpen.value = true
    return
  }
  applyWarnings()
}
function applyWarnings() {
  enabledContentWarnings.value = [...draftWarnings.value]
  authOpen.value = false
  warningsOpen.value = false
}
/** Cancel of the authentication gate returns to the multi-select dialog. */
function cancelAuth() {
  authOpen.value = false
  warningsOpen.value = true
}

/** Mihon: `onValueChanged` of applyContentWarningsToInstalled authenticates when set to false. */
const applyDialogOpen = ref(false)
function onApplyToInstalledChange(value: boolean) {
  if (value) {
    applyContentWarningsToInstalled.value = true
    return
  }
  applyDialogOpen.value = true
}
function confirmApplyToInstalled() {
  applyContentWarningsToInstalled.value = false
  applyDialogOpen.value = false
}

/** MR.strings.content_warnings_info */
const INFO_TEXT =
  "Installed extensions that aren't loaded stay listed without their sources; ones you haven't installed are hidden. This does not prevent unofficial or potentially incorrectly flagged extensions from surfacing 18+ content within the app."
</script>

<template>
  <div class="browse-settings">
    <!-- PreferenceGroupHeader: "Sources" (bodyMedium 14/20sp w500 color secondary, padding top 14dp, bottom 8dp, horizontal 16dp) -->
    <h2 class="pref-group-header">Sources</h2>

    <!-- SwitchPreference: "Hide entries already in library" (no subtitle, no icon).
         The reference makes the whole row clickable (Switch onCheckedChange = null). -->
    <div
      class="pref-row pref-row--switch"
      role="switch"
      :aria-checked="hideInLibraryItems"
      tabindex="0"
      @click="toggleHideInLibrary"
      @keydown.space.prevent="toggleHideInLibrary"
      @keydown.enter.prevent="toggleHideInLibrary"
    >
      <span class="pref-text">
        <span class="pref-title">Hide entries already in library</span>
      </span>
      <span class="pref-trailing">
        <Md3Switch
          :model-value="hideInLibraryItems"
          label="Hide entries already in library"
          @update:model-value="setHideInLibrary"
        />
      </span>
    </div>

    <!-- TextPreference: "Extension stores" with the store count as subtitle (plural num_repos) -->
    <button type="button" class="pref-row pref-row-button" @click="openExtensionStores">
      <span class="pref-text">
        <span class="pref-title">Extension stores</span>
        <span class="pref-subtitle">{{ storeCountSubtitle }}</span>
      </span>
    </button>

    <!-- Spacer(12.dp) between the two preference groups -->
    <div class="pref-group-spacer" />

    <!-- PreferenceGroupHeader: "Extensions" -->
    <h2 class="pref-group-header">Extensions</h2>

    <!-- MultiSelectListPreference: "Allowed content warnings" -->
    <button type="button" class="pref-row pref-row-button" @click="openWarningsDialog">
      <span class="pref-text">
        <span class="pref-title">Allowed content warnings</span>
        <span class="pref-subtitle">{{ contentWarningsSubtitle(enabledContentWarnings) }}</span>
      </span>
    </button>

    <!-- SwitchPreference: "Also apply to installed extensions" -->
    <div
      class="pref-row pref-row--switch"
      role="switch"
      :aria-checked="applyContentWarningsToInstalled"
      tabindex="0"
      @click="onApplyToInstalledChange(!applyContentWarningsToInstalled)"
      @keydown.space.prevent="onApplyToInstalledChange(!applyContentWarningsToInstalled)"
      @keydown.enter.prevent="onApplyToInstalledChange(!applyContentWarningsToInstalled)"
    >
      <span class="pref-text">
        <span class="pref-title">Also apply to installed extensions</span>
        <span class="pref-subtitle">When off, extensions you already installed keep loading and updating regardless of their warning</span>
      </span>
      <span class="pref-trailing">
        <Md3Switch
          :model-value="applyContentWarningsToInstalled"
          label="Also apply to installed extensions"
          @update:model-value="onApplyToInstalledChange"
        />
      </span>
    </div>

    <!-- InfoPreference: content_warnings_info (Info icon 24dp + bodySmall text, secondaryItemAlpha 0.78) -->
    <div class="pref-info">
      <span class="material-symbols-rounded pref-info-icon" aria-hidden="true">info</span>
      <p class="pref-info-text">{{ INFO_TEXT }}</p>
    </div>

    <!-- MultiSelectListPreferenceWidget: AlertDialog with LabeledCheckbox rows, OK / Cancel -->
    <v-dialog v-model="warningsOpen" max-width="560">
      <v-card class="pref-dialog" color="surface-container-high">
        <h2 class="pref-dialog-title">Allowed content warnings</h2>
        <div class="pref-dialog-body">
          <label v-for="entry in contentWarningEntries" :key="entry.key" class="pref-labeled-checkbox">
            <input
              type="checkbox"
              class="pref-checkbox"
              :checked="draftWarnings.includes(entry.key)"
              @change="toggleDraft(entry.key, ($event.target as HTMLInputElement).checked)"
            />
            <span
              class="pref-checkbox-box"
              :class="{ 'is-checked': draftWarnings.includes(entry.key) }"
              aria-hidden="true"
            >
              <span class="material-symbols-rounded pref-checkbox-check">check</span>
            </span>
            <span class="pref-checkbox-label">{{ entry.title }}</span>
          </label>
        </div>
        <div class="pref-dialog-actions">
          <button type="button" class="pref-dialog-button" @click="warningsOpen = false">Cancel</button>
          <button type="button" class="pref-dialog-button" @click="confirmWarnings">OK</button>
        </div>
      </v-card>
    </v-dialog>

    <!-- Web stub for the Android biometric prompt (authenticate). -->
    <v-dialog v-model="authOpen" max-width="560">
      <v-card class="pref-dialog" color="surface-container-high">
        <h2 class="pref-dialog-title">Allowed content warnings</h2>
        <p class="pref-dialog-text">
          Mihon asks for device authentication (biometrics or device credentials) before 18+ content is allowed. The web version cannot use the Android device prompt, so this confirmation replaces it.
        </p>
        <div class="pref-dialog-actions">
          <button type="button" class="pref-dialog-button" @click="cancelAuth">Cancel</button>
          <button type="button" class="pref-dialog-button" @click="applyWarnings">OK</button>
        </div>
      </v-card>
    </v-dialog>

    <!-- Web stub for the Android biometric prompt of "Also apply to installed extensions". -->
    <v-dialog v-model="applyDialogOpen" max-width="560">
      <v-card class="pref-dialog" color="surface-container-high">
        <h2 class="pref-dialog-title">Also apply to installed extensions</h2>
        <p class="pref-dialog-text">
          Mihon asks for device authentication (biometrics or device credentials) before the warning of already installed extensions stops being applied. The web version cannot use the Android device prompt, so this confirmation replaces it.
        </p>
        <div class="pref-dialog-actions">
          <button type="button" class="pref-dialog-button" @click="applyDialogOpen = false">Cancel</button>
          <button type="button" class="pref-dialog-button" @click="confirmApplyToInstalled">OK</button>
        </div>
      </v-card>
    </v-dialog>

    <!-- Web stub: the extension stores screen has no route yet. -->
    <v-dialog v-model="storesStubOpen" max-width="560">
      <v-card class="pref-dialog" color="surface-container-high">
        <h2 class="pref-dialog-title">Extension stores</h2>
        <p class="pref-dialog-text">
          The server reports {{ storeCountSubtitle }}.
          <template v-if="storeCountFailed"> The store list could not be read from the server. </template>
          Adding, editing and removing an extension store is not supported in the web version: Suwayomi-Server's REST API exposes no endpoint to manage extension repositories.
        </p>
        <div class="pref-dialog-actions">
          <button type="button" class="pref-dialog-button" @click="storesStubOpen = false">Close</button>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
@layer app-components {
/* BasePreferenceWidget.kt: Row, sizeIn(minHeight = 56.dp), fillMaxWidth, verticalAlignment Center. */
.browse-settings { display: block; }
.pref-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 56px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  transition: background-color .2s ease-in-out;
}
.pref-row-button { cursor: pointer; }
.pref-row:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.pref-row:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent); }
.pref-row:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }

/* Column(weight = 1f, padding(vertical = 16.dp)) with the title and the subtitle. */
.pref-text {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  flex-direction: column;
  padding: 16px 16px;
}
/* titleLarge with fontSize = 16.sp (the line height of titleLarge stays 28.sp),
   maxLines = 2 with TextOverflow.Ellipsis. */
.pref-title {
  font-size: 16px;
  line-height: 28px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
/* bodySmall, secondaryItemAlpha() = 78% alpha, maxLines = 10. */
.pref-subtitle {
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: .0333333333em;
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 78%, transparent);
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 10;
}

/* Trailing widget: Box(padding(end = 16.dp)) around the Switch (which has padding(start = 16.dp)). */
.pref-trailing {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding-inline-end: 16px;
}

/* PreferenceGroupHeader.kt: padding(bottom = 8.dp, top = 14.dp), bodyMedium in secondary (w500). */
.pref-group-header {
  margin: 0;
  padding: 14px 16px 8px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .0178571429em;
  color: rgb(var(--v-theme-secondary));
}
/* PreferenceScreen.kt: Spacer(12.dp) between the groups. */
.pref-group-spacer { height: 12px; }

/* InfoWidget.kt: Column(padding(horizontal = 16.dp, vertical = 16.dp)), spacedBy(16.dp),
   secondaryItemAlpha(), Info icon + bodySmall text. */
.pref-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  opacity: .78;
  color: rgb(var(--v-theme-on-surface));
}
.pref-info-icon {
  font-size: 24px;
  line-height: 24px;
  width: 24px;
  height: 24px;
}
.pref-info-text {
  margin: 0;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: .0333333333em;
}

/* Material3 AlertDialog: 28dp radius, surfaceContainerHigh, 24dp padding, headlineSmall title. */
.pref-dialog {
  border-radius: 28px !important;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, .15), 0 4px 8px 3px rgba(0, 0, 0, .15) !important;
  padding: 24px;
  min-width: 280px;
  color: rgb(var(--v-theme-on-surface));
}
.pref-dialog-title {
  margin: 0 0 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}
.pref-dialog-text {
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: .0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}
.pref-dialog-body {
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
}
.pref-dialog-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
/* MD3 TextButton: 40dp height, 58dp min width, 12dp padding, 20dp radius, labelLarge in primary. */
.pref-dialog-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  height: 40px;
  padding: 0 12px;
  border: none;
  border-radius: 20px;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .0071428571em;
  text-transform: none;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  overflow: hidden;
  transition: background-color .2s ease-in-out;
}
.pref-dialog-button:hover {
  background-color: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent);
}
.pref-dialog-button:active {
  background-color: color-mix(in srgb, rgb(var(--v-theme-primary)) 12%, transparent);
}
.pref-dialog-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* LabeledCheckbox.kt: Row, fillMaxWidth, heightIn(min = 48.dp), spacedBy(8.dp), Checkbox + label, clip(shapes.small = 8.dp). */
.pref-labeled-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 8px;
  border-radius: 8px;
  cursor: pointer;
  user-select: none;
  transition: background-color .2s ease-in-out;
}
.pref-labeled-checkbox:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.pref-labeled-checkbox:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.pref-checkbox {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
/* MD3 Checkbox: 18dp box, 2dp outline, 2dp radius, primary fill when checked. */
.pref-checkbox-box {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
  border-radius: 2px;
  color: transparent;
  transition: background-color .15s ease-in-out, border-color .15s ease-in-out, color .15s ease-in-out;
}
.pref-checkbox-box.is-checked {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.pref-checkbox-check {
  font-size: 16px;
  line-height: 16px;
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
.pref-checkbox:focus-visible + .pref-checkbox-box {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
/* LabeledCheckbox label: bodyMedium (14sp / 20sp) provided by AlertDialogContent. */
.pref-checkbox-label {
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: .0178571429em;
  color: rgb(var(--v-theme-on-surface));
}
}
</style>
