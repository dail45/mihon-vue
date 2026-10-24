import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import { defaultFilters, matchesLibrary } from '../../src/core/utils/library'
import { usePreferencesStore } from '../../src/features/settings/stores/preferences'
import type { Manga } from '../../src/core/api/types'

const triStateDialogSource = readFileSync('src/core/components/TriStateListDialog.vue', 'utf8')
const categoryListItemSource = readFileSync('src/features/library/components/CategoryListItem.vue', 'utf8')
const settingsLibrarySource = readFileSync('src/features/settings/views/SettingsLibraryView.vue', 'utf8')
const librarySettingsSheetSource = readFileSync('src/features/library/components/LibrarySettingsSheet.vue', 'utf8')
const libraryViewSource = readFileSync('src/features/library/views/LibraryView.vue', 'utf8')
const enLocale = JSON.parse(readFileSync('src/locales/en.json', 'utf8'))
const ruLocale = JSON.parse(readFileSync('src/locales/ru.json', 'utf8'))

function makeManga(id: number, categories?: number[]): Manga {
  return {
    id,
    sourceId: '1',
    url: `/manga/${id}`,
    title: `Manga ${id}`,
    thumbnailUrl: null,
    thumbnailUrlLastFetched: 0,
    initialized: true,
    artist: null,
    author: null,
    description: null,
    genre: [],
    status: 'ONGOING',
    inLibrary: true,
    inLibraryAt: 1000,
    source: null,
    realUrl: null,
    lastFetchedAt: null,
    chaptersLastFetchedAt: null,
    updateStrategy: 'ALWAYS_UPDATE',
    freshData: true,
    unreadCount: 5,
    downloadCount: 0,
    chapterCount: 10,
    lastReadAt: null,
    lastChapterRead: null,
    age: null,
    chaptersAge: null,
    trackers: null,
    lastModifiedAt: 1000,
    version: 1,
    categories,
  }
}

