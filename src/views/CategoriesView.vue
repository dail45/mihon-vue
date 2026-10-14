<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSuwayomiStore } from '../stores/suwayomi'
import EmptyState from '../components/EmptyState.vue'
const server = useSuwayomiStore(), router = useRouter()
onMounted(() => { void server.loadLibrary() })
function open(id: number) { server.activeCategoryId = id; void router.push('/library') }
</script>
<template>
  <v-progress-linear v-if="server.loadingLibrary" color="primary" indeterminate />
  <v-container class="pa-4 settings-content">
    <p class="text-body-2 text-on-surface-variant mb-4">Categories from Suwayomi. Tap one to open its library. Category editing is not implemented here yet.</p>
    <EmptyState v-if="server.libraryError" icon="cloud_off" title="Categories unavailable" :description="server.libraryError"><v-btn color="primary" @click="server.loadLibrary">Try again</v-btn></EmptyState>
    <v-list v-else bg-color="transparent"><v-list-item v-for="item in server.categories" :key="item.id" :title="item.name" prepend-icon="label" min-height="64" @click="open(item.id)"><template #append><v-chip size="small">{{ server.libraryByCategory[item.id]?.length ?? 0 }}</v-chip></template></v-list-item></v-list>
  </v-container>
</template>
