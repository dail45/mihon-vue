import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { defaultFilters, defaultSort, librarySortOptions, type LibraryFilters, type LibrarySort, type LibrarySortType } from '../utils/library'
export type DisplayMode = 'compact' | 'comfortable' | 'covers' | 'list'
export type ThemeMode = 'system' | 'light' | 'dark'
// Only harmless UI preferences are stored; no manga database or credentials.
export function readPreference(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
export function writePreference(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* private mode: session-only preference */ }
}
export const usePreferencesStore = defineStore('preferences', () => {
  const savedTheme = readPreference('mihon.theme')
  const themeMode = ref<ThemeMode>(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : 'system')
  watch(themeMode, value => writePreference('mihon.theme', value))
  const savedDisplay = readPreference('mihon.library.display')
  const libraryDisplay = ref<DisplayMode>(['comfortable', 'covers', 'list'].includes(savedDisplay || '') ? savedDisplay as DisplayMode : 'compact')
  const savedCatalogueDisplay = readPreference('mihon.catalogue.display')
  const catalogueDisplay = ref<DisplayMode>(['comfortable', 'covers', 'list'].includes(savedCatalogueDisplay || '') ? savedCatalogueDisplay as DisplayMode : 'compact')
  watch(catalogueDisplay, v => writePreference('mihon.catalogue.display', v))
  const downloadedOnly = ref(readPreference('mihon.library.downloadedOnly') === 'true')
  function bool(key: string, fallback: boolean) {
    const stored = readPreference(key), value = ref(stored === null ? fallback : stored === 'true')
    watch(value, v => writePreference(key, String(v))); return value
  }
  function columns(key: string) {
    const raw = Number(readPreference(key)), value = ref(Number.isInteger(raw) && raw >= 0 && raw <= 10 ? raw : 0)
    watch(value, v => writePreference(key, String(v))); return value
  }
  function json(key: string): unknown { try { return JSON.parse(readPreference(key) || 'null') } catch { return null } }
  const oldBadges = readPreference('mihon.library.badges')
  const downloadBadge = bool('mihon.library.downloadBadge', oldBadges === 'true')
  const unreadBadge = bool('mihon.library.unreadBadge', oldBadges !== 'false')
  const localBadge = bool('mihon.library.localBadge', true), languageBadge = bool('mihon.library.languageBadge', false)
  const showContinue = bool('mihon.library.continue', false)
  const categoryTabs = bool('mihon.library.tabs', true), categoryCounts = bool('mihon.library.counts', false)
  const portraitColumns = columns('mihon.library.columns.portrait'), landscapeColumns = columns('mihon.library.columns.landscape')
  const categorizedSort = bool('mihon.library.categorizedSort', false)
  const filters = ref<LibraryFilters>(defaultFilters()), rawFilters = json('mihon.library.filters')
  if (rawFilters && typeof rawFilters === 'object') for (const key of Object.keys(filters.value) as (keyof LibraryFilters)[]) {
    const v = (rawFilters as Record<string, unknown>)[key]
    if (v === 'all' || v === 'include' || v === 'exclude') filters.value[key] = v
  }
  function validSort(raw: unknown): LibrarySort {
    if (!raw || typeof raw !== 'object') return defaultSort()
    const r = raw as Record<string, unknown>
    return { type: librarySortOptions.some(o => o.value === r.type) ? r.type as LibrarySortType : 'title', descending: r.descending === true, seed: typeof r.seed === 'number' && Number.isFinite(r.seed) ? r.seed : 0 }
  }
  const globalSort = ref(validSort(json('mihon.library.sort'))), categorySorts = ref<Record<string, LibrarySort>>({})
  const rawSorts = json('mihon.library.categorySorts')
  if (rawSorts && typeof rawSorts === 'object') for (const [key, value] of Object.entries(rawSorts)) categorySorts.value[key] = validSort(value)
  function getLibrarySort(apiUrl: string, categoryId: number | null) { return categorizedSort.value ? categorySorts.value[`${apiUrl}::${categoryId}`] || globalSort.value : globalSort.value }
  function chooseLibrarySort(apiUrl: string, categoryId: number | null, type: LibrarySortType) {
    const old = getLibrarySort(apiUrl, categoryId)
    const next: LibrarySort = { type, descending: type === 'random' ? false : old.type === type ? !old.descending : old.descending, seed: type === 'random' ? Math.floor(Math.random() * 0x7fffffff) : old.seed }
    if (categorizedSort.value) categorySorts.value[`${apiUrl}::${categoryId}`] = next
    else { globalSort.value = next; categorySorts.value = {} }
  }
  watch(filters, v => writePreference('mihon.library.filters', JSON.stringify(v)), { deep: true })
  watch(globalSort, v => writePreference('mihon.library.sort', JSON.stringify(v)), { deep: true })
  watch(categorySorts, v => writePreference('mihon.library.categorySorts', JSON.stringify(v)), { deep: true })
  watch(libraryDisplay, v => writePreference('mihon.library.display', v))
  watch(downloadedOnly, v => writePreference('mihon.library.downloadedOnly', String(v)))
  return { themeMode, libraryDisplay, catalogueDisplay, downloadedOnly, downloadBadge, unreadBadge, localBadge, languageBadge, showContinue, categoryTabs, categoryCounts, portraitColumns, landscapeColumns, categorizedSort, filters, globalSort, categorySorts, getLibrarySort, chooseLibrarySort }
})
