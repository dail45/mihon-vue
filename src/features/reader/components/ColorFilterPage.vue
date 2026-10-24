<script setup lang="ts">
// Port of mihon/app/src/main/java/eu/kanade/presentation/reader/settings/ColorFilterPage.kt
// (Mihon 446f6df). Reference block order and conditional visibility are kept 1:1:
//
//   CheckboxItem(pref_custom_brightness)
//     -> SliderItem(customBrightnessValue, -75..100, pillColor = surfaceContainerHighest)
//   CheckboxItem(pref_custom_color_filter)
//     -> SliderItem(colorFilterValue.red,   0..255, label = color_filter_r_value)
//     -> SliderItem(colorFilterValue.green, 0..255, label = color_filter_g_value)
//     -> SliderItem(colorFilterValue.blue,  0..255, label = color_filter_b_value)
//     -> SliderItem(colorFilterValue.alpha, 0..255, label = color_filter_a_value)
//     -> SettingsChipRow(pref_color_filter_mode) { FilterChip(ColorFilterMode.entries) }
//   CheckboxItem(pref_grayscale)
//   CheckboxItem(pref_inverted_colors)
//
// Element geometry comes from tachiyomi.presentation.core.components.SettingsItems.kt
// (BaseSettingsItem, SliderItem, SettingsChipRow, HeadingItem), components/Pill.kt and
// components/material/Constants.kt:
//   SettingsItemsPaddings.Horizontal = 24dp, Vertical = 10dp
//   MaterialTheme.padding.small = 8dp (chip row spacing, slider header spacing)
//   Pill shape = extraLarge (28dp radius), content padding 6dp/1dp, start padding 4dp
//   Typography.header = bodyMedium (14/20) Semibold onSurfaceVariant
//
// The reference page is a ColumnScope body inside ReaderSettingsDialog's vertical scroll, so the
// component only renders the column content and leaves scrolling/paging to the host.
import { computed } from 'vue'
import Md3Slider from '@/core/components/Md3Slider.vue'
import { colorFilterModes, useColorFilter } from '@/features/reader/composables/useColorFilter'

const {
  customBrightness,
  customBrightnessValue,
  colorFilter,
  colorFilterMode,
  grayscale,
  invertedColors,
  red,
  green,
  blue,
  alpha,
  setChannel,
} = useColorFilter()

// ReaderPreferences.Companion.ColorFilterMode: Default, Multiply, Screen and, on API >= 28,
// Overlay, Dodge / Lighten, Burn / Darken. The web reader always offers all six entries.
const modes = colorFilterModes

// MR.strings.color_filter_r_value / _g_value / _b_value / _a_value.
const channels = computed(() => [
  { key: 'red' as const, label: 'Red', value: red.value },
  { key: 'green' as const, label: 'Green', value: green.value },
  { key: 'blue' as const, label: 'Blue', value: blue.value },
  { key: 'alpha' as const, label: 'Alpha', value: alpha.value },
])

/**
 * BaseSliderItem performs a haptic feedback of type TextHandleMove on every value change.
 * The web equivalent is a short vibration tick; unsupported browsers simply do nothing.
 */
function hapticTick() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(10)
  }
}
</script>

<template>
  <div class="color-filter-page" role="group" aria-label="Custom filter">
    <!-- CheckboxItem(pref_custom_brightness) -->
    <button type="button" role="checkbox" class="cf-item" :aria-checked="customBrightness" @click="customBrightness = !customBrightness">
      <span class="cf-checkbox" :class="{ 'cf-checkbox--checked': customBrightness }">
        <svg v-if="customBrightness" class="cf-checkbox-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" /></svg>
      </span>
      <span class="cf-item-label">Custom brightness</span>
    </button>

    <!-- SliderItem(customBrightnessValue, -75..100) shown only while the checkbox is on. -->
    <div v-if="customBrightness" class="cf-slider">
      <div class="cf-slider-header">
        <span class="cf-slider-title">Custom brightness</span>
        <span class="cf-pill">{{ customBrightnessValue }}</span>
      </div>
      <Md3Slider v-model="customBrightnessValue" :min="-75" :max="100" :step="1" :stop-count="0" label="Custom brightness" :value-text="String(customBrightnessValue)" @update:model-value="hapticTick" />
    </div>

    <!-- CheckboxItem(pref_custom_color_filter) -->
    <button type="button" role="checkbox" class="cf-item" :aria-checked="colorFilter" @click="colorFilter = !colorFilter">
      <span class="cf-checkbox" :class="{ 'cf-checkbox--checked': colorFilter }">
        <svg v-if="colorFilter" class="cf-checkbox-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" /></svg>
      </span>
      <span class="cf-item-label">Custom color filter</span>
    </button>

    <template v-if="colorFilter">
      <!-- Four channel sliders, in the reference order: Red, Green, Blue, Alpha. -->
      <div v-for="channel in channels" :key="channel.key" class="cf-slider">
        <div class="cf-slider-header">
          <span class="cf-slider-title">{{ channel.label }}</span>
          <span class="cf-pill">{{ channel.value }}</span>
        </div>
        <Md3Slider :model-value="channel.value" :min="0" :max="255" :step="1" :stop-count="0" :label="channel.label" :value-text="String(channel.value)" @update:model-value="value => { setChannel(channel.key, value); hapticTick() }" />
      </div>

      <!-- SettingsChipRow(pref_color_filter_mode): HeadingItem + FlowRow of FilterChips. -->
      <h3 id="cf-color-filter-mode-heading" class="cf-heading">Color filter blend mode</h3>
      <div class="cf-chips" role="group" aria-labelledby="cf-color-filter-mode-heading">
        <!-- Material3 FilterChip(selected, onClick, label) draws the leading check icon
             automatically while selected. -->
        <button v-for="mode in modes" :key="mode.value" type="button" class="cf-chip" :class="{ 'cf-chip--selected': colorFilterMode === mode.value }" :aria-pressed="colorFilterMode === mode.value" @click="colorFilterMode = mode.value">
          <svg v-if="colorFilterMode === mode.value" class="cf-chip-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
          <span>{{ mode.title }}</span>
        </button>
      </div>
    </template>

    <!-- CheckboxItem(pref_grayscale) -->
    <button type="button" role="checkbox" class="cf-item" :aria-checked="grayscale" @click="grayscale = !grayscale">
      <span class="cf-checkbox" :class="{ 'cf-checkbox--checked': grayscale }">
        <svg v-if="grayscale" class="cf-checkbox-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" /></svg>
      </span>
      <span class="cf-item-label">Grayscale</span>
    </button>

    <!-- CheckboxItem(pref_inverted_colors) -->
    <button type="button" role="checkbox" class="cf-item" :aria-checked="invertedColors" @click="invertedColors = !invertedColors">
      <span class="cf-checkbox" :class="{ 'cf-checkbox--checked': invertedColors }">
        <svg v-if="invertedColors" class="cf-checkbox-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" /></svg>
      </span>
      <span class="cf-item-label">Inverted</span>
    </button>
  </div>
