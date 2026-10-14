<script setup lang="ts">
import { useRoute } from 'vue-router'
import EmptyState from '../components/EmptyState.vue'
const route = useRoute()
</script>
<template><EmptyState :icon="String(route.meta.icon)" :title="`${route.meta.title} is not implemented yet`" description="This tab preserves Mihon’s navigation structure. A server-backed feed will be added in a later implementation; this is not an empty server result."><v-btn to="/library" color="primary" variant="text">Back to library</v-btn></EmptyState></template>
