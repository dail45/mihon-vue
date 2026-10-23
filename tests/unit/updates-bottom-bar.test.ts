import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { updatesBottomActionFlags } from '../../src/utils/updatesBottomActions'

describe('UpdatesBottomBar action flags match the Mihon reference', () => {
  const chapter = (over: Partial<{ read: boolean; bookmarked: boolean; lastPageRead: number; downloaded: boolean }> = {}) => ({
    read: false, bookmarked: false, lastPageRead: 0, downloaded: false, ...over,
  })

  it('offers Bookmark while any selected chapter is not bookmarked', () => {
    expect(updatesBottomActionFlags([chapter({ bookmarked: true }), chapter({ bookmarked: false })]).canBookmark).toBe(true)
    expect(updatesBottomActionFlags([chapter({ bookmarked: true })]).canBookmark).toBe(false)
  })

  it('offers Unbookmark only when every selected chapter is bookmarked', () => {
    expect(updatesBottomActionFlags([chapter({ bookmarked: true }), chapter({ bookmarked: true })]).canRemoveBookmark).toBe(true)
    expect(updatesBottomActionFlags([chapter({ bookmarked: true }), chapter({ bookmarked: false })]).canRemoveBookmark).toBe(false)
    expect(updatesBottomActionFlags([]).canRemoveBookmark).toBe(false)
  })

  it('offers Mark as read while any chapter is unread', () => {
    expect(updatesBottomActionFlags([chapter({ read: true }), chapter({ read: false })]).canMarkAsRead).toBe(true)
    expect(updatesBottomActionFlags([chapter({ read: true })]).canMarkAsRead).toBe(false)
  })

  it('offers Mark as unread for read or partially read chapters', () => {
    expect(updatesBottomActionFlags([chapter({ read: true })]).canMarkAsUnread).toBe(true)
    expect(updatesBottomActionFlags([chapter({ lastPageRead: 3 })]).canMarkAsUnread).toBe(true)
    expect(updatesBottomActionFlags([chapter()]).canMarkAsUnread).toBe(false)
  })

  it('separates Download and Delete by the downloaded state', () => {
    expect(updatesBottomActionFlags([chapter({ downloaded: true })]).canDownload).toBe(false)
    expect(updatesBottomActionFlags([chapter({ downloaded: true })]).canDelete).toBe(true)
    expect(updatesBottomActionFlags([chapter()]).canDownload).toBe(true)
    expect(updatesBottomActionFlags([chapter()]).canDelete).toBe(false)
  })
})

describe('UpdatesBottomBar matches the Mihon reference', () => {
  const source = readFileSync('src/components/UpdatesBottomBar.vue', 'utf8')

  it('shows the bar only while something is selected', () => {
    expect(source).toMatch(/props\.visible \?\? selected\.value\.length > 0/)
  })

  it('uses the MD3 surface, shape and row padding of MangaBottomActionMenu', () => {
    expect(source).toMatch(/border-radius:\s*16px 16px 0 0/)
    expect(source).toMatch(/background:\s*rgb\(var\(--v-theme-surface-container-high\)\)/)
    expect(source).toMatch(/padding:\s*12px 8px calc\(12px \+ env\(safe-area-inset-bottom, 0px\)\)/)
  })

  it('keeps the 48dp button, the weight animation and the unbounded ripple', () => {
    expect(source).toMatch(/height:\s*48px/)
    expect(source).toMatch(/\.updates-action\.is-confirming\s*\{[^}]*flex-grow:\s*2/)
    expect(source).toMatch(/opacity:\s*0\.12/)
  })

  it('types the long-press label as labelSmall and lets it overflow', () => {
    expect(source).toMatch(/font-size:\s*11px/)
    expect(source).toMatch(/font-weight:\s*500/)
    expect(source).toMatch(/letter-spacing:\s*0\.5px/)
    expect(source).toMatch(/white-space:\s*nowrap/)
  })

  it('clears the selection after every bulk action, like toggleAllSelection(false)', () => {
    expect(source).toMatch(/emit\('clear-selection'\)/)
  })

  it('queues the download through the Suwayomi GraphQL download queue', () => {
    expect(source).toMatch(/enqueueChapterDownload\(props\.apiUrl, entry\.chapter\.id\)/)
  })

  it('hides the app navigation bar while the selection bar is active', () => {
    expect(source).toMatch(/showBottomNav\(!value\)/)
  })
})
