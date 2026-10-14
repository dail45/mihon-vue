<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSuwayomiStore } from '../stores/suwayomi'
import EmptyState from '../components/EmptyState.vue'
import MangaCard from '../components/MangaCard.vue'
import ServerSettingsDialog from '../components/ServerSettingsDialog.vue'
const server = useSuwayomiStore(), search = ref(''), filtersOpen = ref(false), unreadOnly = ref(false), sort = ref<'title' | 'unread'>('title'), settingsOpen = ref(false)
const visibleManga = computed(() => server.library.filter(m => m.title.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()) && (!unreadOnly.value || (m.unreadCount ?? 0) > 0)).slice().sort((a, b) => sort.value === 'unread' ? (b.unreadCount ?? 0) - (a.unreadCount ?? 0) || a.title.localeCompare(b.title) : a.title.localeCompare(b.title)))
onMounted(() => { if (!server.categories.length) void server.loadLibrary() })
</script>
<template>
  <section>
    <div class="d-flex align-center px-2 py-1">
      <v-text-field v-model="search" variant="solo" flat hide-details density="compact" label="Search library" prepend-inner-icon="search" clearable @click:clear="search = ''" />
      <v-btn variant="text" icon="filter_list" :color="unreadOnly ? 'primary' : undefined" aria-label="Filter and sort library" @click="filtersOpen = true" />
      <v-btn variant="text" icon="refresh" aria-label="Reload library from server" :loading="server.loadingLibrary" @click="server.loadLibrary" />
    </div>
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
    <EmptyState v-else-if="!server.library.length" icon="collections_bookmark" title="Your library is empty" description="Add manga to your library on Suwayomi. Your titles and categories will appear here.">
      <v-btn to="/browse" color="primary" rounded="pill">Browse sources</v-btn>
    </EmptyState>
    <EmptyState v-else-if="!visibleManga.length" icon="search_off" title="No matches" description="Try a different search or clear your filters.">
      <v-btn color="primary" variant="text" @click="search = ''; unreadOnly = false">Clear filters</v-btn>
    </EmptyState>
    <div v-else class="library-grid"><MangaCard v-for="item in visibleManga" :key="item.id" :manga="item" /></div>
    <v-bottom-sheet v-model="filtersOpen" max-width="640">
      <v-card rounded="t-xl" color="surface-container-high" title="Library filters">
        <v-card-text>
          <v-switch v-model="unreadOnly" color="primary" label="Unread chapters only" hide-details />
          <v-radio-group v-model="sort" label="Sort by" hide-details><v-radio label="Title" value="title"/><v-radio label="Unread chapters" value="unread"/></v-radio-group>
        </v-card-text>
        <v-card-actions><v-spacer/><v-btn color="primary" @click="filtersOpen = false">Done</v-btn></v-card-actions>
      </v-card>
    </v-bottom-sheet>
    <ServerSettingsDialog v-model="settingsOpen" />
  </section>
</template>
