import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { setActivePinia, createPinia } from 'pinia'
import { useReaderPreferences } from '@/features/reader/stores/readerPreferences'

const storage: Record<string, string> = {}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = String(v) },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
    key: (i: number) => Object.keys(storage)[i] ?? null,
    length: 0,
  } as Storage
}

describe('useReaderPreferences Phase 2 features', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('initializes default Phase 2 preferences correctly', () => {
    const prefs = useReaderPreferences()

    expect(prefs.pageLayout).toBe('auto')
    expect(prefs.shiftDoublePages).toBe(false)
    expect(prefs.invertDoublePages).toBe(false)
    expect(prefs.centerMarginType).toBe('none')
    expect(prefs.webtoonScaleType).toBe('fit')
    expect(prefs.autoWebtoon).toBe(true)
    expect(prefs.stripGapSize).toBe(16)
    expect(prefs.smallerTapZone).toBe(false)
    expect(prefs.pagedDisableZoomIn).toBe(false)
    expect(prefs.pagedDoubleTapZoom).toBe(true)
    expect(prefs.webtoonPinchToZoom).toBe(true)
    expect(prefs.landscapeZoom).toBe(true)
    expect(prefs.landscapeZoomType).toBe('fit')
  })

  it('persists page layout settings in localStorage', async () => {
    const prefs = useReaderPreferences()

    prefs.pageLayout = 'double'
    prefs.shiftDoublePages = true
    prefs.invertDoublePages = true
    prefs.centerMarginType = 'double_and_wide'

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(localStorage.getItem('mihon.reader.pageLayout')).toBe('double')
    expect(localStorage.getItem('mihon.reader.shiftDoublePages')).toBe('true')
    expect(localStorage.getItem('mihon.reader.invertDoublePages')).toBe('true')
    expect(localStorage.getItem('mihon.reader.centerMarginType')).toBe('double_and_wide')
  })

  it('persists webtoon scale and continuous mode preferences', async () => {
    const prefs = useReaderPreferences()

    prefs.webtoonScaleType = '16:9'
    prefs.stripGapSize = 24
    prefs.mode = 'continuous'

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(localStorage.getItem('mihon.reader.webtoonScaleType')).toBe('16:9')
    expect(localStorage.getItem('mihon.reader.stripGapSize')).toBe('24')
    expect(localStorage.getItem('mihon.reader.mode')).toBe('continuous')
  })

  it('persists zoom, gesture and smaller tap zone preferences', async () => {
    const prefs = useReaderPreferences()

    prefs.smallerTapZone = true
    prefs.pagedDisableZoomIn = true
    prefs.webtoonPinchToZoom = false
    prefs.landscapeZoomType = 'double'

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(localStorage.getItem('mihon.reader.smallerTapZone')).toBe('true')
    expect(localStorage.getItem('mihon.reader.pagedDisableZoomIn')).toBe('true')
    expect(localStorage.getItem('mihon.reader.webtoonPinchToZoom')).toBe('false')
    expect(localStorage.getItem('mihon.reader.landscapeZoomType')).toBe('double')
  })

  it('reloads saved preferences on refresh()', () => {
    localStorage.setItem('mihon.reader.pageLayout', 'single')
    localStorage.setItem('mihon.reader.smallerTapZone', 'true')
    localStorage.setItem('mihon.reader.webtoonScaleType', '4:3')
    localStorage.setItem('mihon.reader.landscapeZoomType', 'double')
    localStorage.setItem('mihon.reader.stripGapSize', '32')

    const prefs = useReaderPreferences()
    prefs.refresh()

    expect(prefs.pageLayout).toBe('single')
    expect(prefs.smallerTapZone).toBe(true)
    expect(prefs.webtoonScaleType).toBe('4:3')
    expect(prefs.landscapeZoomType).toBe('double')
    expect(prefs.stripGapSize).toBe(32)
  })
})

describe('ReadingModePage Phase 2 UI Controls', () => {
  const componentSource = readFileSync('src/features/reader/components/ReadingModePage.vue', 'utf8')

  it('includes Page Layout controls', () => {
    expect(componentSource).toContain('pageLayoutChips')
    expect(componentSource).toContain('readerPreferences.pageLayout')
    expect(componentSource).toContain('readerPreferences.shiftDoublePages')
    expect(componentSource).toContain('readerPreferences.invertDoublePages')
  })

  it('includes Center Gutter / Margin selector', () => {
    expect(componentSource).toContain('centerMarginChips')
    expect(componentSource).toContain('readerPreferences.centerMarginType')
  })

  it('includes Webtoon Scale Type chips', () => {
    expect(componentSource).toContain('webtoonScaleChips')
    expect(componentSource).toContain('readerPreferences.webtoonScaleType')
  })

  it('includes Smaller Tap Zones switch', () => {
    expect(componentSource).toContain('readerPreferences.smallerTapZone')
  })

  it('includes Paged Zoom Lock and Webtoon Pinch Zoom controls', () => {
    expect(componentSource).toContain('readerPreferences.pagedDisableZoomIn')
    expect(componentSource).toContain('readerPreferences.pagedDoubleTapZoom')
    expect(componentSource).toContain('readerPreferences.webtoonPinchToZoom')
  })

  it('includes Landscape Zoom 2x chips', () => {
    expect(componentSource).toContain('landscapeZoomTypeChips')
    expect(componentSource).toContain('readerPreferences.landscapeZoomType')
  })

  it('supports continuous vertical mode without unsupported limitation', () => {
    expect(componentSource).toContain("'continuous'")
    expect(componentSource).not.toContain("Long strip with gaps is not supported in the web version")
  })
})
