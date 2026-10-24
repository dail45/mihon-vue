import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { colorFilterModes } from '@/features/reader/composables/useColorFilter'

// Mirrors ColorFilterPage.getColorValue(currentColor, color, mask, bitShift):
//   (color shl bitShift) or (currentColor and mask.inv().toInt())
const ALPHA_MASK = 0xff000000
const RED_MASK = 0x00ff0000
const GREEN_MASK = 0x0000ff00
const BLUE_MASK = 0x000000ff
function getColorValue(currentColor: number, color: number, mask: number, bitShift: number) {
  return ((color << bitShift) | (currentColor & ~mask)) >>> 0
}

const colorFilterPageSource = readFileSync('src/features/reader/components/ColorFilterPage.vue', 'utf8')

describe('reader color filter page', () => {
  it('packs each channel into the ARGB int exactly like the reference', () => {
    let value = 0
    value = getColorValue(value, 12, RED_MASK, 16)
    value = getColorValue(value, 34, GREEN_MASK, 8)
    value = getColorValue(value, 56, BLUE_MASK, 0)
    value = getColorValue(value, 78, ALPHA_MASK, 24)
    expect((value & RED_MASK) >>> 16).toBe(12)
    expect((value & GREEN_MASK) >>> 8).toBe(34)
    expect(value & BLUE_MASK).toBe(56)
    expect((value & ALPHA_MASK) >>> 24).toBe(78)
  })

  it('keeps the untouched channels when one channel changes', () => {
    const start = getColorValue(getColorValue(getColorValue(0, 200, RED_MASK, 16), 100, GREEN_MASK, 8), 50, BLUE_MASK, 0)
    const next = getColorValue(start, 10, GREEN_MASK, 8)
    expect((next & RED_MASK) >>> 16).toBe(200)
    expect((next & GREEN_MASK) >>> 8).toBe(10)
    expect(next & BLUE_MASK).toBe(50)
  })

  it('lists the six blend modes in ReaderPreferences.ColorFilterMode order', () => {
    expect(colorFilterModes.map(m => m.title)).toEqual(['Default', 'Multiply', 'Screen', 'Overlay', 'Dodge / Lighten', 'Burn / Darken'])
    expect(colorFilterModes.map(m => m.value)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('matches Mihon ColorFilterPage.kt item order and conditional elements', () => {
    // 1. Custom brightness checkbox
    const cbBrightnessIdx = colorFilterPageSource.indexOf('class="cf-item-label">Custom brightness</span>')
    expect(cbBrightnessIdx).toBeGreaterThan(-1)

    // 2. Custom brightness slider (range -75..100, step 1, stop-count 0 for continuous)
    const sliderBrightnessIdx = colorFilterPageSource.indexOf('<div v-if="customBrightness" class="cf-slider">')
    expect(sliderBrightnessIdx).toBeGreaterThan(cbBrightnessIdx)
    expect(colorFilterPageSource).toContain(':min="-75"')
    expect(colorFilterPageSource).toContain(':max="100"')

    // 3. Custom color filter checkbox
    const cbColorFilterIdx = colorFilterPageSource.indexOf('class="cf-item-label">Custom color filter</span>')
    expect(cbColorFilterIdx).toBeGreaterThan(sliderBrightnessIdx)

    // 4. RGBA channel sliders & blend mode chip row (under template v-if="colorFilter")
    const filterBlockIdx = colorFilterPageSource.indexOf('<template v-if="colorFilter">')
    expect(filterBlockIdx).toBeGreaterThan(cbColorFilterIdx)
    expect(colorFilterPageSource).toContain(':max="255"')
    expect(colorFilterPageSource).toContain('Color filter blend mode')

    // 5. Grayscale checkbox
    const cbGrayscaleIdx = colorFilterPageSource.indexOf('Grayscale</span>')
    expect(cbGrayscaleIdx).toBeGreaterThan(filterBlockIdx)

    // 6. Inverted colors checkbox
    const cbInvertedIdx = colorFilterPageSource.indexOf('Inverted</span>')
    expect(cbInvertedIdx).toBeGreaterThan(cbGrayscaleIdx)
  })

  it('uses M3 surfaceContainerHighest pill background and 8dp chip corner radius', () => {
    expect(colorFilterPageSource).toContain('var(--v-theme-surface-container-highest)')
    expect(colorFilterPageSource).toContain('border-radius: 8px')
    expect(colorFilterPageSource).toContain('border-radius: 28px')
  })
})

