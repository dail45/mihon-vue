import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  argbToCss,
  brightnessOverlayAlpha,
  colorOverlayStyle,
  contentFilterStyle,
  cssBlendMode,
  READER_BLEND_MODE_OPTIONS,
  setColorChannel,
} from '@/features/reader/utils/readerContentOverlay'

const vueSource = readFileSync(
  resolve(process.cwd(), 'src/features/reader/components/ReaderContentOverlay.vue'),
  'utf8',
)

describe('reader content overlay (ReaderContentOverlay.kt)', () => {
  it('dims the content only for a negative brightness, with alpha = abs(brightness) / 100', () => {
    // ReaderContentOverlay.kt: `if (brightness < 0) { alpha = abs(brightness) / 100f }`.
    expect(brightnessOverlayAlpha(-75)).toBe(0.75)
    expect(brightnessOverlayAlpha(-100)).toBe(1)
    expect(brightnessOverlayAlpha(-1)).toBe(0.01)
    // A positive brightness is a native screen-brightness change in Mihon: no overlay.
    expect(brightnessOverlayAlpha(0)).toBe(0)
    expect(brightnessOverlayAlpha(60)).toBe(0)
  })

  it('parses a packed ARGB colour like Compose Color(Int)', () => {
    const argb = argbToCss(0x8012ff34)
    expect(argb).toMatchObject({ alpha: 0x80, red: 0x12, green: 0xff, blue: 0x34 })
    expect(argb.css).toBe('rgba(18, 255, 52, 0.502)')
    expect(argbToCss(0xffffffff).css).toBe('rgba(255, 255, 255, 1)')
  })

  it('skips the colour rect when there is no colour or the colour is fully transparent', () => {
    expect(colorOverlayStyle(null, 'screen')).toBeNull()
    expect(colorOverlayStyle(0x00000000, 'screen')).toBeNull()
    expect(colorOverlayStyle(0xff0000ff, 'screen')).toEqual({ backgroundColor: 'rgba(0, 0, 255, 1)', mixBlendMode: 'screen' })
  })

  it('maps every reference blend mode to a CSS mix-blend-mode', () => {
    expect(READER_BLEND_MODE_OPTIONS.map(o => o.mode)).toEqual(['src-over', 'modulate', 'screen', 'overlay', 'lighten', 'darken'])
    expect(cssBlendMode('src-over')).toBe('normal')
    expect(cssBlendMode('modulate')).toBe('multiply')
    expect(cssBlendMode(null)).toBe('normal')
    expect(colorOverlayStyle(0x80ff0000, 'src-over')!.mixBlendMode).toBe('normal')
  })

  it('reproduces ColorFilterPage.getColorValue channel packing', () => {
    let color = 0
    color = setColorChannel(color, 'red', 0x12)
    color = setColorChannel(color, 'green', 0xff)
    color = setColorChannel(color, 'blue', 0x34)
    color = setColorChannel(color, 'alpha', 0x80)
    expect(color).toBe(0x8012ff34)
    // Setting one channel keeps the other channels untouched.
    expect(setColorChannel(color, 'red', 0x00)).toBe(0x8000ff34)
  })

  it('mirrors the grayscale / inverted layer paint of ReaderActivity.getCombinedPaint', () => {
    expect(contentFilterStyle(false, false)).toBe('none')
    expect(contentFilterStyle(true, false)).toBe('grayscale(1)')
    expect(contentFilterStyle(false, true)).toBe('invert(1)')
    expect(contentFilterStyle(true, true)).toBe('grayscale(1) invert(1)')
  })

  it('matches ReaderContentOverlay.kt fullscreen layout and pointer events in Vue template', () => {
    // Modifier.fillMaxSize() -> position absolute, inset 0
    expect(vueSource).toContain('position: absolute')
    expect(vueSource).toContain('inset: 0')
    // Canvas does not intercept touch/mouse events, so overlay uses pointer-events: none
    expect(vueSource).toContain('pointer-events: none')
    // Data testids for layers
    expect(vueSource).toContain('data-testid="reader-content-overlay"')
    expect(vueSource).toContain('data-testid="reader-content-overlay-dim"')
    expect(vueSource).toContain('data-testid="reader-content-overlay-color"')
    expect(vueSource).toContain('data-testid="reader-content-overlay-filter"')
  })

  it('declares props for brightness, color, colorBlendMode, grayscale, and invertedColors', () => {
    expect(vueSource).toContain('brightness?: number')
    expect(vueSource).toContain('color?: number | null')
    expect(vueSource).toContain('colorBlendMode?: ReaderBlendMode | null')
    expect(vueSource).toContain('grayscale?: boolean')
    expect(vueSource).toContain('invertedColors?: boolean')
  })
})
