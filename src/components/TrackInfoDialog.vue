<script setup lang="ts">
/**
 * Pixel-parity port of Mihon's tracking sheet ("Track info" dialog).
 *
 * Reference (Mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1):
 * - `presentation/track/TrackInfoDialogHome.kt` -> `TrackInfoDialogHome`:
 *   a scrollable `Column` (16dp padding, system bar insets, 24dp between the
 *   items) that renders one `TrackInfoItem` per tracker with a binding and one
 *   `TrackInfoItemEmpty` per tracker without one.
 * - `TrackInfoItem`: a `Row` with the 48dp tracker logo (badged with a
 *   `VisibilityOff` badge when the track is private), the title (titleMedium,
 *   one line, ellipsis, click = new search, long press = copy the title), a
 *   `VerticalDivider` and the `TrackInfoItemMenu` (MoreVert). Under it a
 *   `surfaceContainerHighest` box (12dp top padding, 8dp padding, 6dp radius)
 *   with the details rows: status / chapters / score and, when the tracker
 *   supports reading dates, start date / finish date.
 * - `TrackDetailsItem`: a clickable, padded (12dp) `Box` with a `bodyMedium`
 *   text; an unset value falls back to the placeholder with 50% alpha.
 * - `TrackInfoItemEmpty`: the logo plus an "Add tracking" `TextButton`.
 * - `TrackInfoItemMenu`: "Open in browser", "Copy link", "Track privately" /
 *   "Track publicly" (only for trackers with private tracking) and "Remove".
 * - `presentation/components/AdaptiveSheet.kt`: the host dialog (max width
 *   460dp, `surfaceContainerHigh`, `extraLarge` shape, fade in 220ms with a
 *   90ms delay, fade out 90ms, swipe to dismiss).
 * - `tachiyomi/ui/manga/track/TrackInfoDialog.kt` -> `TrackerRemoveScreen`:
 *   the "Remove %s tracking?" alert dialog with the "Also remove from %s"
 *   checkbox and the Cancel / OK buttons.
 *
 * Suwayomi notes:
 * - The tracking data of the pinned Suwayomi revision is reachable only over
 *   GraphQL (`/api/graphql`); the REST surface has no tracking route.
 * - The status / chapter / score / date selectors are the shared component
 *   `src/components/TrackInfoSelectors.vue` (the port of
 *   `TrackInfoDialogSelector.kt`).
 */
import { computed, ref, watch } from 'vue'
import TrackInfoSelectors, { type TrackSelectorMode } from './TrackInfoSelectors.vue'
import {
  fetchMangaTrackRecords,
  listTrackers,
  trackerIconUrl,
  unbindTrackerRecord,
  updateTrackerRecord,
  type Tracker,
  type TrackerRecord,
} from '../api/trackers'
import { apiErrorMessage } from '../api/client'
import { useSuwayomiStore } from '../stores/suwayomi'

const props = defineProps<{
  /** Opens / closes the sheet. */
  modelValue: boolean
  /** The manga whose tracking records are shown. */
  mangaId: number
  /** The manga title, used as the initial tracker search query. */
  mangaTitle?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  /** The user asked for a new tracker entry (the tracker search screen). */
  'search': [trackerId: number, query: string]
}>()

const server = useSuwayomiStore()

/**
 * Standard trackers supported by Mihon / Suwayomi.
 * Used as default / offline fallback so the tracking dialog always displays the services.
 */
