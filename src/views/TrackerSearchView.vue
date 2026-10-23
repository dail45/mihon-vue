<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  bindTracker,
  listTrackers,
  loginTrackerCredentials,
  searchTracker,
  trackerIconUrl,
  type Tracker,
  type TrackerSearchResult,
} from '../api/trackers'
import { useSuwayomiStore } from '../stores/suwayomi'

/**
 * Pixel-parity port of Mihon's tracker search screen.
 *
 * Reference (Mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1):
 * - `presentation/track/TrackerSearch.kt` -> `TrackerSearch(state, onDispatchQuery,
 *   queryResult, selected, onSelectedChange, onConfirmSelection, onDismissRequest,
 *   supportsPrivateTracking)`.
 *   The screen is a `Scaffold` whose top bar is a `TopAppBar` with a back
 *   navigation icon, a `BasicTextField` as the title (search hint, IME action
 *   "Search", primary cursor) and a "clear" action shown while the text is not
 *   empty, followed by a `HorizontalDivider`. The bottom bar appears with
 *   `AnimatedVisibility` as soon as a result is selected: a filled "Track"
 *   button and, when the tracker supports private tracking, a second button
 *   with the `VisibilityOff` glyph.
 *   The content is a loading screen while the query result is unknown, an
 *   `EmptyScreen` for an empty list and for a failure, and otherwise a
 *   `ScrollbarLazyColumn` of `SearchResultItem` cards.
 * - `presentation/track/TrackerSearch.kt` -> `SearchResultItem`: a 16dp rounded
 *   card with a 2dp border (`outline` when selected), 12dp padding, a 96dp
 *   high 2:3 cover, the title (titleMedium, two lines), the authors/artists
 *   line, the type / start date / status / score detail rows and the summary
 *   (four lines). A long press opens the drop-down menu with "Copy to
 *   clipboard" and "Open in browser".
 * - `presentation/core/screens/EmptyScreen.kt`: the face (displayMedium) and
 *   the message (bodyMedium, 24dp above the baseline of the face).
 *
 * Suwayomi notes:
 * - The search is only possible for a *logged-in* tracker
 *   (`searchTracker` fails with "Tracker needs to be logged-in to search"), so
 *   the screen offers the login of the selected tracker. The OAuth login of
 *   Mihon opens a system browser and a deep link back into the app, which the
 *   web client cannot do: the OAuth variant is an honest stub that opens the
 *   tracker page in a new tab and asks the user to refresh the login state.
 * - Suwayomi's search DTO has no `authors` / `artists` fields, so that line is
 *   simply absent (the reference renders it only when it is not empty).
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

/** Mihon: `state` – the text of the search field. */
const query = ref(String(route.query.q ?? ''))
/** Mihon: `queryResult` – `null` while the result is unknown. */
const queryResult = ref<{ ok: true; items: TrackerSearchResult[] } | { ok: false; message: string } | null>(null)
/** Mihon: `selected`. */
const selected = ref<TrackerSearchResult | null>(null)

const trackers = ref<Tracker[]>([])
const tracker = computed(() => trackers.value.find(t => t.id === trackerId.value) ?? null)
const supportsPrivateTracking = computed(() => tracker.value?.supportsPrivateTracking ?? false)

const errorMessage = ref('')
const snackbarMessage = ref('')
let snackbarTimer: ReturnType<typeof setTimeout> | undefined

function showSnackbar(msg: string) {
  snackbarMessage.value = msg
  if (snackbarTimer) clearTimeout(snackbarTimer)
  snackbarTimer = setTimeout(() => {
    snackbarMessage.value = ''
  }, 3000)
}

const failedCovers = ref<Set<number>>(new Set())
function onCoverError(id: number) {
  failedCovers.value.add(id)
}

const searchInput = ref<HTMLInputElement | null>(null)
/** Mihon: `dropDownMenuExpanded` of the result card – the long press opens the menu. */
const menuFor = ref<number | null>(null)

/** The long press or more button of a card opens its drop down menu. */
function openMenu(id: number) {
  menuFor.value = menuFor.value === id ? null : id
}

