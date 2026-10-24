<script setup lang="ts">
/**
 * Custom Theme Seed Color Picker View.
 *
 * References:
 * - `komikku/app/src/main/java/eu/kanade/presentation/more/settings/screen/appearance/AppCustomThemeColorPickerScreen.kt`
 * - `komikku/app/src/main/java/eu/kanade/presentation/more/settings/widget/ThemeColorPickerWidget.kt`
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { PRESET_PALETTES } from '@/core/theme/presetPalettes'
import { generateDynamicTheme, isValidHex, normalizeHex } from '@/core/theme/dynamicTheme'
import { useAppearanceStore } from '../stores/appearancePreferences'
import { usePreferencesStore } from '../stores/preferences'
import { t } from '@/core/i18n'

const props = withDefaults(
  defineProps<{
    standalone?: boolean
  }>(),
  {
    standalone: false,
  },
)

const emit = defineEmits<{
  (e: 'back'): void
}>()

const router = useRouter()
const appearance = useAppearanceStore()
const preferences = usePreferencesStore()

// Initial seed color when entering screen
const initialColor = ref(normalizeHex(appearance.customSeedColor || '#DF0090'))
const selectedHex = ref(initialColor.value)
const hexInput = ref(selectedHex.value.replace('#', ''))
const hexError = ref(false)

// HSV State (Hue: 0-360, Saturation: 0-1, Value/Brightness: 0-1)
const hue = ref(320)
const saturation = ref(1)
const value = ref(0.87)

const isDark = computed(() => {
  if (preferences.themeMode === 'dark') return true
  if (preferences.themeMode === 'light') return false
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return false
})

// Dynamic theme preview generated in real-time from the active selection
const previewTheme = computed(() => generateDynamicTheme(selectedHex.value))
const previewScheme = computed(() => {
  const scheme = isDark.value ? previewTheme.value.dark : previewTheme.value.light
  if (isDark.value && appearance.amoled) {
    return {
      ...scheme,
      background: '#000000',
      surface: '#000000',
      onBackground: '#FFFFFF',
      onSurface: '#FFFFFF',
      surfaceVariant: '#0C0C0C',
      surfaceContainerLowest: '#0C0C0C',
      surfaceContainerLow: '#0C0C0C',
      surfaceContainer: '#0C0C0C',
      surfaceContainerHigh: '#131313',
      surfaceContainerHighest: '#1B1B1B',
    }
  }
  return scheme
})

// Color conversions
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0, g = 0, b = 0

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c
  } else {
    r = c; g = 0; b = x
  }

  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0

  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6
    } else if (max === g) {
      h = (b - r) / delta + 2
    } else {
      h = (r - g) / delta + 4
    }
    h = Math.round(h * 60)
    if (h < 0) h += 360
  }

  const s = max === 0 ? 0 : delta / max
  const v = max
  return [h, s, v]
}

function hexToRgb(hexStr: string): [number, number, number] {
  const clean = hexStr.replace('#', '')
  const num = parseInt(clean, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map(x => {
        const h = x.toString(16)
        return h.length === 1 ? '0' + h : h
      })
      .join('')
      .toUpperCase()
  )
}

function updateFromHsv() {
  const [r, g, b] = hsvToRgb(hue.value, saturation.value, value.value)
  const hex = rgbToHex(r, g, b)
  selectedHex.value = hex
  hexInput.value = hex.replace('#', '')
  hexError.value = false
  drawWheel()
}

function updateFromHex(raw: string) {
  if (isValidHex(raw)) {
    hexError.value = false
    const norm = normalizeHex(raw)
    selectedHex.value = norm
    hexInput.value = norm.replace('#', '')
    const [r, g, b] = hexToRgb(norm)
    const [h, s, v] = rgbToHsv(r, g, b)
    hue.value = h
    saturation.value = s
    value.value = v
    drawWheel()
  } else {
    hexError.value = true
  }
}

function selectSwatch(colorHex: string) {
  updateFromHex(colorHex)
  const container = document.querySelector('.custom-picker-content')
  if (container) {
    container.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// Canvas Wheel Rendering
const wheelCanvasRef = ref<HTMLCanvasElement | null>(null)
let isDraggingWheel = false

function drawWheel() {
  const canvas = wheelCanvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height
  const radius = width / 2
  ctx.clearRect(0, 0, width, height)

  const imgData = ctx.createImageData(width, height)
  const data = imgData.data

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - radius
      const dy = y - radius
      const dist = Math.sqrt(dx * dx + dy * dy)
      const index = (y * width + x) * 4

      if (dist <= radius) {
        let angle = Math.atan2(dy, dx) * (180 / Math.PI)
        if (angle < 0) angle += 360
        const sat = dist / radius
        const [r, g, b] = hsvToRgb(angle, sat, value.value)

        data[index] = r
        data[index + 1] = g
        data[index + 2] = b
        data[index + 3] = 255
      } else {
        data[index + 3] = 0
      }
    }
  }

  ctx.putImageData(imgData, 0, 0)

  // Draw current selection handle
  const curAngle = (hue.value * Math.PI) / 180
  const curDist = saturation.value * radius
  const handleX = radius + Math.cos(curAngle) * curDist
  const handleY = radius + Math.sin(curAngle) * curDist

  ctx.beginPath()
  ctx.arc(handleX, handleY, 9, 0, 2 * Math.PI)
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(handleX, handleY, 7, 0, 2 * Math.PI)
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 2
  ctx.stroke()
}

function handleWheelPointer(e: PointerEvent | MouseEvent) {
  const canvas = wheelCanvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const radius = rect.width / 2
  const dx = x - radius
  const dy = y - radius
  const dist = Math.sqrt(dx * dx + dy * dy)

  let angle = Math.atan2(dy, dx) * (180 / Math.PI)
  if (angle < 0) angle += 360

  hue.value = Math.round(angle)
  saturation.value = Math.min(1, Math.max(0, dist / radius))
  updateFromHsv()
}

function onWheelPointerDown(e: PointerEvent) {
  isDraggingWheel = true
  handleWheelPointer(e)
  window.addEventListener('pointermove', onWheelPointerMove)
  window.addEventListener('pointerup', onWheelPointerUp)
}

function onWheelPointerMove(e: PointerEvent) {
  if (isDraggingWheel) {
    handleWheelPointer(e)
  }
}

function onWheelPointerUp() {
  isDraggingWheel = false
  window.removeEventListener('pointermove', onWheelPointerMove)
  window.removeEventListener('pointerup', onWheelPointerUp)
}

function onBrightnessChange(e: Event) {
  const target = e.target as HTMLInputElement
  value.value = parseFloat(target.value)
  updateFromHsv()
}

function confirmColor() {
  const finalHex = normalizeHex(selectedHex.value)
  appearance.customSeedColor = finalHex
  appearance.appThemeId = 'custom'
  appearance.applyCurrentTheme()
  emit('back')
  if (router.currentRoute.value.path === '/settings/appearance/custom-color') {
    void router.push('/settings/appearance')
  }
}

function navigateBack() {
  emit('back')
  if (router.currentRoute.value.path === '/settings/appearance/custom-color') {
    void router.push('/settings/appearance')
  }
}

onMounted(() => {
  const [r, g, b] = hexToRgb(initialColor.value)
  const [h, s, v] = rgbToHsv(r, g, b)
  hue.value = h
  saturation.value = s
  value.value = v
  void nextTick(() => {
    drawWheel()
  })
})

watch(value, () => {
  drawWheel()
})
</script>

<template>
  <div class="custom-color-picker-view">
    <!-- Top App Bar -->
    <header class="custom-picker-bar">
      <button
        type="button"
        class="custom-picker-bar__back"
        :aria-label="t('action_bar_up_description') || 'Back'"
        @click="navigateBack"
      >
        <span class="material-symbols-rounded">arrow_back</span>
      </button>
      <h1 class="custom-picker-bar__title">
        {{ t('pref_custom_color') || 'Palette Personalizer' }}
      </h1>
    </header>

    <div class="custom-picker-content">
      <!-- Section 1: HSV Color Wheel & Brightness Slider -->
      <section class="picker-wheel-card" aria-label="Color Wheel">
        <div class="wheel-canvas-wrapper">
          <canvas
            ref="wheelCanvasRef"
            width="260"
            height="260"
            class="wheel-canvas"
            @pointerdown="onWheelPointerDown"
          />
        </div>

        <!-- Brightness Slider -->
        <div class="slider-group">
          <span class="slider-label">Brightness</span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.01"
            :value="value"
            class="brightness-slider"
            :style="{
              '--slider-thumb-color': selectedHex,
            }"
            @input="onBrightnessChange"
          />
        </div>

        <!-- Color Comparison Row & Hex Input -->
        <div class="color-comparison-row">
          <div class="color-tile-column">
            <span class="color-tile-code" :style="{ color: initialColor }">
              {{ initialColor }}
            </span>
            <div class="color-swatch-box" :style="{ backgroundColor: initialColor }" />
            <span class="color-swatch-label">Current</span>
          </div>

          <span class="material-symbols-rounded comparison-arrow">arrow_forward</span>

          <div class="color-tile-column">
            <span class="color-tile-code" :style="{ color: selectedHex }">
              {{ selectedHex }}
            </span>
            <div class="color-swatch-box" :style="{ backgroundColor: selectedHex }" />
            <span class="color-swatch-label">New</span>
          </div>
        </div>

        <!-- Hex Manual Input -->
        <div class="hex-input-row">
          <span class="hex-prefix">#</span>
          <input
            v-model="hexInput"
            type="text"
            maxlength="6"
            class="hex-field"
            :class="{ 'is-invalid': hexError }"
            placeholder="DF0090"
            @input="updateFromHex(hexInput)"
          />
        </div>

        <!-- Confirm Color Button -->
        <button
          type="button"
          class="confirm-button"
          :style="{
            backgroundColor: selectedHex,
            color: previewScheme.onPrimary,
          }"
          @click="confirmColor"
        >
          <span class="material-symbols-rounded">check</span>
          <span>{{ t('action_confirm_color') || 'Confirm Color' }}</span>
        </button>
      </section>

      <!-- Section 2: Real-time M3 Component Live Preview -->
      <section class="preview-card" aria-label="Live Preview">
        <h2 class="section-heading">Live Preview</h2>
        <div
          class="preview-card__surface"
          :style="{
            backgroundColor: previewScheme.surface,
            color: previewScheme.onSurface,
            borderColor: previewScheme.outlineVariant,
          }"
        >
          <div
            class="preview-card__header"
            :style="{
              backgroundColor: previewScheme.surfaceContainer,
            }"
          >
            <span class="preview-badge" :style="{ backgroundColor: previewScheme.primaryContainer, color: previewScheme.onPrimaryContainer }">
              M3 Preview
            </span>
            <span class="preview-card__title">Theme Preview</span>
          </div>

          <div class="preview-card__body">
            <p class="preview-card__text" :style="{ color: previewScheme.onSurfaceVariant }">
              Preview how this seed color looks across standard components.
            </p>

            <div class="preview-button-row">
              <button
                type="button"
                class="preview-btn preview-btn--filled"
                :style="{
                  backgroundColor: previewScheme.primary,
                  color: previewScheme.onPrimary,
                }"
              >
                Filled Primary
              </button>
              <button
                type="button"
                class="preview-btn preview-btn--tonal"
                :style="{
                  backgroundColor: previewScheme.secondaryContainer,
                  color: previewScheme.onSecondaryContainer,
                }"
              >
                Tonal
              </button>
              <button
                type="button"
                class="preview-btn preview-btn--outlined"
                :style="{
                  borderColor: previewScheme.outline,
                  color: previewScheme.primary,
                }"
              >
                Outlined
              </button>
            </div>

            <div class="preview-chip-row">
              <span
                class="preview-chip"
                :style="{
                  backgroundColor: previewScheme.surfaceContainerHigh,
                  color: previewScheme.onSurface,
                }"
              >
                <span class="material-symbols-rounded chip-icon">bookmark</span>
                Chip
              </span>
              <span
                class="preview-chip"
                :style="{
                  backgroundColor: previewScheme.tertiaryContainer,
                  color: previewScheme.onTertiaryContainer,
                }"
              >
                Tertiary
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 3: 13 Preset Palettes -->
      <section class="presets-section" aria-label="Preset Palettes">
        <h2 class="section-heading">Preset Palettes</h2>
        <p class="section-subheading">
          {{ t('custom_color_description') || 'Pick a seed color for the custom theme' }}
        </p>

        <div
          v-for="palette in PRESET_PALETTES"
          :key="palette.id"
          class="preset-palette-group"
        >
          <h3 class="preset-title">
            {{ t(palette.titleKey) || palette.name }}
          </h3>
          <div class="preset-swatches-row">
            <button
              v-for="color in palette.colors"
              :key="color"
              type="button"
              class="palette-swatch-item"
              :class="{ 'is-selected': selectedHex.toUpperCase() === color.toUpperCase() }"
              :style="{ backgroundColor: color }"
              :aria-label="color"
              @click="selectSwatch(color)"
            >
              <span
                v-if="selectedHex.toUpperCase() === color.toUpperCase()"
                class="material-symbols-rounded swatch-check"
              >
                check
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.custom-color-picker-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
  box-sizing: border-box;
}

.custom-picker-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 64px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.12);
  background: rgb(var(--v-theme-surface));
  flex-shrink: 0;
}

.custom-picker-bar__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
}

.custom-picker-bar__back:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}

.custom-picker-bar__title {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}

.custom-picker-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 680px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

/* Card Section */
.picker-wheel-card,
.preview-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgb(var(--v-theme-surface-container-low));
  border-radius: 20px;
  padding: 20px;
  box-sizing: border-box;
}

