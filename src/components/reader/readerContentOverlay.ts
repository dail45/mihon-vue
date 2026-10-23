/**
 * Helpers backing `ReaderContentOverlay.vue`.
 *
 * Direct port of the geometry of
 * `mihon/app/src/main/java/eu/kanade/presentation/reader/ReaderContentOverlay.kt`
 * (Mihon 446f6df):
 *
 *   if (brightness < 0) {
 *       val brightnessAlpha = remember(brightness) { abs(brightness) / 100f }
 *       Canvas(modifier.fillMaxSize().graphicsLayer { alpha = brightnessAlpha }) { drawRect(Color.Black) }
 *   }
 *   if (color != null) {
 *       Canvas(modifier.fillMaxSize()) { drawRect(color = Color(color), blendMode = colorBlendMode ?: BlendMode.SrcOver) }
 *   }
 *
 * So: a negative brightness paints a full-size black rect whose alpha is
 * `abs(brightness) / 100`, and an optional ARGB colour paints a second full-size
 * rect with the reader colour-filter blend mode (default `SrcOver`).
 *
 * The blend-mode list and order follow `ReaderPreferences.ColorFilterMode`
 * (`app/src/main/java/eu/kanade/tachiyomi/ui/reader/setting/ReaderPreferences.kt`).
 */

import { ref, type Ref } from 'vue'
import type { CSSProperties } from 'vue'

export type ReaderBlendMode = 'src-over' | 'modulate' | 'screen' | 'overlay' | 'lighten' | 'darken'

export interface ReaderBlendModeOption {
  index: number
  label: string
  mode: ReaderBlendMode
}

/** Labels from the base `strings.xml`: label_default, filter_mode_multiply/screen/overlay/lighten/darken. */
export const READER_BLEND_MODE_OPTIONS: ReaderBlendModeOption[] = [
  { index: 0, label: 'Default', mode: 'src-over' },
  { index: 1, label: 'Multiply', mode: 'modulate' },
  { index: 2, label: 'Screen', mode: 'screen' },
  { index: 3, label: 'Overlay', mode: 'overlay' },
  { index: 4, label: 'Dodge / Lighten', mode: 'lighten' },
  { index: 5, label: 'Burn / Darken', mode: 'darken' },
]

/**
 * Alpha of the black dimming rect.
 * Only a negative brightness darkens the content; a positive value is a native
 * screen-brightness change in Mihon and paints nothing here.
 */
export function brightnessOverlayAlpha(brightness: number): number {
  if (!Number.isFinite(brightness) || brightness >= 0) return 0
  return Math.min(1, Math.abs(brightness) / 100)
}

export interface ArgbColor {
  alpha: number
  red: number
  green: number
  blue: number
  /** `rgba(r, g, b, a)` string usable as a CSS background colour. */
  css: string
}

/** Parses a packed ARGB integer (0xAARRGGBB) the way Compose's `Color(Int)` does. */
export function argbToCss(color: number): ArgbColor {
  const value = Math.trunc(Number(color) || 0) >>> 0
  const alpha = (value >>> 24) & 0xff
  const red = (value >>> 16) & 0xff
  const green = (value >>> 8) & 0xff
  const blue = value & 0xff
  const opacity = Math.round((alpha / 255) * 1000) / 1000
  return { alpha, red, green, blue, css: `rgba(${red}, ${green}, ${blue}, ${opacity})` }
}

/**
 * CSS `mix-blend-mode` matching the Compose blend mode.
 * `Modulate` is Compose's multiply variant and maps to the CSS `multiply` blend mode.
 */
export function cssBlendMode(mode: ReaderBlendMode | null | undefined): CSSProperties['mixBlendMode'] {
  switch (mode) {
    case 'modulate': return 'multiply'
    case 'screen': return 'screen'
    case 'overlay': return 'overlay'
    case 'lighten': return 'lighten'
    case 'darken': return 'darken'
    default: return 'normal'
  }
}

export interface ColorOverlayStyle {
  backgroundColor: string
  mixBlendMode: CSSProperties['mixBlendMode']
}

/**
 * Preferences that drive the overlay, mirroring `ReaderPreferences`
 * (`app/src/main/java/eu/kanade/tachiyomi/ui/reader/setting/ReaderPreferences.kt`):
 *   customBrightness / customBrightnessValue / colorFilter / colorFilterValue / colorFilterMode.
 *
 * The stored values mirror the reference packing so a saved filter survives a reload.
 */
export const COLOR_FILTER_MASKS = {
  ALPHA: 0xff000000,
  RED: 0x00ff0000,
  GREEN: 0x0000ff00,
  BLUE: 0x000000ff,
} as const

