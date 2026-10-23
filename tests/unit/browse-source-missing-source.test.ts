import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Parity of the "missing source" screen with Mihon's
 * `presentation/browse/BrowseSourceScreen.kt` -> `MissingSourceScreen`
 * (BrowseSourceScreen.kt:150-167) and `presentation-core/.../screens/EmptyScreen.kt`.
 */
const sourceView = readFileSync('src/views/SourceView.vue', 'utf8')

describe('MissingSourceScreen parity with the Mihon reference', () => {
  it('uses the reference message of the not installed source', () => {
    expect(sourceView).toContain('Source not installed: ${stubLabel.value}')
    // `StubSource.toString()` -> "NAME (LANG)" or the bare id.
    expect(sourceView).toContain('sourceIdentityToString')
  })

  it('renders the empty screen with a kaomoji face and the message', () => {
    expect(sourceView).toContain('class="mihon-missing-source"')
    expect(sourceView).toContain('class="mihon-empty-face"')
    expect(sourceView).toContain('class="mihon-empty-message"')
    // The `EmptyScreen` of the missing source has no action row.
    expect(sourceView).not.toMatch(/mihon-missing-source[\s\S]{0,400}mihon-empty-actions/)
  })

  it('keeps the EmptyScreen metrics: 24dp side padding, displayMedium face, bodyMedium message', () => {
    expect(sourceView).toMatch(/\.mihon-missing-source\s*\{[^}]*padding:\s*0 24px/)
    expect(sourceView).toMatch(/\.mihon-empty-face\s*\{[^}]*font-size:\s*45px[^}]*line-height:\s*52px/)
    expect(sourceView).toMatch(/\.mihon-empty-face\s*\{[^}]*opacity|rgb\(var\(--v-theme-on-surface\)\s*\/\s*\.78\)/)
    expect(sourceView).toMatch(/\.mihon-empty-message\s*\{[^}]*font-size:\s*14px[^}]*line-height:\s*20px/)
    // `paddingFromBaseline(top = 24.dp)` is a ~14px visible ink gap.
    expect(sourceView).toMatch(/\.mihon-empty-message\s*\{[^}]*margin-top:\s*14px/)
  })

  it('centres the empty column in the area below the app bar', () => {
    expect(sourceView).toMatch(/\.mihon-missing-source\s*\{[^}]*min-height:\s*calc\(100dvh - var\(--v-layout-top, 0px\) - var\(--v-layout-bottom, 0px\)\)/)
    expect(sourceView).toMatch(/\.mihon-missing-source__content\s*\{[^}]*margin:\s*auto/)
  })

  it('hides the search, the display mode action and the overflow menu on the missing source', () => {
    expect(sourceView).toContain('v-if="searchOpen && !missingSource"')
    expect(sourceView).toContain('<template v-if="!missingSource">')
  })
})
