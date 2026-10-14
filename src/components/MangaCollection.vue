<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import type { Manga } from '../api/types'
import type { DisplayMode } from '../stores/preferences'
import type { ChapterSummary } from '../utils/library'
import { usePreferencesStore } from '../stores/preferences'
import { useSuwayomiStore } from '../stores/suwayomi'
import MangaCard from './MangaCard.vue'
import MangaBadges from './MangaBadges.vue'
defineProps<{ items: Manga[]; display: DisplayMode; catalogue?: boolean; summaries?: Record<number, ChapterSummary> }>()
const server = useSuwayomiStore(), prefs = usePreferencesStore(), broken = ref(new Set<number>()), viewport = useDisplay()
const columns = computed(() => viewport.width.value > viewport.height.value ? prefs.landscapeColumns : prefs.portraitColumns)
const gridStyle = computed(() => columns.value ? { gridTemplateColumns: `repeat(${columns.value}, minmax(0, 1fr))` } : {})
watch(() => server.apiUrl, () => { broken.value = new Set() })
</script>
<template>
  <div v-if="display === 'list'" class="manga-list" aria-label="Manga list">
    <div v-for="item in items" :key="item.id" class="manga-list-row">
      <router-link :to="`/manga/${item.id}`" class="manga-list-link" :aria-label="item.title">
        <v-img v-if="!broken.has(item.id)" :src="server.thumbnailUrl(item.id)" class="list-cover-image" width="40" min-width="40" height="40" cover rounded="sm" alt="" :class="{ 'in-library-cover': catalogue && item.inLibrary }" @error="broken.add(item.id)" /><span v-else class="list-cover-fallback"><v-icon icon="image_not_supported" /></span>
        <span class="manga-list-title">{{ item.title }}</span>
        <MangaBadges :manga="item" :catalogue="catalogue" side="all" />
      </router-link>
      <router-link v-if="!catalogue && prefs.showContinue && summaries?.[item.id]?.nextUnread != null" :to="`/manga/${item.id}/read/${summaries[item.id]!.nextUnread}`" class="continue-reading list-continue" :aria-label="`Continue reading ${item.title}`"><v-icon icon="play_arrow" size="16" class="filled-symbol" /></router-link>
    </div>
  </div>
  <div v-else class="library-grid" :style="gridStyle" :aria-label="`${display} manga grid`"><MangaCard v-for="item in items" :key="item.id" :manga="item" :display="display" :catalogue="catalogue" :next-unread="summaries?.[item.id]?.nextUnread" /></div>
</template>
