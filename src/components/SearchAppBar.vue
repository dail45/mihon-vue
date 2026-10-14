<script setup lang="ts">
import { nextTick, ref } from 'vue'
defineProps<{ title: string; label: string; openLabel: string }>()
const query = defineModel<string>({ required: true })
const opened = ref(false), input = ref<{ focus: () => void; blur: () => void } | null>(null)
async function open() { opened.value = true; await nextTick(); input.value?.focus() }
function close() { query.value = ''; opened.value = false }
</script>
<template>
  <v-app-bar flat height="64" color="surface" class="search-app-bar">
    <v-btn v-if="opened" icon="arrow_back" aria-label="Close search" @click="close" />
    <form v-if="opened" class="toolbar-search" role="search" @submit.prevent="input?.blur()"><v-text-field ref="input" v-model="query" type="search" enterkeyhint="search" autocomplete="off" :aria-label="label" placeholder="Search…" variant="plain" density="comfortable" hide-details class="toolbar-search-field" @keydown.esc="close" /></form>
    <v-app-bar-title v-else class="text-title-large font-weight-regular">{{ title }}<slot name="title" /></v-app-bar-title>
    <v-btn v-if="!opened" icon="search" :aria-label="openLabel" @click="open" />
    <v-btn v-else-if="query" icon="close" aria-label="Clear search" @click="query = ''; input?.focus()" />
    <slot />
  </v-app-bar>
</template>
