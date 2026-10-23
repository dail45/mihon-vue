import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/settings/SettingsDownloadScreen.vue', 'utf8')

/**
 * Settings — Downloads (Mihon `SettingsDownloadScreen.kt`, pinned commit 446f6df).
 *
 * The assertions below follow the reference file item by item: the four plain items in front of
 * the groups, the three group titles, the entry lists of the two ListPreferences and the
 * InfoPreference text.
 */
describe('SettingsDownloadScreen matches the Mihon reference', () => {
  it('keeps the reference order of the four plain preference items', () => {
    const order = ['Only on Wi-Fi', 'Save as CBZ archive', 'Concurrent source downloads', 'Concurrent page downloads']
    const positions = order.map(title => source.indexOf(`>${title}<`))
    expect(positions.every(position => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('renders the three reference group headers', () => {
    const headers = [...source.matchAll(/pref-group-header">([^<]+)</g)].map(match => match[1])
    expect(headers).toEqual(['Delete chapters', 'Auto-download', 'Download ahead'])
  })

  it('keeps the reference items of the Delete chapters group', () => {
    for (const title of ['After manually marked as read', 'After reading automatically delete', 'Allow deleting bookmarked chapters', 'Excluded categories']) {
      expect(source).toContain(`>${title}<`)
    }
  })

  it('keeps the reference entries of "After reading automatically delete"', () => {
    for (const title of ['Disabled', 'Last read chapter', 'Second to last read chapter', 'Third to last read chapter', 'Fourth to last read chapter', 'Fifth to last read chapter']) {
      expect(source).toContain(`title: '${title}'`)
    }
  })

  it('keeps the reference entries of "Auto download while reading"', () => {
    for (const title of ['Disabled', 'Next 2 unread chapters', 'Next 3 unread chapters', 'Next 5 unread chapters', 'Next 10 unread chapters']) {
      expect(source).toContain(`title: '${title}'`)
    }
  })

  it('keeps the reference items of the Auto-download group', () => {
    expect(source).toContain('>Download new chapters<')
    expect(source).toContain('>Skip downloading duplicate read chapters<')
    expect(source).toContain('>Categories<')
    expect(source).toContain('Entries in excluded categories will not be downloaded even if they are also in included categories.')
  })

  it('shows the two dependent rows only while "Download new chapters" is enabled', () => {
    expect(source).toContain('v-if="downloadNewChapters"')
  })

  it('keeps the reference InfoPreference text', () => {
    expect(source).toContain('Only works if the current chapter + the next one are already downloaded.')
  })

  it('keeps the reference slider ranges and subtitles', () => {
    expect(source).toContain(':min="1"')
    expect(source).toContain(':max="10"')
    expect(source).toContain(':max="15"')
    expect(source).toContain('Pages downloaded simultaneously per source')
  })

  it('keeps the reference MD3 metrics of the preference widgets', () => {
    expect(source).toMatch(/pref-group-header\s*\{[^}]*padding:\s*14px 16px 8px/)
    expect(source).toMatch(/pref-group-spacer\s*\{\s*height:\s*12px/)
    expect(source).toMatch(/pref-row\s*\{[^}]*min-height:\s*56px/)
    expect(source).toMatch(/pref-pill\s*\{[^}]*border-radius:\s*32px/)
    expect(source).toMatch(/pref-info\s*\{[^}]*padding:\s*16px/)
  })
})
