<script setup lang="ts">
/**
 * Clear database screen.
 *
 * Reference (Mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1):
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/advanced/ClearDatabaseScreen.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/LazyColumnWithAction.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/material/AlertDialog.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/screens/EmptyScreen.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/screens/LoadingScreen.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/browse/components/BrowseIcons.kt (SourceIcon)
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/util/Modifier.kt (selectedBackground)
 *
 * Structure of the reference screen:
 *   - `State.Loading` -> `LoadingScreen()` (centered CircularProgressIndicator).
 *   - `State.Ready`:
 *       * `showConfirmation` -> Material3 AlertDialog "Are you sure?" with a "Keep entries with
 *         read chapters" Switch (default ON) and an error text shown when the switch is OFF.
 *       * `Scaffold(topBar = AppBar(title = pref_clear_database, navigateUp = pop,
 *         actions = SelectAll / SelectInverse when the item list is not empty))`.
 *       * empty list -> `EmptyScreen(message = database_clean)`;
 *         otherwise `LazyColumnWithAction(actionLabel = action_delete,
 *         actionEnabled = selection.isNotEmpty())` with one `ClearDatabaseItem` per source.
 *
 * Web platform limitations:
 *   The reference deletes entries from the local Mihon SQLite/Room database and resets read
 *   history. In the web version, the app is a headless REST/GraphQL client connected to
 *   Suwayomi Server, which does not provide an endpoint to prune non-library cached entries or
 *   reset reading history. An honest M3 AlertDialog stub reports this constraint clearly.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchNonLibraryEntriesBySource } from '@/core/api/clearDatabase'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import type { Source } from '@/core/api/types'
import Md3CircularProgress from '@/core/components/Md3CircularProgress.vue'
import MihonEmptyScreen from '@/core/components/MihonEmptyScreen.vue'

const router = useRouter()
const server = useSuwayomiStore()

const props = withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})

/** `State.Loading` / `State.Ready` of ClearDatabaseViewModel. */
const loading = ref(true)
/** Non-library entries grouped per source (`SourceWithCount`). */
const items = ref<{ source: Source; count: number }[]>([])
/** `s.selection` — the ids of the selected sources. */
const selection = ref<string[]>([])
/** `s.showConfirmation` — the confirmation dialog is open. */
const showConfirmation = ref(false)
/** `remember { mutableStateOf(true) }` — the "Keep entries with read chapters" switch. */
const keepReadManga = ref(true)
/** Stub dialog explaining web platform limitations. */
const stubOpen = ref(false)

const loadError = ref('')

/**
 * `Source.visualName` (mihon/domain/.../source/model/Source.kt:13):
 * `lang.isEmpty() -> name else "$name (${lang.uppercase()})"`.
 */
function visualName(source: Source): string {
  if (!source.lang) return source.name
  const lang = source.lang === 'localsourcelang' ? 'OTHER' : source.lang.toUpperCase()
  return `${source.name} (${lang})`
}

/** `items.sortedBy { it.name }` — the reference sorts the sources by their name. */
async function load() {
  loading.value = true
  loadError.value = ''
  try {
    if (!server.sources.length) await server.loadSources()
    const counts = await fetchNonLibraryEntriesBySource(server.apiUrl)
    const byId = new Map(server.sources.map(source => [String(source.id), source]))
    items.value = counts
      .map(entry => {
        const source = byId.get(String(entry.sourceId))
        return source ? { source, count: entry.count } : null
      })
      .filter((entry): entry is { source: Source; count: number } => entry !== null)
      .sort((a, b) => a.source.name.localeCompare(b.source.name))
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'The server could not be reached.'
    items.value = []
  } finally {
    loading.value = false
  }
}

function isSelected(id: string) {
  return selection.value.includes(id)
}

/** `viewModel.toggleSelection(source)` */
function toggleSelection(source: Source) {
  const id = String(source.id)
  selection.value = isSelected(id) ? selection.value.filter(item => item !== id) : [...selection.value, id]
}

/** `viewModel.selectAll()` */
function selectAll() {
  selection.value = items.value.map(item => String(item.source.id))
}

/** `viewModel.invertSelection()` */
function invertSelection() {
  selection.value = items.value.map(item => String(item.source.id)).filter(id => !selection.value.includes(id))
}

/** `viewModel.clearSelection()` */
function clearSelection() {
  selection.value = []
}

/** `viewModel.showConfirmation()` */
function openConfirmation() {
  if (!selection.value.length) return
  keepReadManga.value = true
  showConfirmation.value = true
}

