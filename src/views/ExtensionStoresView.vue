<script setup lang="ts">
/**
 * Extension stores screen.
 *
 * Mihon reference:
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/browse/ExtensionStoresScreen.kt
 *   .../browse/components/ExtensionStoresScreen.kt
 *   .../browse/components/ExtensionStoresContent.kt
 *   .../browse/components/ExtensionStoresDialogs.kt
 *   .../browse/ExtensionStoresViewModel.kt
 *
 * Structure of the reference screen:
 *  - `Scaffold` with an `AppBar` (navigateUp, title "Extension stores", one action: refresh) and a
 *    `CategoryFloatingActionButton` (SmallExtendedFloatingActionButton "Add") as the FAB.
 *  - While the state is `Loading` the whole screen is a `LoadingScreen` (no app bar).
 *  - Empty state: `EmptyScreen` (kaomoji face, bodyMedium message, optional actions).
 *  - Content: `LazyColumn` with contentPadding = scaffold padding + topSmallPaddingValues (8dp)
 *    + horizontal medium padding (16dp), verticalArrangement = spacedBy(small = 8dp).
 *  - Each item is an `ElevatedCard` with a header row (label icon + store name, titleMedium) and a
 *    trailing action row (open in browser, Discord when present, copy to clipboard, delete).
 *  - Dialogs: `ExtensionStoreCreateDialog` (outlined URL field, supporting text, Add/Cancel),
 *    `ExtensionStoreDeleteDialog` (Remove extension store, OK/Cancel) and the deeplink
 *    `ExtensionStoreConfirmDialog`.
 *
 * Web limits: Suwayomi-Server has no extension-store management API (no list/add/remove endpoints),
 * so the store list is derived from the catalogue (`GET /extension/list`, field `repo`) and adding
 * or removing a store cannot be executed. The affected actions open an accurate stub dialog that
 * says so instead of silently doing nothing.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchExtensionStores, type ExtensionStoreDto } from '../api/extensionStores'
import { useSuwayomiStore } from '../stores/suwayomi'
import CategoryFab from '../components/CategoryFab.vue'

const server = useSuwayomiStore()
const router = useRouter()
const route = useRoute()

function goBack() {
  if (route.query.from === 'settings') {
    void router.push('/settings/browse')
    return
  }
  const backState = typeof window.history.state?.back === 'string' ? window.history.state.back : ''
  if (backState.startsWith('/settings')) {
    void router.push('/settings/browse')
    return
  }
  if (backState) {
    router.back()
    return
  }
  void router.push('/browse')
}

// --- state ---------------------------------------------------------------------------------
const stores = ref<ExtensionStoreDto[]>([])
const loading = ref(true)
const refreshing = ref(false)
const error = ref<string | null>(null)

async function loadStores(isRefresh = false) {
  if (isRefresh) refreshing.value = true
  else loading.value = true
  error.value = null
  try {
    stores.value = await fetchExtensionStores(server.apiUrl)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Cannot reach Suwayomi.'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

onMounted(() => { void loadStores() })
watch(() => server.apiUrl, () => { void loadStores() })

const isEmpty = computed(() => !loading.value && stores.value.length === 0)

/** The scrolling list, used by the FAB to follow the expand/collapse rule. */
const listEl = ref<HTMLElement | null>(null)

/** EmptyScreen uses a random kaomoji face above the message. */
const errorFaces = ['(･o･;)', 'Σ(ಠ_ಠ)', 'ಥ_ಥ', '(˘･_･˘)', '(；￣Д￣)', '(･Д･。', '(╬ಠ益ಠ)', '(╥﹏╥)', '(⋟﹏⋞)', 'Ò︵Ó', ' ˙ᯅ˙)', '(¬_¬)']
const face = errorFaces[Math.floor(Math.random() * errorFaces.length)]

// --- actions -------------------------------------------------------------------------------
function openWebsite(store: ExtensionStoreDto) {
  if (!store.website) return
  window.open(store.website, '_blank', 'noopener,noreferrer')
}

/** Opens the store's Discord invite (Mihon: `onOpenDiscord`). */
function openDiscord(store: ExtensionStoreDto) {
  if (!store.discord) return
  window.open(store.discord, '_blank', 'noopener,noreferrer')
}

const snackbar = ref('')
let snackbarTimer: number | undefined
function notify(message: string) {
  snackbar.value = message
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
  snackbarTimer = window.setTimeout(() => { snackbar.value = '' }, 6000)
}

