<script setup lang="ts">
/**
 * Settings — Tracking.
 *
 * Reference: mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsTrackingScreen.kt
 * (commit 446f6df). Supporting references:
 *   - PreferenceScreen.kt (group headers, 12dp group spacing)
 *   - widget/BasePreferenceWidget.kt (16dp padding, 56dp min height, 16sp title)
 *   - widget/TextPreferenceWidget.kt (bodySmall subtitle @ 0.78 alpha, max 10 lines)
 *   - widget/SwitchPreferenceWidget.kt (trailing switch, row click toggles)
 *   - widget/PreferenceGroupHeader.kt (bodyMedium, secondary, 14dp top / 8dp bottom)
 *   - widget/InfoWidget.kt (16dp padding, Info icon 24dp, bodySmall, .78 alpha)
 *   - widget/TrackingPreferenceWidget.kt (48dp logo clipped to 12dp, name 16sp medium,
 *     refresh IconButton 48dp with a 32dp glyph, green check 32dp #4CAF50)
 *   - widget/ListPreferenceWidget.kt (radio dialog with 48dp rows and a "Cancel" TextButton)
 *   - data/track/EnhancedTracker.kt (Komga, Kavita, Suwayomi)
 *
 * The tracker list, the login and the logout are served by Suwayomi-Server through
 * src/api/trackers.ts. The OAuth trackers keep Mihon's "open the tracker page in the browser"
 * flow, the credential trackers keep Mihon's login dialog (src/components/TrackingLoginDialog.vue)
 * and the log-out keeps Mihon's dialog (src/components/TrackingLogoutDialog.vue).
 */
import { computed, onMounted, ref } from 'vue'
import { listTrackers, loginTrackerCredentials, logoutTracker as logoutTrackerRequest, trackerIconUrl, type Tracker } from '@/core/api/trackers'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import { t } from '@/core/i18n'
import Md3Switch from '@/core/components/Md3Switch.vue'
import TrackingLoginDialog from '@/features/trackers/components/TrackingLoginDialog.vue'
import TrackingLogoutDialog from '@/features/trackers/components/TrackingLogoutDialog.vue'

const server = useSuwayomiStore()
const preferences = usePreferencesStore()

/* ---------------------------------------------------------------- preferences (local) */

const AUTO_UPDATE_TRACK = 'mihon.tracking.autoUpdateTrack'
const AUTO_UPDATE_ON_MARK_READ = 'mihon.tracking.autoUpdateTrackOnMarkRead'

function readLocal(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function writeLocal(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* private mode: session-only preference */ }
}

const autoUpdateTrack = ref(readLocal(AUTO_UPDATE_TRACK) !== 'false')
function setAutoUpdateTrack(value: boolean) {
  autoUpdateTrack.value = value
  writeLocal(AUTO_UPDATE_TRACK, String(value))
}

/** AutoTrackState.kt: ALWAYS("Always"), ASK("Always ask"), NEVER("Never"). */
const AUTO_TRACK_STATES = [
  { value: 'ALWAYS', title: 'Always' },
  { value: 'ASK', title: 'Always ask' },
  { value: 'NEVER', title: 'Never' },
]
const autoUpdateOnMarkRead = ref(readLocal(AUTO_UPDATE_ON_MARK_READ) ?? 'ALWAYS')
const autoUpdateOnMarkReadTitle = computed(
  () => AUTO_TRACK_STATES.find(s => s.value === autoUpdateOnMarkRead.value)?.title ?? 'Always',
)
function setAutoUpdateOnMarkRead(value: string) {
  autoUpdateOnMarkRead.value = value
  writeLocal(AUTO_UPDATE_ON_MARK_READ, value)
}
const markReadOpen = ref(false)

/* ---------------------------------------------------------------- trackers */

/** SettingsTrackingScreen.kt: the order of the "Trackers" group. */
const MIHON_TRACKER_ORDER = [
  'MangaBaka',
  'MyAnimeList',
  'AniList',
  'Kitsu',
  'MangaUpdates',
  'Shikimori',
  'Bangumi',
  'Hikka',
  'Comick',
]
/** EnhancedTracker.kt: Komga, Kavita and Suwayomi never prompt for a manual binding. */
const ENHANCED_TRACKER_NAMES = ['Komga', 'Kavita', 'Suwayomi']

const trackers = ref<Tracker[]>([])
const trackersLoading = ref(false)
const trackersError = ref<string | null>(null)

