import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/settings/ReaderSettingsScreen.vue', 'utf8')
const settingsView = readFileSync('src/views/SettingsView.vue', 'utf8')

/**
 * Guards for the parity of `src/components/settings/ReaderSettingsScreen.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsReaderScreen.kt
 * (Mihon 446f6df) and the preference widgets it renders. The reference is Kotlin, so the
 * invariants are asserted on the ported order, the reference strings and the widget metrics.
 */
describe('ReaderSettingsScreen parity with Mihon', () => {
  it('keeps the reference order of the top level items and of the groups', () => {
    const order = [
      'Default reading mode',
      'Double tap animation speed',
      'Show reading mode',
      'Show tap zones overlay',
      'Animate page transitions',
      'Load ahead only on Wi-Fi',
      'Default rotation',
      'Background color',
      'Fullscreen',
      'Show content in cutout area',
      'Keep screen on',
      'Show page number',
      'Flash on page change',
      'Flash duration',
      'Flash every',
      'Flash with',
      'Skip chapters marked read',
      'Skip filtered chapters',
      'Skip duplicate chapters',
      'Always show chapter transition',
      'Tap zones',
      'Invert tap zones',
      'Scale type',
      'Zoom start position',
      'Crop borders',
      'Automatically zoom into wide images',
      'Pan wide images',
      'Split wide pages',
      'Invert split page placement',
      'Rotate wide pages to fit',
      'Flip orientation of rotated wide pages',
      'Side padding',
      'Sensitivity for hiding menu on scroll',
      'Double tap to zoom',
      'Disable zoom out',
      'Volume keys',
      'Invert volume keys',
      'Use vertical chapter navigator in',
      'Place vertical navigator on the left side',
      'Vertical navigator height',
      'Show actions on long tap',
      'Save pages into separate folders',
    ]
    // The order is asserted on the model that drives the template: only the `title:` of the
    // preference items and the `header:` of the groups are compared, in source order.
    let cursor = -1
    for (const text of order) {
      const index = source.indexOf(`title: '${text}'`)
      expect(index, `missing reference text: ${text}`).toBeGreaterThan(-1)
      expect(index, `wrong order for: ${text}`).toBeGreaterThan(cursor)
      cursor = index
    }
    // The group headers keep the reference order too.
    const headers = ['Display', 'E-Ink', 'Reading', 'Paged', 'Long strip', 'Navigation', 'Actions']
    let headerCursor = -1
    for (const text of headers) {
      const index = source.indexOf(`header: '${text}'`)
      expect(index, `missing group header: ${text}`).toBeGreaterThan(-1)
      expect(index, `wrong order for the group: ${text}`).toBeGreaterThan(headerCursor)
      headerCursor = index
    }
  })

  it('uses the reference list entries', () => {
    // ReadingMode.entries.drop(1).
    for (const label of ['Paged (left to right)', 'Paged (right to left)', 'Paged (vertical)', 'Long strip', 'Long strip with gaps']) {
      expect(source).toContain(`label: '${label}'`)
    }
    // double_tap_anim_speed_0 / _normal / _fast.
    for (const label of ['No animation', 'Normal', 'Fast']) {
      expect(source).toContain(`label: '${label}'`)
    }
    // ReaderOrientation.entries.drop(1).
    for (const label of ['Free', 'Portrait', 'Landscape', 'Locked portrait', 'Locked landscape', 'Reverse portrait']) {
      expect(source).toContain(`label: '${label}'`)
    }
    // black_background / gray_background / white_background / automatic_background.
    for (const label of ['Black', 'Gray', 'White', 'Auto']) {
      expect(source).toContain(`label: '${label}'`)
    }
    // ReaderPreferences.TapZones.
    for (const label of ['Default', 'L shaped', 'Kindle-ish', 'Edge', 'Right and Left', 'Disabled']) {
      expect(source).toContain(`label: '${label}'`)
    }
    // TappingInvertMode.
    for (const label of ['None', 'Horizontal', 'Vertical', 'Both']) {
      expect(source).toContain(`label: '${label}'`)
    }
    // ImageScaleType.
    for (const label of ['Fit screen', 'Stretch', 'Fit width', 'Fit height', 'Original size', 'Smart fit']) {
      expect(source).toContain(`label: '${label}'`)
    }
    // ZoomStart.
    for (const label of ['Automatic', 'Left', 'Right', 'Center']) {
      expect(source).toContain(`label: '${label}'`)
    }
    // ReaderHideThreshold.
    for (const label of ['Highest', 'High', 'Low', 'Lowest']) {
      expect(source).toContain(`label: '${label}'`)
    }
    // FlashColor.
    expect(source).toContain("label: 'White and Black'")
  })

  it('reproduces the reference visibility rules', () => {
    // drawUnderCutout is only visible on a device with a cutout, and only while fullscreen is on.
    expect(source).toContain('if (fullscreen.value) display.push(')
    // The E-Ink sliders and the flash colour only exist while the flash is on.
    expect(source).toContain('if (flashOnPageChange.value) {')
    // The inverted tap zones and "Pan wide images" are hidden when the tap zones are disabled.
    expect(source).toContain("if (navigationModePager.value !== '5')")
    expect(source).toContain("if (navigationModeWebtoon.value !== '5')")
    // "Automatically zoom into wide images" only exists for the "Fit screen" scale type.
    expect(source).toContain('if (imageScaleType.value === 1)')
    // The dependent dual page items follow their parents.
    expect(source).toContain('if (dualPageSplitPaged.value)')
    expect(source).toContain('if (dualPageRotateToFit.value)')
    expect(source).toContain('if (dualPageSplitWebtoon.value)')
    expect(source).toContain('if (dualPageRotateToFitWebtoon.value)')
    // The volume key inversion follows the volume keys switch.
    expect(source).toContain('if (readWithVolumeKeys.value)')
    // The vertical navigator items follow a non empty selection.
    expect(source).toContain('if (verticalNavigator.value) {')
  })

  it('uses the reference slider ranges and value texts', () => {
    // flashDurationMillis: MILLI_CONVERSION..MILLI_CONVERSION * 15 step MILLI_CONVERSION.
    expect(source).toContain('min: 100, max: 1500, step: 100')
    expect(source).toContain('`${flashDurationMillis.value} ms`')
    // flashPageInterval: 1..10 with the "pages" plural.
    expect(source).toContain('min: 1, max: 10, step: 1')
    expect(source).toContain("flashPageInterval.value === 1 ? '1 page' : `${flashPageInterval.value} pages`")
    // webtoonSidePadding: WEBTOON_PADDING_MIN..WEBTOON_PADDING_MAX shown as a percentage.
    expect(source).toContain('min: 0, max: 25, step: 1')
    expect(source).toContain('`${webtoonSidePadding.value}%`')
    // verticalNavigatorHeight: 65..100.
    expect(source).toContain('min: 65, max: 100, step: 5')
  })

  it('uses the reference widget metrics', () => {
    // PreferenceGroupHeader.kt: bodyMedium, secondary, padding(top 14dp, bottom 8dp, horizontal 16dp).
    expect(source).toMatch(/\.pref-group-header \{[^}]*padding: 14px 16px 8px;/s)
    expect(source).toMatch(/\.pref-group-header \{[^}]*font-size: 14px;/s)
    expect(source).toMatch(/\.pref-group-header \{[^}]*line-height: 20px;/s)
    expect(source).toMatch(/\.pref-group-header \{[^}]*color: rgb\(var\(--v-theme-secondary\)\);/s)
    // BasePreferenceWidget.kt: 56dp minimum height, 16dp padding, title 16sp, subtitle bodySmall @ .78.
    expect(source).toMatch(/\.pref-row \{[^}]*min-height: 56px;/s)
    expect(source).toMatch(/\.pref-row \{[^}]*padding: 16px;/s)
    expect(source).toMatch(/\.pref-title \{[^}]*font-size: 16px;/s)
    expect(source).toMatch(/\.pref-title \{[^}]*line-height: 24px;/s)
    expect(source).toMatch(/\.pref-subtitle \{[^}]*font-size: 12px;/s)
    expect(source).toMatch(/\.pref-subtitle \{[^}]*line-height: 16px;/s)
    expect(source).toMatch(/\.pref-subtitle \{[^}]*78%, transparent\);/s)
    // The trailing widget box keeps the 16dp buffer.
    expect(source).toMatch(/\.pref-trailing \{ padding-inline-end: 16px; \}/)
    // BaseSliderItem.kt: 16dp padding, pill with the surfaceContainerHigh colour.
    expect(source).toMatch(/\.pref-slider \{[^}]*padding: 16px;/s)
    expect(source).toMatch(/\.pref-pill \{[^}]*background: rgb\(var\(--v-theme-surface-container-high\)\);/s)
    // PreferenceScreen.kt: 12dp spacer between the groups.
    expect(source).toMatch(/\.pref-group-spacer \{ height: 12px; \}/)
  })

  it('reproduces the list and multi select dialog semantics', () => {
    // ListPreferenceWidget.kt: a radio row per entry and a single "Cancel" confirm button.
    expect(source).toContain('role="radio"')
    expect(source).toContain(">Cancel</v-btn>")
    // MultiSelectListPreferenceWidget.kt: a checkbox per entry, "OK" and "Cancel".
    expect(source).toContain('role="checkbox"')
    expect(source).toContain('>OK</v-btn>')
    // The multi select subtitle is the joined labels, or "None" (MR.strings.none).
    expect(source).toContain("return labels.length ? labels.join(', ') : 'None'")
  })

  it('states plainly that the Android-only preferences are not supported in the web version', () => {
    expect(source).toContain('Not supported in the web version: this is an Android reader feature.')
    // The Android-only rows keep the reference layout but disable their control.
    expect(source).toContain(':disabled="!item.supported"')
    expect(source).toMatch(/supported: false, note: unsupported/g)
  })

  it('is mounted by the reader section of the settings screen', () => {
    expect(settingsView).toContain("import ReaderSettingsScreen from '../components/settings/ReaderSettingsScreen.vue'")
    expect(settingsView).toContain('<ReaderSettingsScreen />')
  })
})