describe('Worker 3B: Categories & Filters (Phases 3.3, 3.4, 3.5)', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    })
    setActivePinia(createPinia())
  })

  describe('3.3 Hidden Categories Feature', () => {
    it('CategoryListItem renders eye visibility button and supports is-hidden styling', () => {
      expect(categoryListItemSource).toContain('category-list-item__action--hide')
      expect(categoryListItemSource).toContain("isHidden ? 'visibility' : 'visibility_off'")
      expect(categoryListItemSource).toContain('@click.stop="emit(\'hide\')"')
      expect(categoryListItemSource).toContain('opacity: 0.6;')
      expect(categoryListItemSource).toContain('text-decoration: line-through;')
      expect(categoryListItemSource).toContain(":class=\"{ 'is-dragging': props.dragging, 'is-hidden': isHidden }\"")
    })

    it('Preferences store manages hiddenCategories and showHiddenCategories', () => {
      const prefs = usePreferencesStore()
      expect(prefs.hiddenCategories).toEqual([])
      expect(prefs.showHiddenCategories).toBe(false)

      prefs.toggleHiddenCategory(5)
      expect(prefs.hiddenCategories).toEqual([5])
      prefs.toggleHiddenCategory(10)
      expect(prefs.hiddenCategories).toEqual([5, 10])
      prefs.toggleHiddenCategory(5)
      expect(prefs.hiddenCategories).toEqual([10])

      prefs.showHiddenCategories = true
      expect(prefs.showHiddenCategories).toBe(true)
    })

    it('LibrarySettingsSheet contains Show hidden categories switch', () => {
      expect(librarySettingsSheetSource).toContain('Show hidden categories')
      expect(librarySettingsSheetSource).toContain('v-model="prefs.showHiddenCategories"')
    })

    it('LibraryView filters out hidden categories unless showHiddenCategories is true', () => {
      expect(libraryViewSource).toContain('!preferences.showHiddenCategories')
      expect(libraryViewSource).toContain('preferences.hiddenCategories.includes(category.id)')
    })
  })

  describe('3.4 Empty Categories During Search Preference', () => {
    it('Preferences store manages showEmptyCategoriesSearch', () => {
      const prefs = usePreferencesStore()
      expect(prefs.showEmptyCategoriesSearch).toBe(false)

      prefs.showEmptyCategoriesSearch = true
      expect(prefs.showEmptyCategoriesSearch).toBe(true)
    })

    it('SettingsLibraryView includes Show empty categories during search switch/checkbox', () => {
      expect(settingsLibrarySource).toContain('Show empty categories during search')
      expect(settingsLibrarySource).toContain('preferences.showEmptyCategoriesSearch')
    })

    it('LibraryView retains empty categories during search if showEmptyCategoriesSearch is true', () => {
      expect(libraryViewSource).toContain('search.value.trim().length > 0 && !preferences.showEmptyCategoriesSearch')
    })
  })

  describe('3.5 Categories Tri-State Filter Dialog', () => {
    it('TriStateListDialog component exists and conforms to specifications', () => {
      expect(triStateDialogSource).toContain('TriStateListDialog')
      expect(triStateDialogSource).toContain("current === 'unchecked' ? 'checked' : current === 'checked' ? 'inversed' : 'unchecked'")
      expect(triStateDialogSource).toContain("if (state === 'checked') return 'check_box'")
      expect(triStateDialogSource).toContain("if (state === 'inversed') return 'disabled_by_default'")
      expect(triStateDialogSource).toContain("return 'check_box_outline_blank'")
      expect(triStateDialogSource).toContain('emit(\'value-changed\', included, excluded)')
    })

    it('Preferences store provides filterCategories, filterCategoriesInclude, and filterCategoriesExclude', () => {
      const prefs = usePreferencesStore()
      expect(prefs.filterCategories).toBe(false)
      expect(prefs.filterCategoriesInclude).toEqual([])
      expect(prefs.filterCategoriesExclude).toEqual([])

      prefs.filterCategories = true
      prefs.filterCategoriesInclude = [1, 2]
      prefs.filterCategoriesExclude = [3]
      expect(prefs.filterCategories).toBe(true)
      expect(prefs.filterCategoriesInclude).toEqual([1, 2])
      expect(prefs.filterCategoriesExclude).toEqual([3])
    })

    it('LibrarySettingsSheet renders Categories filter row with Edit button', () => {
      expect(librarySettingsSheetSource).toContain('categories-filter-row')
      expect(librarySettingsSheetSource).toContain('v-model="prefs.filterCategories"')
      expect(librarySettingsSheetSource).toContain('categoriesDialogOpen = true')
      expect(librarySettingsSheetSource).toContain('<TriStateListDialog')
    })

    it('matchesLibrary evaluates filterCategoriesInclude and filterCategoriesExclude properly', () => {
      const baseFilters = defaultFilters()
      const mangaA = makeManga(1, [10, 20])
      const mangaB = makeManga(2, [30])
      const mangaC = makeManga(3, [])

      // Filter disabled: all match
      expect(matchesLibrary(mangaA, { ...baseFilters, filterCategories: false }, false)).toBe(true)
      expect(matchesLibrary(mangaB, { ...baseFilters, filterCategories: false }, false)).toBe(true)
      expect(matchesLibrary(mangaC, { ...baseFilters, filterCategories: false }, false)).toBe(true)

      // Exclude category 20: mangaA has 20 so it fails
      expect(matchesLibrary(mangaA, {
        ...baseFilters,
        filterCategories: true,
        filterCategoriesExclude: [20],
      }, false)).toBe(false)
      expect(matchesLibrary(mangaB, {
        ...baseFilters,
        filterCategories: true,
        filterCategoriesExclude: [20],
      }, false)).toBe(true)

      // Include category 30: mangaB matches, mangaA fails
      expect(matchesLibrary(mangaA, {
        ...baseFilters,
        filterCategories: true,
        filterCategoriesInclude: [30],
      }, false)).toBe(false)
      expect(matchesLibrary(mangaB, {
        ...baseFilters,
        filterCategories: true,
        filterCategoriesInclude: [30],
      }, false)).toBe(true)

      // Manga with empty categories fails when included categories are required
      expect(matchesLibrary(mangaC, {
        ...baseFilters,
        filterCategories: true,
        filterCategoriesInclude: [10],
      }, false)).toBe(false)
    })
  })

  describe('Localization', () => {
    it('has English and Russian translations for all new strings', () => {
      const keys = [
        'action_hide',
        'action_unhide',
        'action_show_hidden_categories',
        'pref_show_empty_categories_search',
        'pref_library_filter_categories_details',
      ]
      for (const k of keys) {
        expect(enLocale[k], `Missing English string for ${k}`).toBeTruthy()
        expect(ruLocale[k], `Missing Russian string for ${k}`).toBeTruthy()
      }
    })
  })
})
