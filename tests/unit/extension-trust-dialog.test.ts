import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/ExtensionTrustDialog.vue', 'utf8')

/**
 * Pixel-parity guardrails for Mihon's `ExtensionTrustDialog`
 * (mihon/app/src/main/java/eu/kanade/presentation/browse/ExtensionsScreen.kt, lines 623-648).
 *
 * The unit test environment has no Vue SFC plugin, so the checks read the component source.
 */
describe('ExtensionTrustDialog parity with the Mihon reference', () => {
  it('renders the reference title, message and both action labels', () => {
    expect(source).toContain('Untrusted extension')
    expect(source).toContain('Malicious extensions can read any stored login credentials or execute arbitrary code.')
    expect(source).toContain('By trusting this extension, you accept these risks.')
    expect(source).toContain('Trust')
    expect(source).toContain('Uninstall')
  })

  it('uses the MD3 alert dialog geometry (28dp shape, 24dp padding, 280/560dp width)', () => {
    expect(source).toMatch(/min-width:\s*min\(280px/)
    expect(source).toMatch(/max-width:\s*min\(560px/)
    expect(source).toMatch(/rounded="28px"/)
    expect(source).toMatch(/padding:\s*24px/)
    expect(source).toMatch(/box-shadow:\s*none/)
  })

  it('uses the reference typography (headlineSmall title, bodyMedium supporting text)', () => {
    expect(source).toMatch(/font-size:\s*24px;\s*line-height:\s*32px/)
    expect(source).toMatch(/font-size:\s*14px;\s*line-height:\s*20px/)
  })

  it('spaces the text slot by 8dp and keeps the 24dp text padding', () => {
    expect(source).toMatch(/ext-trust-content[^}]*gap:\s*8px/)
    expect(source).toMatch(/ext-trust-content[^}]*margin-bottom:\s*24px/)
  })

  it('keeps the confirm button right of the dismiss button', () => {
    expect(source).toMatch(/ext-trust-actions[^}]*row-reverse/)
  })

  it('reports the unavailable Android package-manager action instead of hiding it', () => {
    expect(source).toContain('not supported in the web version')
    expect(source).toContain("emit('trust')")
    expect(source).toContain("emit('uninstall')")
  })
})
