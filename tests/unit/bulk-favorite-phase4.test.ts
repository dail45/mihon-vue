import { describe, expect, it, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { useBulkFavorite } from '@/features/browse/composables/useBulkFavorite'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import type { Manga } from '@/core/api/types'

// Mock ofetch
vi.mock('ofetch', () => {
  return {
    ofetch: vi.fn().mockImplementation((_url: string, opts?: any) => {
      if (opts?.method === 'POST') {
        return Promise.resolve({ success: true })
      }
      return Promise.resolve({})
    }),
  }
})

describe('Feature 4.4: Bulk Favorite Mode & Selection Toolbar', () => {
  let manga1: Manga
  let manga2: Manga
  let manga3: Manga

  beforeEach(() => {
    setActivePinia(createPinia())
    manga1 = {
      id: 101,
      sourceId: 'src-1',
      title: 'Solo Leveling',
      url: '/manga/101',
      inLibrary: false,
      favorite: false,
    } as unknown as Manga

    manga2 = {
      id: 102,
      sourceId: 'src-1',
      title: 'Tower of God',
      url: '/manga/102',
      inLibrary: false,
      favorite: false,
    } as unknown as Manga

    manga3 = {
      id: 103,
      sourceId: 'src-1',
      title: 'Omniscient Reader',
      url: '/manga/103',
      inLibrary: false,
      favorite: false,
    } as unknown as Manga
  })

  it('manages selection state correctly: select, toggle, and count', () => {
    const bulk = useBulkFavorite()
    expect(bulk.selectionMode.value).toBe(false)
    expect(bulk.selectedCount.value).toBe(0)

    // select manga1
    bulk.select(manga1)
    expect(bulk.selectionMode.value).toBe(true)
    expect(bulk.selectedCount.value).toBe(1)
    expect(bulk.isSelected(101)).toBe(true)
    expect(bulk.isSelected(102)).toBe(false)

    // toggle manga2 on
    bulk.toggleSelection(manga2)
    expect(bulk.selectedCount.value).toBe(2)
    expect(bulk.isSelected(102)).toBe(true)

    // toggle manga1 off
    bulk.toggleSelection(manga1)
    expect(bulk.selectedCount.value).toBe(1)
    expect(bulk.isSelected(101)).toBe(false)
    expect(bulk.selectionMode.value).toBe(true)

    // toggle manga2 off -> auto disables selectionMode
    bulk.toggleSelection(manga2)
    expect(bulk.selectedCount.value).toBe(0)
    expect(bulk.selectionMode.value).toBe(false)
  })

  it('supports selectAll and reverseSelection', () => {
    const bulk = useBulkFavorite()
    const allMangas = [manga1, manga2, manga3]

    // selectAll
    bulk.selectAll(allMangas)
    expect(bulk.selectedCount.value).toBe(3)
    expect(bulk.selectedIds.value).toEqual([101, 102, 103])

    // unselect manga1
    bulk.toggleSelection(manga1)
    expect(bulk.selectedCount.value).toBe(2)

    // reverseSelection
    bulk.reverseSelection(allMangas)
    expect(bulk.selectedCount.value).toBe(1)
    expect(bulk.selectedIds.value).toEqual([101])

    // clearSelection
    bulk.clearSelection()
    expect(bulk.selectedCount.value).toBe(0)
    expect(bulk.selectionMode.value).toBe(false)
  })

  it('toggles selection mode and resets on disable', () => {
    const bulk = useBulkFavorite()
    bulk.select(manga1)
    expect(bulk.selectionMode.value).toBe(true)

    bulk.toggleSelectionMode(false)
    expect(bulk.selectionMode.value).toBe(false)
    expect(bulk.selectedCount.value).toBe(0)

    bulk.toggleSelectionMode(true)
    expect(bulk.selectionMode.value).toBe(true)
  })

  it('computes categorySelection with tri-state status across selected items', () => {
    const server = useSuwayomiStore()
    server.categories = [
      { id: 0, name: 'Default', order: 0 } as any,
      { id: 10, name: 'Reading', order: 1 } as any,
      { id: 20, name: 'Completed', order: 2 } as any,
    ]
    server.libraryByCategory = {
      10: [manga1], // Only manga1 is in 'Reading'
      20: [manga1, manga2], // Both are in 'Completed'
    }

    const bulk = useBulkFavorite()
    bulk.select(manga1)
    bulk.select(manga2)

    const cats = bulk.categorySelection.value
    // Should filter out default category 0
    expect(cats.length).toBe(2)

    const reading = cats.find(c => c.category.id === 10)
    expect(reading?.kind).toBe('tri')
    if (reading?.kind === 'tri') {
      expect(reading.state).toBe('exclude') // Indeterminate since only 1 of 2 is in it
    }

    const completed = cats.find(c => c.category.id === 20)
    expect(completed?.kind).toBe('tri')
    if (completed?.kind === 'tri') {
      expect(completed.state).toBe('include') // Checked since all selected are in it
    }
  })

  it('executes batch add calling POST /api/v1/manga/{id}/library and updating inLibrary', async () => {
    const server = useSuwayomiStore()
    server.apiUrl = 'http://localhost:4567/api/v1'
    server.categories = [{ id: 0, name: 'Default', order: 0 } as any]
    server.libraryByCategory = {}

    const bulk = useBulkFavorite()
    bulk.select(manga1)
    bulk.select(manga2)

    await bulk.executeBatchAdd([])

    expect(manga1.inLibrary).toBe(true)
    expect(manga2.inLibrary).toBe(true)
    expect(bulk.selectionMode.value).toBe(false)
    expect(bulk.selectedCount.value).toBe(0)
  })

  it('verifies BulkSelectionToolbar component contract', () => {
    const toolbarSrc = readFileSync('src/features/browse/components/BulkSelectionToolbar.vue', 'utf8')
    expect(toolbarSrc).toContain('selectedCount: number')
    expect(toolbarSrc).toContain('isRunning')
    expect(toolbarSrc).toContain('clear-selection')
    expect(toolbarSrc).toContain('favorite')
    expect(toolbarSrc).toContain('select-all')
    expect(toolbarSrc).toContain('reverse-selection')
    expect(toolbarSrc).toContain('v-progress-circular')
  })

  it('verifies SourceView wires BulkSelectionToolbar and bulk selection', () => {
    const sourceViewSrc = readFileSync('src/features/browse/views/SourceView.vue', 'utf8')
    expect(sourceViewSrc).toContain('useBulkFavorite')
    expect(sourceViewSrc).toContain('BulkSelectionToolbar')
    expect(sourceViewSrc).toContain('bulkFavorite.selectionMode.value')
    expect(sourceViewSrc).toContain(':selection="bulkFavorite.selectedIds.value"')
    expect(sourceViewSrc).toContain('onMangaLongPress')
  })

  it('verifies GlobalSearchView wires BulkSelectionToolbar and bulk selection', () => {
    const globalSearchSrc = readFileSync('src/features/browse/views/GlobalSearchView.vue', 'utf8')
    expect(globalSearchSrc).toContain('useBulkFavorite')
    expect(globalSearchSrc).toContain('BulkSelectionToolbar')
    expect(globalSearchSrc).toContain('bulkFavorite.selectionMode.value')
    expect(globalSearchSrc).toContain(':selection="bulkFavorite.selectedIds.value"')
    expect(globalSearchSrc).toContain('onMangaLongClick')
  })

  it('verifies MangaCard displays selection checkmark overlay and primary selection border', () => {
    const cardSrc = readFileSync('src/features/browse/components/MangaCard.vue', 'utf8')
    expect(cardSrc).toContain('selection-overlay')
    expect(cardSrc).toContain('selection-check-badge')
    expect(cardSrc).toContain('manga-tile-selected')
  })

  it('verifies required i18n keys in en.json and ru.json', () => {
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'))
    const ru = JSON.parse(readFileSync('src/locales/ru.json', 'utf8'))

    expect(en.action_bulk_select).toBe('Bulk favorite')
    expect(ru.action_bulk_select).toBe('Массовое добавление')
    expect(en.clear_selection).toBe('Clear selection')
    expect(ru.clear_selection).toBe('Снять выбор')
  })
})
