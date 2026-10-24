<script setup lang="ts">
/**
 * Settings — Advanced.
 *
 * Reference: mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsAdvancedScreen.kt
 * (item order, titles, subtitles and group order come from that file) together with the shared
 * preference widgets:
 *   - mihon/.../more/settings/widget/BasePreferenceWidget.kt     (row metrics)
 *   - mihon/.../more/settings/widget/TextPreferenceWidget.kt     (title/subtitle typography)
 *   - mihon/.../more/settings/widget/SwitchPreferenceWidget.kt   (MD3 switch, trailing buffer)
 *   - mihon/.../more/settings/widget/ListPreferenceWidget.kt     (list dialog)
 *   - mihon/.../more/settings/widget/EditTextPreferenceWidget.kt (text dialog)
 *   - mihon/.../more/settings/widget/PreferenceGroupHeader.kt    (group header metrics)
 *   - mihon/.../more/settings/PreferenceScreen.kt                (12dp gap after every group)
 *
 * The web client is a headless REST client for Suwayomi, so the Android-only items (crash log
 * dump, battery optimization, notification settings, WebView data, local database, Android debug
 * info, extension trust) are careful stubs: the row opens a dialog that looks like the reference
 * one and explains that the feature is not supported in the web version.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { readPreference, writePreference } from '../stores/preferences'

const router = useRouter()

// --- local preference storage (mirrors the reference preference keys) --------------------
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Linux; Android 13; Mobile) Mihon/0.1'
const flags = ref({
  verboseLogging: readPreference('pref_verbose_logging') === 'true',
  redactSensitiveHeaders: readPreference('pref_redact_sensitive_headers') !== 'false',
  updateMangaTitles: readPreference('pref_update_library_manga_titles') === 'true',
  disallowNonAsciiFilenames: readPreference('pref_disallow_non_ascii_filenames') === 'true',
  enableChapterNameHash: readPreference('pref_enable_chapter_name_hash') === 'true',
  highQualityRenderer: readPreference('pref_high_quality_renderer') === 'true',
})
const dohProvider = ref(readPreference('pref_doh_provider') || 'Disabled')
const userAgent = ref(readPreference('pref_user_agent_string') || DEFAULT_USER_AGENT)
const extensionInstaller = ref(readPreference('ext_installer_pref') || 'Legacy')

// --- transient messages (Android toast in the reference) ----------------------------------
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
function showToast(message: string) {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 3000)
}

// --- item model ---------------------------------------------------------------------------
type Kind = 'text' | 'switch' | 'list' | 'edit'
interface Item {
  kind: Kind
  title: string
  subtitle?: string
  key?: keyof typeof flags.value
  entries?: { title: string; value: string }[]
  action?: string
  /** Reset user agent row is only visible when the value differs from the default one. */
  onlyWhenCustomUserAgent?: boolean
}
interface Group { title?: string; items: Item[] }

const dohEntries = [
  { title: 'Disabled', value: 'Disabled' },
  { title: 'Cloudflare', value: 'Cloudflare' },
  { title: 'Google', value: 'Google' },
  { title: 'AdGuard', value: 'AdGuard' },
  { title: 'Quad9', value: 'Quad9' },
  { title: 'AliDNS', value: 'AliDNS' },
  { title: 'DNSPod', value: 'DNSPod' },
  { title: '360', value: '360' },
  { title: 'Quad 101', value: 'Quad 101' },
  { title: 'Mullvad', value: 'Mullvad' },
  { title: 'Control D', value: 'Control D' },
  { title: 'Njalla', value: 'Njalla' },
  { title: 'Shecan', value: 'Shecan' },
]
// The reference filters the private installer out of release builds.
const installerEntries = [
  { title: 'Legacy', value: 'Legacy' },
  { title: 'PackageInstaller', value: 'PackageInstaller' },
  { title: 'Shizuku', value: 'Shizuku' },
]

