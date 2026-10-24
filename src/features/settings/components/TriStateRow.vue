<script setup lang="ts">
import { computed } from 'vue'
import { nextTriState, type TriState } from '@/core/utils/library'

const props = defineProps<{
  label: string
  disabled?: boolean
}>()

const value = defineModel<TriState>({ required: true })

function advance() {
  if (props.disabled) return
  value.value = nextTriState(value.value)
}

const iconName = computed(() => {
  switch (value.value) {
    case 'include':
      return 'check_box'
    case 'exclude':
      return 'disabled_by_default'
    default:
      return 'check_box_outline_blank'
  }
})

const isFilled = computed(() => value.value === 'include' || value.value === 'exclude')

const iconColor = computed(() => {
  if (props.disabled || value.value === 'all') {
    return 'rgb(var(--v-theme-on-surface-variant))'
  }
  return 'rgb(var(--v-theme-primary))'
})

const ariaChecked = computed(() => {
  if (value.value === 'include') return 'true'
  if (value.value === 'exclude') return 'mixed'
  return 'false'
})
</script>

<template>
  <!-- Pixel parity with Mihon Compose TriStateItem (replaces legacy <v-checkbox) -->
  <button
    type="button"
    role="checkbox"
    class="settings-row tristate-item"
    :class="{ 'tristate-item--disabled': disabled }"
    :aria-checked="ariaChecked"
    :aria-label="label"
    :disabled="disabled"
    @click="advance"
  >
    <span class="settings-icon-slot">
      <v-icon
        :icon="iconName"
        :class="{ 'filled-symbol': isFilled }"
        :style="{ color: iconColor }"
        size="24"
      />
    </span>
    <span class="settings-row-label">{{ label }}</span>
  </button>
</template>

<style scoped>
@layer app-components {
.tristate-item {
  width: 100%;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 24px;
  min-height: 44px;
  padding: 10px 24px;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  text-align: start;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.tristate-item:hover:not(:disabled) {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.tristate-item:active:not(:disabled) {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.tristate-item:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
.tristate-item--disabled {
  opacity: 0.38;
  cursor: default;
}
.settings-icon-slot {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  display: grid;
  place-items: center;
}
.settings-row-label {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface));
}
}
</style>
