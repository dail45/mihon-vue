<script setup lang="ts">
import { ref } from 'vue'
import { usePreferencesStore } from '../stores/preferences'
import { useSuwayomiStore } from '../stores/suwayomi'
import ServerSettingsDialog from '../components/ServerSettingsDialog.vue'
const preferences = usePreferencesStore(), server = useSuwayomiStore(), settingsOpen = ref(false)
const themeOptions = [{ title: 'System default', value: 'system' }, { title: 'Light', value: 'light' }, { title: 'Dark', value: 'dark' }]
</script>
<template>
  <v-container class="pa-4" style="max-width: 680px">
    <div class="text-center py-8"><v-icon icon="auto_stories" size="56" color="primary"/><h1 class="text-h5 mt-3">Mihon Vue</h1><p class="text-body-2 text-on-surface-variant mt-2">A UI client for Suwayomi</p><v-chip variant="tonal" size="small" class="mt-3">UI preview · 0.2.0</v-chip></div>
    <v-list bg-color="transparent">
      <v-list-subheader>Connection</v-list-subheader>
      <v-list-item title="Suwayomi-Server" :subtitle="server.apiUrl" prepend-icon="dns" append-icon="chevron_right" @click="settingsOpen = true" />
      <v-list-item :title="server.connected ? 'Last request succeeded' : 'Not connected'" prepend-icon="cloud" subtitle="Connection status reflects the last request, not a live health check." />
    </v-list>
    <v-divider class="my-4"/>
    <h2 class="text-subtitle-1 font-weight-medium mb-4">Appearance</h2>
    <v-select v-model="preferences.themeMode" :items="themeOptions" label="Theme" variant="outlined" hide-details />
    <v-divider class="my-6"/>
    <p class="text-body-2 text-on-surface-variant">This is an independent web client, not the official Mihon app. No scraping, extension installation, or local manga database runs in the browser.</p>
  </v-container>
  <ServerSettingsDialog v-model="settingsOpen" />
</template>