const groups: Group[] = [
  {
    items: [
      { kind: 'text', title: 'Share crash logs', subtitle: 'Saves error logs to a file for sharing with the developers', action: 'crashLogs' },
      { kind: 'switch', title: 'Verbose logging', subtitle: 'Print verbose logs to system log (reduces app performance)', key: 'verboseLogging' },
      { kind: 'switch', title: 'Redact sensitive headers', subtitle: 'Redacts certain sensitive values in the logs. Keep enabled for your security when sharing logs with other people.', key: 'redactSensitiveHeaders' },
      { kind: 'text', title: 'Debug info', action: 'debugInfo' },
      { kind: 'text', title: 'Onboarding guide', action: 'onboarding' },
      { kind: 'text', title: 'Manage notifications', action: 'notifications' },
    ],
  },
  {
    title: 'Background activity',
    items: [
      { kind: 'text', title: 'Disable battery optimization', subtitle: 'Helps with background library updates and backups', action: 'battery' },
      { kind: 'text', title: "Don't kill my app!", subtitle: 'Some manufacturers have additional app restrictions that kill background services. This website has more info on how to fix it.', action: 'dontKillMyApp' },
    ],
  },
  {
    title: 'Data',
    items: [
      { kind: 'text', title: 'Reindex downloads', subtitle: 'Force app to recheck downloaded chapters', action: 'reindex' },
      { kind: 'text', title: 'Clear database', subtitle: 'Delete history for entries that are not saved in your library', action: 'clearDatabase' },
    ],
  },
  {
    title: 'Networking',
    items: [
      { kind: 'text', title: 'Clear cookies', action: 'clearCookies' },
      { kind: 'text', title: 'Clear WebView data', action: 'clearWebView' },
      { kind: 'list', title: 'DNS over HTTPS (DoH)', entries: dohEntries, action: 'doh' },
      { kind: 'edit', title: 'Default user agent string', action: 'userAgent' },
      { kind: 'text', title: 'Reset default user agent string', action: 'resetUserAgent', onlyWhenCustomUserAgent: true },
    ],
  },
  {
    title: 'Library',
    items: [
      { kind: 'text', title: 'Refresh library covers', action: 'refreshCovers' },
      { kind: 'text', title: 'Reset per-series reader settings', subtitle: 'Resets reading mode and orientation of all series', action: 'resetViewerFlags' },
      { kind: 'switch', title: 'Update library manga titles to match source', subtitle: 'Warning: if a manga is renamed, it will be removed from the download queue (if present).', key: 'updateMangaTitles' },
      { kind: 'switch', title: 'Disallow non-ASCII filenames', subtitle: "Ensures compatibility with certain storage media that don't support Unicode. When this is enabled, you'll need to manually rename source and manga folders by replacing non-ASCII characters with their lowercase UTF-8 hexadecimal representations. Chapter files don't need to be renamed.", key: 'disallowNonAsciiFilenames' },
      { kind: 'switch', title: 'Enable chapter name hash suffix', subtitle: 'Ensures a unique hash suffix is added to chapter names to prevent naming conflicts. If disabled, chapters with identical names cannot be downloaded.', key: 'enableChapterNameHash' },
    ],
  },
  {
    title: 'Reader',
    items: [
      { kind: 'switch', title: 'Use high quality renderer', key: 'highQualityRenderer' },
    ],
  },
  {
    title: 'Extensions',
    items: [
      { kind: 'list', title: 'Installer', entries: installerEntries, action: 'installer' },
      { kind: 'text', title: 'Revoke trusted unknown extensions', action: 'revokeTrust' },
    ],
  },
]

// --- state -------------------------------------------------------------------------------
const stubDialog = ref('')
const shizukuOpen = ref(false)
const listDialog = ref<{ title: string; entries: { title: string; value: string }[]; selected: string; action: string } | null>(null)
const editDialog = ref(false)
const editValue = ref('')
const customUserAgent = computed(() => userAgent.value !== DEFAULT_USER_AGENT)

const stubTexts: Record<string, { title: string; message: string }> = {
  crashLogs: { title: 'Share crash logs', message: 'Dumping Android crash logs is not supported in the web version. The web client keeps no on-device log file.' },
  debugInfo: { title: 'Debug info', message: 'The Android app information (build time, installation ID, profile compilation status, WebView version, device model) is not available in the web version.' },
  onboarding: { title: 'Onboarding guide', message: 'The onboarding guide is an Android screen and is not available in the web version.' },
  notifications: { title: 'Manage notifications', message: 'Android notification settings are not supported in the web version. Use your browser notification permissions instead.' },
  battery: { title: 'Disable battery optimization', message: 'Battery optimization is an Android system setting and cannot be changed from the web version.' },
  reindex: { title: 'Reindex downloads', message: 'Reindexing downloads is not supported in the web version. Downloads live on the Suwayomi server.' },
  clearDatabase: { title: 'Clear database', message: 'There is no local database in the web version. The Suwayomi server database cannot be cleared from here.' },
  clearWebView: { title: 'Clear WebView data', message: 'The web version has no embedded WebView, so there is no WebView data to clear.' },
  refreshCovers: { title: 'Refresh library covers', message: 'Refreshing library covers is not supported in the web version. The server manages cover metadata.' },
  resetViewerFlags: { title: 'Reset per-series reader settings', message: 'Per-series reader settings are not stored by the web client, so there is nothing to reset.' },
  revokeTrust: { title: 'Revoke trusted unknown extensions', message: 'Extension trust is an Android feature and is not available in the web version.' },
}

