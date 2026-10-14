<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePreferencesStore } from '../stores/preferences'
import { useChapterSettings } from '../stores/chapterSettings'
import { createSuwayomiApi } from '../api/client'
import { chapterSortOptions } from '../utils/chapters'
import AdaptiveSettingsSheet from './AdaptiveSettingsSheet.vue'
import TriStateRow from './TriStateRow.vue'
const props = defineProps<{ mangaId: number; apiUrl: string }>()
const confirmDefault = ref(false), applyLibrary = ref(false), savingDefault = ref(false), defaultError = ref('')
const opened = defineModel<boolean>({ required: true }), tab = ref('filter')
const prefs = usePreferencesStore(), store = useChapterSettings(), settings = computed(() => store.forManga(props.apiUrl, props.mangaId))
const downloaded = computed({ get: () => prefs.downloadedOnly ? 'include' as const : settings.value.downloaded, set: v => { if (!prefs.downloadedOnly) settings.value.downloaded = v } })
async function saveDefault() {
  if (savingDefault.value) return
  savingDefault.value = true; defaultError.value = ''
  const apiUrl = props.apiUrl, selected = { ...settings.value }
  try {
    let ids: number[] = []
    if (applyLibrary.value) {
      const api = createSuwayomiApi(apiUrl), categories = await api.categories()
      const libraries = await Promise.all(categories.map(c => api.categoryManga(c.id)))
      ids = [...new Set(libraries.flat().map(m => m.id))]
    }
    if (apiUrl !== props.apiUrl) throw new Error('Server changed. Open the dialog again.')
    store.setDefault(selected)
    for (const id of ids) Object.assign(store.forManga(apiUrl, id), selected)
    confirmDefault.value = false
  } catch { defaultError.value = 'Could not read the library. No defaults were applied; check the connection and try again.' }
  finally { savingDefault.value = false }
}
</script>
<template>
  <AdaptiveSettingsSheet v-model="opened" v-model:tab="tab" title="Chapter settings" :tabs="['Filter', 'Sort', 'Display']">
    <template #overflow><v-menu><template #activator="{ props: menuProps }"><v-btn v-bind="menuProps" icon="more_vert" aria-label="Chapter settings options" variant="text" /></template><v-list><v-list-item title="Set as default" @click="confirmDefault = true" /><v-list-item title="Reset to defaults" @click="store.reset(apiUrl, mangaId)" /></v-list></v-menu></template>
    <div v-if="tab === 'filter'" class="py-2"><TriStateRow v-model="downloaded" label="Downloaded" :disabled="prefs.downloadedOnly" /><TriStateRow v-model="settings.unread" label="Unread" /><TriStateRow v-model="settings.bookmarked" label="Bookmarked" /><p class="settings-note">Scanlator filtering is not implemented. Settings here are saved for this manga in this browser.</p></div>
    <div v-else-if="tab === 'sort'" class="py-2"><button v-for="option in chapterSortOptions" :key="option.value" type="button" class="settings-row" :aria-label="option.label" :aria-pressed="settings.sort === option.value" :aria-description="settings.sort === option.value ? settings.descending ? 'Descending' : 'Ascending' : undefined" @click="store.choose(settings, option.value)"><v-icon v-if="settings.sort === option.value" :icon="settings.descending ? 'arrow_downward' : 'arrow_upward'" color="primary" /><span v-else class="settings-icon-space" /><span>{{ option.label }}</span></button></div>
    <v-radio-group v-else v-model="settings.display" label="Chapter display" class="px-6 py-3" hide-details><v-radio value="title" label="Show title" /><v-radio value="number" label="Show chapter number" /></v-radio-group>
  </AdaptiveSettingsSheet>
  <v-dialog v-model="confirmDefault" max-width="460" :persistent="savingDefault" aria-label="Default chapter settings"><v-card rounded="xl" title="Chapter settings"><v-card-text>Use these settings as the default for manga opened in this browser? This does not change server preferences.<v-checkbox v-model="applyLibrary" label="Also apply to library in this browser" :disabled="savingDefault" hide-details /><p v-if="defaultError" role="alert">{{ defaultError }}</p></v-card-text><v-card-actions><v-spacer /><v-btn :disabled="savingDefault" @click="confirmDefault = false">Cancel</v-btn><v-btn color="primary" :loading="savingDefault" @click="saveDefault">OK</v-btn></v-card-actions></v-card></v-dialog>
</template>
