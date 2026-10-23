import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/reader/GeneralSettingsPage.vue'),
  'utf8',
)

const dialogSource = readFileSync(
  resolve(process.cwd(), 'src/components/reader/ReaderSettingsDialog.vue'),
  'utf8',
)

const storeSource = readFileSync(
  resolve(process.cwd(), 'src/stores/readerPreferences.ts'),
  'utf8',
)

describe('GeneralSettingsPage (Item 89) matches Mihon GeneralSettingsPage.kt', () => {
  it('references GeneralSettingsPage.kt and related Compose sources', () => {
    expect(source).toContain('GeneralSettingsPage.kt')
    expect(source).toContain('ReaderPreferences.kt')
    expect(source).toContain('ReadingMode.kt')
    expect(source).toContain('SettingsItems.kt')
    expect(source).toContain('Pill.kt')
  })

  it('renders "Background color" SettingsChipRow with 4 theme chips in exact reference order', () => {
    // SettingsChipRow(MR.strings.pref_reader_theme)
    expect(source).toContain('<h3 class="gs-heading">Background color</h3>')

    // Kotlin: Black (1), Gray (2), White (0), Auto (3)
    const blackIdx = source.indexOf("'Black'")
    const grayIdx = source.indexOf("'Gray'")
    const whiteIdx = source.indexOf("'White'")
    const autoIdx = source.indexOf("'Auto'")

    expect(blackIdx).toBeGreaterThan(0)
    expect(grayIdx).toBeGreaterThan(blackIdx)
    expect(whiteIdx).toBeGreaterThan(grayIdx)
    expect(autoIdx).toBeGreaterThan(whiteIdx)

    expect(source).toContain("value: 1") // Black
    expect(source).toContain("value: 2") // Gray
    expect(source).toContain("value: 0") // White
    expect(source).toContain("value: 3") // Auto
  })

  it('renders "Show page number" CheckboxItem', () => {
    // CheckboxItem(MR.strings.pref_show_page_number)
    expect(source).toContain('Show page number')
    expect(source).toContain('showPageNumber')
  })

  it('renders "Use vertical chapter navigator in" SettingsChipRow with all 5 ReadingMode entries', () => {
    // SettingsChipRow(MR.strings.pref_vertical_navigator)
    expect(source).toContain('<h3 class="gs-heading">Use vertical chapter navigator in</h3>')

    // ReadingMode.entries.filter { it != ReadingMode.DEFAULT }
    const ltrIdx = source.indexOf("'Paged (left to right)'")
    const rtlIdx = source.indexOf("'Paged (right to left)'")
    const verticalIdx = source.indexOf("'Paged (vertical)'")
    const webtoonIdx = source.indexOf("'Long strip'")
    const continuousIdx = source.indexOf("'Long strip with gaps'")

    expect(ltrIdx).toBeGreaterThan(0)
    expect(rtlIdx).toBeGreaterThan(ltrIdx)
    expect(verticalIdx).toBeGreaterThan(rtlIdx)
    expect(webtoonIdx).toBeGreaterThan(verticalIdx)
    expect(continuousIdx).toBeGreaterThan(webtoonIdx)
  })

  it('renders conditional vertical navigator settings when modes is not empty', () => {
    // if (verticalNavigatorModes.isNotEmpty())
    expect(source).toContain('v-if="verticalNavigatorModes.length > 0"')

    // CheckboxItem(MR.strings.pref_webtoon_vertical_navigator_on_left)
    expect(source).toContain('Place vertical navigator on the left side')
    expect(source).toContain('verticalNavigatorOnLeft')

    // SliderItem(MR.strings.pref_vertical_navigator_height, 65..100, steps = 6)
    expect(source).toContain('Vertical navigator height')
    expect(source).toContain(':min="65"')
    expect(source).toContain(':max="100"')
    expect(source).toContain(':step="5"')
    expect(source).toContain(':stop-count="7"')
  })

  it('renders "Fullscreen" and conditional "Show content in cutout area" CheckboxItems', () => {
    // CheckboxItem(MR.strings.pref_fullscreen)
    expect(source).toContain('Fullscreen')
    expect(source).toContain('fullscreen')

    // CheckboxItem(MR.strings.pref_cutout_short) conditional on isFullscreen
    expect(source).toContain('Show content in cutout area')
    expect(source).toContain('v-if="fullscreen"')
    expect(source).toContain('drawUnderCutout')
  })

  it('renders "Keep screen on" and "Show actions on long tap" CheckboxItems', () => {
    // CheckboxItem(MR.strings.pref_keep_screen_on)
    expect(source).toContain('Keep screen on')
    expect(source).toContain('keepScreenOn')

    // CheckboxItem(MR.strings.pref_read_with_long_tap)
    expect(source).toContain('Show actions on long tap')
    expect(source).toContain('readWithLongTap')
  })

  it('renders "Always show chapter transition" and "Animate page transitions" CheckboxItems', () => {
    // CheckboxItem(MR.strings.pref_always_show_chapter_transition)
    expect(source).toContain('Always show chapter transition')
    expect(source).toContain('alwaysShowChapterTransition')

    // CheckboxItem(MR.strings.pref_page_transitions)
    expect(source).toContain('Animate page transitions')
    expect(source).toContain('pageTransitions')
  })

  it('renders "Flash on page change" CheckboxItem and conditional E-Ink controls', () => {
    // CheckboxItem(MR.strings.pref_flash_page)
    expect(source).toContain('Flash on page change')
    expect(source).toContain('flashOnPageChange')

    // if (flashPageState)
    expect(source).toContain('v-if="flashOnPageChange"')

    // SliderItem(pref_flash_duration, 1..15, pillColor = surfaceContainerHighest)
    expect(source).toContain('Flash duration')
    expect(source).toContain(':min="1"')
    expect(source).toContain(':max="15"')
    expect(source).toContain(':step="1"')
    expect(source).toContain('ms')

    // SliderItem(pref_flash_page_interval, 1..10, pillColor = surfaceContainerHighest)
    expect(source).toContain('Flash every')
    expect(source).toContain(':min="1"')
    expect(source).toContain(':max="10"')
    expect(source).toContain('flashIntervalText')

    // SettingsChipRow(pref_flash_with)
    expect(source).toContain('<h3 class="gs-heading">Flash with</h3>')
    const blackIdx = source.lastIndexOf("'Black'")
    const whiteIdx = source.lastIndexOf("'White'")
    const whiteBlackIdx = source.indexOf("'White and Black'")

    expect(blackIdx).toBeGreaterThan(0)
    expect(whiteIdx).toBeGreaterThan(0)
    expect(whiteBlackIdx).toBeGreaterThan(0)
  })

  it('styles FilterChip according to Material 3 tokens', () => {
    // height 32dp, shape CornerSmall (8dp), labelLarge (14/20sp w500)
    expect(source).toMatch(/\.gs-chip \{[^}]*height: 32px;/)
    expect(source).toMatch(/\.gs-chip \{[^}]*border-radius: 8px;/)
    expect(source).toMatch(/\.gs-chip \{[^}]*font-size: 14px;/)
    expect(source).toMatch(/\.gs-chip \{[^}]*line-height: 20px;/)
    expect(source).toMatch(/\.gs-chip \{[^}]*font-weight: 500;/)
    expect(source).toMatch(/\.gs-chip \{[^}]*padding: 0 16px;/)
    // Unselected: 1px solid outline
    expect(source).toContain('border: 1px solid rgb(var(--v-theme-outline))')
    // Selected: secondaryContainer background, onSecondaryContainer color
    expect(source).toContain('background: rgb(var(--v-theme-secondary-container))')
    expect(source).toContain('color: rgb(var(--v-theme-on-secondary-container))')
  })

  it('styles CheckboxItem according to Material 3 tokens', () => {
    // min-height 48dp, padding 10dp / 24dp, gap 24dp
    expect(source).toMatch(/\.gs-checkbox \{[^}]*min-height: 48px;/)
    expect(source).toMatch(/\.gs-checkbox \{[^}]*padding: 10px 24px;/)
    expect(source).toMatch(/\.gs-checkbox \{[^}]*gap: 24px;/)
    // Checkbox box: 18x18dp, 2dp radius, 2dp border
    expect(source).toMatch(/\.gs-checkbox-box \{[^}]*width: 18px;/)
    expect(source).toMatch(/\.gs-checkbox-box \{[^}]*height: 18px;/)
    expect(source).toMatch(/\.gs-checkbox-box \{[^}]*border-radius: 2px;/)
    expect(source).toMatch(/\.gs-checkbox-box \{[^}]*border: 2px solid/)
    expect(source).toContain('rgb(var(--v-theme-primary))')
    expect(source).toContain('rgb(var(--v-theme-on-primary))')
  })

  it('styles SliderItem according to Material 3 tokens', () => {
    // Column with padding 10/24dp, gap 2dp
    expect(source).toMatch(/\.gs-slider \{[^}]*padding: 10px 24px;/)
    expect(source).toMatch(/\.gs-slider \{[^}]*gap: 2px;/)
    // Pill: surfaceContainerHigh (default) and surfaceContainerHighest for E-Ink
    expect(source).toMatch(/\.gs-pill \{[^}]*border-radius: 28px;/)
    expect(source).toMatch(/\.gs-pill \{[^}]*padding: 1px 6px;/)
    expect(source).toContain('rgb(var(--v-theme-surface-container-high))')
    expect(source).toContain('rgb(var(--v-theme-surface-container-highest))')
  })

  it('is integrated into ReaderSettingsDialog as the second tab', () => {
    expect(dialogSource).toContain("import GeneralSettingsPage from './GeneralSettingsPage.vue'")
    expect(dialogSource).toContain('<GeneralSettingsPage />')
  })

  it('provides persistent reactive preferences in readerPreferences store', () => {
    expect(storeSource).toContain('readerTheme')
    expect(storeSource).toContain('pref_reader_theme_key')
    expect(storeSource).toContain('drawUnderCutout')
    expect(storeSource).toContain('alwaysShowChapterTransition')
  })
})
