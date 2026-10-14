<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { usePreferencesStore } from '../stores/preferences'
import { useReaderPreferences } from '../stores/readerPreferences'
import { useSuwayomiStore } from '../stores/suwayomi'
import LibraryDisplaySettings from '../components/LibraryDisplaySettings.vue'
import PreferenceCheckbox from '../components/PreferenceCheckbox.vue'
import ServerSettingsDialog from '../components/ServerSettingsDialog.vue'
const route = useRoute(), preferences = usePreferencesStore(), reader = useReaderPreferences(), server = useSuwayomiStore(), connectionOpen = ref(false)
const section = computed(() => String(route.meta.settingsSection || 'main'))
const items = [
  { title: 'Appearance', subtitle: 'Theme and display', icon: 'palette', path: '/settings/appearance' },
  { title: 'Library', subtitle: 'Display mode and chapter badges', icon: 'collections_bookmark', path: '/settings/library' },
  { title: 'Reader', subtitle: 'Reading mode, image scale, and progress', icon: 'chrome_reader_mode', path: '/settings/reader' },
  { title: 'Server connection', subtitle: 'Suwayomi REST API address', icon: 'dns', path: '/settings/connection' },
  { title: 'About', subtitle: 'Version, references, and attribution', icon: 'info', path: '/about' },
]
</script>
<template>
  <v-container class="pa-4 settings-content">
    <v-list v-if="section === 'main'" bg-color="transparent" class="py-0"><v-list-item v-for="item in items" :key="item.path" :title="item.title" :subtitle="item.subtitle" :prepend-icon="item.icon" :to="item.path" min-height="72" /></v-list>
    <template v-else-if="section === 'appearance'">
      <h2 class="text-body-large text-primary mb-4">Theme</h2>
      <v-radio-group v-model="preferences.themeMode" label="App theme" hide-details><v-radio value="system" label="System default" /><v-radio value="light" label="Light" /><v-radio value="dark" label="Dark" /></v-radio-group>
      <v-divider class="my-6" /><p class="text-body-medium text-on-surface-variant">The default Mihon color palette is used. Android dynamic color and alternate palettes are not yet available in this web client.</p>
    </template>
    <template v-else-if="section === 'library'">
      <LibraryDisplaySettings />
      <v-divider class="my-4" /><PreferenceCheckbox v-model="preferences.categorizedSort" label="Per-category sorting" /><p class="text-body-medium text-on-surface-variant mt-3">When disabled, the chosen sort applies to every category. These UI preferences are saved in this browser, not to native Mihon or Suwayomi category flags.</p>
    </template>
    <template v-else-if="section === 'reader'">
      <h2 class="text-body-large text-primary mb-6">Reading</h2>
      <v-select v-model="reader.mode" label="Reading mode" :items="[{title:'Left to right',value:'ltr'},{title:'Right to left',value:'rtl'},{title:'Webtoon · vertical scroll',value:'webtoon'}]" hide-details class="mb-4" />
      <v-select v-model="reader.fit" label="Image scale" :items="[{title:'Fit entire page',value:'page'},{title:'Fit width',value:'width'}]" hide-details class="mb-4" />
      <v-select v-model="reader.background" label="Reader background" :items="[{title:'Black',value:'black'},{title:'Dark gray',value:'gray'},{title:'Paper',value:'paper'}]" hide-details class="mb-6" />
      <v-divider class="my-6" /><h2 class="text-body-large text-primary mb-2">Reading progress</h2>
      <v-switch v-model="reader.saveProgress" label="Automatically save reading progress" color="primary" hide-details />
      <p class="text-body-medium text-on-surface-variant mt-3">Off by default. When enabled, successfully displayed pages are saved to Suwayomi; displaying the final page marks the chapter as read. Legacy REST versions may not return saved progress reliably.</p>
    </template>
    <template v-else-if="section === 'connection'">
      <v-list bg-color="transparent"><v-list-item title="Suwayomi-Server" :subtitle="server.apiUrl" prepend-icon="dns" @click="connectionOpen = true" /><v-list-item title="Check connection" subtitle="Open the library to request server data. This page does not continuously monitor the connection." prepend-icon="cloud" to="/library" /></v-list>
      <v-btn color="primary" variant="tonal" class="mt-4" @click="connectionOpen = true">Change server address</v-btn>
      <p class="text-body-medium text-on-surface-variant mt-6">All library management, source fetching, and chapter data stay on Suwayomi. UI preferences are stored in this browser.</p>
    </template>
  </v-container>
  <ServerSettingsDialog v-model="connectionOpen" />
</template>
