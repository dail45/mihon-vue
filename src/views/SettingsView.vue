<script setup lang="ts">
/**
 * Settings main screen — pixel-perfect port of Mihon (Compose).
 *
 * References:
 * - `mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsMainScreen.kt`
 * - `mihon/app/src/main/java/eu/kanade/tachiyomi/ui/setting/SettingsScreen.kt`
 * - `mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/TwoPanelBox.kt`
 * - `mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt` (TopAppBar, UpIcon, PlainTooltip)
 * - `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/BasePreferenceWidget.kt`
 * - `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/TextPreferenceWidget.kt`
 *
 * Reference behaviors:
 * 1. Single pane (mobile):
 *    - Main `/settings` route renders SettingsMainScreen with 64dp TopAppBar (title "Settings",
 *      "Navigate up" ArrowBack leading back to `/more`, "Search" action leading to `/settings/search`).
 *    - Tapping a section pushes that screen into view with its own 64dp TopAppBar (title = section title,
 *      "Navigate up" ArrowBack leading back to `/settings`).
 * 2. Two pane (tablet/desktop, when `isTabletUi()` and `width >= 600`):
 *    - Uses TwoPanelBox: startContent has width `(width / 2).coerceAtMost(450.dp)`, endContent has the rest.
 *    - Left pane has `getPalerSurface()` background (lightness -5% in dark / +2% in light).
 *    - Left pane TopAppBar: 64dp, paler surface background, "Navigate up" (to `/more`), title "Settings", Search.
 *    - Left pane items: clipped to RoundedCornerShape(24.dp) with 8dp horizontal margin.
 *      Selected item has `surfaceVariant` background and `onSurfaceVariant` text color.
 *    - Right pane has standard `surface` background, 64dp TopAppBar with section title and NO back button.
 */
import { computed, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useRoute, useRouter } from 'vue-router'
import { appChannel, appVersion } from '../constants/appInfo'
import { usePreferenceHighlight } from '../composables/usePreferenceHighlight'
import { useTabletUi } from '../composables/useTabletUi'
import { usePreferencesStore } from '../stores/preferences'
import { useSuwayomiStore } from '../stores/suwayomi'
import ReaderSettingsScreen from '../components/settings/ReaderSettingsScreen.vue'
import SettingsDataScreen from '../components/settings/SettingsDataScreen.vue'
import SettingsDownloadScreen from '../components/settings/SettingsDownloadScreen.vue'
import SettingsTrackingScreen from '../components/settings/SettingsTrackingScreen.vue'
import SettingsBrowseScreen from '../components/settings/SettingsBrowseScreen.vue'
import ServerSettingsDialog from '../components/ServerSettingsDialog.vue'
import ServerConfiguration from '../components/ServerConfiguration.vue'
import SettingsSecurityScreen from '../components/settings/SettingsSecurityScreen.vue'
import AboutView from './AboutView.vue'
import SettingsAdvancedView from './SettingsAdvancedView.vue'
import SettingsAppearanceView from './SettingsAppearanceView.vue'
import SettingsLibraryView from './SettingsLibraryView.vue'
import { t, MR } from '../i18n'

const route = useRoute()
const router = useRouter()
const server = useSuwayomiStore()
const preferences = usePreferencesStore()
const connectionOpen = ref(false)
const tablet = useTabletUi()
const { width } = useDisplay()

// TwoPanelBox layout: active when tablet UI mode is 'always' OR when tablet UI is enabled and window width >= 600px.
const twoPane = computed(() => preferences.tabletUiMode === 'always' || (tablet.value && width.value >= 600))
// Default selected section in two-pane mode is Appearance (SettingsScreen.kt: else -> SettingsAppearanceScreen).
const section = computed(() => String(route.meta.settingsSection || (twoPane.value ? 'appearance' : 'main')))

export interface SettingsSectionItem {
  title: string
  subtitle: string
  icon: string
  section: string
}

