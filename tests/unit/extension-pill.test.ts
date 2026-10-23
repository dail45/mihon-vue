import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/ExtensionPill.vue', 'utf8')

/**
 * Pixel-parity guardrails for Mihon's `ExtensionPill`
 * (mihon/app/src/main/java/eu/kanade/presentation/browse/components/ExtensionPill.kt):
 *
 * ```kotlin
 * Text(
 *     text = text,
 *     modifier = modifier
 *         .background(color = color.copy(alpha = PILL_BACKGROUND_ALPHA), shape = MaterialTheme.shapes.small)
 *         .padding(horizontal = MaterialTheme.padding.small, vertical = 2.dp),
 *     color = color,
 *     maxLines = 1,
 *     overflow = TextOverflow.Ellipsis,
 *     style = MaterialTheme.typography.labelSmall,
 * )
 * ```
 *
 * The unit test environment has no Vue SFC plugin, so the checks read the component source.
 */
describe('ExtensionPill parity with the Mihon reference', () => {
  it('uses the MaterialTheme.shapes.small corner radius (8dp)', () => {
    expect(source).toContain('border-radius: 8px')
  })

  it('uses MaterialTheme.padding.small horizontally (8dp) and 2dp vertically', () => {
    expect(source).toContain('padding: 2px 8px')
  })

  it('fills the container with the pill colour at PILL_BACKGROUND_ALPHA (0.12)', () => {
    expect(source).toContain('color-mix(in srgb, var(--pill-color) 12%, transparent)')
  })

  it('uses labelSmall typography (11sp / 16sp / Medium / 0.5sp tracking)', () => {
    expect(source).toContain('font-size: 11px')
    expect(source).toContain('line-height: 16px')
    expect(source).toContain('font-weight: 500')
    expect(source).toContain('letter-spacing: 0.5px')
  })

  it('keeps the single ellipsized line of the reference Text', () => {
    expect(source).toContain('white-space: nowrap')
    expect(source).toContain('text-overflow: ellipsis')
  })

  it('defaults to the onSurfaceVariant colour of the reference', () => {
    expect(source).toContain("{ color: 'on-surface-variant' }")
  })

  it('keeps the label opaque above the alpha container', () => {
    expect(source).not.toContain('opacity: 0.12')
  })

  it('renders the label inside the pill element', () => {
    expect(source).toContain('class="extension-pill"')
    expect(source).toContain('class="extension-pill__text"')
    expect(source).toContain('{{ props.text }}')
  })

  it('resolves the theme colour slot through the Vuetify theme variable', () => {
    expect(source).toContain('rgb(var(--v-theme-${props.color}))')
  })

  it('exposes the colour slots used by the Mihon call sites', () => {
    expect(source).toContain("'primary' | 'error' | 'on-surface-variant'")
  })
})