/**
 * Resolves the colour overlay rect, or `null` when nothing should be painted.
 * A fully transparent colour is a no-op in Compose, so it is skipped here too.
 */
export function colorOverlayStyle(
  color: number | null | undefined,
  mode: ReaderBlendMode | null | undefined,
): ColorOverlayStyle | null {
  if (color === null || color === undefined) return null
  const argb = argbToCss(color)
  if (argb.alpha === 0) return null
  return { backgroundColor: argb.css, mixBlendMode: cssBlendMode(mode) }
}

/**
 * CSS `filter` for the reader content, mirroring `ReaderActivity.getCombinedPaint()`
 * (grayscale -> `ColorMatrix.setSaturation(0)`, inverted -> the -1/255 colour matrix).
 * In Mihon this is applied as a hardware layer paint on the viewer container.
 */
export function contentFilterStyle(grayscale: boolean, invertedColors: boolean): string {
  const parts: string[] = []
  if (grayscale) parts.push('grayscale(1)')
  if (invertedColors) parts.push('invert(1)')
  return parts.length ? parts.join(' ') : 'none'
}

/**
 * CSS `filter` for the whole reader window, mirroring
 * `ReaderActivity.setCustomBrightnessValue(value)`:
 *
 *   val readerBrightness = when {
 *       value > 0 -> value / 100f
 *       value < 0 -> 0.01f
 *       else      -> WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
 *   }
 *   window.attributes = window.attributes.apply { screenBrightness = readerBrightness }
 *
 * A positive value therefore sets the *window* brightness to `value / 100f`
 * (Android clamps the window attribute to 1.0), which is a dimming of the screen
 * for any value below 100 - not a brightening. `brightness(value / 100)` is the
 * closest CSS equivalent and is applied to the whole reader surface.
 *
 * The negative branch (`screenBrightness = 0.01f`, i.e. the hardware screen is
 * turned down to its minimum) has no web equivalent - a browser cannot change the
 * device backlight - so the black overlay of `ReaderContentOverlay` is used
 * instead, exactly as the reference composable does.
 */
export function customBrightnessFilter(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return 'none'
  return `brightness(${Math.min(1, value / 100)})`
}

/* ---------------------------------------------------------------------------
 * Preference-backed state
 *
 * Mirrors the reference preference keys so the reader colour filter page and this
 * overlay share one source of truth:
 *   mihon.reader.customBrightness        -> ReaderPreferences.customBrightness
 *   mihon.reader.customBrightnessValue   -> ReaderPreferences.customBrightnessValue (-75..100)
 *   mihon.reader.colorFilter             -> ReaderPreferences.colorFilter
 *   mihon.reader.colorFilterValue        -> ReaderPreferences.colorFilterValue (packed ARGB)
 *   mihon.reader.colorFilterMode         -> ReaderPreferences.colorFilterMode
 *   mihon.reader.grayscale               -> ReaderPreferences.grayscale
 *   mihon.reader.invertedColors          -> ReaderPreferences.invertedColors
 * Only harmless UI preferences are stored; nothing here talks to the server.
 * --------------------------------------------------------------------------- */

export const OVERLAY_PREFERENCE_KEYS = {
  customBrightness: 'mihon.reader.customBrightness',
  customBrightnessValue: 'mihon.reader.customBrightnessValue',
  colorFilter: 'mihon.reader.colorFilter',
  colorFilterValue: 'mihon.reader.colorFilterValue',
  colorFilterMode: 'mihon.reader.colorFilterMode',
  grayscale: 'mihon.reader.grayscale',
  invertedColors: 'mihon.reader.invertedColors',
} as const

export type OverlayPreferenceKey = (typeof OVERLAY_PREFERENCE_KEYS)[keyof typeof OVERLAY_PREFERENCE_KEYS]

/** Fired on `window` whenever a reader overlay preference changes in this tab. */
export const READER_OVERLAY_PREFERENCES_EVENT = 'mihon:reader-overlay-preferences'

function readStored(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function writeStored(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* private mode: session-only preference */ }
}

function readBool(key: string): boolean {
  return readStored(key) === 'true'
}

function readInt(key: string, fallback: number, min: number, max: number): number {
  const raw = Number(readStored(key))
  return Number.isInteger(raw) && raw >= min && raw <= max ? raw : fallback
}

