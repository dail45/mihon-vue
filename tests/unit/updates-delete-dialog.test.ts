import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('UpdatesDeleteDialog matches the Mihon reference', () => {
  const source = readFileSync('src/components/UpdatesDeleteDialog.vue', 'utf8')

  it('renders only the reference text (no title, no icon)', () => {
    expect(source).toContain('Are you sure you want to delete the selected chapters?')
    expect(source).toMatch(/>OK</)
    expect(source).toMatch(/>Cancel</)
    expect(source).not.toMatch(/<h2/)
  })

  it('uses the MD3 alert dialog geometry', () => {
    expect(source).toMatch(/padding:\s*24px/)
    expect(source).toMatch(/border-radius:\s*28px/)
    expect(source).toMatch(/min-width:\s*min\(280px/)
    expect(source).toMatch(/max-width:\s*min\(560px/)
    expect(source).toMatch(/font-size:\s*14px;\s*line-height:\s*20px/)
    expect(source).toMatch(/height:\s*40px/)
    expect(source).toMatch(/min-width:\s*58px/)
  })

  it('renders the confirm button right of the dismiss button', () => {
    expect(source).toMatch(/\.updates-delete-actions\s*\{[^}]*flex-direction:\s*row-reverse/)
  })

  it('dismisses the dialog right after the confirm handler, like the reference', () => {
    expect(source).toMatch(/deleteChapterDownload[\s\S]{0,600}open\.value = false/)
  })

  it('skips bookmarked chapters, like DownloadManager.getChaptersToDelete', () => {
    expect(source).toMatch(/entry\.chapter\.downloaded && !entry\.chapter\.bookmarked/)
  })

  it('reports failures with the reference internal_error wording', () => {
    expect(source).toContain('InternalError: Check crash logs for further information')
  })
})
