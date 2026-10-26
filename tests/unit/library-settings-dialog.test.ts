import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import {
  librarySortOptions,
  sortLibrary,
} from '../../src/utils/library'

const sheetSource = readFileSync('src/features/library/components/LibrarySettingsSheet.vue', 'utf8')
const displaySource = readFileSync('src/features/library/components/LibraryDisplaySettings.vue', 'utf8')
const tristateSource = readFileSync('src/features/settings/components/TriStateRow.vue', 'utf8')
const checkboxSource = readFileSync('src/features/settings/components/PreferenceCheckbox.vue', 'utf8')
const mainScssSource = readFileSync('src/styles/main.scss', 'utf8')

describe('LibrarySettingsDialog (item 10) - Pixel Parity with Mihon', () => {
  beforeEach(() => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => { data.set(k, v) },
    })
    setActivePinia(createPinia())
  })

  describe('Adaptive Sheet & TabbedDialog layout', () => {
    it('uses flat-tabs to eliminate the tab underline per TabbedDialog.kt PrimaryTabRow', () => {
      expect(sheetSource).toContain('flat-tabs')
      expect(sheetSource).toMatch(/:tabs="tabs"|:tabs="\['Filter', 'Sort', 'Display', 'Group'\]"/)
    })

    it('uses 28dp CornerExtraLarge border radius for sheet container', () => {
      expect(mainScssSource).toContain('.adaptive-settings-card { max-height: 85dvh; border-radius: 28px; }')
      expect(mainScssSource).toContain('border-top-left-radius: 28px !important')
    })

    it('implements touch gesture navigation between dialog tabs', () => {
      expect(sheetSource).toContain('@touchstart="onTouchStart"')
      expect(sheetSource).toContain('@touchend="onTouchEnd"')
      expect(sheetSource).toContain("const tabs = ['filter', 'sort', 'display', 'group']")
    })

    it('does not display unauthentic settings-note paragraphs in the sheet', () => {
      expect(sheetSource).not.toContain('class="settings-note"')
    })
  })

  describe('FilterPage (LibrarySettingsDialog.kt:76-154)', () => {
    it('renders all 5 standard tri-state filters in the reference order', () => {
      const standardFilters = [
        'label_downloaded',
        'action_filter_unread',
        'label_started',
        'action_filter_bookmarked',
        'completed',
      ]
      let lastIndex = -1
      for (const filter of standardFilters) {
        const index = sheetSource.indexOf(filter)
        expect(index).toBeGreaterThan(lastIndex)
        lastIndex = index
      }
    })

    it('locks Downloaded filter when downloadedOnly is true', () => {
      expect(sheetSource).toContain(':disabled="prefs.downloadedOnly"')
    })

    it('supports single and multiple logged-in tracker filters', () => {
      expect(sheetSource).toContain('v-if="loggedInTrackers.length === 1"')
      expect(sheetSource).toContain('action_filter_tracked')
      expect(sheetSource).toContain('v-else-if="loggedInTrackers.length > 1"')
      expect(sheetSource).toContain(':label="service.name"')
    })
  })

  describe('SortPage (LibrarySettingsDialog.kt:156-218)', () => {
    it('provides all 9 sort options matching Mihon in exact order', () => {
      expect(librarySortOptions.map(o => o.label)).toEqual([
        'Alphabetically',
        'Total chapters',
        'Last read',
        'Last update check',
        'Unread count',
        'Latest chapter',
        'Chapter fetch date',
        'Date added',
        'Random',
      ])
    })

    it('dynamically inserts Tracker score before Random when trackers are logged in', () => {
      expect(sheetSource).toContain("value: 'trackerScore'")
    })

    it('renders Random sort with refresh icon when selected and no arrow', () => {
      expect(sheetSource).toContain("option.value === 'random' ? 'refresh' : sort.descending ? 'arrow_downward' : 'arrow_upward'")
    })

    it('sorts by lastUpdate check correctly using timestamps', () => {
      const items = [
        { id: 1, title: 'Beta', lastFetchedAt: 200 } as any,
        { id: 2, title: 'Alpha', lastFetchedAt: 500 } as any,
        { id: 3, title: 'Gamma', lastFetchedAt: 100 } as any,
      ]
      const asc = sortLibrary(items, { type: 'lastUpdate', descending: false, seed: 0 })
      expect(asc.map(m => m.id)).toEqual([3, 1, 2])
      const desc = sortLibrary(items, { type: 'lastUpdate', descending: true, seed: 0 })
      expect(desc.map(m => m.id)).toEqual([2, 1, 3])
    })

    it('sorts by trackerScore correctly using mean score', () => {
      const items = [
        { id: 1, title: 'Beta', trackers: [{ record: { score: 7 } }] } as any,
        { id: 2, title: 'Alpha', trackers: [{ record: { score: 9 } }, { record: { score: 10 } }] } as any, // mean 9.5
        { id: 3, title: 'Gamma', trackers: [{ record: { score: 4 } }] } as any,
      ]
      const asc = sortLibrary(items, { type: 'trackerScore', descending: false, seed: 0 })
      expect(asc.map(m => m.id)).toEqual([3, 1, 2])
      const desc = sortLibrary(items, { type: 'trackerScore', descending: true, seed: 0 })
      expect(desc.map(m => m.id)).toEqual([2, 1, 3])
    })
  })

  describe('DisplayPage (LibrarySettingsDialog.kt:227-298)', () => {
    it('renders display modes in a SettingsChipRow', () => {
      expect(displaySource).toContain("'compact'")
      expect(displaySource).toContain("'comfortable'")
      expect(displaySource).toContain("'covers'")
      expect(displaySource).toContain("'list'")
      expect(displaySource).toMatch(/\.display-mode-chip \{[^}]*height: 32px;/s)
      expect(displaySource).toMatch(/\.display-mode-chip \{[^}]*border-radius: 8px;/s)
      expect(displaySource).toMatch(/\.display-mode-chip \{[^}]*padding: 0 16px;/s)
      expect(displaySource).toMatch(/\.display-mode-chip \{[^}]*font-size: 14px;/s)
      expect(displaySource).toMatch(/\.display-mode-chip \{[^}]*font-weight: 500;/s)
    })

    it('renders SliderItem with M3 Pill for items per row when mode is not list', () => {
      expect(displaySource).toContain("v-if=\"prefs.libraryDisplay !== 'list'\"")
      expect(displaySource).toContain('class="columns-pill"')
      expect(displaySource).toMatch(/\.columns-pill \{[^}]*border-radius: 28px;/s)
      expect(displaySource).toMatch(/\.columns-pill \{[^}]*padding: 1px 6px;/s)
      expect(displaySource).toMatch(/\.columns-pill \{[^}]*background: rgb\(var\(--v-theme-surface-container-highest\)\);/s)
    })

    it('renders all Overlay and Tabs checkboxes with exact strings', () => {
      const expectedCheckboxes = [
        'Downloaded chapters',
        'Unread chapters',
        'Local source',
        'Language',
        'Continue reading button',
        'Show category tabs',
        'Show number of items',
      ]
      for (const cb of expectedCheckboxes) {
        expect(displaySource).toContain(cb)
      }
    })
  })

  describe('Component tokens parity (SettingsItems.kt)', () => {
    it('TriStateRow matches SettingsItems.kt TriStateItem metrics', () => {
      expect(tristateSource).toMatch(/\.tristate-item \{[^}]*min-height: 44px;/s)
      expect(tristateSource).toMatch(/\.tristate-item \{[^}]*padding: 10px 24px;/s)
      expect(tristateSource).toMatch(/\.tristate-item \{[^}]*gap: 24px;/s)
      expect(tristateSource).toMatch(/\.settings-icon-slot \{[^}]*width: 24px;/s)
      expect(tristateSource).toMatch(/\.settings-row-label \{[^}]*font-size: 14px;/s)
      expect(tristateSource).toMatch(/\.settings-row-label \{[^}]*line-height: 20px;/s)
      expect(tristateSource).toMatch(/\.tristate-item--disabled \{[^}]*opacity: 0.38;/s)
    })

    it('PreferenceCheckbox matches SettingsItems.kt CheckboxItem metrics', () => {
      expect(checkboxSource).toMatch(/\.checkbox-item \{[^}]*min-height: 44px;/s)
      expect(checkboxSource).toMatch(/\.checkbox-item \{[^}]*padding: 10px 24px;/s)
      expect(checkboxSource).toMatch(/\.checkbox-item \{[^}]*gap: 24px;/s)
      expect(checkboxSource).toMatch(/\.m3-checkbox \{[^}]*width: 18px;/s)
      expect(checkboxSource).toMatch(/\.m3-checkbox \{[^}]*height: 18px;/s)
      expect(checkboxSource).toMatch(/\.m3-checkbox \{[^}]*border-radius: 2px;/s)
      expect(checkboxSource).toMatch(/\.m3-checkbox--checked \{[^}]*background: rgb\(var\(--v-theme-primary\)\);/s)
    })

    it('HeadingItem matches Typography.header = bodyMedium SemiBold onSurfaceVariant', () => {
      expect(displaySource).toMatch(/\.settings-heading \{[^}]*font-size: 14px;/s)
      expect(displaySource).toMatch(/\.settings-heading \{[^}]*line-height: 20px;/s)
      expect(displaySource).toMatch(/\.settings-heading \{[^}]*font-weight: 600;/s)
      expect(displaySource).toMatch(/\.settings-heading \{[^}]*color: rgb\(var\(--v-theme-on-surface-variant\)\);/s)
      expect(displaySource).toMatch(/\.settings-heading \{[^}]*padding: 10px 24px;/s)
    })
  })
})
