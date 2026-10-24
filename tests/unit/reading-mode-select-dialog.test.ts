import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(
  resolve(process.cwd(), 'src/features/reader/components/ReadingModeSelectDialog.vue'),
  'utf8',
)

describe('ReadingModeSelectDialog matches the Mihon reference', () => {
  it('implements AdaptiveSheet structure: VDialog on tablet/desktop, VBottomSheet on mobile', () => {
    expect(source).toContain('tablet ? VDialog : VBottomSheet')
    expect(source).toContain('max-width="460"')
    expect(source).toContain('color="surface-container-high"')
    expect(source).toContain('border-radius: 28px')
  })

  it('provides HeadingItem with MR.strings.pref_category_reading_mode ("Reading mode")', () => {
    expect(source).toContain('<h2 class="rmd-heading">Reading mode</h2>')
    // Typography.header = bodyMedium (14sp/20sp, w600 SemiBold, onSurfaceVariant, padding 10dp/24dp)
    expect(source).toMatch(/\.rmd-heading \{[^}]*font-size: 14px;/)
    expect(source).toMatch(/\.rmd-heading \{[^}]*line-height: 20px;/)
    expect(source).toMatch(/\.rmd-heading \{[^}]*font-weight: 600;/)
    expect(source).toMatch(/\.rmd-heading \{[^}]*padding: 10px 24px;/)
    expect(source).toContain('rgb(var(--v-theme-on-surface-variant))')
  })

  it('provides SettingsIconGrid with adaptive 128dp columns and exact paddings', () => {
    // GridCells.Adaptive(128.dp), spacedBy 4.dp vertical / 8.dp horizontal, padding 24.dp/10.dp
    expect(source).toMatch(/grid-template-columns: repeat\(auto-fill, minmax\(128px, 1fr\)\)/)
    expect(source).toContain('column-gap: 8px')
    expect(source).toContain('row-gap: 4px')
    expect(source).toContain('padding: 0 24px 10px')
  })

  it('includes all ReadingModesWithoutDefault entries in exact enum order', () => {
    // ReadingModesWithoutDefault = ReadingMode.entries - ReadingMode.DEFAULT:
    // 1. LEFT_TO_RIGHT ("Paged (left to right)")
    // 2. RIGHT_TO_LEFT ("Paged (right to left)")
    // 3. VERTICAL ("Paged (vertical)")
    // 4. WEBTOON ("Long strip")
    // 5. CONTINUOUS_VERTICAL ("Long strip with gaps")
    const ltrIndex = source.indexOf("'Paged (left to right)'")
    const rtlIndex = source.indexOf("'Paged (right to left)'")
    const verticalIndex = source.indexOf("'Paged (vertical)'")
    const webtoonIndex = source.indexOf("'Long strip'")
    const continuousIndex = source.indexOf("'Long strip with gaps'")

    expect(ltrIndex).toBeGreaterThan(0)
    expect(rtlIndex).toBeGreaterThan(ltrIndex)
    expect(verticalIndex).toBeGreaterThan(rtlIndex)
    expect(webtoonIndex).toBeGreaterThan(verticalIndex)
    expect(continuousIndex).toBeGreaterThan(webtoonIndex)
  })

  it('styles IconToggleButton with MD3 secondaryContainer, contour outline, and onSecondaryContainer', () => {
    // 48.dp height, pill / CornerFull 24px border radius
    expect(source).toMatch(/\.rmd-option \{[^}]*height: 48px;/)
    expect(source).toMatch(/\.rmd-option \{[^}]*border-radius: 24px;/)
    // Inactive contour: 1px solid outline-variant
    expect(source).toMatch(/\.rmd-option \{[^}]*border: 1px solid rgb\(var\(--v-theme-outline-variant\)\);/)
    // Active styling: secondaryContainer container, onSecondaryContainer content
    expect(source).toContain('background: rgb(var(--v-theme-secondary-container))')
    expect(source).toContain('color: rgb(var(--v-theme-on-secondary-container))')
    // labelLarge typography: 14sp/20sp w500
    expect(source).toMatch(/\.rmd-option-label \{[^}]*font-size: 14px;/)
    expect(source).toMatch(/\.rmd-option-label \{[^}]*line-height: 20px;/)
    expect(source).toMatch(/\.rmd-option-label \{[^}]*font-weight: 500;/)
    expect(source).toMatch(/\.rmd-option-label \{[^}]*-webkit-line-clamp: 2;/)
  })

  it('renders ModeSelectionDialog actions: OutlinedButton for revert and FilledTonalButton for apply', () => {
    // "Revert to default" rendered only when showRevert is true (.takeIf { readingMode != ReadingMode.DEFAULT })
    expect(source).toContain('v-if="showRevert"')
    expect(source).toContain('Revert to default')
    expect(source).toContain('variant="outlined"')
    // "Apply" FilledTonalButton with check icon (MR.strings.action_apply)
    expect(source).toContain('variant="tonal"')
    expect(source).toContain('icon="check"')
    expect(source).toContain('Apply')
    expect(source).toContain('background: rgb(var(--v-theme-secondary-container))')
  })

  it('provides clear user feedback / stubs for web-unsupported reading modes', () => {
    expect(source).toContain('Paged (vertical) is not supported in the web version')
    expect(source).toContain('Long strip with gaps is not supported in the web version')
  })
})
