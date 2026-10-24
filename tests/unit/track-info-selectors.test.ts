import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = [
  'src/components/TrackInfoSelectors.vue',
  'src/components/tracker/TrackStatusSelector.vue',
  'src/components/tracker/TrackNumberWheelPicker.vue',
  'src/components/tracker/TrackScoreWheelPicker.vue',
  'src/components/tracker/TrackDatePicker.vue',
].map(path => readFileSync(path, 'utf8')).join('\n')

describe('TrackInfoSelectors matches the Mihon reference (TrackInfoDialogSelector.kt)', () => {
  it('uses the AlertDialogContent geometry of the reference', () => {
    // AlertDialogContent.kt: DialogPadding 24dp, TitlePadding bottom 16dp,
    // TextPadding bottom 24dp, MinWidth 280dp / MaxWidth 560dp.
    expect(source).toMatch(/max-width="560"/)
    expect(source).toMatch(/min-width:\s*280px/)
    expect(source).toMatch(/border-radius:\s*28px/)
    // Title: headlineSmall (24sp / 32sp) in on-surface, 24dp / 16dp padding.
    expect(source).toMatch(/font-size:\s*24px;\s*line-height:\s*32px;/)
    expect(source).toMatch(/margin:\s*24px 24px 16px;/)
    // Text: bodyMedium (14sp / 20sp) in on-surface-variant, 24dp side inset.
    expect(source).toMatch(/font-size:\s*14px;\s*line-height:\s*20px;/)
    expect(source).toMatch(/margin:\s*0 24px 24px;/)
  })

  it('renders the status radio rows of the reference', () => {
    // Row: clip(RoundedCornerShape(8.dp)) + selectable + minimumInteractiveComponentSize.
    expect(source).toMatch(/border-radius:\s*8px;/)
    expect(source).toMatch(/min-height:\s*48px;/)
    // RadioButton: 20dp ring with a 2dp stroke, 10dp selected dot.
    expect(source).toMatch(/width:\s*20px;\s*height:\s*20px;/)
    expect(source).toMatch(/border:\s*2px solid rgb\(var\(--v-theme-on-surface-variant\)\)/)
    expect(source).toMatch(/width:\s*10px;\s*height:\s*10px;/)
    // Text(bodyLarge, start padding 24dp).
    expect(source).toMatch(/margin-left:\s*24px;/)
    expect(source).toMatch(/font-size:\s*16px;\s*line-height:\s*24px;/)
    // HorizontalDivider on the list edges while the list can scroll.
    expect(source).toContain('track-divider-top')
    expect(source).toContain('track-divider-bottom')
  })

  it('reproduces the wheel picker of the reference', () => {
    // WheelPicker.kt: 128dp box, 3 rows of 42.667dp, band = primary 20% alpha,
    // 1dp primary border, 16dp radius, items titleMedium.
    expect(source).toMatch(/width:\s*128px;\s*height:\s*128px;/)
    expect(source).toMatch(/height:\s*42\.6667px;/)
    expect(source).toMatch(/padding:\s*42\.6667px 0;/)
    expect(source).toMatch(/border-radius:\s*16px;/)
    expect(source).toMatch(/background:\s*rgba\(var\(--v-theme-primary\),\s*0\.2\)/)
    expect(source).toMatch(/border:\s*1px solid rgb\(var\(--v-theme-primary\)\)/)
    expect(source).toMatch(/font-size:\s*16px;\s*line-height:\s*24px;\s*font-weight:\s*500;/)
    // calculateAnimatedAlpha: 1.2 at the snapped row, 0.2 off row.
    expect(source).toMatch(/1\.2 - distance \/ ROW_HEIGHT/)
    // WheelNumberPicker opens a numeric manual input on click.
    expect(source).toContain('type="number"')
  })

  it('reproduces the date picker of the reference', () => {
    // DatePicker.kt: DatePickerHorizontalPadding 12dp, MonthYearHeight 56dp,
    // RecommendedSizeForAccessibility 48dp, DateContainer 40dp, outline 1dp.
    expect(source).toMatch(/padding:\s*0 12px;/)
    expect(source).toMatch(/height:\s*56px;/)
    expect(source).toMatch(/height:\s*48px;/)
    expect(source).toMatch(/width:\s*40px;\s*height:\s*40px;/)
    expect(source).toMatch(/inset 0 0 0 1px rgb\(var\(--v-theme-primary\)\)/)
    // No title, no headline and no mode toggle, exactly as in the reference.
    expect(source).not.toMatch(/show-mode-toggle|showModeToggle\s*[:=]/)
    // The buttons row: Remove (optional) / Cancel / OK, 8dp apart, end aligned.
    expect(source).toContain('Remove')
    expect(source).toContain('Cancel')
    expect(source).toContain('OK')
    expect(source).toMatch(/margin:\s*8px 12px 24px;/)
  })

  it('keeps the MD3 button and typography tokens of the reference', () => {
    // MD3 TextButton: 40dp high, 58dp wide, CornerFull shape, labelLarge in primary.
    expect(source).toMatch(/min-width:\s*58px;/)
    expect(source).toMatch(/height:\s*40px;/)
    expect(source).toMatch(/border-radius:\s*20px;/)
    expect(source).toMatch(/color:\s*rgb\(var\(--v-theme-primary\)\)/)
    // Buttons are 8dp apart and aligned to the end.
    expect(source).toMatch(/gap:\s*8px;/)
    expect(source).toMatch(/justify-content:\s*flex-end;/)
  })
})
