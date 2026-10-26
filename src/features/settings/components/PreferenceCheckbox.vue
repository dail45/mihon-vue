<script setup lang="ts">
defineProps<{
  label: string
  disabled?: boolean
}>()

const checked = defineModel<boolean>({ required: true })
</script>

<template>
  <!-- Pixel parity with Mihon Compose CheckboxItem (replaces legacy <v-checkbox) -->
  <button
    type="button"
    role="checkbox"
    class="settings-row checkbox-item"
    :class="{ 'checkbox-item--disabled': disabled }"
    :aria-checked="checked"
    :aria-label="label"
    :disabled="disabled"
    @click="checked = !checked"
  >
    <span class="settings-checkbox-slot">
      <span class="m3-checkbox" :class="{ 'm3-checkbox--checked': checked }">
        <svg
          v-if="checked"
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
      </span>
    </span>
    <span class="settings-row-label">{{ label }}</span>
  </button>
</template>

<style scoped>
@layer app-components {
.checkbox-item {
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
.checkbox-item:hover:not(:disabled) {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.checkbox-item:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
.checkbox-item--disabled {
  opacity: 0.38;
  cursor: default;
}
.settings-checkbox-slot {
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
.m3-checkbox--checked {
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
  color: rgb(var(--v-theme-on-surface));
}
}
</style>
