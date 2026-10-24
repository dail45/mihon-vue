<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { trackerIconUrl, type TrackerSearchResult } from '../api/trackers'
import { useSuwayomiStore } from '../stores/suwayomi'
import { useTrackerSearch } from '../composables/useTrackerSearch'
import TrackerSearchResultCard from '../components/tracker/TrackerSearchResultCard.vue'

/**
 * Pixel-parity port of Mihon's tracker search screen.
 *
 * Reference (Mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1):
 * - `presentation/track/TrackerSearch.kt`
 * - `presentation/core/screens/EmptyScreen.kt`
 */
const server = useSuwayomiStore()
const route = useRoute()
const router = useRouter()

/** Mihon: `TrackerSearchScreen(mangaId, initialQuery, currentUrl, serviceId)`. */
const mangaId = computed(() => {
  const raw = route.params.mangaId ?? route.query.mangaId
  const value = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(value) && value > 0 ? value : null
})
const trackerId = computed(() => {
  const raw = route.params.trackerId ?? route.query.trackerId
  const value = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(value) && value > 0 ? value : null
})

const {
  query,
  queryResult,
  selected,
  tracker,
  supportsPrivateTracking,
  errorMessage,
  loggingIn,
  loginError,
  loadTrackers,
  runSearch,
  bindSelected,
  loginCredentials,
} = useTrackerSearch({
  apiUrl: () => server.apiUrl,
  mangaId: () => mangaId.value,
  trackerId: () => trackerId.value,
  initialQuery: String(route.query.q ?? ''),
  currentUrl: String(route.query.currentUrl ?? ''),
})

const snackbarMessage = ref('')
let snackbarTimer: ReturnType<typeof setTimeout> | undefined

function showSnackbar(msg: string) {
  snackbarMessage.value = msg
  if (snackbarTimer) clearTimeout(snackbarTimer)
  snackbarTimer = setTimeout(() => {
    snackbarMessage.value = ''
  }, 3000)
}

const searchInput = ref<HTMLInputElement | null>(null)
/** Mihon: `dropDownMenuExpanded` of the result card – the long press opens the menu. */
const menuFor = ref<number | null>(null)

function openMenu(id: number) {
  menuFor.value = menuFor.value === id ? null : id
}

/** Mihon: `EmptyScreen` picks a random face from the list of the error faces. */
const errorFaces = [
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
const errorFace = ref(errorFaces[Math.floor(Math.random() * errorFaces.length)] ?? errorFaces[0]!)

/** Mihon: the text of the search field. */
function onInput(event: Event) {
  query.value = (event.target as HTMLInputElement).value
}

/** Mihon: `dispatchQueryAndClearFocus` – the query is dispatched and the focus is cleared. */
function onSearch() {
  void runSearch(query.value)
  ;(document.activeElement as HTMLElement | null)?.blur()
}

function clearQuery() {
  query.value = ''
  searchInput.value?.focus()
}

function onSelect(item: TrackerSearchResult) {
  selected.value = item
  menuFor.value = null
  ;(document.activeElement as HTMLElement | null)?.blur()
}

/** Mihon: `onConfirmSelection(private)`. */
async function onConfirmSelection(isPrivate: boolean) {
  if (!selected.value || trackerId.value === null) return
  if (mangaId.value === null) {
    errorMessage.value = 'The tracker search needs a manga to bind the result to. Open it from the manga screen.'
    return
  }
  const ok = await bindSelected(isPrivate)
  if (ok) {
    goUp()
  }
}

function goUp() {
  if (typeof window.history.state?.back === 'string') { router.back(); return }
  if (mangaId.value !== null) { void router.push(`/manga/${mangaId.value}`); return }
  void router.push('/library')
}

function copyTitle(item: TrackerSearchResult) {
  menuFor.value = null
  if (navigator.clipboard) {
    void navigator.clipboard.writeText(item.title)
    showSnackbar('Copied to clipboard')
  }
}

function openInBrowser(item: TrackerSearchResult) {
  menuFor.value = null
  if (item.trackingUrl) window.open(item.trackingUrl, '_blank', 'noopener')
}

// --- login -------------------------------------------------------------------------------

const loginOpen = ref(false)
const username = ref('')
const password = ref('')
const oauthPending = ref(false)

async function submitLogin() {
  if (!username.value || !password.value) return
  const ok = await loginCredentials(username.value, password.value)
  if (ok) {
    loginOpen.value = false
  }
}

async function refreshLogin() {
  oauthPending.value = false
  await loadTrackers()
  await runSearch(query.value)
}

function openOAuth() {
  const current = tracker.value
  if (!current?.authUrl) return
  window.open(current.authUrl, '_blank', 'noopener')
  oauthPending.value = true
}

watch(queryResult, () => {
  errorFace.value = errorFaces[Math.floor(Math.random() * errorFaces.length)] ?? errorFaces[0]!
})

watch(menuFor, (value) => {
  if (value === null) { document.removeEventListener('pointerdown', onDocumentPointerDown); return }
  document.addEventListener('pointerdown', onDocumentPointerDown)
})

function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target as HTMLElement | null
  if (target?.closest('.ts__menu') || target?.closest('.ts__more-btn')) return
  menuFor.value = null
}

