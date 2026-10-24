import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { mangaBottomActionFlags } from '../../src/utils/mangaBottomActions'

const source = readFileSync('src/features/manga/components/MangaBottomActionMenu.vue', 'utf8')

const chapter = (over: Partial<{ read: boolean, bookmarked: boolean, lastPageRead: number, downloaded: boolean }> = {}) =>
  ({ read: false, bookmarked: false, lastPageRead: 0, downloaded: false, ...over })

describe('mangaBottomActionFlags mirrors the reference takeIf guards', () => {
  it('offers the bookmark action only when a chapter is not bookmarked', () => {
    expect(mangaBottomActionFlags([chapter()]).canBookmark).toBe(true)
    expect(mangaBottomActionFlags([chapter({ bookmarked: true })]).canBookmark).toBe(false)
    expect(mangaBottomActionFlags([chapter({ bookmarked: true }), chapter()]).canBookmark).toBe(true)
  })

  it('offers the remove-bookmark action only when every chapter is bookmarked', () => {
    expect(mangaBottomActionFlags([chapter({ bookmarked: true })]).canRemoveBookmark).toBe(true)
    expect(mangaBottomActionFlags([chapter({ bookmarked: true }), chapter()]).canRemoveBookmark).toBe(false)
    expect(mangaBottomActionFlags([]).canRemoveBookmark).toBe(false)
  })

  it('offers mark-as-read only for unread chapters and mark-as-unread for read ones', () => {
    expect(mangaBottomActionFlags([chapter()]).canMarkAsRead).toBe(true)
    expect(mangaBottomActionFlags([chapter({ read: true })]).canMarkAsRead).toBe(false)
    expect(mangaBottomActionFlags([chapter({ read: true })]).canMarkAsUnread).toBe(true)
    expect(mangaBottomActionFlags([chapter({ lastPageRead: 3 })]).canMarkAsUnread).toBe(true)
    expect(mangaBottomActionFlags([chapter()]).canMarkAsUnread).toBe(false)
  })

  it('offers mark-previous-as-read only for a single selection', () => {
    expect(mangaBottomActionFlags([chapter()]).canMarkPreviousAsRead).toBe(true)
    expect(mangaBottomActionFlags([chapter(), chapter()]).canMarkPreviousAsRead).toBe(false)
  })

  it('offers download for not downloaded chapters and delete for downloaded ones', () => {
    expect(mangaBottomActionFlags([chapter()]).canDownload).toBe(true)
    expect(mangaBottomActionFlags([chapter({ downloaded: true })]).canDownload).toBe(false)
    expect(mangaBottomActionFlags([chapter({ downloaded: true })]).canDelete).toBe(true)
    expect(mangaBottomActionFlags([chapter()]).canDelete).toBe(false)
  })
})

describe('MangaBottomActionMenu matches the Mihon reference', () => {
  it('uses the reference surface, shape and row padding', () => {
    expect(source).toMatch(/border-radius:\s*16px 16px 0 0/)
    expect(source).toMatch(/padding:\s*12px 8px calc\(12px \+ env\(safe-area-inset-bottom/)
    expect(source).toMatch(/height:\s*48px/)
  })

  it('uses the reference label typography and the confirming weight of two', () => {
    expect(source).toMatch(/font-size:\s*11px/)
    expect(source).toMatch(/line-height:\s*16px/)
    expect(source).toMatch(/letter-spacing:\s*0\.5px/)
    expect(source).toMatch(/\.manga-action\.is-confirming\s*\{\s*flex-grow:\s*2/)
  })

  it('renders the reference action titles in the reference order', () => {
    const order = ['Bookmark chapter', 'Unbookmark chapter', 'Mark as read', 'Mark as unread', 'Mark previous as read', 'Download', 'Delete']
    const positions = order.map(title => source.indexOf(`'${title}'`))
    expect(positions.every(position => position > 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('renders the library menu with the set-categories, migrate and overflow buttons', () => {
    expect(source).toContain("'Set categories'")
    expect(source).toContain("'Migrate'")
    expect(source).toContain("'More'")
    expect(source).toContain("'swap_calls'")
    expect(source).toContain("'more_vert'")
  })

  it('shows the download dropdown entries of the reference', () => {
    expect(source).toContain("'Next chapter'")
    expect(source).toContain("'Next 5 chapters'")
    expect(source).toContain("'Next 25 chapters'")
    expect(source).toContain("'Unread'")
    expect(source).toContain("'Bookmarked'")
  })

  it('constrains the dropdown to the reference width and metrics', () => {
    expect(source).toMatch(/\.manga-action-menu\s*\{[^}]*width:\s*196px/)
    expect(source).toMatch(/\.manga-action-menu\s*\{[^}]*border-radius:\s*4px/)
    expect(source).toMatch(/\.manga-action-menu-item\s*\{[^}]*height:\s*48px/)
    expect(source).toMatch(/\.manga-action-menu-item\s*\{[^}]*padding:\s*0 12px/)
  })

  it('confirms on long press and resets after one second', () => {
    expect(source).toMatch(/const LONG_PRESS_MS = 500/)
    expect(source).toMatch(/const CONFIRM_RESET_MS = 1000/)
  })

  it('keeps the unsupported web actions visible with an honest notice', () => {
    expect(source).toContain('not supported in the web version')
    expect(source).toMatch(/stubAction/)
  })
})
