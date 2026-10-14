<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePreferencesStore } from '../stores/preferences'
import { useChapterSettings } from '../stores/chapterSettings'
import { chapterSortOptions } from '../utils/chapters'
import AdaptiveSettingsSheet from './AdaptiveSettingsSheet.vue'
import TriStateRow from './TriStateRow.vue'
const props = defineProps<{ mangaId: number; apiUrl: string }>()
const opened = defineModel<boolean>({ required: true }), tab = ref('filter')
const prefs = usePreferencesStore(), store = useChapterSettings(), settings = computed(() => store.forManga(props.apiUrl, props.mangaId))
const downloaded = computed({ get: () => prefs.downloadedOnly ? 'include' as const : settings.value.downloaded, set: v => { if (!prefs.downloadedOnly) settings.value.downloaded = v } })
</script>
<template>
  <AdaptiveSettingsSheet v-model="opened" v-model:tab="tab" title="Chapter settings" :tabs="['Filter', 'Sort', 'Display']">
    <div v-if="tab === 'filter'" class="py-2"><TriStateRow v-model="downloaded" label="Downloaded" :disabled="prefs.downloadedOnly" /><TriStateRow v-model="settings.unread" label="Unread" /><TriStateRow v-model="settings.bookmarked" label="Bookmarked" /><p class="settings-note">Scanlator filtering is not implemented. Settings here are saved for this manga in this browser.</p></div>
    <div v-else-if="tab === 'sort'" class="py-2"><button v-for="option in chapterSortOptions" :key="option.value" type="button" class="settings-row" :aria-label="option.label" :aria-pressed="settings.sort === option.value" :aria-description="settings.sort === option.value ? settings.descending ? 'Descending' : 'Ascending' : undefined" @click="store.choose(settings, option.value)"><v-icon v-if="settings.sort === option.value" :icon="settings.descending ? 'arrow_downward' : 'arrow_upward'" color="primary" /><span v-else class="settings-icon-space" /><span>{{ option.label }}</span></button></div>
    <v-radio-group v-else v-model="settings.display" label="Chapter display" class="px-6 py-3" hide-details><v-radio value="title" label="Show title" /><v-radio value="number" label="Show chapter number" /></v-radio-group>
    <p class="settings-note"><button type="button" class="settings-action text-primary" @click="store.setDefault(settings)">Set as browser default</button><span class="mx-2">·</span><button type="button" class="settings-action text-primary" @click="store.reset(apiUrl, mangaId)">Reset to defaults</button></p>
  </AdaptiveSettingsSheet>
</template>
