<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSuwayomiStore } from '../stores/suwayomi'
import SearchAppBar from '../components/SearchAppBar.vue'
import EmptyState from '../components/EmptyState.vue'
import MangaCollection from '../components/MangaCollection.vue'
import LibrarySettingsSheet from '../components/LibrarySettingsSheet.vue'
import { usePreferencesStore } from '../stores/preferences'
import ServerSettingsDialog from '../components/ServerSettingsDialog.vue'
const server = useSuwayomiStore(), preferences = usePreferencesStore(), search = ref(''), filtersOpen = ref(false), settingsOpen = ref(false)
const unread = ref<'all' | 'include' | 'exclude'>('all'), completed = ref<'all' | 'include' | 'exclude'>('all')
const sort = ref<'title' | 'unread' | 'total' | 'added'>('title'), descending = ref(false)
function triState(value: boolean | null, state: 'all' | 'include' | 'exclude') { return state === 'all' || (value !== null && value === (state === 'include')) }
const visibleManga = computed(() => server.library.filter(m => m.title.toLocaleLowerCase().includes(search.value.toLocaleLowerCase())
  && (!preferences.downloadedOnly || (m.downloadCount ?? 0) > 0)
  && triState(m.unreadCount === null ? null : m.unreadCount > 0, unread.value)
  && triState(m.status === 'COMPLETED' || m.status === 'PUBLISHING_FINISHED', completed.value))
  .slice().sort((a, b) => {
    let result = a.title.localeCompare(b.title)
    if (sort.value !== 'title') {
      const av = sort.value === 'unread' ? a.unreadCount : sort.value === 'total' ? a.chapterCount : a.inLibraryAt
      const bv = sort.value === 'unread' ? b.unreadCount : sort.value === 'total' ? b.chapterCount : b.inLibraryAt
      if (av === null || bv === null) return av === bv ? a.title.localeCompare(b.title) : av === null ? 1 : -1
      result = av - bv || result
    }
    return descending.value ? -result : result
  }))
function clearFilters() { search.value = ''; unread.value = 'all'; completed.value = 'all'; preferences.downloadedOnly = false }
onMounted(() => { if (!server.categories.length) void server.loadLibrary() })
</script>
<template>
  <section>
    <SearchAppBar v-model="search" title="Library" label="Search library" open-label="Open library search">
      <template #title><v-chip v-if="server.connected" size="small" class="ml-2" variant="tonal" :aria-label="`${server.totalLibraryCount} manga in library`">{{ server.totalLibraryCount }}</v-chip></template>
      <v-btn variant="text" icon="filter_list" :color="unread !== 'all' || completed !== 'all' || preferences.downloadedOnly ? 'primary' : undefined" aria-label="Filter and sort library" @click="filtersOpen = true" />
      <v-menu><template #activator="{ props }"><v-btn v-bind="props" icon="more_vert" aria-label="Library options" /></template><v-list><v-list-item title="Reload library from server" prepend-icon="refresh" :disabled="server.loadingLibrary" @click="server.loadLibrary" /><v-list-item title="Library settings" prepend-icon="settings" to="/settings/library" /></v-list></v-menu>
    </SearchAppBar>
    <v-tabs v-if="server.categories.length" v-model="server.activeCategoryId" color="primary" align-tabs="start" aria-label="Library categories">
      <v-tab v-for="category in server.categories" :key="category.id" :value="category.id" class="text-none">
        {{ category.name }} <v-chip size="x-small" variant="tonal" class="ml-2">{{ server.libraryByCategory[category.id]?.length ?? 0 }}</v-chip>
      </v-tab>
    </v-tabs>
    <v-progress-linear v-if="server.loadingLibrary" indeterminate color="primary" aria-label="Loading library" />
    <v-alert v-if="server.libraryError && server.library.length" type="warning" variant="tonal" class="ma-4">Showing previously loaded data. {{ server.libraryError }}</v-alert>
    <EmptyState v-if="server.libraryError && !server.library.length" icon="cloud_off" title="Your library, on your server" :description="server.libraryError">
      <v-btn color="primary" rounded="pill" @click="settingsOpen = true">Connect to Suwayomi</v-btn>
      <div class="mt-3"><v-btn variant="text" :loading="server.loadingLibrary" @click="server.loadLibrary">Try again</v-btn></div>
    </EmptyState>
    <div v-else-if="server.loadingLibrary && !server.library.length" class="pa-4" role="status">Loading your library…</div>
    <EmptyState v-else-if="!server.library.length" icon="collections_bookmark" :title="server.totalLibraryCount ? 'This category is empty' : 'Your library is empty'" description="Browse sources or choose another category to find manga.">
      <v-btn to="/browse" color="primary" rounded="pill">Browse sources</v-btn>
    </EmptyState>
    <EmptyState v-else-if="!visibleManga.length" icon="search_off" title="No matches" description="Try a different search or clear your filters.">
      <v-btn color="primary" variant="text" @click="clearFilters">Clear filters</v-btn>
    </EmptyState>
    <MangaCollection v-else :items="visibleManga" :display="preferences.libraryDisplay" />
    <LibrarySettingsSheet v-model="filtersOpen" v-model:unread="unread" v-model:completed="completed" v-model:sort="sort" v-model:descending="descending" />
    <ServerSettingsDialog v-model="settingsOpen" />
  </section>
</template>
