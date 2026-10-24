<script setup lang="ts">
/**
 * DefaultLayout — primary application layout shell.
 *
 * Encapsulates:
 * - Top AppStateBanners
 * - Responsive navigation drawer (tablet rail)
 * - Global top app bar with back navigation and settings search action
 * - Main viewport container
 * - Bottom navigation bar (mobile)
 * - System navigation scrim
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useTabletUi } from '@/core/composables/useTabletUi'
import { useBottomNavVisibility } from '@/core/composables/useBottomNavVisibility'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import AppStateBanners from '@/core/components/AppStateBanners.vue'
import { stringResource, MR } from '@/core/i18n'
import type { Source } from '@/core/api/types'

const props = withDefaults(defineProps<{
  indexing?: boolean
}>(), {
  indexing: false,
})

const route = useRoute()
const router = useRouter()
const preferences = usePreferencesStore()
const server = useSuwayomiStore()
const { bottomNavVisible } = useBottomNavVisibility()
const tabletUi = useTabletUi()
const { width } = useDisplay()

const navItems = computed(() => [
  { title: stringResource(MR.strings.label_library) || 'Library', icon: 'collections_bookmark', path: '/library' },
  { title: stringResource(MR.strings.label_recent_updates) || 'Updates', icon: 'update', path: '/updates' },
  { title: stringResource(MR.strings.label_recent_manga) || 'History', icon: 'history', path: '/history' },
  { title: stringResource(MR.strings.browse) || 'Browse', icon: 'explore', path: '/browse' },
  { title: stringResource(MR.strings.label_more) || 'More', icon: 'more_horiz', path: '/more' },
])

const activeNav = computed(() => (route.path.startsWith('/manga/') ? '/library' : route.path))
const twoPaneSettings = computed(() => preferences.tabletUiMode === 'always' || (tabletUi.value && width.value >= 600))
const toolbarTitle = computed(() => {
  if (route.path.startsWith('/settings') && twoPaneSettings.value) {
    return stringResource(MR.strings.label_settings) || 'Settings'
  }
  if (route.meta.catalogue) {
    return server.sources.find((s: Source) => s.id === route.params.sourceId)?.displayName || 'Source'
  }
  if (route.meta.title) {
    return stringResource(route.meta.title as string) || (route.meta.title as string)
  }
  return ''
})

const settingsSearchAction = computed(() =>
  route.path.startsWith('/settings') && route.path !== '/settings/search' && (route.path === '/settings' || twoPaneSettings.value),
)

function back() {
  if (route.path === '/about/licenses') { void router.push('/about'); return }
  if (route.path.startsWith('/settings/debug/')) { void router.push('/settings/advanced/debug'); return }
  if (route.path.startsWith('/settings/advanced/')) { void router.push('/settings/advanced'); return }
  if (route.path.startsWith('/settings/')) { void router.push('/settings'); return }
  if (route.path === '/settings' || route.path === '/about' || route.path === '/categories' || route.path === '/download-queue' || route.path === '/support-us' || route.path === '/stats' || route.path === '/updates/errors') { void router.push('/more'); return }
  if (route.meta.catalogue) { void router.push('/browse'); return }
  if (route.path.startsWith('/browse/extensions')) { void router.push({ path: '/browse', query: { tab: 'extensions' } }); return }
  if (route.path.startsWith('/browse/sources')) { void router.push({ path: '/browse', query: { tab: 'sources' } }); return }
  if (route.path.startsWith('/browse/')) { void router.push('/browse'); return }
  if (typeof window.history.state?.back === 'string' && window.history.state.back.startsWith('/browse/source/')) { router.back(); return }
  void router.push('/library')
}
</script>

<template>
  <div class="default-layout">
    <!-- State banners above content -->
    <AppStateBanners
      :downloaded-only="preferences.downloadedOnly"
      :incognito="preferences.incognitoMode"
      :indexing="props.indexing"
    />

    <!-- Navigation rail for tablet/desktop -->
    <v-navigation-drawer
      v-if="tabletUi && !route.meta.detail"
      permanent
      width="80"
      color="surface-container"
      elevation="0"
      class="mihon-rail"
      aria-label="Main navigation"
    >
      <div class="d-flex flex-column justify-center h-100">
        <v-btn
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          :active="activeNav === item.path"
          :color="activeNav === item.path ? 'on-secondary-container' : 'on-surface-variant'"
          :aria-label="item.title"
          :aria-current="activeNav === item.path ? 'page' : undefined"
          variant="text"
          height="72"
          rounded="0"
          class="pa-0 rail-button"
        >
          <span class="navigation-icon" :class="{ 'bg-secondary-container': activeNav === item.path }">
            <v-icon :icon="item.icon" />
          </span>
          <span class="text-body-medium mt-1 navigation-label">{{ item.title }}</span>
        </v-btn>
      </div>
    </v-navigation-drawer>

    <!-- Global App Bar -->
    <v-app-bar
      v-if="!route.meta.reader && !route.meta.catalogue && !route.meta.ownToolbar && !route.meta.hideToolbar && !['/library', '/browse', '/updates', '/history', '/more'].includes(route.path)"
      flat
      height="64"
      color="surface"
      class="app-toolbar"
    >
      <v-btn v-if="route.meta.detail" icon="arrow_back" :aria-label="route.meta.catalogue ? 'Back to sources' : 'Back'" @click="back" />
      <v-app-bar-title class="text-title-large font-weight-regular">
        {{ toolbarTitle }}
        <v-chip v-if="route.path === '/library' && server.connected" size="small" class="ml-2" variant="tonal" :aria-label="`${server.totalLibraryCount} manga in library`">
          {{ server.totalLibraryCount }}
        </v-chip>
      </v-app-bar-title>
      <v-btn
        v-if="settingsSearchAction"
        icon="search"
        variant="text"
        aria-label="Search settings"
        @click="router.push('/settings/search')"
      />
    </v-app-bar>

    <v-main id="main-content" tabindex="-1">
      <slot />
    </v-main>

    <!-- Bottom Navigation for mobile -->
    <v-bottom-navigation
      v-if="!route.meta.detail && !tabletUi && bottomNavVisible"
      :model-value="activeNav"
      grow
      height="80"
      color="on-secondary-container"
      bg-color="surface-container"
      elevation="0"
      class="mihon-navigation"
      aria-label="Main navigation"
    >
      <v-btn
        v-for="item in navItems"
        :key="item.path"
        :value="item.path"
        :to="item.path"
        :aria-label="item.title"
        :aria-current="activeNav === item.path ? 'page' : undefined"
      >
        <span class="navigation-icon" :class="{ 'bg-secondary-container': activeNav === item.path }">
          <v-icon :icon="item.icon" />
        </span>
        <span class="mt-1 text-body-medium font-weight-medium navigation-label">{{ item.title }}</span>
      </v-btn>
    </v-bottom-navigation>

    <!-- Navigation bar scrim -->
    <div class="mihon-nav-scrim" aria-hidden="true" />
  </div>
</template>

<style scoped>
.default-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.mihon-nav-scrim {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3;
  height: env(safe-area-inset-bottom, 0px);
  background: rgba(var(--v-theme-surface-container), 0.8);
  pointer-events: none;
}
</style>
