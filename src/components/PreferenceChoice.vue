<script setup lang="ts">
import { computed, ref } from 'vue'
const props = defineProps<{ title: string; items: { title: string; value: string }[]; disabled?: boolean }>()
const value = defineModel<string>({ required: true }), open = ref(false)
const selected = computed(() => props.items.find(i => i.value === value.value)?.title)
</script>
<template>
  <v-list-item :title="title" :subtitle="selected" :disabled="disabled" min-height="72" @click="open = true" />
  <v-dialog v-model="open" max-width="460" :aria-label="title"><v-card rounded="xl" :title="title"><v-card-text class="px-0"><v-radio-group :model-value="value" hide-details :aria-label="title" @update:model-value="value = String($event); open = false"><v-radio v-for="item in items" :key="item.value" :label="item.title" :value="item.value" class="px-6" /></v-radio-group></v-card-text><v-card-actions><v-spacer /><v-btn @click="open = false">Cancel</v-btn></v-card-actions></v-card></v-dialog>
</template>