const DEFAULT_TRACKERS: Tracker[] = [
  {
    id: 1,
    name: 'MyAnimeList',
    icon: '',
    isLoggedIn: false,
    authUrl: null,
    supportsPrivateTracking: false,
    supportsReadingDates: true,
    statuses: [
      { name: 'Reading', value: 1 },
      { name: 'Completed', value: 2 },
      { name: 'On hold', value: 3 },
      { name: 'Dropped', value: 4 },
      { name: 'Plan to read', value: 6 },
      { name: 'Rereading', value: 5 },
    ],
    scores: ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1', '0'],
    supportsTrackDeletion: false,
  },
  {
    id: 2,
    name: 'AniList',
    icon: '',
    isLoggedIn: false,
    authUrl: null,
    supportsPrivateTracking: true,
    supportsReadingDates: true,
    statuses: [
      { name: 'Reading', value: 1 },
      { name: 'Plan to read', value: 2 },
      { name: 'Completed', value: 3 },
      { name: 'On hold', value: 4 },
      { name: 'Dropped', value: 5 },
      { name: 'Repeating', value: 6 },
    ],
    scores: Array.from({ length: 101 }, (_, i) => String(i)),
    supportsTrackDeletion: false,
  },
  {
    id: 3,
    name: 'Kitsu',
    icon: '',
    isLoggedIn: false,
    authUrl: null,
    supportsPrivateTracking: false,
    supportsReadingDates: true,
    statuses: [
      { name: 'Reading', value: 1 },
      { name: 'Plan to read', value: 2 },
      { name: 'Completed', value: 3 },
      { name: 'On hold', value: 4 },
      { name: 'Dropped', value: 5 },
    ],
    scores: ['- -', '0.5', '1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'],
    supportsTrackDeletion: false,
  },
  {
    id: 4,
    name: 'Shikimori',
    icon: '',
    isLoggedIn: false,
    authUrl: null,
    supportsPrivateTracking: false,
    supportsReadingDates: true,
    statuses: [
      { name: 'Reading', value: 1 },
      { name: 'Planned', value: 2 },
      { name: 'Completed', value: 3 },
      { name: 'On hold', value: 4 },
      { name: 'Dropped', value: 5 },
      { name: 'Rewatching', value: 6 },
    ],
    scores: ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1', '0'],
    supportsTrackDeletion: false,
  },
  {
    id: 5,
    name: 'Bangumi',
    icon: '',
    isLoggedIn: false,
    authUrl: null,
    supportsPrivateTracking: true,
    supportsReadingDates: true,
    statuses: [
      { name: 'Reading', value: 1 },
      { name: 'Completed', value: 2 },
      { name: 'On hold', value: 3 },
      { name: 'Dropped', value: 4 },
      { name: 'Plan to read', value: 5 },
    ],
    scores: ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1', '0'],
    supportsTrackDeletion: false,
  },
  {
    id: 7,
    name: 'MangaUpdates',
    icon: '',
    isLoggedIn: false,
    authUrl: null,
    supportsPrivateTracking: false,
    supportsReadingDates: false,
    statuses: [
      { name: 'Reading', value: 1 },
      { name: 'Wish list', value: 2 },
      { name: 'Complete', value: 3 },
      { name: 'Unfinished', value: 4 },
      { name: 'On hold', value: 5 },
    ],
    scores: ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1', '0'],
    supportsTrackDeletion: false,
  },
]

const TRACKER_BRAND_INFO: Record<string, { bg: string; color: string; short: string }> = {
  myanimelist: { bg: '#2e51a2', color: '#ffffff', short: 'MAL' },
  anilist: { bg: '#02a9ff', color: '#ffffff', short: 'AL' },
  kitsu: { bg: '#fd755c', color: '#ffffff', short: 'KT' },
  shikimori: { bg: '#333333', color: '#ffffff', short: 'SH' },
  bangumi: { bg: '#f09199', color: '#ffffff', short: 'BG' },
  mangaupdates: { bg: '#76a74c', color: '#ffffff', short: 'MU' },
  komga: { bg: '#004d40', color: '#ffffff', short: 'KM' },
  kavita: { bg: '#2e51a2', color: '#ffffff', short: 'KV' },
  suwayomi: { bg: '#1e88e5', color: '#ffffff', short: 'SW' },
}

function trackerBrand(tracker: Tracker) {
  const key = tracker.name.toLowerCase().replace(/[^a-z]/g, '')
  return TRACKER_BRAND_INFO[key] ?? {
    bg: 'rgb(var(--v-theme-surface-container-highest))',
    color: 'rgb(var(--v-theme-on-surface))',
    short: tracker.name.slice(0, 3).toUpperCase(),
  }
}

const failedLogos = ref<Record<number, boolean>>({})

const trackers = ref<Tracker[]>([])
const records = ref<TrackerRecord[]>([])
const loading = ref(false)
const error = ref('')

/** Which item menu is open. */
const openMenu = ref<number | null>(null)

