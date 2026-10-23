/**
 * Pure helpers behind `ChapterTransition.vue`.
 *
 * Mirrors Mihon's `eu/kanade/presentation/reader/ChapterTransition.kt`
 * (Mihon 446f6df8) and the string resources it uses:
 *  - `MR.strings.transition_previous` / `transition_current`
 *  - `MR.strings.transition_finished` / `transition_next`
 *  - `MR.strings.transition_no_previous` / `transition_no_next`
 *  - `MR.plurals.missing_chapters_warning`
 *  - `tachiyomi.domain.chapter.service.calculateChapterGap`
 */

export type ChapterTransitionType = 'prev' | 'next'

export interface TransitionChapter {
  name: string
  scanlator?: string | null
  chapterNumber?: number
  downloaded?: boolean
  [key: string]: unknown
}

export interface TransitionChapterData {
  /** 'prev' = the transition shown before the current chapter, 'next' = the one shown after it. */
  type: ChapterTransitionType
  /** The chapter the reader is on (`ChapterTransition.from`). */
  from: TransitionChapter
  /** The chapter the reader moves to (`ChapterTransition.to`), null when there is none. */
  to?: TransitionChapter | null
}

export interface TransitionLabels {
  top: string
  bottom: string
  fallback: string
}

/** MR.strings.transition_* (base locale). */
export const TRANSITION_LABELS: Record<ChapterTransitionType, TransitionLabels> = {
  prev: { top: 'Previous:', bottom: 'Current:', fallback: "There's no previous chapter" },
  next: { top: 'Finished:', bottom: 'Next:', fallback: "There's no next chapter" },
}

export function transitionLabels(type: ChapterTransitionType): TransitionLabels {
  return TRANSITION_LABELS[type]
}

/**
 * Kotlin: `tachiyomi.domain.chapter.service.calculateChapterGap`.
 * `isRecognizedNumber` is `chapterNumber >= 0`; the gap is
 * `floor(higher) - floor(lower) - 1`.
 */
export function calculateChapterGap(
  higher: TransitionChapter | null | undefined,
  lower: TransitionChapter | null | undefined,
): number {
  if (!higher || !lower) return 0
  const higherNum = Number(higher.chapterNumber ?? -1)
  const lowerNum = Number(lower.chapterNumber ?? -1)
  if (higherNum < 0 || lowerNum < 0) return 0
  return Math.floor(higherNum) - Math.floor(lowerNum) - 1
}

/**
 * Kotlin: `ChapterTransition.Prev` compares the current chapter against the previous one and
 * `ChapterTransition.Next` compares the next chapter against the current one; the higher
 * chapter number is always the first argument of `calculateChapterGap`.
 */
export function transitionChapterGap(transition: TransitionChapterData): number {
  return transition.type === 'prev'
    ? calculateChapterGap(transition.from, transition.to)
    : calculateChapterGap(transition.to, transition.from)
}

/** MR.plurals.missing_chapters_warning. */
export function missingChaptersWarning(gapCount: number): string {
  return gapCount === 1
    ? `Skipping ${gapCount} chapter, either the source is missing it or it has been filtered out`
    : `Skipping ${gapCount} chapters, either the source is missing them or they have been filtered out`
}