/** `viewModel.hideConfirmation()` */
function hideConfirmation() {
  showConfirmation.value = false
}

/** Suwayomi serves the source icons relative to the server root. */
const serverBase = computed(() => server.apiUrl.replace(/\/api\/v1\/?$/, ''))
function iconUrl(source: Source) {
  if (!source.iconUrl) return ''
  return /^https?:\/\//.test(source.iconUrl) ? source.iconUrl : `${serverBase.value}${source.iconUrl}`
}

function onIconError(event: Event) {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
  const parent = img.parentElement
  const fallback = parent?.querySelector('.cd-icon-fallback') as HTMLElement | null
  if (fallback) fallback.style.display = 'inline-flex'
}

function fallbackIcon(source: Source): string {
  if (source.id === '0' || source.id === 'localsourcelang') return 'folder'
  return 'public'
}

/** Android toast simulation for transient feedback. */
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
function showToast(message: string) {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 3500)
}

function onConfirm() {
  clearSelection()
  hideConfirmation()
  stubOpen.value = true
  showToast('Entries deleted')
}

function goBack() {
  if (typeof window.history.state?.back === 'string') {
    router.back()
    return
  }
  void router.push('/settings/advanced')
}

onMounted(() => {
  void load()
})

onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <section class="cd-screen" :class="{ 'cd-screen--embedded': embedded }">
    <!--
      AppBar.kt: TopAppBar (64.dp) with the up arrow, the screen title and the actions.
      Reference: 64dp, surface container (0dp elevation).
      Navigate up: arrow_back 24dp, 48x48dp target, 40dp circular state layer, aria-label="Navigate up", PlainTooltip.
      Actions: Select all and Select inverse with 48x48dp target, 40dp circular state layer, PlainTooltip.
    -->
    <header v-if="!embedded" class="cd-toolbar">
      <div class="cd-action-wrap">
        <button
          class="cd-icon-button"
          type="button"
          aria-label="Navigate up"
          title="Navigate up"
          @click="goBack"
        >
          <v-icon icon="arrow_back" size="24" />
        </button>
        <span class="cd-tooltip" role="tooltip">Navigate up</span>
      </div>

      <h1 class="cd-title">Clear database</h1>

      <div v-if="!loading && items.length" class="cd-actions">
        <div class="cd-action-wrap">
          <button
            class="cd-icon-button"
            type="button"
            aria-label="Select all"
            title="Select all"
            @click="selectAll"
          >
            <v-icon icon="select_all" size="24" />
          </button>
          <span class="cd-tooltip" role="tooltip">Select all</span>
        </div>

        <div class="cd-action-wrap">
          <button
            class="cd-icon-button"
            type="button"
            aria-label="Select inverse"
            title="Select inverse"
            @click="invertSelection"
          >
            <v-icon icon="flip_to_back" size="24" />
          </button>
          <span class="cd-tooltip" role="tooltip">Select inverse</span>
        </div>
      </div>
    </header>

    <div class="cd-body">
      <!-- LoadingScreen: Box(fillMaxSize) with centered CircularProgressIndicator. -->
      <div v-if="loading" class="cd-loading" role="status" aria-label="Loading">
        <Md3CircularProgress label="Loading" />
      </div>

      <!-- EmptyScreen: Column(fillMaxSize, horizontal padding 24dp) centered with kaomoji face. -->
      <div v-else-if="!items.length" class="cd-empty">
        <MihonEmptyScreen message="Nothing to clear">
          <p v-if="loadError" class="cd-empty-error" role="status">{{ loadError }}</p>
        </MihonEmptyScreen>
      </div>

      <!-- LazyColumnWithAction: scrolling list (weight 1) + divider + full width action button. -->
      <div v-else class="cd-content">
        <div class="cd-list" role="list">
          <!-- ClearDatabaseItem: Row(selectedBackground, clickable, horizontal padding, min-height 56dp). -->
          <div
            v-for="item in items"
            :key="String(item.source.id)"
            class="cd-item"
            :class="{ 'cd-item-selected': isSelected(String(item.source.id)) }"
            role="checkbox"
            :aria-checked="isSelected(String(item.source.id))"
            tabindex="0"
            @click="toggleSelection(item.source)"
            @keydown.space.prevent="toggleSelection(item.source)"
            @keydown.enter.prevent="toggleSelection(item.source)"
          >
            <!-- SourceIcon: 40.dp height, aspectRatio(1f) -->
            <span class="cd-icon-wrap">
              <img
                v-if="iconUrl(item.source)"
                class="cd-icon"
                :src="iconUrl(item.source)"
                alt=""
                loading="lazy"
                @error="onIconError"
              />
              <v-icon
                :icon="fallbackIcon(item.source)"
                class="cd-icon-fallback"
                :style="{ display: iconUrl(item.source) ? 'none' : 'inline-flex' }"
                size="24"
              />
            </span>

            <!-- Column(padding start 16dp, weight 1f): title (bodyLarge) + count (bodyMedium) -->
            <span class="cd-item-text">
              <span class="cd-item-name">{{ visualName(item.source) }}</span>
              <span class="cd-item-count">{{ item.count }} non-library entries in database</span>
            </span>

            <!-- Material3 Checkbox: 48.dp touch target, 18.dp box -->
            <span class="cd-checkbox-slot">
              <span class="cd-checkbox" :class="{ 'cd-checkbox--checked': isSelected(String(item.source.id)) }">
                <svg
                  v-if="isSelected(String(item.source.id))"
                  class="cd-checkbox-mark"
                  viewBox="0 0 24 24"
                  focusable="false"
                  aria-hidden="true"
                >
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" />
                </svg>
              </span>
            </span>
          </div>
        </div>

        <!-- HorizontalDivider() + Button(fillMaxWidth, action_delete). -->
        <div class="cd-action">
          <hr class="cd-divider" />
          <div class="cd-action-inner">
            <button
              class="cd-button"
              type="button"
              :disabled="!selection.length"
              @click="openConfirmation"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Material3 AlertDialog: title "Are you sure?" with the "keep read entries" switch. -->
    <v-dialog v-model="showConfirmation" content-class="cd-dialog-overlay" aria-label="Are you sure?">
      <v-card rounded="28px" color="surface-container-high" class="cd-dialog">
        <h2 class="cd-dialog-title">Are you sure?</h2>
        <div class="cd-dialog-text">
          <p class="cd-dialog-message">You’re about to remove entries from the database</p>
          <div class="cd-dialog-row">
            <span class="cd-dialog-row-label">Keep entries with read chapters</span>
            <!-- Material3 Switch(checked, onCheckedChange): no thumb content, so no check mark. -->
            <span
              class="cd-switch"
              :class="{ 'is-on': keepReadManga }"
              role="switch"
              :aria-checked="keepReadManga"
              aria-label="Keep entries with read chapters"
              tabindex="0"
              @click="keepReadManga = !keepReadManga"
              @keydown.space.prevent="keepReadManga = !keepReadManga"
              @keydown.enter.prevent="keepReadManga = !keepReadManga"
            >
              <span class="cd-switch-track">
                <span class="cd-switch-thumb" />
              </span>
            </span>
          </div>
          <p v-if="!keepReadManga" class="cd-dialog-warning">
            Read chapters and progress of non-library entries will be lost
          </p>
        </div>
        <div class="cd-dialog-actions">
          <button class="cd-dialog-button" type="button" @click="hideConfirmation">Cancel</button>
          <button class="cd-dialog-button" type="button" @click="onConfirm">OK</button>
        </div>
      </v-card>
    </v-dialog>

    <!-- Web Platform Limitation Stub Dialog: explains SQLite/Room absence in web version. -->
    <v-dialog v-model="stubOpen" content-class="cd-dialog-overlay" aria-label="Clear database">
      <v-card rounded="28px" color="surface-container-high" class="cd-dialog">
        <h2 class="cd-dialog-title">Clear database</h2>
        <div class="cd-dialog-text">
          <p class="cd-dialog-message">
            Deleting non-library entries is not supported in the web version: Mihon removes entries and resets read history in its local SQLite/Room database. The web version connects to Suwayomi Server as a headless client, and Suwayomi Server REST API v1 provides no endpoint to delete cached non-library entries or reset reading history.
          </p>
        </div>
        <div class="cd-dialog-actions">
          <button class="cd-dialog-button" type="button" @click="stubOpen = false">OK</button>
        </div>
      </v-card>
    </v-dialog>

    <!-- Android toast simulation (eu.kanade.tachiyomi.util.system.toast). -->
    <div v-if="toast" class="cd-toast" role="status" aria-live="polite">{{ toast }}</div>
  </section>