/** Mihon: `combinedClickable(onLongClick = { dropDownMenuExpanded = true })`. */
let longPressTimer: ReturnType<typeof setTimeout> | undefined
/** The id of the card whose long press fired, so the click does not select it. */
let longPressId: number | null = null

function startLongPress(id: number) {
  cancelLongPress()
  longPressTimer = setTimeout(() => {
    longPressId = id
    menuFor.value = id
  }, 500)
}

function cancelLongPress() {
  if (longPressTimer) clearTimeout(longPressTimer)
  longPressTimer = undefined
}

/** Guards against a stale response overwriting a newer search. */
let job = 0

async function loadTrackers() {
  try {
    trackers.value = await listTrackers(server.apiUrl)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unknown error'
  }
}

async function runSearch(text: string) {
  const trimmed = text.trim()
  if (!trimmed || trackerId.value === null) {
    // Mihon: `queryResult == null` -> the loading screen.
    queryResult.value = null
    return
  }
  const current = ++job
  // Mihon: `state.update { it.copy(queryResult = null, selected = null) }` – the loading
  // state and the cleared selection before the search runs.
  queryResult.value = null
  selected.value = null
  try {
    const items = await searchTracker(server.apiUrl, trackerId.value, trimmed)
    if (current !== job) return
    queryResult.value = { ok: true, items }
    // Mihon: `selected = result.getOrNull()?.find { it.tracking_url == currentUrl }`.
    const currentUrl = String(route.query.currentUrl ?? '')
    selected.value = items.find(item => item.trackingUrl === currentUrl) ?? null
  } catch (error) {
    if (current !== job) return
    queryResult.value = { ok: false, message: error instanceof Error ? error.message : 'Unknown error' }
  }
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
  // Mihon: `state.clearText(); focusRequester.requestFocus()` – the result is kept.
  query.value = ''
  searchInput.value?.focus()
}

function onSelect(item: TrackerSearchResult) {
  // Mihon: `combinedClickable` consumes the long press, so it does not select.
  if (longPressId === item.id) { longPressId = null; return }
  selected.value = item
  menuFor.value = null
  // Mihon: `focusManager.clearFocus()` before the selection is applied.
  ;(document.activeElement as HTMLElement | null)?.blur()
}

/** Mihon: `onConfirmSelection(private)`. */
async function onConfirmSelection(isPrivate: boolean) {
  if (!selected.value || trackerId.value === null) return
  if (mangaId.value === null) {
    errorMessage.value = 'The tracker search needs a manga to bind the result to. Open it from the manga screen.'
    return
  }
  errorMessage.value = ''
  try {
    await bindTracker(server.apiUrl, mangaId.value, trackerId.value, selected.value.remoteId, isPrivate)
    goUp()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unknown error'
  }
}

function goUp() {
  if (typeof window.history.state?.back === 'string') { router.back(); return }
  // Mihon: `navigator.pop()` returns to the track dialog of the manga.
  if (mangaId.value !== null) { void router.push(`/manga/${mangaId.value}`); return }
  void router.push('/library')
}