.wheel-canvas-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.wheel-canvas {
  width: 260px;
  height: 260px;
  border-radius: 50%;
  cursor: crosshair;
  touch-action: none;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.slider-group {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.slider-label {
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface-variant));
}

.brightness-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(to right, #000000, #FFFFFF);
  outline: none;
}

.brightness-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--slider-thumb-color, #DF0090);
  border: 2px solid #FFFFFF;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.color-comparison-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-bottom: 16px;
}

.color-tile-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.color-tile-code {
  font-size: 13px;
  font-weight: 600;
  font-family: monospace;
}

.color-swatch-box {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.color-swatch-label {
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
}

.comparison-arrow {
  font-size: 28px;
  color: rgb(var(--v-theme-outline));
}

.hex-input-row {
  display: flex;
  align-items: center;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-outline-variant));
  border-radius: 12px;
  padding: 6px 14px;
  width: 160px;
  margin-bottom: 20px;
}

.hex-prefix {
  font-weight: 600;
  font-size: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-right: 4px;
}

.hex-field {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
  font-weight: 600;
  font-family: monospace;
  text-transform: uppercase;
  color: rgb(var(--v-theme-on-surface));
}

.hex-field.is-invalid {
  color: rgb(var(--v-theme-error));
}

.confirm-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  max-width: 320px;
  height: 48px;
  border: none;
  border-radius: 24px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
  transition: transform 0.15s ease, filter 0.15s ease;
}