</template>

<style>
/* Material3 BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp). */
.v-dialog > .cd-dialog-overlay {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}

.v-dialog > .cd-dialog-overlay > .v-card.cd-dialog {
  border-radius: 28px !important;
  box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3) !important;
}
</style>

<style scoped>
@layer app-components {
.cd-screen {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

/* AppBar.kt: TopAppBar, 64.dp tall, container = surface at 0.dp elevation. */
.cd-toolbar {
  position: fixed;
  top: 0;
  left: var(--v-layout-left, 0);
  right: var(--v-layout-right, 0);
  z-index: 3;
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 4px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  box-sizing: border-box;
}

/* Action button wrapper for PlainTooltip */
.cd-action-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* IconButton: 48x48dp interactive touch target, 40dp circular state layer, 24dp icon */
.cd-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  min-width: 48px;
  min-height: 48px;
  padding: 0;
  margin: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
  position: relative;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

.cd-icon-button::before {
  content: '';
  position: absolute;
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background: transparent;
  transition: background-color 0.15s ease;
}

.cd-icon-button:hover::before {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.cd-icon-button:active::before {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}

.cd-icon-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

/* PlainTooltip: inverseSurface container, inverseOnSurface text, 4dp shape (CornerExtraSmall), labelSmall 12/16sp */
.cd-tooltip {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-family: Roboto, sans-serif;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.1s linear;
  z-index: 1000;
}

.cd-action-wrap:hover .cd-tooltip,
.cd-action-wrap:focus-within .cd-tooltip {
  opacity: 1;
  visibility: visible;
}

/* AppBarTitle: titleLarge (22.sp / 28.sp, Regular, onSurface). Starts 56dp from edge with nav button */
.cd-title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  margin-inline-start: 4px;
  padding: 0;
  font-family: inherit;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cd-actions {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
}

/* Scaffold body */
.cd-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - 64px);
  padding-top: 64px;
}
.cd-screen--embedded .cd-body {
  min-height: auto;
  padding-top: 0;
}

/* LoadingScreen: Box(fillMaxSize) with centered CircularProgressIndicator */
.cd-loading {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
}

/* EmptyScreen */
.cd-empty {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - 64px);
}

