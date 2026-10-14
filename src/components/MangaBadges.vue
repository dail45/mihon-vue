<script setup lang="ts">
import { computed } from 'vue'
import type { Manga } from '../api/types'
import { usePreferencesStore } from '../stores/preferences'
import { useSuwayomiStore } from '../stores/suwayomi'
import { isLocal, sourceOf } from '../utils/library'
const props = defineProps<{ manga: Manga; catalogue?: boolean; side?: 'start' | 'end' | 'all' }>()
const prefs = usePreferencesStore(), server = useSuwayomiStore()
const local = computed(() => isLocal(props.manga, server.sources)), language = computed(() => sourceOf(props.manga, server.sources)?.lang || '')
</script>
<template>
  <span class="manga-badge-group">
    <template v-if="side !== 'end'"><span v-if="catalogue && manga.inLibrary" class="manga-badge bg-secondary" aria-label="In library"><v-icon icon="collections_bookmark" size="14" /></span><template v-if="!catalogue"><span v-if="prefs.downloadBadge && (manga.downloadCount ?? 0) > 0" class="manga-badge bg-tertiary" :aria-label="`${manga.downloadCount} downloaded chapters`">{{ manga.downloadCount }}</span><span v-if="prefs.unreadBadge && (manga.unreadCount ?? 0) > 0" class="manga-badge bg-secondary" :aria-label="`${manga.unreadCount} unread chapters`">{{ manga.unreadCount }}</span></template></template>
    <template v-if="!catalogue && side !== 'start'"><span v-if="local && prefs.localBadge" class="manga-badge bg-tertiary" aria-label="Local source"><v-icon icon="folder" size="14" /></span><span v-else-if="!local && language && prefs.languageBadge" class="manga-badge bg-tertiary" :aria-label="`Language ${language.toUpperCase()}`">{{ language.toUpperCase() }}</span></template>
  </span>
</template>
