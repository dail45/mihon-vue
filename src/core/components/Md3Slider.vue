<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(defineProps<{ min?: number; max: number; step?: number; disabled?: boolean; reverse?: boolean; label: string; valueText?: string; stopCount?: number }>(), { min: 0, step: 1 })
// MD3 Slider tick marks: one tick per discrete value, so a Compose slider with `steps = n`
// draws n + 1 ticks. `stopCount` is the number of intervals (the Compose `steps` value).
const intervalCount = computed(() => props.stopCount ?? Math.round((props.max - props.min) / props.step))
const value = defineModel<number>({ required: true })
const fraction = computed(() => props.max <= props.min ? 0 : Math.min(1, Math.max(0, (value.value - props.min) / (props.max - props.min))))
const percent = computed(() => `${fraction.value * 100}%`)
const stops = computed(() => {
  const count = intervalCount.value
  // Hide intermediate stops when they would crowd the track (e.g. long chapters).
  return count > 0 && count <= 20 ? Array.from({ length: count + 1 }, (_, i) => i / count) : [0, 1]
})
</script>
<template>
  <div class="md3-slider" :class="{ 'md3-slider-disabled': disabled, 'md3-slider-reverse': reverse }" :style="{ '--slider-position': percent }">
    <div class="md3-slider-visual" aria-hidden="true">
      <div class="md3-slider-active" />
      <div class="md3-slider-inactive" />
      <i
        v-for="stop in stops"
        :key="stop"
        class="md3-slider-stop"
        :class="{
          'stop-active': stop < fraction,
          'stop-hidden': Math.abs(stop - fraction) < 0.001
        }"
        :style="{ left: `calc(8px + (100% - 16px) * ${stop})` }"
      />
      <div class="md3-slider-handle" />
    </div>
    <input
      type="range"
      :aria-label="label"
      :aria-valuetext="valueText"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled || max <= min"
      :value="value"
      :dir="reverse ? 'rtl' : 'ltr'"
      @input="value = Number(($event.target as HTMLInputElement).value)"
    />
  </div>
</template>
<style scoped>
@layer app-components {
/* Material Design 3 Slider: container 56dp height ensures 44dp handle has 6dp clearance above and below */
.md3-slider {
  position: relative;
  height: 56px;
  min-height: 56px;
  min-width: 48px;
  flex: 1;
  box-sizing: border-box;
  --slider-active: rgb(var(--v-theme-primary));
  --slider-inactive: rgb(var(--v-theme-secondary-container));
}
.md3-slider-visual {
  position: absolute;
  inset: 0 10px;
  pointer-events: none;
}
/* MD3 track: 16dp height, corner radius 8dp, centered vertically in 56dp container (top: 20px) */
.md3-slider-active,
.md3-slider-inactive {
  position: absolute;
  top: 20px;
  height: 16px;
  border-radius: 8px;
}
.md3-slider-active {
  left: 0;
  width: max(0px, calc(var(--slider-position) - 8px));
  background: var(--slider-active);
}
.md3-slider-inactive {
  left: calc(var(--slider-position) + 8px);
  right: 0;
  background: var(--slider-inactive);
}
/* MD3 handle: 44dp height, 4dp width resting / 2dp pressed or focused, centered vertically (top: 6px) */
.md3-slider-handle {
  position: absolute;
  top: 6px;
  left: var(--slider-position);
  transform: translateX(-50%);
  height: 44px;
  width: 4px;
  border-radius: 2px;
  background: var(--slider-active);
  transition: width 100ms cubic-bezier(0.2, 0, 0, 1), background-color 150ms ease;
  outline: none;
}
/* MD3 tick marks: 4dp diameter, centered at 28px vertically (top: 26px).
   Per MD3 specs, first/last ticks are inset by 8dp (half track height) from track ends */
.md3-slider-stop {
  position: absolute;
  top: 26px;
  width: 4px;
  height: 4px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: rgb(var(--v-theme-on-secondary-container));
  transition: opacity 100ms ease;
}
.md3-slider-stop.stop-active {
  background: rgb(var(--v-theme-on-primary));
}
.md3-slider-stop.stop-hidden {
  opacity: 0;
}
.md3-slider input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
  outline: none;
}
.md3-slider input:focus,
.md3-slider input:focus-visible {
  outline: none;
}
.md3-slider:focus-within .md3-slider-handle {
  outline: none;
}
/* On Tab focus or active drag, handle compresses to 2dp without any fat outline */
.md3-slider:has(input:focus) .md3-slider-handle,
.md3-slider:has(input:active) .md3-slider-handle {
  width: 2px;
}
.md3-slider-disabled {
  opacity: .38;
}
.md3-slider-disabled input {
  cursor: default;
}
.md3-slider-reverse .md3-slider-visual {
  transform: scaleX(-1);
}
}
</style>
