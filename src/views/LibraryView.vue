<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useSuwayomiStore } from '../stores/suwayomi'
import type { Manga } from '../api/types'
import { useLibraryDetails } from '../stores/libraryDetails'
import { defaultFilters, matchesLibrary, sortLibrary } from '../utils/library'
import SearchAppBar from '../components/SearchAppBar.vue'
import EmptyState from '../components/EmptyState.vue'
import MangaCollection from '../components/MangaCollection.vue'
import LibrarySettingsSheet from '../components/LibrarySettingsSheet.vue'
import { usePreferencesStore } from '../stores/preferences'
import ServerSettingsDialog from '../components/ServerSettingsDialog.vue'
const server = useSuwayomiStore(), preferences = usePreferencesStore(), search = ref(''), filtersOpen = ref(false), settingsOpen = ref(false)
const details = useLibraryDetails()
const sort = computed(() => preferences.getLibrarySort(server.apiUrl, server.activeCategoryId))
const requiresDetails = computed(() => preferences.filters.bookmarked !== 'all' || preferences.showContinue || ['latestChapter', 'chapterFetched'].includes(sort.value.type) || (sort.value.type === 'lastRead' && server.library.some(m => m.lastReadAt == null)))
const matches = (m: Manga) => m.title.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()) && matchesLibrary(m, preferences.filters, preferences.downloadedOnly, details.summaries[m.id], server.sources)
const visibleManga = computed(() => sortLibrary(server.library.filter(matches), sort.value, details.summaries))
const hasFilters = computed(() => preferences.downloadedOnly || Object.values(preferences.filters).some(v => v !== 'all'))
const detailsIncomplete = computed(() => requiresDetails.value && server.library.some(m => !details.summaries[m.id]))
function clearFilters() { search.value = ''; preferences.filters = defaultFilters() }
function categoryCount(id: number) {
  const items = server.libraryByCategory[id] || []
  if (preferences.filters.bookmarked !== 'all' && items.some(m => !details.summaries[m.id])) return details.pendingCount ? '…' : '?'
  return items.filter(matches).length
}
function loadDetails(retry = false) {
  if (requiresDetails.value) {
    const items = preferences.categoryCounts && preferences.filters.bookmarked !== 'all' ? Object.values(server.libraryByCategory).flat() : server.library
    void details.ensure(server.apiUrl, items.map(m => m.id), retry)
  }
}
async function reload() { details.clear(); await server.loadLibrary(); loadDetails() }
watch(() => [server.apiUrl, server.library, requiresDetails.value, preferences.categoryCounts], () => loadDetails(), { immediate: true })
watch(() => [preferences.localBadge, preferences.languageBadge, server.apiUrl], () => { if ((preferences.localBadge || preferences.languageBadge) && !server.sources.length) void server.loadSources() }, { immediate: true })
onMounted(() => { void reload() })
</script>
<template>
  <section>
    <SearchAppBar v-model="search" title="Library" label="Search library" open-label="Open library search">
      <template #title><v-chip v-if="server.connected" size="small" class="ml-2" variant="tonal" :aria-label="`${server.totalLibraryCount} manga in library`">{{ server.totalLibraryCount }}</v-chip></template>
      <v-btn variant="text" icon="filter_list" :color="hasFilters ? 'primary' : undefined" aria-label="Filter and sort library" @click="filtersOpen = true" />
      <v-menu><template #activator="{ props }"><v-btn v-bind="props" icon="more_vert" aria-label="Library options" /></template><v-list><v-list-item title="Reload library from server" prepend-icon="refresh" :disabled="server.loadingLibrary" @click="reload" /><v-list-item title="Library settings" prepend-icon="settings" to="/settings/library" /></v-list></v-menu>
    </SearchAppBar>
    <v-tabs v-if="server.categories.length && preferences.categoryTabs" v-model="server.activeCategoryId" color="primary" align-tabs="start" aria-label="Library categories">
      <v-tab v-for="category in server.categories" :key="category.id" :value="category.id" class="text-none">
        {{ category.name }} <v-chip v-if="preferences.categoryCounts" size="x-small" variant="tonal" class="ml-2">{{ categoryCount(category.id) }}</v-chip>
      </v-tab>
    </v-tabs>
    <v-menu v-if="!preferences.categoryTabs && server.categories.length > 1"><template #activator="{ props }"><v-btn v-bind="props" variant="text" append-icon="arrow_drop_down" aria-label="Choose library category">{{ server.categories.find(c => c.id === server.activeCategoryId)?.name }}</v-btn></template><v-list><v-list-item v-for="category in server.categories" :key="category.id" :title="category.name" @click="server.activeCategoryId = category.id" /></v-list></v-menu>
    <v-progress-linear v-if="details.pendingCount" indeterminate color="primary" aria-label="Loading chapter sorting data" />
    <v-alert v-if="requiresDetails && Object.keys(details.errors).length" type="warning" variant="tonal" class="ma-4">Some chapter data could not be loaded. Missing data is not treated as zero or false.<v-btn variant="text" @click="loadDetails(true)">Retry chapter data</v-btn></v-alert>
    <v-progress-linear v-if="server.loadingLibrary" indeterminate color="primary" aria-label="Loading library" />
    <v-alert v-if="server.libraryError && server.library.length" type="warning" variant="tonal" class="ma-4">Showing previously loaded data. {{ server.libraryError }}</v-alert>
    <EmptyState v-if="server.libraryError && !server.library.length" icon="cloud_off" title="Your library, on your server" :description="server.libraryError">
      <v-btn color="primary" rounded="pill" @click="settingsOpen = true">Connect to Suwayomi</v-btn>
      <div class="mt-3"><v-btn variant="text" :loading="server.loadingLibrary" @click="reload">Try again</v-btn></div>
    </EmptyState>
    <div v-else-if="server.loadingLibrary && !server.library.length" class="pa-4" role="status">Loading your library…</div>
    <EmptyState v-else-if="!server.library.length" icon="collections_bookmark" :title="server.totalLibraryCount ? 'This category is empty' : 'Your library is empty'" description="Browse sources or choose another category to find manga.">
      <v-btn to="/browse" color="primary" rounded="pill">Browse sources</v-btn>
    </EmptyState>
    <EmptyState v-else-if="detailsIncomplete && details.pendingCount && !visibleManga.length" icon="hourglass_empty" title="Loading chapter data" description="Checking the selected filters and sort order." />
    <EmptyState v-else-if="!visibleManga.length" icon="search_off" title="No matches" description="Try a different search or clear your filters.">
      <v-btn color="primary" variant="text" @click="clearFilters">Clear filters</v-btn>
    </EmptyState>
    <MangaCollection v-else :items="visibleManga" :display="preferences.libraryDisplay" :summaries="details.summaries" />
    <LibrarySettingsSheet v-model="filtersOpen" />
    <ServerSettingsDialog v-model="settingsOpen" />
  </section>
</template>