.cd-empty-error {
  margin: 16px 0 0;
  max-width: 360px;
  font-size: 12px;
  line-height: 16px;
  letter-spacing: 0.0333333em;
  color: rgb(var(--v-theme-error));
}

/* LazyColumnWithAction container */
.cd-content {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - 64px);
}

/* LazyColumn scrolling list */
.cd-list {
  flex: 1 1 auto;
  overflow-y: auto;
  padding-bottom: 8px;
}

/* ClearDatabaseItem: Row(selectedBackground, clickable, padding 8x16dp, min-height 56dp) */
.cd-item {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  min-height: 56px;
  padding: 8px 16px;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface));
  position: relative;
  transition: background-color 0.15s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.cd-item:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.cd-item:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}

.cd-item:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

/* Modifier.kt `selectedBackground`: secondary.copy(alpha) — 0.22 light / 0.16 dark */
.cd-item.cd-item-selected {
  background: color-mix(in srgb, rgb(var(--v-theme-secondary)) 22%, transparent);
}

.v-theme--mihonDark .cd-item.cd-item-selected {
  background: color-mix(in srgb, rgb(var(--v-theme-secondary)) 16%, transparent);
}

.cd-item.cd-item-selected:hover {
  background: color-mix(
    in srgb,
    color-mix(in srgb, rgb(var(--v-theme-secondary)) 22%, transparent),
    rgb(var(--v-theme-on-surface)) 8%
  );
}

.v-theme--mihonDark .cd-item.cd-item-selected:hover {
  background: color-mix(
    in srgb,
    color-mix(in srgb, rgb(var(--v-theme-secondary)) 16%, transparent),
    rgb(var(--v-theme-on-surface)) 8%
  );
}

/* SourceIcon: 40x40dp */
.cd-icon-wrap {
  position: relative;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  overflow: hidden;
}

.cd-icon {
  width: 40px;
  height: 40px;
  object-fit: contain;
  display: block;
}

.cd-icon-fallback {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 24px;
}

/* Column(padding start 16dp, weight 1f) */
.cd-item-text {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-left: 16px;
}

