import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/settings/views/SupportUsView.vue', 'utf8')

/**
 * Support us screen parity test.
 * References:
 *   - mihon/app/src/main/java/mihon/feature/support/SupportUsScreen.kt
 *   - mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt
 *   - mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/TextPreferenceWidget.kt
 *   - mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/BasePreferenceWidget.kt
 *   - tachiyomi/core/common/Constants.kt
 */
describe('SupportUsView matches Mihon Compose reference', () => {
  it('renders TopAppBar with navigateUp and title "Support Us"', () => {
    expect(source).toContain('aria-label="Navigate up"')
    expect(source).toContain('arrow_back')
    expect(source).toContain('Support Us')
  })

  it('renders the exact MR.strings text paragraphs', () => {
    // MR.strings.supportUsScreen.perks
    expect(source).toContain('Patrons get access to exclusive channels, with more perks to come.')
    // MR.strings.supportUsScreen.currentlySupportedBy (200)
    expect(source).toContain("Mihon is currently backed by 200+ patrons. We want to thank each and everyone of you. Let's make Mihon even better together.")
    // MR.strings.supportUsScreen.contactForDetailsMessage
    expect(source).toContain('For alternative options or any related questions, join our Discord server.')
  })

  it('renders support items for Patreon, OpenCollective, and Discord with exact constants', () => {
    // Patreon
    expect(source).toContain('Patreon (preferred)')
    expect(source).toContain('https://patreon.com/mihon/membership')

    // OpenCollective
    expect(source).toContain('OpenCollective')
    expect(source).toContain('https://opencollective.com/mihon/contribute')

    // Discord
    expect(source).toContain('Discord')
    expect(source).toContain('https://discord.gg/mihon')
  })

  it('renders external links with target="_blank" and rel="noopener noreferrer"', () => {
    expect(source).toContain('target="_blank"')
    expect(source).toContain('rel="noopener noreferrer"')
  })

  it('renders trailing open_in_new icon for cards', () => {
    expect(source).toContain('open_in_new')
  })

  it('uses M3 12dp card shape and 8dp spacedBy gap', () => {
    expect(source).toMatch(/gap:\s*8px/)
    expect(source).toMatch(/border-radius:\s*12px/)
  })

  it('uses 16dp horizontal insets for text paragraphs matching Column + Text padding in Compose', () => {
    expect(source).toMatch(/\.support-paragraph--inset\s*\{[^}]*padding:\s*0\s+16px/)
  })
})
