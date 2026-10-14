<script setup lang="ts">
import { ref } from 'vue'
import { usePreferencesStore } from '../stores/preferences'
const open = defineModel<boolean>({ required: true })
const unread = defineModel<'all' | 'include' | 'exclude'>('unread', { required: true })
const completed = defineModel<'all' | 'include' | 'exclude'>('completed', { required: true })
const sort = defineModel<'title' | 'unread' | 'total' | 'added'>('sort', { required: true })
const descending = defineModel<boolean>('descending', { required: true })
const tab = ref('filter'), preferences = usePreferencesStore()
const states = [{ title: 'Any', value: 'all' }, { title: 'Only', value: 'include' }, { title: 'Exclude', value: 'exclude' }]
</script>
<template>
  <v-bottom-sheet v-model="open" max-width="640" scrollable>
    <v-card rounded="t-xl" color="surface-container-high">
      <v-card-title>Library settings</v-card-title>
      <v-tabs v-model="tab" color="primary" grow><v-tab value="filter">Filter</v-tab><v-tab value="sort">Sort</v-tab><v-tab value="display">Display</v-tab></v-tabs>
      <v-card-text class="pt-6" style="min-height: 264px">
        <template v-if="tab === 'filter'">
          <v-switch v-model="preferences.downloadedOnly" label="Downloaded chapters only" color="primary" hide-details class="mb-4" />
          <v-select v-model="unread" label="Unread chapters" :items="states" hide-details class="mb-4" />
          <v-select v-model="completed" label="Completed titles" :items="states" hide-details />
        </template>
        <template v-else-if="tab === 'sort'">
          <v-radio-group v-model="sort" hide-details><v-radio value="title" label="Alphabetically" /><v-radio value="total" label="Total chapters" /><v-radio value="unread" label="Unread chapters" /><v-radio value="added" label="Date added" /></v-radio-group>
          <v-switch v-model="descending" label="Descending order" color="primary" hide-details />
        </template>
        <template v-else>
          <v-radio-group v-model="preferences.libraryDisplay" label="Display mode" hide-details><v-radio value="compact" label="Compact grid" /><v-radio value="comfortable" label="Comfortable grid" /><v-radio value="covers" label="Cover-only grid" /><v-radio value="list" label="List" /></v-radio-group>
          <v-switch v-model="preferences.showBadges" label="Show chapter badges" color="primary" hide-details />
        </template>
      </v-card-text>
      <v-card-actions><v-spacer /><v-btn color="primary" @click="open = false">Done</v-btn></v-card-actions>
    </v-card>
  </v-bottom-sheet>
</template>