function matches(name: string, wanted: string) {
  return name.toLowerCase().replace(/[^a-z]/g, '') === wanted.toLowerCase().replace(/[^a-z]/g, '')
}
function orderedBy(entries: Tracker[], order: string[]) {
  const known = order
    .map(name => entries.find(entry => matches(entry.name, name)))
    .filter((entry): entry is Tracker => Boolean(entry))
  const rest = entries.filter(entry => !known.includes(entry))
  return [...known, ...rest]
}

const regularTrackers = computed(() => orderedBy(
  trackers.value.filter(t => !ENHANCED_TRACKER_NAMES.some(name => matches(t.name, name))),
  MIHON_TRACKER_ORDER,
))
const enhancedTrackers = computed(() => trackers.value.filter(t => ENHANCED_TRACKER_NAMES.some(name => matches(t.name, name))))
const missingEnhanced = computed(() => ENHANCED_TRACKER_NAMES.filter(
  name => !trackers.value.some(t => matches(t.name, name)),
))

/** Mihon appends the trackers without an installed source to the info text. */
const enhancedTrackerInfo = computed(() => {
  const base = 'Provides enhanced features for specific sources. Entries are automatically tracked when added to your library.'
  return missingEnhanced.value.length
    ? `${base}\n\nAvailable but source not installed: ${missingEnhanced.value.join(', ')}`
    : base
})

async function loadTrackers() {
  trackersLoading.value = true
  trackersError.value = null
  try {
    trackers.value = await listTrackers(server.apiUrl)
  } catch (error) {
    trackersError.value = error instanceof Error ? error.message : String(error)
  } finally {
    trackersLoading.value = false
  }
}

/* ---------------------------------------------------------------- login / logout */

const loginOpen = ref(false)
const loginTracker = ref<Tracker | null>(null)
const loginLabel = ref('Username')
const logoutOpen = ref(false)
const logoutTracker = ref<Tracker | null>(null)

const toast = ref<string | null>(null)
const toastOpen = ref(false)
function showToast(message: string) {
  toast.value = message
  toastOpen.value = true
}

/** Mihon: kitsu logs in with an e-mail address, MangaUpdates with a user name. */
function loginLabelFor(tracker: Tracker) {
  if (matches(tracker.name, 'Kitsu')) return 'Email address'
  if (matches(tracker.name, 'MangaUpdates')) return 'Username'
  return 'Username'
}
function isCredentialTracker(tracker: Tracker) {
  return matches(tracker.name, 'Kitsu') || matches(tracker.name, 'MangaUpdates')
}
function isEnhanced(tracker: Tracker) {
  return ENHANCED_TRACKER_NAMES.some(name => matches(tracker.name, name))
}

function openLogin(tracker: Tracker) {
  loginTracker.value = tracker
  loginLabel.value = loginLabelFor(tracker)
  if (isEnhanced(tracker)) {
    // EnhancedTracker.loginNoop(): the tracker has no credentials, but the Android
    // extension it needs does not exist in the browser.
    showToast('This enhanced tracker is not supported in the web version.')
    return
  }
  if (isCredentialTracker(tracker)) {
    loginOpen.value = true
    return
  }
  if (tracker.authUrl) {
    window.open(tracker.authUrl, '_blank', 'noopener')
    return
  }
  showToast('This tracker is not supported in the web version.')
}

async function onLogin(username: string, password: string, done: (success: boolean) => void) {
  const tracker = loginTracker.value
  if (!tracker) { done(false); return }
  try {
    const ok = await loginTrackerCredentials(server.apiUrl, tracker.id, username, password)
    if (ok) await loadTrackers()
    done(ok)
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error))
    done(false)
  }
}

function openLogout(tracker: Tracker) {
  logoutTracker.value = tracker
  logoutOpen.value = true
}

async function onLogout(_trackerName: string, done: (success: boolean) => void) {
  const tracker = logoutTracker.value
  if (!tracker) { done(false); return }
  try {
    await logoutTrackerRequest(server.apiUrl, tracker.id)
    await loadTrackers()
    done(true)
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error))
    done(false)
  }
}

/** PreferenceItem.kt TrackerPreference: the refresh action of a logged in tracker. */
function refreshTracker() {
  showToast('Refreshing the tracker profile is not supported in the web version.')
}

const HELP_URL = 'https://mihon.app/docs/guides/tracking'

