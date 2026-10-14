<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useSuwayomiStore } from '../stores/suwayomi'
import { useUpdatesStore } from '../stores/updates'
import SearchAppBar from '../components/SearchAppBar.vue'
import EmptyState from '../components/EmptyState.vue'
import { fetchedDateKey, fetchedDateLabel } from '../utils/dates'
const server = useSuwayomiStore(), updates = useUpdatesStore(), query = ref(''), downloadedOnly = ref(false)
const broken = ref(new Set<number>())
const visible = computed(() => updates.entries.filter(e => (!downloadedOnly.value || e.chapter.downloaded) && `${e.manga.title} ${e.chapter.name}`.toLocaleLowerCase().includes(query.value.toLocaleLowerCase())))
const grouped = computed(() => {
  const groups: { key: string; label: string; entries: typeof updates.entries }[] = []
  for (const entry of visible.value) {
    const key = fetchedDateKey(entry.chapter.fetchedAt)
    let group = groups.find(g => g.key === key)
    if (!group) { group = { key, label: fetchedDateLabel(entry.chapter.fetchedAt), entries: [] }; groups.push(group) }
    group.entries.push(entry)
  }
  return groups
})
watch(() => server.apiUrl, () => { broken.value = new Set(); void updates.refresh(server.apiUrl) }, { immediate: true })
onUnmounted(() => updates.dispose())
</script>
<template>
  <section>
    <SearchAppBar v-model="query" title="Updates" label="Search loaded updates" open-label="Open updates search">
      <v-menu><template #activator="{ props }"><v-btn v-bind="props" icon="filter_list" variant="text" :color="downloadedOnly ? 'primary' : undefined" aria-label="Filter updates" /></template><v-list><v-list-item :title="downloadedOnly ? 'Show all chapters' : 'Downloaded chapters only'" :prepend-icon="downloadedOnly ? 'check' : 'download'" @click="downloadedOnly = !downloadedOnly" /></v-list></v-menu>
      <v-btn icon="refresh" variant="text" aria-label="Reload updates feed" :loading="updates.loading" @click="updates.refresh(server.apiUrl)" />
    </SearchAppBar>
    <v-progress-linear v-if="updates.loading" color="primary" indeterminate aria-label="Loading updates" />
    <p class="text-body-2 text-on-surface-variant px-4 py-3">Recent library chapters · {{ updates.entries.length }} loaded<span v-if="updates.hasNextPage"> · More available</span></p>
    <EmptyState v-if="updates.error && !updates.entries.length" icon="cloud_off" title="Updates unavailable" :description="updates.error"><v-btn color="primary" @click="updates.refresh(server.apiUrl)">Try again</v-btn></EmptyState>
    <EmptyState v-else-if="!updates.loading && !updates.entries.length" icon="update" title="No recent updates" description="Suwayomi returned no recent library chapters. This refresh reloads the feed; it does not start a server library update." />
    <EmptyState v-else-if="!updates.loading && !visible.length" icon="search_off" title="No matching updates" description="Search and filters apply to loaded chapters. Clear them or load more below."><v-btn variant="text" color="primary" @click="query = ''; downloadedOnly = false">Clear filters</v-btn></EmptyState>
    <div v-else class="updates-feed">
      <section v-for="group in grouped" :key="group.key" :aria-label="group.label">
        <h2 class="text-subtitle-2 text-primary px-4 pt-4 pb-2">{{ group.label }}</h2>
        <div v-for="entry in group.entries" :key="`${entry.manga.id}:${entry.chapter.id}`" class="update-row d-flex align-center px-4">
          <router-link :to="`/manga/${entry.manga.id}`" class="update-cover flex-shrink-0" :aria-label="`Open ${entry.manga.title}`">
            <v-img v-if="!broken.has(entry.manga.id)" :src="server.thumbnailUrl(entry.manga.id)" width="44" height="44" cover rounded="sm" alt="" @error="broken.add(entry.manga.id)" />
            <v-icon v-else icon="image_not_supported" />
          </router-link>
          <router-link :to="`/manga/${entry.manga.id}/read/${entry.chapter.index}`" class="update-text flex-grow-1 ml-4 py-2" :aria-label="`Read ${entry.chapter.name} — ${entry.manga.title}`">
            <p class="text-body-2 text-truncate">{{ entry.manga.title }}</p>
            <p class="text-body-2 text-on-surface-variant text-truncate">{{ entry.chapter.name }}</p>
          </router-link>
          <v-icon v-if="entry.chapter.downloaded" icon="download_done" color="primary" size="22" class="ml-3" aria-label="Downloaded" />
        </div>
      </section>
    </div>
    <div v-if="updates.entries.length" class="pa-4 text-center">
      <v-alert v-if="updates.error" type="error" variant="tonal" class="mb-4 text-start">{{ updates.error }} Previously loaded chapters are retained.</v-alert>
      <v-btn v-if="updates.hasNextPage" :loading="updates.loading" color="primary" variant="tonal" @click="updates.loadMore">{{ updates.error ? 'Retry next page' : 'Load more updates' }}</v-btn>
      <p v-else class="text-body-2 text-on-surface-variant">End of recent updates</p>
    </div>
  </section>
</template>
