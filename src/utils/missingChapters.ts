/**
 * Port of Mihon's missing-chapter gap calculation.
 *
 * Reference:
 *   mihon/domain/src/main/java/tachiyomi/domain/chapter/service/MissingChapters.kt
 *     fun List<Double>.missingChaptersCount(): Int
 *     fun calculateChapterGap(higherChapter: Chapter?, lowerChapter: Chapter?): Int
 *     fun calculateChapterGap(higherChapterNumber: Double, lowerChapterNumber: Double): Int
 *   mihon/app/src/main/java/eu/kanade/tachiyomi/ui/manga/MangaViewModel.kt
 *     State.Success.chapterListItems -> insertSeparators { ... }
 *
 * The reference inserts a `ChapterList.MissingCount` separator between two adjacent chapters
 * whenever the gap between their numbers is greater than zero:
 *
 *   val (lowerChapter, higherChapter) = if (manga.sortDescending()) after to before else before to after
 *   if (higherChapter == null) return@insertSeparators null
 *   val missingCount = if (lowerChapter == null) {
 *       floor(higherChapter.chapter.chapterNumber).toInt().minus(1).coerceAtLeast(0)
 *   } else {
 *       calculateChapterGap(higherChapter.chapter, lowerChapter.chapter)
 *   }.takeIf { it > 0 }
 *
 * `calculateChapterGap` floors both numbers and returns
 * `floor(higher) - floor(lower) - 1`, and returns 0 when either number is negative
 * (an unrecognised chapter number).
 */

/** True when the chapter number is a recognised (non-negative) number, like `Chapter.isRecognizedNumber`. */
export function isRecognizedChapterNumber(chapterNumber: number): boolean {
  return chapterNumber >= 0
}

/**
 * `calculateChapterGap(higherChapterNumber, lowerChapterNumber)`:
 * `floor(higher) - floor(lower) - 1`, or 0 when either number is negative.
 */
export function calculateChapterGap(higherChapterNumber: number, lowerChapterNumber: number): number {
  if (higherChapterNumber < 0 || lowerChapterNumber < 0) return 0
  return Math.floor(higherChapterNumber) - Math.floor(lowerChapterNumber) - 1
}

/**
 * `calculateChapterGap(higherChapter, lowerChapter)`: the number form, guarded by
 * `isRecognizedNumber` on both chapters.
 */
export function calculateChapterGapBetween(
  higherChapterNumber: number,
  lowerChapterNumber: number,
): number {
  if (!isRecognizedChapterNumber(higherChapterNumber) || !isRecognizedChapterNumber(lowerChapterNumber)) return 0
  return calculateChapterGap(higherChapterNumber, lowerChapterNumber)
}

/**
 * `List<Double>.missingChaptersCount()`: the total number of chapters missing from the
 * given chapter numbers. Unknown numbers (-1) are ignored, numbers are truncated to
 * integers, de-duplicated and sorted, and every gap larger than one is counted.
 */
export function missingChaptersCount(chapterNumbers: number[]): number {
  if (!chapterNumbers.length) return 0

  const chapters = chapterNumbers
    .filter(n => n !== -1)
    .map(n => Math.trunc(n))
    .filter((n, index, list) => list.indexOf(n) === index)
    .sort((a, b) => a - b)

  if (!chapters.length) return 0

  let missing = 0
  let previousChapter = 0

  for (const currentChapter of chapters) {
    if (currentChapter > previousChapter + 1) {
      missing += currentChapter - previousChapter - 1
    }
    previousChapter = currentChapter
  }

  return missing
}

export interface ChapterGapSeparator {
  /** Separator id, matching Mihon's `"${lowerChapter?.id}-${higherChapter.id}"` shape. */
  id: string
  count: number
}

/**
 * The `insertSeparators` pass of `MangaViewModel.State.Success.chapterListItems`.
 *
 * `chapters` must already be filtered and sorted the way the reference sorts them.
 * `descending` mirrors `manga.sortDescending()`: it decides which neighbour is the
 * "higher" chapter of the pair.
 *
 * Compose's `insertSeparators` visits `before = null` before the first element and
 * `after = null` after the last one, so the reference computes one extra gap:
 *   - ascending: before the first chapter, the gap is `floor(first) - 1` (the chapters
 *     below the first one), because `lowerChapter` is null there.
 *   - descending: after the last chapter, the gap is `floor(last) - 1`, because
 *     `lowerChapter` is null there.
 */
export function insertMissingChapterGaps(
  chapters: { id: string | number; chapterNumber: number }[],
  descending: boolean,
): ChapterGapSeparator[] {
  const separators: ChapterGapSeparator[] = []

  for (let index = 0; index < chapters.length - 1; index++) {
    const before = chapters[index]!
    const after = chapters[index + 1]!

    const lower = descending ? after : before
    const higher = descending ? before : after

    const count = calculateChapterGapBetween(higher.chapterNumber, lower.chapterNumber)
    if (count > 0) {
      separators.push({ id: `${lower.id}-${higher.id}`, count })
    }
  }

  if (chapters.length) {
    const first = chapters[0]!
    const last = chapters[chapters.length - 1]!

    // Ascending: the gap below the first chapter (before == null).
    if (!descending) {
      const count = Math.max(Math.floor(first.chapterNumber) - 1, 0)
      if (count > 0) separators.unshift({ id: `null-${first.id}`, count })
    } else {
      // Descending: the gap below the last chapter (after == null).
      const count = Math.max(Math.floor(last.chapterNumber) - 1, 0)
      if (count > 0) separators.push({ id: `null-${last.id}`, count })
    }
  }

  return separators
}

export type ChapterListEntry =
  | { kind: 'chapter'; chapter: { id: string | number; chapterNumber: number } }
  | { kind: 'missing'; id: string; count: number }

/**
 * The ordered list the reference builds in `MangaViewModel.State.Success.chapterListItems`:
 * the processed chapters with a `ChapterList.MissingCount` separator inserted between two
 * adjacent chapters whenever their numbers leave a gap.
 *
 * The separators of `insertSeparators` are emitted in the visiting order of Compose's
 * `insertSeparators` (before == null first, then every adjacent pair, then after == null),
 * so they are merged back into the list here at the position they belong to.
 */
export function buildChapterListItems(
  chapters: { id: string | number; chapterNumber: number }[],
  descending: boolean,
): ChapterListEntry[] {
  const entries: ChapterListEntry[] = []
  const separators = insertMissingChapterGaps(chapters, descending)
  // The gap below the first chapter (ascending) sits before the first entry, the gap below
  // the last chapter (descending) sits after the last entry; the remaining separators sit
  // between two adjacent chapters.
  const leading = descending ? null : separators.find(s => s.id.startsWith('null-')) ?? null
  const trailing = descending ? separators.find(s => s.id.startsWith('null-')) ?? null : null
  if (leading) entries.push({ kind: 'missing', id: leading.id, count: leading.count })
  for (let index = 0; index < chapters.length; index++) {
    const chapter = chapters[index]!
    entries.push({ kind: 'chapter', chapter })
    if (index < chapters.length - 1) {
      const before = chapter, after = chapters[index + 1]!
      const lower = descending ? after : before
      const higher = descending ? before : after
      const count = calculateChapterGapBetween(higher.chapterNumber, lower.chapterNumber)
      if (count > 0) entries.push({ kind: 'missing', id: `${lower.id}-${higher.id}`, count })
    }
  }
  if (trailing) entries.push({ kind: 'missing', id: trailing.id, count: trailing.count })
  return entries
}
