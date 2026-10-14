<script setup lang="ts">
import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import { usePreferencesStore } from '../stores/preferences'
import Md3Slider from './Md3Slider.vue'
import PreferenceCheckbox from './PreferenceCheckbox.vue'
const prefs = usePreferencesStore(), display = useDisplay()
const landscape = computed(() => display.width.value > display.height.value)
const columns = computed({ get: () => landscape.value ? prefs.landscapeColumns : prefs.portraitColumns, set: n => { if (landscape.value) prefs.landscapeColumns = n; else prefs.portraitColumns = n } })
const modes = [{ title: 'Compact grid', value: 'compact' }, { title: 'Comfortable grid', value: 'comfortable' }, { title: 'Cover-only grid', value: 'covers' }, { title: 'List', value: 'list' }] as const
</script>
<template>
  <h3 class="settings-heading">Display mode</h3>
  <div class="display-mode-chips" role="group" aria-label="Library display mode"><v-chip v-for="mode in modes" :key="mode.value" tag="button" type="button" class="display-mode-chip" rounded="lg" :variant="prefs.libraryDisplay === mode.value ? 'flat' : 'outlined'" :color="prefs.libraryDisplay === mode.value ? 'secondary-container' : 'on-surface-variant'" :aria-pressed="prefs.libraryDisplay === mode.value" @click="prefs.libraryDisplay = mode.value">{{ mode.title }}</v-chip></div>
  <div v-if="prefs.libraryDisplay !== 'list'" class="settings-columns"><div class="d-flex align-center justify-space-between"><span>Items per row · {{ landscape ? 'Landscape' : 'Portrait' }}</span><span class="columns-pill">{{ columns || 'Auto' }}</span></div><Md3Slider v-model="columns" label="Items per row" :max="10" :value-text="columns ? String(columns) : 'Auto'" /></div>
  <h3 class="settings-heading">Overlay</h3>
  <PreferenceCheckbox v-model="prefs.downloadBadge" label="Download badges" /><PreferenceCheckbox v-model="prefs.unreadBadge" label="Unread badges" /><PreferenceCheckbox v-model="prefs.localBadge" label="Local source badges" /><PreferenceCheckbox v-model="prefs.languageBadge" label="Language badges" /><PreferenceCheckbox v-model="prefs.showContinue" label="Show continue reading button" />
  <h3 class="settings-heading">Tabs</h3><PreferenceCheckbox v-model="prefs.categoryTabs" label="Show category tabs" /><PreferenceCheckbox v-model="prefs.categoryCounts" label="Show number of items" />
</template>
