<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Manga } from '../api/types'
import { usePreferencesStore, type DisplayMode } from '../stores/preferences'
import { useSuwayomiStore } from '../stores/suwayomi'
import MangaBadges from './MangaBadges.vue'
const props = withDefaults(defineProps<{ manga: Manga; catalogue?: boolean; display?: DisplayMode; nextUnread?: number | null }>(), { display: 'compact', nextUnread: null })
const server = useSuwayomiStore(), prefs = usePreferencesStore(), broken = ref(false)
watch(() => [server.apiUrl, props.manga.id], () => { broken.value = false })
</script>
<template>
  <div class="manga-tile" :class="`manga-tile-${display}`">
    <router-link :to="`/manga/${manga.id}`" :class="['manga-card', `manga-card-${display}`]" :aria-label="catalogue ? `${manga.title}${manga.inLibrary ? ', in library' : ''}` : `${manga.title}, ${manga.unreadCount ?? 'unknown'} unread chapters`">
      <div class="manga-grid-cover">
        <v-img v-if="!broken" :src="server.thumbnailUrl(manga.id)" :aspect-ratio="2 / 3" cover alt="" class="manga-cover-image" :class="{ 'in-library-cover': catalogue && manga.inLibrary }" @error="broken = true" />
        <div v-else class="cover-fallback d-flex align-center justify-center"><v-icon icon="image_not_supported" size="40" /></div>
        <span v-if="display === 'compact'" class="manga-shade" />
        <MangaBadges :manga="manga" :catalogue="catalogue" side="start" class="grid-badges-start" /><MangaBadges v-if="!catalogue" :manga="manga" side="end" class="grid-badges-end" />
        <div v-if="display === 'compact'" class="manga-title" :class="{ 'has-continue': !catalogue && prefs.showContinue && nextUnread !== null }"><span class="manga-title-text">{{ manga.title }}</span></div>
      </div>
      <div v-if="display === 'comfortable'" class="manga-title"><span class="manga-title-text">{{ manga.title }}</span></div>
    </router-link>
    <router-link v-if="!catalogue && prefs.showContinue && nextUnread !== null" :to="`/manga/${manga.id}/read/${nextUnread}`" class="continue-reading" :class="{ 'continue-reading-small': display === 'compact' }" :aria-label="`Continue reading ${manga.title}`"><v-icon icon="play_arrow" size="20" class="filled-symbol" /></router-link>
  </div>
</template>
