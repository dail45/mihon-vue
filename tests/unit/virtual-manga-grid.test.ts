import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ref } from 'vue'
import { useVirtualMangaGrid } from '@/core/composables/useVirtualMangaGrid'
import type { Manga } from '@/core/api/types'

describe('Row-Based Viewport Virtualization', () => {
  const collectionSource = readFileSync(
    resolve(process.cwd(), 'src/features/browse/components/MangaCollection.vue'),
    'utf8',
  )
  const composableSource = readFileSync(
    resolve(process.cwd(), 'src/core/composables/useVirtualMangaGrid.ts'),
    'utf8',
  )

  it('preserves test string invariants in MangaCollection.vue', () => {
    expect(collectionSource).toContain('<LibraryListItem')
    expect(collectionSource).toContain('v-for="item in items"')
    expect(collectionSource).toContain('repeat(${columns.value}, minmax(0, 1fr))')
    expect(collectionSource).toContain("libraryComfortable = computed(() => !props.catalogue && props.display === 'comfortable')")
    expect(collectionSource).toContain('<LibraryComfortableGridItem')
    expect(collectionSource).toContain('<GlobalSearchItem v-if="showGlobalSearch"')
    expect(collectionSource).toContain('variant="grid"')
    expect(collectionSource).toContain('fastScrollVisible')
  })

  it('implements row-based virtualization logic with ResizeObserver and RAF throttling', () => {
    expect(composableSource).toContain('ResizeObserver')
    expect(composableSource).toContain('requestAnimationFrame')
    expect(composableSource).toContain('isVirtualActive')
    expect(composableSource).toContain('topSpacerHeight')
    expect(composableSource).toContain('bottomSpacerHeight')
    expect(composableSource).toContain('visibleItems')
  })

  it('mounts only a small subset of items when rendering 6,000 manga', () => {
    // Generate 6,000 synthetic manga entries
    const items = ref<Manga[]>(
      Array.from({ length: 6000 }, (_, i) => ({
        id: i + 1,
        title: `Manga ${i + 1}`,
        favorite: true,
      } as Manga))
    )

    const dummyContainer = {
      clientWidth: 1200,
      getBoundingClientRect: () => ({ top: 100, bottom: 50000, left: 0, right: 1200, width: 1200, height: 49900 }),
    } as unknown as HTMLElement
    const containerRef = ref<HTMLElement | null>(dummyContainer)
    const displayMode = ref<'compact' | 'comfortable' | 'covers' | 'list'>('compact')
    const columnsPref = ref(4)

    const virtual = useVirtualMangaGrid({
      items,
      containerRef,
      displayMode,
      columnsPreference: columnsPref,
      overscanRows: 3,
    })

    expect(virtual.isVirtualActive.value).toBe(true)
    expect(virtual.columnsCount.value).toBe(4)
    // 6,000 items in 4 columns = 1,500 rows
    expect(virtual.visibleItems.value.length).toBeLessThanOrEqual(50)
    expect(virtual.visibleItems.value.length).toBeGreaterThan(0)
    expect(virtual.topSpacerHeight.value).toBeGreaterThanOrEqual(0)
    expect(virtual.bottomSpacerHeight.value).toBeGreaterThan(0)
  })

  it('uses 56px fixed height for List mode', () => {
    const items = ref<Manga[]>([
      { id: 1, title: 'Test 1' } as Manga,
      { id: 2, title: 'Test 2' } as Manga,
    ])
    const containerRef = ref<HTMLElement | null>(null)
    const displayMode = ref<'compact' | 'comfortable' | 'covers' | 'list'>('list')
    const columnsPref = ref(0)

    const virtual = useVirtualMangaGrid({
      items,
      containerRef,
      displayMode,
      columnsPreference: columnsPref,
    })

    expect(virtual.columnsCount.value).toBe(1)
    expect(virtual.rowHeight.value).toBe(56)
  })
})