/** `ColorFilterPage.getColorValue(currentColor, color, mask, bitShift)`. */
export function setColorChannel(currentColor: number, channel: 'red' | 'green' | 'blue' | 'alpha', value: number): number {
  const mask = channel === 'red' ? COLOR_FILTER_MASKS.RED
    : channel === 'green' ? COLOR_FILTER_MASKS.GREEN
      : channel === 'blue' ? COLOR_FILTER_MASKS.BLUE
        : COLOR_FILTER_MASKS.ALPHA
  const bitShift = channel === 'red' ? 16 : channel === 'green' ? 8 : channel === 'blue' ? 0 : 24
  return (((value << bitShift) | (currentColor & ~mask)) >>> 0)
}

export interface ReaderContentOverlayState {
  /** Value handed to `ReaderContentOverlay(brightness = ...)`. */
  brightness: Ref<number>
  /** Packed ARGB colour handed to `ReaderContentOverlay(color = ...)`, or `null`. */
  color: Ref<number | null>
  /** Blend mode handed to `ReaderContentOverlay(colorBlendMode = ...)`. */
  colorBlendMode: Ref<ReaderBlendMode | null>
  /** Grayscale toggle (Mihon ReaderActivity.kt getCombinedPaint). */
  grayscale: Ref<boolean>
  /** Inverted colors toggle (Mihon ReaderActivity.kt getCombinedPaint). */
  invertedColors: Ref<boolean>
  /** CSS filter for the reader content (grayscale / inverted colours). */
  contentFilter: Ref<string>
  /** Re-reads the stored preferences (used when the settings page changed them). */
  refresh: () => void
  /** Stores a preference and refreshes the overlay in this tab. */
  set: (key: OverlayPreferenceKey, value: string | number | boolean) => void
  /** Removes the window listeners registered by the composable. */
  stop: () => void
}

/**
 * Reads the reader colour-filter preferences and exposes them in the shape the
 * overlay expects.
 *
 * The values are re-read on window focus, on the `storage` event (other tabs) and
 * on `mihon:reader-overlay-preferences` (this tab), so the reader and its settings
 * sheet always agree without a shared store.
 */
export function useReaderContentOverlayState(): ReaderContentOverlayState {
  const brightness = ref(0)
  const color = ref<number | null>(null)
  const colorBlendMode = ref<ReaderBlendMode | null>(null)
  const grayscale = ref(false)
  const invertedColors = ref(false)
  const contentFilter = ref('none')

  function refresh() {
    const brightnessOn = readBool(OVERLAY_PREFERENCE_KEYS.customBrightness)
    const brightnessValue = readInt(OVERLAY_PREFERENCE_KEYS.customBrightnessValue, 0, -75, 100)
    // ReaderActivity.setCustomBrightnessValue(): when the preference is off the
    // overlay value is reset to 0, and only negative values dim the content.
    brightness.value = brightnessOn ? brightnessValue : 0

    const filterOn = readBool(OVERLAY_PREFERENCE_KEYS.colorFilter)
    const filterValue = readInt(OVERLAY_PREFERENCE_KEYS.colorFilterValue, 0, 0, 0xffffffff)
    // ReaderActivity.ContentOverlay(): `colorOverlay.takeIf { colorOverlayEnabled }`.
    color.value = filterOn ? filterValue : null

    const modeIndex = readInt(OVERLAY_PREFERENCE_KEYS.colorFilterMode, 0, 0, READER_BLEND_MODE_OPTIONS.length - 1)
    const option = READER_BLEND_MODE_OPTIONS[modeIndex] ?? READER_BLEND_MODE_OPTIONS[0]!
    // `colorBlendMode ?: BlendMode.SrcOver` -> the default mode needs no blend mode.
    colorBlendMode.value = option.mode === 'src-over' ? null : option.mode

    const gray = readBool(OVERLAY_PREFERENCE_KEYS.grayscale)
    const inv = readBool(OVERLAY_PREFERENCE_KEYS.invertedColors)
    grayscale.value = gray
    invertedColors.value = inv
    contentFilter.value = contentFilterStyle(gray, inv)
  }

  function set(key: OverlayPreferenceKey, value: string | number | boolean) {
    writeStored(key, String(value))
    refresh()
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(READER_OVERLAY_PREFERENCES_EVENT))
  }

  const onExternalChange = () => refresh()
  refresh()
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onExternalChange)
    window.addEventListener('storage', onExternalChange)
    window.addEventListener(READER_OVERLAY_PREFERENCES_EVENT, onExternalChange)
  }

  function stop() {
    if (typeof window === 'undefined') return
    window.removeEventListener('focus', onExternalChange)
    window.removeEventListener('storage', onExternalChange)
    window.removeEventListener(READER_OVERLAY_PREFERENCES_EVENT, onExternalChange)
  }

  return { brightness, color, colorBlendMode, grayscale, invertedColors, contentFilter, refresh, set, stop }
}

