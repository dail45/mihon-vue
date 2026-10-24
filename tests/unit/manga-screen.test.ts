import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = [
  readFileSync(resolve(process.cwd(), 'src/views/MangaView.vue'), 'utf8'),
  readFileSync(resolve(process.cwd(), 'src/components/MangaToolbar.vue'), 'utf8'),
  readFileSync(resolve(process.cwd(), 'src/components/MangaResumeFab.vue'), 'utf8'),
].join('\n')

describe('MangaScreen (MangaScreen.kt) pixel-parity in MangaView.vue', () => {
  describe('Adaptive layout (TwoPanelBox vs LazyColumn)', () => {
    it('implements TwoPanelBox for large screens with (width / 2).coerceAtMost(450.dp) startContent', () => {
      // TwoPanelBox.kt: firstWidth = (width / 2).coerceAtMost(450.dp), secondWidth = width - firstWidth
      expect(source).toContain('grid-template-columns: min(50%, 450px) minmax(0, 1fr)')
      expect(source).toContain('manga-body--two-pane')
      expect(source).toContain('manga-start-pane')
      expect(source).toContain('manga-end-pane')
    })

    it('enforces independent vertical scrolling for both start-pane and end-pane in two-pane mode', () => {
      expect(source).toMatch(/\.manga-body--two-pane\s*>\s*\.manga-start-pane\s*\{[^}]*overflow-y:\s*auto/)
      expect(source).toMatch(/\.manga-body--two-pane\s*>\s*\.manga-end-pane\s*\{[^}]*overflow-y:\s*auto/)
    })
  })

  describe('MangaToolbar & AppBar (MangaToolbar.kt & AppBar.kt)', () => {
    it('uses 64dp TopAppBar height and surfaceColorAtElevation(3.dp) background', () => {
      expect(source).toContain('height: 64px')
      expect(source).toContain('surface-container')
    })

    it('renders 48x48dp navigation button with Navigate up / Cancel tooltip and label', () => {
      expect(source).toMatch(/width:\s*48px/)
      expect(source).toMatch(/height:\s*48px/)
      expect(source).toContain(":aria-label=\"isActionMode ? 'Cancel' : 'Navigate up'\"")
      expect(source).toContain("isActionMode ? 'close' : 'arrow_back'")
    })

    it('applies titleLarge typography (22sp / 28sp w400) to toolbar title', () => {
      expect(source).toMatch(/font-size:\s*22px/)
      expect(source).toMatch(/line-height:\s*28px/)
      expect(source).toMatch(/font-weight:\s*400/)
    })

    it('implements titleAlphaProvider and backgroundAlphaProvider: always 1f on tablet, scroll-fade on phone', () => {
      // In MangaScreenLargeImpl:534-535, titleAlphaProvider = { 1f }, backgroundAlphaProvider = { 1f }
      expect(source).toContain('isActionMode.value || twoPane.value ? 1 :')
    })

    it('hides download action for local or stub sources', () => {
      // MangaScreen.kt: onDownloadActionClicked.takeIf { !source.isLocalOrStub() }
      expect(source).toContain('v-if="canDownload"')
    })

    it('conditionally displays overflow items matching Mihon takeIf rules', () => {
      // Edit categories and Migrate only when in library (successState.manga.favorite)
      // Share only for HttpSource (!isLocalSource)
      expect(source).toContain('v-if="isInLibrary" title="Edit categories"')
      expect(source).toContain('v-if="isInLibrary" title="Migrate"')
      expect(source).toContain('v-if="canShare" title="Share"')
      expect(source).toContain('title="Refresh"')
      expect(source).toContain('title="Notes"')
    })

    it('switches to action mode with counter title, Select all, and Invert selection', () => {
      expect(source).toContain('isActionMode ? selectedCount : detail.title')
      expect(source).toContain('aria-label="Select all"')
      expect(source).toContain('aria-label="Invert selection"')
      expect(source).toContain('select_all')
      expect(source).toContain('flip_to_back')
    })
  })

  describe('SmallExtendedFloatingActionButton parity', () => {
    it('sets 56dp height and 16dp CornerLarge shape tokens', () => {
      expect(source).toMatch(/height:\s*56px/)
      expect(source).toMatch(/border-radius:\s*16px/)
      expect(source).toContain('primary-container')
      expect(source).toContain('on-primary-container')
    })

    it('uses filled play_arrow icon and titleMedium typography', () => {
      expect(source).toContain("icon=\"play_arrow\"")
      expect(source).toContain("font-variation-settings: 'FILL' 1")
      expect(source).toMatch(/font-size:\s*16px/)
      expect(source).toMatch(/font-weight:\s*500/)
    })

    it('implements shouldExpandFAB() scroll-direction expansion logic', () => {
      expect(source).toContain('lastScrolledBackward || !canScrollForward || !canScrollBackward')
    })

    it('resolves continue reading target matching ChapterGetNextUnread.kt', () => {
      expect(source).toContain('if (chapterSettings.value.descending)')
      expect(source).toContain('chapters[i]!.read')
    })
  })

  describe('Bottom action menu (SharedMangaBottomActionMenu)', () => {
    it('applies fillFraction 0.5 and end alignment in two-pane mode', () => {
      // MangaScreenLargeImpl: fillFraction = 0.5f, wrapContentWidth(Alignment.End)
      expect(source).toContain(':fill-fraction="twoPane ? 0.5 : 1"')
      expect(source).toContain('manga-bottom-menu-wrapper--two-pane')
    })

    it('routes delete action to DeleteChaptersDialog confirmation', () => {
      expect(source).toContain('@delete="deleteChaptersOpen = true"')
      expect(source).toContain('<DeleteChaptersDialog')
    })
  })

  describe('Dialogs & States parity', () => {
    it('includes RemoveMangaDialog, ChangeCategoryDialog, SetIntervalDialog, and DuplicateMangaDialog', () => {
      expect(source).toContain('<RemoveMangaDialog')
      expect(source).toContain('<DeleteChaptersDialog')
      expect(source).toContain('<ChangeCategoryDialog')
      expect(source).toContain('<SetIntervalDialog')
      expect(source).toContain('<DuplicateMangaDialog')
      expect(source).toContain('<MangaCoverDialog')
      expect(source).toContain('<ChapterSettingsSheet')
      expect(source).toContain('<TrackInfoDialog')
    })

    it('renders centered LoadingScreen (M3 CircularProgressIndicator 40dp)', () => {
      expect(source).toContain('class="manga-loading"')
      expect(source).toContain('size="40"')
      expect(source).toContain('width="4"')
      expect(source).toContain('color="primary"')
    })

    it('renders MihonEmptyScreen with Retry action on load error', () => {
      expect(source).toContain('<MihonEmptyScreen')
      expect(source).toContain('class="manga-retry-btn"')
    })

    it('renders floating PullRefresh indicator matching Compose', () => {
      expect(source).toContain('class="manga-pull-indicator"')
      expect(source).toContain('v-progress-circular')
    })
  })
})