/** The selector opened from a detail cell. */
const selectorOpen = ref(false)
const selector = ref<TrackSelectorMode | null>(null)
const selectorTracker = ref<Tracker | null>(null)
const selectorRecord = ref<TrackerRecord | null>(null)
const selectorStatus = ref<number | null>(null)
const selectorScore = ref('')
const selectorChapter = ref(0)
const selectorDate = ref<number | null>(null)
const selectorDateTitle = ref('')
const selectorDateKind = ref<'start' | 'finish'>('start')
const selectorDateRemovable = ref(false)

/** The "Remove %s tracking?" confirmation. */
const removeOpen = ref(false)
const removeTracker = ref<Tracker | null>(null)
const removeRecord = ref<TrackerRecord | null>(null)
const removeRemote = ref(false)

/** The value of a date cell, formatted or null when it is unset. */
const UNSET_TEXT_ALPHA = 0.5

interface TrackItem {
  tracker: Tracker
  track: TrackerRecord | null
}

const items = computed<TrackItem[]>(() =>
  trackers.value.map(tracker => ({
    tracker,
    track: records.value.find(record => record.trackerId === tracker.id) ?? null,
  })),
)

const STANDARD_STATUS_NAMES: Record<number, string> = {
  1: 'Reading',
  2: 'Plan to read',
  3: 'Completed',
  4: 'On hold',
  5: 'Dropped',
  6: 'Repeating',
}

/** Mihon: `item.tracker.getStatus(item.track.status)`. */
function statusName(tracker: Tracker, status: number): string | null {
  return tracker.statuses?.find(option => option.value === status)?.name ?? STANDARD_STATUS_NAMES[status] ?? null
}

/** Mihon: `item.tracker.getScoreList().isNotEmpty()`. */
function supportsScoring(tracker: Tracker): boolean {
  return tracker.scores.length > 0
}

/** Mihon: `item.tracker.displayScore(item.track)`. */
function displayScore(record: TrackerRecord): string {
  return record.displayScore || String(record.score ?? '')
}

/** Mihon: the chapter cell, `"12 / 24"` when the total is known. */
function chaptersText(record: TrackerRecord): string {
  const read = Math.trunc(record.lastChapterRead ?? 0)
  const total = record.totalChapters ?? 0
  return total > 0 ? `${read} / ${total}` : `${read}`
}

/** Mihon: `dateFormat.format(date)` – the reading dates of a record. */
function formatDate(value: string | undefined): string | null {
  if (!value) return null
  const millis = Number(value)
  if (!Number.isFinite(millis) || millis <= 0) return null
  const date = new Date(millis)
  if (Number.isNaN(date.getTime())) return null
  // Mihon: `UiPreferences.dateFormat("", locale)` -> `ofLocalizedDate(FormatStyle.SHORT)`.
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(date)
}

/** The value of a date cell, formatted or null when it is unset. */
function dateCell(record: TrackerRecord, kind: 'start' | 'finish'): string | null {
  const tracker = trackers.value.find(item => item.id === record.trackerId)
  if (!tracker?.supportsReadingDates) return null
  return formatDate(kind === 'start' ? record.startDate : record.finishDate)
}

/** The chapter numbers of the wheel picker (0..total). */
function chapterOptions(record: TrackerRecord): number[] {
  const total = Math.max(0, Math.trunc(record.totalChapters ?? 0))
  return Array.from({ length: total + 1 }, (_, index) => index)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [trackerList, recordList] = await Promise.all([
      listTrackers(server.apiUrl),
      fetchMangaTrackRecords(server.apiUrl, props.mangaId),
    ])
    trackers.value = trackerList.length > 0 ? trackerList : DEFAULT_TRACKERS
    records.value = recordList
  } catch (cause) {
    error.value = apiErrorMessage(cause)
    if (trackers.value.length === 0) {
      trackers.value = DEFAULT_TRACKERS
    }
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.modelValue, props.mangaId] as const,
  ([open]) => {
    if (open) void load()
    else {
      openMenu.value = null
      selector.value = null
      selectorOpen.value = false
      removeOpen.value = false
    }
  },
  { immediate: true },
)

// --- item actions ------------------------------------------------------------------------

/** Mihon: `onOpenInBrowser` вЂ“ opens the remote url of the record. */
function openInBrowser(record: TrackerRecord) {
  openMenu.value = null
  if (record.remoteUrl) window.open(record.remoteUrl, '_blank', 'noopener')
}

