import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = [
  readFileSync(resolve(process.cwd(), 'src/features/manga/views/MangaView.vue'), 'utf8'),
  readFileSync(resolve(process.cwd(), 'src/features/manga/components/MangaToolbar.vue'), 'utf8'),
].join('\n')

describe('MangaToolbar (MangaToolbar.kt & AppBar.kt) parity in MangaView.vue', () => {
  describe('TopAppBar container & geometry', () => {
    it('sets 64dp TopAppBar height and surfaceContainer background (surfaceColorAtElevation(3.dp))', () => {
      expect(source).toContain('height: 64px')
      expect(source).toContain('surface-container')
      expect(source).toContain('class="manga-toolbar"')
    })

    it('implements scroll-driven alpha transitions for title and background', () => {
      // In large layout or action mode: always 1f. In small mode: fade on scroll.
      expect(source).toContain('isActionMode.value || twoPane.value ? 1 :')
      expect(source).toContain('transition: opacity 0.2s ease-in-out')
    })
  })

  describe('Navigation button', () => {
    it('renders 48x48dp target with 40dp circular state layer (CornerFull)', () => {
      expect(source).toMatch(/\.manga-toolbar__nav,\s*\.manga-toolbar__icon\s*\{[^}]*width:\s*48px/)
      expect(source).toMatch(/\.manga-toolbar__nav,\s*\.manga-toolbar__icon\s*\{[^}]*height:\s*48px/)
      expect(source).toMatch(/\.manga-toolbar__nav::before,\s*\.manga-toolbar__icon::before\s*\{[^}]*width:\s*40px/)
      expect(source).toMatch(/\.manga-toolbar__nav::before,\s*\.manga-toolbar__icon::before\s*\{[^}]*height:\s*40px/)
      expect(source).toMatch(/\.manga-toolbar__nav::before,\s*\.manga-toolbar__icon::before\s*\{[^}]*border-radius:\s*50%/)
    })

    it('switches between Navigate up (arrow_back) and Cancel (close) based on action mode', () => {
      expect(source).toContain(":aria-label=\"isActionMode ? 'Cancel' : 'Navigate up'\"")
      expect(source).toContain("isActionMode ? 'close' : 'arrow_back'")
      expect(source).toContain("{{ isActionMode ? 'Cancel' : 'Navigate up' }}")
    })

    it('cancels selection on Escape key press and back navigation', () => {
      expect(source).toContain("e.key === 'Escape' && isActionMode.value")
      expect(source).toContain('cancelSelection()')
    })
  })

  describe('Title styling', () => {
    it('applies titleLarge typography (22sp / 28sp w400) and 56dp keyline', () => {
      expect(source).toMatch(/\.manga-toolbar__title\s*\{[^}]*font-size:\s*22px/)
      expect(source).toMatch(/\.manga-toolbar__title\s*\{[^}]*line-height:\s*28px/)
      expect(source).toMatch(/\.manga-toolbar__title\s*\{[^}]*font-weight:\s*400/)
      expect(source).toMatch(/\.manga-toolbar__title\s*\{[^}]*margin-inline-start:\s*4px/)
      expect(source).toMatch(/\.manga-toolbar__title\s*\{[^}]*text-overflow:\s*ellipsis/)
    })

    it('switches between title string and action counter in action mode', () => {
      expect(source).toContain('isActionMode ? selectedCount : detail.title')
    })
  })

  describe('Actions & Overflow Menu', () => {
    it('renders action mode actions: Select all and Invert selection', () => {
      expect(source).toContain('aria-label="Select all"')
      expect(source).toContain('aria-label="Invert selection"')
      expect(source).toContain('select_all')
      expect(source).toContain('flip_to_back')
    })

    it('renders download action with DownloadDropdownMenu when canDownload', () => {
      expect(source).toContain('v-if="canDownload"')
      expect(source).toContain('<DownloadDropdownMenu')
      expect(source).toContain('icon="download"')
    })

    it('tints filter button with ColorScheme.active when filters are active', () => {
      expect(source).toContain(':style="hasFilters ? { color: activeColor } : undefined"')
      expect(source).toContain("theme.current.value.dark ? 'rgb(255, 235, 59)' : 'rgb(255, 193, 7)'")
      expect(source).toContain('icon="filter_list"')
    })

    it('renders M3 DropdownMenu with fixed 196dp width and 4dp corner radius for overflow', () => {
      expect(source).toMatch(/\.manga-overflow-list\s*\{[^}]*width:\s*196px\s*!important/)
      expect(source).toMatch(/\.manga-overflow-list\s*\{[^}]*border-radius:\s*4px\s*!important/)
      expect(source).toMatch(/\.manga-overflow-list\s*\.v-list-item\s*\{[^}]*min-height:\s*48px\s*!important/)
      expect(source).toMatch(/\.manga-overflow-list\s*\.v-list-item\s*\{[^}]*padding:\s*0 12px\s*!important/)
    })

    it('renders overflow menu items in exact reference order with conditional visibility', () => {
      expect(source).toContain('title="Refresh"')
      expect(source).toContain('v-if="isInLibrary" title="Edit categories"')
      expect(source).toContain('v-if="isInLibrary" title="Migrate"')
      expect(source).toContain('v-if="canShare" title="Share"')
      expect(source).toContain('title="Notes"')
    })

    it('wraps toolbar actions in M3 PlainTooltip with inverseSurface styling', () => {
      expect(source).toMatch(/\.manga-toolbar__tooltip\s*\{[^}]*background:\s*rgb\(var\(--v-theme-inverse-surface\)\)/)
      expect(source).toMatch(/\.manga-toolbar__tooltip\s*\{[^}]*color:\s*rgb\(var\(--v-theme-inverse-on-surface\)\)/)
      expect(source).toMatch(/\.manga-toolbar__tooltip\s*\{[^}]*border-radius:\s*4px/)
      expect(source).toMatch(/\.manga-toolbar__tooltip\s*\{[^}]*font-size:\s*12px/)
    })
  })
})
