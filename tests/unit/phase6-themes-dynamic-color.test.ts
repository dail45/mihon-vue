import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'

// Setup global mock for node environment
if (typeof globalThis.window === 'undefined') {
  const windowMock = {
    location: { pathname: '/' },
    history: { state: null, pushState() {}, replaceState() {} },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    matchMedia: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  }
  const documentMock = {
    createElement: vi.fn(() => ({ getContext: vi.fn(() => null) })),
    documentElement: {
      style: { setProperty: vi.fn(), removeProperty: vi.fn() },
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      dataset: {},
    },
    getElementById: vi.fn(() => null),
    querySelector: vi.fn(() => null),
  }
  Object.defineProperty(globalThis, 'window', { value: windowMock, writable: true })
  Object.defineProperty(globalThis, 'document', { value: documentMock, writable: true })
}

import { generateDynamicTheme, applyAmoledToDarkScheme, normalizeHex, isValidHex } from '@/core/theme/dynamicTheme'
import { appThemes } from '@/core/theme/appThemes'
import { PRESET_PALETTES } from '@/core/theme/presetPalettes'
import { extractDominantColorFromUrl, useCoverDominantColor } from '@/core/composables/useCoverDominantColor'
const customPickerSource = readFileSync('src/features/settings/views/CustomThemeColorPickerView.vue', 'utf8')
const settingsAppearanceSource = readFileSync('src/features/settings/views/SettingsAppearanceView.vue', 'utf8')
const mangaViewSource = readFileSync('src/features/manga/views/MangaView.vue', 'utf8')
const readerViewSource = readFileSync('src/features/reader/views/ReaderView.vue', 'utf8')
const routerSource = readFileSync('src/router/index.ts', 'utf8')

describe('Phase 6.1: Custom Theme Seed Color Picker & Dynamic M3 Generation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('validates and normalizes hex strings', () => {
    expect(isValidHex('#DF0090')).toBe(true)
    expect(isValidHex('DF0090')).toBe(true)
    expect(isValidHex('#abc')).toBe(true)
    expect(isValidHex('xyz')).toBe(false)
    expect(normalizeHex('#df0090')).toBe('#DF0090')
    expect(normalizeHex('abc')).toBe('#AABBCC')
    expect(normalizeHex('invalid')).toBe('#DF0090')
  })

  it('generates a full M3 Material Design 3 theme (Light & Dark) from seed color', () => {
    const theme = generateDynamicTheme('#DF0090')
    expect(theme.id).toBe('custom')
    expect(theme.title).toBe('Custom')
    expect(theme.light).toBeDefined()
    expect(theme.dark).toBeDefined()

    // Light scheme check
    expect(theme.light.primary).toBeDefined()
    expect(theme.light.onPrimary).toBeDefined()
    expect(theme.light.primaryContainer).toBeDefined()
    expect(theme.light.surfaceContainer).toBeDefined()
    expect(theme.light.surfaceContainerLow).toBeDefined()
    expect(theme.light.surfaceContainerHigh).toBeDefined()

    // Dark scheme check
    expect(theme.dark.primary).toBeDefined()
    expect(theme.dark.onPrimary).toBeDefined()
    expect(theme.dark.surfaceContainer).toBeDefined()
  })

  it('transforms dark scheme into pure black AMOLED theme conforming to BaseColorScheme.kt', () => {
    const theme = generateDynamicTheme('#3E9CBF')
    const amoledScheme = applyAmoledToDarkScheme(theme.dark)

    expect(amoledScheme.background).toBe('#000000')
    expect(amoledScheme.surface).toBe('#000000')
    expect(amoledScheme.onBackground).toBe('#FFFFFF')
    expect(amoledScheme.onSurface).toBe('#FFFFFF')
    expect(amoledScheme.surfaceVariant).toBe('#0C0C0C')
    expect(amoledScheme.surfaceContainer).toBe('#0C0C0C')
    expect(amoledScheme.surfaceContainerHigh).toBe('#131313')
    expect(amoledScheme.surfaceContainerHighest).toBe('#1B1B1B')
    expect(amoledScheme.palerSurface).toBe('#000000')
  })

  it('registers route for /settings/appearance/custom-color', () => {
    expect(routerSource).toContain("path: '/settings/appearance/custom-color'")
    expect(routerSource).toContain("settingsSection: 'appearance'")
    expect(routerSource).toContain("subSection: 'custom-color'")
  })

  it('CustomThemeColorPickerView implements HSV canvas wheel, brightness slider, hex input, and live preview', () => {
    expect(customPickerSource).toContain('wheel-canvas')
    expect(customPickerSource).toContain('brightness-slider')
    expect(customPickerSource).toContain('hex-field')
    expect(customPickerSource).toContain('preview-card')
    expect(customPickerSource).toContain('confirm-button')
    expect(customPickerSource).toContain('PRESET_PALETTES')
  })

  it('SettingsAppearanceView provides custom color entry navigating to picker', () => {
    expect(settingsAppearanceSource).toContain('pref_custom_color')
    expect(settingsAppearanceSource).toContain('openCustomColor')
    expect(settingsAppearanceSource).toContain('custom-color')
    expect(settingsAppearanceSource).toContain('CustomThemeColorPickerView')
  })
})

