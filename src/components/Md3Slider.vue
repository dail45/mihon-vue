<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(defineProps<{ min?: number; max: number; step?: number; disabled?: boolean; reverse?: boolean; label: string; valueText?: string }>(), { min: 0, step: 1 })
const value = defineModel<number>({ required: true })
const fraction = computed(() => props.max <= props.min ? 0 : Math.min(1, Math.max(0, (value.value - props.min) / (props.max - props.min))))
const percent = computed(() => `${fraction.value * 100}%`)
const stops = computed(() => {
  const count = Math.round((props.max - props.min) / props.step)
  // Hide intermediate stops when they would crowd the track (e.g. long chapters).
  return count > 0 && count <= 20 ? Array.from({ length: count + 1 }, (_, i) => i / count) : [0, 1]
})
</script>
<template>
  <div class="md3-slider" :class="{ 'md3-slider-disabled': disabled, 'md3-slider-reverse': reverse }" :style="{ '--slider-position': percent }">
    <div class="md3-slider-visual" aria-hidden="true"><div class="md3-slider-active" /><div class="md3-slider-inactive" /><i v-for="stop in stops" :key="stop" class="md3-slider-stop" :class="{ 'stop-active': stop < fraction }" :style="{ left: `${stop * 100}%` }" /><div class="md3-slider-handle" /></div>
    <input type="range" :aria-label="label" :aria-valuetext="valueText" :min="min" :max="max" :step="step" :disabled="disabled || max <= min" :value="value" :dir="reverse ? 'rtl' : 'ltr'" @input="value = Number(($event.target as HTMLInputElement).value)" />
  </div>
</template>
<style scoped>
@layer app-components {
.md3-slider { position: relative; height: 48px; min-width: 48px; flex: 1; --slider-active: rgb(var(--v-theme-primary)); --slider-inactive: rgb(var(--v-theme-secondary-container)); }
.md3-slider-visual { position: absolute; inset: 0 10px; pointer-events: none; }
.md3-slider-active, .md3-slider-inactive { position: absolute; top: 16px; height: 16px; border-radius: 8px; }
.md3-slider-active { left: 0; width: max(0px, calc(var(--slider-position) - 8px)); background: var(--slider-active); }
.md3-slider-inactive { left: calc(var(--slider-position) + 8px); right: 0; background: var(--slider-inactive); }
.md3-slider-handle { position: absolute; top: 2px; left: var(--slider-position); transform: translateX(-50%); height: 44px; width: 4px; border-radius: 2px; background: var(--slider-active); }
.md3-slider-stop { position: absolute; top: 22px; width: 4px; height: 4px; transform: translateX(-50%); border-radius: 50%; background: rgb(var(--v-theme-on-secondary-container)); }
.md3-slider-stop.stop-active { background: rgb(var(--v-theme-on-primary)); }
.md3-slider-stop { clip-path: inset(0); }
.md3-slider input { position: absolute; inset: 0; width: 100%; height: 48px; margin: 0; opacity: 0; cursor: pointer; }
.md3-slider:focus-within .md3-slider-handle { outline: 2px solid rgb(var(--v-theme-on-surface)); outline-offset: 4px; }
.md3-slider:has(input:active) .md3-slider-handle { width: 2px; }
.md3-slider-disabled { opacity: .38; }
.md3-slider-disabled input { cursor: default; }
.md3-slider-reverse .md3-slider-visual { transform: scaleX(-1); }
}
</style>
