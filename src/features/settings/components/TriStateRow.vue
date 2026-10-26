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
      <span
        class="m3-checkbox"
        :class="{
          'm3-checkbox--checked': value === 'include',
          'm3-checkbox--excluded': value === 'exclude',
        }"
      >
        <!-- include: MD3 checkmark -->
        <svg
          v-if="value === 'include'"
          class="m3-checkbox-icon"
          viewBox="0 0 18 18"
          aria-hidden="true"
        >
          <path
            d="M 3.5 9.5 L 7 13 L 14.5 5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <!-- exclude: MD3 cross -->
        <svg
          v-else-if="value === 'exclude'"
          class="m3-checkbox-icon"
          viewBox="0 0 18 18"
          aria-hidden="true"
        >
          <path
            d="M 4.5 4.5 L 13.5 13.5 M 13.5 4.5 L 4.5 13.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
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
.m3-checkbox {
  width: 18px;
  height: 18px;
  border-radius: 2px;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
  display: grid;
  place-items: center;
  color: rgb(var(--v-theme-on-primary));
  transition: background-color 150ms ease, border-color 150ms ease;
  box-sizing: border-box;
}
.m3-checkbox--checked,
.m3-checkbox--excluded {
  background: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
}
.m3-checkbox-icon {
  width: 14px;
  height: 14px;
  display: block;
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
