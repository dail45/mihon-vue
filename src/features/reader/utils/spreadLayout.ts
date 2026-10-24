/**
 * Reader Double-Page Spread Layout Utilities
 *
 * Implements spread pairing logic inspired by Komikku / TachiyomiSY:
 * - PagerViewerAdapter.kt (setJoinedItems)
 * - PagerConfig.kt (PageLayout, CenterMarginType, shiftDoublePage)
 * - ReaderPreferences.kt (pageLayout, invertDoublePages, centerMarginType)
 */

export type PageLayoutMode = 'single' | 'double' | 'auto'
export type CenterMarginType = 'none' | 'double' | 'wide' | 'double_and_wide'

export interface SpreadPageItem {
  primaryIndex: number
  secondaryIndex: number | null
  isShifted: boolean
  isLandscapeScan: boolean
}

export interface CalculateSpreadOptions {
  pageCount: number
  pageLayout: PageLayoutMode
  isLandscapeViewport?: boolean
  shiftDoublePages?: boolean
  isLandscapePage?: (pageIndex: number) => boolean
}

/**
 * Determines whether double page spread layout is currently active.
 * - 'double': always active
 * - 'single': never active
 * - 'auto': active only on landscape viewports (width > height)
 */
export function isDoublePageActive(
  mode: PageLayoutMode,
  isLandscapeViewport = false
): boolean {
  if (mode === 'double') return true
  if (mode === 'single') return false
  return Boolean(isLandscapeViewport)
}

/**
 * Computes spread page pairs [Page, Page | null] across the chapter.
 *
 * Rules:
 * 1. In single mode, each page forms its own solo spread `[i, null]`.
 * 2. In double mode, landscape scan pages (`isLandscapeScan = true`) display solo `[i, null]`.
 * 3. In double mode, consecutive portrait pages are paired `[i, i + 1]`.
 * 4. When `shiftDoublePages` is true, the cover (page 0) displays solo `[0, null]`,
 *    pairing subsequent pages as `[1, 2], [3, 4]`, etc.
 * 5. If a portrait page precedes a landscape page, it displays solo so the landscape scan isn't paired.
 */
export function computeSpreadLayout(options: CalculateSpreadOptions): SpreadPageItem[] {
  const {
    pageCount,
    pageLayout,
    isLandscapeViewport = false,
    shiftDoublePages = false,
    isLandscapePage = () => false,
  } = options

  if (!Number.isFinite(pageCount) || pageCount <= 0) return []

  const doubleActive = isDoublePageActive(pageLayout, isLandscapeViewport)

  if (!doubleActive) {
    const items: SpreadPageItem[] = []
    for (let i = 0; i < pageCount; i++) {
      items.push({
        primaryIndex: i,
        secondaryIndex: null,
        isShifted: false,
        isLandscapeScan: Boolean(isLandscapePage(i)),
      })
    }
    return items
  }

  const items: SpreadPageItem[] = []
  let i = 0

  // If shiftDoublePages is enabled, isolate page 0 (cover)
  if (shiftDoublePages && pageCount > 0) {
    const isLand = Boolean(isLandscapePage(0))
    items.push({
      primaryIndex: 0,
      secondaryIndex: null,
      isShifted: !isLand,
      isLandscapeScan: isLand,
    })
    i = 1
  }

  while (i < pageCount) {
    const isLand = Boolean(isLandscapePage(i))

    if (isLand) {
      // Landscape scan displays solo
      items.push({
        primaryIndex: i,
        secondaryIndex: null,
        isShifted: false,
        isLandscapeScan: true,
      })
      i++
      continue
    }

    // Check if next page exists
    if (i + 1 < pageCount) {
      const nextIsLand = Boolean(isLandscapePage(i + 1))
      if (nextIsLand) {
        // Next page is landscape, so current portrait page must be solo
        items.push({
          primaryIndex: i,
          secondaryIndex: null,
          isShifted: false,
          isLandscapeScan: false,
        })
        i++
      } else {
        // Pair two portrait pages together
        items.push({
          primaryIndex: i,
          secondaryIndex: i + 1,
          isShifted: false,
          isLandscapeScan: false,
        })
        i += 2
      }
    } else {
      // Last remaining page solo
      items.push({
        primaryIndex: i,
        secondaryIndex: null,
        isShifted: false,
        isLandscapeScan: false,
      })
      i++
    }
  }

  return items
}

/**
 * Finds the index in `spreads` containing the specified 0-based `pageIndex`.
 */
export function findSpreadIndexForPage(
  spreads: SpreadPageItem[],
  pageIndex: number
): number {
  if (!spreads.length) return 0
  const foundIndex = spreads.findIndex(
    s => s.primaryIndex === pageIndex || s.secondaryIndex === pageIndex
  )
  return foundIndex >= 0 ? foundIndex : 0
}

/**
 * Resolves left and right display order for a spread item based on reading direction
 * and inversion preference.
 *
 * In LTR reading mode:
 * - primary page on left, secondary page on right.
 *
 * In RTL reading mode (Japanese Manga reading order):
 * - primary page on right, secondary page on left.
 *
 * If `invertDoublePages` is true, the order is flipped.
 */
export function getSpreadDisplayOrder(
  spread: SpreadPageItem,
  readingMode: 'ltr' | 'rtl' = 'ltr',
  invertDoublePages = false
): { leftIndex: number | null; rightIndex: number | null } {
  if (spread.secondaryIndex === null) {
    return {
      leftIndex: spread.primaryIndex,
      rightIndex: null,
    }
  }

  const isLtr = (readingMode !== 'rtl') !== invertDoublePages

  if (isLtr) {
    return {
      leftIndex: spread.primaryIndex,
      rightIndex: spread.secondaryIndex,
    }
  } else {
    return {
      leftIndex: spread.secondaryIndex,
      rightIndex: spread.primaryIndex,
    }
  }
}

/**
 * Returns whether a center margin (spine gutter) applies based on centerMarginType.
 */
export function hasCenterMargin(
  type: CenterMarginType,
  isSpread: boolean,
  isLandscapeScan: boolean
): boolean {
  switch (type) {
    case 'double':
      return isSpread
    case 'wide':
      return isLandscapeScan
    case 'double_and_wide':
      return isSpread || isLandscapeScan
    case 'none':
    default:
      return false
  }
}

/**
 * Computes the center margin gap in pixels.
 */
export function getCenterMarginGap(
  type: CenterMarginType,
  isSpread: boolean,
  isLandscapeScan: boolean,
  defaultGapPx = 8
): number {
  return hasCenterMargin(type, isSpread, isLandscapeScan) ? defaultGapPx : 0
}

/**
 * Returns how many pages this spread spans (1 or 2).
 */
export function getSpreadPageStep(spread: SpreadPageItem): number {
  return spread.secondaryIndex !== null ? 2 : 1
}