watch(query, value => {
  if (value.trim() === '' && queryResult.value?.ok === false) queryResult.value = null
})

onMounted(async () => {
  await loadTrackers()
  if (trackerId.value === null) return
  if (query.value.trim()) await runSearch(query.value)
})
</script>

<template>
  <div class="ts">
    <!-- TopAppBar -->
    <header class="ts__bar">
      <div class="ts__bar-row">
        <button type="button" class="ts__icon-button" aria-label="Back" @click="goUp">
          <span class="material-symbols-rounded ts__icon" aria-hidden="true">arrow_back</span>
        </button>

        <div class="ts__field">
          <input
            ref="searchInput"
            :value="query"
            type="text"
            class="ts__input"
            enterkeyhint="search"
            autocomplete="off"
            aria-label="Search"
            placeholder="Search…"
            @input="onInput($event)"
            @keydown.enter.prevent="onSearch"
          />
        </div>

        <button
          v-if="query"
          type="button"
          class="ts__icon-button"
          aria-label="Clear search"
          @click="clearQuery"
        >
          <span class="material-symbols-rounded ts__icon" aria-hidden="true">close</span>
        </button>
      </div>
      <div class="ts__divider" />
    </header>

    <!-- Content -->
    <main class="ts__content">
      <div v-if="queryResult === null" class="ts__loading" role="progressbar" aria-label="Loading">
        <svg class="ts__spinner" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
          <g class="ts__spinner-global">
            <g class="ts__spinner-steps">
              <circle class="ts__spinner-arc" cx="20" cy="20" r="18" pathLength="100" />
            </g>
          </g>
        </svg>
      </div>

      <div v-else-if="queryResult.ok && queryResult.items.length === 0" class="ts__empty">
        <span class="ts__face" aria-hidden="true">{{ errorFace }}</span>
        <p class="ts__empty-text">No results found</p>
      </div>

      <div v-else-if="!queryResult.ok" class="ts__empty">
        <span class="ts__face" aria-hidden="true">{{ errorFace }}</span>
        <p class="ts__empty-text">{{ queryResult.message || 'Unknown error' }}</p>
      </div>

      <ul v-else class="ts__list" role="list">
        <li v-for="item in queryResult.items" :key="item.id" class="ts__list-item">
          <TrackerSearchResultCard
            :item="item"
            :selected="selected?.id === item.id"
            :is-menu-open="menuFor === item.id"
            @select="onSelect"
            @toggle-menu="openMenu"
            @copy-title="copyTitle"
            @open-browser="openInBrowser"
          />
        </li>
      </ul>
    </main>

    <!-- The tracker has to be logged in before it can be searched. -->
    <div v-if="tracker && !tracker.isLoggedIn && !loginOpen" class="ts__login-bar">
      <span class="ts__login-text">
        Log in to {{ tracker.name }} to search it.
      </span>
      <button type="button" class="ts__button ts__button--filled ts__button--small" @click="loginOpen = true">
        Log in
      </button>
    </div>

    <Transition name="ts-bottom">
      <footer v-if="selected" class="ts__bottom">
        <button type="button" class="ts__button ts__button--filled" @click="onConfirmSelection(false)">
          Track
        </button>
        <button
          v-if="supportsPrivateTracking"
          type="button"
          class="ts__button ts__button--filled ts__button--icon"
          aria-label="Track privately"
          @click="onConfirmSelection(true)"
        >
          <span class="material-symbols-rounded ts__icon" aria-hidden="true">visibility_off</span>
        </button>
      </footer>
    </Transition>

    <!-- Mihon reports feedback and failed registration with a toast. -->
    <div v-if="snackbarMessage || errorMessage" class="ts__snackbar" role="alert">{{ snackbarMessage || errorMessage }}</div>

    <v-dialog v-model="loginOpen" max-width="480">
      <div class="ts-dialog" role="dialog" aria-modal="true" aria-labelledby="ts-login-title">
        <h2 id="ts-login-title" class="ts-dialog-title">Log in to {{ tracker?.name ?? 'tracker' }}</h2>

        <div class="ts-dialog-body">
          <img
            v-if="tracker"
            class="ts-dialog-icon"
            :src="trackerIconUrl(server.apiUrl, tracker)"
            :alt="tracker.name"
          />
          <p class="ts-dialog-text">
            Suwayomi needs a logged-in tracker to run a tracker search. Enter the credentials of
            your {{ tracker?.name ?? 'tracker' }} account.
          </p>
          <label class="ts-dialog-label" :class="{ 'has-value': username !== '' }">
            <input v-model="username" type="text" class="ts-dialog-input" autocomplete="username" />
            <span class="ts-dialog-label-text">Username</span>
          </label>
          <label class="ts-dialog-label" :class="{ 'has-value': password !== '' }">
            <input v-model="password" type="password" class="ts-dialog-input" autocomplete="current-password" />
            <span class="ts-dialog-label-text">Password</span>
          </label>
          <p v-if="loginError" class="ts-dialog-error" role="alert">{{ loginError }}</p>
          <p v-if="oauthPending" class="ts-dialog-note" role="status">
            The tracker page was opened in a new tab. Finish the login there, then refresh the
            login state – the OAuth redirect back into the app does not exist in the web version.
            <button type="button" class="ts-text-button" @click="refreshLogin">Refresh login state</button>
          </p>
        </div>

        <div class="ts-dialog-actions">
          <button
            v-if="tracker?.authUrl"
            type="button"
            class="ts-text-button"
            @click="openOAuth"
          >
            OAuth login
          </button>
          <button type="button" class="ts-text-button" @click="loginOpen = false">Cancel</button>
          <button
            type="button"
            class="ts-text-button ts-text-button--primary"
            :disabled="!username || !password || loggingIn"
            @click="submitLogin"
          >
            Log in
          </button>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<style scoped>
