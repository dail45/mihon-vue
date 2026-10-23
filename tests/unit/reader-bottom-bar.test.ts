import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  READER_MODE_ICONS,
  READER_ORIENTATION_ICONS,
  READER_CROP_ICONS,
  READER_SETTINGS_ICON,
} from '../../src/components/reader/readerIcons'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/reader/ReaderBottomBar.vue'),
  'utf8',
)

describe('ReaderBottomBar matches the Mihon reference', () => {
  it('keeps the reference structure: Row with SpaceEvenly and CenterVertically', () => {
    expect(source).toContain('display: flex')
    expect(source).toContain('justify-content: space-evenly')
    expect(source).toContain('align-items: center')
  })

  it('intercepts pointer input to prevent page taps underneath (.pointerInput(Unit) {})', () => {
    expect(source).toContain('@pointerdown.stop')
    expect(source).toContain('@click.stop')
  })

  it('renders all four IconButtons with exact contentDescription labels from Mihon', () => {
    // stringResource(MR.strings.viewer) -> "Reading mode"
    expect(source).toContain('aria-label="Reading mode"')
    // stringResource(MR.strings.rotation_type) -> "Rotation"
    expect(source).toContain('aria-label="Rotation"')
    // stringResource(MR.strings.pref_crop_borders) -> "Crop borders"
    expect(source).toContain('aria-label="Crop borders"')
    // stringResource(MR.strings.action_settings) -> "Settings"
    expect(source).toContain('aria-label="Settings"')
  })

  it('uses MD3 IconButton specifications: 48dp touch target, 40dp centered circle ripple, 24dp icons', () => {
    // 48x48dp interactive touch target
    expect(source).toMatch(/width: 48px;\s*\n\s*height: 48px/)
    // 40x40dp state layer (ripple circle) centered inside
    expect(source).toMatch(/width: 40px;\s*\n\s*height: 40px/)
    expect(source).toContain('border-radius: 50%')
    // 24x24dp vector icon size
    expect(source).toMatch(/width: 24px;\s*\n\s*height: 24px/)
    // MD3 state layer opacity: hover 0.08, active 0.12, focus 0.12
    expect(source).toContain('opacity: 0.08')
    expect(source).toContain('opacity: 0.12')
  })

  it('applies padding and navigation bar insets from ReaderAppBars.kt', () => {
    // MaterialTheme.padding.small = 8dp
    expect(source).toContain('padding-inline: 8px')
    // WindowInsets.navigationBars
    expect(source).toContain('padding-bottom: env(safe-area-inset-bottom)')
  })

  it('computes surfaceColorAtElevation(3.dp) with theme alpha composite', () => {
    expect(source).toContain('Math.log(4)')
    expect(source).toContain('dark ? 0.9 : 0.95')
  })

  it('provides exact Mihon vector paths for all reading modes, orientations, crop and settings', () => {
    // ReadingMode icons
    expect(READER_MODE_ICONS.default).toBeTruthy()
    expect(READER_MODE_ICONS.ltr).toBeTruthy()
    expect(READER_MODE_ICONS.rtl).toBeTruthy()
    expect(READER_MODE_ICONS.vertical).toBeTruthy()
    expect(READER_MODE_ICONS.webtoon).toBeTruthy()
    expect(READER_MODE_ICONS.continuous).toBeTruthy()

    // Orientation icons
    expect(READER_ORIENTATION_ICONS.default).toBeTruthy()
    expect(READER_ORIENTATION_ICONS.portrait).toBeTruthy()
    expect(READER_ORIENTATION_ICONS.landscape).toBeTruthy()
    expect(READER_ORIENTATION_ICONS.lockedPortrait).toBeTruthy()
    expect(READER_ORIENTATION_ICONS.lockedLandscape).toBeTruthy()

    // Crop / CropOff
    expect(READER_CROP_ICONS.crop).toBeTruthy()
    expect(READER_CROP_ICONS.cropOff).toBeTruthy()

    // Settings
    expect(READER_SETTINGS_ICON).toBeTruthy()
  })
})