// --- actions -----------------------------------------------------------------------------
function onItemClick(item: Item) {
  if (item.kind === 'switch') { toggleSwitch(item); return }
  switch (item.action) {
    case 'dontKillMyApp':
      window.open('https://dontkillmyapp.com/', '_blank', 'noopener')
      return
    case 'clearCookies':
      clearCookies()
      return
    case 'doh':
      listDialog.value = { title: item.title, entries: dohEntries, selected: dohProvider.value, action: 'doh' }
      return
    case 'installer':
      listDialog.value = { title: item.title, entries: installerEntries, selected: extensionInstaller.value, action: 'installer' }
      return
    case 'userAgent':
      editValue.value = userAgent.value
      editDialog.value = true
      return
    case 'resetUserAgent':
      resetUserAgent()
      return
    case 'onboarding':
      void router.push('/onboarding')
      return
    case 'clearDatabase':
      void router.push('/settings/advanced/clear-database')
      return
    case 'debugInfo':
      void router.push('/settings/advanced/debug')
      return
    default:
      stubDialog.value = item.action || ''
  }
}

function toggleSwitch(item: Item) {
  if (!item.key) return
  const key = item.key
  flags.value = { ...flags.value, [key]: !flags.value[key] }
  writePreference(`pref_${key}`, String(flags.value[key]))
  if (key === 'verboseLogging' || key === 'redactSensitiveHeaders') showToast('Requires app restart to take effect')
}

function clearCookies() {
  try {
    for (const part of document.cookie.split(';')) {
      const name = part.split('=')[0]?.trim()
      if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    }
    showToast('Cookies cleared')
  } catch {
    showToast('Error occurred while clearing')
  }
}

function confirmList(value: string) {
  if (!listDialog.value) return
  if (listDialog.value.action === 'doh') {
    dohProvider.value = value
    writePreference('pref_doh_provider', value)
    showToast('Requires app restart to take effect')
  } else if (listDialog.value.action === 'installer') {
    if (value === 'Shizuku') {
      // The reference rejects the value and asks the user to install Shizuku first.
      shizukuOpen.value = true
      listDialog.value = null
      return
    }
    extensionInstaller.value = value
    writePreference('ext_installer_pref', value)
  }
  listDialog.value = null
}

function confirmUserAgent() {
  const value = editValue.value.trim()
  if (!value || /[\r\n]/.test(value)) { showToast('Invalid user agent string'); return }
  userAgent.value = value
  writePreference('pref_user_agent_string', value)
  editDialog.value = false
  showToast('Requires app restart to take effect')
}

function openShizukuDownload() {
  window.open('https://shizuku.rikka.app/download', '_blank', 'noopener')
}

function resetUserAgent() {
  userAgent.value = DEFAULT_USER_AGENT
  writePreference('pref_user_agent_string', DEFAULT_USER_AGENT)
  showToast('Requires app restart to take effect')
}
</script>

