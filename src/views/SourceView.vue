<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSuwayomiStore } from '../stores/suwayomi'
import { useCatalogueStore, type CatalogueMode } from '../stores/catalogue'
import MangaCard from '../components/MangaCard.vue'
import EmptyState from '../components/EmptyState.vue'
const route = useRoute(), router = useRouter(), server = useSuwayomiStore(), catalogue = useCatalogueStore()
const source = computed(() => server.sources.find(s => s.id === route.params.sourceId))
const mode = computed<CatalogueMode>(() => route.query.mode === 'search' ? 'search' : route.query.mode === 'latest' ? 'latest' : 'popular')
const searchTerm = computed(() => typeof route.query.q === 'string' ? route.query.q : '')
const draft = ref(searchTerm.value)
const unsupported = computed(() => mode.value === 'latest' && source.value?.supportsLatest === false)
function choose(value: unknown) { if (value === 'search') return; void router.replace({ query: { mode: String(value) } }) }
function search() {
  const q = draft.value.trim()
  void router.replace({ query: q ? { mode: 'search', q } : { mode: 'popular' } })
}
function reload() {
  if (!source.value || unsupported.value) { catalogue.close(); return }
  void catalogue.open(server.apiUrl, String(route.params.sourceId), mode.value, searchTerm.value)
}
watch(() => [route.params.sourceId, mode.value, searchTerm.value, server.apiUrl, source.value, unsupported.value], () => { draft.value = searchTerm.value; reload() }, { immediate: true })
watch(() => server.apiUrl, () => { void server.loadSources() })
if (!server.sources.length) void server.loadSources()
onUnmounted(() => catalogue.close())
</script>
<template>
  <div class="source-catalogue">
    <form class="d-flex align-center px-2 ga-1" role="search" @submit.prevent="search">
      <v-text-field v-model="draft" label="Search source" prepend-inner-icon="search" variant="plain" hide-details clearable @click:clear="draft = ''; search()" />
      <v-btn type="submit" icon="search" variant="text" aria-label="Search catalogue" color="primary" />
      <v-btn icon="refresh" variant="text" aria-label="Refresh catalogue" :disabled="catalogue.loading || unsupported" @click="reload" />
    </form>
    <v-tabs :model-value="mode" color="primary" @update:model-value="choose">
      <v-tab value="popular">Popular</v-tab>
      <v-tab value="latest" :disabled="source?.supportsLatest === false">Latest</v-tab>
      <v-tab v-if="mode === 'search'" value="search">Search results</v-tab>
    </v-tabs>
    <p class="text-body-2 text-on-surface-variant px-4 py-3">{{ source?.lang.toUpperCase() || 'Source' }}<span v-if="source?.isNsfw"> · NSFW</span> · Results provided by Suwayomi<span v-if="mode === 'search'"> · “{{ searchTerm }}”</span></p>
    <v-progress-linear v-if="catalogue.loading || server.loadingSources" indeterminate color="primary" aria-label="Loading catalogue" />
    <EmptyState v-if="server.sourcesError" icon="cloud_off" title="Sources unavailable" :description="server.sourcesError"><v-btn color="primary" @click="server.loadSources">Try again</v-btn></EmptyState>
    <EmptyState v-else-if="!server.loadingSources && !source" icon="explore" title="Source not installed" description="This source is not in your server’s installed source list."><v-btn color="primary" to="/browse">Back to sources</v-btn></EmptyState>
    <EmptyState v-else-if="unsupported" icon="explore" title="Latest updates not supported" description="This source does not offer a latest-updates feed."><v-btn color="primary" @click="choose('popular')">Show popular</v-btn></EmptyState>
    <EmptyState v-else-if="catalogue.error && !catalogue.items.length" icon="cloud_off" title="Source unavailable" :description="catalogue.error"><v-btn color="primary" @click="catalogue.loadMore">Try again</v-btn></EmptyState>
    <EmptyState v-else-if="source && !catalogue.loading && !catalogue.items.length" icon="search_off" title="No titles found" description="Try another search, or explore popular titles."><v-btn color="primary" variant="text" @click="draft = ''; choose('popular')">Show popular</v-btn></EmptyState>
    <div v-else class="library-grid" aria-label="Source manga"><MangaCard v-for="manga in catalogue.items" :key="manga.id" :manga="manga" catalogue /></div>
    <div v-if="catalogue.items.length" class="pa-4 text-center" aria-live="polite">
      <v-alert v-if="catalogue.error" type="error" variant="tonal" class="mb-4 text-start">{{ catalogue.error }} Your loaded titles are still available.</v-alert>
      <v-btn v-if="catalogue.hasNextPage" color="primary" variant="tonal" :loading="catalogue.loading" @click="catalogue.loadMore">{{ catalogue.error ? 'Retry next page' : 'Load more' }}</v-btn>
      <p v-else class="text-body-2 text-on-surface-variant">All {{ catalogue.items.length }} {{ catalogue.items.length === 1 ? 'title' : 'titles' }} loaded</p>
    </div>
  </div>
</template>
