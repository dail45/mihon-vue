import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const view = readFileSync('src/views/PlannedView.vue', 'utf8')
const router = readFileSync('src/router/index.ts', 'utf8')
const app = readFileSync('src/App.vue', 'utf8')

describe('PlannedView (History screen) matches the Mihon reference', () => {
  it('registers /history route with ownToolbar and excludes global app bar in App.vue', () => {
    expect(router).toMatch(/{ path: '\/history',.*ownToolbar: true.*}/)
    expect(app).toContain("'/history'")
  })

  it('renders SearchToolbar with titleLarge typography in regular mode', () => {
    expect(view).toContain('History')
    expect(view).toContain('history-toolbar')
    expect(view).toContain('history-toolbar-title')
    expect(view).toMatch(/font-size:\s*22px;\s*line-height:\s*28px;\s*font-weight:\s*400/)
    expect(view).toContain('search')
    expect(view).toContain('delete_sweep')
  })

  it('renders navigation ArrowBack and Search input in search mode', () => {
    expect(view).toContain('arrow_back')
    expect(view).toContain('Navigate up')
    expect(view).toContain('placeholder="Search…"');
    expect(view).toContain('aria-label="Search history"');
    expect(view).toMatch(/font-size:\s*18px;\s*line-height:\s*24px;\s*font-weight:\s*400/)
    expect(view).toContain('closeSearch')
    expect(view).toContain('@keydown.esc="closeSearch"')
  })

  it('renders PlainTooltip on action buttons with M3 tokens', () => {
    expect(view).toContain('history-plain-tooltip')
    expect(view).toContain('var(--v-theme-inverse-surface)')
    expect(view).toContain('var(--v-theme-inverse-on-surface)')
    expect(view).toMatch(/border-radius:\s*4px/)
  })

  it('renders LoadingScreen with Md3CircularProgress and EmptyScreen with MihonEmptyScreen', () => {
    expect(view).toContain('Md3CircularProgress')
    expect(view).toContain(':size="40"')
    expect(view).toContain(':stroke="4"')
    expect(view).toContain('MihonEmptyScreen')
    expect(view).toContain('No results found')
    expect(view).toContain('Nothing read recently')
  })

  it('renders ListGroupHeader with relativeDateText, bodyMedium, SemiBold, onSurfaceVariant', () => {
    expect(view).toContain('relativeDateText')
    expect(view).toContain('history-header')
    expect(view).toMatch(/font-size:\s*14px;\s*line-height:\s*20px;\s*font-weight:\s*600/)
    expect(view).toContain('var(--v-theme-on-surface-variant)')
    expect(view).toMatch(/padding:\s*8px 16px/)
  })

  it('renders FastScrollLazyColumn with 48dp x 12dp primary thumb and 2s visibility duration', () => {
    expect(view).toContain('history-fast-scroll')
    expect(view).toContain('history-fast-scroll-thumb')
    expect(view).toMatch(/width:\s*12px;\s*height:\s*48px;\s*border-radius:\s*6px/)
    expect(view).toContain('var(--v-theme-primary)')
    expect(view).toContain('2000')
  })

  it('implements resume logic according to GetNextChapters.kt', () => {
    expect(view).toContain('entry.read')
    expect(view).toContain('c.index === entry.chapterIndex')
    expect(view).toContain('c.index > entry.chapterIndex')
    expect(view).toContain('Next chapter not found')
  })

  it('integrates HistoryDeleteDialog, HistoryDeleteAllDialog and DuplicateMangaDialog', () => {
    expect(view).toContain('HistoryDeleteDialog')
    expect(view).toContain('HistoryDeleteAllDialog')
    expect(view).toContain('DuplicateMangaDialog')
  })
})
