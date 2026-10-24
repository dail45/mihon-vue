import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { APP_LOCALE_TAGS, appLanguages, deviceDisplayName, localizedDisplayName, normalizeLocaleTag } from '../../src/utils/appLanguage'

const viewSource = readFileSync('src/features/settings/views/AppLanguageView.vue', 'utf8')

describe('app language list', () => {
  it('ships the same translations as the Mihon locales_config.xml', () => {
    // The generated res/xml/locales_config.xml of the Mihon i18n module: every non-empty
    // moko-resources folder, with `base` -> `en`, `-r` -> `-` and `+` -> `-`.
    expect(APP_LOCALE_TAGS).toHaveLength(68)
    expect(APP_LOCALE_TAGS).toContain('en')
    expect(APP_LOCALE_TAGS).toContain('ka-GE')
    expect(APP_LOCALE_TAGS).toContain('nb-NO')
    expect(APP_LOCALE_TAGS).toContain('pt-BR')
    expect(APP_LOCALE_TAGS).toContain('zh-CN')
    expect(APP_LOCALE_TAGS).toContain('zh-TW')
    // `az` and `tt` ship empty resource folders, so the generator skips them.
    expect(APP_LOCALE_TAGS).not.toContain('az')
    expect(APP_LOCALE_TAGS).not.toContain('tt')
  })

  it('puts the Default entry first and sorts the rest by the localized display name', () => {
    const languages = appLanguages('en')
    expect(languages[0]).toEqual({ tag: '', displayName: 'Default', localizedDisplayName: null })
    const headlines = languages.slice(1).map(item => item.displayName)
    expect(headlines).toEqual([...headlines].sort())
  })

  it('maps the Chinese tags to their script subtags', () => {
    expect(normalizeLocaleTag('zh-CN')).toBe('zh-Hans')
    expect(normalizeLocaleTag('zh-TW')).toBe('zh-Hant')
    expect(normalizeLocaleTag('de')).toBe('de')
    expect(deviceDisplayName('zh-CN', 'en')).toBe('Chinese (Simplified)')
    expect(deviceDisplayName('pt-BR', 'en')).toBe('Portuguese (Brazil)')
  })

  it('shows the language name in the language itself as the headline', () => {
    expect(localizedDisplayName('de')).toBe('Deutsch')
    expect(localizedDisplayName('fr')).toBe('Français')
    expect(deviceDisplayName('de', 'en')).toBe('German')
    expect(deviceDisplayName('fr', 'en')).toBe('French')
  })
})

describe('AppLanguageView parity with Mihon AppLanguageScreen.kt', () => {
  it('implements Material 3 TopAppBar matching AppBar.kt and AppLanguageScreen.kt', () => {
    // TopAppBar: height 64dp, surface container, surface color
    expect(viewSource).toMatch(/\.al-topbar[^{]*\{[^}]*height:\s*64px;/s)
    expect(viewSource).toMatch(/\.al-topbar[^{]*\{[^}]*min-height:\s*64px;/s)
    expect(viewSource).toMatch(/\.al-topbar[^{]*\{[^}]*background:\s*rgb\(var\(--v-theme-surface\)\);/s)

    // Up icon button: 48x48dp interactive touch target, 24dp icon, aria-label "Navigate up"
    expect(viewSource).toMatch(/\.al-topbar__up[^{]*\{[^}]*width:\s*48px;/s)
    expect(viewSource).toMatch(/\.al-topbar__up[^{]*\{[^}]*height:\s*48px;/s)
    expect(viewSource).toMatch(/aria-label="Navigate up"/)
    expect(viewSource).toMatch(/icon="arrow_back"/)

    // Up button M3 state layers: hover 8%, active 12%
    expect(viewSource).toMatch(/\.al-topbar__up:hover[^{]*\{[^}]*background:\s*color-mix\(in srgb, rgb\(var\(--v-theme-on-surface\)\) 8%, transparent\);/s)
    expect(viewSource).toMatch(/\.al-topbar__up:active[^{]*\{[^}]*background:\s*color-mix\(in srgb, rgb\(var\(--v-theme-on-surface\)\) 12%, transparent\);/s)

    // Title: titleLarge (22sp / 28sp w400)
    expect(viewSource).toMatch(/\.al-topbar__title[^{]*\{[^}]*font-size:\s*22px;/s)
    expect(viewSource).toMatch(/\.al-topbar__title[^{]*\{[^}]*line-height:\s*28px;/s)
    expect(viewSource).toMatch(/\.al-topbar__title[^{]*\{[^}]*font-weight:\s*400;/s)
    expect(viewSource).toContain('App language')
  })

  it('implements Material 3 ListItem metrics and state layers matching AppLanguageScreen.kt', () => {
    // Single-line (Default item): min-height 56dp, padding 8dp 16dp
    expect(viewSource).toMatch(/\.al-item[^{]*\{[^}]*min-height:\s*56px;/s)
    expect(viewSource).toMatch(/\.al-item[^{]*\{[^}]*padding:\s*8px 16px;/s)

    // Two-line items: min-height 72dp, padding 10dp 16dp
    expect(viewSource).toMatch(/\.al-item--two-line[^{]*\{[^}]*min-height:\s*72px;/s)
    expect(viewSource).toMatch(/\.al-item--two-line[^{]*\{[^}]*padding:\s*10px 16px;/s)

    // M3 state layers on list items: hover 8%, active 12%
    expect(viewSource).toMatch(/\.al-item:hover[^{]*\{[^}]*background:\s*color-mix\(in srgb, rgb\(var\(--v-theme-on-surface\)\) 8%, transparent\);/s)
    expect(viewSource).toMatch(/\.al-item:active[^{]*\{[^}]*background:\s*color-mix\(in srgb, rgb\(var\(--v-theme-on-surface\)\) 12%, transparent\);/s)

    // Item typography: headline bodyLarge (16/24sp w400), supporting bodyMedium (14/20sp w400)
    expect(viewSource).toMatch(/\.al-headline[^{]*\{[^}]*font-size:\s*16px;/s)
    expect(viewSource).toMatch(/\.al-headline[^{]*\{[^}]*line-height:\s*24px;/s)
    expect(viewSource).toMatch(/\.al-supporting[^{]*\{[^}]*font-size:\s*14px;/s)
    expect(viewSource).toMatch(/\.al-supporting[^{]*\{[^}]*line-height:\s*20px;/s)

    // Selected item indicator: Check icon 24dp with primary tint
    expect(viewSource).toMatch(/v-if="currentLanguage === language\.tag"/)
    expect(viewSource).toMatch(/icon="check"/)
    expect(viewSource).toMatch(/size="24"/)
    expect(viewSource).toMatch(/color="primary"/)
  })

  it('implements Material 3 Snackbar for web notice', () => {
    expect(viewSource).toMatch(/\.al-snackbar[^{]*\{[^}]*border-radius:\s*4px;/s)
    expect(viewSource).toMatch(/\.al-snackbar[^{]*\{[^}]*background:\s*rgb\(var\(--v-theme-inverse-surface\)\);/s)
    expect(viewSource).toMatch(/\.al-snackbar[^{]*\{[^}]*color:\s*rgb\(var\(--v-theme-inverse-on-surface\)\);/s)
  })
})
