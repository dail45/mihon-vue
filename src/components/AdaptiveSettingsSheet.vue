<script setup lang="ts">
import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import { VDialog, VBottomSheet } from 'vuetify/components'
defineProps<{ title: string; tabs: string[] }>()
const opened = defineModel<boolean>({ required: true }), tab = defineModel<string>('tab', { required: true })
const { width } = useDisplay(), tablet = computed(() => width.value >= 720)
</script>
<template>
  <component :is="tablet ? VDialog : VBottomSheet" v-model="opened" max-width="460" :aria-label="title" scrollable>
    <v-card class="adaptive-settings-card" :class="{ 'mobile-settings-card': !tablet }" color="surface-container-high" rounded="xl">
      <h2 class="sr-only">{{ title }}</h2>
      <v-tabs v-model="tab" grow color="primary" height="48" :aria-label="`${title} sections`"><v-tab v-for="name in tabs" :key="name" :value="name.toLowerCase()">{{ name }}</v-tab></v-tabs>
      <div class="settings-scroll"><slot /></div>
      <v-card-actions><slot name="footer" /><v-spacer /><v-btn color="primary" @click="opened = false">Done</v-btn></v-card-actions>
    </v-card>
  </component>
</template>
