import { describe, expect, it, vi, beforeEach } from 'vitest'
import { nextTick, ref } from 'vue'
import { usePagePreloader } from '@/features/reader/composables/usePagePreloader'

describe('usePagePreloader', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    global.Image = class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      crossOrigin = ''
      decoding = ''
      complete = true
      src = ''
    } as any
  })

  it('preloads forward (+1, +2) and backward (-1) pages', async () => {
    const pageIndex = ref(5)
    const pageCount = ref(10)
    const pageUrl = (idx: number) => `http://example.com/page/${idx}.jpg`

    const { preloadCache, isPreloaded } = usePagePreloader({
      pageIndex: () => pageIndex.value,
      pageCount: () => pageCount.value,
      pageUrl,
      bufferAhead: 2,
      bufferBehind: 1,
    })

    // At page 5, should preload 6, 7 and 4
    expect(preloadCache.value.has(6)).toBe(true)
    expect(preloadCache.value.has(7)).toBe(true)
    expect(preloadCache.value.has(4)).toBe(true)
    expect(preloadCache.value.has(5)).toBe(false) // current page is displayed, not preloaded buffer
    expect(isPreloaded(6)).toBe(true)

    // Move to page 6
    pageIndex.value = 6
    await nextTick()

    // At page 6, should preload 7, 8 and 5
    expect(preloadCache.value.has(7)).toBe(true)
    expect(preloadCache.value.has(8)).toBe(true)
    expect(preloadCache.value.has(5)).toBe(true)
  })

  it('respects lower and upper bounds of pageCount', async () => {
    const pageIndex = ref(0)
    const pageCount = ref(3)
    const pageUrl = (idx: number) => `http://example.com/page/${idx}.jpg`

    const { preloadCache } = usePagePreloader({
      pageIndex: () => pageIndex.value,
      pageCount: () => pageCount.value,
      pageUrl,
      bufferAhead: 2,
      bufferBehind: 1,
    })

    // At page 0 with total 3: forward: 1, 2. backward: -1 is out of bounds
    expect(preloadCache.value.has(1)).toBe(true)
    expect(preloadCache.value.has(2)).toBe(true)
    expect(preloadCache.value.has(-1)).toBe(false)
    expect(preloadCache.value.has(3)).toBe(false)
  })

  it('clears cache and revokes image sources', () => {
    const pageIndex = ref(2)
    const pageCount = ref(10)
    const pageUrl = (idx: number) => `http://example.com/page/${idx}.jpg`

    const { preloadCache, clearCache } = usePagePreloader({
      pageIndex: () => pageIndex.value,
      pageCount: () => pageCount.value,
      pageUrl,
    })

    expect(preloadCache.value.size).toBeGreaterThan(0)
    clearCache()
    expect(preloadCache.value.size).toBe(0)
  })
})
