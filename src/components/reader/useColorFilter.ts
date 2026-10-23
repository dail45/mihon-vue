// State for the reader "Custom filter" page (mihon ColorFilterPage.kt).
// Mirrors eu.kanade.tachiyomi.ui.reader.setting.ReaderPreferences:
//   customBrightness / customBrightnessValue / colorFilter / colorFilterValue /
//   colorFilterMode / grayscale / invertedColors.
// Only harmless UI preferences are stored; nothing here talks to the server.
import { computed, ref, watch } from 'vue'
import { readPreference, writePreference } from '../../stores/preferences'
import { READER_OVERLAY_PREFERENCES_EVENT } from './readerContentOverlay'

export const ALPHA_MASK = 0xff000000
export const RED_MASK = 0x00ff0000
export const GREEN_MASK = 0x0000ff00
export const BLUE_MASK = 0x000000ff

/** ReaderPreferences.ColorFilterMode -> CSS mix-blend-mode. */
export const colorFilterModes = [
  { title: 'Default', value: 0, blend: 'normal' },
  { title: 'Multiply', value: 1, blend: 'multiply' },
  { title: 'Screen', value: 2, blend: 'screen' },
  { title: 'Overlay', value: 3, blend: 'overlay' },
  { title: 'Dodge / Lighten', value: 4, blend: 'lighten' },
  { title: 'Burn / Darken', value: 5, blend: 'darken' },
] as const

export type ColorFilterChannel = 'red' | 'green' | 'blue' | 'alpha'

function readBool(key: string) {
  return readPreference(key) === 'true'
}
function readInt(key: string, fallback: number, min: number, max: number) {
  const raw = Number(readPreference(key))
  return Number.isInteger(raw) && raw >= min && raw <= max ? raw : fallback
}

const customBrightness = ref(readBool('mihon.reader.customBrightness'))
const customBrightnessValue = ref(readInt('mihon.reader.customBrightnessValue', 0, -75, 100))
const colorFilter = ref(readBool('mihon.reader.colorFilter'))
const colorFilterValue = ref(readInt('mihon.reader.colorFilterValue', 0, 0, 0xffffffff))
const colorFilterMode = ref(readInt('mihon.reader.colorFilterMode', 0, 0, colorFilterModes.length - 1))
const grayscale = ref(readBool('mihon.reader.grayscale'))
const invertedColors = ref(readBool('mihon.reader.invertedColors'))

watch(customBrightness, v => writePreference('mihon.reader.customBrightness', String(v)))
watch(customBrightnessValue, v => writePreference('mihon.reader.customBrightnessValue', String(v)))
watch(colorFilter, v => writePreference('mihon.reader.colorFilter', String(v)))
watch(colorFilterValue, v => writePreference('mihon.reader.colorFilterValue', String(v)))
watch(colorFilterMode, v => writePreference('mihon.reader.colorFilterMode', String(v)))
watch(grayscale, v => writePreference('mihon.reader.grayscale', String(v)))
watch(invertedColors, v => writePreference('mihon.reader.invertedColors', String(v)))

// ReaderActivity.ContentOverlay() re-reads the colour-filter preferences whenever
// they change, so the overlay in the reader follows the settings page live.
watch(
  [customBrightness, customBrightnessValue, colorFilter, colorFilterValue, colorFilterMode, grayscale, invertedColors],
  () => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(READER_OVERLAY_PREFERENCES_EVENT)) },
  { flush: 'post' },
)

const red = computed(() => (colorFilterValue.value & RED_MASK) >>> 16)
const green = computed(() => (colorFilterValue.value & GREEN_MASK) >>> 8)
const blue = computed(() => colorFilterValue.value & BLUE_MASK)
const alpha = computed(() => (colorFilterValue.value & ALPHA_MASK) >>> 24)

/**
 * ColorFilterPage.getColorValue(): (color shl bitShift) or (currentColor and mask.inv()).
 * The reference stores one packed ARGB int; the web client keeps the same packing
 * so the value survives a reload unchanged.
 */
function setChannel(channel: ColorFilterChannel, value: number) {
  const mask = channel === 'red' ? RED_MASK : channel === 'green' ? GREEN_MASK : channel === 'blue' ? BLUE_MASK : ALPHA_MASK
  const bitShift = channel === 'red' ? 16 : channel === 'green' ? 8 : channel === 'blue' ? 0 : 24
  colorFilterValue.value = (((value << bitShift) | (colorFilterValue.value & ~mask)) >>> 0)
}

/** CSS filter applied to the rendered page, matching the reference toggles. */
const pageFilter = computed(() => {
  const parts: string[] = []
  if (grayscale.value) parts.push('grayscale(1)')
  if (invertedColors.value) parts.push('invert(1)')
  if (customBrightness.value && customBrightnessValue.value > 0) parts.push(`brightness(${customBrightnessValue.value / 100})`)
  return parts.length ? parts.join(' ') : 'none'
})

/**
 * Color overlay drawn above the page.
 * - Default (SrcOver): plain alpha over the page.
 * - The other modes map to the matching CSS mix-blend-mode.
 */
const colorOverlay = computed(() => {
  if (!colorFilter.value) return null
  const mode = colorFilterModes[colorFilterMode.value] ?? colorFilterModes[0]
  return {
    background: `rgba(${red.value}, ${green.value}, ${blue.value}, ${(alpha.value / 255).toFixed(3)})`,
    mixBlendMode: mode.blend,
  }
})

/**
 * Custom brightness, per the reference:
 * -75..-1 draws a semi-transparent black overlay (ReaderContentOverlay uses
 * abs(brightness) / 100f as the overlay alpha), 0 keeps the system brightness,
 * 1..100 raises the page brightness to value / 100f.
 */
const brightnessOverlay = computed(() => {
  if (!customBrightness.value || customBrightnessValue.value >= 0) return null
  return { background: `rgba(0, 0, 0, ${(Math.abs(customBrightnessValue.value) / 100).toFixed(3)})` }
})

export function useColorFilter() {
  return {
    customBrightness,
    customBrightnessValue,
    colorFilter,
    colorFilterValue,
    colorFilterMode,
    grayscale,
    invertedColors,
    red,
    green,
    blue,
    alpha,
    setChannel,
    pageFilter,
    colorOverlay,
    brightnessOverlay,
  }
}
