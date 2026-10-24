import { describe, expect, it, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
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

import { useAppearanceStore } from '@/features/settings/stores/appearancePreferences'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import { BulkDuplicateQueueRunner, findDuplicateManga } from '@/core/utils/duplicates'
import type { Manga } from '@/core/api/types'

describe('Phase 5C - Tags, Panorama, Duplicates & Tracking', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  describe('5.3 Namespaced Color Tags (NamespaceTags.vue)', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/manga/components/NamespaceTags.vue'), 'utf8')

    it('parses namespace:value format correctly and groups by namespace', () => {
      expect(source).toContain('const KNOWN_NAMESPACES = new Set')
      expect(source).toContain("'artist'")
      expect(source).toContain("'character'")
      expect(source).toContain("'female'")
      expect(source).toContain("'male'")
      expect(source).toContain("'group'")
      expect(source).toContain("'parody'")

      // Tag splitting on colon
      expect(source).toContain("const idx = trimmed.indexOf(':')")
      expect(source).toContain('trimmed.substring(0, idx)')
      expect(source).toContain('trimmed.substring(idx + 1)')
    })

    it('applies MD3 tonal container colors across light, dark, and AMOLED modes', () => {
      // Primary for artist
      expect(source).toContain('var(--v-theme-primary-container)')
      expect(source).toContain('var(--v-theme-on-primary-container)')

      // Secondary for character
      expect(source).toContain('var(--v-theme-secondary-container)')
      expect(source).toContain('var(--v-theme-on-secondary-container)')

      // Tertiary for group
      expect(source).toContain('var(--v-theme-tertiary-container)')
      expect(source).toContain('var(--v-theme-on-tertiary-container)')

      // Error for parody
      expect(source).toContain('var(--v-theme-error-container)')
      expect(source).toContain('var(--v-theme-on-error-container)')

      // Pastel pink for female
      expect(source).toContain('#ffd8e4')
      expect(source).toContain('#3b0722')
      expect(source).toContain('#5c1138')

      // Teal for male
      expect(source).toContain('#cce8e8')
      expect(source).toContain('#051f20')
      expect(source).toContain('#004f4f')
      expect(source).toContain('#a6eeea')

      // AMOLED pure black mode contrast
      expect(source).toContain("[data-amoled='true']")
      expect(source).toContain('.v-theme--black')
    })

    it('implements click to search and long-press / contextmenu to copy', () => {
      expect(source).toContain("emit('search'")
      expect(source).toContain("emit('copy'")
      expect(source).toContain('createTagPressHandler')
      expect(source).toContain('onContextMenu')
      expect(source).toContain('copyToClipboard')
    })
  })

  describe('5.4 Panorama Cover Card & Top Alignment', () => {
    it('persists usePanoramaCover and topAlignCover in appearancePreferences store', () => {
      const appearance = useAppearanceStore()
      expect(appearance.usePanoramaCover).toBe(true) // default true
      expect(appearance.topAlignCover).toBe(false) // default false

      appearance.usePanoramaCover = false
      expect(localStorage.getItem('mihon.ui.usePanoramaCover')).toBe('false')

      appearance.topAlignCover = true
      expect(localStorage.getItem('mihon.ui.topAlignCover')).toBe('true')
    })

    it('contains Manga info group and switches in SettingsAppearanceView.vue', () => {
      const source = readFileSync(resolve(process.cwd(), 'src/features/settings/views/SettingsAppearanceView.vue'), 'utf8')
      expect(source).toContain('pref_category_manga_info')
      expect(source).toContain('usePanoramaCover')
      expect(source).toContain('topAlignCover')
      expect(source).toContain('pref_use_panorama_cover')
      expect(source).toContain('pref_top_align_cover')
    })

    it('applies panorama 16:9 ratio and top-align rules in MangaInfoHeader.vue', () => {
      const source = readFileSync(resolve(process.cwd(), 'src/features/manga/components/MangaInfoHeader.vue'), 'utf8')
      expect(source).toContain('manga-info-cover--panorama')
      expect(source).toContain('manga-info-titles--top-align')
      expect(source).toContain('isPanoramaCover')
      expect(source).toContain('isTopAlignCover')
      expect(source).toContain('coverNaturalRatio.value <= 0.75')
    })
  })

  describe('5.5 Bulk Duplicate Manga Resolution', () => {
    const dummyManga1: Manga = {
      id: 101,
      sourceId: '1',
      title: 'One Punch Man',
      inLibrary: false,
      favorite: false,
    } as Manga

    const dummyManga2: Manga = {
      id: 102,
      sourceId: '2',
      title: 'One Punch Man (Official)',
      inLibrary: false,
      favorite: false,
    } as Manga

    const dummyManga3: Manga = {
      id: 103,
      sourceId: '1',
      title: 'Mob Psycho 100',
      inLibrary: false,
      favorite: false,
    } as Manga

    const library: Manga[] = [
      {
        id: 201,
        sourceId: '3',
        title: 'One Punch Man',
        inLibrary: true,
        favorite: true,
      } as Manga,
    ]

    it('finds duplicates by title containment', () => {
      const dupes = findDuplicateManga(dummyManga1, library)
      expect(dupes.length).toBe(1)
      expect(dupes[0].manga.id).toBe(201)
    })

    it('BulkDuplicateQueueRunner manages prompt, allow_all, and skip_all modes', () => {
      const runner = new BulkDuplicateQueueRunner([dummyManga1, dummyManga2, dummyManga3], library)

      // First item has duplicate
      expect(runner.next()).toBe(true)
      expect(runner.currentItem?.id).toBe(101)
      expect(runner.currentDuplicates.length).toBe(1)

      // User chooses 'allow_all'
      runner.allowAll()
      expect(runner.currentMode).toBe('allow_all')

      // Next item also has duplicate, but since mode is 'allow_all', next() automatically adds it and proceeds to item 3 (no duplicate)
      expect(runner.next()).toBe(false)
      expect(runner.isDone).toBe(true)

      // All 3 items resolved
      expect(runner.resolvedItems.map(m => m.id)).toEqual([101, 102, 103])
      expect(runner.skippedItems.length).toBe(0)
    })

    it('BulkDuplicateQueueRunner skips all duplicates when mode is skip_all', () => {
      const runner = new BulkDuplicateQueueRunner([dummyManga1, dummyManga2, dummyManga3], library)

      expect(runner.next()).toBe(true)
      expect(runner.currentItem?.id).toBe(101)

      // User chooses 'skip_all'
      runner.skipAll()
      expect(runner.currentMode).toBe('skip_all')

      // Runner should finish, skipping 101 and 102, resolving only 103
      expect(runner.next()).toBe(false)
      expect(runner.resolvedItems.map(m => m.id)).toEqual([103])
      expect(runner.skippedItems.map(m => m.id)).toEqual([101, 102])
    })

    it('DuplicateMangaDialog.vue has bulk mode buttons and emits', () => {
      const source = readFileSync(resolve(process.cwd(), 'src/features/library/components/DuplicateMangaDialog.vue'), 'utf8')
      expect(source).toContain('duplicate-bulk-container')
      expect(source).toContain('duplicate-bulk-grid')
      expect(source).toContain("emit('allow-all')")
      expect(source).toContain("emit('skip')")
      expect(source).toContain("emit('skip-all')")
      expect(source).toContain("action_allow_all_duplicate_manga")
      expect(source).toContain("action_skip_duplicate_manga")
      expect(source).toContain("action_skip_all_duplicate_manga")
    })
  })

  describe('5.6 Tracker Auto-Sync & Prompt on Add', () => {
    it('persists tracking preferences in preferences store', () => {
      const prefs = usePreferencesStore()
      expect(prefs.autoSyncProgressFromTrackers).toBe(true)
      expect(prefs.trackOnAddingToLibrary).toBe(true)

      prefs.autoSyncProgressFromTrackers = false
      expect(localStorage.getItem('pref_auto_sync_progress_from_trackers_key')).toBe('false')

      prefs.trackOnAddingToLibrary = false
      expect(localStorage.getItem('track_on_adding_to_library')).toBe('false')
    })

    it('renders switches in SettingsTrackingView.vue', () => {
      const source = readFileSync(resolve(process.cwd(), 'src/features/settings/views/SettingsTrackingView.vue'), 'utf8')
      expect(source).toContain('trackOnAddingToLibrary')
      expect(source).toContain('autoSyncProgressFromTrackers')
      expect(source).toContain('pref_track_on_add_library')
      expect(source).toContain('pref_auto_sync_progress_from_trackers')
    })

    it('wires auto-sync and prompt on add in MangaView.vue', () => {
      const source = readFileSync(resolve(process.cwd(), 'src/features/manga/views/MangaView.vue'), 'utf8')
      expect(source).toContain('preferences.autoSyncProgressFromTrackers')
      expect(source).toContain('fetchMangaTrackRecords')
      expect(source).toContain('updateChaptersBatch')
      expect(source).toContain('sync_progress_from_trackers_up_to_chapter')
      expect(source).toContain('preferences.trackOnAddingToLibrary')
      expect(source).toContain('listTrackers')
    })
  })
})