.ts {
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - 64px);
  background: rgb(var(--v-theme-background));
}

/* TopAppBar: 64dp high, surface color, on-surface content. */
.ts__bar {
  position: sticky;
  top: 0;
  z-index: 3;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

.ts__bar-row {
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 4px;
}

/* IconButton: 48dp minimum touch target, 40dp state layer, 24dp icon. */
.ts__icon-button {
  position: relative;
  display: grid;
  place-items: center;
  flex: none;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.ts__icon-button::before {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 50%;
}

.ts__icon-button:hover::before {
  background: rgba(var(--v-theme-on-surface-variant), 0.08);
}

.ts__icon-button:active::before {
  background: rgba(var(--v-theme-on-surface-variant), 0.1);
}

.ts__icon {
  font-size: 24px;
  width: 24px;
  height: 24px;
  line-height: 24px;
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* BasicTextField as the title of the bar. */
.ts__field {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  padding: 0 4px;
}

.ts__input {
  width: 100%;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.5px;
  caret-color: rgb(var(--v-theme-primary));
}

.ts__input::placeholder {
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 1;
}

/* HorizontalDivider: 1dp, outlineVariant. */
.ts__divider {
  height: 1px;
  background: rgb(var(--v-theme-outline-variant));
}

/* Content: the inner padding of the Scaffold. */
.ts__content {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
}

/* LoadingScreen: Box(fillMaxSize, Center) { CircularProgressIndicator() } –
   the M3 indeterminate indicator is 40dp wide with a 4dp stroke. */
.ts__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  min-height: 240px;
}

.ts__spinner-global,
.ts__spinner-steps {
  transform-box: view-box;
  transform-origin: center;
}

/* Global rotation: 1080deg over 6s. */
.ts__spinner-global {
  animation: ts-spin-global 6s linear infinite;
}

/* Additional rotation: 90deg eased steps at 300/1800/3300/4800ms. */
.ts__spinner-steps {
  animation: ts-spin-steps 6s linear infinite;
}

.ts__spinner-arc {
  fill: none;
  stroke: rgb(var(--v-theme-primary));
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 10 100;
  animation: ts-spin-sweep 6s linear infinite;
}

@keyframes ts-spin-global {
  from { transform: rotate(0deg); }
  to { transform: rotate(1080deg); }
}

@keyframes ts-spin-steps {
  0% { transform: rotate(0deg); animation-timing-function: cubic-bezier(0.05, 0.7, 0.1, 1); }
  5% { transform: rotate(90deg); animation-timing-function: linear; }
  25% { transform: rotate(90deg); animation-timing-function: cubic-bezier(0.05, 0.7, 0.1, 1); }
  30% { transform: rotate(180deg); animation-timing-function: linear; }
  50% { transform: rotate(180deg); animation-timing-function: cubic-bezier(0.05, 0.7, 0.1, 1); }
  55% { transform: rotate(270deg); animation-timing-function: linear; }
  75% { transform: rotate(270deg); animation-timing-function: cubic-bezier(0.05, 0.7, 0.1, 1); }
  80% { transform: rotate(360deg); animation-timing-function: linear; }
  100% { transform: rotate(360deg); }
}

@keyframes ts-spin-sweep {
  0% { stroke-dasharray: 10 100; animation-timing-function: cubic-bezier(0.2, 0, 0, 1); }
  50% { stroke-dasharray: 87 100; animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
  100% { stroke-dasharray: 10 100; }
}

@media (prefers-reduced-motion: reduce) {
  .ts__spinner-global,
  .ts__spinner-steps,
  .ts__spinner-arc {
    animation: none !important;
  }
}

/* EmptyScreen: Column(fillMaxSize, verticalScroll, padding(horizontal = 24dp)). */
.ts__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  min-height: 320px;
  padding: 0 24px;
}

/* Text(face, displayMedium, secondaryItemAlpha()) – always laid out LTR. */
.ts__face {
  font-size: 45px;
  line-height: 52px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.78;
  direction: ltr;
  white-space: nowrap;
}

.ts__empty-text {
  margin: 14px 0 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  text-align: center;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.78;
}

/* ScrollbarLazyColumn: vertical 12dp content padding, 12dp between the items. */
.ts__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 12px 0;
  list-style: none;
}

.ts__list-item {
  display: flex;
  flex-direction: column;
}

/* bottomBar: Row(padding(small = 8dp), spacedBy(small = 8dp)). */
.ts__bottom {
  gap: 8px;
  padding: 8px;
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  width: 100%;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.08);
}

