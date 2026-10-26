import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { defaultFilters, defaultSort, librarySortOptions, type LibraryFilters, type LibrarySort, type LibrarySortType, type LibraryGroupMode } from '@/core/utils/library'
export type DisplayMode = 'compact' | 'comfortable' | 'comfortable-panorama' | 'covers' | 'list'
export type TabletUiMode = 'automatic' | 'always' | 'landscape' | 'never'
export type ThemeMode = 'system' | 'light' | 'dark'
// Only harmless UI preferences are stored; no manga database or credentials.
export function readPreference(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
export function writePreference(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* private mode: session-only preference */ }
}
export const usePreferencesStore = defineStore('preferences', () => {
  const savedTablet = readPreference('mihon.tabletUiMode')
  const tabletUiMode = ref<TabletUiMode>(['always', 'landscape', 'never'].includes(savedTablet || '') ? savedTablet as TabletUiMode : 'automatic')
  watch(tabletUiMode, v => writePreference('mihon.tabletUiMode', v))
  const savedTheme = readPreference('mihon.theme')
  const themeMode = ref<ThemeMode>(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : 'system')
  watch(themeMode, value => writePreference('mihon.theme', value))
  const savedDisplay = readPreference('mihon.library.display')
  const libraryDisplay = ref<DisplayMode>(['comfortable', 'comfortable-panorama', 'covers', 'list'].includes(savedDisplay || '') ? savedDisplay as DisplayMode : 'compact')
  const savedCatalogueDisplay = readPreference('mihon.catalogue.display')
  const catalogueDisplay = ref<DisplayMode>(['comfortable', 'comfortable-panorama', 'covers', 'list'].includes(savedCatalogueDisplay || '') ? savedCatalogueDisplay as DisplayMode : 'compact')
  watch(catalogueDisplay, v => writePreference('mihon.catalogue.display', v))
  const downloadedOnly = ref(readPreference('mihon.library.downloadedOnly') === 'true')
  // Mihon: `preferences.incognitoMode` (MoreScreen.kt:64 "Incognito mode" / "Pauses reading history").
  // It drives the primary-coloured incognito banner (Banners.kt) and pauses the reading history.
  // The storage key is the one the More screen already used, so both stay in sync.
  const incognitoMode = ref(readPreference('mihon.reader.incognito') === 'true')
  watch(incognitoMode, v => writePreference('mihon.reader.incognito', String(v)))
  // Mihon: `preferences.shownOnboardingFlow` (MainActivity.kt:422) gates the onboarding push.
  const onboardingShown = ref(readPreference('mihon.onboarding.shown') === 'true')
  function setOnboardingShown() { onboardingShown.value = true; writePreference('mihon.onboarding.shown', 'true') }
  // Mihon: `preferences.donationCampaignShown` (MainActivity.kt:436) is set when the sheet closes.
  const donationCampaignShown = ref(readPreference('mihon.donation.shown') === 'true')
  function setDonationCampaignShown() { donationCampaignShown.value = true; writePreference('mihon.donation.shown', 'true') }
  /**
   * Mihon reads `packageManager.getPackageInfo(packageName, 0).firstInstallTime` to decide whether
   * the donation campaign is eligible (first install + 6 * 30 days). A browser has no package
   * manager, so the first visit time is kept locally instead.
   */
  const installTime = ref(Number(readPreference('mihon.install.time')) || Date.now())
  writePreference('mihon.install.time', String(installTime.value))
  // Mihon: LibraryPreferences.kt:206-234 — `swipeToEndAction` ("pref_chapter_swipe_end_action",
  // default ToggleBookmark) and `swipeToStartAction` ("pref_chapter_swipe_start_action",
  // default ToggleRead).
  const swipeActions = ['toggle-read', 'toggle-bookmark', 'download', 'disabled'] as const
  type ChapterSwipeAction = typeof swipeActions[number]
  function swipePref(key: string, fallback: ChapterSwipeAction) {
    const stored = readPreference(key), value = ref<ChapterSwipeAction>(swipeActions.includes(stored as ChapterSwipeAction) ? stored as ChapterSwipeAction : fallback)
    watch(value, v => writePreference(key, String(v))); return value
  }
  const chapterSwipeStartAction = swipePref('mihon.chapters.swipeEndAction', 'toggle-bookmark')
  const chapterSwipeEndAction = swipePref('mihon.chapters.swipeStartAction', 'toggle-read')
  function bool(key: string, fallback: boolean, sync = false) {
    const stored = readPreference(key), value = ref(stored === null ? fallback : stored === 'true')
    watch(value, v => writePreference(key, String(v)), sync ? { flush: 'sync' } : undefined); return value
  }
  function str(key: string, fallback = '', sync = false) {
    const stored = readPreference(key)
    const value = ref(stored !== null ? stored : fallback)
    watch(value, v => writePreference(key, v), sync ? { flush: 'sync' } : undefined)
    return value
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
  const useLangIcon = bool('mihon.library.useLangIcon', true), sourceBadge = bool('mihon.library.sourceBadge', false)
  const showContinue = bool('mihon.library.continue', false)
  const categoryTabs = bool('mihon.library.tabs', true), categoryCounts = bool('mihon.library.counts', false)
  const portraitColumns = columns('mihon.library.columns.portrait'), landscapeColumns = columns('mihon.library.columns.landscape')
  const categorizedSort = bool('mihon.library.categorizedSort', false)
  const filters = ref<LibraryFilters>(defaultFilters()), rawFilters = json('mihon.library.filters')
  if (rawFilters && typeof rawFilters === 'object') for (const key of Object.keys(filters.value) as (keyof LibraryFilters)[]) {
    const v = (rawFilters as Record<string, unknown>)[key]
    if (key !== 'tracking' && (v === 'all' || v === 'include' || v === 'exclude')) (filters.value as Record<string, unknown>)[key] = v
  }

  // Dynamic Library Grouping: 0 = Default, 1 = Source, 2 = Status, 3 = Track, 4 = Ungrouped
  const savedGroupMode = Number(readPreference('mihon.library.groupMode'))
  const groupMode = ref<LibraryGroupMode>([0, 1, 2, 3, 4].includes(savedGroupMode) ? savedGroupMode as LibraryGroupMode : 0)
  watch(groupMode, v => writePreference('mihon.library.groupMode', String(v)))

  // Tag Priority Sorting
  const rawSortTags = json('mihon.library.sortTags')
  const sortTags = ref<string[]>(Array.isArray(rawSortTags) ? rawSortTags.filter(t => typeof t === 'string') : [])
  watch(sortTags, v => writePreference('mihon.library.sortTags', JSON.stringify(v)), { deep: true })

  function numberArray(key: string, fallback: number[] = []) {
    const raw = json(key)
    const initial = Array.isArray(raw) ? raw.map(Number).filter(n => Number.isFinite(n)) : fallback
    const value = ref<number[]>(initial)
    watch(value, v => writePreference(key, JSON.stringify(v)), { deep: true })
    return value
  }

  // 3.3 Hidden Categories Feature
  const hiddenCategories = numberArray('mihon.library.hiddenCategories', [])
  const showHiddenCategories = bool('mihon.library.showHiddenCategories', false)
  function toggleHiddenCategory(id: number) {
    if (hiddenCategories.value.includes(id)) {
      hiddenCategories.value = hiddenCategories.value.filter(catId => catId !== id)
    } else {
      hiddenCategories.value = [...hiddenCategories.value, id]
    }
  }

  // 3.4 Empty Categories During Search Preference
  const showEmptyCategoriesSearch = bool('mihon.library.showEmptyCategoriesSearch', false)

  // 3.5 Categories Tri-State Filter Dialog
  const filterCategories = bool('mihon.library.filterCategories', false)
  const filterCategoriesInclude = numberArray('mihon.library.filterCategoriesInclude', [])
  const filterCategoriesExclude = numberArray('mihon.library.filterCategoriesExclude', [])

  function validSort(raw: unknown): LibrarySort {
    if (!raw || typeof raw !== 'object') return defaultSort()
    const r = raw as Record<string, unknown>
    return {
      type: (librarySortOptions.some(o => o.value === r.type) || r.type === 'tagList') ? r.type as LibrarySortType : 'title',
      descending: r.descending === true,
      seed: typeof r.seed === 'number' && Number.isFinite(r.seed) ? r.seed : 0,
    }
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
  const migrationSmartSearchSingleEntry = bool('mihon.migration.smartSearchSingleEntry', false)

  // 5.6 Tracker Auto-Sync & Prompt on Add
  const autoSyncProgressFromTrackers = bool('pref_auto_sync_progress_from_trackers_key', true, true)
  const trackOnAddingToLibrary = bool('track_on_adding_to_library', true, true)

  // 6.4 Navbar Customization
  const showNavUpdates = bool('pref_show_updates_button', true, true)
  const showNavHistory = bool('pref_show_history_button', true, true)
  const bottomBarLabels = bool('pref_show_bottom_bar_labels', true, true)

  // 6.5 Client-Side WebDAV Cloud Backup Sync Preferences
  const webdavUrl = str('pref_webdav_url', '')
  const webdavFolder = str('pref_webdav_folder', 'mihon-backups')
  const webdavUsername = str('pref_webdav_username', '')
  const webdavPassword = str('pref_webdav_password', '')
  const webdavAutoSync = bool('pref_webdav_auto_sync', false, true)
  const webdavLastSync = str('pref_webdav_last_sync', '')

  return {
    tabletUiMode,
    themeMode,
    libraryDisplay,
    catalogueDisplay,
    downloadedOnly,
    incognitoMode,
    onboardingShown,
    setOnboardingShown,
    donationCampaignShown,
    setDonationCampaignShown,
    installTime,
    downloadBadge,
    unreadBadge,
    localBadge,
    languageBadge,
    useLangIcon,
    sourceBadge,
    showContinue,
    categoryTabs,
    categoryCounts,
    portraitColumns,
    landscapeColumns,
    categorizedSort,
    filters,
    globalSort,
    categorySorts,
    getLibrarySort,
    chooseLibrarySort,
    chapterSwipeStartAction,
    chapterSwipeEndAction,
    migrationSmartSearchSingleEntry,
    groupMode,
    sortTags,
    hiddenCategories,
    showHiddenCategories,
    toggleHiddenCategory,
    showEmptyCategoriesSearch,
    filterCategories,
    filterCategoriesInclude,
    filterCategoriesExclude,
    autoSyncProgressFromTrackers,
    trackOnAddingToLibrary,
    showNavUpdates,
    showNavHistory,
    bottomBarLabels,
    webdavUrl,
    webdavFolder,
    webdavUsername,
    webdavPassword,
    webdavAutoSync,
    webdavLastSync,
  }
})
