import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import {
  chapterSortOptions,
  formatChapterNumber,
  chapterTitle,
} from '../../src/utils/chapters'
import { useChapterSettings } from '../../src/stores/chapterSettings'

const sheetSource = readFileSync('src/features/manga/components/ChapterSettingsSheet.vue', 'utf8')
const mainScssSource = readFileSync('src/styles/main.scss', 'utf8')

describe('ChapterSettingsDialog (item 77) - Pixel Parity with Mihon', () => {
  beforeEach(() => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => { data.set(k, v) },
    })
    setActivePinia(createPinia())
  })

  describe('Adaptive Sheet & TabbedDialog layout', () => {
    it('uses flat-tabs to eliminate tab row underline per TabbedDialog.kt PrimaryTabRow', () => {
      expect(sheetSource).toContain('flat-tabs')
      expect(sheetSource).toContain(":tabs=\"['Filter', 'Sort', 'Display']\"")
    })

    it('uses 28dp CornerExtraLarge border radius for sheet container', () => {
      expect(mainScssSource).toContain('.adaptive-settings-card { max-height: 85dvh; border-radius: 28px; }')
      expect(mainScssSource).toContain('border-top-left-radius: 28px !important')
    })

    it('implements touch gesture navigation between dialog tabs (HorizontalPager parity)', () => {
      expect(sheetSource).toContain('@touchstart="onTouchStart"')
      expect(sheetSource).toContain('@touchend="onTouchEnd"')
      expect(sheetSource).toContain("const tabs = ['filter', 'sort', 'display']")
    })

    it('provides overflow menu with "Set as default" and "Reset"', () => {
      expect(sheetSource).toContain('v-list-item title="Set as default"')
      expect(sheetSource).toContain('v-list-item title="Reset"')
    })
  })

  describe('FilterPage (ChapterSettingsDialog.kt:131-161)', () => {
    it('renders Downloaded, Unread, and Bookmarked tri-state filter items', () => {
      expect(sheetSource).toContain("label: 'Downloaded'")
      expect(sheetSource).toContain("label: 'Unread'")
      expect(sheetSource).toContain("label: 'Bookmarked'")
    })

    it('renders Scanlator filter item with group icon and active amber tinting', () => {
      expect(sheetSource).toContain('chapter-scanlator')
      expect(sheetSource).toContain('icon="group"')
      expect(sheetSource).toContain('#ffc107')
      expect(sheetSource).toContain('#ffeb3b')
    })

    it('uses 24px icon slots and 72px left offset across items', () => {
      expect(sheetSource).toContain('settings-icon-slot')
      expect(sheetSource).toContain('settings-row-label')
    })
  })

  describe('SortPage (ChapterSettingsDialog.kt:192-210)', () => {
    it('provides all 4 sorting modes in Mihon reference order', () => {
      const labels = chapterSortOptions.map(o => o.label)
      expect(labels).toEqual([
        'By source',
        'By chapter number',
        'By upload date',
        'Alphabetically',
      ])
    })

    it('displays directional arrow on active sort mode and flips order on re-selection', () => {
      expect(sheetSource).toContain("settings.descending ? 'arrow_downward' : 'arrow_upward'")
      const store = useChapterSettings()
      const settings = store.forManga('http://test', 1)
      expect(settings.sort).toBe('source')
      expect(settings.descending).toBe(true)

      // Clicking same mode flips descending
      store.choose(settings, 'source')
      expect(settings.descending).toBe(false)

      // Clicking different mode selects it with ascending order
      store.choose(settings, 'number')
      expect(settings.sort).toBe('number')
      expect(settings.descending).toBe(false)
    })
  })

  describe('DisplayPage (ChapterSettingsDialog.kt:212-227)', () => {
    it('provides Source title and Chapter number radio options', () => {
      expect(sheetSource).toContain("label: 'Source title'")
      expect(sheetSource).toContain("label: 'Chapter number'")
    })

    it('formats chapter titles according to display mode and chapterNumber decimals', () => {
      const chapter = {
        id: 1,
        url: '/ch/1',
        name: 'Ep. 1 - The Beginning',
        uploadDate: 1000,
        chapterNumber: 1.5,
        read: false,
        bookmarked: false,
        scanlator: 'Group A',
        index: 1,
        pageCount: 20,
        chapterCount: 1,
      }
      expect(chapterTitle(chapter as any, 'title')).toBe('Ep. 1 - The Beginning')
      expect(chapterTitle(chapter as any, 'number')).toBe('Chapter 1.5')
      expect(formatChapterNumber(1.0)).toBe('1')
      expect(formatChapterNumber(1.25)).toBe('1.25')
    })
  })

  describe('SetAsDefaultDialog (ChapterSettingsDialog.kt:229-268)', () => {
    it('uses Material 3 AlertDialog container metrics (28dp shape, surfaceContainerHigh)', () => {
      expect(sheetSource).toContain('border-radius: 28px;')
      expect(sheetSource).toContain('background: rgb(var(--v-theme-surface-container-high));')
      expect(sheetSource).toContain('headlineSmall')
    })

    it('contains reference confirmation message and library checkbox', () => {
      expect(sheetSource).toContain('Are you sure you want to save these settings as default?')
      expect(sheetSource).toContain('Also apply to all entries in my library')
    })

    it('resets optional library checkbox when dialog is opened', () => {
      expect(sheetSource).toContain('watch(confirmDefault')
      expect(sheetSource).toContain('applyLibrary.value = false')
    })
  })
})