.ts-bottom-enter-active,
.ts-bottom-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.ts-bottom-enter-from,
.ts-bottom-leave-to {
  opacity: 0;
  transform: translateY(50%);
}

@media (prefers-reduced-motion: reduce) {
  .ts-bottom-enter-active,
  .ts-bottom-leave-active {
    transition: none;
  }
}

/* MD3 elevated button: 40dp high, CornerFull (20dp), labelLarge (14sp/20sp, w500). */
.ts__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 58px;
  height: 40px;
  padding: 0 24px;
  border: 0;
  border-radius: 20px;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  cursor: pointer;
}

.ts__button--filled {
  flex: 1 1 auto;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15);
}

.ts__button--filled:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 90%, black);
}

.ts__button--icon {
  flex: none;
  width: 40px;
  padding: 0;
}

.ts__button--small {
  flex: none;
  padding: 0 16px;
}

/* MD3 snackbar. */
.ts__snackbar {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 2600;
  max-width: min(560px, calc(100vw - 32px));
  min-width: 288px;
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.28), 0 1px 2px rgba(0, 0, 0, 0.2);
}

/* The login hint bar of a tracker that is not logged in. */
.ts__login-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgb(var(--v-theme-surface));
  border-top: 1px solid rgb(var(--v-theme-on-surface-variant));
}

.ts__login-text {
  flex: 1 1 auto;
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface));
}

/* MD3 AlertDialog: 28dp radius, surfaceContainerHigh, 24dp padding. */
.ts-dialog {
  box-sizing: border-box;
  width: fit-content;
  min-width: 280px;
  max-width: 480px;
  margin: 0 auto;
  padding: 24px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px 0 rgba(0, 0, 0, 0.3);
}

.ts-dialog-title {
  margin: 0;
  padding-bottom: 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  text-align: start;
}

.ts-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface-variant));
}

.ts-dialog-icon {
  align-self: flex-start;
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.ts-dialog-text {
  margin: 0;
}

.ts-dialog-label {
  position: relative;
  display: block;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 16px;
  line-height: 24px;
}

.ts-dialog-label-text {
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
  transition: top 0.15s ease-in-out, font-size 0.15s ease-in-out, line-height 0.15s ease-in-out;
}

.ts-dialog-label.has-value .ts-dialog-label-text {
  top: 0;
  font-size: 12px;
  line-height: 16px;
}

.ts-dialog-input {
  height: 56px;
  padding: 15px 16px;
  border: 1px solid rgb(var(--v-theme-outline));
  border-radius: 4px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  font-size: 16px;
  line-height: 24px;
  outline: none;
}

.ts-dialog-label.has-value .ts-dialog-input {
  padding-top: 23px;
  padding-bottom: 7px;
}

.ts-dialog-error {
  margin: 0;
  color: rgb(var(--v-theme-error));
}

.ts-dialog-note {
  margin: 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface-container-highest));
}

.ts-dialog-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding-top: 16px;
}

.ts-text-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  height: 40px;
  padding: 0 12px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  cursor: pointer;
}

.ts-text-button--primary {
  font-weight: 500;
}

.ts-text-button:disabled {
  color: rgba(var(--v-theme-on-surface), 0.38);
  cursor: default;
}
</style>