/** Mihon: `trackSearch.publishing_type.toLowerCase(locale).capitalize(locale)`. */
function capitalize(value: string): string {
  if (!value) return ''
  const lower = value.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function publishingType(item: TrackerSearchResult): string {
  return capitalize(item.publishingType || '')
}

function publishingStatus(item: TrackerSearchResult): string {
  return capitalize(item.publishingStatus || '')
}

/** Mihon: `(trackSearch.authors + trackSearch.artists).distinct().joinToString()`. */
function authorsArtists(item: TrackerSearchResult): string {
  const list = [...(item.authors ?? []), ...(item.artists ?? [])].filter(Boolean)
  return Array.from(new Set(list)).join(', ')
}

/** Mihon: `trackSearch.summary.trim()`. */
function description(item: TrackerSearchResult): string {
  return item.summary?.trim() || ''
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
const loginError = ref('')
const loggingIn = ref(false)
/** Mihon: the OAuth login opens the tracker page in a browser. */
const oauthPending = ref(false)

async function submitLogin() {
  const current = tracker.value
  if (!current || !username.value || !password.value) return
  loggingIn.value = true
  loginError.value = ''
  try {
    const ok = await loginTrackerCredentials(server.apiUrl, current.id, username.value, password.value)
    if (ok) {
      loginOpen.value = false
      await loadTrackers()
      await runSearch(query.value)
    } else {
      loginError.value = 'The tracker refused the login. Check the credentials.'
    }
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : 'Unknown error'
  } finally {
    loggingIn.value = false
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
  // Mihon: every new `EmptyScreen` composition remembers a new random face.
  errorFace.value = errorFaces[Math.floor(Math.random() * errorFaces.length)] ?? errorFaces[0]!
})

/** Mihon: `DropdownMenu(onDismissRequest = { dropDownMenuExpanded = false })`. */
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
  // Mihon: the field is cleared while the last result stays as it is.
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
    <!--
      Scaffold(topBar = Column { TopAppBar(...); HorizontalDivider() })
    -->
    <header class="ts__bar">
      <div class="ts__bar-row">
        <!-- IconButton(ArrowBack, tint = onSurfaceVariant) -->
        <button type="button" class="ts__icon-button" aria-label="Back" @click="goUp">
          <span class="material-symbols-rounded ts__icon" aria-hidden="true">arrow_back</span>
        </button>

        <!--
          TopAppBar title = BasicTextField(fillMaxWidth, bodyLarge, onSurface,
          single line, ImeAction.Search, cursorBrush = primary)
        -->
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

        <!-- IconButton(Close) – only while the text is not empty. -->
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
      <!-- HorizontalDivider() -->
      <div class="ts__divider" />
    </header>

    <!-- Content -->
    <main class="ts__content">
      <!-- queryResult == null -> LoadingScreen(padding(innerPadding)) -->
      <div v-if="queryResult === null" class="ts__loading" role="progressbar" aria-label="Loading">
        <svg class="ts__spinner" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
          <g class="ts__spinner-global">
            <g class="ts__spinner-steps">
              <circle class="ts__spinner-arc" cx="20" cy="20" r="18" pathLength="100" />
            </g>
          </g>
        </svg>
      </div>

      <!-- EmptyScreen(stringRes = no_results_found) -->
      <div v-else-if="queryResult.ok && queryResult.items.length === 0" class="ts__empty">
        <span class="ts__face" aria-hidden="true">{{ errorFace }}</span>
        <p class="ts__empty-text">No results found</p>
      </div>

      <!-- EmptyScreen(message = exception.message) -->
      <div v-else-if="!queryResult.ok" class="ts__empty">
        <span class="ts__face" aria-hidden="true">{{ errorFace }}</span>
        <p class="ts__empty-text">{{ queryResult.message || 'Unknown error' }}</p>
      </div>

      <!-- ScrollbarLazyColumn(contentPadding = innerPadding + vertical 12dp, spacedBy 12dp) -->
      <ul v-else class="ts__list" role="list">
        <li v-for="item in queryResult.items" :key="item.id" class="ts__list-item">
          <!--
            SearchResultItem: Box(fillMaxWidth, padding(horizontal = 12dp), clip(16dp),
            background(surface), border(2dp, outline when selected), padding(12dp))
          -->
          <div
            class="ts__card"
            :class="{ 'ts__card--selected': selected?.id === item.id }"
            role="button"
            tabindex="0"
            @click="onSelect(item)"
            @keydown.enter="onSelect(item)"
            @keydown.space.prevent="onSelect(item)"
            @contextmenu.prevent="openMenu(item.id)"
            @pointerdown="startLongPress(item.id)"
            @pointerup="cancelLongPress"
            @pointerleave="cancelLongPress"
            @pointercancel="cancelLongPress"
          >
            <!-- Icon(RoundedFilled.CheckCircle, align TopEnd, tint = primary) -->
            <span
              v-if="selected?.id === item.id"
              class="material-symbols-rounded ts__check"
              aria-hidden="true"
            >check_circle</span>

            <!-- More action button at TopEnd when not selected -->
            <button
              v-else
              type="button"
              class="ts__more-btn"
              aria-label="More options"
              @click.stop="openMenu(item.id)"
            >
              <span class="material-symbols-rounded ts__more-icon" aria-hidden="true">more_vert</span>
            </button>

            <div class="ts__card-column">
              <div class="ts__card-row">
                <!-- MangaCover.Book(cover_url, height = 96dp) -->
                <img
                  v-if="item.coverUrl && !failedCovers.has(item.id)"
                  class="ts__cover"
                  :src="item.coverUrl"
                  :alt="item.title"
                  loading="lazy"
                  @error="onCoverError(item.id)"
                />
                <div v-else class="ts__cover ts__cover--placeholder" aria-hidden="true" />

                <div class="ts__cover-gap" />

                <div class="ts__info">
                  <!-- Text(title, padding(end = 28dp), maxLines 2, titleMedium) -->
                  <p class="ts__title">{{ item.title }}</p>

                  <!-- Text((authors + artists).distinct().joinToString(), bodySmall) -->
                  <p v-if="authorsArtists(item)" class="ts__authors">{{ authorsArtists(item) }}</p>

                  <!-- SearchResultItemDetails(track_type, type) -->
                  <div v-if="publishingType(item)" class="ts__details">
                    <span class="ts__details-title">Type</span>
                    <span class="ts__details-text">{{ publishingType(item) }}</span>
                  </div>
                  <!-- SearchResultItemDetails(label_started, start_date) -->
                  <div v-if="item.startDate" class="ts__details">
                    <span class="ts__details-title">Started</span>
                    <span class="ts__details-text">{{ item.startDate }}</span>
                  </div>
                  <!-- SearchResultItemDetails(track_status, status) -->
                  <div v-if="publishingStatus(item)" class="ts__details">
                    <span class="ts__details-title">Status</span>
                    <span class="ts__details-text">{{ publishingStatus(item) }}</span>
                  </div>
                  <!-- SearchResultItemDetails(score, score) -->
                  <div v-if="item.score !== undefined && item.score !== null && item.score !== -1" class="ts__details">
                    <span class="ts__details-title">Score</span>
                    <span class="ts__details-text">{{ item.score }}</span>
                  </div>
                </div>
              </div>

              <!-- Text(description, paddingFromBaseline(top = 24dp), bodySmall, maxLines 4) -->
              <p v-if="description(item)" class="ts__description">{{ description(item) }}</p>
            </div>

            <!--
              SearchResultItemDropDownMenu: opened by long press, context menu, or more button
            -->
            <div v-if="menuFor === item.id" class="ts__menu" role="menu">
              <button type="button" class="ts__menu-item" role="menuitem" @click.stop="copyTitle(item)">
                Copy to clipboard
              </button>
              <button
                type="button"
                class="ts__menu-item"
                role="menuitem"
                @click.stop="openInBrowser(item)"
              >
                Open in browser
              </button>
            </div>
          </div>
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

    <!--
      bottomBar = AnimatedVisibility(visible = selected != null) {
        Row(padding(small = 8dp), navigationBars, fillMaxWidth, spacedBy(small = 8dp)) {
          Button(weight 1f) { Text(action_track) }
          if (supportsPrivateTracking) Button { Icon(RoundedFilled.VisibilityOff) }
        }
      }
    -->
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
  /* bodyLarge: 16sp / 24sp / Regular / 0.5sp */
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
  /* M3 indeterminate arc: 10%..87% of the circle. */
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
  /* displayMedium: 45sp / 52sp */
  font-size: 45px;
  line-height: 52px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.78;
  direction: ltr;
  white-space: nowrap;
}

/*
 * Text(message, bodyMedium, paddingFromBaseline(top = 24dp), textAlign = Center).
 * `paddingFromBaseline` puts the layout top 24dp above the text baseline; the
 * cap height of Roboto at 14px is ~9.95px, so the visible ink gap is ~14px.
 */
.ts__empty-text {
  margin: 14px 0 0;
  /* bodyMedium: 14sp / 20sp */
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

/* SearchResultItem: Box(fillMaxWidth, padding(horizontal = 12dp), clip(16dp),
   background(surface), border(2dp, outline when selected), padding(12dp)). */
.ts__card {
  position: relative;
  box-sizing: border-box;
  width: calc(100% - 24px);
  margin: 0 12px;
  padding: 12px;
  border: 2px solid transparent;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.ts__card--selected {
  border-color: rgb(var(--v-theme-outline));
}

.ts__check {
  position: absolute;
  /* `Icon(align = Alignment.TopEnd)` inside the padded Box: the icon sits at
     the top end of the content area of the card (12dp inside the shape). */
  top: 12px;
  right: 12px;
  font-size: 24px;
  width: 24px;
  height: 24px;
  line-height: 24px;
  color: rgb(var(--v-theme-primary));
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.ts__more-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.ts__more-btn:hover {
  background: rgba(var(--v-theme-on-surface-variant), 0.08);
}

.ts__more-icon {
  font-size: 20px;
  width: 20px;
  height: 20px;
  line-height: 20px;
}

.ts__card-column {
  display: flex;
  flex-direction: column;
}

.ts__card-row {
  display: flex;
  align-items: flex-start;
}

/* MangaCover.Book: 2:3 aspect ratio, 96dp high, extraSmall (4dp) shape. */
.ts__cover {
  flex: none;
  width: 64px;
  height: 96px;
  border-radius: 4px;
  object-fit: cover;
  background: rgb(var(--v-theme-surface));
}

.ts__cover--placeholder {
  background: rgba(136, 136, 136, 0.12);
}

.ts__cover-gap {
  flex: none;
  width: 12px;
}

.ts__info {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
}

/* Text(title, padding(end = 28dp), maxLines 2, titleMedium). */
.ts__title {
  margin: 0;
  padding-right: 28px;
  /* titleMedium: 16sp / 24sp / Medium / 0.15sp */
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  letter-spacing: 0.15px;
  color: rgb(var(--v-theme-on-surface));
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* The reference renders the authors / artists line below the title:
   Text((authors + artists).distinct().joinToString(), secondaryItemAlpha(), bodySmall).
   Suwayomi's search DTO has no `authors` / `artists` fields, so the line is not
   rendered; its metrics are kept here for the day the server exposes them. */
.ts__authors {
  margin: 0;
  font-size: 12px;
  line-height: 16px;
  letter-spacing: 0.4px;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.78;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* SearchResultItemDetails: Row(spacedBy(extraSmall = 4dp)). */
.ts__details {
  display: flex;
  gap: 4px;
  min-width: 0;
}

.ts__details-title {
  flex: none;
  /* titleSmall: 14sp / 20sp / Medium / 0.1sp */
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ts__details-text {
  flex: 1 1 auto;
  min-width: 0;
  /* bodyMedium: 14sp / 20sp */
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.78;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Text(description, paddingFromBaseline(top = 24dp), bodySmall, maxLines 4). */
.ts__description {
  margin: 24px 0 0;
  font-size: 12px;
  line-height: 16px;
  letter-spacing: 0.4px;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.78;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* DropdownMenu of the result card: Mihon's `DropdownMenu` constrains the width to
   196dp and overlaps its anchor (offset = DpOffset(8.dp, (-56).dp)). */
.ts__menu {
  position: absolute;
  top: 12px;
  left: 88px;
  z-index: 3;
  box-sizing: border-box;
  min-width: 196px;
  max-width: 196px;
  padding: 8px 0;
  border-radius: 4px;
  background: rgb(var(--v-theme-surface-container));
  box-shadow: 0 2px 6px 2px rgba(0, 0, 0, 0.15), 0 1px 2px 0 rgba(0, 0, 0, 0.3);
}

/* MD3 DropdownMenuItem: height 48dp, bodyLarge label, 16dp horizontal padding. */
.ts__menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  height: 48px;
  padding: 0 16px;
  border: 0;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.5px;
  text-align: start;
  cursor: pointer;
}

.ts__menu-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}

.ts__menu-item:disabled {
  color: rgba(var(--v-theme-on-surface), 0.38);
  cursor: default;
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

/* AnimatedVisibility: enter = fadeIn() + slideInVertically { it / 2 },
   exit = slideOutVertically { it / 2 } + fadeOut(). */
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
