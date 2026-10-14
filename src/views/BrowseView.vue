<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useSuwayomiStore } from '../stores/suwayomi'
import EmptyState from '../components/EmptyState.vue'
const server = useSuwayomiStore(), query = ref('')
onMounted(() => { void server.loadSources() })
watch(() => server.apiUrl, () => { void server.loadSources() })
</script>
<template>
  <v-tabs model-value="sources" color="primary"><v-tab value="sources" class="text-none">Sources</v-tab></v-tabs>
  <v-container class="pa-4" style="max-width: 800px">
    <v-text-field v-model="query" label="Search installed sources" prepend-inner-icon="search" hide-details clearable @click:clear="query = ''" class="mb-4" />
    <v-progress-linear v-if="server.loadingSources" indeterminate color="primary" />
    <EmptyState v-if="server.sourcesError" icon="cloud_off" title="Sources unavailable" :description="server.sourcesError"><v-btn @click="server.loadSources" color="primary">Try again</v-btn></EmptyState>
    <EmptyState v-else-if="!server.loadingSources && !server.sources.length" icon="explore" title="No installed sources" description="Manage sources on Suwayomi-Server. This client does not install or manage extensions." />
    <template v-else-if="server.sources.length">
      <p class="text-body-2 text-on-surface-variant mb-4">Browse your installed sources. Popular titles, latest updates, and search are fetched through Suwayomi.</p>
      <v-list bg-color="transparent">
        <v-list-item v-for="source in server.sources.filter(s => s.displayName.toLowerCase().includes(query.toLowerCase()))" :key="source.id" :to="`/browse/source/${encodeURIComponent(source.id)}`" :title="source.displayName" :subtitle="`${source.lang.toUpperCase()}${source.isNsfw ? ' · NSFW' : ''}`" prepend-icon="public" />
      </v-list>
      <p v-if="!server.sources.some(s => s.displayName.toLowerCase().includes(query.toLowerCase()))" class="text-center py-6">No matching sources.</p>
    </template>
  </v-container>
</template>