// SettingsMainScreen.kt `items`: exact reference order, titles (MR.strings), subtitles, and icons.
const items = computed<SettingsSectionItem[]>(() => [
  { title: 'Appearance', subtitle: 'Theme, date & time format', icon: 'palette', section: 'appearance' },
  { title: 'Library', subtitle: 'Categories, global update, chapter swipe', icon: 'collections_bookmark', section: 'library' },
  { title: 'Reader', subtitle: 'Reading mode, display, navigation', icon: 'chrome_reader_mode', section: 'reader' },
  { title: 'Downloads', subtitle: 'Automatic download, download ahead', icon: 'download', section: 'downloads' },
  { title: 'Tracking', subtitle: 'One-way progress sync, enhanced sync', icon: 'sync', section: 'tracking' },
  { title: 'Browse', subtitle: 'Sources, extensions, global search', icon: 'explore', section: 'browse' },
  { title: 'Data and storage', subtitle: 'Manual & automatic backups, storage space', icon: 'storage', section: 'data' },
  { title: 'Security and privacy', subtitle: 'App lock, secure screen', icon: 'security', section: 'security' },
  { title: 'Advanced', subtitle: 'Dump crash logs, battery optimizations', icon: 'code', section: 'advanced' },
  { title: 'About', subtitle: `Mihon ${appChannel} ${appVersion}`, icon: 'info', section: 'about' },
  // Web-specific: The Suwayomi server address has no Mihon counterpart; reachable as the server configuration section.
  { title: 'Server connection', subtitle: 'Suwayomi address and server configuration', icon: 'dns', section: 'connection' },
])

const SECTION_STRING_MAP: Record<string, { title: string; subtitle?: string }> = {
  appearance: { title: 'pref_category_appearance', subtitle: 'pref_appearance_summary' },
  library: { title: 'pref_category_library', subtitle: 'pref_library_summary' },
  reader: { title: 'pref_category_reader', subtitle: 'pref_reader_summary' },
  downloads: { title: 'pref_category_downloads', subtitle: 'pref_downloads_summary' },
  tracking: { title: 'pref_category_tracking', subtitle: 'pref_tracking_summary' },
  browse: { title: 'browse', subtitle: 'pref_browse_summary' },
  data: { title: 'label_data_storage', subtitle: 'pref_data_summary' },
  security: { title: 'pref_category_security', subtitle: 'pref_security_summary' },
  advanced: { title: 'pref_category_advanced', subtitle: 'pref_advanced_summary' },
  about: { title: 'pref_category_about' },
}

function getItemTitle(item: SettingsSectionItem): string {
  const meta = SECTION_STRING_MAP[item.section]
  if (meta) {
    const val = t(meta.title)
    if (val && val !== meta.title) return val
  }
  return item.title
}

function getItemSubtitle(item: SettingsSectionItem): string {
  const meta = SECTION_STRING_MAP[item.section]
  if (meta?.subtitle) {
    const val = t(meta.subtitle)
    if (val && val !== meta.subtitle) return val
  }
  return item.subtitle
}

const selectedItem = computed(() => items.value.find(i => i.section === section.value))
const currentDetailTitle = computed(() => {
  if (section.value === 'connection') return 'Server connection'
  if (selectedItem.value) return getItemTitle(selectedItem.value)
  return (route.meta.title as string) || 'Settings'
})

function navigateUpMain() {
  void router.push('/more')
}

function navigateUpDetail() {
  void router.push('/settings')
}

function openSearch() {
  void router.push('/settings/search')
}

// Mihon highlights the preference a search result points at (`SearchableSettings.highlightKey`).
usePreferenceHighlight('.settings-detail-scroll, .settings-detail')

const detailScrollEl = ref<HTMLElement | null>(null)
watch(section, () => {
  if (detailScrollEl.value) {
    detailScrollEl.value.scrollTop = 0
  }
})
</script>

