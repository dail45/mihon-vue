import { describe, expect, it } from 'vitest'
import {
  computeSpreadLayout,
  findSpreadIndexForPage,
  getCenterMarginGap,
  getSpreadDisplayOrder,
  getSpreadPageStep,
  hasCenterMargin,
  isDoublePageActive,
  type SpreadPageItem,
} from '@/features/reader/utils/spreadLayout'

describe('spreadLayout', () => {
  describe('isDoublePageActive', () => {
    it('always activates on double mode', () => {
      expect(isDoublePageActive('double', false)).toBe(true)
      expect(isDoublePageActive('double', true)).toBe(true)
    })

    it('never activates on single mode', () => {
      expect(isDoublePageActive('single', false)).toBe(false)
      expect(isDoublePageActive('single', true)).toBe(false)
    })

    it('activates on auto mode only on landscape viewports', () => {
      expect(isDoublePageActive('auto', false)).toBe(false)
      expect(isDoublePageActive('auto', true)).toBe(true)
    })
  })

  describe('computeSpreadLayout', () => {
    it('handles empty or non-positive page count', () => {
      expect(computeSpreadLayout({ pageCount: 0, pageLayout: 'double' })).toEqual([])
      expect(computeSpreadLayout({ pageCount: -1, pageLayout: 'double' })).toEqual([])
    })

    it('creates single item spreads in single mode', () => {
      const items = computeSpreadLayout({ pageCount: 4, pageLayout: 'single' })
      expect(items).toEqual([
        { primaryIndex: 0, secondaryIndex: null, isShifted: false, isLandscapeScan: false },
        { primaryIndex: 1, secondaryIndex: null, isShifted: false, isLandscapeScan: false },
        { primaryIndex: 2, secondaryIndex: null, isShifted: false, isLandscapeScan: false },
        { primaryIndex: 3, secondaryIndex: null, isShifted: false, isLandscapeScan: false },
      ])
    })

    it('pairs consecutive portrait pages in double mode', () => {
      const items = computeSpreadLayout({
        pageCount: 5,
        pageLayout: 'double',
      })
      expect(items).toEqual([
        { primaryIndex: 0, secondaryIndex: 1, isShifted: false, isLandscapeScan: false },
        { primaryIndex: 2, secondaryIndex: 3, isShifted: false, isLandscapeScan: false },
        { primaryIndex: 4, secondaryIndex: null, isShifted: false, isLandscapeScan: false },
      ])
    })

    it('keeps page 0 (cover) solo when shiftDoublePages is enabled', () => {
      const items = computeSpreadLayout({
        pageCount: 6,
        pageLayout: 'double',
        shiftDoublePages: true,
      })
      expect(items).toEqual([
        { primaryIndex: 0, secondaryIndex: null, isShifted: true, isLandscapeScan: false },
        { primaryIndex: 1, secondaryIndex: 2, isShifted: false, isLandscapeScan: false },
        { primaryIndex: 3, secondaryIndex: 4, isShifted: false, isLandscapeScan: false },
        { primaryIndex: 5, secondaryIndex: null, isShifted: false, isLandscapeScan: false },
      ])
    })

    it('renders landscape scans solo without pairing', () => {
      // Page 2 is a landscape scan
      const isLandscape = (idx: number) => idx === 2
      const items = computeSpreadLayout({
        pageCount: 6,
        pageLayout: 'double',
        isLandscapePage: isLandscape,
      })
      expect(items).toEqual([
        { primaryIndex: 0, secondaryIndex: 1, isShifted: false, isLandscapeScan: false },
        { primaryIndex: 2, secondaryIndex: null, isShifted: false, isLandscapeScan: true },
        { primaryIndex: 3, secondaryIndex: 4, isShifted: false, isLandscapeScan: false },
        { primaryIndex: 5, secondaryIndex: null, isShifted: false, isLandscapeScan: false },
      ])
    })

    it('isolates portrait page preceding a landscape scan', () => {
      // Page 1 is a landscape scan, so Page 0 cannot pair with it
      const isLandscape = (idx: number) => idx === 1
      const items = computeSpreadLayout({
        pageCount: 5,
        pageLayout: 'double',
        isLandscapePage: isLandscape,
      })
      expect(items).toEqual([
        { primaryIndex: 0, secondaryIndex: null, isShifted: false, isLandscapeScan: false },
        { primaryIndex: 1, secondaryIndex: null, isShifted: false, isLandscapeScan: true },
        { primaryIndex: 2, secondaryIndex: 3, isShifted: false, isLandscapeScan: false },
        { primaryIndex: 4, secondaryIndex: null, isShifted: false, isLandscapeScan: false },
      ])
    })
  })

  describe('findSpreadIndexForPage', () => {
    const spreads: SpreadPageItem[] = [
      { primaryIndex: 0, secondaryIndex: null, isShifted: true, isLandscapeScan: false },
      { primaryIndex: 1, secondaryIndex: 2, isShifted: false, isLandscapeScan: false },
      { primaryIndex: 3, secondaryIndex: 4, isShifted: false, isLandscapeScan: false },
      { primaryIndex: 5, secondaryIndex: null, isShifted: false, isLandscapeScan: false },
    ]

    it('locates spread index for both primary and secondary pages', () => {
      expect(findSpreadIndexForPage(spreads, 0)).toBe(0)
      expect(findSpreadIndexForPage(spreads, 1)).toBe(1)
      expect(findSpreadIndexForPage(spreads, 2)).toBe(1)
      expect(findSpreadIndexForPage(spreads, 3)).toBe(2)
      expect(findSpreadIndexForPage(spreads, 4)).toBe(2)
      expect(findSpreadIndexForPage(spreads, 5)).toBe(3)
    })

    it('returns 0 for missing page or empty list', () => {
      expect(findSpreadIndexForPage(spreads, 99)).toBe(0)
      expect(findSpreadIndexForPage([], 2)).toBe(0)
    })
  })

  describe('getSpreadDisplayOrder', () => {
    const pairedSpread: SpreadPageItem = {
      primaryIndex: 1,
      secondaryIndex: 2,
      isShifted: false,
      isLandscapeScan: false,
    }

    const soloSpread: SpreadPageItem = {
      primaryIndex: 0,
      secondaryIndex: null,
      isShifted: false,
      isLandscapeScan: false,
    }

    it('places primary on left and secondary on right in LTR', () => {
      const order = getSpreadDisplayOrder(pairedSpread, 'ltr', false)
      expect(order).toEqual({ leftIndex: 1, rightIndex: 2 })
    })

    it('places secondary on left and primary on right in RTL (manga order)', () => {
      const order = getSpreadDisplayOrder(pairedSpread, 'rtl', false)
      expect(order).toEqual({ leftIndex: 2, rightIndex: 1 })
    })

    it('flips display order when invertDoublePages is true', () => {
      // In LTR with invert: primary on right, secondary on left
      expect(getSpreadDisplayOrder(pairedSpread, 'ltr', true)).toEqual({
        leftIndex: 2,
        rightIndex: 1,
      })
      // In RTL with invert: primary on left, secondary on right
      expect(getSpreadDisplayOrder(pairedSpread, 'rtl', true)).toEqual({
        leftIndex: 1,
        rightIndex: 2,
      })
    })

    it('handles solo spreads consistently', () => {
      expect(getSpreadDisplayOrder(soloSpread, 'ltr', false)).toEqual({
        leftIndex: 0,
        rightIndex: null,
      })
      expect(getSpreadDisplayOrder(soloSpread, 'rtl', false)).toEqual({
        leftIndex: 0,
        rightIndex: null,
      })
    })
  })

  describe('centerMargin helpers', () => {
    it('evaluates center margin types correctly', () => {
      expect(hasCenterMargin('none', true, true)).toBe(false)
      expect(hasCenterMargin('double', true, false)).toBe(true)
      expect(hasCenterMargin('double', false, true)).toBe(false)
      expect(hasCenterMargin('wide', false, true)).toBe(true)
      expect(hasCenterMargin('wide', true, false)).toBe(false)
      expect(hasCenterMargin('double_and_wide', true, false)).toBe(true)
      expect(hasCenterMargin('double_and_wide', false, true)).toBe(true)
      expect(hasCenterMargin('double_and_wide', false, false)).toBe(false)
    })

    it('computes gutter gap correctly', () => {
      expect(getCenterMarginGap('double', true, false, 12)).toBe(12)
      expect(getCenterMarginGap('double', false, false, 12)).toBe(0)
    })

    it('calculates page step for spreads', () => {
      expect(getSpreadPageStep({ primaryIndex: 0, secondaryIndex: 1, isShifted: false, isLandscapeScan: false })).toBe(2)
      expect(getSpreadPageStep({ primaryIndex: 0, secondaryIndex: null, isShifted: false, isLandscapeScan: false })).toBe(1)
    })
  })
})
