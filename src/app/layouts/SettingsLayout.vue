<script setup lang="ts">
/**
 * SettingsLayout — adaptive TwoPanelBox master-detail layout for settings.
 *
 * References:
 * - mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsMainScreen.kt
 * - mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/TwoPanelBox.kt
 *
 * Behaviors:
 * - In two-pane mode (desktop/tablet, width >= 600 or tabletUiMode === 'always'):
 *   Start pane (width <= 450px) renders settings navigation list.
 *   End pane renders detail content via `<slot><router-view /></slot>`.
 * - In single-pane mode (mobile):
 *   When route is `/settings` (main), renders settings navigation list.
 *   When route is a sub-screen, renders detail pane with `<slot><router-view /></slot>`.
 */
import { computed, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useRoute, useRouter } from 'vue-router'
import { appChannel, appVersion } from '@/constants/appInfo'
import { useTabletUi } from '@/core/composables/useTabletUi'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import { usePreferenceHighlight } from '@/core/composables/usePreferenceHighlight'
import { t, MR } from '@/core/i18n'

const route = useRoute()
const router = useRouter()
const preferences = usePreferencesStore()
const tablet = useTabletUi()
const { width } = useDisplay()

// TwoPanelBox layout: active when tablet UI mode is 'always' OR when tablet UI is enabled and window width >= 600px.
const twoPane = computed(() => preferences.tabletUiMode === 'always' || (tablet.value && width.value >= 600))
const section = computed(() => String(route.meta.settingsSection || (route.path === '/settings' && !twoPane.value ? 'main' : (route.path.split('/')[2] || 'appearance'))))

const activeSubScreen = ref<string | null>(null)
const subSection = computed(() => (route.meta.subSection as string) || activeSubScreen.value || null)
const isSubScreen = computed(() => !!subSection.value)

export interface SettingsSectionItem {
  title: string
  subtitle: string
  icon: string
  section: string
}

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
  if (subSection.value === 'language') {
    const val = t(MR.strings.pref_app_language)
    return (val && val !== 'pref_app_language') ? val : 'App language'
  }
  if (subSection.value === 'categories') {
    const val = t(MR.strings.action_edit_categories)
    return (val && val !== 'action_edit_categories') ? val : 'Edit categories'
  }
  if (subSection.value === 'stores') {
    const val = t('extensionStores')
    return (val && val !== 'extensionStores') ? val : 'Extension stores'
  }
  if (subSection.value === 'create-backup') {
    const val = t(MR.strings.pref_create_backup)
    return (val && val !== 'pref_create_backup') ? val : 'Create backup'
  }
  if (subSection.value === 'restore-backup') {
    const val = t(MR.strings.pref_restore_backup)
    return (val && val !== 'pref_restore_backup') ? val : 'Restore backup'
  }
  if (subSection.value === 'clear-database') {
    const val = t(MR.strings.pref_clear_database)
    return (val && val !== 'pref_clear_database') ? val : 'Clear database'
  }
  if (subSection.value === 'debug') {
    const val = t(MR.strings.pref_debug_info)
    return (val && val !== 'pref_debug_info') ? val : 'Debug information'
  }
  if (subSection.value === 'licenses') {
    const val = t(MR.strings.licenses)
    return (val && val !== 'licenses') ? val : 'Open source licenses'
  }
  if (section.value === 'connection') return 'Server connection'
  if (selectedItem.value) return getItemTitle(selectedItem.value)
  return (route.meta.title as string) || 'Settings'
})

function navigateUpMain() {
  void router.push('/more')
}

function navigateUpDetail() {
  if (isSubScreen.value) {
    activeSubScreen.value = null
    if (route.meta.subSection) {
      void router.push(`/settings/${section.value}`)
    }
  } else {
    void router.push('/settings')
  }
}

function openSearch() {
  void router.push('/settings/search')
}

usePreferenceHighlight('.settings-detail-scroll, .settings-detail')

const detailScrollEl = ref<HTMLElement | null>(null)
watch(section, () => {
  activeSubScreen.value = null
})
watch([section, subSection], () => {
  if (detailScrollEl.value) {
    detailScrollEl.value.scrollTop = 0
  }
})
</script>