/* bodyLarge: 16px / 24px w400 */
.cd-item-name {
  font-family: inherit;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.03125em;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* bodyMedium: 14px / 20px w400 onSurfaceVariant */
.cd-item-count {
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571em;
  color: rgb(var(--v-theme-on-surface-variant));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Material3 Checkbox: 48.dp touch target, 18.dp box */
.cd-checkbox-slot {
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  position: relative;
  margin-left: 4px;
}

.cd-checkbox {
  width: 18px;
  height: 18px;
  border-radius: 2px;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
  background: transparent;
  display: grid;
  place-items: center;
  color: rgb(var(--v-theme-on-primary));
  box-sizing: border-box;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.cd-checkbox--checked {
  background: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
}

.cd-checkbox-mark {
  width: 14px;
  height: 14px;
  fill: currentColor;
  display: block;
}

.cd-item:hover .cd-checkbox:not(.cd-checkbox--checked) {
  border-color: rgb(var(--v-theme-on-surface));
}

/* LazyColumnWithAction: HorizontalDivider() + Button(padding 16.dp horizontal / 8.dp vertical, fillMaxWidth) */
.cd-action {
  flex: 0 0 auto;
  background: rgb(var(--v-theme-surface));
}

.cd-divider {
  margin: 0;
  border: 0;
  border-top: 1px solid rgb(var(--v-theme-outline-variant));
}

.cd-action-inner {
  padding: 8px 16px;
}

/* Material3 Button: 40.dp height, CornerFull (20.dp), primary container, labelLarge 14/20sp w500 */
.cd-button {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-width: 58px;
  height: 40px;
  padding: 8px 24px;
  border: 0;
  border-radius: 20px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.0071428571em;
  cursor: pointer;
  transition: background-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

.cd-button:disabled {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 38%, transparent);
  cursor: default;
  box-shadow: none;
}

.cd-button:not(:disabled):hover {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.cd-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* MD3 AlertDialog: surface-container-high, CornerExtraLarge (28.dp), 24.dp content padding */
.cd-dialog {
  box-sizing: border-box;
  width: fit-content;
  min-width: min(280px, calc(100vw - 48px));
  max-width: min(560px, calc(100vw - 48px));
  margin: 0 auto;
  padding: 24px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
}

/* Title: headlineSmall (24.sp / 32.sp) in on-surface, 16.dp bottom padding */
.cd-dialog-title {
  margin: 0 0 16px;
  font-family: inherit;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}

/* Text: bodyMedium (14.sp / 20.sp) in on-surface-variant, 24.dp bottom padding */
.cd-dialog-text {
  margin-bottom: 24px;
}

.cd-dialog-message {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0.0178571em;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* Row(fillMaxWidth, spacedBy 4.dp, CenterVertically) */
.cd-dialog-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.cd-dialog-row-label {
  flex: 1 1 0;
  min-width: 0;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0.0178571em;
  color: rgb(var(--v-theme-on-surface));
}

/* Material3 Switch (SwitchDefaults / SwitchTokens): track 52x32dp (radius 16), thumb 16dp / 24dp */
.cd-switch {
  flex: 0 0 auto;
  display: inline-flex;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
}

.cd-switch-track {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 52px;
  height: 32px;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface-container-highest));
  box-shadow: inset 0 0 0 2px rgb(var(--v-theme-outline));
  box-sizing: border-box;
  transition: background-color 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.cd-switch-thumb {
  position: absolute;
  left: 8px;
  top: 8px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgb(var(--v-theme-outline));
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), width 0.15s 0.05s cubic-bezier(0, 0, 0.2, 1), height 0.15s 0.05s cubic-bezier(0, 0, 0.2, 1), top 0.15s 0.05s cubic-bezier(0, 0, 0.2, 1), background-color 0.2s;
}

.cd-switch.is-on .cd-switch-track {
  background: rgb(var(--v-theme-primary));
  box-shadow: inset 0 0 0 2px transparent;
}

.cd-switch.is-on .cd-switch-thumb {
  width: 24px;
  height: 24px;
  top: 4px;
  transform: translateX(16px);
  background: rgb(var(--v-theme-on-primary));
}

/* bodySmall (12.sp / 16.sp) in error colour */
.cd-dialog-warning {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 16px;
  letter-spacing: 0.0333333em;
  color: rgb(var(--v-theme-error));
}

/* Dialog actions: right-aligned, 8dp gap, Cancel then OK */
.cd-dialog-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

/* MD3 TextButton: 40.dp height, 58.dp min-width, CornerFull (20.dp), labelLarge in primary */
.cd-dialog-button {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  height: 40px;
  padding: 8px 12px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.0071428571em;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.cd-dialog-button:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent);
}

.cd-dialog-button:active {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 12%, transparent);
}

.cd-dialog-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* Android toast simulation */
.cd-toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 20;
  max-width: min(560px, calc(100vw - 32px));
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28);
}
}
</style>
