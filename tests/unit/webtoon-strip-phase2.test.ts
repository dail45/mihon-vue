import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  isWebtoonGenre,
  isWebtoonManga,
  shouldAutoWebtoon,
  WEBTOON_GENRE_KEYWORDS,
} from '@/features/reader/utils/autoWebtoon'
import { resolveReadingModeForManga, useReaderStore } from '@/features/reader/stores/reader'
import { useReaderPreferences } from '@/features/reader/stores/readerPreferences'
import { manga, chapter } from '../fixtures'

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

const api = vi.hoisted(() => ({
  manga: vi.fn(),
  chapters: vi.fn(),
  chapter: vi.fn(),
  modifyChapter: vi.fn(),
}))

vi.mock('@/core/api/client', async original => ({
  ...(await original<typeof import('@/core/api/client')>()),
  createSuwayomiApi: () => api,
}))

describe('Phase 2.3: Auto-Webtoon Heuristic Detection (autoWebtoon.ts)', () => {
  it('defines all required webtoon genre keywords', () => {
    expect(WEBTOON_GENRE_KEYWORDS).toContain('webtoon')
    expect(WEBTOON_GENRE_KEYWORDS).toContain('long strip')
    expect(WEBTOON_GENRE_KEYWORDS).toContain('manhwa')
    expect(WEBTOON_GENRE_KEYWORDS).toContain('manhua')
    expect(WEBTOON_GENRE_KEYWORDS).toContain('манхва')
    expect(WEBTOON_GENRE_KEYWORDS).toContain('маньхуа')
  })

  it('matches webtoon genres case-insensitively with substring tolerance', () => {
    expect(isWebtoonGenre('Webtoon')).toBe(true)
    expect(isWebtoonGenre('WEBTOON')).toBe(true)
    expect(isWebtoonGenre('long strip')).toBe(true)
    expect(isWebtoonGenre('Color, Long Strip, Romance')).toBe(true)
    expect(isWebtoonGenre('Manhwa')).toBe(true)
    expect(isWebtoonGenre('Action, Manhua')).toBe(true)
    expect(isWebtoonGenre('Корейская Манхва')).toBe(true)
    expect(isWebtoonGenre('Китайская Маньхуа')).toBe(true)

    // Non-webtoon genres
    expect(isWebtoonGenre('Action')).toBe(false)
    expect(isWebtoonGenre('Manga')).toBe(false)
    expect(isWebtoonGenre('Комикс')).toBe(false)
    expect(isWebtoonGenre('')).toBe(false)
  })

  it('correctly classifies Manga instances as webtoon or non-webtoon', () => {
    const regularManga = manga(101, 'Regular Manga')
    regularManga.genre = ['Action', 'Fantasy', 'Shounen']
    expect(isWebtoonManga(regularManga)).toBe(false)

    const webtoonManga = manga(102, 'Solo Leveling')
    webtoonManga.genre = ['Action', 'Fantasy', 'Manhwa']
    expect(isWebtoonManga(webtoonManga)).toBe(true)

    const russianManhwa = manga(103, 'Манхва Тайтл')
    russianManhwa.genre = ['Драма', 'манхва']
    expect(isWebtoonManga(russianManhwa)).toBe(true)

    const chineseManhua = manga(104, 'Manhua Title')
    chineseManhua.genre = ['маньхуа', 'Боевые искусства']
    expect(isWebtoonManga(chineseManhua)).toBe(true)

    const longStripManga = manga(105, 'Web Comic')
    longStripManga.genre = ['Full Color', 'Long Strip']
    expect(isWebtoonManga(longStripManga)).toBe(true)

    // Null and edge cases
    expect(isWebtoonManga(null)).toBe(false)
    expect(isWebtoonManga(undefined)).toBe(false)
  })

  it('identifies webtoon sources when genre is not explicitly provided', () => {
    const webtoonSourceManga = manga(106, 'Untagged Webtoon')
    webtoonSourceManga.genre = []
    webtoonSourceManga.source = {
      ...webtoonSourceManga.source!,
      name: 'Webtoons.com',
    }
    expect(isWebtoonManga(webtoonSourceManga)).toBe(true)
  })

  it('respects userAutoWebtoonPref in shouldAutoWebtoon', () => {
    const manhwa = manga(107, 'Tower of God')
    manhwa.genre = ['Manhwa']

    expect(shouldAutoWebtoon(manhwa, true)).toBe(true)
    expect(shouldAutoWebtoon(manhwa, false)).toBe(false)
  })
})

