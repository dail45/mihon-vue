/**
 * Scanlator exclusion helpers.
 *
 * Mihon reference (pinned commit 446f6df82c390ab760802c2fce3b677bce3f31c1):
 *  - mihon/app/src/main/java/eu/kanade/presentation/manga/components/ScanlatorFilterDialog.kt
 *      `availableScanlators.sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it })`
 *      -> case-insensitive ordering of the available scanlator names.
 *  - mihon/app/src/main/java/eu/kanade/tachiyomi/domain/manga/interactor/SetExcludedScanlators.kt
 *      `suspend fun await(mangaId: Long, excludedScanlators: Set<String>)`
 *      -> the excluded scanlator set is a per-manga setting of the Mihon database.
 *
 * Suwayomi-Server exposes no equivalent field (the REST v1 contract has no excluded-scanlator
 * member), so the web client keeps the set in browser storage and applies it to the chapter list
 * of the manga in the browser only.
 */

/** Storage key of the per-manga excluded scanlator set. */
export function scanlatorStorageKey(apiUrl: string, mangaId: number): string {
  return `mihon-vue:scanlator-excluded:${apiUrl}::${mangaId}`
}

/**
 * Case-insensitive ordering, matching `compareBy(String.CASE_INSENSITIVE_ORDER) { it }`.
 * The sort is stable, so equal names keep their original order.
 */
export function sortScanlators(scanlators: readonly string[]): string[] {
  return scanlators
    .map((value, index) => ({ value, index }))
    .sort((a, b) => {
      const left = a.value.toLowerCase()
      const right = b.value.toLowerCase()
      if (left < right) return -1
      if (left > right) return 1
      return a.index - b.index
    })
    .map(entry => entry.value)
}

/**
 * Distinct scanlator names of the loaded chapters.
 * Mihon's `GetAvailableScanlators` reads the scanlator column of the manga chapters; a chapter
 * without a scanlator contributes no entry.
 */
export function availableScanlators(chapters: readonly { scanlator?: string | null }[]): string[] {
  const names = new Set<string>()
  for (const chapter of chapters) {
    const name = chapter.scanlator?.trim()
    if (name) names.add(name)
  }
  return sortScanlators([...names])
}

/** Reads the excluded scanlator set of a manga from browser storage. */
export function loadExcludedScanlators(apiUrl: string, mangaId: number): string[] {
  try {
    const raw = window.localStorage.getItem(scanlatorStorageKey(apiUrl, mangaId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string')
  } catch {
    return []
  }
}

/** Stores the excluded scanlator set of a manga in browser storage. */
export function saveExcludedScanlators(apiUrl: string, mangaId: number, excluded: readonly string[]): void {
  try {
    window.localStorage.setItem(scanlatorStorageKey(apiUrl, mangaId), JSON.stringify([...excluded]))
  } catch {
    /* storage unavailable: the set simply is not remembered */
  }
}

/** True when the chapter belongs to an excluded scanlator. */
export function isChapterExcluded(
  chapter: { scanlator?: string | null },
  excluded: readonly string[],
): boolean {
  const name = chapter.scanlator?.trim()
  return !!name && excluded.includes(name)
}
