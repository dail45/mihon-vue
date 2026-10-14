<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePreferencesStore } from '../stores/preferences'
import { useSuwayomiStore } from '../stores/suwayomi'
import { librarySortOptions } from '../utils/library'
import AdaptiveSettingsSheet from './AdaptiveSettingsSheet.vue'
import LibraryDisplaySettings from './LibraryDisplaySettings.vue'
import TriStateRow from './TriStateRow.vue'
const open = defineModel<boolean>({ required: true })
const tab = ref('filter'), prefs = usePreferencesStore(), server = useSuwayomiStore()
const sort = computed(() => prefs.getLibrarySort(server.apiUrl, server.activeCategoryId))
const downloaded = computed({ get: () => prefs.downloadedOnly ? 'include' as const : prefs.filters.downloaded, set: v => { if (!prefs.downloadedOnly) prefs.filters.downloaded = v } })
</script>
<template>
  <AdaptiveSettingsSheet v-model="open" v-model:tab="tab" title="Library settings" :tabs="['Filter', 'Sort', 'Display']">
    <div v-if="tab === 'filter'" class="py-2"><TriStateRow v-model="downloaded" label="Downloaded" :disabled="prefs.downloadedOnly" /><TriStateRow v-model="prefs.filters.unread" label="Unread" /><TriStateRow v-model="prefs.filters.started" label="Started" /><TriStateRow v-model="prefs.filters.bookmarked" label="Bookmarked" /><TriStateRow v-model="prefs.filters.completed" label="Completed" /><p v-if="prefs.downloadedOnly" class="settings-note">Downloaded-only mode in More locks the Downloaded filter.</p></div>
    <div v-else-if="tab === 'sort'" class="py-2">
      <template v-for="(option, i) in librarySortOptions" :key="option.value">
        <button v-if="i === 3" type="button" class="settings-row" disabled aria-label="Last update unavailable"><span class="settings-icon-space" /><span>Last update <small class="d-block">Unavailable in the integrated Suwayomi REST data</small></span></button>
        <button type="button" class="settings-row" :data-sort="option.value" :aria-label="option.label" :aria-pressed="sort.type === option.value" :aria-description="sort.type === option.value ? option.value === 'random' ? 'Reshuffle' : sort.descending ? 'Descending; activate to switch to ascending' : 'Ascending; activate to switch to descending' : 'Activate to select this ordering'" @click="prefs.chooseLibrarySort(server.apiUrl, server.activeCategoryId, option.value)"><v-icon v-if="sort.type === option.value" :icon="option.value === 'random' ? 'refresh' : sort.descending ? 'arrow_downward' : 'arrow_upward'" color="primary" /><span v-else class="settings-icon-space" /><span>{{ option.label }}</span></button>
      </template>
      <p class="settings-note">{{ prefs.categorizedSort ? 'Sorting is saved for this category on this server.' : 'Sorting is shared by all categories.' }} Tap the selected order again to reverse it; Random reshuffles.</p>
    </div>
    <LibraryDisplaySettings v-else />
  </AdaptiveSettingsSheet>
</template>