/** Mihon copies the index URL to the clipboard and shows it as the toast label. */
async function copyIndexUrl(store: ExtensionStoreDto) {
  try {
    await navigator.clipboard.writeText(store.indexUrl)
    notify(store.indexUrl)
  } catch {
    notify(store.indexUrl)
  }
}

// --- dialogs --------------------------------------------------------------------------------
type DialogKind = 'create' | 'delete' | 'confirm' | null

const dialog = ref<DialogKind>(null)
const deleteTarget = ref<ExtensionStoreDto | null>(null)
const createUrl = ref('')
const createFocused = ref(false)
const createInput = ref<HTMLInputElement | null>(null)
const createError = ref<string | null>(null)
const createProcessing = ref(false)

const createOpen = computed({
  get: () => dialog.value === 'create',
  set: (value: boolean) => { if (!value) dialog.value = null },
})
const deleteOpen = computed({
  get: () => dialog.value === 'delete',
  set: (value: boolean) => { if (!value) dialog.value = null },
})

/** The store already exists check of ExtensionStoreCreateDialog (storeIndexUrls). */
const storeAlreadyExists = computed(() =>
  stores.value.some(store => store.indexUrl === createUrl.value.trim()),
)

const createSupportingText = computed(() => {
  if (createError.value) return createError.value
  if (storeAlreadyExists.value) return 'This extension store already exists'
  return '*required'
})

const createIsError = computed(() => createError.value !== null || storeAlreadyExists.value)
/* The reference enables the Add button while !processing && text.isNotEmpty() && !alreadyExists. */
const createDisabled = computed(
  () => createUrl.value.trim() === '' || storeAlreadyExists.value,
)

function openCreateDialog() {
  createUrl.value = ''
  createError.value = null
  dialog.value = 'create'
  // The reference requests the focus for the URL field as soon as the dialog opens.
  void nextTick(() => createInput.value?.focus())
}

function openDeleteDialog(store: ExtensionStoreDto) {
  deleteTarget.value = store
  dialog.value = 'delete'
}

function closeDialog() {
  dialog.value = null
  deleteTarget.value = null
  createError.value = null
}

/**
 * Adding a store is not possible in the web version: Suwayomi-Server's REST API exposes no
 * endpoint to register an extension repository. The reference dialog stays fully functional
 * (validation, error state) and reports the limitation in its supporting text.
 */
function confirmCreate() {
  if (createUrl.value.trim() === '' || storeAlreadyExists.value) return
  createProcessing.value = true
  window.setTimeout(() => {
    createProcessing.value = false
    createError.value =
      'Adding an extension store is not supported in the web version: the Suwayomi-Server REST API exposes no endpoint to manage extension repositories.'
  }, 400)
}

function confirmDelete() {
  const target = deleteTarget.value
  closeDialog()
  if (!target) return
  notify(
    `Removing the extension store "${target.name}" is not supported in the web version. Suwayomi-Server's REST API exposes no endpoint to manage extension repositories.`,
  )
}

// --- deeplink confirm dialog ----------------------------------------------------------------
/**
 * The reference screen accepts a store index URL (deeplink) and opens the
 * `ExtensionStoreConfirmDialog` for it. The web client reads the URL from the `url` query
 * parameter of the route, which is the web equivalent of the Android deep link.
 */
const deeplinkUrl = ref('')
const deeplinkError = ref<string | null>(null)
const deeplinkProcessing = ref(false)

/** The store already exists check of ExtensionStoreConfirmDialog. */
const deeplinkAlreadyExists = computed(() =>
  stores.value.some(store => store.indexUrl === deeplinkUrl.value),
)

const deeplinkOpen = computed({
  get: () => dialog.value === 'confirm',
  set: (value: boolean) => { if (!value) dialog.value = null },
})

const deeplinkSupportingText = computed(() => {
  if (deeplinkAlreadyExists.value) return 'This extension store already exists'
  return deeplinkError.value
})

function openDeeplinkDialog(url: string) {
  deeplinkUrl.value = url
  deeplinkError.value = null
  deeplinkProcessing.value = false
  dialog.value = 'confirm'
}

function confirmDeeplink() {
  if (deeplinkAlreadyExists.value) return
  deeplinkProcessing.value = true
  window.setTimeout(() => {
    deeplinkProcessing.value = false
    deeplinkError.value =
      'Adding an extension store is not supported in the web version: the Suwayomi-Server REST API exposes no endpoint to manage extension repositories.'
  }, 400)
}

watch(
  () => route.query.url,
  value => {
    const url = Array.isArray(value) ? value[0] : value
    if (typeof url === 'string' && url) openDeeplinkDialog(url)
  },
  { immediate: true },
)
</script>

