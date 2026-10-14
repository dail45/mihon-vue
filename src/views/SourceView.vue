<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSuwayomiStore } from '../stores/suwayomi'
import { useCatalogueStore, type CatalogueMode } from '../stores/catalogue'
import MangaCollection from '../components/MangaCollection.vue'
import { usePreferencesStore } from '../stores/preferences'
import EmptyState from '../components/EmptyState.vue'
const preferences = usePreferencesStore()
const route = useRoute(), router = useRouter(), server = useSuwayomiStore(), catalogue = useCatalogueStore()
const source = computed(() => server.sources.find(s => s.id === route.params.sourceId))
const mode = computed<CatalogueMode>(() => route.query.mode === 'search' ? 'search' : route.query.mode === 'latest' ? 'latest' : 'popular')
const searchTerm = computed(() => typeof route.query.q === 'string' ? route.query.q : '')
const draft = ref(searchTerm.value), searchOpen = ref(mode.value === 'search'), searchInput = ref<{ focus: () => void; blur: () => void } | null>(null)
const displayIcon = computed(() => preferences.catalogueDisplay === 'list' ? 'view_list' : preferences.catalogueDisplay === 'comfortable' ? 'view_module' : 'view_compact')
async function openSearch() { searchOpen.value = true; await nextTick(); searchInput.value?.focus() }
function clearSearch() { draft.value = ''; searchInput.value?.focus() }
function goBack() { if (searchOpen.value) { searchOpen.value = false; draft.value = ''; choose('popular') } else void router.push('/browse') }
const unsupported = computed(() => mode.value === 'latest' && source.value?.supportsLatest === false)
function choose(value: unknown) { if (value === 'search') return; searchOpen.value = false; void router.replace({ query: { mode: String(value) } }) }
function search() {
  const q = draft.value.trim()
  searchInput.value?.blur()
  void router.replace({ query: q ? { mode: 'search', q } : { mode: 'popular' } })
}
function reload() {
  if (!source.value || unsupported.value) { catalogue.close(); return }
  void catalogue.open(server.apiUrl, String(route.params.sourceId), mode.value, searchTerm.value)
}
watch(() => [route.params.sourceId, mode.value, searchTerm.value, server.apiUrl, source.value, unsupported.value], () => { draft.value = searchTerm.value; if (mode.value === 'search') searchOpen.value = true; reload() }, { immediate: true })
watch(() => server.apiUrl, () => { void server.loadSources() })
if (!server.sources.length) void server.loadSources()
onUnmounted(() => catalogue.close())
</script>
<template>
  <div class="source-catalogue">
    <v-app-bar flat height="64" color="surface" class="source-toolbar" extension-height="48">
      <v-btn icon="arrow_back" aria-label="Back to sources" @click="goBack" />
      <form v-if="searchOpen" class="toolbar-search" role="search" @submit.prevent="search"><v-text-field ref="searchInput" v-model="draft" type="search" enterkeyhint="search" autocomplete="off" aria-label="Search source" placeholder="Search…" variant="plain" density="comfortable" hide-details class="toolbar-search-field" @keydown.esc="goBack" /></form>
      <v-app-bar-title v-else class="text-title-large font-weight-regular">{{ source?.displayName || 'Source' }}</v-app-bar-title>
      <v-btn v-if="!searchOpen" icon="search" aria-label="Open source search" @click="openSearch" />
      <v-btn v-else-if="draft" icon="close" aria-label="Clear source search" @click="clearSearch" />
      <v-menu><template #activator="{ props }"><v-btn v-bind="props" :icon="displayIcon" aria-label="Catalogue display mode" /></template><v-list aria-label="Catalogue display modes"><v-list-item v-for="item in ([{title:'Comfortable grid',value:'comfortable'},{title:'Compact grid',value:'compact'},{title:'Cover-only grid',value:'covers'},{title:'List',value:'list'}] as const)" :key="item.value" :title="item.title" :prepend-icon="preferences.catalogueDisplay === item.value ? 'radio_button_checked' : 'radio_button_unchecked'" @click="preferences.catalogueDisplay = item.value" /></v-list></v-menu>
      <v-menu><template #activator="{ props }"><v-btn v-bind="props" icon="more_vert" aria-label="Source options" /></template><v-list><v-list-item title="Refresh catalogue" prepend-icon="refresh" :disabled="catalogue.loading || unsupported" @click="reload" /><v-list-item v-if="source?.baseUrl && /^https?:\/\//.test(source.baseUrl)" title="Open source website" prepend-icon="public" :href="source.baseUrl" target="_blank" rel="noopener noreferrer" /></v-list></v-menu>
      <template #extension><div class="source-listing-bar" role="group" aria-label="Source listing"><v-chip tag="button" type="button" class="listing-chip" rounded="lg" :class="{ 'listing-chip-selected': mode === 'popular' }" :aria-pressed="mode === 'popular'" :variant="mode === 'popular' ? 'flat' : 'outlined'" :color="mode === 'popular' ? 'secondary-container' : undefined" prepend-icon="favorite" @click="choose('popular')">Popular</v-chip><v-chip v-if="source?.supportsLatest !== false" tag="button" type="button" class="listing-chip" rounded="lg" :class="{ 'listing-chip-selected': mode === 'latest' }" :aria-pressed="mode === 'latest'" :variant="mode === 'latest' ? 'flat' : 'outlined'" :color="mode === 'latest' ? 'secondary-container' : undefined" prepend-icon="verified" @click="choose('latest')">Latest</v-chip></div></template>
    </v-app-bar>
    <p v-if="mode === 'search'" class="sr-only" role="status">Search results for {{ searchTerm }}</p>
    <v-progress-linear v-if="catalogue.loading || server.loadingSources" indeterminate color="primary" aria-label="Loading catalogue" />
    <EmptyState v-if="server.sourcesError" icon="cloud_off" title="Sources unavailable" :description="server.sourcesError"><v-btn color="primary" @click="server.loadSources">Try again</v-btn></EmptyState>
    <EmptyState v-else-if="!server.loadingSources && !source" icon="explore" title="Source not installed" description="This source is not in your server’s installed source list."><v-btn color="primary" to="/browse">Back to sources</v-btn></EmptyState>
    <EmptyState v-else-if="unsupported" icon="explore" title="Latest updates not supported" description="This source does not offer a latest-updates feed."><v-btn color="primary" @click="choose('popular')">Show popular</v-btn></EmptyState>
    <EmptyState v-else-if="catalogue.error && !catalogue.items.length" icon="cloud_off" title="Source unavailable" :description="catalogue.error"><v-btn color="primary" @click="catalogue.loadMore">Try again</v-btn></EmptyState>
    <EmptyState v-else-if="source && !catalogue.loading && !catalogue.items.length" icon="search_off" title="No titles found" description="Try another search, or explore popular titles."><v-btn color="primary" variant="text" @click="draft = ''; choose('popular')">Show popular</v-btn></EmptyState>
    <MangaCollection v-else :items="catalogue.items" :display="preferences.catalogueDisplay" catalogue />
    <div v-if="catalogue.items.length" class="pa-4 text-center" aria-live="polite">
      <v-alert v-if="catalogue.error" type="error" variant="tonal" class="mb-4 text-start">{{ catalogue.error }} Your loaded titles are still available.</v-alert>
      <v-btn v-if="catalogue.hasNextPage" color="primary" variant="tonal" :loading="catalogue.loading" @click="catalogue.loadMore">{{ catalogue.error ? 'Retry next page' : 'Load more' }}</v-btn>
      <p v-else class="text-body-medium text-on-surface-variant">All {{ catalogue.items.length }} {{ catalogue.items.length === 1 ? 'title' : 'titles' }} loaded</p>
    </div>
  </div>
</template>
