import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  calculateChapterGap,
  missingChaptersWarning,
  transitionChapterGap,
  transitionLabels,
  type TransitionChapter,
} from '../../src/components/reader/chapterTransition'

const vueSource = readFileSync('src/components/reader/ChapterTransition.vue', 'utf8')

function chapter(name: string, chapterNumber: number, scanlator: string | null = null, downloaded = false): TransitionChapter {
  return { name, scanlator, chapterNumber, downloaded }
}

describe('reader chapter transition (ChapterTransition.kt) - Pure Helpers', () => {
  it('uses the MR.strings.transition_* labels', () => {
    expect(transitionLabels('prev')).toEqual({
      top: 'Previous:',
      bottom: 'Current:',
      fallback: "There's no previous chapter",
    })
    expect(transitionLabels('next')).toEqual({
      top: 'Finished:',
      bottom: 'Next:',
      fallback: "There's no next chapter",
    })
  })

  it('computes the chapter gap like calculateChapterGap', () => {
    // Kotlin: floor(higher) - floor(lower) - 1.
    expect(calculateChapterGap(chapter('c44', 44), chapter('c1', 1))).toBe(42)
    expect(calculateChapterGap(chapter('c2', 2), chapter('c1', 1))).toBe(0)
    // isRecognizedNumber = chapterNumber >= 0.
    expect(calculateChapterGap(chapter('c1', 1), chapter('c-1', -1))).toBe(0)
    expect(calculateChapterGap(null, chapter('c1', 1))).toBe(0)
    expect(calculateChapterGap(chapter('c1', 1), null)).toBe(0)
    expect(calculateChapterGap({ name: 'c1' }, { name: 'c0' })).toBe(0)
  })

  it('passes the higher chapter number first for both transition directions', () => {
    const current = chapter('current', 1)
    const previous = chapter('previous', 0)
    const next = chapter('next', 44)
    // Kotlin: Prev -> calculateChapterGap(currChapter, goingToChapter).
    expect(transitionChapterGap({ type: 'prev', from: current, to: previous })).toBe(0)
    // Kotlin: Next -> calculateChapterGap(goingToChapter, currChapter).
    expect(transitionChapterGap({ type: 'next', from: current, to: next })).toBe(42)
    // No target chapter -> no gap.
    expect(transitionChapterGap({ type: 'next', from: current, to: null })).toBe(0)
  })

  it('formats MR.plurals.missing_chapters_warning', () => {
    expect(missingChaptersWarning(1)).toBe(
      'Skipping 1 chapter, either the source is missing it or it has been filtered out',
    )
    expect(missingChaptersWarning(42)).toBe(
      'Skipping 42 chapters, either the source is missing them or they have been filtered out',
    )
  })
})

