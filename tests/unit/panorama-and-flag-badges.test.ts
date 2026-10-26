import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { getFlagSvg, getLanguageFlag, LANG_TO_COUNTRY, COUNTRY_FLAGS } from '@/core/utils/flags'

describe('3.6 Panorama Comfortable Grid & Cover-Flow Modes', () => {
  it('defines comfortable-panorama in preferences store', () => {
    const preferencesSource = readFileSync('src/features/settings/stores/preferences.ts', 'utf8')
    expect(preferencesSource).toContain("'comfortable-panorama'")
    expect(preferencesSource).toMatch(/export\s+type\s+DisplayMode\s*=\s*['"]compact['"]\s*\|\s*['"]comfortable['"]\s*\|\s*['"]comfortable-panorama['"]/)
  })

  it('provides "Comfortable grid (panorama)" option in LibraryDisplaySettings.vue', () => {
    const displaySettingsSource = readFileSync('src/features/library/components/LibraryDisplaySettings.vue', 'utf8')
    expect(displaySettingsSource).toContain('comfortable-panorama')
    expect(displaySettingsSource).toMatch(/action_display_comfortable_grid_panorama|Comfortable grid \(panorama\)/)
  })

  it('configures 16/9 aspect-ratio and object-fit cover in LibraryComfortableGridItem.vue', () => {
    const itemSource = readFileSync('src/features/library/components/LibraryComfortableGridItem.vue', 'utf8')
    expect(itemSource).toContain('comfortable-cover-panorama')
    expect(itemSource).toContain('aspect-ratio: 16 / 9')
    expect(itemSource).toContain('object-fit: cover')
  })

  it('allocates wider grid column min-width (220px..280px) for panorama in LibraryPager and styles', () => {
    const pagerSource = readFileSync('src/features/library/components/LibraryPager.vue', 'utf8')
    expect(pagerSource).toContain('library-pager-panorama')
    expect(pagerSource).toMatch(/minmax\(min\(100%,\s*2[2-8]0px\),\s*1fr\)/)

    const mainScss = readFileSync('src/styles/main.scss', 'utf8')
    expect(mainScss).toContain('library-grid-panorama')
    expect(mainScss).toMatch(/minmax\(min\(100%,\s*2[2-8]0px\),\s*1fr\)/)
  })
})

describe('3.7 FlagKit Country Icons & Source Favicon Badges', () => {
  it('exports valid SVG country flags and ISO language mappings', () => {
    expect(LANG_TO_COUNTRY).toBeDefined()
    expect(COUNTRY_FLAGS).toBeDefined()

    // Test essential ISO language mappings
    expect(LANG_TO_COUNTRY['en']).toBe('us')
    expect(LANG_TO_COUNTRY['ja']).toBe('jp')
    expect(LANG_TO_COUNTRY['ko']).toBe('kr')
    expect(LANG_TO_COUNTRY['zh']).toBe('cn')
    expect(LANG_TO_COUNTRY['ru']).toBe('ru')
    expect(LANG_TO_COUNTRY['es']).toBe('es')
    expect(LANG_TO_COUNTRY['fr']).toBe('fr')
    expect(LANG_TO_COUNTRY['de']).toBe('de')
    expect(LANG_TO_COUNTRY['all']).toBe('un')

    // Test getFlagSvg returns clean SVG markup
    const usFlag = getFlagSvg('en')
    expect(usFlag).toContain('<svg')
    expect(usFlag).toContain('</svg>')

    const jpFlag = getFlagSvg('ja')
    expect(jpFlag).toContain('<svg')
    expect(jpFlag).toContain('</svg>')

    const ruFlag = getFlagSvg('ru')
    expect(ruFlag).toContain('<svg')
    expect(ruFlag).toContain('</svg>')

    const zhFlag = getLanguageFlag('zh')
    expect(zhFlag).toContain('<svg')

    // Test regional tags
    const brFlag = getFlagSvg('pt-BR')
    expect(brFlag).toContain('<svg')

    // Test fallback to globe
    const fallbackFlag = getFlagSvg('unknown-lang-code')
    expect(fallbackFlag).toContain('<svg')
    expect(fallbackFlag).toBe(COUNTRY_FLAGS.globe)
  })

  it('adds useLangIcon and sourceBadge preferences with correct defaults', () => {
    const preferencesSource = readFileSync('src/features/settings/stores/preferences.ts', 'utf8')
    expect(preferencesSource).toContain("bool('mihon.library.useLangIcon', true)")
    expect(preferencesSource).toContain("bool('mihon.library.sourceBadge', false)")
    expect(preferencesSource).toContain('useLangIcon')
    expect(preferencesSource).toContain('sourceBadge')
  })

  it('adds switches for language flag icon and source icon badge in LibraryDisplaySettings.vue', () => {
    const displaySettingsSource = readFileSync('src/features/library/components/LibraryDisplaySettings.vue', 'utf8')
    expect(displaySettingsSource).toContain('prefs.useLangIcon')
    expect(displaySettingsSource).toContain('prefs.sourceBadge')
    expect(displaySettingsSource).toMatch(/action_display_language_icon|Show language flag icon/)
    expect(displaySettingsSource).toMatch(/action_display_source_badge|Show source icon badge/)
  })

  it('renders flag SVG and source favicon in MangaBadges.vue', () => {
    const badgesSource = readFileSync('src/features/manga/components/MangaBadges.vue', 'utf8')
    expect(badgesSource).toContain('getFlagSvg')
    expect(badgesSource).toContain('prefs.useLangIcon')
    expect(badgesSource).toContain('prefs.sourceBadge')
    expect(badgesSource).toContain('/source/')
    expect(badgesSource).toContain('/icon')
    expect(badgesSource).toContain('manga-badge-flag')
    expect(badgesSource).toContain('manga-badge-favicon')
  })

  it('correctly resolves source.iconUrl and triggers loadSources for sourceBadge', () => {
    const badgesSource = readFileSync('src/features/manga/components/MangaBadges.vue', 'utf8')
    expect(badgesSource).toContain('server.loadSources()')
    expect(badgesSource).toContain('source?.iconUrl')
    expect(badgesSource).toContain('server.apiUrl.replace')
    expect(badgesSource).toContain('onSourceIconError')
    expect(badgesSource).toMatch(/\.manga-badge-favicon\s*\{[^}]*width:\s*18px/)
    expect(badgesSource).toMatch(/\.manga-badge-favicon\s*\{[^}]*height:\s*18px/)
    expect(badgesSource).toMatch(/\.manga-badge-favicon\s*\{[^}]*border-radius:\s*4px/)
  })

  it('contains English and Russian i18n keys for panorama and badges', () => {
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'))
    const ru = JSON.parse(readFileSync('src/locales/ru.json', 'utf8'))

    expect(en['action_display_comfortable_grid_panorama']).toBe('Comfortable grid (panorama)')
    expect(en['action_display_language_icon']).toBe('Show language flag icon')
    expect(en['action_display_source_badge']).toBe('Show source icon badge')

    expect(ru['action_display_comfortable_grid_panorama']).toBe('Удобная сетка (панорама)')
    expect(ru['action_display_language_icon']).toBe('Показывать значок флага языка')
    expect(ru['action_display_source_badge']).toBe('Показывать значок источника')
  })
})
