<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { useRoute } from 'vue-router'
import { useTabletUi } from '../composables/useTabletUi'
import { usePreferencesStore } from '../stores/preferences'
import { useReaderPreferences } from '../stores/readerPreferences'
import { useSuwayomiStore } from '../stores/suwayomi'
import LibraryDisplaySettings from '../components/LibraryDisplaySettings.vue'
import PreferenceCheckbox from '../components/PreferenceCheckbox.vue'
import PreferenceChoice from '../components/PreferenceChoice.vue'
import ServerSettingsDialog from '../components/ServerSettingsDialog.vue'
import ServerConfiguration from '../components/ServerConfiguration.vue'
import AboutView from './AboutView.vue'
const route = useRoute(), preferences = usePreferencesStore(), reader = useReaderPreferences(), server = useSuwayomiStore(), connectionOpen = ref(false), tablet = useTabletUi(), search = ref('')
const { width } = useDisplay()
// Forced tablet mode still uses tablet navigation/sheets on narrow windows; two readable settings panes need 600px.
const twoPane = computed(() => tablet.value && width.value >= 600)
const section = computed(() => String(route.meta.settingsSection || (twoPane.value ? 'appearance' : 'main')))
const items = [
  { title: 'Appearance', subtitle: 'Theme and display', icon: 'palette', section: 'appearance' },
  { title: 'Library', subtitle: 'Categories, display and updates', icon: 'collections_bookmark', section: 'library' },
  { title: 'Reader', subtitle: 'Reading mode and progress', icon: 'chrome_reader_mode', section: 'reader' },
  { title: 'Downloads', subtitle: 'Download preferences', icon: 'download', section: 'downloads' },
  { title: 'Tracking', subtitle: 'Services and synchronization', icon: 'sync', section: 'tracking' },
  { title: 'Browse', subtitle: 'Sources and extensions', icon: 'explore', section: 'browse' },
  { title: 'Data & storage', subtitle: 'Backups and storage', icon: 'storage', section: 'data' },
  { title: 'Security', subtitle: 'Access and privacy', icon: 'security', section: 'security' },
  { title: 'Advanced', subtitle: 'Diagnostics and network', icon: 'code', section: 'advanced' },
  { title: 'About', subtitle: 'Version, references and attribution', icon: 'info', section: 'about' },
  { title: 'Server connection', subtitle: 'Suwayomi address and server configuration', icon: 'dns', section: 'connection' },
]
const visibleItems = computed(() => items.filter(i => `${i.title} ${i.subtitle}`.toLowerCase().includes(search.value.toLowerCase())))
const modes = [{ title: 'Left to right', value: 'ltr' }, { title: 'Right to left', value: 'rtl' }, { title: 'Webtoon · vertical scroll', value: 'webtoon' }]
const tabletModes = [{ title: 'Automatic', value: 'automatic' }, { title: 'Always', value: 'always' }, { title: 'Landscape only', value: 'landscape' }, { title: 'Never', value: 'never' }]
</script>
<template>
  <div class="settings-layout" :class="{ 'settings-two-pane': twoPane }">
    <nav v-if="twoPane || section === 'main'" class="settings-navigation" aria-label="Settings sections">
      <v-text-field v-model="search" placeholder="Search settings" aria-label="Search settings" prepend-inner-icon="search" hide-details variant="solo" flat class="ma-2" />
      <v-list bg-color="transparent" class="py-0"><v-list-item v-for="item in visibleItems" :key="item.section" :title="item.title" :subtitle="item.subtitle" :prepend-icon="item.icon" :to="`/settings/${item.section}`" :active="twoPane && section === item.section" min-height="72" rounded="xl" class="mx-2" /></v-list>
    </nav>
    <section v-if="section !== 'main'" class="settings-detail" :aria-label="items.find(i => i.section === section)?.title">
      <h1 v-if="twoPane" class="text-title-large pa-6">{{ items.find(i => i.section === section)?.title }}</h1>
      <template v-if="section === 'appearance'">
        <h2 class="settings-heading">Theme</h2>
        <div class="theme-mode-options px-6 pb-4" role="group" aria-label="App theme"><v-btn v-for="mode in [{ value: 'system', title: 'System default' }, { value: 'light', title: 'Light' }, { value: 'dark', title: 'Dark' }]" :key="mode.value" :variant="preferences.themeMode === mode.value ? 'tonal' : 'outlined'" :color="preferences.themeMode === mode.value ? 'primary' : undefined" :aria-pressed="preferences.themeMode === mode.value" @click="preferences.themeMode = mode.value as typeof preferences.themeMode">{{ mode.title }}</v-btn></div>
        <p class="settings-note">The default Mihon palette is used. Android dynamic color and additional palettes are not implemented.</p>
        <v-divider class="my-4" /><h2 class="settings-heading">Display</h2>
        <PreferenceChoice v-model="preferences.tabletUiMode" title="Tablet UI" :items="tabletModes" />
        <p class="settings-note">Applies immediately to navigation, settings panes and sheets. Automatic follows Mihon's orientation thresholds using CSS viewport dimensions, not Android density units.</p>
        <v-list-item title="App language" subtitle="English · translations are not implemented" min-height="72" disabled />
        <v-list-item title="Date format" subtitle="Locale default · custom date formats are not implemented" min-height="72" disabled />
      </template>
      <template v-else-if="section === 'library'">
        <h2 class="settings-heading">Categories</h2><v-list-item title="Categories" subtitle="View categories from Suwayomi" to="/categories" min-height="72" />
        <v-divider class="my-4" /><h2 class="settings-heading">Display</h2><LibraryDisplaySettings />
        <v-divider class="my-4" /><PreferenceCheckbox v-model="preferences.categorizedSort" label="Per-category sorting" /><p class="settings-note">When disabled, the chosen sort applies to every category. These preferences are saved in this browser.</p>
        <h2 class="settings-heading">Library updates</h2><v-list-item title="Server update preferences" subtitle="Configure update interval and parallel sources" to="/settings/connection" min-height="72" />
      </template>
      <template v-else-if="section === 'reader'">
        <h2 class="settings-heading">Reading</h2>
        <PreferenceChoice v-model="reader.mode" title="Reading mode" :items="modes" />
        <PreferenceChoice v-model="reader.fit" title="Image scale" :items="[{ title: 'Fit entire page', value: 'page' }, { title: 'Fit width', value: 'width' }]" :disabled="reader.mode === 'webtoon'" />
        <PreferenceChoice v-model="reader.background" title="Reader background" :items="[{ title: 'Black', value: 'black' }, { title: 'Dark gray', value: 'gray' }, { title: 'Paper', value: 'paper' }]" />
        <v-divider class="my-4" /><h2 class="settings-heading">Reading progress</h2><v-switch v-model="reader.saveProgress" label="Automatically save reading progress" color="primary" hide-details class="px-6" /><p class="settings-note">Off by default. Only displayed, loaded pages are saved to Suwayomi. The final page marks the chapter as read. Legacy REST versions may not return saved progress reliably.</p>
      </template>
      <template v-else-if="section === 'downloads'">
        <h2 class="settings-heading">Downloads</h2><v-list-item title="Server download preferences" subtitle="CBZ format, automatic downloads and reuploads" to="/settings/connection" min-height="72" /><v-list-item title="Download location" subtitle="Managed by Suwayomi, not browser storage" min-height="72" disabled /><p class="settings-note">Android-only scheduling and download notifications are not implemented in this web client. Server download preferences are available in the server section.</p>
      </template>
      <template v-else-if="section === 'tracking'">
        <h2 class="settings-heading">Services</h2><v-list-item title="Tracking services" subtitle="Tracker login and synchronization are not implemented in this client" min-height="72" disabled /><p class="settings-note">No decorative switches or login fields are provided. Existing server tracking data is not modified.</p>
      </template>
      <template v-else-if="section === 'browse'">
        <h2 class="settings-heading">Sources</h2><v-list-item title="Installed sources" subtitle="Browse sources installed on Suwayomi" to="/browse" min-height="72" /><v-list-item title="Extension repositories" subtitle="Extension management is not implemented in this client" min-height="72" disabled /><h2 class="settings-heading">Extensions</h2><v-list-item title="Allowed content warnings" subtitle="Android extension warning preferences are not integrated" min-height="72" disabled />
      </template>
      <template v-else-if="section === 'data'">
        <h2 class="settings-heading">Storage</h2><v-list-item title="Storage location" subtitle="Manga and downloads remain on Suwayomi" min-height="72" disabled /><h2 class="settings-heading">Backup</h2><v-list-item title="Create / restore backup" subtitle="Server backup operations are not integrated yet" min-height="72" disabled /><h2 class="settings-heading">Storage usage</h2><v-list-item title="Clear chapter cache" subtitle="No local manga database; server cache deletion is not integrated" min-height="72" disabled />
      </template>
      <template v-else-if="section === 'security'">
        <h2 class="settings-heading">Security</h2><v-list-item title="Lock with biometrics" subtitle="Android application lock is not available in this web client" min-height="72" disabled /><v-list-item title="Secure screen" subtitle="Web pages cannot enforce Android screenshot protection" min-height="72" disabled /><p class="settings-note">Access is controlled by your Suwayomi deployment and browser session. This client does not fetch or edit server passwords.</p>
      </template>
      <template v-else-if="section === 'advanced'">
        <h2 class="settings-heading">Network</h2><v-list-item title="Server connection" subtitle="Address and server configuration" to="/settings/connection" min-height="72" /><v-list-item title="DNS over HTTPS" subtitle="Controlled by your browser or server; no client override" min-height="72" disabled /><h2 class="settings-heading">Data</h2><v-list-item title="Clear database" subtitle="Server database deletion is not implemented" min-height="72" disabled /><h2 class="settings-heading">Diagnostics</h2><v-list-item title="Version and references" subtitle="Client version, source revisions and licenses" to="/settings/about" min-height="72" />
      </template>
      <AboutView v-else-if="section === 'about'" />
      <template v-else-if="section === 'connection'">
        <h2 class="settings-heading">Connection</h2><v-list-item title="Suwayomi-Server" :subtitle="server.apiUrl" prepend-icon="dns" min-height="72" @click="connectionOpen = true" /><div class="px-6 py-2"><v-btn color="primary" variant="tonal" @click="connectionOpen = true">Change server address</v-btn></div><p class="settings-note">Changing the address changes this browser's connection only. It does not reconfigure the server's listening address.</p><v-divider class="my-4" /><ServerConfiguration :api-url="server.apiUrl" />
      </template>
    </section>
  </div>
  <ServerSettingsDialog v-model="connectionOpen" />
</template>
<style scoped>
@layer app-components {
.settings-layout { max-width: 760px; margin: auto; }
.settings-navigation { min-width: 0; }
.settings-detail { min-width: 0; padding-block: 8px 32px; }
.settings-two-pane { max-width: 1200px; display: grid; grid-template-columns: minmax(0, 320px) minmax(0, 1fr); min-height: calc(100dvh - 64px); }
.settings-two-pane .settings-navigation { border-right: 1px solid rgb(var(--v-theme-outline-variant)); }
.settings-two-pane .settings-detail { background: rgb(var(--v-theme-surface-container-low)); }
.theme-mode-options { display: flex; gap: 8px; flex-wrap: wrap; }

}
</style>
