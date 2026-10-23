import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  calculateChapterGap,
  calculateChapterGapBetween,
  insertMissingChapterGaps,
  missingChaptersCount,
} from '../../src/utils/missingChapters'

// Reference: mihon/domain/src/main/java/tachiyomi/domain/chapter/service/MissingChapters.kt
describe('missing chapter gap calculation', () => {
  it('counts the gap between two recognised chapter numbers', () => {
    expect(calculateChapterGap(10, 4)).toBe(5)
    expect(calculateChapterGap(4, 10)).toBe(-7)
  })

  it('floors fractional chapter numbers', () => {
    expect(calculateChapterGap(16.5, 15.2)).toBe(0)
    expect(calculateChapterGap(17.5, 15.2)).toBe(1)
  })

  it('ignores unrecognised (negative) chapter numbers', () => {
    expect(calculateChapterGap(-1, 4)).toBe(0)
    expect(calculateChapterGap(4, -1)).toBe(0)
    expect(calculateChapterGapBetween(-1, 4)).toBe(0)
  })

  it('counts every missing chapter of a list', () => {
    // 1,2,3,7 -> 4, 5 and 6 are missing.
    expect(missingChaptersCount([1, 2, 3, 7])).toBe(3)
    expect(missingChaptersCount([1, 2, 3])).toBe(0)
    expect(missingChaptersCount([])).toBe(0)
    // Unknown numbers are ignored.
    expect(missingChaptersCount([-1, -1])).toBe(0)
    // Duplicates are counted once.
    expect(missingChaptersCount([1, 1, 5])).toBe(3)
  })

  it('inserts a separator for every gap between neighbouring chapters', () => {
    const ascending = [
      { id: 1, chapterNumber: 1 },
      { id: 2, chapterNumber: 2 },
      { id: 3, chapterNumber: 5 },
      { id: 4, chapterNumber: 6 },
    ]
    // The reference pairs the neighbours of the *sorted* list, so the descending
    // variant uses the reversed list.
    const descending = ascending.slice().reverse()
    expect(insertMissingChapterGaps(ascending, false)).toEqual([
      { id: '2-3', count: 2 },
    ])
    expect(insertMissingChapterGaps(descending, true)).toEqual([
      { id: '2-3', count: 2 },
    ])
  })

  it('adds the leading gap below the first chapter', () => {
    expect(insertMissingChapterGaps([{ id: 1, chapterNumber: 4 }], false)).toEqual([
      { id: 'null-1', count: 3 },
    ])
    // The reference coerces the leading gap at zero.
    expect(insertMissingChapterGaps([{ id: 1, chapterNumber: 1 }], false)).toEqual([])
  })
})

describe('MissingChapterCountListItem parity', () => {
  const source = readFileSync('src/components/MissingChapterCountListItem.vue', 'utf8')

  it('uses the reference paddings, gap and secondary alpha', () => {
    // MaterialTheme.padding.medium = 16dp, MaterialTheme.padding.small = 8dp,
    // SECONDARY_ALPHA = .78f.
    expect(source).toContain('gap: 16px')
    expect(source).toContain('padding: 8px 16px')
    expect(source).toContain('opacity: 0.78')
  })

  it('uses the reference labelMedium typography', () => {
    expect(source).toContain('font-size: 12px')
    expect(source).toContain('line-height: 16px')
    expect(source).toContain('font-weight: 500')
    expect(source).toContain('letter-spacing: 0.5px')
  })

  it('draws the two dividers with the reference thickness and colour', () => {
    expect(source).toContain('height: 1px')
    expect(source).toContain('rgb(var(--v-theme-outline-variant))')
  })

  it('pluralises the label like the missing_chapters plural', () => {
    expect(source).toContain("props.count === 1 ? 'chapter' : 'chapters'")
  })
})
