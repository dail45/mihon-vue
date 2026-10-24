/**
 * Anticipatory Reader Page Preloader Composable
 *
 * Prefetches subsequent pages (currentPage + 1, + 2) and preceding pages (currentPage - 1)
 * into an in-memory HTMLImageElement cache so that page turns in paged mode render with 0ms delay.
 * Automatically cleans up image references and revokes sources on chapter change and unmount.
 *
 * Reference:
 * - Mihon HttpPageLoader.kt
 * - Komikku ReaderPreferences.preloadSize
 */

import { getCurrentInstance, onBeforeUnmount, ref, watch, type Ref } from 'vue'

export interface PagePreloaderOptions {
  pageIndex: () => number
  pageCount: () => number
  pageUrl: (index: number) => string
  bufferAhead?: number // default: 2
  bufferBehind?: number // default: 1
  enabled?: () => boolean // default: true
}

export interface PagePreloaderReturn {
  preloadCache: Ref<Map<number, HTMLImageElement>>
  clearCache: () => void
  isPreloaded: (index: number) => boolean
  getCachedImage: (index: number) => HTMLImageElement | undefined
}

export function usePagePreloader(options: PagePreloaderOptions): PagePreloaderReturn {
  const {
    pageIndex,
    pageCount,
    pageUrl,
    bufferAhead = 2,
    bufferBehind = 1,
    enabled = () => true,
  } = options

  const preloadCache = ref(new Map<number, HTMLImageElement>()) as Ref<Map<number, HTMLImageElement>>

  function clearCache(): void {
    if (preloadCache.value.size === 0) return

    for (const img of preloadCache.value.values()) {
      img.onload = null
      img.onerror = null
      img.src = ''
    }
    preloadCache.value.clear()
  }

  function preloadPage(index: number): void {
    if (typeof Image === 'undefined') return
    if (preloadCache.value.has(index)) return

    const url = pageUrl(index)
    if (!url) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.src = url

    preloadCache.value.set(index, img)
  }

  function pruneDistant(currentIndex: number): void {
    const minKeep = currentIndex - (bufferBehind + 8)
    const maxKeep = currentIndex + (bufferAhead + 8)

    for (const [idx, img] of preloadCache.value.entries()) {
      if (idx < minKeep || idx > maxKeep) {
        img.onload = null
        img.onerror = null
        img.src = ''
        preloadCache.value.delete(idx)
      }
    }
  }

  function runPreload(): void {
    if (!enabled()) return

    const current = pageIndex()
    const total = pageCount()
    if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return

    // Preload forward pages (+1, +2, etc.)
    for (let step = 1; step <= bufferAhead; step++) {
      const target = current + step
      if (target >= 0 && target < total) {
        preloadPage(target)
      }
    }

    // Preload backward page (-1, etc.)
    for (let step = 1; step <= bufferBehind; step++) {
      const target = current - step
      if (target >= 0 && target < total) {
        preloadPage(target)
      }
    }

    pruneDistant(current)
  }

  // Watch for pageIndex and pageCount changes
  watch(
    [pageIndex, pageCount],
    ([newIdx, newCount], [, oldCount]) => {
      // If pageCount changed drastically or reset to 0, clear old chapter cache
      if (oldCount !== undefined && Math.abs((newCount ?? 0) - (oldCount ?? 0)) > 5 && (newIdx ?? 0) === 0) {
        clearCache()
      }
      runPreload()
    },
    { immediate: true }
  )

  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      clearCache()
    })
  }

  function isPreloaded(index: number): boolean {
    const img = preloadCache.value.get(index)
    return Boolean(img && (img.complete || img.src))
  }

  function getCachedImage(index: number): HTMLImageElement | undefined {
    return preloadCache.value.get(index)
  }

  return {
    preloadCache,
    clearCache,
    isPreloaded,
    getCachedImage,
  }
}
