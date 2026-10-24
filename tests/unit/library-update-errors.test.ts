import { describe, expect, it, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { useLibraryUpdateErrorsStore } from '@/features/updates/stores/libraryUpdateErrors'

const storageMap = new Map<string, string>()
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => { storageMap.set(key, String(value)) },
  removeItem: (key: string) => { storageMap.delete(key) },
  clear: () => { storageMap.clear() },
}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = mockLocalStorage as any
}

describe('3.8 Library Update Progress Banner & Update Errors Screen', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    globalThis.localStorage.clear()
  })

  it('initializes store with empty errors and reacts to mutations', () => {
    const store = useLibraryUpdateErrorsStore()
    expect(store.errors).toEqual([])
    expect(store.errorCount).toBe(0)
    expect(store.updating).toBe(false)
    expect(store.progress).toBeNull()

    store.addError({
      mangaId: 101,
      title: 'Solo Leveling',
      sourceId: '1',
      sourceName: 'Asura Scans',
      message: 'Network 404',
    })

    expect(store.errorCount).toBe(1)
    expect(store.errors[0]?.title).toBe('Solo Leveling')
    expect(store.errors[0]?.message).toBe('Network 404')

    // Persisted to localStorage
    const saved = JSON.parse(globalThis.localStorage.getItem('mihon.library.updateErrors') || '[]')
    expect(saved.length).toBe(1)
    expect(saved[0].mangaId).toBe(101)

    // Clear errors
    store.clearErrors()
    expect(store.errorCount).toBe(0)
    expect(JSON.parse(globalThis.localStorage.getItem('mihon.library.updateErrors') || '[]')).toEqual([])
  })

  it('updates library updating state and progress', () => {
    const store = useLibraryUpdateErrorsStore()
    store.setUpdating(true, 25)
    expect(store.updating).toBe(true)
    expect(store.progress).toBe(25)

    store.updateProgress(75)
    expect(store.progress).toBe(75)

    store.setUpdating(false, null)
    expect(store.updating).toBe(false)
    expect(store.progress).toBeNull()
  })

  it('AppStateBanners renders updating banner and circular progress spinner', () => {
    const source = readFileSync('src/core/components/AppStateBanners.vue', 'utf8')
    expect(source).toContain('banner--updating')
    expect(source).toContain('notification_updating_progress')
    expect(source).toContain('updating_library')
    expect(source).toContain('banner__spinner')
    expect(source).toContain('useLibraryUpdateErrorsStore')
  })

  it('MoreView registers Library update errors widget with red badge', () => {
    const source = readFileSync('src/features/settings/views/MoreView.vue', 'utf8')
    expect(source).toContain('title="Library update errors"')
    expect(source).toContain('icon="new_releases"')
    expect(source).toContain('badge-color="error"')
    expect(source).toContain("router.push('/updates/errors')")
  })

  it('Router registers /updates/errors route', () => {
    const source = readFileSync('src/router/index.ts', 'utf8')
    expect(source).toContain("path: '/updates/errors'")
    expect(source).toContain('LibraryUpdateErrorView.vue')
  })

  it('LibraryUpdateErrorView implements error review, groups, retry, clear, and migration handoff', () => {
    const source = readFileSync('src/features/updates/views/LibraryUpdateErrorView.vue', 'utf8')
    expect(source).toContain('error-group-header')
    expect(source).toContain('error-group-badge')
    expect(source).toContain('retrySingle')
    expect(source).toContain('handleRetryAll')
    expect(source).toContain('handoffMultiMigrate')
    expect(source).toContain('vertical_align_top')
    expect(source).toContain('find_replace')
    expect(source).toContain('delete_sweep')
  })
})