onMounted(loadTrackers)
</script>

<template>
  <div class="settings-tracking">
    <!-- SettingsTrackingScreen.AppBarAction(): AutoMirroredRounded.Help → the tracking guide. -->
    <div class="settings-tracking__actions">
      <a class="settings-tracking__help" :href="HELP_URL" target="_blank" rel="noopener noreferrer" aria-label="Tracking guide">
        <v-icon icon="help" size="24" />
      </a>
    </div>

    <!-- Open track menu on adding to library (Komikku pref_track_on_add_library) -->
    <div class="pref-row pref-row--switch" @click="preferences.trackOnAddingToLibrary = !preferences.trackOnAddingToLibrary">
      <span class="pref-text">
        <span class="pref-title">{{ t('pref_track_on_add_library') || 'Open track menu on adding to library' }}</span>
        <span class="pref-subtitle">{{ t('pref_track_on_add_library_summary') || 'Prompt tracking settings when adding new entries to library' }}</span>
      </span>
      <Md3Switch
        :model-value="preferences.trackOnAddingToLibrary"
        label="Open track menu on adding to library"
        @update:model-value="(value: boolean) => { preferences.trackOnAddingToLibrary = value }"
      />
    </div>

    <!-- Auto-sync progress from trackers (Komikku pref_auto_sync_progress_from_trackers) -->
    <div class="pref-row pref-row--switch" @click="preferences.autoSyncProgressFromTrackers = !preferences.autoSyncProgressFromTrackers">
      <span class="pref-text">
        <span class="pref-title">{{ t('pref_auto_sync_progress_from_trackers') || 'Auto sync progress from Trackers' }}</span>
        <span class="pref-subtitle">{{ t('pref_auto_sync_progress_from_trackers_summary') || 'Automatically mark local chapters as read up to the tracker\'s highest read chapter on refresh' }}</span>
      </span>
      <Md3Switch
        :model-value="preferences.autoSyncProgressFromTrackers"
        label="Auto sync progress from Trackers"
        @update:model-value="(value: boolean) => { preferences.autoSyncProgressFromTrackers = value }"
      />
    </div>

    <!-- SwitchPreference(trackPreferences.autoUpdateTrack): the whole row toggles the
         preference (SwitchPreferenceWidget.kt passes onCheckedChange = null). -->
    <div class="pref-row pref-row--switch" @click="setAutoUpdateTrack(!autoUpdateTrack)">
      <span class="pref-text">
        <span class="pref-title">Update progress after reading</span>
      </span>
      <Md3Switch
        :model-value="autoUpdateTrack"
        label="Update progress after reading"
        @update:model-value="(value: boolean) => { setAutoUpdateTrack(value) }"
      />
    </div>

    <!-- ListPreference(trackPreferences.autoUpdateTrackOnMarkRead): the subtitle is the
         formatted entry of the current value (ListPreferenceWidget.kt). -->
    <button type="button" class="pref-row pref-row--button" @click="markReadOpen = true">
      <span class="pref-text">
        <span class="pref-title">Update progress when marked as read</span>
        <span class="pref-subtitle">{{ autoUpdateOnMarkReadTitle }}</span>
      </span>
    </button>

    <div class="pref-group">
      <!-- PreferenceGroup(MR.strings.services) -->
      <h2 class="pref-group-header">Trackers</h2>

      <p v-if="trackersLoading" class="pref-info__text pref-info__text--inline">Loading trackers…</p>
      <p v-else-if="trackersError" class="pref-info__text pref-info__text--inline">{{ trackersError }}</p>

      <!-- Preference.PreferenceItem.TrackerPreference -->
      <div v-for="tracker in regularTrackers" :key="tracker.id" class="tracker-row">
        <button type="button" class="tracker-row__main" @click="tracker.isLoggedIn ? openLogout(tracker) : openLogin(tracker)">
          <img
            v-if="trackerIconUrl(server.apiUrl, tracker)"
            class="tracker-row__logo"
            :src="trackerIconUrl(server.apiUrl, tracker)"
            :alt="tracker.name"
          />
          <span v-else class="tracker-row__logo tracker-row__logo--empty" aria-hidden="true" />
          <span class="tracker-row__text">
            <span class="tracker-row__name">{{ tracker.name }}</span>
          </span>
        </button>
        <span v-if="tracker.isLoggedIn" class="tracker-row__actions">
          <!-- IconButton(enabled = !isRefreshing) with a 32dp Refresh glyph padded by 4dp. -->
          <button type="button" class="tracker-row__refresh" aria-label="Refresh tracker profile" @click="refreshTracker">
            <v-icon icon="refresh" size="32" />
          </button>
          <!-- Icon(Check, 32dp, tint = 0xFF4CAF50) padded by 4dp. -->
          <span class="tracker-row__check" aria-label="Logged in">
            <v-icon icon="check" size="32" />
          </span>
        </span>
      </div>

      <!-- InfoPreference(MR.strings.tracking_info) -->
      <div class="pref-info">
        <v-icon icon="info" size="24" />
        <p class="pref-info__text">One-way sync to update the chapter progress in external tracker services. Set up tracking for individual entries from their tracking button.</p>
      </div>
    </div>

    <div class="pref-group">
      <!-- PreferenceGroup(MR.strings.enhanced_services) -->
      <h2 class="pref-group-header">Enhanced trackers</h2>

      <div v-for="tracker in enhancedTrackers" :key="tracker.id" class="tracker-row">
        <button type="button" class="tracker-row__main" @click="tracker.isLoggedIn ? openLogout(tracker) : openLogin(tracker)">
          <img
            v-if="trackerIconUrl(server.apiUrl, tracker)"
            class="tracker-row__logo"
            :src="trackerIconUrl(server.apiUrl, tracker)"
            :alt="tracker.name"
          />
          <span v-else class="tracker-row__logo tracker-row__logo--empty" aria-hidden="true" />
          <span class="tracker-row__text">
            <span class="tracker-row__name">{{ tracker.name }}</span>
          </span>
        </button>
        <span v-if="tracker.isLoggedIn" class="tracker-row__actions">
          <span class="tracker-row__check" aria-label="Logged in">
            <v-icon icon="check" size="32" />
          </span>
        </span>
      </div>

      <!-- InfoPreference(enhancedTrackerInfo) -->
      <div class="pref-info">
        <v-icon icon="info" size="24" />
        <p class="pref-info__text">{{ enhancedTrackerInfo }}</p>
      </div>
    </div>

    <!-- ListPreferenceWidget.kt: AlertDialog with the radio rows and a "Cancel" TextButton. -->
    <v-dialog v-model="markReadOpen" max-width="560">
      <v-card v-if="markReadOpen" class="pref-dialog" rounded="xl">
        <h3 class="pref-dialog__title">Update progress when marked as read</h3>
        <div class="pref-dialog__body">
          <button
            v-for="entry in AUTO_TRACK_STATES"
            :key="entry.value"
            type="button"
            class="pref-dialog__row"
            role="radio"
            :aria-checked="autoUpdateOnMarkRead === entry.value"
            @click="setAutoUpdateOnMarkRead(entry.value); markReadOpen = false"
          >
            <span class="pref-radio" :class="{ 'pref-radio--on': autoUpdateOnMarkRead === entry.value }" aria-hidden="true"><i /></span>
            <span class="pref-dialog__label">{{ entry.title }}</span>
          </button>
        </div>
        <div class="pref-dialog__actions">
          <v-btn variant="text" color="primary" @click="markReadOpen = false">Cancel</v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- TrackingLoginDialog.kt (src/components/TrackingLoginDialog.vue). -->
    <TrackingLoginDialog
      v-model="loginOpen"
      :tracker-name="loginTracker?.name ?? ''"
      :username-label="loginLabel"
      supported
      @login="onLogin"
    />

    <!-- TrackingLogoutDialog.kt (src/components/TrackingLogoutDialog.vue). -->
    <TrackingLogoutDialog
      v-model="logoutOpen"
      :tracker-name="logoutTracker?.name ?? ''"
      supported
      @logout="onLogout"
    />

    <v-snackbar v-model="toastOpen" :timeout="3000" color="inverse-surface" location="bottom">{{ toast }}</v-snackbar>
  </div>
