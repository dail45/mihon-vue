import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/reader/ReadingModePage.vue'),
  'utf8',
)

const dialogSource = readFileSync(
  resolve(process.cwd(), 'src/components/reader/ReaderSettingsDialog.vue'),
  'utf8',
)

describe('ReadingModePage (Item 88) matches Mihon ReadingModePage.kt', () => {
  it('references ReadingModePage.kt and related Compose sources', () => {
    expect(source).toContain('ReadingModePage.kt')
    expect(source).toContain('ReadingMode.kt')
    expect(source).toContain('ReaderOrientation.kt')
    expect(source).toContain('ReaderPreferences.kt')
  })

  it('renders "For this series" HeadingItem at the top', () => {
    // HeadingItem(MR.strings.pref_category_for_this_series)
    expect(source).toContain('<h3 class="rm-heading">For this series</h3>')
    // Typography.header = bodyMedium (14/20sp, w600 SemiBold, onSurfaceVariant, padding 10dp/24dp)
    expect(source).toMatch(/\.rm-heading \{[^}]*font-size: 14px;/)
    expect(source).toMatch(/\.rm-heading \{[^}]*line-height: 20px;/)
    expect(source).toMatch(/\.rm-heading \{[^}]*font-weight: 600;/)
    expect(source).toMatch(/\.rm-heading \{[^}]*padding: 10px 24px;/)
    expect(source).toContain('rgb(var(--v-theme-on-surface-variant))')
  })

  it('renders "Reading mode" SettingsChipRow with all 6 ReadingMode entries in exact enum order', () => {
    // SettingsChipRow(MR.strings.pref_category_reading_mode)
    expect(source).toContain('<h3 class="rm-heading">Reading mode</h3>')

    const defaultIdx = source.indexOf("'Default'")
    const ltrIdx = source.indexOf("'Paged (left to right)'")
    const rtlIdx = source.indexOf("'Paged (right to left)'")
    const verticalIdx = source.indexOf("'Paged (vertical)'")
    const webtoonIdx = source.indexOf("'Long strip'")
    const continuousIdx = source.indexOf("'Long strip with gaps'")

    expect(defaultIdx).toBeGreaterThan(0)
    expect(ltrIdx).toBeGreaterThan(defaultIdx)
    expect(rtlIdx).toBeGreaterThan(ltrIdx)
    expect(verticalIdx).toBeGreaterThan(rtlIdx)
    expect(webtoonIdx).toBeGreaterThan(verticalIdx)
    expect(continuousIdx).toBeGreaterThan(webtoonIdx)
  })

  it('renders "Rotation" SettingsChipRow with all 7 ReaderOrientation entries in exact enum order', () => {
    // SettingsChipRow(MR.strings.rotation_type)
    expect(source).toContain('<h3 class="rm-heading">Rotation</h3>')

    const freeIdx = source.indexOf("'Free'")
    const portraitIdx = source.indexOf("'Portrait'")
    const landscapeIdx = source.indexOf("'Landscape'")
    const lockedPortraitIdx = source.indexOf("'Locked portrait'")
    const lockedLandscapeIdx = source.indexOf("'Locked landscape'")
    const reversePortraitIdx = source.indexOf("'Reverse portrait'")

    expect(freeIdx).toBeGreaterThan(0)
    expect(portraitIdx).toBeGreaterThan(freeIdx)
    expect(landscapeIdx).toBeGreaterThan(portraitIdx)
    expect(lockedPortraitIdx).toBeGreaterThan(landscapeIdx)
    expect(lockedLandscapeIdx).toBeGreaterThan(lockedPortraitIdx)
    expect(reversePortraitIdx).toBeGreaterThan(lockedLandscapeIdx)
  })

  it('branches viewer settings into WebtoonViewerSettings and PagerViewerSettings', () => {
    // if (viewer is WebtoonViewer) WebtoonViewerSettings(viewModel) else PagerViewerSettings(viewModel)
    expect(source).toContain('v-if="isWebtoonViewer"')
    expect(source).toContain('Long strip')
    expect(source).toContain('Paged')
  })

  it('implements WebtoonViewerSettings according to ReadingModePage.kt', () => {
    // HeadingItem(MR.strings.webtoon_viewer) -> "Long strip"
    expect(source).toContain('<h3 class="rm-heading">Long strip</h3>')

    // Tap zones & Invert tap zones (TapZonesItems)
    expect(source).toContain('tapZoneWebtoon')
    expect(source).toContain('tapInvertWebtoon')
    expect(source).toContain('v-if="tapZoneWebtoon !== 5"')

    // SliderItem(webtoonSidePadding, 0..25, pillColor = surfaceContainerHighest)
    expect(source).toContain('webtoonSidePadding')
    expect(source).toContain(':min="0"')
    expect(source).toContain(':max="25"')
    expect(source).toContain('webtoonSidePaddingText')

    // Webtoon checkboxes
    expect(source).toContain('cropBordersWebtoon')
    expect(source).toContain('dualPageSplitWebtoon')
    expect(source).toContain('dualPageInvertWebtoon')
    expect(source).toContain('v-if="dualPageSplitWebtoon"')
    expect(source).toContain('dualPageRotateToFitWebtoon')
    expect(source).toContain('dualPageRotateToFitInvertWebtoon')
    expect(source).toContain('v-if="dualPageRotateToFitWebtoon"')
    expect(source).toContain('webtoonDoubleTapZoom')
    expect(source).toContain('webtoonDisableZoomOut')
  })

  it('implements PagerViewerSettings according to ReadingModePage.kt', () => {
    // HeadingItem(MR.strings.pager_viewer) -> "Paged"
    expect(source).toContain('<h3 class="rm-heading">Paged</h3>')

    // Tap zones & Invert tap zones (TapZonesItems)
    expect(source).toContain('tapZonePager')
    expect(source).toContain('tapInvertPager')
    expect(source).toContain('v-if="tapZonePager !== 5"')

    // SettingsChipRow(MR.strings.pref_image_scale_type) -> Scale type
    expect(source).toContain('<h3 class="rm-heading">Scale type</h3>')
    expect(source).toContain("'Fit screen'")
    expect(source).toContain("'Stretch'")
    expect(source).toContain("'Fit width'")
    expect(source).toContain("'Fit height'")
    expect(source).toContain("'Original size'")
    expect(source).toContain("'Smart fit'")

    // SettingsChipRow(MR.strings.pref_zoom_start) -> Zoom start position
    expect(source).toContain('<h3 class="rm-heading">Zoom start position</h3>')
    expect(source).toContain("'Automatic'")
    expect(source).toContain("'Left'")
    expect(source).toContain("'Right'")
    expect(source).toContain("'Center'")

    // Pager checkboxes
    expect(source).toContain('cropBorders')
    expect(source).toContain('landscapeZoom')
    expect(source).toContain('navigateToPan')
    expect(source).toContain('dualPageSplitPaged')
    expect(source).toContain('dualPageInvertPaged')
    expect(source).toContain('v-if="dualPageSplitPaged"')
    expect(source).toContain('dualPageRotateToFit')
    expect(source).toContain('dualPageRotateToFitInvert')
    expect(source).toContain('v-if="dualPageRotateToFit"')
  })

  it('styles FilterChip according to Material 3 tokens', () => {
    // height 32dp, shape CornerSmall (8dp), labelLarge (14/20sp w500)
    expect(source).toMatch(/\.rm-chip \{[^}]*height: 32px;/)
    expect(source).toMatch(/\.rm-chip \{[^}]*border-radius: 8px;/)
    expect(source).toMatch(/\.rm-chip \{[^}]*font-size: 14px;/)
    expect(source).toMatch(/\.rm-chip \{[^}]*line-height: 20px;/)
    expect(source).toMatch(/\.rm-chip \{[^}]*font-weight: 500;/)
    expect(source).toMatch(/\.rm-chip \{[^}]*padding: 0 16px;/)
    // Unselected: 1px solid outline
    expect(source).toContain('border: 1px solid rgb(var(--v-theme-outline))')
    // Selected: secondaryContainer background, onSecondaryContainer color
    expect(source).toContain('background: rgb(var(--v-theme-secondary-container))')
    expect(source).toContain('color: rgb(var(--v-theme-on-secondary-container))')
  })

  it('styles CheckboxItem according to Material 3 tokens', () => {
    // min-height 48dp, padding 10dp / 24dp, gap 24dp
    expect(source).toMatch(/\.rm-checkbox \{[^}]*min-height: 48px;/)
    expect(source).toMatch(/\.rm-checkbox \{[^}]*padding: 10px 24px;/)
    expect(source).toMatch(/\.rm-checkbox \{[^}]*gap: 24px;/)
    // Checkbox box: 18x18dp, 2dp radius, 2dp border
    expect(source).toMatch(/\.rm-checkbox-box \{[^}]*width: 18px;/)
    expect(source).toMatch(/\.rm-checkbox-box \{[^}]*height: 18px;/)
    expect(source).toMatch(/\.rm-checkbox-box \{[^}]*border-radius: 2px;/)
    expect(source).toMatch(/\.rm-checkbox-box \{[^}]*border: 2px solid/)
    expect(source).toContain('rgb(var(--v-theme-primary))')
    expect(source).toContain('rgb(var(--v-theme-on-primary))')
  })

  it('styles SliderItem according to Material 3 tokens', () => {
    // Column with padding 10/24dp, gap 2dp
    expect(source).toMatch(/\.rm-slider \{[^}]*padding: 10px 24px;/)
    expect(source).toMatch(/\.rm-slider \{[^}]*gap: 2px;/)
    // Pill: surfaceContainerHighest, 28dp radius, 1px 6px padding
    expect(source).toMatch(/\.rm-pill \{[^}]*border-radius: 28px;/)
    expect(source).toMatch(/\.rm-pill \{[^}]*padding: 1px 6px;/)
    expect(source).toContain('rgb(var(--v-theme-surface-container-highest))')
  })

  it('is integrated into ReaderSettingsDialog as the first tab', () => {
    expect(dialogSource).toContain("import ReadingModePage from './ReadingModePage.vue'")
    expect(dialogSource).toContain('<ReadingModePage :manga-id="mangaId"')
  })
})