describe('ChapterTransition.vue (CHECKLIST #97) - Parity with Mihon Compose', () => {
  describe('Reference Structure & Typography Tokens', () => {
    it('sets max width constraint to 460dp matching Modifier.widthIn(max = 460.dp)', () => {
      expect(vueSource).toContain('max-width: 460px')
    })

    it('sets vertical spacer to 24dp matching VerticalSpacerSize = 24.dp', () => {
      expect(vueSource).toContain('height: 24px')
    })

    it('uses titleMedium (16sp / 24sp w500 ls 0.15sp) with 4dp bottom padding for chapter headers', () => {
      expect(vueSource).toContain('font-size: 16px')
      expect(vueSource).toContain('line-height: 24px')
      expect(vueSource).toContain('font-weight: 500')
      expect(vueSource).toContain('letter-spacing: 0.15px')
      expect(vueSource).toContain('margin: 0 0 4px')
    })

    it('uses titleLarge with fontSize 20sp (20sp / 28sp w400, maxLines 5, ellipsis) for chapter name', () => {
      expect(vueSource).toContain('font-size: 20px')
      expect(vueSource).toContain('line-height: 28px')
      expect(vueSource).toContain('-webkit-line-clamp: 5')
      expect(vueSource).toContain('overflow: hidden')
      expect(vueSource).toContain('text-overflow: ellipsis')
    })

    it('renders inline downloaded icon check_circle with 22sp size and 27px text-indent', () => {
      expect(vueSource).toContain('icon="check_circle"')
      expect(vueSource).toContain('size="22"')
      expect(vueSource).toContain('filled-symbol')
      expect(vueSource).toContain('text-indent: 27px')
      expect(vueSource).toContain('width: 22px')
      expect(vueSource).toContain('height: 22px')
      expect(vueSource).toContain('top: 3px')
      expect(vueSource).toContain('aria-label="Downloaded"')
    })

    it('uses bodySmall (12sp / 16sp w400 ls 0.4sp) with secondaryItemAlpha 0.78 and 2dp top padding for scanlator', () => {
      expect(vueSource).toContain('font-size: 12px')
      expect(vueSource).toContain('line-height: 16px')
      expect(vueSource).toContain('letter-spacing: 0.4px')
      expect(vueSource).toContain('opacity: 0.78')
      expect(vueSource).toContain('margin: 2px 0 0')
      expect(vueSource).toContain('-webkit-line-clamp: 2')
    })
  })

  describe('Notice Cards & Icons Parity', () => {
    it('uses OutlinedCard styling: 12dp CornerMedium radius, 1dp outlineVariant border, transparent container', () => {
      expect(vueSource).toContain('border-radius: 12px')
      expect(vueSource).toContain('border: 1px solid rgb(var(--v-theme-outline-variant))')
      expect(vueSource).toContain('background: transparent')
      expect(vueSource).toContain('color: rgb(var(--v-theme-on-surface))')
    })

    it('uses Row layout with 16dp horizontal / 12dp vertical padding, 16dp gap, centered horizontally', () => {
      expect(vueSource).toContain('padding: 12px 16px')
      expect(vueSource).toContain('gap: 16px')
      expect(vueSource).toContain('align-self: center')
    })

    it('uses bodyMedium (14sp / 20sp w400 ls 0.25sp) for notice card text', () => {
      expect(vueSource).toContain('font-size: 14px')
      expect(vueSource).toContain('line-height: 20px')
      expect(vueSource).toContain('letter-spacing: 0.25px')
    })

    it('renders MaterialSymbols.Rounded.Info (primary) for fallback notification and RoundedFilled.Warning (error) for gap warning', () => {
      expect(vueSource).toContain('icon="info"')
      expect(vueSource).toContain('ct-notice-icon--primary')
      expect(vueSource).toContain('icon="warning"')
      expect(vueSource).toContain('ct-notice-icon--error')
    })
  })

  describe('Holder Modes & Page Loader State', () => {
    it('supports PagerTransitionHolder padding (horizontal = 64dp) and WebtoonTransitionHolder (horizontal = 32dp, vertical = 128dp)', () => {
      expect(vueSource).toContain('chapter-transition-wrap--pager')
      expect(vueSource).toContain('padding: 0 64px')
      expect(vueSource).toContain('chapter-transition-wrap--webtoon')
      expect(vueSource).toContain('padding: 128px 32px')
    })

    it('renders page loader state with 40dp CircularProgressIndicator and "Loading pages…"', () => {
      expect(vueSource).toContain('v-progress-circular')
      expect(vueSource).toContain('color="primary"')
      expect(vueSource).toContain('size="40"')
      expect(vueSource).toContain('width="4"')
      expect(vueSource).toContain('Loading pages…')
    })

    it('renders error state with retry button matching ReaderButton (40dp height, 20dp radius, primary container)', () => {
      expect(vueSource).toContain('Failed to load pages:')
      expect(vueSource).toContain('ct-retry')
      expect(vueSource).toContain('min-height: 40px')
      expect(vueSource).toContain('border-radius: 20px')
      expect(vueSource).toContain('background: rgb(var(--v-theme-primary))')
      expect(vueSource).toContain('color: rgb(var(--v-theme-on-primary))')
      expect(vueSource).toContain('font-weight: 500')
    })
  })
})
