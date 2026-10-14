<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Manga } from '../api/types'
import type { DisplayMode } from '../stores/preferences'
import { usePreferencesStore } from '../stores/preferences'
import { useSuwayomiStore } from '../stores/suwayomi'
import MangaCard from './MangaCard.vue'
defineProps<{ items: Manga[]; display: DisplayMode; catalogue?: boolean }>()
const server = useSuwayomiStore(), preferences = usePreferencesStore(), broken = ref(new Set<number>())
watch(() => server.apiUrl, () => { broken.value = new Set() })
</script>
<template>
  <v-list v-if="display === 'list'" class="py-2" bg-color="transparent" aria-label="Manga list">
    <v-list-item v-for="item in items" :key="item.id" :to="`/manga/${item.id}`" :title="item.title" min-height="72" class="px-4">
      <template #prepend><v-img v-if="!broken.has(item.id)" :src="server.thumbnailUrl(item.id)" width="40" height="56" cover rounded="sm" alt="" class="mr-4" @error="broken.add(item.id)" /><v-icon v-else icon="image_not_supported" class="mr-4" /></template>
      <template #append><div v-if="preferences.showBadges" class="d-flex ga-1 ml-3"><v-chip v-if="catalogue && item.inLibrary" size="small" color="secondary">In library</v-chip><v-chip v-if="!catalogue && (item.downloadCount ?? 0) > 0" size="small" color="tertiary" :aria-label="`${item.downloadCount} downloaded chapters`">{{ item.downloadCount }}</v-chip><v-chip v-if="!catalogue && (item.unreadCount ?? 0) > 0" size="small" color="primary" :aria-label="`${item.unreadCount} unread chapters`">{{ item.unreadCount }}</v-chip></div></template>
    </v-list-item>
  </v-list>
  <div v-else class="library-grid" :aria-label="`${display} manga grid`"><MangaCard v-for="item in items" :key="item.id" :manga="item" :display="display" :catalogue="catalogue" /></div>
</template>
