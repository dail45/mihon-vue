import { describe, expect, it, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { readFileSync } from 'node:fs'

const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v) },
  removeItem: (k: string) => { storage.delete(k) },
  clear: () => { storage.clear() },
})

import {
  globalSearchPinnedState,
  getNextGlobalSearchPinnedState,
  GLOBAL_SEARCH_PINNED_STATE_KEY,
} from '@/features/browse/stores/browsePreferences'

const toolbarSource = readFileSync('src/features/browse/components/GlobalSearchToolbar.vue', 'utf8')
const viewSource = readFileSync('src/features/browse/views/GlobalSearchView.vue', 'utf8')

describe('Feature 1.5: Global Search Pinned-State 3-Way Cycle Filter', () => {
  beforeEach(async () => {
    storage.clear()
    globalSearchPinnedState.value = 'PinnedOnly'
    await nextTick()
  })

  it('defaults globalSearchPinnedState to PinnedOnly and persists to localStorage', async () => {
    expect(GLOBAL_SEARCH_PINNED_STATE_KEY).toBe('mihon.globalSearchPinnedState')
    expect(globalSearchPinnedState.value).toBe('PinnedOnly')

    globalSearchPinnedState.value = 'Unpinned'
    await nextTick()
    expect(storage.get('mihon.globalSearchPinnedState')).toBe('Unpinned')

    globalSearchPinnedState.value = 'All'
    await nextTick()
    expect(storage.get('mihon.globalSearchPinnedState')).toBe('All')

    globalSearchPinnedState.value = 'PinnedOnly'
    await nextTick()
    expect(storage.get('mihon.globalSearchPinnedState')).toBe('PinnedOnly')
  })

  it('cycles sequentially: PinnedOnly -> Unpinned -> All -> PinnedOnly', () => {
    expect(getNextGlobalSearchPinnedState('PinnedOnly')).toBe('Unpinned')
    expect(getNextGlobalSearchPinnedState('Unpinned')).toBe('All')
    expect(getNextGlobalSearchPinnedState('All')).toBe('PinnedOnly')
  })

  it('GlobalSearchToolbar implements the 3-state cycling filter chip with required icons', () => {
    // Toolbar props and types
    expect(toolbarSource).toContain('sourceFilter: GlobalSearchPinnedState')
    expect(toolbarSource).toContain('change-source-filter')

    // Cycle helper in toolbar
    expect(toolbarSource).toContain('function cycleSourceFilter()')
    expect(toolbarSource).toContain("PinnedOnly: 'Unpinned'")
    expect(toolbarSource).toContain("Unpinned: 'All'")
    expect(toolbarSource).toContain("All: 'PinnedOnly'")

    // Required icons
    expect(toolbarSource).toContain("'mdi-pin'")
    expect(toolbarSource).toContain("'mdi-pin-off-outline'")
    expect(toolbarSource).toContain("'mdi-check-all'")

    // Material Symbol ligatures
    expect(toolbarSource).toContain("symbol: 'keep'")
    expect(toolbarSource).toContain("symbol: 'keep_off'")
    expect(toolbarSource).toContain("symbol: 'done_all'")

    // Dynamic chip template
    expect(toolbarSource).toContain('@click="cycleSourceFilter"')
    expect(toolbarSource).toContain(':class="filterConfig.mdiClass"')
  })

  it('GlobalSearchView filters query pool by active pinned state and falls back to All if 0 pinned sources exist', () => {
    expect(viewSource).toContain('export type SourceFilter = GlobalSearchPinnedState')
    expect(viewSource).toContain('function hasPinnedSources(): boolean')
    expect(viewSource).toContain('function checkPinnedFallback()')
    expect(viewSource).toContain("if (filter === 'PinnedOnly')")
    expect(viewSource).toContain("if (filter === 'Unpinned')")
    expect(viewSource).toContain('!isSourcePinned(source.id)')
    expect(viewSource).toContain("sourceFilter.value = 'All'")
    expect(viewSource).toContain("globalSearchPinnedState.value = 'All'")
  })

  it('locales contain unpinned_sources translations for en and ru', () => {
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'))
    const ru = JSON.parse(readFileSync('src/locales/ru.json', 'utf8'))

    expect(en.pinned_sources).toBe('Pinned')
    expect(en.unpinned_sources).toBe('Unpinned')
    expect(en.all).toBe('All')

    expect(ru.pinned_sources).toBe('Закреплено')
    expect(ru.unpinned_sources).toBe('Не закреплено')
    expect(ru.all).toBe('Все')
  })
})
