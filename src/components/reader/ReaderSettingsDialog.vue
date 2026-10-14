<script setup lang="ts">
import { ref } from 'vue'
import PreferenceChoice from '../PreferenceChoice.vue'
import AdaptiveSettingsSheet from '../AdaptiveSettingsSheet.vue'
import { useReaderPreferences } from '../../stores/readerPreferences'
const open = defineModel<boolean>({ required: true }), preferences = useReaderPreferences(), tab = ref('reading')
const modes = [{ title: 'Left to right', value: 'ltr' }, { title: 'Right to left', value: 'rtl' }, { title: 'Webtoon · vertical scroll', value: 'webtoon' }]
const backgrounds = [{ title: 'Black', value: 'black' }, { title: 'Dark gray', value: 'gray' }, { title: 'Paper', value: 'paper' }]
</script>
<template>
  <AdaptiveSettingsSheet v-model="open" v-model:tab="tab" title="Reader settings" :tabs="['Reading', 'General']">
      <div class="pa-6">
        <template v-if="tab === 'reading'">
          <PreferenceChoice v-model="preferences.mode" :items="modes" title="Reading mode" />
          <PreferenceChoice v-model="preferences.fit" :items="[{ title: 'Fit entire page', value: 'page' }, { title: 'Fit width', value: 'width' }]" title="Image scale" :disabled="preferences.mode === 'webtoon'" />
          <PreferenceChoice v-model="preferences.background" :items="backgrounds" title="Reader background" />
          <p class="text-body-medium text-on-surface-variant mt-6">Swipe or use the arrow keys to turn pages. Tap the page, or press Space, to show and hide controls.</p>
        </template>
        <template v-else>
          <v-switch v-model="preferences.saveProgress" color="primary" label="Automatically save reading progress" hide-details />
          <p class="text-body-medium text-on-surface-variant mt-4">Only displayed, loaded pages are saved to Suwayomi. The final page marks the chapter as read. Image preloading never updates progress.</p>
          <v-alert type="info" color="primary" variant="tonal" class="mt-4 text-body-medium">Legacy REST versions may return default progress or bookmark values. Automatic saving is off until you enable it; restoring a position depends on your server version.</v-alert>
        </template>
      </div>
  </AdaptiveSettingsSheet>
</template>
