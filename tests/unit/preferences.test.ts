import { describe, expect, it, beforeEach, vi } from 'vitest'
import { readPreference, writePreference, flushPendingPreferences } from '@/features/settings/stores/preferences'

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

describe('preferences deferred writes', () => {
  beforeEach(() => {
    localStorage.clear()
    flushPendingPreferences()
  })

  it('reads pending writes immediately from memory before flush', () => {
    writePreference('test.key', 'new-value')
    expect(readPreference('test.key')).toBe('new-value')
  })

  it('writes immediately when immediate is true', () => {
    writePreference('test.immediate', 'immediate-val', true)
    expect(localStorage.getItem('test.immediate')).toBe('immediate-val')
  })

  it('flushes pending writes on flushPendingPreferences', () => {
    writePreference('deferred.1', 'val1')
    writePreference('deferred.2', 'val2')
    flushPendingPreferences()
    expect(localStorage.getItem('deferred.1')).toBe('val1')
    expect(localStorage.getItem('deferred.2')).toBe('val2')
  })

  it('schedules and flushes via requestIdleCallback when window is present', async () => {
    let idleCb: (() => void) | null = null
    const mockWindow = {
      requestIdleCallback: (cb: () => void) => {
        idleCb = cb
        return 1
      },
      addEventListener: vi.fn(),
    }
    vi.stubGlobal('window', mockWindow)

    try {
      writePreference('idle.key', 'idle-val')
      // Value is available immediately via readPreference
      expect(readPreference('idle.key')).toBe('idle-val')
      // Not yet in localStorage
      expect(localStorage.getItem('idle.key')).toBeNull()

      // When idle callback fires
      expect(idleCb).toBeTypeOf('function')
      idleCb!()

      expect(localStorage.getItem('idle.key')).toBe('idle-val')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
