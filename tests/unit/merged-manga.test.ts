import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size },
  } as any
}

import {
  useMergedMangaStore,
  deduplicateMergedChapters,
  type MergedMangaGroup,
  type MergedSourceReference,
  type MergedChapterItem,
} from '@/features/manga/stores/mergedManga'

describe('5.2 Client-Side Merged Manga & Chapter Deduplication', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  describe('deduplicateMergedChapters', () => {
    const group: MergedMangaGroup = {
      id: 'merge-1',
      primaryMangaId: 1,
      chapterSortMode: 'priority',
      createdAt: Date.now(),
      references: [
        {
          mangaId: 1,
          sourceId: 'src-1',
          sourceName: 'MangaDex',
          title: 'Primary Title',
          coverUrl: '',
          chapterPriority: 0,
          isInfoManga: true,
          getChapterUpdates: true,
          downloadChapters: true,
        },
        {
          mangaId: 2,
          sourceId: 'src-2',
          sourceName: 'MangaSee',
          title: 'Secondary Title',
          coverUrl: '',
          chapterPriority: 1,
          isInfoManga: false,
          getChapterUpdates: true,
          downloadChapters: true,
        },
        {
          mangaId: 3,
          sourceId: 'src-3',
          sourceName: 'ComicExtra',
          title: 'Tertiary Title',
          coverUrl: '',
          chapterPriority: 2,
          isInfoManga: false,
          getChapterUpdates: true,
          downloadChapters: true,
        },
      ],
    }

    it('deduplicates chapters sharing identical chapterNumber floats keeping higher priority source', () => {
      const chapters: MergedChapterItem[] = [
        // Source 1 (priority 0)
        {
          id: 101,
          mangaId: 1,
          chapterNumber: 1,
          name: 'Ch 1',
          url: '/1',
          uploadDate: 1000,
          scanlator: null,
          read: false,
          bookmarked: false,
          lastPageRead: 0,
          lastReadAt: 0,
          index: 1,
          fetchedAt: 0,
          realUrl: null,
          downloaded: false,
          pageCount: 20,
          lastModifiedAt: 0,
          version: 1,
          chapterCount: 3,
          sourceName: 'MangaDex',
        },
        {
          id: 102,
          mangaId: 1,
          chapterNumber: 2.5,
          name: 'Ch 2.5 (Priority)',
          url: '/2.5',
          uploadDate: 1000,
          scanlator: null,
          read: false,
          bookmarked: false,
          lastPageRead: 0,
          lastReadAt: 0,
          index: 2,
          fetchedAt: 0,
          realUrl: null,
          downloaded: false,
          pageCount: 20,
          lastModifiedAt: 0,
          version: 1,
          chapterCount: 3,
          sourceName: 'MangaDex',
        },
        // Source 2 (priority 1) has duplicate Ch 2.5 and new Ch 3
        {
          id: 202,
          mangaId: 2,
          chapterNumber: 2.5,
          name: 'Ch 2.5 (Duplicate to drop)',
          url: '/2.5-dup',
          uploadDate: 1000,
          scanlator: null,
          read: false,
          bookmarked: false,
          lastPageRead: 0,
          lastReadAt: 0,
          index: 1,
          fetchedAt: 0,
          realUrl: null,
          downloaded: false,
          pageCount: 20,
          lastModifiedAt: 0,
          version: 1,
          chapterCount: 2,
          sourceName: 'MangaSee',
        },
        {
          id: 203,
          mangaId: 2,
          chapterNumber: 3,
          name: 'Ch 3',
          url: '/3',
          uploadDate: 1000,
          scanlator: null,
          read: false,
          bookmarked: false,
          lastPageRead: 0,
          lastReadAt: 0,
          index: 2,
          fetchedAt: 0,
          realUrl: null,
          downloaded: false,
          pageCount: 20,
          lastModifiedAt: 0,
          version: 1,
          chapterCount: 2,
          sourceName: 'MangaSee',
        },
      ]

      const deduplicated = deduplicateMergedChapters(chapters, group)
      expect(deduplicated).toHaveLength(3)

      const ch25 = deduplicated.find(c => c.chapterNumber === 2.5)
      expect(ch25).toBeDefined()
      expect(ch25?.id).toBe(102) // Kept MangaDex (priority 0)
      expect(ch25?.sourceName).toBe('MangaDex')

      const ch3 = deduplicated.find(c => c.chapterNumber === 3)
      expect(ch3).toBeDefined()
      expect(ch3?.id).toBe(203)
      expect(ch3?.sourceName).toBe('MangaSee')
    })

    it('allows multiple chapters with same number from the same source (different scanlators)', () => {
      const chapters: MergedChapterItem[] = [
        {
          id: 101,
          mangaId: 1,
          chapterNumber: 1,
          name: 'Ch 1 - Scan Group A',
          url: '/1-a',
          uploadDate: 1000,
          scanlator: 'Group A',
          read: false,
          bookmarked: false,
          lastPageRead: 0,
          lastReadAt: 0,
          index: 1,
          fetchedAt: 0,
          realUrl: null,
          downloaded: false,
          pageCount: 20,
          lastModifiedAt: 0,
          version: 1,
          chapterCount: 2,
          sourceName: 'MangaDex',
        },
        {
          id: 102,
          mangaId: 1,
          chapterNumber: 1,
          name: 'Ch 1 - Scan Group B',
          url: '/1-b',
          uploadDate: 1000,
          scanlator: 'Group B',
          read: false,
          bookmarked: false,
          lastPageRead: 0,
          lastReadAt: 0,
          index: 2,
          fetchedAt: 0,
          realUrl: null,
          downloaded: false,
          pageCount: 20,
          lastModifiedAt: 0,
          version: 1,
          chapterCount: 2,
          sourceName: 'MangaDex',
        },
      ]

      const deduplicated = deduplicateMergedChapters(chapters, group)
      expect(deduplicated).toHaveLength(2)
      expect(deduplicated.map(c => c.id)).toEqual([101, 102])
    })

    it('preserves unrecognized chapter numbers (< 0) across all sources', () => {
      const chapters: MergedChapterItem[] = [
        {
          id: 101,
          mangaId: 1,
          chapterNumber: -1,
          name: 'Special Prologue',
          url: '/sp-1',
          uploadDate: 1000,
          scanlator: null,
          read: false,
          bookmarked: false,
          lastPageRead: 0,
          lastReadAt: 0,
          index: 1,
          fetchedAt: 0,
          realUrl: null,
          downloaded: false,
          pageCount: 10,
          lastModifiedAt: 0,
          version: 1,
          chapterCount: 1,
          sourceName: 'MangaDex',
        },
        {
          id: 201,
          mangaId: 2,
          chapterNumber: -1,
          name: 'Extra Omake',
          url: '/sp-2',
          uploadDate: 1000,
          scanlator: null,
          read: false,
          bookmarked: false,
          lastPageRead: 0,
          lastReadAt: 0,
          index: 1,
          fetchedAt: 0,
          realUrl: null,
          downloaded: false,
          pageCount: 10,
          lastModifiedAt: 0,
          version: 1,
          chapterCount: 1,
          sourceName: 'MangaSee',
        },
      ]

      const deduplicated = deduplicateMergedChapters(chapters, group)
      expect(deduplicated).toHaveLength(2)
    })

    it('bypasses deduplication when chapterSortMode is chapterNumber', () => {
      const noDedupeGroup: MergedMangaGroup = {
        ...group,
        chapterSortMode: 'chapterNumber',
      }
      const chapters: MergedChapterItem[] = [
        {
          id: 101,
          mangaId: 1,
          chapterNumber: 1,
          name: 'Ch 1 - MangaDex',
          url: '/1',
          uploadDate: 1000,
          scanlator: null,
          read: false,
          bookmarked: false,
          lastPageRead: 0,
          lastReadAt: 0,
          index: 1,
          fetchedAt: 0,
          realUrl: null,
          downloaded: false,
          pageCount: 20,
          lastModifiedAt: 0,
          version: 1,
          chapterCount: 1,
        },
        {
          id: 201,
          mangaId: 2,
          chapterNumber: 1,
          name: 'Ch 1 - MangaSee',
          url: '/1-ms',
          uploadDate: 1000,
          scanlator: null,
          read: false,
          bookmarked: false,
          lastPageRead: 0,
          lastReadAt: 0,
          index: 1,
          fetchedAt: 0,
          realUrl: null,
          downloaded: false,
          pageCount: 20,
          lastModifiedAt: 0,
          version: 1,
          chapterCount: 1,
        },
      ]

      const res = deduplicateMergedChapters(chapters, noDedupeGroup)
      expect(res).toHaveLength(2)
    })
  })

  describe('useMergedMangaStore', () => {
    it('saves and loads merged groups to localStorage under mihon.merged_manga', () => {
      const store = useMergedMangaStore()
      const sampleRef: MergedSourceReference = {
        mangaId: 10,
        sourceId: 'src-1',
        sourceName: 'Source 1',
        title: 'Manga 10',
        coverUrl: '',
        chapterPriority: 0,
        isInfoManga: true,
        getChapterUpdates: true,
        downloadChapters: true,
      }
      const sampleGroup: MergedMangaGroup = {
        id: 'group-10',
        primaryMangaId: 10,
        chapterSortMode: 'priority',
        references: [sampleRef],
        createdAt: 12345678,
      }

      store.saveGroup(sampleGroup)
      expect(store.getGroup(10)).toEqual(sampleGroup)

      const raw = localStorage.getItem('mihon.merged_manga')
      expect(raw).toBeTruthy()
      expect(JSON.parse(raw!)).toHaveProperty('10')
    })

    it('finds group by secondary reference mangaId', () => {
      const store = useMergedMangaStore()
      const group: MergedMangaGroup = {
        id: 'group-20',
        primaryMangaId: 20,
        chapterSortMode: 'priority',
        createdAt: 100,
        references: [
          {
            mangaId: 20,
            sourceId: 's1',
            sourceName: 'S1',
            title: 'Manga 20',
            coverUrl: '',
            chapterPriority: 0,
            isInfoManga: true,
            getChapterUpdates: true,
            downloadChapters: true,
          },
          {
            mangaId: 25,
            sourceId: 's2',
            sourceName: 'S2',
            title: 'Manga 25',
            coverUrl: '',
            chapterPriority: 1,
            isInfoManga: false,
            getChapterUpdates: true,
            downloadChapters: true,
          },
        ],
      }
      store.saveGroup(group)

      expect(store.getGroup(25)?.primaryMangaId).toBe(20)
    })

    it('updates priority reordering, info manga, and toggles', () => {
      const store = useMergedMangaStore()
      const group: MergedMangaGroup = {
        id: 'group-30',
        primaryMangaId: 30,
        chapterSortMode: 'priority',
        createdAt: 100,
        references: [
          {
            mangaId: 30,
            sourceId: 's1',
            sourceName: 'S1',
            title: 'Manga 30',
            coverUrl: '',
            chapterPriority: 0,
            isInfoManga: true,
            getChapterUpdates: true,
            downloadChapters: true,
          },
          {
            mangaId: 31,
            sourceId: 's2',
            sourceName: 'S2',
            title: 'Manga 31',
            coverUrl: '',
            chapterPriority: 1,
            isInfoManga: false,
            getChapterUpdates: true,
            downloadChapters: false,
          },
        ],
      }
      store.saveGroup(group)

      store.setInfoManga(30, 31)
      const afterInfo = store.getGroup(30)
      expect(afterInfo?.references.find(r => r.mangaId === 31)?.isInfoManga).toBe(true)
      expect(afterInfo?.references.find(r => r.mangaId === 30)?.isInfoManga).toBe(false)

      store.toggleChapterUpdates(30, 31)
      expect(store.getGroup(30)?.references.find(r => r.mangaId === 31)?.getChapterUpdates).toBe(false)

      store.toggleDownloadChapters(30, 31)
      expect(store.getGroup(30)?.references.find(r => r.mangaId === 31)?.downloadChapters).toBe(true)

      store.setSortMode(30, 'chapterNumber')
      expect(store.getGroup(30)?.chapterSortMode).toBe('chapterNumber')

      store.deleteGroup(30)
      expect(store.getGroup(30)).toBeUndefined()
    })
  })

  describe('Component parity and contracts', () => {
    it('MangaChapterListItem.vue implements source origin chip', () => {
      const source = readFileSync(
        resolve(process.cwd(), 'src/features/manga/components/MangaChapterListItem.vue'),
        'utf8',
      )
      expect(source).toContain('sourceName?: string | null')
      expect(source).toContain('manga-chapter-item__source-chip')
      expect(source).toContain('{{ sourceName }}')
      expect(source).toContain('max-width: 140px')
    })

    it('MangaToolbar.vue implements Merge manga action', () => {
      const source = readFileSync(
        resolve(process.cwd(), 'src/features/manga/components/MangaToolbar.vue'),
        'utf8',
      )
      expect(source).toContain('title="Merge manga"')
      expect(source).toContain("emit('mergeManga')")
    })

    it('EditMergedSettingsDialog.vue implements reordering, info manga and toggles', () => {
      const source = readFileSync(
        resolve(process.cwd(), 'src/features/manga/components/EditMergedSettingsDialog.vue'),
        'utf8',
      )
      expect(source).toContain('chapterSortMode')
      expect(source).toContain('selectInfoManga')
      expect(source).toContain('moveUp')
      expect(source).toContain('moveDown')
      expect(source).toContain('toggleUpdates')
      expect(source).toContain('toggleDownloads')
      expect(source).toContain('addMangaToMerge')
      expect(source).toContain('draggable="true"')
    })

    it('MangaView.vue wires up merged manga routing and dialog', () => {
      const source = readFileSync(
        resolve(process.cwd(), 'src/features/manga/views/MangaView.vue'),
        'utf8',
      )
      expect(source).toContain('useMergedMangaStore')
      expect(source).toContain('deduplicateMergedChapters')
      expect(source).toContain('loadMergedChapters')
      expect(source).toContain(':source-name=')
      expect(source).toContain('EditMergedSettingsDialog')
      expect(source).toContain('@merge-manga="editMergedDialogOpen = true"')
    })
  })
})