</template>

<style scoped>
@layer app-components {
/* PreferenceGroupHeader.kt: bodyMedium, secondary color, 14dp top / 8dp bottom, 16dp horizontal. */
.pref-group-header { margin: 0; padding: 14px 16px 8px; font-size: 14px; line-height: 20px; font-weight: 400; color: rgb(var(--v-theme-secondary)); }
/* PreferenceScreen.kt: a 12dp spacer between the preference groups. */
.pref-group + .pref-group { margin-top: 12px; }
/* BasePreferenceWidget.kt: sizeIn(minHeight = 56dp), Column padding(vertical = 16dp). */
.pref-row {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  min-height: 56px;
  padding: 16px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
}
.pref-row--button { cursor: pointer; }
.pref-row--button:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.pref-text { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
/* TextPreferenceWidget.kt: titleLarge with a 16sp font size, max 2 lines. */
.pref-title {
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
/* TextPreferenceWidget.kt: bodySmall subtitle with secondaryItemAlpha (0.78), max 10 lines. */
.pref-subtitle {
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 78%, transparent);
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 10;
}
/* SwitchPreferenceWidget.kt: the trailing switch, buffered by TrailingWidgetBuffer (16dp). */
.pref-row--switch { cursor: pointer; }
.pref-row--switch:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }

/* InfoWidget.kt: Column padding 16dp, spacedBy 16dp, Icon(Info) then bodySmall text at 0.78 alpha. */
.pref-info { display: flex; flex-direction: column; gap: 16px; padding: 16px; opacity: .78; }
.pref-info__text { margin: 0; font-size: 12px; line-height: 16px; color: rgb(var(--v-theme-on-surface-variant)); white-space: pre-line; }
.pref-info__text--inline { padding: 16px; opacity: .78; }

/* TrackingPreferenceWidget.kt: Row fillMaxWidth padding(horizontal = 16dp, vertical = 8dp). */
.tracker-row { display: flex; align-items: center; padding: 8px 16px; }
.tracker-row__main { display: flex; align-items: center; flex: 1 1 auto; min-width: 0; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: start; cursor: pointer; }
/* TrackLogoIcon.kt: Image size 48dp clipped to MaterialTheme.shapes.medium (12dp). */
.tracker-row__logo { width: 48px; height: 48px; flex: 0 0 auto; border-radius: 12px; object-fit: cover; background: rgb(var(--v-theme-surface-variant)); }
.tracker-row__logo--empty { display: inline-block; }
/* The name column: Text padding(horizontal = 16dp). */
.tracker-row__text { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; padding: 0 16px; }
/* Tracker name: titleLarge, 16sp, medium weight, one line. */
.tracker-row__name { font-size: 16px; line-height: 24px; font-weight: 500; color: rgb(var(--v-theme-on-surface)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tracker-row__actions { display: flex; align-items: center; flex: 0 0 auto; }
/* IconButton: 48dp touch target, the 32dp glyph padded by 4dp. */
.tracker-row__refresh {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 4px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  cursor: pointer;
}
.tracker-row__refresh:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
/* Icon(Check, 32dp, tint = 0xFF4CAF50) padded by 4dp. */
.tracker-row__check {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 4px;
  color: #4caf50;
}

/* App bar action row (the screen's own help button). */
.settings-tracking__actions { display: flex; justify-content: flex-end; height: 48px; padding: 0 4px; }
.settings-tracking__help { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; color: rgb(var(--v-theme-on-surface-variant)); text-decoration: none; }
.settings-tracking__help:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }

/* ListPreferenceWidget.kt: AlertDialog (28dp radius, 24dp padding) with a headlineSmall title. */
.pref-dialog { padding: 24px; background: rgb(var(--v-theme-surface-container-high)); color: rgb(var(--v-theme-on-surface)); }
.pref-dialog__title { margin: 0 0 16px; font-size: 24px; line-height: 32px; font-weight: 400; color: rgb(var(--v-theme-on-surface)); }
.pref-dialog__body { display: flex; flex-direction: column; max-height: 320px; overflow-y: auto; }
/* DialogRow.kt: clip(small) + selectable + minimumInteractiveComponentSize (48dp). */
.pref-dialog__row {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 0 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.pref-dialog__row:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
/* MD3 RadioButton: 20dp outer circle, 10dp inner dot. */
.pref-radio {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
}
.pref-radio--on { border-color: rgb(var(--v-theme-primary)); }
.pref-radio i { width: 10px; height: 10px; border-radius: 50%; background: rgb(var(--v-theme-primary)); }
.pref-radio--on i { display: block; }
.pref-radio:not(.pref-radio--on) i { display: none; }
/* The entry label: bodyLarge with a 24dp start padding. */
.pref-dialog__label { padding-inline-start: 24px; font-size: 16px; line-height: 24px; color: rgb(var(--v-theme-on-surface)); }
.pref-dialog__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
}
</style>