<template>
  <div class="settings-layout" :class="{ 'settings-two-pane': twoPane }">
    <!-- Navigation pane: visible in two-pane mode OR on main /settings route in single-pane mode -->
    <nav v-if="twoPane || section === 'main'" class="settings-navigation" aria-label="Settings sections">
      <!-- TopAppBar for SettingsMainScreen (Mihon: AppBar(title = stringResource(MR.strings.label_settings), navigateUp = backPress, actions = Search)) -->
      <header class="settings-top-app-bar settings-top-app-bar--nav">
        <button
          type="button"
          class="settings-icon-btn"
          aria-label="Navigate up"
          title="Navigate up"
          @click="navigateUpMain"
        >
          <v-icon icon="arrow_back" size="24" />
          <v-tooltip activator="parent" location="bottom">Navigate up</v-tooltip>
        </button>
        <h1 class="settings-top-app-bar__title">{{ t(MR.strings.label_settings) || 'Settings' }}</h1>
        <button
          type="button"
          class="settings-icon-btn"
          aria-label="Search"
          title="Search"
          @click="openSearch"
        >
          <v-icon icon="search" size="24" />
          <v-tooltip activator="parent" location="bottom">Search</v-tooltip>
        </button>
      </header>

      <!-- LazyColumn of settings categories -->
      <div class="settings-list-wrap">
        <ul class="pref-list" role="list">
          <li v-for="item in items" :key="item.section">
            <router-link
              class="pref-row"
              :class="{ 'is-selected': twoPane && section === item.section }"
              :to="`/settings/${item.section}`"
            >
              <span class="pref-icon" aria-hidden="true"><v-icon :icon="item.icon" size="24" /></span>
              <span class="pref-text">
                <span class="pref-title">{{ getItemTitle(item) }}</span>
                <span class="pref-subtitle">{{ getItemSubtitle(item) }}</span>
              </span>
            </router-link>
          </li>
        </ul>
      </div>
    </nav>

    <!-- Detail pane: visible in two-pane mode OR on sub-routes in single-pane mode -->
    <section v-if="section !== 'main'" class="settings-detail" :aria-label="currentDetailTitle">
      <!-- TopAppBar for detail pane: on single-pane it has Navigate up back to /settings; in two-pane it has no back button -->
      <header class="settings-top-app-bar settings-top-app-bar--detail">
        <button
          v-if="!twoPane"
          type="button"
          class="settings-icon-btn"
          aria-label="Navigate up"
          title="Navigate up"
          @click="navigateUpDetail"
        >
          <v-icon icon="arrow_back" size="24" />
          <v-tooltip activator="parent" location="bottom">Navigate up</v-tooltip>
        </button>
        <h2 class="settings-top-app-bar__title" :class="{ 'settings-top-app-bar__title--detail-twopane': twoPane }">
          {{ currentDetailTitle }}
        </h2>
      </header>

      <!-- Scrollable content area for the selected settings screen -->
      <div ref="detailScrollEl" class="settings-detail-scroll">
        <!-- SettingsAppearanceScreen.kt (Mihon 446f6df): the whole "Appearance" preference screen -->
        <SettingsAppearanceView v-if="section === 'appearance'" />

        <!-- SettingsLibraryScreen.kt: full library preference tree -->
        <SettingsLibraryView v-else-if="section === 'library'" />

        <!-- SettingsReaderScreen.kt (Mihon 446f6df): full reader preference tree -->
        <template v-else-if="section === 'reader'">
          <ReaderSettingsScreen />
        </template>

        <!-- SettingsDownloadScreen.kt (Mihon 446f6df): the whole "Downloads" preference screen -->
        <SettingsDownloadScreen v-else-if="section === 'downloads'" />

        <!-- SettingsTrackingScreen.kt (Mihon 446f6df): the whole "Tracking" preference screen -->
        <SettingsTrackingScreen v-else-if="section === 'tracking'" />

        <!-- SettingsBrowseScreen.kt (Mihon 446f6df): the whole "Browse" preference screen -->
        <SettingsBrowseScreen v-else-if="section === 'browse'" />

        <!-- SettingsDataScreen.kt: data and storage preference screen -->
        <SettingsDataScreen v-else-if="section === 'data'" />

        <!-- SettingsSecurityScreen.kt: security and privacy preference screen -->
        <template v-else-if="section === 'security'">
          <SettingsSecurityScreen />
        </template>

        <!-- SettingsAdvancedScreen.kt: the whole "Advanced" preference screen -->
        <SettingsAdvancedView v-else-if="section === 'advanced'" />

        <!-- AboutScreen.kt: about app information -->
        <AboutView v-else-if="section === 'about'" :standalone="false" />

        <!-- Server connection (web-specific) -->
        <template v-else-if="section === 'connection'">
          <div class="settings-connection-section">
            <h3 class="settings-heading">Connection</h3>
            <v-list-item
              title="Suwayomi-Server"
              :subtitle="server.apiUrl"
              prepend-icon="dns"
              min-height="72"
              @click="connectionOpen = true"
            />
            <div class="px-6 py-2">
              <v-btn color="primary" variant="tonal" @click="connectionOpen = true">
                Change server address
              </v-btn>
            </div>
            <p class="settings-note">
              Changing the address changes this browser's connection only. It does not reconfigure the server's listening address.
            </p>
            <v-divider class="my-4" />
            <ServerConfiguration :api-url="server.apiUrl" />
          </div>
        </template>
      </div>
    </section>
  </div>
  <ServerSettingsDialog v-model="connectionOpen" />
</template>

