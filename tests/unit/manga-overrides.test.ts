import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  useMangaOverridesStore,
  applyMangaOverride,
  STORAGE_KEY_MANGA_OVERRIDES,
} from '@/features/manga/stores/mangaOverrides'
import type { Manga } from '@/core/api/types'

const storageMap = new Map<string, string>()
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, val: string) => { storageMap.set(key, String(val)) },
  removeItem: (key: string) => { storageMap.delete(key) },
  clear: () => { storageMap.clear() },
}

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = mockLocalStorage as any
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = { localStorage: mockLocalStorage } as any
} else if (!globalThis.window.localStorage) {
  globalThis.window.localStorage = mockLocalStorage as any
}

describe('Manga Metadata Overrides (Section 5.1)', () => {
  const dummyManga = {
    id: 42,
    sourceId: '12345',
    url: '/manga/42',
    title: 'Original Title',
    artist: 'Original Artist',
    author: 'Original Author',
    description: 'Original Description',
    genre: ['Action', 'Adventure'],
    status: 'ONGOING',
    thumbnailUrl: 'https://example.com/original-cover.jpg',
    inLibrary: true,
  } as Manga

  beforeEach(() => {
    storageMap.clear()
    setActivePinia(createPinia())
  })

  it('preserves original fields under og... and applies overrides correctly', () => {
    const overridden = applyMangaOverride(dummyManga, {
      title: 'Custom Title',
      author: 'Custom Author',
      artist: 'Custom Artist',
      thumbnailUrl: 'https://example.com/custom-cover.jpg',
      description: 'Custom Synopsis',
      genre: ['Fantasy', 'Magic'],
      status: 2, // COMPLETED
      updatedAt: Date.now(),
    })

    expect(overridden.title).toBe('Custom Title')
    expect(overridden.ogTitle).toBe('Original Title')
    expect(overridden.author).toBe('Custom Author')
    expect(overridden.ogAuthor).toBe('Original Author')
    expect(overridden.artist).toBe('Custom Artist')
    expect(overridden.ogArtist).toBe('Original Artist')
    expect(overridden.thumbnailUrl).toBe('https://example.com/custom-cover.jpg')
    expect(overridden.ogThumbnailUrl).toBe('https://example.com/original-cover.jpg')
    expect(overridden.description).toBe('Custom Synopsis')
    expect(overridden.ogDescription).toBe('Original Description')
    expect(overridden.genre).toEqual(['Fantasy', 'Magic'])
    expect(overridden.ogGenre).toEqual(['Action', 'Adventure'])
    expect(overridden.status).toBe(2)
    expect(overridden.ogStatus).toBe('ONGOING')
    expect(overridden.hasCustomCover).toBe(true)
    expect(overridden.isOverridden).toBe(true)
  })

  it('returns original values when no override is present', () => {
    const result = applyMangaOverride(dummyManga, null)
    expect(result.title).toBe('Original Title')
    expect(result.ogTitle).toBe('Original Title')
    expect(result.hasCustomCover).toBe(false)
    expect(result.isOverridden).toBe(false)
  })

  it('persists and loads overrides in localStorage', () => {
    const store = useMangaOverridesStore()

    store.setOverride(42, {
      title: 'User Title',
      thumbnailUrl: 'https://example.com/cover.png',
    })

    expect(store.hasOverride(42)).toBe(true)
    expect(store.isFieldOverridden(42, 'title')).toBe(true)
    expect(store.isFieldOverridden(42, 'author')).toBe(false)

    // Verify localStorage persistence
    const raw = mockLocalStorage.getItem(STORAGE_KEY_MANGA_OVERRIDES)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed[42].title).toBe('User Title')
    expect(parsed[42].thumbnailUrl).toBe('https://example.com/cover.png')

    // Reset single field
    store.resetField(42, 'thumbnailUrl')
    expect(store.isFieldOverridden(42, 'thumbnailUrl')).toBe(false)
    expect(store.isFieldOverridden(42, 'title')).toBe(true)

    // Reset all overrides for manga
    store.resetOverride(42)
    expect(store.hasOverride(42)).toBe(false)
    expect(store.getOverride(42)).toBeUndefined()
  })

  it('applies store overrides dynamically to manga objects', () => {
    const store = useMangaOverridesStore()
    store.setOverride(dummyManga.id, {
      title: 'Dynamic Overridden Title',
    })

    const transformed = store.applyOverride(dummyManga)
    expect(transformed.title).toBe('Dynamic Overridden Title')
    expect(transformed.ogTitle).toBe('Original Title')
    expect(transformed.isOverridden).toBe(true)
  })
})
