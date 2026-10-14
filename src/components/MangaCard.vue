<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Manga } from '../api/types'
import { useSuwayomiStore } from '../stores/suwayomi'
const props = defineProps<{ manga: Manga }>(), server = useSuwayomiStore(), broken = ref(false)
watch(() => server.apiUrl, () => { broken.value = false })
</script>
<template>
  <v-card :to="`/manga/${manga.id}`" class="manga-card" rounded="sm" :aria-label="`${manga.title}, ${manga.unreadCount ?? 'unknown'} unread chapters`">
    <v-img v-if="!broken" :src="server.thumbnailUrl(manga.id)" :aspect-ratio="2 / 3" cover alt="" @error="broken = true" />
    <div v-else class="cover-fallback bg-surface-container d-flex align-center justify-center"><v-icon icon="image_not_supported" size="40" /></div>
    <div class="manga-badges d-flex">
      <span v-if="(manga.downloadCount ?? 0) > 0" class="bg-tertiary px-1 text-caption font-weight-medium" :aria-label="`${manga.downloadCount} downloaded`">{{ manga.downloadCount }}</span>
      <span v-if="(manga.unreadCount ?? 0) > 0" class="bg-secondary px-1 text-caption font-weight-medium" :aria-label="`${manga.unreadCount} unread`">{{ manga.unreadCount }}</span>
    </div>
    <div class="manga-title"><span class="manga-title-text text-body-2 font-weight-medium">{{ manga.title }}</span></div>
  </v-card>
</template>
