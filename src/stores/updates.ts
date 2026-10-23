import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { apiErrorMessage, createSuwayomiApi } from '../api/client'
import type { MangaChapter } from '../api/types'
import { nextTriState, type TriState } from '../utils/library'
import { loadExcludedScanlators } from '../utils/scanlatorFilter'
import { matchesUpdatesFilters } from '../utils/updatesFilters'

/**
 * The Updates filter preferences.
 *
 * Mihon reference: `tachiyomi/domain/.../updates/service/UpdatesPreferences.kt`
 *   - pref_filter_updates_downloaded / _unread / _started / _bookmarked (TriState, default DISABLED)
 *   - pref_filter_updates_hide_excluded_scanlators (Boolean, default false)
 *   - pref_filter_updates_included_categories / _excluded_categories (List<Long>, default empty)
 * Suwayomi's REST v1 has no equivalents, so the values live in browser storage.
 */
export interface UpdatesFilters {
  downloaded: TriState
  unread: TriState
  started: TriState
  bookmarked: TriState
  excludedScanlators: boolean
  includedCategories: number[]
  excludedCategories: number[]
}

export const defaultUpdatesFilters = (): UpdatesFilters => ({
  downloaded: 'all',
  unread: 'all',
  started: 'all',
  bookmarked: 'all',
  excludedScanlators: false,
  includedCategories: [],
  excludedCategories: [],
})

const FILTERS_KEY = 'mihon.updates.filters'

function readFilters(): UpdatesFilters {
  const fallback = defaultUpdatesFilters()
  try {
    const raw = JSON.parse(localStorage.getItem(FILTERS_KEY) || 'null')
    if (!raw || typeof raw !== 'object') return fallback
    const tri = (value: unknown): TriState =>
      value === 'include' || value === 'exclude' || value === 'all' ? value : 'all'
    const ids = (value: unknown): number[] =>
      Array.isArray(value) ? value.filter(entry => typeof entry === 'number') : []
    return {
      downloaded: tri(raw.downloaded),
      unread: tri(raw.unread),
      started: tri(raw.started),
      bookmarked: tri(raw.bookmarked),
      excludedScanlators: raw.excludedScanlators === true,
      includedCategories: ids(raw.includedCategories),
      excludedCategories: ids(raw.excludedCategories),
    }
  } catch {
    return fallback
  }
}

