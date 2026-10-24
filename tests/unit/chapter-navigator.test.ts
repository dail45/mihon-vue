import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { READER_NAVIGATOR_ICONS } from '@/features/reader/assets/readerIcons'


const source = readFileSync(
  resolve(process.cwd(), 'src/features/reader/components/ChapterNavigator.vue'),
  'utf8',
)

describe('ChapterNavigator matches the Mihon reference', () => {
  it('exports ChapterNavigatorType enum and supports all 4 variants', () => {
    expect(source).toContain("HORIZONTAL_LTR: 'horizontal-ltr'")
    expect(source).toContain("HORIZONTAL_RTL: 'horizontal-rtl'")
    expect(source).toContain("VERTICAL_LEFT: 'vertical-left'")
    expect(source).toContain("VERTICAL_RIGHT: 'vertical-right'")
    expect(source).toContain("'HORIZONTAL_LTR'")
    expect(source).toContain("'HORIZONTAL_RTL'")
    expect(source).toContain("'VERTICAL_LEFT'")
    expect(source).toContain("'VERTICAL_RIGHT'")
  })

  it('intercepts pointer input to prevent page taps and gestures underneath', () => {
    expect(source).toContain('@pointerdown.stop')
    expect(source).toContain('@mousedown.stop')
    expect(source).toContain('@touchstart.stop')
    expect(source).toContain('@click.stop')
  })

  it('uses MD3 FilledIconButton specification: 40dp container, 48dp touch target, 24dp vector icons', () => {
    // 40x40dp container
    expect(source).toMatch(/width: 40px;\s*\n\s*height: 40px/)
    expect(source).toContain('border-radius: 50%')
    // 48x48dp interactive touch target
    expect(source).toMatch(/width: 48px;\s*\n\s*height: 48px/)
    // 24x24dp icon size
    expect(source).toMatch(/width: 24px;\s*\n\s*height: 24px/)
    // MD3 state layer opacity: hover 0.08, active 0.12
    expect(source).toContain('opacity: 0.08')
    expect(source).toContain('opacity: 0.12')
    // Disabled opacity: 0.38
    expect(source).toContain('opacity: 0.38')
  })

  it('rotates vertical navigator icons 90 degrees clockwise (Modifier.rotate(90f))', () => {
    expect(source).toContain('transform: rotate(90deg)')
    expect(source).toContain('cn-button__icon--rotated')
  })

  it('provides exact Mihon vector paths for SkipPrevious and SkipNext', () => {
    expect(READER_NAVIGATOR_ICONS.skipPrevious).toBeTruthy()
    expect(READER_NAVIGATOR_ICONS.skipNext).toBeTruthy()
    expect(source).toContain('READER_NAVIGATOR_ICONS.skipPrevious')
    expect(source).toContain('READER_NAVIGATOR_ICONS.skipNext')
  })

  it('computes surfaceColorAtElevation(3.dp) with theme alpha composite', () => {
    expect(source).toContain('Math.log(4)')
    expect(source).toContain('dark ? 0.9 : 0.95')
  })

  it('renders discrete page slider with 24dp pill shape and M3 tokens', () => {
    // RoundedCornerShape(24.dp)
    expect(source).toContain('border-radius: 24px')
    // Discrete step formula: steps = totalPages - 2
    expect(source).toContain('props.totalPages - 2')
    // 48dp container height (horizontal) and width (vertical)
    expect(source).toContain('height: 48px')
    expect(source).toContain('width: 48px')
    // 16dp track height
    expect(source).toContain('height: 16px')
    // 4x44dp handle
    expect(source).toContain('width: 4px')
    expect(source).toContain('height: 44px')
  })

  it('handles RTL layout direction and button inversion in horizontal mode', () => {
    expect(source).toContain(":dir=\"isRtl ? 'rtl' : 'ltr'\"")
    expect(source).toContain('transform: scaleX(-1)')
    expect(source).toContain('isRtl ? !enabledNext : !enabledPrevious')
    expect(source).toContain('isRtl ? !enabledPrevious : !enabledNext')
  })

  it('supports tablet adaptive mainAxisPadding (24dp on tablets, 8dp elsewhere)', () => {
    expect(source).toContain('tablet.value ? 24 : 8')
    expect(source).toContain('useTabletUi')
  })

  it('performs haptic feedback (HapticFeedbackType.TextHandleMove) on page index changes', () => {
    expect(source).toContain('navigator.vibrate')
    expect(source).toContain('hapticTick')
  })
})
