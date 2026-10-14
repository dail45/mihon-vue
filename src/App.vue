<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import { usePreferencesStore } from './stores/preferences'
import { useSuwayomiStore } from './stores/suwayomi'
import ServerSettingsDialog from './components/ServerSettingsDialog.vue'
const route = useRoute(), router = useRouter(), preferences = usePreferencesStore(), server = useSuwayomiStore()
const theme = useTheme(), settingsOpen = ref(false)
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
function toggleTheme() { preferences.themeMode = dark.value ? 'light' : 'dark' }
</script>
<template>
  <v-app>
    <a class="skip-link" href="#main-content">Skip to content</a>
    <v-app-bar flat height="64" color="surface" class="app-toolbar">
      <v-btn v-if="route.meta.detail" icon="arrow_back" aria-label="Back to library" @click="router.push('/library')" />
      <v-app-bar-title class="text-h6 font-weight-regular">
        {{ route.meta.title }}
        <v-chip v-if="route.path === '/library' && server.connected" size="small" class="ml-2" variant="tonal" :aria-label="`${server.totalLibraryCount} manga in library`">{{ server.totalLibraryCount }}</v-chip>
      </v-app-bar-title>
      <v-btn :icon="dark ? 'light_mode' : 'dark_mode'" :aria-label="dark ? 'Use light theme' : 'Use dark theme'" @click="toggleTheme" />
      <v-btn icon="dns" aria-label="Server connection settings" @click="settingsOpen = true" />
      <v-menu>
        <template #activator="{ props }"><v-btn v-bind="props" icon="more_vert" aria-label="More options" /></template>
        <v-list>
          <v-list-item title="Connection settings" prepend-icon="dns" @click="settingsOpen = true" />
          <v-list-item title="Follow system theme" prepend-icon="contrast" @click="preferences.themeMode = 'system'" />
        </v-list>
      </v-menu>
    </v-app-bar>
    <v-main id="main-content" tabindex="-1"><router-view /></v-main>
    <v-bottom-navigation v-if="!route.meta.detail" :model-value="activeNav" grow height="80" color="on-secondary-container" bg-color="surface-container" elevation="0" class="mihon-navigation" aria-label="Main navigation">
      <v-btn v-for="item in navItems" :key="item.path" :value="item.path" :to="item.path" :aria-label="item.title" :aria-current="activeNav === item.path ? 'page' : undefined">
        <span class="navigation-icon" :class="{ 'bg-secondary-container': activeNav === item.path }"><v-icon :icon="item.icon" /></span>
        <span class="mt-1 text-body-2 font-weight-medium">{{ item.title }}</span>
      </v-btn>
    </v-bottom-navigation>
    <ServerSettingsDialog v-model="settingsOpen" />
  </v-app>
</template>
