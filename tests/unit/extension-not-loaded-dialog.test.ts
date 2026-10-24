import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/browse/components/ExtensionNotLoadedDialog.vue', 'utf8')

/**
 * Pixel-parity guardrails for Mihon's `ExtensionNotLoadedDialog`
 * (mihon/app/src/main/java/eu/kanade/presentation/browse/ExtensionsScreen.kt, lines 572-621).
 *
 * The unit test environment has no Vue SFC plugin, so the checks read the component source.
 */
describe('ExtensionNotLoadedDialog parity with the Mihon reference', () => {
  it('renders the reference title and the copy action label', () => {
    expect(source).toContain('Couldn\'t load')
    expect(source).toContain('Copy stack trace')
  })

  it('uses the MD3 alert dialog geometry (28dp shape, 24dp padding, 280/560dp width)', () => {
    expect(source).toMatch(/min-width:\s*min\(280px/)
    expect(source).toMatch(/max-width:\s*min\(560px/)
    expect(source).toMatch(/rounded="28px"/)
    expect(source).toMatch(/padding:\s*24px/)
    expect(source).toMatch(/box-shadow:\s*none/)
  })

  it('uses the reference typography (headlineSmall title, bodyMedium text, bodySmall monospace)', () => {
    expect(source).toMatch(/font-size:\s*24px;\s*line-height:\s*32px/)
    expect(source).toMatch(/font-size:\s*14px;\s*line-height:\s*20px/)
    expect(source).toMatch(/font-size:\s*12px;\s*line-height:\s*16px/)
    expect(source).toContain('monospace')
  })

  it('spaces the text column by 8dp and keeps the 24dp text padding', () => {
    expect(source).toMatch(/ext-not-loaded-content[^}]*gap:\s*8px/)
    expect(source).toMatch(/ext-not-loaded-content[^}]*margin-bottom:\s*24px/)
  })

  it('keeps the confirm button right of the dismiss button', () => {
    expect(source).toMatch(/ext-not-loaded-actions[^}]*row-reverse/)
  })

  it('carries the six base-locale reason descriptions of the reference', () => {
    expect(source).toContain('This extension threw an error while loading, so none of its sources are available.')
    expect(source).toContain('no signature to check it against')
    expect(source).toContain('This extension is missing information the app needs to load it.')
    expect(source).toContain('Updating the app or the extension may help.')
    expect(source).toContain('its sources aren')
    expect(source).toContain('isn')
    expect(source).toContain('t one you chose to load')
  })
})