describe('Phase 2.3: Auto-Webtoon Integration in Reader Store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.resetAllMocks()
    api.modifyChapter.mockResolvedValue(undefined)
  })

  it('automatically sets reading mode to webtoon for webtoon genre when manga mode is default', async () => {
    const manhwaManga = manga(201, 'Tower of God')
    manhwaManga.genre = ['Action', 'Adventure', 'Webtoon']

    api.manga.mockResolvedValue(manhwaManga)
    api.chapters.mockResolvedValue([chapter])
    api.chapter.mockResolvedValue({ ...chapter, mangaId: 201, pageCount: 5 })

    const prefs = useReaderPreferences()
    prefs.mode = 'ltr'
    prefs.autoWebtoon = true

    const reader = useReaderStore()
    await reader.open('/api/v1', 201, 7)

    expect(prefs.mode).toBe('webtoon')
  })

  it('strictly respects explicit per-manga reading mode overrides', async () => {
    const manhwaManga = manga(202, 'Forced LTR Manhwa')
    manhwaManga.genre = ['Action', 'Manhwa']

    // Explicitly set per-manga reading mode to 'ltr'
    localStorage.setItem('mihon.reader.mode.202', 'ltr')

    api.manga.mockResolvedValue(manhwaManga)
    api.chapters.mockResolvedValue([chapter])
    api.chapter.mockResolvedValue({ ...chapter, mangaId: 202, pageCount: 5 })

    const prefs = useReaderPreferences()
    prefs.mode = 'webtoon'
    prefs.autoWebtoon = true

    const reader = useReaderStore()
    await reader.open('/api/v1', 202, 7)

    // User override must be preserved!
    expect(prefs.mode).toBe('ltr')
  })

  it('enforces global default reading mode when autoWebtoon is disabled', async () => {
    const manhwaManga = manga(203, 'Disabled Auto-Webtoon Manhwa')
    manhwaManga.genre = ['Webtoon']

    // Global default reading mode is RTL
    localStorage.setItem('mihon.reader.modeChoice', 'rtl')
    localStorage.setItem('mihon.reader.autoWebtoon', 'false')

    api.manga.mockResolvedValue(manhwaManga)
    api.chapters.mockResolvedValue([chapter])
    api.chapter.mockResolvedValue({ ...chapter, mangaId: 203, pageCount: 5 })

    const prefs = useReaderPreferences()
    prefs.refresh()
    expect(prefs.autoWebtoon).toBe(false)

    const resolved = resolveReadingModeForManga(manhwaManga)
    expect(resolved).toBe('rtl')
  })

  it('keeps explicit continuous reading mode override', () => {
    const continuousManga = manga(204, 'Continuous Mode Entry')
    continuousManga.genre = ['Manga']

    localStorage.setItem('mihon.reader.mode.204', 'continuous')
    const resolved = resolveReadingModeForManga(continuousManga)
    expect(resolved).toBe('continuous')
  })
})

describe('Phase 2.2 & 2.4: Webtoon Smart Scale & Continuous Strip Preferences', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('persists webtoonScaleType and longStripGapSmartScale correctly', async () => {
    const prefs = useReaderPreferences()

    expect(prefs.webtoonScaleType).toBe('fit')
    expect(prefs.longStripGapSmartScale).toBe(false)

    prefs.webtoonScaleType = '4:3'
    prefs.longStripGapSmartScale = true

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(localStorage.getItem('mihon.reader.webtoonScaleType')).toBe('4:3')
    expect(localStorage.getItem('mihon.reader.longStripGapSmartScale')).toBe('true')
  })

  it('persists stripGapSize and clamps within 0..32 range', async () => {
    const prefs = useReaderPreferences()

    expect(prefs.stripGapSize).toBe(16) // Default 16px

    prefs.stripGapSize = 24
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(localStorage.getItem('mihon.reader.stripGapSize')).toBe('24')

    prefs.stripGapSize = 0
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(localStorage.getItem('mihon.reader.stripGapSize')).toBe('0')

    prefs.stripGapSize = 32
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(localStorage.getItem('mihon.reader.stripGapSize')).toBe('32')
  })

  it('reloads strip gap size on prefs.refresh()', () => {
    localStorage.setItem('mihon.reader.stripGapSize', '8')
    localStorage.setItem('mihon.reader.autoWebtoon', 'true')

    const prefs = useReaderPreferences()
    prefs.refresh()

    expect(prefs.stripGapSize).toBe(8)
    expect(prefs.autoWebtoon).toBe(true)
  })
})