.confirm-button:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.confirm-button:active {
  transform: translateY(0);
}

/* Live Preview */
.section-heading {
  font-size: 17px;
  font-weight: 600;
  margin: 0 0 4px 0;
  width: 100%;
  color: rgb(var(--v-theme-on-surface));
}

.section-subheading {
  font-size: 13px;
  color: rgb(var(--v-theme-on-surface-variant));
  margin: 0 0 16px 0;
  width: 100%;
}

.preview-card {
  align-items: stretch;
}

.preview-card__surface {
  border-radius: 16px;
  border: 1px solid;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.preview-card__header {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.preview-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 8px;
}

.preview-card__title {
  font-size: 14px;
  font-weight: 600;
}

.preview-card__body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-card__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
}

.preview-button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preview-btn {
  padding: 8px 16px;
  border-radius: 18px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  cursor: pointer;
}

.preview-btn--outlined {
  background: transparent;
  border: 1px solid;
}

.preview-chip-row {
  display: flex;
  gap: 8px;
}

.preview-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
}

.chip-icon {
  font-size: 16px;
}

/* Preset Palettes */
.presets-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: rgb(var(--v-theme-surface-container-low));
  border-radius: 20px;
  padding: 20px;
}

.preset-palette-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}

.preset-swatches-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.palette-swatch-item {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease, border-color 0.15s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

.palette-swatch-item:hover {
  transform: scale(1.08);
}

.palette-swatch-item.is-selected {
  border-color: #FFFFFF;
  box-shadow: 0 0 0 2px rgb(var(--v-theme-primary));
}

.swatch-check {
  font-size: 20px;
  color: #FFFFFF;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}
</style>