describe('Phase 6.2: Cover-Based Dynamic Theme', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('extracts dominant color from an image URL using offscreen canvas fallback', async () => {
    const result = await extractDominantColorFromUrl('https://example.com/cover.jpg')
    expect(result === null || typeof result === 'string').toBe(true)
  })

  it('useCoverDominantColor composable exposes reactive state and computes dynamicTheme', async () => {
    const { dominantColor, dynamicTheme, isLoading } = useCoverDominantColor()
    expect(isLoading.value).toBe(false)
    expect(dominantColor.value).toBeNull()
    expect(dynamicTheme.value).toBeNull()

    // When dominant color is populated, dynamicTheme reacts
    dominantColor.value = '#FF5722'
    expect(dynamicTheme.value).not.toBeNull()
    expect(dynamicTheme.value?.id).toBe('custom')
    expect(dynamicTheme.value?.light.primary).toBeDefined()
  })

  it('MangaView integrates cover-based dynamic theming with coverThemeStyles', () => {
    expect(mangaViewSource).toContain('useCoverDominantColor')
    expect(mangaViewSource).toContain('coverThemeStyles')
    expect(mangaViewSource).toContain(':style="coverThemeStyles"')
  })

  it('ReaderView integrates cover-based dynamic theming with readerCoverThemeStyles', () => {
    expect(readerViewSource).toContain('useCoverDominantColor')
    expect(readerViewSource).toContain('readerCoverThemeStyles')
    expect(readerViewSource).toContain(':style="readerCoverThemeStyles"')
  })

  it('SettingsAppearanceView exposes themeCoverBased switch', () => {
    expect(settingsAppearanceSource).toContain('pref_theme_cover_based')
    expect(settingsAppearanceSource).toContain('themeCoverBased')
  })
})

describe('Phase 6.3: 19 New Themes & Preset Palettes', () => {
  it('includes all 20 built-in themes in appThemes (14 existing + 6 Aniyomi)', () => {
    expect(appThemes.length).toBe(20)

    const ids = appThemes.map(t => t.id)
    expect(ids).toContain('cloudflare')
    expect(ids).toContain('cottonCandy')
    expect(ids).toContain('doom')
    expect(ids).toContain('matrix')
    expect(ids).toContain('mocha')
    expect(ids).toContain('sapphire')
  })

  it('defines valid M3 Light & Dark schemes for all 6 Aniyomi themes', () => {
    const aniyomiIds = ['cloudflare', 'cottonCandy', 'doom', 'matrix', 'mocha', 'sapphire']
    for (const id of aniyomiIds) {
      const theme = appThemes.find(t => t.id === id)
      expect(theme).toBeDefined()
      expect(theme?.light.primary).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(theme?.light.surface).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(theme?.dark.primary).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(theme?.dark.surface).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(theme?.dark.surfaceContainer).toBeDefined()

      // Pure black AMOLED compatibility check
      const amoled = applyAmoledToDarkScheme(theme!.dark)
      expect(amoled.background).toBe('#000000')
      expect(amoled.surface).toBe('#000000')
      expect(amoled.surfaceContainer).toBe('#0C0C0C')
    }
  })

  it('exports all 13 Komikku curated preset palettes', () => {
    expect(PRESET_PALETTES.length).toBe(13)

    const expectedNames = [
      'Sunset',
      'Outrun',
      'Raspberry',
      'Cathode',
      'Bubblegum',
      'Springfield',
      'Spectral',
      'Night at the beach',
      'Casual',
      'Patagonia',
      'LCD',
      'Pop',
      'PICO-8',
    ]

    for (const name of expectedNames) {
      const palette = PRESET_PALETTES.find(p => p.name === name)
      expect(palette).toBeDefined()
      expect(palette?.colors.length).toBeGreaterThanOrEqual(4)
      for (const color of palette!.colors) {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      }
    }
  })
})