/** Mihon: `onCopyLink` вЂ“ copies the remote url of the record. */
function copyLink(record: TrackerRecord) {
  openMenu.value = null
  if (record.remoteUrl && navigator.clipboard) void navigator.clipboard.writeText(record.remoteUrl)
}

/** Mihon: `onNewSearch` вЂ“ opens the tracker search for this tracker. */
function newSearch(item: TrackItem) {
  emit('search', item.tracker.id, item.track?.title ?? props.mangaTitle ?? '')
}

/** Mihon: `combinedClickable(onLongClick = copyToClipboard(title, title))`. */
function copyTitle(item: TrackItem) {
  if (item.track?.title && navigator.clipboard) void navigator.clipboard.writeText(item.track.title)
}

/** Mihon: `viewModel.togglePrivate`. */
async function togglePrivate(record: TrackerRecord) {
  openMenu.value = null
  try {
    await updateTrackerRecord(server.apiUrl, { recordId: record.id, private: !record.private })
    await load()
  } catch (cause) {
    error.value = apiErrorMessage(cause)
  }
}

/** Mihon: `onRemoved` -> `TrackerRemoveScreen`. */
function askRemove(item: TrackItem) {
  openMenu.value = null
  if (!item.track) return
  removeTracker.value = item.tracker
  removeRecord.value = item.track
  removeRemote.value = false
  removeOpen.value = true
}

/** Mihon: `viewModel.unregisterTracking` (+ `deleteMangaFromService`). */
async function confirmRemove() {
  const record = removeRecord.value
  if (!record) return
  try {
    await unbindTrackerRecord(server.apiUrl, record.id, removeRemote.value)
    removeOpen.value = false
    await load()
  } catch (cause) {
    error.value = apiErrorMessage(cause)
  }
}

// --- detail cells ------------------------------------------------------------------------

function openStatus(item: TrackItem) {
  if (!item.track) return
  selectorTracker.value = item.tracker
  selectorRecord.value = item.track
  selectorStatus.value = item.track.status
  selectorOpen.value = true
  selector.value = 'status'
}

function openScore(item: TrackItem) {
  if (!item.track) return
  selectorTracker.value = item.tracker
  selectorRecord.value = item.track
  selectorScore.value = item.track.displayScore || ''
  selectorOpen.value = true
  selector.value = 'score'
}

function openChapter(item: TrackItem) {
  if (!item.track) return
  selectorTracker.value = item.tracker
  selectorRecord.value = item.track
  selectorChapter.value = Math.trunc(item.track.lastChapterRead ?? 0)
  selectorOpen.value = true
  selector.value = 'chapter'
}

function openDate(item: TrackItem, kind: 'startDate' | 'endDate') {
  if (!item.track) return
  selectorTracker.value = item.tracker
  selectorRecord.value = item.track
  const isStart = kind === 'startDate'
  selectorDateKind.value = isStart ? 'start' : 'finish'
  const raw = isStart ? item.track.startDate : item.track.finishDate
  const millis = Number(raw ?? 0)
  selectorDate.value = Number.isFinite(millis) && millis > 0 ? millis : null
  selectorDateTitle.value = isStart ? 'Start date' : 'Finish date'
  selectorDateRemovable.value = Boolean(selectorDate.value)
  selectorOpen.value = true
  selector.value = 'date'
}

/** The confirm handler of the shared selector component. */
async function onSelectorConfirm(value: number | string) {
  const record = selectorRecord.value
  if (!record) return
  try {
    if (selector.value === 'status') {
      await updateTrackerRecord(server.apiUrl, { recordId: record.id, status: Number(value) })
    } else if (selector.value === 'score') {
      await updateTrackerRecord(server.apiUrl, { recordId: record.id, scoreString: String(value) })
    } else if (selector.value === 'chapter') {
      await updateTrackerRecord(server.apiUrl, { recordId: record.id, lastChapterRead: Number(value) })
    } else if (selector.value === 'date') {
      const millis = Number(value)
      const isStart = selectorDateKind.value === 'start'
      await updateTrackerRecord(
        server.apiUrl,
        isStart ? { recordId: record.id, startDate: millis } : { recordId: record.id, finishDate: millis },
      )
    }
    await load()
  } catch (cause) {
    error.value = apiErrorMessage(cause)
  }
}

