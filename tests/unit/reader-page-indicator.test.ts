import { describe, expect, it } from 'vitest'
import {
  PAGE_INDICATOR_FILL_COLOR,
  PAGE_INDICATOR_FONT_SIZE,
  PAGE_INDICATOR_LETTER_SPACING,
  PAGE_INDICATOR_STROKE_COLOR,
  PAGE_INDICATOR_STROKE_WIDTH,
  SHOW_PAGE_NUMBER_PREF_KEY,
  isPageNumberEnabled,
  isPageIndicatorVisible,
  pageIndicatorLabel,
} from '@/features/reader/utils/readerPageIndicator'

describe('reader page indicator (ReaderPageIndicator.kt)', () => {
  it('renders nothing for a non-positive page or total', () => {
    // Kotlin: `if (currentPage <= 0 || totalPages <= 0) return`.
    expect(isPageIndicatorVisible(0, 10)).toBe(false)
    expect(isPageIndicatorVisible(-1, 10)).toBe(false)
    expect(isPageIndicatorVisible(1, 0)).toBe(false)
    expect(isPageIndicatorVisible(1, -3)).toBe(false)
    expect(isPageIndicatorVisible(1, 1)).toBe(true)
    expect(isPageIndicatorVisible(10, 69)).toBe(true)
  })

  it('formats the label exactly like the Kotlin string template', () => {
    // Kotlin: `val text = "$currentPage / $totalPages"`.
    expect(pageIndicatorLabel(10, 69)).toBe('10 / 69')
    expect(pageIndicatorLabel(1, 3)).toBe('1 / 3')
  })

  it('keeps the reference typography and colours', () => {
    expect(PAGE_INDICATOR_FONT_SIZE).toBe(12) // typography.bodySmall.fontSize
    expect(PAGE_INDICATOR_LETTER_SPACING).toBe(1) // letterSpacing = 1.sp
    expect(PAGE_INDICATOR_FILL_COLOR).toBe('#ebebeb') // Color(235, 235, 235)
    expect(PAGE_INDICATOR_STROKE_COLOR).toBe('#2d2d2d') // Color(45, 45, 45)
    expect(PAGE_INDICATOR_STROKE_WIDTH).toBe(4) // Stroke(width = 4f)
  })

  it('honours the "show page number" preference, defaulting to enabled', () => {
    // Kotlin: ReaderActivity.kt:261 draws the indicator only when `showPageNumber` is on;
    // ReaderPreferences.kt:42 defaults the preference to true.
    expect(SHOW_PAGE_NUMBER_PREF_KEY).toBe('mihon.reader.showPageNumber')
    expect(isPageNumberEnabled(null)).toBe(true)
    expect(isPageNumberEnabled('true')).toBe(true)
    expect(isPageNumberEnabled('false')).toBe(false)
  })
})
