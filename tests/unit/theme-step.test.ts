import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { APP_THEME_SCHEMES } from '../../src/theme/appThemes'

const source = readFileSync('src/components/onboarding/ThemeStep.vue', 'utf8')

/**
 * Parity tests for `src/components/onboarding/ThemeStep.vue` with Mihon references:
 * - `mihon/app/src/main/java/eu/kanade/presentation/more/onboarding/ThemeStep.kt`
 * - `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/AppThemeModePreferenceWidget.kt`
 * - `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/AppThemePreferenceWidget.kt`
 * - `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/BasePreferenceWidget.kt`
 * - `mihon/app/src/main/java/eu/kanade/presentation/theme/colorscheme/BaseColorScheme.kt`
 */
describe('ThemeStep parity with Mihon', () => {
  it('implements ThemeStep structure with BasePreferenceWidget containers', () => {
    // ThemeStep.kt: Column { AppThemeModePreferenceWidget; AppThemePreferenceWidget }
    expect(source).toMatch(/\.theme-step \{[^}]*display: flex;/s)
    expect(source).toMatch(/\.theme-step \{[^}]*flex-direction: column;/s)
    // BasePreferenceWidget: minHeight = 56dp, padding(vertical = PrefsVerticalPadding = 16dp)
    expect(source).toMatch(/\.theme-step__widget \{[^}]*min-height: 56px;/s)
    expect(source).toMatch(/\.theme-step__widget \{[^}]*padding: 16px 0;/s)
  })

  it('reproduces AppThemeModePreferenceWidget and SegmentedButton specifications', () => {
    // MultiChoiceSegmentedButtonRow(fillMaxWidth().padding(horizontal = PrefsHorizontalPadding = 16dp))
    expect(source).toMatch(/\.theme-step__segmented \{[^}]*margin: 0 16px;/s)

    // SegmentedButton: defaultMinSize(minWidth = 58dp, minHeight = 40dp), 1dp outline border
    expect(source).toMatch(/\.theme-segment \{[^}]*min-width: 58px;/s)
    expect(source).toMatch(/\.theme-segment \{[^}]*height: 40px;/s)
    expect(source).toMatch(/\.theme-segment \{[^}]*border: 1px solid rgb\(var\(--v-theme-outline\)\);/s)

    // SegmentedButtonDefaults.itemShape(index, count): start 20dp, middle 0dp, end 20dp
    expect(source).toMatch(/\.theme-segment--start \{ border-radius: 20px 0 0 20px; \}/)
    expect(source).toMatch(/\.theme-segment--end \{ border-radius: 0 20px 20px 0; \}/)
    expect(source).toMatch(/\.theme-segment \+ \.theme-segment \{ margin-left: -1px; \}/)

    // Checked state: container secondaryContainer, label onSecondaryContainer
    expect(source).toMatch(/\.theme-segment--checked \{[^}]*background: rgb\(var\(--v-theme-secondary-container\)\);/s)
    expect(source).toMatch(/\.theme-segment--checked \{[^}]*color: rgb\(var\(--v-theme-on-secondary-container\)\);/s)

    // Checked icon: 18dp check icon with 8dp spacing (IconSpacing)
    expect(source).toMatch(/\.theme-segment__check \{[^}]*font-size: 18px;/s)
    expect(source).toMatch(/\.theme-segment__check \{[^}]*width: 18px;/s)
    expect(source).toMatch(/\.theme-segment__check \{[^}]*height: 18px;/s)
    expect(source).toMatch(/\.theme-segment__content \{[^}]*gap: 8px;/s)

    // 3 options in order: System, Light, Dark (MR.strings.theme_system, theme_light, theme_dark)
    expect(source).toContain("{ value: 'system', label: 'System' }")
    expect(source).toContain("{ value: 'light', label: 'Light' }")
    expect(source).toContain("{ value: 'dark', label: 'Dark' }")
  })

  it('reproduces AppThemesList and AppThemePreviewItem metrics', () => {
    // LazyRow(contentPadding = horizontal 16dp, spacedBy = 8dp)
    expect(source).toMatch(/\.theme-step__themes \{[^}]*gap: 8px;/s)
    expect(source).toMatch(/\.theme-step__themes \{[^}]*padding: 0 16px;/s)

    // Column(width = 114dp, padding(top = 8dp))
    expect(source).toMatch(/\.theme-item \{[^}]*width: 114px;/s)
    expect(source).toMatch(/\.theme-item \{[^}]*padding: 8px 0 0;/s)

    // AppThemePreviewItem: aspectRatio 9/16, border 4dp, RoundedCornerShape 17dp, padding 4dp, clip 13dp
    expect(source).toMatch(/\.theme-preview \{[^}]*aspect-ratio: 9 \/ 16;/s)
    expect(source).toMatch(/\.theme-preview \{[^}]*border: 4px solid/s)
    expect(source).toMatch(/\.theme-preview \{[^}]*border-radius: 17px;/s)
    expect(source).toMatch(/\.theme-preview \{[^}]*padding: 4px;/s)
    expect(source).toMatch(/\.theme-preview__inner \{[^}]*border-radius: 13px;/s)

    // App Bar: height 40dp, padding 8dp
    expect(source).toMatch(/\.theme-preview__bar \{[^}]*height: 40px;/s)
    expect(source).toMatch(/\.theme-preview__bar \{[^}]*padding: 8px;/s)
    // Title placeholder: weight 0.7 (70%), fillMaxHeight 0.8 (80%), padding end 4dp, shapes.small (8dp)
    expect(source).toMatch(/\.theme-preview__bar-title-wrap \{[^}]*flex: 0 0 70%;/s)
    expect(source).toMatch(/\.theme-preview__bar-title-wrap \{[^}]*height: 80%;/s)
    expect(source).toMatch(/\.theme-preview__bar-title-wrap \{[^}]*padding-right: 4px;/s)
    expect(source).toMatch(/\.theme-preview__bar-title \{[^}]*border-radius: 8px;/s)
    // Check box: weight 0.3 (30%), CenterEnd, 24dp check_circle icon
    expect(source).toMatch(/\.theme-preview__bar-check \{[^}]*flex: 0 0 30%;/s)
    expect(source).toMatch(/\.theme-preview__bar-check \{[^}]*justify-content: flex-end;/s)
    expect(source).toMatch(/\.theme-preview__check \{[^}]*font-size: 24px;/s)

    // Cover: padding start 8dp, top 2dp, shapes.small (8dp), fillMaxWidth 0.5 (50%), aspectRatio 2/3 (MangaCover.Book.ratio)
    expect(source).toMatch(/\.theme-preview__cover \{[^}]*width: 50%;/s)
    expect(source).toMatch(/\.theme-preview__cover \{[^}]*aspect-ratio: 2 \/ 3;/s)
    expect(source).toMatch(/\.theme-preview__cover \{[^}]*margin: 2px 0 0 8px;/s)
    expect(source).toMatch(/\.theme-preview__cover \{[^}]*border-radius: 8px;/s)
    // Two-tone strip: 24x16dp, RoundedCornerShape 5dp, offset 4dp, left 12dp tertiary, right 12dp secondary
    expect(source).toMatch(/\.theme-preview__cover-strip \{[^}]*width: 24px;/s)
    expect(source).toMatch(/\.theme-preview__cover-strip \{[^}]*height: 16px;/s)
    expect(source).toMatch(/\.theme-preview__cover-strip \{[^}]*border-radius: 5px;/s)
    expect(source).toMatch(/\.theme-preview__cover-a \{ flex: 0 0 12px; \}/)
    expect(source).toMatch(/\.theme-preview__cover-b \{ flex: 0 0 12px; \}/)

    // Bottom bar: surfaceContainer, height 32dp, horizontal padding 8dp
    expect(source).toMatch(/\.theme-preview__bottom \{[^}]*height: 32px;/s)
    expect(source).toMatch(/\.theme-preview__bottom \{[^}]*padding: 0 8px;/s)
    // Circle: 17dp, circle shape, primary
    expect(source).toMatch(/\.theme-preview__fab \{[^}]*width: 17px;/s)
    expect(source).toMatch(/\.theme-preview__fab \{[^}]*height: 17px;/s)
    expect(source).toMatch(/\.theme-preview__fab \{[^}]*border-radius: 50%;/s)
    // Nav track: 17dp height, margin start 8dp, alpha 0.6, shapes.small (8dp)
    expect(source).toMatch(/\.theme-preview__nav \{[^}]*height: 17px;/s)
    expect(source).toMatch(/\.theme-preview__nav \{[^}]*margin-left: 8px;/s)
    expect(source).toMatch(/\.theme-preview__nav \{[^}]*border-radius: 8px;/s)
    expect(source).toMatch(/\.theme-preview__nav \{[^}]*opacity: 0\.6;/s)

    // Label: bodyMedium (14sp/20sp), centered, maxLines 2, minLines 2 (min-height 40px), secondaryItemAlpha (0.78)
    expect(source).toMatch(/\.theme-item__label \{[^}]*font-size: 14px;/s)
    expect(source).toMatch(/\.theme-item__label \{[^}]*line-height: 20px;/s)
    expect(source).toMatch(/\.theme-item__label \{[^}]*opacity: 0\.78;/s)
    expect(source).toMatch(/\.theme-item__label \{[^}]*min-height: 40px;/s)
  })

  it('contains all 15 Mihon themes in the exact reference order', () => {
    // AppTheme.kt entries: DEFAULT, MONET, CATPPUCCIN, GREEN_APPLE, LAVENDER,
    // MIDNIGHT_DUSK, NORD, STRAWBERRY_DAIQUIRI, TAKO, TEALTURQUOISE, TIDAL_WAVE,
    // YINYANG, YOTSUBA, TOKYONIGHT, MONOCHROME
    const themeNames = APP_THEME_SCHEMES.map(s => s.name)
    expect(themeNames).toEqual([
      'DEFAULT',
      'MONET',
      'CATPPUCCIN',
      'GREEN_APPLE',
      'LAVENDER',
      'MIDNIGHT_DUSK',
      'NORD',
      'STRAWBERRY_DAIQUIRI',
      'TAKO',
      'TEALTURQUOISE',
      'TIDAL_WAVE',
      'YINYANG',
      'YOTSUBA',
      'TOKYONIGHT',
      'MONOCHROME',
    ])
  })

  it('provides a Material 3 dialog stub for the Android wallpaper Monet theme', () => {
    // Monet requires dynamic color from Android wallpaper API
    expect(source).toContain('The dynamic color theme is not supported in the web version')
    expect(source).toContain('rounded="28px"')
    expect(source).toContain('color="surface-container-high"')
    expect(source).toMatch(/\.theme-step-dialog-title \{[^}]*font-size: 24px;/s)
    expect(source).toMatch(/\.theme-step-dialog-text \{[^}]*font-size: 14px;/s)
  })

  it('supports the optional pure black / AMOLED switch matching SwitchPreferenceWidget', () => {
    // SwitchPreferenceWidget: minHeight 56dp, padding 16dp, 52x32dp switch track
    expect(source).toContain('Pure black dark mode')
    expect(source).toMatch(/\.theme-step__switch-row \{[^}]*min-height: 56px;/s)
    expect(source).toMatch(/\.theme-step__switch-track \{[^}]*width: 52px;/s)
    expect(source).toMatch(/\.theme-step__switch-track \{[^}]*height: 32px;/s)
  })

  it('supports optional title and description headers when used standalone', () => {
    expect(source).toMatch(/\.theme-step__title \{[^}]*font-size: 22px;/s)
    expect(source).toMatch(/\.theme-step__info \{[^}]*font-size: 14px;/s)
  })
})
