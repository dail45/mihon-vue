<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Manga } from '../api/types'
import { usePreferencesStore, type DisplayMode } from '../stores/preferences'
import { useSuwayomiStore } from '../stores/suwayomi'
const props = defineProps<{ manga: Manga; catalogue?: boolean; display?: DisplayMode }>(), server = useSuwayomiStore(), broken = ref(false)
const preferences = usePreferencesStore()
const displayMode = computed(() => props.display || 'compact')
watch(() => server.apiUrl, () => { broken.value = false })
</script>
<template>
  <v-card :to="`/manga/${manga.id}`" :class="['manga-card', `manga-card-${displayMode}`]" rounded="sm" :aria-label="catalogue ? `${manga.title}${manga.inLibrary ? ', in library' : ''}` : `${manga.title}, ${manga.unreadCount ?? 'unknown'} unread chapters`">
    <v-img v-if="!broken" :src="server.thumbnailUrl(manga.id)" :aspect-ratio="2 / 3" cover alt="" @error="broken = true" />
    <div v-else class="cover-fallback bg-surface-container d-flex align-center justify-center"><v-icon icon="image_not_supported" size="40" /></div>
    <div v-if="preferences.showBadges" class="manga-badges d-flex">
      <span v-if="catalogue && manga.inLibrary" class="bg-secondary-container px-1 py-1 d-flex" aria-label="In library"><v-icon icon="collections_bookmark" size="18" /></span>
      <span v-if="!catalogue && (manga.downloadCount ?? 0) > 0" class="bg-tertiary px-1 text-caption font-weight-medium" :aria-label="`${manga.downloadCount} downloaded`">{{ manga.downloadCount }}</span>
      <span v-if="!catalogue && (manga.unreadCount ?? 0) > 0" class="bg-secondary px-1 text-caption font-weight-medium" :aria-label="`${manga.unreadCount} unread`">{{ manga.unreadCount }}</span>
    </div>
    <div v-if="displayMode !== 'covers'" class="manga-title"><span class="manga-title-text text-body-2 font-weight-medium">{{ manga.title }}</span></div>
  </v-card>
</template>
