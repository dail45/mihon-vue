import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/settings/views/SettingsBrowseView.vue', 'utf8')

/**
 * Guards for the parity of `src/features/settings/views/SettingsBrowseView.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsBrowseScreen.kt
 * (Mihon 446f6df) and the preference widgets it renders:
 *   - widget/PreferenceGroupHeader.kt    → group header, bodyMedium, secondary colour, 14dp/8dp
 *   - widget/BasePreferenceWidget.kt     → 56dp row, titleLarge at 16sp
 *   - widget/TextPreferenceWidget.kt     → bodySmall subtitle at 78% alpha
 *   - widget/SwitchPreferenceWidget.kt   → trailing MD3 switch
 *   - widget/MultiSelectListPreferenceWidget.kt → AlertDialog with LabeledCheckbox rows
 *   - widget/InfoWidget.kt               → info icon + bodySmall text
 */
describe('SettingsBrowseScreen parity with Mihon', () => {
  it('keeps the reference order of the preference groups and rows', () => {
    const order = [
      'Sources',
      'Hide entries already in library',
      'Extension stores',
      'Extensions',
      'Allowed content warnings',
      'Also apply to installed extensions',
      'When off, extensions you already installed keep loading and updating regardless of their warning',
    ]
    const template = source.slice(source.indexOf('<template>'))
    let cursor = -1
    for (const text of order) {
      const index = template.indexOf(text)
      expect(index, `missing reference text: ${text}`).toBeGreaterThan(-1)
      expect(index, `wrong order for: ${text}`).toBeGreaterThan(cursor)
      cursor = index
    }
  })

  it('keeps the content warnings info text of the reference', () => {
    expect(source).toContain("Installed extensions that aren't loaded stay listed without their sources")
    expect(source).toContain('This does not prevent unofficial or potentially incorrectly flagged extensions from surfacing 18+ content within the app.')
  })

  it('offers the three reference content warning entries', () => {
    const prefs = readFileSync('src/core/utils/browsePreferences.ts', 'utf8')
    expect(prefs).toContain("{ key: 'safe', title: 'Safe' }")
    expect(prefs).toContain("{ key: 'mixed', title: 'Mixed' }")
    expect(prefs).toContain("{ key: 'nsfw', title: '18+' }")
  })

  it('keeps the reference widget metrics', () => {
    expect(source).toContain('min-height: 56px')
    expect(source).toContain('padding: 14px 16px 8px')
    expect(source).toContain('font-weight: 500')
    expect(source).toContain('height: 12px')
    expect(source).toContain('font-size: 12px')
    expect(source).toContain('opacity: .78')
    expect(source).toContain('border-radius: 8px')
    expect(source).toContain('min-height: 48px')
  })

  it('provides switch accessibility and interaction attributes', () => {
    expect(source).toContain('role="switch"')
    expect(source).toContain(':aria-checked="hideInLibraryItems"')
    expect(source).toContain(':aria-checked="applyContentWarningsToInstalled"')
    expect(source).toContain('tabindex="0"')
  })

  it('formats content warnings subtitle matching Mihon subtitleProvider', async () => {
    const { contentWarningsSubtitle } = await import('../../src/utils/browsePreferences')
    expect(contentWarningsSubtitle(['safe', 'mixed', 'nsfw'])).toBe('Safe, Mixed, 18+')
    expect(contentWarningsSubtitle(['safe'])).toBe('Safe')
    expect(contentWarningsSubtitle(['mixed', 'nsfw'])).toBe('Mixed, 18+')
    expect(contentWarningsSubtitle([])).toBe('None')
  })
})