<template>
  <div class="advanced-settings">
    <section v-for="(group, groupIndex) in groups" :key="groupIndex" class="adv-group-block">
      <h2 v-if="group.title" class="adv-group">{{ group.title }}</h2>
      <ul class="pref-list">
        <li
          v-for="item in group.items"
          :key="item.title"
          v-show="!(item.onlyWhenCustomUserAgent && !customUserAgent)"
        >
          <button
            v-if="item.kind === 'switch'"
            type="button"
            class="pref-row"
            role="switch"
            :aria-checked="item.key ? flags[item.key] : false"
            :aria-label="item.title"
            @click="onItemClick(item)"
          >
            <span class="pref-text">
              <span class="pref-title">{{ item.title }}</span>
              <span v-if="item.subtitle" class="pref-subtitle">{{ item.subtitle }}</span>
            </span>
            <!-- SwitchPreferenceWidget.kt: the switch is decorative, the whole row toggles it. -->
            <span class="pref-widget" aria-hidden="true">
              <span class="md3-switch-track" :class="{ 'is-on': item.key ? flags[item.key] : false }">
                <span class="md3-switch-thumb" />
              </span>
            </span>
          </button>
          <button v-else type="button" class="pref-row" @click="onItemClick(item)">
            <span class="pref-text">
              <span class="pref-title">{{ item.title }}</span>
              <span v-if="item.subtitle" class="pref-subtitle">{{ item.subtitle }}</span>
              <!-- ListPreference/EditTextPreference default subtitle is "%s": the current value. -->
              <span v-if="item.kind === 'list' && item.action === 'doh'" class="pref-subtitle">{{ dohProvider }}</span>
              <span v-if="item.kind === 'list' && item.action === 'installer'" class="pref-subtitle">{{ extensionInstaller }}</span>
              <span v-if="item.kind === 'edit'" class="pref-subtitle">{{ userAgent }}</span>
            </span>
          </button>
        </li>
      </ul>
    </section>
  </div>

  <!-- ListPreferenceWidget.kt: dialog titled with the preference title, radio rows, Cancel. -->
  <v-dialog v-if="listDialog" :model-value="true" max-width="460" @update:model-value="value => { if (!value) listDialog = null }">
    <v-card class="adv-dialog" :aria-label="listDialog.title">
      <v-card-title class="adv-dialog-title">{{ listDialog.title }}</v-card-title>
      <v-card-text class="adv-dialog-body">
        <v-radio-group
          :model-value="listDialog.selected"
          hide-details
          :aria-label="listDialog.title"
          @update:model-value="value => confirmList(String(value))"
        >
          <v-radio
            v-for="entry in listDialog.entries"
            :key="entry.value"
            :label="entry.title"
            :value="entry.value"
            class="adv-dialog-option"
          />
        </v-radio-group>
      </v-card-text>
      <v-card-actions class="adv-dialog-actions">
        <v-spacer />
        <v-btn variant="text" @click="listDialog = null">Cancel</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- EditTextPreferenceWidget.kt: outlined single line field, OK only when the value changed. -->
  <v-dialog v-model="editDialog" max-width="460">
    <v-card class="adv-dialog" aria-label="Default user agent string">
      <v-card-title class="adv-dialog-title">Default user agent string</v-card-title>
      <v-card-text class="adv-dialog-body">
        <v-text-field
          v-model="editValue"
          variant="outlined"
          density="comfortable"
          single-line
          hide-details
          autofocus
          :error="!editValue.trim()"
          aria-label="Default user agent string"
        />
      </v-card-text>
      <v-card-actions class="adv-dialog-actions">
        <v-spacer />
        <v-btn variant="text" @click="editDialog = false">Cancel</v-btn>
        <v-btn variant="text" :disabled="!editValue.trim() || editValue.trim() === userAgent" @click="confirmUserAgent">OK</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Shizuku is not installed in a browser: the reference dialog is reproduced verbatim. -->
  <v-dialog v-model="shizukuOpen" max-width="420">
    <v-card class="adv-dialog" aria-label="Shizuku">
      <v-card-title class="adv-dialog-title">Shizuku</v-card-title>
      <v-card-text class="adv-dialog-body">
        <p class="adv-dialog-text">Install and start Shizuku to use Shizuku as extension installer.</p>
        <p class="adv-dialog-text adv-dialog-text--muted">Shizuku is an Android service and is not available in the web version.</p>
      </v-card-text>
      <v-card-actions class="adv-dialog-actions">
        <v-spacer />
        <v-btn variant="text" @click="shizukuOpen = false">Cancel</v-btn>
        <v-btn variant="text" @click="shizukuOpen = false; openShizukuDownload()">OK</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Stub for the Android-only screens reached from this preference screen. -->
  <v-dialog :model-value="!!stubDialog" max-width="420" @update:model-value="value => { if (!value) stubDialog = '' }">
    <v-card class="adv-dialog" :aria-label="stubDialog ? stubTexts[stubDialog]?.title : ''">
      <v-card-title class="adv-dialog-title">{{ stubDialog ? stubTexts[stubDialog]?.title : '' }}</v-card-title>
      <v-card-text class="adv-dialog-body">
        <p class="adv-dialog-text">{{ stubDialog ? stubTexts[stubDialog]?.message : '' }}</p>
      </v-card-text>
      <v-card-actions class="adv-dialog-actions">
        <v-spacer />
        <v-btn variant="text" @click="stubDialog = ''">Cancel</v-btn>
        <v-btn variant="text" @click="stubDialog = ''; showToast('Not supported in the web version')">OK</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Android toast of the reference, rendered as a small MD3 snackbar. -->
  <div v-if="toast" class="adv-toast" role="status" aria-live="polite">{{ toast }}</div>