/** The date removal of `TrackDateRemoverScreen`. */
async function onSelectorRemove() {
  const record = selectorRecord.value
  if (!record) return
  try {
    const isStart = selectorDateKind.value === 'start'
    await updateTrackerRecord(
      server.apiUrl,
      isStart ? { recordId: record.id, startDate: 0 } : { recordId: record.id, finishDate: 0 },
    )
    await load()
  } catch (cause) {
    error.value = apiErrorMessage(cause)
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    class="ti-dialog"
    max-width="460"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!--
      Column(fillMaxWidth, verticalScroll, padding(16dp), windowInsetsPadding(systemBars))
      with verticalArrangement = spacedBy(24.dp)
    -->
    <div class="ti" role="dialog" aria-modal="true" aria-label="Tracking">
      <!-- Backdrop to dismiss item dropdown menu -->
      <div v-if="openMenu !== null" class="ti__menu-backdrop" @click="openMenu = null" />

      <p v-if="error" class="ti__error" role="alert">{{ error }}</p>

      <div v-if="loading && items.length === 0" class="ti__loading" role="progressbar" aria-label="Loading">
        <svg class="ti__spinner" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
          <circle class="ti__spinner-arc" cx="20" cy="20" r="18" pathLength="100" />
        </svg>
      </div>

      <template v-for="item in items" :key="item.tracker.id">
        <!-- TrackInfoItem -->
        <section v-if="item.track" class="ti__item">
          <div class="ti__item-head">
            <!-- BadgedBox(badge = VisibilityOff when the track is private) -->
            <span class="ti__logo-wrap">
              <!-- TrackLogoIcon(onClick = onOpenInBrowser, onLongClick = onCopyLink) -->
              <img
                v-if="trackerIconUrl(server.apiUrl, item.tracker) && !failedLogos[item.tracker.id]"
                class="ti__logo ti__logo--action"
                :src="trackerIconUrl(server.apiUrl, item.tracker)"
                :alt="item.tracker.name"
                width="48"
                height="48"
                @error="failedLogos[item.tracker.id] = true"
                @click="openInBrowser(item.track)"
                @contextmenu.prevent="copyLink(item.track)"
              />
              <span
                v-else
                class="ti__logo ti__logo--action ti__logo--brand"
                :style="{ backgroundColor: trackerBrand(item.tracker).bg, color: trackerBrand(item.tracker).color }"
                :title="item.tracker.name"
                @click="openInBrowser(item.track)"
                @contextmenu.prevent="copyLink(item.track)"
              >
                {{ trackerBrand(item.tracker).short }}
              </span>
              <span v-if="item.track.private" class="ti__badge" title="Tracked privately">
                <span class="material-symbols-rounded ti__badge-icon" aria-hidden="true">visibility_off</span>
                <span class="ti__visually-hidden">Tracked privately</span>
              </span>
            </span>

            <!-- Box(height 48dp, weight 1f, padding(start = 16dp), combinedClickable) -->
            <button
              type="button"
              class="ti__title"
              :title="item.track.title"
              @click="newSearch(item)"
              @contextmenu.prevent="copyTitle(item)"
            >
              {{ item.track.title }}
            </button>

            <!-- VerticalDivider() -->
            <span class="ti__v-divider" aria-hidden="true" />

            <!-- TrackInfoItemMenu -->
            <div class="ti__menu-anchor">
              <button
                type="button"
                class="ti__icon-button"
                aria-label="More options"
                @click="openMenu = openMenu === item.tracker.id ? null : item.tracker.id"
              >
                <span class="material-symbols-rounded ti__icon" aria-hidden="true">more_vert</span>
              </button>
              <div v-if="openMenu === item.tracker.id" class="ti__menu" role="menu">
                <button type="button" class="ti__menu-item" role="menuitem" @click="openInBrowser(item.track)">
                  Open in browser
                </button>
                <button type="button" class="ti__menu-item" role="menuitem" @click="copyLink(item.track)">
                  Copy link
                </button>
                <button
                  v-if="item.tracker.supportsPrivateTracking"
                  type="button"
                  class="ti__menu-item"
                  role="menuitem"
                  @click="togglePrivate(item.track)"
                >
                  {{ item.track.private ? 'Track publicly' : 'Track privately' }}
                </button>
                <button type="button" class="ti__menu-item" role="menuitem" @click="askRemove(item)">
                  Remove
                </button>
              </div>
            </div>
          </div>

          <!--
            Box(padding(top = 12dp), clip(medium), background(surfaceContainerHighest),
                padding(8dp), clip(RoundedCornerShape(6.dp)))
          -->
          <div class="ti__details">
            <div class="ti__details-clip">
              <div class="ti__details-row">
                <!-- TrackDetailsItem(status) -->
                <button type="button" class="ti__cell" @click="openStatus(item)">
                  <span class="ti__cell-text">{{ statusName(item.tracker, item.track.status) ?? '' }}</span>
                </button>
                <span class="ti__v-divider" aria-hidden="true" />
                <!-- TrackDetailsItem(chapters) -->
                <button type="button" class="ti__cell" @click="openChapter(item)">
                  <span class="ti__cell-text">{{ chaptersText(item.track) }}</span>
                </button>
                <!-- TrackDetailsItem(score) -->
                <template v-if="supportsScoring(item.tracker)">
                  <span class="ti__v-divider" aria-hidden="true" />
                  <button type="button" class="ti__cell" @click="openScore(item)">
                    <span
                      class="ti__cell-text"
                      :style="{ opacity: item.track.score !== 0 ? 1 : UNSET_TEXT_ALPHA }"
                    >{{ item.track.score !== 0 ? displayScore(item.track) : 'Score' }}</span>
                  </button>
                </template>
              </div>

              <!-- The reading dates row exists only for trackers with reading dates. -->
              <template v-if="item.tracker.supportsReadingDates">
                <div class="ti__h-divider" aria-hidden="true" />
                <div class="ti__details-row">
                  <button type="button" class="ti__cell" @click="openDate(item, 'startDate')">
                    <span
                      class="ti__cell-text"
                      :style="{ opacity: dateCell(item.track, 'start') === null ? UNSET_TEXT_ALPHA : 1 }"
                    >{{ dateCell(item.track, 'start') ?? 'Start date' }}</span>
                  </button>
                  <span class="ti__v-divider" aria-hidden="true" />
                  <button type="button" class="ti__cell" @click="openDate(item, 'endDate')">
                    <span
                      class="ti__cell-text"
                      :style="{ opacity: dateCell(item.track, 'finish') === null ? UNSET_TEXT_ALPHA : 1 }"
                    >{{ dateCell(item.track, 'finish') ?? 'Finish date' }}</span>
                  </button>
                </div>
              </template>
            </div>
          </div>
        </section>

        <!-- TrackInfoItemEmpty -->
        <section v-else class="ti__item ti__item--empty">
          <span class="ti__logo-wrap">
            <img
              v-if="trackerIconUrl(server.apiUrl, item.tracker) && !failedLogos[item.tracker.id]"
              class="ti__logo"
              :src="trackerIconUrl(server.apiUrl, item.tracker)"
              :alt="item.tracker.name"
              width="48"
              height="48"
              @error="failedLogos[item.tracker.id] = true"
            />
            <span
              v-else
              class="ti__logo ti__logo--brand"
              :style="{ backgroundColor: trackerBrand(item.tracker).bg, color: trackerBrand(item.tracker).color }"
              :title="item.tracker.name"
            >
              {{ trackerBrand(item.tracker).short }}
            </span>
          </span>
          <!-- TextButton(onClick = onNewSearch, padding(start = 16dp), weight 1f) -->
          <button type="button" class="ti__text-button" @click="newSearch(item)">Add tracking</button>
        </section>
      </template>
    </div>
  </v-dialog>

  <!-- TrackInfoDialogSelector.kt: the status / chapter / score / date selectors. -->
  <TrackInfoSelectors
    v-model:open="selectorOpen"
    :mode="selector ?? 'status'"
    :status-options="(selectorTracker?.statuses ?? []).map(option => ({ key: option.value, label: option.name }))"
    :status-selection="selectorStatus"
    :chapter-options="selectorRecord ? chapterOptions(selectorRecord) : []"
    :chapter-selection="selectorChapter"
    :score-options="selectorTracker?.scores ?? []"
    :score-selection="selectorScore"
    :date-selection="selectorDate"
    :date-title="selectorDateTitle"
    :date-kind="selectorDateKind"
    :date-service-name="selectorTracker?.name"
    :date-removable="selectorDateRemovable"
    @confirm="onSelectorConfirm"
    @remove="onSelectorRemove"
  />

  <!-- TrackerRemoveScreen: the "Remove %s tracking?" alert dialog. -->
  <v-dialog v-model="removeOpen" max-width="560">
    <div class="ti__confirm" role="dialog" aria-modal="true">
      <span class="material-symbols-rounded ti__confirm-icon" aria-hidden="true">delete</span>
      <h2 class="ti__confirm-title">Remove {{ removeTracker?.name ?? '' }} tracking?</h2>
      <p class="ti__confirm-text">This will remove the tracking locally.</p>
      <label v-if="removeTracker?.supportsTrackDeletion" class="ti__checkbox">
        <input v-model="removeRemote" type="checkbox" class="ti__checkbox-input" />
        <span>Also remove from {{ removeTracker.name }}</span>
      </label>
      <div class="ti__confirm-actions">
        <button type="button" class="ti__confirm-button" @click="removeOpen = false">Cancel</button>
        <button type="button" class="ti__confirm-button ti__confirm-button--danger" @click="confirmRemove">OK</button>
      </div>
    </div>
  </v-dialog>
</template>

<style scoped>
/* The host sheet draws its own surface (extraLarge, surfaceContainerHigh). */
.ti-dialog > :deep(.v-overlay__content),
.ti-dialog > :deep(.v-overlay__content > .v-card) {
  background: transparent;
  box-shadow: none;
  padding: 0;
  overflow: visible;
}

.ti {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  max-width: 460px;
  max-height: 80vh;
  overflow-y: auto;
  padding: 16px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
}

.ti__error {
  margin: 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgb(var(--v-theme-error-container));
  color: rgb(var(--v-theme-on-error-container));
  font-size: 14px;
  line-height: 20px;
}

.ti__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
}

.ti__spinner-arc {
  fill: none;
  stroke: rgb(var(--v-theme-primary));
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 10 100;
  transform-origin: center;
  transform-box: view-box;
  animation: ti-spin 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes ti-spin {
  0% { transform: rotate(0deg); stroke-dasharray: 10 100; }
  50% { transform: rotate(270deg); stroke-dasharray: 87 100; }
  100% { transform: rotate(540deg); stroke-dasharray: 10 100; }
}

/* TrackInfoItem -> Column */
.ti__item {
  display: flex;
  flex-direction: column;
}

/* Row(verticalAlignment = CenterVertically) */
.ti__item-head {
  display: flex;
  align-items: center;
  min-height: 48px;
}

/* BadgedBox + TrackLogoIcon: 48dp, medium shape (12dp). */
.ti__logo-wrap {
  position: relative;
  display: inline-flex;
  flex: none;
}

.ti__logo {
  flex: none;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  object-fit: cover;
  background: rgb(var(--v-theme-surface-container-highest));
}

/* TrackLogoIcon with an onClick: it is a clickable target. */
.ti__logo--action {
  cursor: pointer;
}

/* Badge(containerColor = primary, contentColor = onPrimary, offset x = -5dp). */
.ti__badge {
  position: absolute;
  top: 0;
  right: 0;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  margin-right: 5px;
  border-radius: 8px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}

.ti__badge-icon {
  font-size: 14px;
  width: 14px;
  height: 14px;
  line-height: 14px;
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 14;
}

.ti__visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* Box(height 48dp, weight 1f, padding(start = 16dp), CenterStart). */
.ti__title {
  flex: 1 1 auto;
  min-width: 0;
  height: 48px;
  padding: 0 16px;
  border: 0;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  /* titleMedium: 16sp / 24sp / Medium / 0.15sp */
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  letter-spacing: 0.15px;
  text-align: start;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

/* VerticalDivider(): 1dp wide, full height of the row. */
.ti__v-divider {
  align-self: stretch;
  flex: none;
  width: 1px;
  background: rgb(var(--v-theme-outline-variant));
}

.ti__menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 4;
}

.ti__menu-anchor {
  position: relative;
  flex: none;
}

/* IconButton: 48dp touch target, 24dp icon. */
.ti__icon-button {
  position: relative;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.ti__icon-button::before {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 50%;
}

.ti__icon-button:hover::before {
  background: rgba(var(--v-theme-on-surface-variant), 0.08);
}

.ti__icon {
  font-size: 24px;
  width: 24px;
  height: 24px;
  line-height: 24px;
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/*
 * DropdownMenu: 196dp wide, surfaceContainer, 4dp radius, 48dp items,
 * offset (8dp, -56dp) so that it overlaps the anchor.
 */
.ti__menu {
  position: absolute;
  top: 44px;
  right: 0;
  z-index: 5;
  width: 196px;
  padding: 0;
  border-radius: 4px;
  background: rgb(var(--v-theme-surface-container));
  box-shadow: 0 2px 6px 2px rgba(0, 0, 0, 0.15), 0 1px 2px 0 rgba(0, 0, 0, 0.3);
}

.ti__menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  height: 48px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  /* labelLarge: 14sp / 20sp / Medium / 0.1sp */
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  text-align: start;
  cursor: pointer;
}

.ti__menu-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}

/* Fallback badge when tracker logo icon image is missing or loading fails */
.ti__logo--brand {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.5px;
  user-select: none;
}

/*
 * Box(padding(top = 12dp), clip(medium), background(surfaceContainerHighest),
 *     padding(8dp), clip(RoundedCornerShape(6.dp)))
 */
.ti__details {
  margin-top: 12px;
  padding: 8px;
  /* clip(MaterialTheme.shapes.medium) on the box, the inner content is clipped at 6dp. */
  border-radius: 12px;
  background: rgb(var(--v-theme-surface-container-highest));
  overflow: hidden;
}

.ti__details-clip {
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.ti__details-row {
  display: flex;
  align-items: stretch;
  min-height: 48px;
}

/* HorizontalDivider() */
.ti__h-divider {
  height: 1px;
  background: rgb(var(--v-theme-outline-variant));
}

/* TrackDetailsItem: clickable, padded 12dp, centered bodyMedium text. */
.ti__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 0;
  min-width: 0;
  min-height: 48px;
  padding: 12px;
  border: 0;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.15s ease;
}

.ti__cell:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}

.ti__cell:active {
  background: rgba(var(--v-theme-on-surface), 0.12);
}

.ti__cell-text {
  /* bodyMedium: 14sp / 20sp */
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  text-align: center;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* TrackInfoItemEmpty: Row(CenterVertically) with a TextButton. */
.ti__item--empty {
  flex-direction: row;
  align-items: center;
}

.ti__text-button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  min-width: 0;
  height: 40px;
  margin: 0 0 0 16px;
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
  text-align: center;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.ti__text-button:hover {
  background: rgba(var(--v-theme-primary), 0.08);
}

.ti__text-button:active {
  background: rgba(var(--v-theme-primary), 0.12);
}

/* TrackerRemoveScreen: AlertDialogContent (28dp radius, surfaceContainerHigh). */
.ti__confirm {
  box-sizing: border-box;
  width: 100%;
  max-width: 560px;
  padding: 24px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 4px 8px 3px rgba(0, 0, 0, 0.15);
}

.ti__confirm-icon {
  display: block;
  margin: 0 auto 16px;
  font-size: 24px;
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.ti__confirm-title {
  margin: 0 0 16px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  text-align: center;
}

.ti__confirm-text {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface-variant));
}

.ti__checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface-variant));
  cursor: pointer;
}

.ti__checkbox-input {
  accent-color: rgb(var(--v-theme-primary));
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.ti__confirm-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 16px;
}

.ti__confirm-button {
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
  transition: background-color 0.2s ease;
}

.ti__confirm-button:hover {
  background: rgba(var(--v-theme-primary), 0.08);
}

.ti__confirm-button--danger {
  background: rgb(var(--v-theme-error-container));
  color: rgb(var(--v-theme-on-error-container));
}

.ti__confirm-button--danger:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-error-container)) 90%, black);
}

/* AdaptiveSheet: on small mobile screens, anchor sheet to the bottom */
@media (max-width: 600px) {
  .ti-dialog :deep(.v-overlay__content) {
    margin-bottom: 0 !important;
    align-self: flex-end !important;
    width: 100% !important;
    max-width: 460px !important;
  }
  .ti {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    max-height: 85vh;
  }
}
</style>
