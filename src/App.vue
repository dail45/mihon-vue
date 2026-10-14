<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { version as vuetifyVersion, useDisplay, useTheme } from 'vuetify'
import { usePreferencesStore } from './stores/preferences'
import { useSuwayomiStore } from './stores/suwayomi'
const route = useRoute(), router = useRouter(), preferences = usePreferencesStore(), server = useSuwayomiStore()
const { width } = useDisplay()
const tabletUi = computed(() => width.value >= 720)
const theme = useTheme()
const media = window.matchMedia('(prefers-color-scheme: dark)'), systemDark = ref(media.matches)
const updateSystemTheme = (e: MediaQueryListEvent) => { systemDark.value = e.matches }
onMounted(() => media.addEventListener('change', updateSystemTheme))
onUnmounted(() => media.removeEventListener('change', updateSystemTheme))
const dark = computed(() => preferences.themeMode === 'dark' || (preferences.themeMode === 'system' && systemDark.value))
watch(dark, value => {
  theme.change(value ? 'mihonDark' : 'mihonLight')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value ? '#1B1B1F' : '#FEFBFF')
}, { immediate: true })
const navItems = [
  { title: 'Library', icon: 'collections_bookmark', path: '/library' },
  { title: 'Updates', icon: 'update', path: '/updates' },
  { title: 'History', icon: 'history', path: '/history' },
  { title: 'Browse', icon: 'explore', path: '/browse' },
  { title: 'More', icon: 'more_horiz', path: '/more' },
]
const activeNav = computed(() => route.path.startsWith('/manga/') ? '/library' : route.path)
const toolbarTitle = computed(() => route.meta.catalogue ? server.sources.find(s => s.id === route.params.sourceId)?.displayName || 'Source' : route.meta.title)
function back() {
  if (route.path.startsWith('/settings/')) { void router.push('/settings'); return }
  if (route.path === '/settings' || route.path === '/about' || route.path === '/categories') { void router.push('/more'); return }
  if (route.meta.catalogue) { void router.push('/browse'); return }
  if (typeof window.history.state?.back === 'string' && window.history.state.back.startsWith('/browse/source/')) { router.back(); return }
  void router.push('/library')
}
</script>
<template>
  <v-app :data-vuetify-version="vuetifyVersion">
    <a class="skip-link" href="#main-content">Skip to content</a>
    <v-navigation-drawer v-if="tabletUi && !route.meta.detail" permanent width="80" color="surface-container" elevation="0" class="mihon-rail" aria-label="Main navigation">
      <div class="d-flex flex-column justify-center h-100">
        <v-btn v-for="item in navItems" :key="item.path" :to="item.path" :active="activeNav === item.path" :color="activeNav === item.path ? 'on-secondary-container' : 'on-surface-variant'" :aria-label="item.title" :aria-current="activeNav === item.path ? 'page' : undefined" variant="text" height="72" rounded="0" class="pa-0 rail-button">
          <span class="navigation-icon" :class="{ 'bg-secondary-container': activeNav === item.path }"><v-icon :icon="item.icon" /></span><span class="text-body-medium mt-1">{{ item.title }}</span>
        </v-btn>
      </div>
    </v-navigation-drawer>
    <v-app-bar v-if="!route.meta.reader && !route.meta.catalogue && !['/library', '/browse', '/updates', '/more'].includes(route.path)" flat height="64" color="surface" class="app-toolbar">
      <v-btn v-if="route.meta.detail" icon="arrow_back" :aria-label="route.meta.catalogue ? 'Back to sources' : 'Back'" @click="back" />
      <v-app-bar-title class="text-title-large font-weight-regular">
        {{ toolbarTitle }}
        <v-chip v-if="route.path === '/library' && server.connected" size="small" class="ml-2" variant="tonal" :aria-label="`${server.totalLibraryCount} manga in library`">{{ server.totalLibraryCount }}</v-chip>
      </v-app-bar-title>
    </v-app-bar>
    <v-main id="main-content" tabindex="-1"><router-view /></v-main>
    <v-bottom-navigation v-if="!route.meta.detail && !tabletUi" :model-value="activeNav" grow height="80" color="on-secondary-container" bg-color="surface-container" elevation="0" class="mihon-navigation" aria-label="Main navigation">
      <v-btn v-for="item in navItems" :key="item.path" :value="item.path" :to="item.path" :aria-label="item.title" :aria-current="activeNav === item.path ? 'page' : undefined">
        <span class="navigation-icon" :class="{ 'bg-secondary-container': activeNav === item.path }"><v-icon :icon="item.icon" /></span>
        <span class="mt-1 text-body-medium font-weight-medium">{{ item.title }}</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>