<template>
  <div class="extension-stores">
    <!-- LoadingScreen: the reference renders it instead of the whole screen, without an app bar. -->
    <div v-if="loading" class="stores-loading" role="status" aria-label="Loading extension stores">
      <v-progress-circular indeterminate color="primary" size="40" width="4" />
    </div>

    <template v-else>
      <!-- AppBar: navigateUp, title "Extension stores", refresh action. -->
      <v-app-bar flat height="64" color="surface" class="stores-toolbar">
        <v-btn icon="arrow_back" aria-label="Back" @click="goBack" />
        <v-app-bar-title class="text-title-large font-weight-regular">Extension stores</v-app-bar-title>
        <!-- AppBar action: a plain IconButton that refreshes the store list. -->
        <v-btn
          icon="refresh"
          variant="text"
          aria-label="Refresh"
          :class="{ 'is-refreshing': refreshing }"
          @click="loadStores(true)"
        />
      </v-app-bar>

      <!-- EmptyScreen: kaomoji face + centered message. -->
      <div v-if="isEmpty" class="stores-empty">
        <p class="empty-face">{{ face }}</p>
        <p class="empty-message">{{ error ?? "You haven't added an extension store yet" }}</p>
      </div>

      <!-- ExtensionStoresContent: LazyColumn, 16dp horizontal padding, 8dp top padding, 8dp gaps. -->
      <div v-else ref="listEl" class="stores-list">
        <div
          v-for="store in stores"
          :key="store.indexUrl"
          class="store-card"
        >
          <!-- Header row: label icon + store name (titleMedium). -->
          <div class="store-header">
            <span class="material-symbols-rounded store-icon" aria-hidden="true">label</span>
            <span class="store-name">{{ store.name }}</span>
          </div>
          <!-- Trailing actions: open in browser, Discord, copy to clipboard, delete. -->
          <div class="store-actions">
            <v-btn
              icon="public"
              variant="text"
              class="store-action-btn"
              aria-label="Open in browser"
              @click="openWebsite(store)"
            />
            <!-- Mihon shows the Discord action only when the store declares a Discord contact.
                 The reference uses the Discord brand mark, not a Material Symbol. -->
            <button
              v-if="store.discord"
              type="button"
              class="store-action-btn store-action-discord"
              aria-label="Open Discord"
              @click="openDiscord(store)"
            >
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
                <path fill="currentColor" d="M20.32 4.57A19.79 19.79 0 0 0 15.43 3c-.24.42-.5.99-.69 1.44a18.3 18.3 0 0 0-5.48 0C9.07 3.99 8.8 3.42 8.56 3a19.74 19.74 0 0 0-4.9 1.57C.6 9.28-.27 13.79.15 18.24a19.9 19.9 0 0 0 6.07 3.06c.49-.66.93-1.37 1.3-2.11-.71-.27-1.39-.6-2.03-.99.17-.13.34-.26.5-.4a14.2 14.2 0 0 0 12.02 0c.16.14.33.27.5.4-.64.39-1.32.72-2.03.99.37.74.81 1.45 1.3 2.11a19.87 19.87 0 0 0 6.07-3.06c.5-5.15-.84-9.62-3.53-13.67ZM8.02 15.55c-1.18 0-2.16-1.08-2.16-2.4 0-1.33.95-2.41 2.16-2.41 1.21 0 2.18 1.09 2.16 2.41 0 1.32-.95 2.4-2.16 2.4Zm7.96 0c-1.18 0-2.16-1.08-2.16-2.4 0-1.33.95-2.41 2.16-2.41 1.21 0 2.18 1.09 2.16 2.41 0 1.32-.95 2.4-2.16 2.4Z" />
              </svg>
            </button>
            <v-btn
              icon="content_copy"
              variant="text"
              class="store-action-btn"
              aria-label="Copy to clipboard"
              @click="copyIndexUrl(store)"
            />
            <v-btn
              icon="delete"
              variant="text"
              class="store-action-btn"
              aria-label="Delete"
              @click="openDeleteDialog(store)"
            />
          </div>
        </div>
      </div>

      <!-- CategoryFloatingActionButton: SmallExtendedFloatingActionButton "Add". -->
      <CategoryFab :stub="false" :scroll-container="listEl" @create="openCreateDialog" />

      <!-- ExtensionStoreCreateDialog -->
      <v-dialog v-model="createOpen" max-width="560">
        <v-card class="stores-dialog" color="surface-container-high">
          <h2 class="stores-dialog-title">Add extension store</h2>
          <div class="stores-dialog-body">
            <div
              class="stores-field"
              :class="{ 'is-error': createIsError, 'is-focused': createFocused, 'has-value': createUrl !== '' }"
            >
              <input
                id="extension-store-url"
                ref="createInput"
                v-model="createUrl"
                type="url"
                class="stores-field-input"
                autocomplete="off"
                spellcheck="false"
                placeholder=" "
                @focus="createFocused = true"
                @blur="createFocused = false"
                @keydown.enter="!createDisabled && confirmCreate()"
              />
              <label for="extension-store-url" class="stores-field-label">Store index URL</label>
            </div>
            <p class="stores-field-support" :class="{ 'is-error': createIsError }">{{ createSupportingText }}</p>
          </div>
          <div class="stores-dialog-actions">
            <button type="button" class="stores-dialog-button" @click="closeDialog">Cancel</button>
            <button type="button" class="stores-dialog-button" :disabled="createDisabled || createProcessing" @click="confirmCreate">
              {{ createProcessing ? 'Processing…' : 'Add' }}
            </button>
          </div>
        </v-card>
      </v-dialog>

      <!-- ExtensionStoreDeleteDialog -->
      <v-dialog v-model="deleteOpen" max-width="560">
        <v-card v-if="deleteTarget" class="stores-dialog" color="surface-container-high">
          <h2 class="stores-dialog-title">Remove extension store</h2>
          <p class="stores-dialog-text">
            Do you wish to remove the extension store &quot;{{ deleteTarget.name }}&quot; ({{ deleteTarget.indexUrl }})?
          </p>
          <div class="stores-dialog-actions">
            <button type="button" class="stores-dialog-button" @click="closeDialog">Cancel</button>
            <button type="button" class="stores-dialog-button" @click="confirmDelete">OK</button>
          </div>
        </v-card>
      </v-dialog>

      <!-- ExtensionStoreConfirmDialog: opened from a deeplink store URL. -->
      <v-dialog v-model="deeplinkOpen" max-width="560">
        <v-card class="stores-dialog" color="surface-container-high">
          <h2 class="stores-dialog-title">Add extension store</h2>
          <p class="stores-dialog-text">Do you wish to add the extension store below?</p>
          <div class="stores-field is-readonly" :class="{ 'is-error': deeplinkAlreadyExists || deeplinkError }">
            <input
              :value="deeplinkUrl"
              type="url"
              class="stores-field-input has-value"
              readonly
              tabindex="-1"
            />
          </div>
          <p v-if="deeplinkAlreadyExists || deeplinkError" class="stores-field-support is-error">
            {{ deeplinkSupportingText }}
          </p>
          <div class="stores-dialog-actions">
            <button type="button" class="stores-dialog-button" @click="closeDialog">Cancel</button>
            <button
              type="button"
              class="stores-dialog-button"
              :disabled="deeplinkAlreadyExists || deeplinkProcessing"
              @click="confirmDeeplink"
            >
              {{ deeplinkProcessing ? 'Processing…' : 'Add' }}
            </button>
          </div>
        </v-card>
      </v-dialog>

      <div v-if="snackbar" class="stores-snackbar" role="status" aria-live="polite">{{ snackbar }}</div>
    </template>
  </div>
