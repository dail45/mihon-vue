import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { Manga } from '@/core/api/types'
import type { DisplayMode } from '@/features/settings/stores/preferences'

export interface UseVirtualMangaGridOptions {
  items: Ref<Manga[]>
  containerRef: Ref<HTMLElement | null>
  displayMode: Ref<DisplayMode | undefined>
  columnsPreference: Ref<number>
  overscanRows?: number
  threshold?: number
}

export function useVirtualMangaGrid(options: UseVirtualMangaGridOptions) {
  const {
    items,
    containerRef,
    displayMode,
    columnsPreference,
    overscanRows = 3,
    threshold = 24,
  } = options

  const isBrowser = typeof window !== 'undefined'
  const containerWidth = ref(isBrowser ? window.innerWidth : 1200)
  const windowScrollY = ref(isBrowser ? window.scrollY : 0)
  const windowHeight = ref(isBrowser ? window.innerHeight : 800)

  // 1. Display mode flags
  const isList = computed(() => displayMode.value === 'list')
  const isComfortable = computed(() => displayMode.value === 'comfortable')
  const isPanorama = computed(() => displayMode.value === 'comfortable-panorama')

  // 2. Dynamic column count
  // Fixed columns if columnsPreference > 0; otherwise auto adaptive layout matching .library-grid
  const columnsCount = computed(() => {
    if (isList.value) return 1
    const pref = columnsPreference.value
    if (pref && pref > 0) return pref
    // Adaptive: gap is 4px, padding is 8px on left and right (16px total)
    // grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)) for panorama, 128px for regular
    const minColWidth = isPanorama.value ? 240 : 128
    const availableWidth = Math.max(0, containerWidth.value - 16)
    return Math.max(1, Math.floor((availableWidth + 4) / (minColWidth + 4)))
  })

  // 3. Row height calculation matching authentic Mihon geometries
  // - List: 56px fixed (LibraryListItem)
  // - Compact / Covers: tileWidth * 1.5 + 4px (gap)
  // - Comfortable: tileWidth * 1.5 + 44px (title box) + 4px (gap)
  // - Comfortable Panorama: tileWidth * (9 / 16) + 44px (title box) + 4px (gap)
  const rowHeight = computed(() => {
    if (isList.value) return 56
    const cols = columnsCount.value
    const totalGaps = (cols - 1) * 4
    const tileWidth = Math.max(10, (containerWidth.value - 16 - totalGaps) / cols)
    if (isPanorama.value) {
      return Math.round(tileWidth * (9 / 16) + 44 + 4)
    }
    if (isComfortable.value) {
      return Math.round(tileWidth * 1.5 + 44 + 4)
    }
    return Math.round(tileWidth * 1.5 + 4)
  })

  const totalRows = computed(() => Math.ceil(items.value.length / columnsCount.value))
  const totalHeight = computed(() => totalRows.value * rowHeight.value)

  // 4. Viewport row bounds calculation
  const startRow = ref(0)
  const endRow = ref(10)

  function updateBounds() {
    if (!isBrowser) return
    const el = containerRef.value
    const currentScroll = window.scrollY
    const currentHeight = window.innerHeight
    windowScrollY.value = currentScroll
    windowHeight.value = currentHeight

    const containerTop = el ? el.getBoundingClientRect().top + currentScroll : 0
    const relativeScrollTop = Math.max(0, currentScroll - containerTop)
    const relativeScrollBottom = Math.max(0, currentScroll + currentHeight - containerTop)

    const height = rowHeight.value || 56
    const rows = totalRows.value

    const calculatedStart = Math.max(0, Math.floor(relativeScrollTop / height) - overscanRows)
    const calculatedEnd = Math.min(rows, Math.ceil(relativeScrollBottom / height) + overscanRows)

    startRow.value = calculatedStart
    endRow.value = Math.max(calculatedStart + 1, calculatedEnd)
  }

  let rafId: number | null = null
  function onScrollOrResize() {
    if (!isBrowser) return
    if (rafId !== null) return
    rafId = window.requestAnimationFrame(() => {
      rafId = null
      updateBounds()
    })
  }

  // 5. Virtualization activation threshold
  const isVirtualActive = computed(() => items.value.length > threshold)

  const startIndex = computed(() => {
    if (!isVirtualActive.value) return 0
    return startRow.value * columnsCount.value
  })

  const endIndex = computed(() => {
    if (!isVirtualActive.value) return items.value.length
    return Math.min(items.value.length, endRow.value * columnsCount.value)
  })

  const topSpacerHeight = computed(() => {
    if (!isVirtualActive.value || startRow.value <= 0) return 0
    const raw = startRow.value * rowHeight.value
    return isList.value ? raw : Math.max(0, raw - 4)
  })

  const bottomSpacerHeight = computed(() => {
    if (!isVirtualActive.value) return 0
    const remaining = totalRows.value - endRow.value
    if (remaining <= 0) return 0
    const raw = remaining * rowHeight.value
    return isList.value ? raw : Math.max(0, raw - 4)
  })

  const visibleItems = computed(() => {
    if (!isVirtualActive.value) return items.value
    return items.value.slice(startIndex.value, endIndex.value)
  })

  // 6. ResizeObserver for container element width
  let resizeObserver: ResizeObserver | null = null

  function initObserver() {
    if (!isBrowser || typeof ResizeObserver === 'undefined') return
    const el = containerRef.value
    if (!el) return
    resizeObserver?.disconnect()
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentBoxSize && entry.contentBoxSize.length > 0) {
          containerWidth.value = entry.contentBoxSize[0].inlineSize
        } else if (entry.contentRect) {
          containerWidth.value = entry.contentRect.width
        }
      }
      onScrollOrResize()
    })
    resizeObserver.observe(el)
    containerWidth.value = el.clientWidth || window.innerWidth
  }

  watch(containerRef, () => {
    initObserver()
    updateBounds()
  })

  watch([items, displayMode, columnsPreference], () => {
    updateBounds()
  })

  if (getCurrentInstance()) {
    onMounted(() => {
      if (isBrowser) {
        window.addEventListener('scroll', onScrollOrResize, { passive: true })
        window.addEventListener('resize', onScrollOrResize, { passive: true })
        initObserver()
        updateBounds()
      }
    })

    onBeforeUnmount(() => {
      if (isBrowser) {
        window.removeEventListener('scroll', onScrollOrResize)
        window.removeEventListener('resize', onScrollOrResize)
        if (rafId !== null) window.cancelAnimationFrame(rafId)
      }
      resizeObserver?.disconnect()
    })
  } else {
    initObserver()
    updateBounds()
  }

  return {
    isVirtualActive,
    visibleItems,
    topSpacerHeight,
    bottomSpacerHeight,
    totalHeight,
    columnsCount,
    rowHeight,
    startIndex,
    endIndex,
  }
}
