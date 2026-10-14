<script setup lang="ts">
import { usePreferencesStore } from '../stores/preferences'
const preferences = usePreferencesStore()
</script>
<template>
  <v-container class="pa-0 settings-content">
    <div class="text-center py-10"><v-icon icon="auto_stories" size="64" color="primary" /><h1 class="text-h5 mt-4">Mihon Vue</h1></div>
    <v-list bg-color="transparent" class="py-0">
      <v-list-item prepend-icon="cloud_off" title="Downloaded only" subtitle="Filter library titles with chapters downloaded on Suwayomi" min-height="88" @click="preferences.downloadedOnly = !preferences.downloadedOnly">
        <template #append><v-switch :model-value="preferences.downloadedOnly" color="primary" hide-details inset aria-label="Downloaded only" @click.stop @update:model-value="preferences.downloadedOnly = !!$event" /></template>
      </v-list-item>
      <v-divider class="my-3" />
      <v-list-item to="/categories" title="Categories" subtitle="View server categories" prepend-icon="label" min-height="64" />
      <v-list-item to="/settings" title="Settings" prepend-icon="settings" min-height="64" />
      <v-divider class="my-3" />
      <v-list-item to="/about" title="About" prepend-icon="info" min-height="64" />
      <v-list-item href="https://github.com/dail45/mihon-vue" target="_blank" rel="noopener noreferrer" title="Source code" prepend-icon="code" min-height="64" />
    </v-list>
  </v-container>
</template>
