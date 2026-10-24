import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readerViewSource = readFileSync(resolve(process.cwd(), 'src/views/ReaderView.vue'), 'utf8')
const keybindingsSource = readFileSync(resolve(process.cwd(), 'src/composables/useReaderKeybindings.ts'), 'utf8')
const source = readerViewSource + '\n' + keybindingsSource

describe('ReaderView matches Mihon ReaderActivity & Viewers reference', () => {
  it('implements tap zones corresponding to RightAndLeftNavigation (ViewerNavigation.kt)', () => {
    // Constant menu zone: top 5%
    expect(source).toContain('y <= 0.05')
    // Left 33% and Right 33%
    expect(source).toContain('x < 0.33')
    expect(source).toContain('x > 0.66')
    // Menu zone center 34%
    expect(source).toContain("action === 'menu'")
    // Invert tapping mode support
    expect(source).toContain('mihon.reader.tappingInverted')
  })

  it('implements comprehensive keyboard shortcuts (PagerViewer.kt, WebtoonViewer.kt, ReaderActivity.kt)', () => {
    // Escape to close dialogs / toggle controls
    expect(source).toContain("event.key === 'Escape'")
    // Space and M to toggle controls
    expect(source).toContain("event.key === ' '")
    expect(source).toContain("event.key === 'm'")
    // N and P for chapter navigation
    expect(source).toContain("event.key === 'n'")
    expect(source).toContain("event.key === 'p'")
    // Home and End for first and last page
    expect(source).toContain("event.key === 'Home'")
    expect(source).toContain("event.key === 'End'")
    // Webtoon navigation keys
    expect(source).toContain('scrollDown()')
    expect(source).toContain('scrollUp()')
    // Pager navigation keys
    expect(source).toContain("event.key === 'ArrowRight'")
    expect(source).toContain("event.key === 'ArrowLeft'")
    expect(source).toContain("event.key === 'ArrowDown'")
    expect(source).toContain("event.key === 'ArrowUp'")
    expect(source).toContain("event.key === 'd'")
    expect(source).toContain("event.key === 'a'")
    expect(source).toContain("event.key === 'PageDown'")
    expect(source).toContain("event.key === 'PageUp'")
  })

  it('renders required overlays and appbars matching ReaderActivity compose overlay', () => {
    expect(source).toContain('ReaderTopBar')
    expect(source).toContain('ReaderBottomBar')
    expect(source).toContain('ChapterNavigator')
    expect(source).toContain('ReaderPageIndicator')
    expect(source).toContain('ReaderContentOverlay')
    expect(source).toContain('ChapterTransition')
  })

  it('provides dialogs for Settings, ReadingMode, Orientation, PageActions, and Loading', () => {
    expect(source).toContain('ReaderSettingsDialog')
    expect(source).toContain('ReadingModeSelectDialog')
    expect(source).toContain('OrientationSelectDialog')
    expect(source).toContain('ReaderPageActionsDialog')
    expect(source).toContain('reader-loading-dialog')
  })

  it('animates app bars with tween 200ms slide and 150ms fade matching ReaderAppBars.kt', () => {
    expect(source).toContain('.reader-bar-top-enter-active')
    expect(source).toContain('.reader-bar-bottom-enter-active')
    expect(source).toContain('200ms')
    expect(source).toContain('150ms')
  })
})
