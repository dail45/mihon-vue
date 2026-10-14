<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSuwayomiStore } from '../stores/suwayomi'
import EmptyState from '../components/EmptyState.vue'
const route = useRoute(), server = useSuwayomiStore(), removeOpen = ref(false)
const brokenCover = ref(false), chapterQuery = ref(''), oldestFirst = ref(false), descriptionExpanded = ref(false)
const orderedChapters = computed(() => server.chapters.slice().sort((a, b) => a.index - b.index))
const firstChapter = computed(() => orderedChapters.value[0])
const visibleChapters = computed(() => orderedChapters.value.filter(c => c.name.toLowerCase().includes(chapterQuery.value.toLowerCase())).sort((a, b) => oldestFirst.value ? a.index - b.index : b.index - a.index))
watch(() => [route.params.id, server.apiUrl], () => { brokenCover.value = false; void server.loadManga(Number(route.params.id)) }, { immediate: true })
const detail = computed(() => server.manga)
const status = computed(() => detail.value?.status.replaceAll('_', ' ').toLowerCase())
function chapterDate(value: number) { return value > 0 ? new Date(value).toLocaleDateString() : 'Date unknown' }
async function remove() { removeOpen.value = false; await server.setLibraryMembership(false) }
</script>
<template>
  <v-progress-linear v-if="server.loadingManga" indeterminate color="primary" aria-label="Loading manga" />
  <EmptyState v-if="server.mangaError" icon="cloud_off" title="Unable to load manga" :description="server.mangaError"><v-btn color="primary" @click="server.loadManga(Number(route.params.id))">Try again</v-btn></EmptyState>
  <v-container v-else-if="detail" class="manga-detail pa-4">
    <div class="d-flex ga-4 mb-6">
      <v-img v-if="!brokenCover" :src="server.thumbnailUrl(detail.id)" :aspect-ratio="2 / 3" width="112" max-width="112" cover class="rounded" alt="Manga cover" @error="brokenCover = true" />
      <v-sheet v-else width="112" height="168" color="surface-container" rounded class="d-flex align-center justify-center flex-shrink-0"><v-icon icon="image_not_supported" /></v-sheet>
      <div class="flex-grow-1" style="min-width: 0">
        <h1 class="text-h5 font-weight-medium mb-3">{{ detail.title }}</h1>
        <p v-if="detail.author" class="text-body-2 mb-1">{{ detail.author }}</p>
        <p v-if="detail.artist && detail.artist !== detail.author" class="text-body-2 mb-1">{{ detail.artist }}</p>
        <p class="text-body-2 text-on-surface-variant text-capitalize">{{ status }}</p>
        <p class="text-body-2 text-on-surface-variant mt-1">{{ detail.source?.displayName || 'Source unavailable' }}</p>
      </div>
    </div>
    <div class="d-flex flex-wrap ga-2 mb-6">
      <v-btn v-if="firstChapter" :to="`/manga/${detail.id}/read/${firstChapter.index}`" prepend-icon="play_arrow" color="primary" variant="flat" rounded="pill">Start reading</v-btn>
      <v-btn :prepend-icon="detail.inLibrary ? 'favorite' : 'favorite_border'" color="primary" :variant="detail.inLibrary ? 'tonal' : 'flat'" :loading="server.mutatingLibrary" rounded="pill" @click="detail.inLibrary ? removeOpen = true : server.setLibraryMembership(true)">{{ detail.inLibrary ? 'In library' : 'Add to library' }}</v-btn>
      <v-btn prepend-icon="refresh" variant="text" :loading="server.loadingManga" rounded="pill" @click="server.loadManga(detail.id, true)">Refresh</v-btn>
    </div>
    <v-alert v-if="server.mutationError" type="error" variant="tonal" class="mb-4">{{ server.mutationError }}</v-alert>
    <p class="text-body-2 mb-2 description-text" :class="{ 'manga-description-collapsed': !descriptionExpanded }">{{ detail.description || 'No description available.' }}</p>
    <v-btn v-if="(detail.description?.length || 0) > 240" variant="text" color="primary" class="mb-4 px-0" @click="descriptionExpanded = !descriptionExpanded">{{ descriptionExpanded ? 'Show less' : 'Show more' }}</v-btn>
    <div class="d-flex flex-wrap ga-2 mb-6"><v-chip v-for="genre in detail.genre" :key="genre" variant="outlined" size="small">{{ genre }}</v-chip></div>
    <v-divider/><div class="d-flex align-center justify-space-between py-4"><h2 class="text-h6">{{ server.chapters.length }} {{ server.chapters.length === 1 ? 'chapter' : 'chapters' }}</h2><v-btn :icon="oldestFirst ? 'arrow_upward' : 'arrow_downward'" variant="text" :aria-label="oldestFirst ? 'Show newest chapters first' : 'Show oldest chapters first'" @click="oldestFirst = !oldestFirst"/></div>
    <v-text-field v-if="server.chapters.length" v-model="chapterQuery" label="Search chapters" prepend-inner-icon="search" variant="solo" flat hide-details clearable class="mb-2" @click:clear="chapterQuery = ''" />
    <v-list class="bg-transparent pa-0">
      <v-list-item v-for="chapter in visibleChapters" :key="chapter.id" :to="`/manga/${detail.id}/read/${chapter.index}`" :title="chapter.name" :subtitle="[chapterDate(chapter.uploadDate), chapter.scanlator].filter(Boolean).join(' · ')" class="px-0 py-2">
        <template #append><v-icon v-if="chapter.downloaded" icon="download_done" color="tertiary" aria-label="Downloaded" /></template>
      </v-list-item>
    </v-list>
    <p v-if="server.chapters.length && !visibleChapters.length" class="text-body-2 text-on-surface-variant py-6 text-center">No matching chapters.</p>
    <p v-if="!server.chapters.length" class="text-body-2 text-on-surface-variant">No chapters returned by the server.</p>
  </v-container>
  <v-dialog v-model="removeOpen" max-width="440">
    <v-card title="Remove from library?" rounded="xl" text="This removes the manga from your Suwayomi library. You can add it again later.">
      <v-card-actions><v-spacer/><v-btn @click="removeOpen = false">Cancel</v-btn><v-btn color="error" @click="remove">Remove</v-btn></v-card-actions>
    </v-card>
  </v-dialog>
</template>