<style scoped>
@layer app-components {
.settings-layout {
  width: 100%;
  height: 100%;
  flex: 1 1 auto;
  min-height: 0;
  background: rgb(var(--v-theme-surface));
  box-sizing: border-box;
}

.settings-layout:not(.settings-two-pane) {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

/* TwoPanelBox.kt: firstWidth = (width / 2).coerceAtMost(450.dp) */
.settings-two-pane {
  max-width: none;
  display: grid;
  grid-template-columns: min(50%, 450px) 1fr;
  height: 100dvh;
  max-height: 100dvh;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
}

.settings-navigation {
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
}

/* SettingsMainScreen.getPalerSurface(): surface lightness -5% (dark) / +2% (light) */
.settings-two-pane .settings-navigation {
  border-right: 1px solid rgb(var(--v-theme-outline-variant), 0.5);
  background: #ffffff;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.v-theme--mihonDark .settings-two-pane .settings-navigation,
:root[data-theme='dark'] .settings-two-pane .settings-navigation {
  background: #0f0f11;
}

/* Left navigation pane: independent scrolling with hidden scrollbar track/thumb in two-pane */
.settings-list-wrap {
  padding-bottom: 24px;
}

.settings-two-pane .settings-list-wrap {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

.settings-detail {
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
}

.settings-two-pane .settings-detail {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.settings-detail-scroll {
  padding-block: 8px 32px;
}

/* Right detail pane: independent scrolling with Android Material 3 scrollbar styling
   (4dp pill thumb, onSurface 36.4% alpha, transparent track, interactive states) */
.settings-two-pane .settings-detail-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 36.4%, transparent) transparent;

  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 36.4%, transparent);
    border-radius: 9999px;
    border: 2px solid transparent;
    background-clip: padding-box;
    transition: background-color 0.2s ease;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 60%, transparent);
    background-clip: padding-box;
  }
  &::-webkit-scrollbar-thumb:active {
    background: rgb(var(--v-theme-primary));
    background-clip: padding-box;
  }
}

/* TopAppBar (AppBar.kt): height 64dp, surface container (or paler surface in two-pane nav) */
.settings-top-app-bar {
  display: flex;
  align-items: center;
  height: 64px;
  min-height: 64px;
  padding: 0 4px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  box-sizing: border-box;
  z-index: 2;
  flex-shrink: 0;
  position: sticky;
  top: 0;
}

.settings-two-pane .settings-top-app-bar--nav {
  background: #ffffff;
}
.v-theme--mihonDark .settings-two-pane .settings-top-app-bar--nav,
:root[data-theme='dark'] .settings-two-pane .settings-top-app-bar--nav {
  background: #0f0f11;
}

.settings-top-app-bar__title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 0 12px;
  font-family: inherit;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-top-app-bar__title--detail-twopane {
  padding-left: 16px;
}

/* Material 3 IconButton: 48x48dp touch area, 40dp circle ripple layer, 24dp icon */
.settings-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  min-width: 48px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 9999px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  position: relative;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}
.settings-icon-btn::before {
  content: '';
  position: absolute;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0;
  transition: opacity 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.settings-icon-btn:hover::before {
  opacity: 0.08;
}
.settings-icon-btn:active::before {
  opacity: 0.12;
}
.settings-icon-btn:focus-visible::before {
  opacity: 0.12;
}

/* BasePreferenceWidget.kt: minHeight 56dp, PrefsHorizontalPadding 16dp, PrefsVerticalPadding 16dp,
   icon Box padding(start = 16dp, end = 8dp), title titleLarge @16sp, subtitle bodySmall @ .78 alpha. */
.pref-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.pref-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 56px;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  text-align: start;
  cursor: pointer;
  text-decoration: none;
  box-sizing: border-box;
  position: relative;
  transition: background-color 0.15s cubic-bezier(0.2, 0, 0, 1), color 0.15s cubic-bezier(0.2, 0, 0, 1);
}
.pref-row:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.pref-row:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.pref-row:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
.pref-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding-inline: 16px 8px;
  color: rgb(var(--v-theme-primary));
}
.pref-text {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  padding-block: 16px;
  padding-inline: 16px;
}
.pref-title {
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  color: inherit;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.pref-subtitle {
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  color: color-mix(in srgb, currentColor 78%, transparent);
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 10;
}

/* Two-pane: every row is clipped to RoundedCornerShape(24.dp) with 8dp horizontal padding;
   the selected row paints surfaceVariant and switches the content colour to onSurfaceVariant. */
.settings-two-pane .pref-row {
  border-radius: 24px;
  margin-inline: 8px;
  width: calc(100% - 16px);
}
.settings-two-pane .pref-row.is-selected {
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface-variant));
}
.settings-two-pane .pref-row.is-selected .pref-title {
  color: rgb(var(--v-theme-on-surface-variant));
}
.settings-two-pane .pref-row.is-selected .pref-subtitle {
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface-variant)) 78%, transparent);
}
.settings-two-pane .pref-row.is-selected .pref-icon {
  color: rgb(var(--v-theme-primary));
}

.settings-heading {
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  color: rgb(var(--v-theme-secondary));
  padding: 14px 16px 8px;
  margin: 0;
}
.settings-note {
  font-size: 12px;
  line-height: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
  padding: 8px 16px;
  margin: 0;
}
.settings-connection-section {
  padding-bottom: 24px;
}
}
</style>