</template>

<style scoped>
@layer app-components {
.extension-stores { display: block; }

/* LoadingScreen */
.stores-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100dvh - 64px);
}

/* EmptyScreen: face = displayMedium (45sp/52sp) at 78% alpha, message = bodyMedium at 78%. */
.stores-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100dvh - 64px);
  padding: 0 24px;
  text-align: center;
}
.empty-face {
  margin: 0;
  font-size: 45px;
  line-height: 52px;
  color: rgb(var(--v-theme-on-surface));
  opacity: .78;
}
.empty-message {
  margin: 24px 0 0;
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface));
  opacity: .78;
}

/* The refresh action spins while the store list is reloaded. */
.stores-toolbar .is-refreshing .v-icon {
  animation: stores-refresh-spin 1s linear infinite;
}
@keyframes stores-refresh-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ExtensionStoresContent: LazyColumn contentPadding = scaffold padding + top 8dp + horizontal 16dp. */
.stores-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: calc(100dvh - 64px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px 16px 16px;
}

/* ElevatedCard: MD3 shape 12dp, container surfaceContainerLow, elevation level 1. */
.store-card {
  border-radius: 12px;
  background: rgb(var(--v-theme-surface-container-low));
  color: rgb(var(--v-theme-on-surface));
  /* MD3 elevation level 1: key 0 1px 2px 0 @30%, ambient 0 1px 3px 1px @15%. */
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, .3), 0 1px 3px 1px rgba(0, 0, 0, .15);
  overflow: hidden;
}

