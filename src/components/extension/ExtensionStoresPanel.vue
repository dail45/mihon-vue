<script setup lang="ts">
/**
 * ExtensionStoresPanel — reusable domain panel for managing extension stores.
 *
 * Implements the Container/Panel pattern:
 * Encapsulates the extension stores card list, add FAB, and create/delete dialogs.
 * Used inside `ExtensionStoresView.vue` and within embedded sheets/modals.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { fetchExtensionStores, type ExtensionStoreDto } from '../../api/extensionStores'
import { useSuwayomiStore } from '../../stores/suwayomi'
import CategoryFab from '../CategoryFab.vue'

const server = useSuwayomiStore()
const route = useRoute()

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

function onRefresh() {
  void loadStores(true)
}

defineExpose({
  loadStores,
  onRefresh,
  refreshing,
})

onMounted(() => { void loadStores() })
watch(() => server.apiUrl, () => { void loadStores() })

const isEmpty = computed(() => !loading.value && stores.value.length === 0)
const listEl = ref<HTMLElement | null>(null)

const errorFaces = ['(･o･;)', 'Σ(ಠ_ಠ)', 'ಥ_ಥ', '(˘･_･˘)', '(；￣Д￣)', '(･Д･。', '(╬ಠ益ಠ)', '(╥﹏╥)', '(⋟﹏⋞)', 'Ò︵Ó', ' ˙ᯅ˙)', '(¬_¬)']
const face = errorFaces[Math.floor(Math.random() * errorFaces.length)]

function openWebsite(store: ExtensionStoreDto) {
  if (!store.website) return
  window.open(store.website, '_blank', 'noopener,noreferrer')
}

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

async function copyIndexUrl(store: ExtensionStoreDto) {
  try {
    await navigator.clipboard.writeText(store.indexUrl)
    notify(store.indexUrl)
  } catch {
    notify(store.indexUrl)
  }
}

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

const storeAlreadyExists = computed(() =>
  stores.value.some(store => store.indexUrl === createUrl.value.trim()),
)

const createSupportingText = computed(() => {
  if (createError.value) return createError.value
  if (storeAlreadyExists.value) return 'This extension store already exists'
  return '*required'
})

const createIsError = computed(() => createError.value !== null || storeAlreadyExists.value)
const createDisabled = computed(
  () => createUrl.value.trim() === '' || storeAlreadyExists.value,
)

function openCreateDialog() {
  createUrl.value = ''
  createError.value = null
  dialog.value = 'create'
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

const deeplinkUrl = ref('')
const deeplinkError = ref<string | null>(null)
const deeplinkProcessing = ref(false)

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
  () => route?.query?.url,
  value => {
    const url = Array.isArray(value) ? value[0] : value
    if (typeof url === 'string' && url) openDeeplinkDialog(url)
  },
  { immediate: true },
)
</script>

<template>
  <div class="extension-stores-panel">
    <!-- LoadingScreen -->
    <div v-if="loading" class="stores-loading" role="status" aria-label="Loading extension stores">
      <v-progress-circular indeterminate color="primary" size="40" width="4" />
    </div>

    <template v-else>
      <!-- EmptyScreen -->
      <div v-if="isEmpty" class="stores-empty">
        <p class="empty-face">{{ face }}</p>
        <p class="empty-message">{{ error ?? "You haven't added an extension store yet" }}</p>
      </div>

      <!-- ExtensionStoresContent: LazyColumn -->
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

      <!-- CategoryFloatingActionButton -->
      <CategoryFab :manage-dialog="false" :scroll-container="listEl" @create="openCreateDialog" />

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
        <v-card class="stores-dialog" color="surface-container-high">
          <h2 class="stores-dialog-title">Remove extension store</h2>
          <div class="stores-dialog-body">
            <p class="stores-dialog-message">
              Are you sure you want to remove the extension store
              <strong v-if="deleteTarget">"{{ deleteTarget.name }}"</strong>?
            </p>
          </div>
          <div class="stores-dialog-actions">
            <button type="button" class="stores-dialog-button" @click="closeDialog">Cancel</button>
            <button type="button" class="stores-dialog-button stores-dialog-button--primary" @click="confirmDelete">
              OK
            </button>
          </div>
        </v-card>
      </v-dialog>

      <!-- Deeplink confirm dialog -->
      <v-dialog v-model="deeplinkOpen" max-width="560">
        <v-card class="stores-dialog" color="surface-container-high">
          <h2 class="stores-dialog-title">Add extension store</h2>
          <div class="stores-dialog-body">
            <p class="stores-dialog-message">
              Do you want to add the extension store at
              <code class="stores-dialog-url">{{ deeplinkUrl }}</code>?
            </p>
            <p v-if="deeplinkSupportingText" class="stores-field-support" :class="{ 'is-error': deeplinkAlreadyExists || deeplinkError }">
              {{ deeplinkSupportingText }}
            </p>
          </div>
          <div class="stores-dialog-actions">
            <button type="button" class="stores-dialog-button" @click="closeDialog">Cancel</button>
            <button
              type="button"
              class="stores-dialog-button stores-dialog-button--primary"
              :disabled="deeplinkAlreadyExists || deeplinkProcessing"
              @click="confirmDeeplink"
            >
              {{ deeplinkProcessing ? 'Processing…' : 'Add' }}
            </button>
          </div>
        </v-card>
      </v-dialog>
    </template>

    <div v-if="snackbar" class="stores-snackbar" role="status" aria-live="polite">
      {{ snackbar }}
    </div>
  </div>
</template>

<style scoped>
@layer app-components {
.extension-stores-panel {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
}

.stores-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  min-height: 240px;
}

.stores-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  gap: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
  flex: 1 1 auto;
}

.empty-face {
  font-size: 36px;
  line-height: 44px;
  margin: 0;
  opacity: 0.78;
}

.empty-message {
  font-size: 14px;
  line-height: 20px;
  margin: 0;
  max-width: 320px;
  opacity: 0.78;
}

.stores-list {
  display: flex;
  flex-direction: column;
  padding: 8px 16px 16px;
  gap: 8px;
}

.store-card {
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface-container-low));
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08);
}

.store-header {
  display: flex;
  align-items: center;
  padding: 16px 16px 0;
  gap: 16px;
}

.store-icon {
  font-size: 24px;
  line-height: 24px;
  color: rgb(var(--v-theme-on-surface-variant));
}

.store-name {
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  flex: 1;
  word-break: break-word;
}

.store-actions {
  display: flex;
  justify-content: flex-end;
  padding: 8px;
  gap: 4px;
}

.store-action-btn {
  width: 48px !important;
  height: 48px !important;
  min-width: 48px !important;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: rgb(var(--v-theme-on-surface-variant));
}

.store-action-discord {
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.store-action-discord:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}

.stores-dialog {
  padding: 24px;
  border-radius: 28px !important;
}

.stores-dialog-title {
  margin: 0 0 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}

.stores-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}

.stores-dialog-message {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface-variant));
}

.stores-dialog-url {
  word-break: break-all;
  padding: 2px 4px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.08);
}

.stores-field {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 56px;
  border: 1px solid rgb(var(--v-theme-outline));
  border-radius: 4px;
  padding: 0 16px;
  background: rgb(var(--v-theme-surface));
  transition: border-color 0.15s ease;
}

.stores-field.is-focused {
  border-color: rgb(var(--v-theme-primary));
  border-width: 2px;
  padding: 0 15px;
}

.stores-field.is-error {
  border-color: rgb(var(--v-theme-error)) !important;
}

.stores-field-input {
  width: 100%;
  border: none;
  background: transparent;
  outline: none;
  font-size: 16px;
  line-height: 24px;
  color: rgb(var(--v-theme-on-surface));
  padding-top: 16px;
  padding-bottom: 4px;
}

.stores-field-label {
  position: absolute;
  left: 16px;
  top: 16px;
  font-size: 16px;
  line-height: 24px;
  color: rgb(var(--v-theme-on-surface-variant));
  pointer-events: none;
  transform-origin: left top;
  transition: transform 0.15s ease, color 0.15s ease;
}

.stores-field.is-focused .stores-field-label,
.stores-field.has-value .stores-field-label {
  transform: translateY(-8px) scale(0.75);
  color: rgb(var(--v-theme-primary));
}

.stores-field.is-error .stores-field-label {
  color: rgb(var(--v-theme-error)) !important;
}

.stores-field-support {
  margin: 4px 16px 0;
  font-size: 12px;
  line-height: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
}

.stores-field-support.is-error {
  color: rgb(var(--v-theme-error));
}

.stores-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.stores-dialog-button {
  min-width: 48px;
  height: 40px;
  padding: 0 16px;
  border: none;
  border-radius: 20px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease;
}

.stores-dialog-button:hover:not(:disabled) {
  background: rgba(var(--v-theme-primary), 0.08);
}

.stores-dialog-button:disabled {
  opacity: 0.38;
  cursor: default;
}

.stores-dialog-button--primary {
  color: rgb(var(--v-theme-primary));
}

.stores-snackbar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  padding: 14px 24px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 20px;
  max-width: min(560px, calc(100% - 32px));
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.24);
  z-index: 1000;
}
}
</style>