export const useUpdatesStore = defineStore('updates', () => {
  const entries = ref<MangaChapter[]>([]), loading = ref(false), error = ref<string | null>(null)
  const page = ref(-1), hasNextPage = ref(true)
  const filters = ref<UpdatesFilters>(readFilters())
  /** `manga_category` membership per manga id — read from the Suwayomi category lists. */
  const mangaCategories = ref<Record<number, number[]>>({})
  /** Mihon's `excluded_scanlator` table — kept in browser storage by the manga screen. */
  const excludedScanlatorsByManga = ref<Record<number, string[]>>({})
  let generation = 0, address = ''
  watch(filters, value => {
    try { localStorage.setItem(FILTERS_KEY, JSON.stringify(value)) } catch { /* private mode */ }
  }, { deep: true })

  /**
   * `UpdatesViewModel.hasActiveFilters`: any tri-state filter is not DISABLED, or the excluded
   * scanlator switch is on, or one of the category lists is not empty.
   */
  const hasActiveFilters = computed(() =>
    [filters.value.downloaded, filters.value.unread, filters.value.started, filters.value.bookmarked]
      .some(state => state !== 'all')
    || filters.value.excludedScanlators
    || filters.value.includedCategories.length > 0
    || filters.value.excludedCategories.length > 0,
  )

  /**
   * The feed entries after the filter set of `UpdatesFilterDialog` was applied.
   *
   * Mihon applies the unread/started/bookmarked/excluded-scanlator/category filters in SQL
   * (`updatesView.sq`) and the downloaded filter in Kotlin (`UpdatesViewModel.applyFilters`).
   * Suwayomi's REST v1 has no filter parameters, so the same semantics are applied in the browser.
   */
  const filteredEntries = computed(() => {
    const context = {
      downloaded: filters.value.downloaded,
      unread: filters.value.unread,
      started: filters.value.started,
      bookmarked: filters.value.bookmarked,
      excludedScanlators: filters.value.excludedScanlators,
      includedCategories: filters.value.includedCategories,
      excludedCategories: filters.value.excludedCategories,
      mangaCategories: new Map(Object.entries(mangaCategories.value).map(([id, list]) => [Number(id), list])),
      excludedScanlatorsByManga: new Map(Object.entries(excludedScanlatorsByManga.value).map(([id, list]) => [Number(id), list])),
    }
    if (!hasActiveFilters.value) return entries.value
    return entries.value.filter(entry => matchesUpdatesFilters(entry, context))
  })

  /**
   * Loads the data the category and excluded-scanlator filters need.
   *
   * The category membership comes from the Suwayomi category manga lists (read-only GETs); the
   * excluded scanlator sets are the per-manga sets the manga screen stores in browser storage.
   */
  async function loadFilterContext(apiUrl: string) {
    const request = generation
    try {
      const api = createSuwayomiApi(apiUrl)
      const categories = await api.categories()
      const lists = await Promise.all(categories.map(async category => [category.id, await api.categoryManga(category.id)] as const))
      if (request !== generation) return
      const membership: Record<number, number[]> = {}
      for (const [categoryId, mangas] of lists) {
        for (const manga of mangas) {
          const known = membership[manga.id] ?? (membership[manga.id] = [])
          known.push(categoryId)
        }
      }
      mangaCategories.value = membership
    } catch {
      mangaCategories.value = {}
    }
    const excluded: Record<number, string[]> = {}
    for (const entry of entries.value) {
      if (excluded[entry.manga.id]) continue
      excluded[entry.manga.id] = loadExcludedScanlators(apiUrl, entry.manga.id)
    }
    excludedScanlatorsByManga.value = excluded
  }

  async function refresh(apiUrl: string) {
    const request = ++generation
    if (address !== apiUrl) { entries.value = []; page.value = -1; hasNextPage.value = true }
    address = apiUrl; loading.value = true; error.value = null
    try {
      const result = await createSuwayomiApi(apiUrl).recentChapters(0)
      if (request !== generation) return
      entries.value = result.page; page.value = 0; hasNextPage.value = result.hasNextPage
      void loadFilterContext(apiUrl)
    } catch (e) { if (request === generation) error.value = apiErrorMessage(e) }
    finally { if (request === generation) loading.value = false }
  }
  async function loadMore() {
    if (loading.value || !hasNextPage.value || page.value < 0) return
    const request = generation, next = page.value + 1
    loading.value = true; error.value = null
    try {
      const result = await createSuwayomiApi(address).recentChapters(next)
      if (request !== generation) return
      const seen = new Set(entries.value.map(e => `${e.manga.id}:${e.chapter.id}`))
      const unique = result.page.filter(e => { const key = `${e.manga.id}:${e.chapter.id}`; if (seen.has(key)) return false; seen.add(key); return true })
      entries.value = [...entries.value, ...unique]; page.value = next; hasNextPage.value = result.hasNextPage
    } catch (e) { if (request === generation) error.value = apiErrorMessage(e) }
    finally { if (request === generation) loading.value = false }
  }
  /**
   * Applies a local chapter state change to the feed.
   * Mihon updates the item in place after a bulk action (`UpdatesViewModel.toggleAllSelection`).
   */
  function patch(changes: { id: number; read?: boolean; bookmarked?: boolean; downloaded?: boolean }[]) {
    if (!changes.length) return
    const byId = new Map(changes.map(change => [change.id, change]))
    entries.value = entries.value.map(entry => {
      const change = byId.get(entry.chapter.id)
      if (!change) return entry
      return { ...entry, chapter: { ...entry.chapter, ...change } }
    })
  }
  function dispose() { generation++; loading.value = false }

  /* ------------------------------------------------------------------ *
   * Filter mutations (`UpdatesSettingsViewModel.toggleFilter` / `cycleCategory`)
   * ------------------------------------------------------------------ */

  /** `viewModel.toggleFilter(UpdatesPreferences::filterDownloaded)` — DISABLED -> ENABLED_IS -> ENABLED_NOT -> DISABLED. */
  function toggleFilter(key: 'downloaded' | 'unread' | 'started' | 'bookmarked') {
    filters.value[key] = nextTriState(filters.value[key])
  }

  /** `viewModel.updatesPreferences.filterExcludedScanlators.getAndSet { !it }`. */
  function toggleExcludedScanlators() {
    filters.value.excludedScanlators = !filters.value.excludedScanlators
  }

  /** `viewModel.cycleCategory(category)` — the included and excluded lists are mutually exclusive. */
  function cycleCategory(categoryId: number) {
    const current = filters.value.includedCategories.includes(categoryId)
      ? 'include' as const
      : filters.value.excludedCategories.includes(categoryId) ? 'exclude' as const : 'all' as const
    const next = nextTriState(current)
    filters.value.includedCategories = next === 'include'
      ? [...filters.value.includedCategories, categoryId]
      : filters.value.includedCategories.filter(id => id !== categoryId)
    filters.value.excludedCategories = next === 'exclude'
      ? [...filters.value.excludedCategories, categoryId]
      : filters.value.excludedCategories.filter(id => id !== categoryId)
  }

  return {
    entries, filteredEntries, loading, error, page, hasNextPage, filters, hasActiveFilters,
    mangaCategories, excludedScanlatorsByManga,
    refresh, loadMore, dispose, patch, toggleFilter, toggleExcludedScanlators, cycleCategory,
  }
})