/* Header row: 16dp start/top/end padding, centered content. */
.store-header {
  display: flex;
  align-items: center;
  padding: 16px 16px 0;
}
.store-icon {
  flex: 0 0 auto;
  font-size: 24px;
  line-height: 24px;
  /* A plain Icon in the reference takes the card content colour (onSurface). */
  color: rgb(var(--v-theme-on-surface));
}
/* titleMedium: 16sp/24sp, weight 500, 16dp start padding. */
.store-name {
  margin-left: 16px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  letter-spacing: .009375em;
  color: rgb(var(--v-theme-on-surface));
}

/* Action row: Arrangement.End, IconButton = 48dp touch target with a 24dp icon. */
.store-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.store-action-btn {
  width: 48px !important;
  height: 48px !important;
  min-width: 48px !important;
  padding: 0 !important;
  /* IconButton inherits the card content colour (onSurface). */
  color: rgb(var(--v-theme-on-surface));
}
/* The Discord action uses the brand mark instead of a Material Symbol. */
.store-action-discord {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  font-family: inherit;
  cursor: pointer;
}
.store-action-discord:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.store-action-discord:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* Material3 AlertDialog: 28dp radius, surfaceContainerHigh, 24dp padding, headlineSmall title. */
.stores-dialog {
  border-radius: 28px !important;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, .15), 0 4px 8px 3px rgba(0, 0, 0, .15) !important;
  padding: 24px;
  min-width: 280px;
  color: rgb(var(--v-theme-on-surface));
}
.stores-dialog-title {
  margin: 0 0 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}
.stores-dialog-body { margin-bottom: 24px; }
.stores-dialog-text {
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* Material3 OutlinedTextField: 56dp height, 4dp radius, 1dp outline, floating label, 12sp support. */
.stores-field { position: relative; }
.stores-field-input {
  width: 100%;
  height: 56px;
  padding: 0 16px;
  border: 1px solid rgb(var(--v-theme-outline));
  border-radius: 4px;
  background: transparent;
  font-family: inherit;
  font-size: 16px;
  line-height: 24px;
  color: rgb(var(--v-theme-on-surface));
  outline: none;
}
.stores-field-input:focus { border-color: rgb(var(--v-theme-primary)); border-width: 2px; }
.stores-field.is-error .stores-field-input { border-color: rgb(var(--v-theme-error)); }
/* The confirm dialog shows the URL in a read-only field. */
.stores-field.is-readonly .stores-field-input { color: rgb(var(--v-theme-on-surface-variant)); }
.stores-field-label {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  padding: 0 4px;
  background: rgb(var(--v-theme-surface-container-high));
  font-size: 16px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface-variant));
  pointer-events: none;
  transition: top .15s ease-in-out, font-size .15s ease-in-out, line-height .15s ease-in-out, color .15s ease-in-out;
}
.stores-field.is-focused .stores-field-label,
.stores-field.has-value .stores-field-label {
  top: 0;
  font-size: 12px;
  line-height: 16px;
}
.stores-field.is-focused .stores-field-label { color: rgb(var(--v-theme-primary)); }
.stores-field.is-error .stores-field-label { color: rgb(var(--v-theme-error)); }
.stores-field-support {
  margin: 4px 16px 0;
  font-size: 12px;
  line-height: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
}
.stores-field-support.is-error { color: rgb(var(--v-theme-error)); }

.stores-dialog-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
/* MD3 TextButton: 40dp height, 58dp min width, 12dp padding, 20dp radius, labelLarge in primary. */
.stores-dialog-button {
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
}
.stores-dialog-button::after {
  content: '';
  position: absolute;
  inset: 0;
  background-color: currentColor;
  opacity: 0;
  transition: opacity .2s ease-in-out;
  pointer-events: none;
}
@media (hover: hover) {
  .stores-dialog-button:hover::after { opacity: .08; }
}
.stores-dialog-button:active::after { opacity: .12; }
.stores-dialog-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.stores-dialog-button:disabled {
  color: rgb(var(--v-theme-on-surface));
  opacity: .38;
  cursor: default;
}

/* Snackbar: inverseSurface, 4dp radius, 14sp text. */
.stores-snackbar {
  position: fixed;
  left: 50%;
  bottom: calc(80px + 16px);
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
}
</style>
