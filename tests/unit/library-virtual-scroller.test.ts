import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useResponsiveGridRows } from '@/core/composables/useResponsiveGridRows'
import type { Manga } from '@/core/api/types'

describe('Production Library Virtual Grid Scroller', () => {
  it('calculates 1D row chunking for List mode in useResponsiveGridRows', () => {
    const mockManga: Manga[] = [
      { id: 1, title: 'Manga 1' } as unknown as Manga,
      { id: 2, title: 'Manga 2' } as unknown as Manga,
      { id: 3, title: 'Manga 3' } as unknown as Manga,
    ]

    const items = ref(mockManga)
    const containerRef = ref<HTMLElement | null>(null)
    const displayMode = ref('list')

    const {
      columnsCount,
      rowHeight,
      rows,
      isList,
    } = useResponsiveGridRows({
      items,
      containerRef,
      displayMode,
    })

    expect(isList.value).toBe(true)
    expect(columnsCount.value).toBe(1)
    expect(rowHeight.value).toBe(56)
    expect(rows.value).toHaveLength(3)
    expect(rows.value[0]?.items).toHaveLength(1)
    expect(rows.value[0]?.items[0]?.id).toBe(1)
  })

  it('calculates 2D multi-column row chunking for Compact Grid mode', () => {
    const mockManga: Manga[] = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      title: `Manga ${i + 1}`,
    } as unknown as Manga))

    const items = ref(mockManga)
    const containerRef = ref<HTMLElement | null>(null)
    const displayMode = ref('compact')
    const columnsPreference = ref(3) // 3 columns fixed

    const {
      columnsCount,
      rows,
      isList,
    } = useResponsiveGridRows({
      items,
      containerRef,
      displayMode,
      columnsPreference,
    })

    expect(isList.value).toBe(false)
    expect(columnsCount.value).toBe(3)
    // 10 items chunked into rows of 3 -> 4 rows (3 + 3 + 3 + 1)
    expect(rows.value).toHaveLength(4)
    expect(rows.value[0]?.items).toHaveLength(3)
    expect(rows.value[1]?.items).toHaveLength(3)
    expect(rows.value[2]?.items).toHaveLength(3)
    expect(rows.value[3]?.items).toHaveLength(1)
    expect(rows.value[3]?.items[0]?.id).toBe(10)
  })
})