<template>
  <div class="settings-layout" :class="{ 'settings-two-pane': twoPane }">
    <!-- Navigation pane: visible in two-pane mode OR on main /settings route in single-pane mode -->
    <nav v-if="twoPane || section === 'main'" class="settings-navigation" aria-label="Settings sections">
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
      <header class="settings-top-app-bar settings-top-app-bar--detail">
        <button
          v-if="!twoPane || isSubScreen"
          type="button"
          class="settings-icon-btn"
          aria-label="Navigate up"
          title="Navigate up"
          @click="navigateUpDetail"
        >
          <v-icon icon="arrow_back" size="24" />
          <v-tooltip activator="parent" location="bottom">Navigate up</v-tooltip>
        </button>
        <h2 class="settings-top-app-bar__title" :class="{ 'settings-top-app-bar__title--detail-twopane': twoPane && !isSubScreen }">
          {{ currentDetailTitle }}
        </h2>
        <slot name="header-actions" />
      </header>

      <div ref="detailScrollEl" class="settings-detail-scroll">
        <slot>
          <router-view />
        </slot>
      </div>
    </section>
  </div>
</template>

<style scoped>
@layer app-components {
.settings-layout {
  width: 100%;
  height: 100%;
  flex: 1 1 auto;
  min-height: 0;
  background: rgb(var(--v-theme-surface));
  display: flex;
  flex-direction: column;
}

.settings-two-pane {
  display: grid;
  grid-template-columns: min(50%, 450px) 1fr;
  height: 100%;
  overflow: hidden;
}

.settings-navigation {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--v-theme-paler-surface, #ffffff);
  border-right: 1px solid rgba(var(--v-theme-outline-variant), 0.2);
}

:root[data-theme='dark'] .settings-navigation {
  background: var(--v-theme-paler-surface, #0f0f11);
}

:root[data-amoled='true'] .settings-two-pane .settings-navigation {
  background: #000000;
}

.settings-top-app-bar {
  height: 64px;
  min-height: 64px;
  display: flex;
  align-items: center;
  padding: 0 4px;
  background: rgb(var(--v-theme-surface));
  z-index: 2;
}

.settings-top-app-bar--nav {
  background: var(--v-theme-paler-surface, #ffffff);
}

:root[data-theme='dark'] .settings-top-app-bar--nav {
  background: var(--v-theme-paler-surface, #0f0f11);
}

:root[data-amoled='true'] .settings-two-pane .settings-top-app-bar--nav {
  background: #000000;
}

.settings-top-app-bar__title {
  flex: 1;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  margin: 0;
  padding: 0 12px;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.settings-top-app-bar__title--detail-twopane {
  padding-left: 24px;
}

.settings-icon-btn {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  border-radius: 50%;
  cursor: pointer;
  position: relative;
}

.settings-icon-btn::before {
  content: '';
  position: absolute;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.settings-icon-btn:hover::before {
  opacity: 0.08;
}

.settings-icon-btn:active::before {
  opacity: 0.12;
}

.settings-list-wrap {
  flex: 1;
  overflow-y: auto;
}

.pref-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.pref-row {
  display: flex;
  align-items: center;
  min-height: 56px;
  text-decoration: none;
  color: rgb(var(--v-theme-on-surface));
  transition: background-color 0.2s ease;
}

.settings-two-pane .pref-row {
  border-radius: 24px;
  margin-inline: 8px;
}

.settings-two-pane .pref-row.is-selected {
  background: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface-variant));
}

.pref-row:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.pref-row:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}

.pref-icon {
  padding-inline: 16px 8px;
  display: flex;
  align-items: center;
  color: rgb(var(--v-theme-on-surface-variant));
}

.pref-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-block: 16px;
  padding-inline: 16px;
}

.pref-title {
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
}

.pref-subtitle {
  font-size: 12px;
  line-height: 16px;
  color: color-mix(in srgb, currentColor 78%, transparent);
}

.settings-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
}

.settings-detail-scroll {
  flex: 1;
  overflow-y: auto;
}
}
</style>
