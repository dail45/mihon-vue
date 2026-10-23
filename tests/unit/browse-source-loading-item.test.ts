import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/BrowseSourceLoadingItem.vue', 'utf8')

/**
 * Pixel-parity guardrails for Mihon's `BrowseSourceLoadingItem`
 * (mihon/app/src/main/java/eu/kanade/presentation/browse/components/BrowseSourceLoadingItem.kt):
 *
 *   Row(
 *       modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
 *       horizontalArrangement = Arrangement.Center,
 *   ) { CircularProgressIndicator() }
 *
 * The bare Material3 `CircularProgressIndicator()` is the indeterminate variant, so the
 * androidx.compose.material3 defaults apply (ProgressIndicator.kt / CircularProgressIndicatorTokens.kt).
 */
describe('BrowseSourceLoadingItem parity with the Mihon reference', () => {
  it('keeps the Row geometry: full width, 16dp vertical padding, centred child', () => {
    expect(source).toMatch(/\.browse-source-loading-item\s*\{[^}]*width:\s*100%/)
    expect(source).toMatch(/\.browse-source-loading-item\s*\{[^}]*padding:\s*16px 0/)
    expect(source).toMatch(/\.browse-source-loading-item\s*\{[^}]*justify-content:\s*center/)
  })

  it('aligns the indicator to the top like Compose Row (verticalAlignment = Alignment.Top)', () => {
    expect(source).toMatch(/\.browse-source-loading-item\s*\{[^}]*align-items:\s*flex-start/)
  })

  it('uses the 40dp indicator diameter (CircularProgressIndicatorTokens.Size)', () => {
    expect(source).toContain('width="40"')
    expect(source).toContain('height="40"')
    expect(source).toMatch(/\.browse-source-loading-item__indicator\s*\{[^}]*width:\s*40px/)
    expect(source).toMatch(/\.browse-source-loading-item__indicator\s*\{[^}]*height:\s*40px/)
  })

  it('uses the 4dp stroke (CircularProgressIndicatorTokens.TrackThickness) with round caps', () => {
    expect(source).toContain('stroke-width: 4')
    expect(source).toContain('stroke-linecap: round')
  })

  it('paints the active indicator with the theme primary and keeps the track transparent', () => {
    expect(source).toContain('stroke: rgb(var(--v-theme-primary))')
    // No track element: the M3 indeterminate track colour is Color.Transparent.
    expect(source).not.toContain('v-theme-secondary-container')
  })

  it('reproduces the 6s M3 cycle (CircularAnimationProgressDuration = 6000)', () => {
    expect(source).toContain('browse-source-loading-global-rotate 6s linear infinite')
    expect(source).toContain('browse-source-loading-step-rotate 6s linear infinite')
    expect(source).toContain('browse-source-loading-sweep 6s linear infinite')
  })

  it('reproduces the 1080deg global rotation (CircularGlobalRotationDegreesTarget)', () => {
    const global = source.slice(source.indexOf('@keyframes browse-source-loading-global-rotate'))
    expect(global).toContain('rotate(1080deg)')
  })

  it('reproduces the 90deg additional-rotation steps of the M3 keyframes', () => {
    const steps = source.slice(source.indexOf('@keyframes browse-source-loading-step-rotate'))
    for (const angle of [90, 180, 270, 360]) {
      expect(steps).toContain(`rotate(${angle}deg)`)
    }
  })

  it('keeps the arc between 10% and 87% of the circle (Min/MaxProgress)', () => {
    expect(source).toContain('stroke-dasharray: 10 100')
    expect(source).toContain('stroke-dasharray: 87 100')
  })

  it('eases the shrinking half with EasingStandardCubicBezier (0.2, 0, 0, 1)', () => {
    expect(source).toContain('cubic-bezier(0.2, 0, 0, 1)')
  })

  it('exposes the indeterminate progressbar semantics on the indicator', () => {
    expect(source).toContain('role="progressbar"')
    // An indeterminate progressbar carries no current-value attribute.
    expect(source).not.toContain('aria-valuenow')
    expect(source).not.toContain('aria-valuemin')
    expect(source).not.toContain('aria-valuemax')
  })

  it('honours prefers-reduced-motion', () => {
    expect(source).toContain('@media (prefers-reduced-motion: reduce)')
    expect(source).toContain('animation: none !important')
  })
})
