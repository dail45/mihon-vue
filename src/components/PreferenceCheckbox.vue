<script setup lang="ts">
defineProps<{ label: string }>()
const checked = defineModel<boolean>({ required: true })
</script>
<template><v-checkbox v-model="checked" :label="label" class="settings-checkbox" density="comfortable" hide-details /></template>
