/**
 * Updates feed filters.
 *
 * Mihon reference (pinned commit 446f6df82c390ab760802c2fce3b677bce3f31c1):
 *  - `mihon/data/src/main/sqldelight/tachiyomi/view/updatesView.sq` — `getRecentUpdatesWithFilters`
 *    implements the SQL semantics of the tri-state filters:
 *      * read      : `:read IS NULL OR read = :read`
 *      * started   : `:started = 1 AND lastPageRead > 0 AND read = 0`
 *                    `:started = 0 AND lastPageRead = 0 AND read = 0`
 *      * bookmarked: `:bookmarked IS NULL OR bookmark = :bookmarked`
 *      * excluded scanlator: `(excludedScanlator IS NULL OR :hideExcludedScanlators = 0)`
 *      * categories: an empty included/excluded list means "don't care"; otherwise the manga
 *        must be a member of an included category and must not be a member of an excluded one.
 *  - `mihon/app/src/main/java/eu/kanade/tachiyomi/ui/updates/UpdatesViewModel.kt:219-233` —
 *    the downloaded filter is applied in Kotlin on top of the SQL result
 *    (`applyFilter(filterDownloaded) { it.downloadStateProvider() == Download.State.DOWNLOADED }`).
 *
 * Suwayomi-Server's REST v1 `/update/recentChapters/{page}` has no filter parameters, so the
 * whole filter set is applied in the browser on the fetched feed.
 */
import type { MangaChapter } from '../api/types'
import type { TriState } from './library'

/** Mihon's `TriState.toBooleanOrNull()`: DISABLED -> null, ENABLED_IS -> true, ENABLED_NOT -> false. */
export function triStateToBooleanOrNull(state: TriState): boolean | null {
  if (state === 'include') return true
  if (state === 'exclude') return false
  return null
}

/** Mihon's `applyFilter(triState) { predicate }` for a boolean chapter attribute. */
export function matchesBooleanFilter(value: boolean, state: TriState): boolean {
  const expected = triStateToBooleanOrNull(state)
  return expected === null || value === expected
}

/**
 * Mihon's "started" filter: a chapter is started when it has progress but is not read.
 * `:started = 1` -> `lastPageRead > 0 AND read = 0`; `:started = 0` -> `lastPageRead = 0 AND read = 0`.
 */
export function matchesStartedFilter(chapter: { read: boolean; lastPageRead: number }, state: TriState): boolean {
  const expected = triStateToBooleanOrNull(state)
  if (expected === null) return true
  const started = !chapter.read && chapter.lastPageRead > 0
  return started === expected
}

/**
 * The category membership filter of `getRecentUpdatesWithFilters`.
 *
 * `includedCategories` / `excludedCategories` are empty when the corresponding tri-state is
 * DISABLED ("don't care"). A manga belongs to a category when the category lists it.
 * The system category (id 0 in Mihon) stands for "not in any category".
 */
export function matchesCategoryFilter(
  categoryIds: readonly number[],
  included: readonly number[],
  excluded: readonly number[],
): boolean {
  if (included.length) {
    const inIncluded = categoryIds.some(id => included.includes(id))
    if (!inIncluded) return false
  }
  if (excluded.length) {
    const inExcluded = categoryIds.some(id => excluded.includes(id))
    if (inExcluded) return false
  }
  return true
}

export interface UpdatesFilterContext {
  /** The tri-state filters of the reference preferences. */
  downloaded: TriState
  unread: TriState
  started: TriState
  bookmarked: TriState
  /** `filterExcludedScanlators` — hides chapters of an excluded scanlator. */
  excludedScanlators: boolean
  includedCategories: readonly number[]
  excludedCategories: readonly number[]
  /** Category membership per manga id (`manga_category` of the reference database). */
  mangaCategories?: ReadonlyMap<number, readonly number[]>
  /** Excluded scanlator names per manga id (Mihon's `excluded_scanlator` table). */
  excludedScanlatorsByManga?: ReadonlyMap<number, readonly string[]>
}

/** Applies the whole filter set to a single feed entry. */
export function matchesUpdatesFilters(entry: MangaChapter, context: UpdatesFilterContext): boolean {
  const { chapter, manga } = entry
  if (!matchesBooleanFilter(!chapter.read, context.unread)) return false
  if (!matchesStartedFilter(chapter, context.started)) return false
  if (!matchesBooleanFilter(chapter.bookmarked, context.bookmarked)) return false
  if (!matchesBooleanFilter(chapter.downloaded, context.downloaded)) return false

  if (context.excludedScanlators) {
    const excluded = context.excludedScanlatorsByManga?.get(manga.id) ?? []
    const scanlator = chapter.scanlator?.trim()
    if (scanlator && excluded.includes(scanlator)) return false
  }

  if (context.includedCategories.length || context.excludedCategories.length) {
    const categoryIds = context.mangaCategories?.get(manga.id) ?? []
    if (!matchesCategoryFilter(categoryIds, context.includedCategories, context.excludedCategories)) return false
  }
  return true
}
