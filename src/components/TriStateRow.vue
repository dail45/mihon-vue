<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { nextTriState, type TriState } from '../utils/library'
const props = defineProps<{ label: string; disabled?: boolean }>()
const value = defineModel<TriState>({ required: true })
const control = ref<HTMLElement | null>(null)
// Vuetify's boolean update can skip adjacent tri-states. Control activation and
// bridge the native input properties after canceled click pre-activation settles.
function syncNativeState() {
  requestAnimationFrame(() => {
    const input = control.value?.querySelector<HTMLInputElement>('input')
    if (input) { input.checked = value.value === 'include'; input.indeterminate = value.value === 'exclude' }
  })
}
function advance(event: MouseEvent) {
  if (props.disabled) return
  ;(event.currentTarget as HTMLElement)?.querySelector<HTMLInputElement>('input')?.focus()
  value.value = nextTriState(value.value)
}
watch(value, syncNativeState, { flush: 'post' })
onMounted(syncNativeState)
</script>
<template>
  <div ref="control" @click.capture.prevent="advance">
  <v-checkbox :model-value="value === 'include'" :indeterminate="value === 'exclude'" indeterminate-icon="disabled_by_default" :label="label" :disabled="disabled" :aria-description="value === 'all' ? 'No filter' : value === 'include' ? 'Include matching items' : 'Exclude matching items'" class="settings-checkbox" density="comfortable" hide-details @update:model-value="syncNativeState" @update:indeterminate="syncNativeState" />
  </div>
</template>
