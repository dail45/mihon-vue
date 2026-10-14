<script setup lang="ts">
defineProps<{ icon: string; title: string; description: string }>()
</script>
<template>
  <section class="empty-state text-center px-6 py-12" aria-live="polite">
    <v-icon :icon="icon" size="64" color="on-surface-variant" class="mb-6" />
    <h1 class="text-title-large font-weight-medium mb-2">{{ title }}</h1>
    <p class="text-body-medium text-on-surface-variant mx-auto mb-6" style="max-width: 360px">{{ description }}</p>
    <slot/>
  </section>
</template>
