import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { calculatePalerSurface } from '../../src/composables/useAppearancePreferences'

const viewSource = readFileSync('src/features/settings/views/SettingsAppearanceView.vue', 'utf8')
const previewSource = readFileSync('src/features/settings/components/ThemePreviewItem.vue', 'utf8')

/**
 * Pixel-parity tests for `src/features/settings/views/SettingsAppearanceView.vue` and `ThemePreviewItem.vue`
 * matching references:
 * - `mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsAppearanceScreen.kt`
 * - `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/AppThemeModePreferenceWidget.kt`
 * - `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/AppThemePreferenceWidget.kt`
 * - `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/PreferenceGroupHeader.kt`
 * - `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/BasePreferenceWidget.kt`
 * - `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/SwitchPreferenceWidget.kt`
 * - `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/ListPreferenceWidget.kt`
 * - `mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/appearance/AppLanguageScreen.kt`
 */
describe('SettingsAppearanceView parity with Mihon', () => {
  it('implements PreferenceGroupHeader with M3 tokens', () => {
    // PreferenceGroupHeader: bodyMedium 14/20sp w500, secondary color, padding top 14dp, bottom 8dp, horizontal 16dp
    expect(viewSource).toMatch(/\.pref-group-header \{[^}]*padding:\s*14px 16px 8px;/s)
    expect(viewSource).toMatch(/\.pref-group-header \{[^}]*font-size:\s*14px;/s)
    expect(viewSource).toMatch(/\.pref-group-header \{[^}]*line-height:\s*20px;/s)
    expect(viewSource).toMatch(/\.pref-group-header \{[^}]*font-weight:\s*500;/s)
    expect(viewSource).toMatch(/\.pref-group-header \{[^}]*color:\s*rgb\(var\(--v-theme-secondary\)\);/s)
  })

  it('implements AppThemeModePreferenceWidget MultiChoiceSegmentedButtonRow', () => {
    // 16dp horizontal padding
    expect(viewSource).toMatch(/\.theme-mode-row \{[^}]*padding:\s*0 16px;/s)

    // SegmentedButton: 40dp height, 1dp outline border, 20dp start/end radius
    expect(viewSource).toMatch(/\.theme-mode-button \{[^}]*height:\s*40px;/s)
    expect(viewSource).toMatch(/\.theme-mode-button \{[^}]*border:\s*1px solid rgb\(var\(--v-theme-outline\)\);/s)
    expect(viewSource).toMatch(/\.theme-mode-button\.is-first \{[^}]*border-start-start-radius:\s*20px;/s)
    expect(viewSource).toMatch(/\.theme-mode-button\.is-last \{[^}]*border-start-end-radius:\s*20px;/s)

    // Active state: secondaryContainer background, onSecondaryContainer content, outline border
    expect(viewSource).toMatch(/\.theme-mode-button\.is-selected \{[^}]*background:\s*rgb\(var\(--v-theme-secondary-container\)\);/s)
    expect(viewSource).toMatch(/\.theme-mode-button\.is-selected \{[^}]*color:\s*rgb\(var\(--v-theme-on-secondary-container\)\);/s)

    // Leading check icon: 18dp
    expect(viewSource).toMatch(/\.theme-mode-button__icon \{[^}]*font-size:\s*18px;/s)
    expect(viewSource).toMatch(/\.theme-mode-button__icon \{[^}]*line-height:\s*18px;/s)
  })

  it('implements AppThemePreferenceWidget with LazyRow and 114dp items', () => {
    // LazyRow: 16dp horizontal padding, 8dp gap
    expect(viewSource).toMatch(/\.theme-list \{[^}]*gap:\s*8px;/s)
    expect(viewSource).toMatch(/\.theme-list \{[^}]*padding:\s*0 16px;/s)

    // Items: width 114dp, top padding 8dp
    expect(viewSource).toMatch(/\.theme-list-item \{[^}]*width:\s*114px;/s)
    expect(viewSource).toMatch(/\.theme-list-item \{[^}]*padding-top:\s*8px;/s)

    // Label: bodyMedium 14/20sp w400, 2 lines (min-height 40px), center, secondaryItemAlpha 0.78
    expect(viewSource).toMatch(/\.theme-list-label \{[^}]*font-size:\s*14px;/s)
    expect(viewSource).toMatch(/\.theme-list-label \{[^}]*line-height:\s*20px;/s)
    expect(viewSource).toMatch(/\.theme-list-label \{[^}]*text-align:\s*center;/s)
    expect(viewSource).toMatch(/\.theme-list-label \{[^}]*min-height:\s*40px;/s)
    expect(viewSource).toMatch(/\.theme-list-label \{[^}]*opacity:\s*0\.78;/s)
  })

  it('implements ThemePreviewItem matching Compose AppThemePreviewItem bounds', () => {
    // 9:16 ratio, 4dp border with 17dp outer radius and 13dp inner curve
    expect(previewSource).toMatch(/\.theme-preview \{[^}]*aspect-ratio:\s*9 \/ 16;/s)
    expect(previewSource).toMatch(/\.theme-preview \{[^}]*border:\s*4px solid var\(--pv-outline-variant\);/s)
    expect(previewSource).toMatch(/\.theme-preview \{[^}]*border-radius:\s*17px;/s)
    expect(previewSource).not.toMatch(/\.theme-preview \{[^}]*padding:\s*4px;/s)

    // App Bar: height 40dp, padding 8dp
    expect(previewSource).toMatch(/\.theme-preview__bar \{[^}]*height:\s*40px;/s)
    expect(previewSource).toMatch(/\.theme-preview__bar \{[^}]*padding:\s*8px;/s)

    // Cover: 50% width, 2:3 ratio
    expect(previewSource).toMatch(/\.theme-preview__cover \{[^}]*width:\s*50%;/s)
    expect(previewSource).toMatch(/\.theme-preview__cover \{[^}]*aspect-ratio:\s*2 \/ 3;/s)

    // Bottom Bar: height 32dp, surfaceContainer
    expect(previewSource).toMatch(/\.theme-preview__bottom \{[^}]*height:\s*32px;/s)
    expect(previewSource).toMatch(/\.theme-preview__bottom \{[^}]*background:\s*var\(--pv-surface-container\);/s)
  })

  it('uses Md3Switch and makes the entire row clickable matching SwitchPreferenceWidget', () => {
    // Uses Md3Switch component
    expect(viewSource).toContain('<Md3Switch')
    expect(viewSource).toContain("import Md3Switch from '@/core/components/Md3Switch.vue'")

    // Pure black switch is gated by themeMode !== 'light'
    expect(viewSource).toContain("v-if=\"preferences.themeMode !== 'light'\"")

    // Switch row is clickable with pref-row--button and role="switch"
    expect(viewSource).toMatch(/class="pref-row pref-row--button"[^>]*role="switch"[^>]*@click="appearance\.amoled\.value = !appearance\.amoled\.value"/)
    expect(viewSource).toMatch(/class="pref-row pref-row--button"[^>]*role="switch"[^>]*@click="appearance\.relativeTime\.value = !appearance\.relativeTime\.value"/)
    expect(viewSource).toMatch(/class="pref-row pref-row--button"[^>]*role="switch"[^>]*@click="appearance\.imagesInDescription\.value = !appearance\.imagesInDescription\.value"/)
  })

  it('implements ListPreference AlertDialog with DialogRow metrics and Cancel button', () => {
    // Dialog uses activeListDialog and is bound to :model-value="true"
    expect(viewSource).toContain('v-if="activeListDialog"')
    expect(viewSource).toContain(':model-value="true"')
    expect(viewSource).toContain('activeListDialog.title')

    // Dialog styling: 28dp radius, surfaceContainerHigh, 24dp padding
    expect(viewSource).toMatch(/\.appearance-dialog \{[^}]*padding:\s*24px;/s)
    expect(viewSource).toMatch(/\.appearance-dialog \{[^}]*background:\s*rgb\(var\(--v-theme-surface-container-high\)\);/s)

    // DialogRow: minInteractiveComponentSize 48dp, 8dp radius, 24dp gap
    expect(viewSource).toMatch(/\.appearance-dialog__row \{[^}]*min-height:\s*48px;/s)
    expect(viewSource).toMatch(/\.appearance-dialog__row \{[^}]*border-radius:\s*8px;/s)
    expect(viewSource).toMatch(/\.appearance-dialog__row \{[^}]*gap:\s*24px;/s)

    // Actions: Cancel TextButton (labelLarge 14/20sp w500, primary color)
    expect(viewSource).toMatch(/\.appearance-dialog__button \{[^}]*font-size:\s*14px;/s)
    expect(viewSource).toMatch(/\.appearance-dialog__button \{[^}]*font-weight:\s*500;/s)
    expect(viewSource).toMatch(/\.appearance-dialog__button \{[^}]*color:\s*rgb\(var\(--v-theme-primary\)\);/s)
  })

  it('implements AppLanguageScreen with AppBar and ListItem list', () => {
    // Screen has app bar with 64dp height and 24dp up button
    expect(viewSource).toMatch(/\.appearance-language-bar \{[^}]*height:\s*64px;/s)
    expect(viewSource).toMatch(/\.appearance-language-bar__up \{[^}]*width:\s*48px;/s)
    expect(viewSource).toMatch(/\.appearance-language-bar__up \{[^}]*height:\s*48px;/s)
    expect(viewSource).toMatch(/\.appearance-language-bar__title \{[^}]*font-size:\s*22px;/s)
    expect(viewSource).toMatch(/\.appearance-language-bar__title \{[^}]*line-height:\s*28px;/s)

    // ListItem: 72dp min-height, 16dp horizontal padding
    expect(viewSource).toMatch(/\.appearance-language-item \{[^}]*min-height:\s*72px;/s)
    expect(viewSource).toMatch(/\.appearance-language-item \{[^}]*padding:\s*10px 16px;/s)
    expect(viewSource).toMatch(/\.appearance-language-item__headline \{[^}]*font-size:\s*16px;/s)
    expect(viewSource).toMatch(/\.appearance-language-item__supporting \{[^}]*font-size:\s*14px;/s)
    expect(viewSource).toMatch(/\.appearance-language-item__check \{[^}]*font-size:\s*24px;/s)
  })

  it('calculates palerSurface matching Mihon getPalerSurface and handles pure black AMOLED', () => {
    // Pure black (#000000): 0 - 0.05 coerced to 0 -> #000000
    expect(calculatePalerSurface('#000000', true)).toBe('#000000')

    // Dark default (#1B1B1F): lightness - 5% -> #0f0f11
    expect(calculatePalerSurface('#1B1B1F', true)).toBe('#0f0f11')

    // Light default (#FEFBFF): lightness + 2% -> #ffffff
    expect(calculatePalerSurface('#FEFBFF', false)).toBe('#ffffff')
  })
})
