import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/browse/components/SourcePinButton.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/features/browse/components/SourcePinButton.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/browse/SourcesScreen.kt:141-162
 * (the private `SourcePinButton` composable). The reference is Kotlin, so the
 * invariants are asserted on the ported metrics.
 */
describe('SourcePinButton parity with Mihon', () => {
  it('keeps the Material3 icon button geometry', () => {
    // IconButton: 48dp touch target, 40dp circular state layer, 24dp icon.
    expect(source).toMatch(/\.source-pin-button \{[^}]*width: 48px;/s)
    expect(source).toMatch(/\.source-pin-button \{[^}]*height: 48px;/s)
    expect(source).toMatch(/\.source-pin-button__state-layer \{[^}]*width: 40px;/s)
    expect(source).toMatch(/\.source-pin-button__state-layer \{[^}]*height: 40px;/s)
    expect(source).toMatch(/\.source-pin-button__icon \{[^}]*width: 24px;/s)
    expect(source).toMatch(/\.source-pin-button__icon \{[^}]*height: 24px;/s)
  })

  it('uses the MaterialSymbols Keep icon and the RoundedFilled variant when pinned', () => {
    // MaterialSymbols.Rounded.Keep / MaterialSymbols.RoundedFilled.Keep.
    expect(source).toContain('>keep</span>')
    // RoundedFilled == FILL = 1.
    expect(source).toMatch(/\.source-pin-button__icon--filled \{[^}]*'FILL' 1/s)
  })

  it('tints the icon with primary when pinned and onBackground at SECONDARY_ALPHA otherwise', () => {
    expect(source).toContain("pinned.value ? 'rgb(var(--v-theme-primary))' : 'rgb(var(--v-theme-on-background))'")
    // SECONDARY_ALPHA = .78f (presentation-core/.../material/Constants.kt:10).
    expect(source).toContain('0.78 /* SECONDARY_ALPHA */')
  })

  it('exposes the Pin/Unpin content description of the reference strings', () => {
    // MR.strings.action_pin = "Pin", MR.strings.action_unpin = "Unpin".
    expect(source).toContain("pinned.value ? 'Unpin' : 'Pin'")
    expect(source).toContain(':aria-label="description"')
  })

  it('draws the state layer and the ripple in the button content colour', () => {
    // The Compose Icon tint is explicit, so the button chrome keeps LocalContentColor
    // (= onBackground of the Sources Scaffold).
    expect(source).toContain('background: rgb(var(--v-theme-on-background))')
    // IconButton container = 40dp CircleShape -> the ripple fills the same 40dp circle.
    expect(source).toMatch(/\.source-pin-button__ripple \{[^}]*border-radius: 50%;/s)
    expect(source).toMatch(/\.source-pin-button__ripple \{[^}]*width: 40px;/s)
    // Hover 8% / focus 10% state layer, press 12% ripple.
    expect(source).toContain('opacity: 0.08;')
    expect(source).toContain('opacity: 0.1;')
    expect(source).toContain('opacity: 0.12;')
  })

  it('keeps the pin state app-local like the Mihon reference', () => {
    // Mihon stores pinned sources in the app preferences (SourcePreferences.pinnedSources);
    // Suwayomi-Server has no REST contract for it, so the web client stores it locally.
    expect(source).toContain('isSourcePinned')
    expect(source).toContain('setSourcePinned')
    expect(source).toContain("emit('toggle', next)")
  })
})
