import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { Manga } from '@/core/api/types'
import type { DisplayMode } from '@/features/settings/stores/preferences'

export interface VirtualGridRow {
  id: string | number
  rowIndex: number
  items: Manga[]
}

export interface UseResponsiveGridRowsOptions {
  items: Ref<Manga[]>
  containerRef: Ref<HTMLElement | null>
  displayMode: Ref<DisplayMode | string | undefined>
  columnsPreference?: Ref<number>
}

export function useResponsiveGridRows(options: UseResponsiveGridRowsOptions) {
  const {
    items,
    containerRef,
    displayMode,
    columnsPreference = ref(0),
  } = options

  const isBrowser = typeof window !== 'undefined'
  const containerWidth = ref(isBrowser ? window.innerWidth : 1200)

  let observer: ResizeObserver | null = null

  function updateWidth() {
    if (containerRef.value) {
      const rect = containerRef.value.getBoundingClientRect()
      if (rect.width > 0) {
        containerWidth.value = rect.width
      }
    } else if (isBrowser) {
      containerWidth.value = window.innerWidth
    }
  }

  function setupObserver(el: HTMLElement | null) {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    if (isBrowser && 'ResizeObserver' in window && el) {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            containerWidth.value = entry.contentRect.width
          }
        }
      })
      observer.observe(el)
    }
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      updateWidth()
      setupObserver(containerRef.value)
    })

    watch(containerRef, (newEl) => {
      updateWidth()
      setupObserver(newEl)
    })

    onBeforeUnmount(() => {
      if (observer) {
        observer.disconnect()
        observer = null
      }
    })
  }

  const isList = computed(() => displayMode.value === 'list')
  const isComfortable = computed(() => displayMode.value === 'comfortable')
  const isPanorama = computed(() => displayMode.value === 'comfortable-panorama')

  // Calculate number of columns
  const columnsCount = computed(() => {
    if (isList.value) return 1
    const pref = columnsPreference.value
    if (pref && pref > 0) return pref

    // Adaptive Mihon grid: minColWidth 128px (or 240px for panorama), 4px gap, 16px total padding
    const minColWidth = isPanorama.value ? 240 : 128
    const availableWidth = Math.max(0, containerWidth.value - 16)
    return Math.max(1, Math.floor((availableWidth + 4) / (minColWidth + 4)))
  })

  // Calculate row height matching authentic Mihon tile dimensions
  const rowHeight = computed(() => {
    if (isList.value) return 56 // Fixed 56px height for LibraryListItem
    const cols = columnsCount.value
    const totalGaps = (cols - 1) * 4
    const tileWidth = Math.max(10, (containerWidth.value - 16 - totalGaps) / cols)

    if (isPanorama.value) {
      return Math.round(tileWidth * (9 / 16) + 44 + 4)
    }
    if (isComfortable.value) {
      return Math.round(tileWidth * 1.5 + 44 + 4)
    }
    // Compact & Covers mode
    return Math.round(tileWidth * 1.5 + 4)
  })

  // Chunk items into virtual rows
  const rows = computed<VirtualGridRow[]>(() => {
    const list = items.value
    if (!list || list.length === 0) return []

    const cols = columnsCount.value
    const chunked: VirtualGridRow[] = []

    for (let i = 0; i < list.length; i += cols) {
      const rowItems = list.slice(i, i + cols)
      const rowIndex = Math.floor(i / cols)
      const firstId = rowItems[0]?.id ?? i
      chunked.push({
        id: `row-${rowIndex}-${firstId}`,
        rowIndex,
        items: rowItems,
      })
    }

    return chunked
  })

  return {
    containerWidth,
    columnsCount,
    rowHeight,
    rows,
    isList,
    isComfortable,
    isPanorama,
  }
}