</template>

<style scoped>
@layer app-components {
/* BasePreferenceWidget.kt: minHeight 56dp, PrefsHorizontalPadding 16dp, PrefsVerticalPadding 16dp,
   title titleLarge @16sp, subtitle bodySmall @ .78 alpha (SECONDARY_ALPHA in Constants.kt). */
.advanced-settings { display: flex; flex-direction: column; padding-bottom: 12px; }
/* PreferenceScreen.kt: a 12dp spacer after every group, except after the last one. */
.adv-group-block:not(:last-child) { margin-bottom: 12px; }
.pref-list { margin: 0; padding: 0; list-style: none; }
.pref-row { display: flex; align-items: center; width: 100%; min-height: 56px; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: start; cursor: pointer; }
.pref-row:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 4%, transparent); }
.pref-text { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; padding: 16px; }
.pref-title { font-size: 16px; line-height: 24px; font-weight: 500; color: rgb(var(--v-theme-on-surface)); overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.pref-subtitle { font-size: 12px; line-height: 16px; font-weight: 400; color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 78%, transparent); overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 10; }
/* SwitchPreferenceWidget.kt: TrailingWidgetBuffer 16dp before the switch, PrefsHorizontalPadding 16dp after it. */
.pref-widget { display: inline-flex; flex: 0 0 auto; padding-inline: 16px 16px; }
.md3-switch-track { position: relative; display: inline-flex; align-items: center; width: 52px; height: 32px; border-radius: 16px; background: rgb(var(--v-theme-surface-container-highest)); box-shadow: inset 0 0 0 2px rgb(var(--v-theme-outline)); box-sizing: border-box; transition: background-color .2s cubic-bezier(.2, 0, 0, 1), box-shadow .2s cubic-bezier(.2, 0, 0, 1); }
.md3-switch-thumb { position: absolute; left: 8px; top: 8px; width: 16px; height: 16px; border-radius: 50%; background: rgb(var(--v-theme-outline)); transition: transform .2s cubic-bezier(.2, 0, 0, 1), width .15s .05s cubic-bezier(0, 0, .2, 1), height .15s .05s cubic-bezier(0, 0, .2, 1), top .15s .05s cubic-bezier(0, 0, .2, 1), background-color .2s cubic-bezier(.2, 0, 0, 1); }
.md3-switch-track.is-on { background: rgb(var(--v-theme-primary)); box-shadow: inset 0 0 0 2px transparent; }
.md3-switch-track.is-on .md3-switch-thumb { width: 24px; height: 24px; top: 4px; transform: translateX(16px); background: rgb(var(--v-theme-on-primary)); }
/* PreferenceGroupHeader.kt: bodyMedium in colorScheme.secondary, padding(top 14dp, bottom 8dp, horizontal 16dp). */
.adv-group { margin: 0; padding: 14px 16px 8px; font-size: 14px; line-height: 20px; font-weight: 500; color: rgb(var(--v-theme-secondary)); }

/* MD3 dialog (Material3 AlertDialog): 28dp corner radius, 24sp title, 16sp body text. */
.adv-dialog { border-radius: 28px !important; }
.adv-dialog-title { font-size: 24px !important; line-height: 32px !important; font-weight: 400 !important; padding: 24px 24px 16px !important; }
.adv-dialog-body { padding: 0 8px 16px !important; }
.adv-dialog-text { margin: 0 16px 8px; font-size: 16px; line-height: 24px; color: rgb(var(--v-theme-on-surface-variant)); }
.adv-dialog-text--muted { font-size: 14px; line-height: 20px; }
.adv-dialog-option { flex: 1 1 100%; min-height: 48px; }
.adv-dialog-actions { padding: 8px 16px 16px !important; }

/* Android toast: inverse surface panel with 4dp radius. */
.adv-toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 2400; max-width: min(560px, calc(100vw - 32px)); padding: 14px 16px; border-radius: 4px; background: rgb(var(--v-theme-inverse-surface)); color: rgb(var(--v-theme-inverse-on-surface)); font-size: 14px; line-height: 20px; box-shadow: 0 2px 6px rgba(0, 0, 0, .28); }
}
</style>