</template>

<style scoped>
@layer app-components {
/* BaseSettingsItem: Row, clickable, fillMaxWidth, padding horizontal 24dp / vertical 10dp,
   horizontalArrangement spacedBy 24dp, verticalAlignment Center, label bodyMedium (14/20).
   The MD3 Checkbox keeps a 48dp touch target, so the row measures 48 + 20 = 68dp. */
.color-filter-page {
  display: flex;
  flex-direction: column;
  width: 100%;
}
.cf-item {
  display: flex;
  align-items: center;
  gap: 24px;
  width: 100%;
  min-height: 68px;
  padding: 10px 24px;
  border: 0;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  text-align: start;
  cursor: pointer;
  user-select: none;
  transition: background-color 150ms ease;
}
.cf-item:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.cf-item:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.cf-item:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
.cf-item-label {
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: .25px;
}
/* MD3 Checkbox (CheckboxTokens): 18dp container, 2dp corner radius, 2dp outline,
   primary container + onPrimary check icon when selected. */
.cf-checkbox {
  position: relative;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
}
.cf-checkbox::before {
  content: '';
  grid-area: 1 / 1;
  box-sizing: border-box;
  width: 18px;
  height: 18px;
  border-radius: 2px;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
  transition: background-color 150ms ease, border-color 150ms ease;
}
.cf-checkbox--checked::before {
  background: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
}
.cf-checkbox-check {
  grid-area: 1 / 1;
  z-index: 1;
  width: 18px;
  height: 18px;
  color: rgb(var(--v-theme-on-primary));
}

/* BaseSliderItem: Column, fillMaxWidth, verticalArrangement spacedBy 2dp, label bodyMedium. */
.cf-slider {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 24px;
}
.cf-slider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.cf-slider-title {
  flex: 1 1 auto;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: .25px;
  color: rgb(var(--v-theme-on-surface));
}
/* Pill: surfaceContainerHighest (the reference passes it explicitly), shapes.extraLarge (28dp
   radius), content padding 6dp / 1dp, start padding 4dp, bodyMedium label. */
.cf-pill {
  flex: 0 0 auto;
  margin-left: 4px;
  padding: 1px 6px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-highest));
  color: rgb(var(--v-theme-on-surface));
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: .25px;
  text-align: center;
  white-space: nowrap;
}

/* HeadingItem: Typography.header = bodyMedium (14/20) Semibold onSurfaceVariant, padding 10dp / 24dp. */
.cf-heading {
  margin: 0;
  padding: 10px 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  letter-spacing: .25px;
  color: rgb(var(--v-theme-on-surface-variant));
}
/* SettingsChipRow: FlowRow, start 24dp, top 0dp, end 24dp, bottom 10dp, horizontal spacedBy 8dp, vertical spacedBy 8dp. */
.cf-chips {
  display: flex;
  flex-wrap: wrap;
  column-gap: 8px;
  row-gap: 8px;
  padding: 0 24px 10px;
}
/* MD3 FilterChip: 32dp height, CornerSmall (8dp) shape, 16dp horizontal content padding,
   LabelLarge (14/20, Medium) label. Unselected = transparent container with a 1dp outline
   border, selected = secondaryContainer container with a transparent border. */
.cf-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 16px;
  border: 1px solid rgb(var(--v-theme-outline));
  border-radius: 8px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: .1px;
  cursor: pointer;
  user-select: none;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}
.cf-chip:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.cf-chip:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.cf-chip:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
.cf-chip--selected {
  padding-left: 8px;
  border-color: transparent;
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}
.cf-chip--selected:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-secondary-container)) 8%, rgb(var(--v-theme-secondary-container)));
}
.cf-chip--selected:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-secondary-container)) 12%, rgb(var(--v-theme-secondary-container)));
}
.cf-chip-check {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  fill: currentColor;
}

/* The reference sliders are continuous (steps = 0), so no stop indicators are drawn. */
.color-filter-page :deep(.md3-slider-stop) { display: none; }
}
</style>
