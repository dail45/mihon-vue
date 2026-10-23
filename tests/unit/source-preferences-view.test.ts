import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const view = readFileSync('src/views/SourcePreferencesView.vue', 'utf8')
const router = readFileSync('src/router/index.ts', 'utf8')

describe('SourcePreferencesView matches Mihon SourcePreferencesScreen.kt and preference widgets', () => {
  it('registers route with detail, catalogue, and ownToolbar', () => {
    expect(router).toContain("path: '/browse/source/:sourceId/preferences'")
    expect(router).toContain('ownToolbar: true')
    expect(router).toContain('catalogue: true')
  })

  it('renders LoadingScreen without an app bar while source is unresolved', () => {
    expect(view).toContain('v-if="loadingSource && !source"')
    expect(view).toContain('<Md3CircularProgress :size="40" :stroke="4"')
    expect(view).toMatch(/\.preferences-loading\s*\{[^}]*min-height:\s*100dvh/)
  })

  it('renders 64dp TopAppBar with source title and arrow_back navigation', () => {
    expect(view).toContain('class="preference-toolbar"')
    expect(view).toContain('class="preference-toolbar-nav"')
    expect(view).toContain('arrow_back')
    expect(view).toContain('class="preference-toolbar-title"')
    // M3 TopAppBar tokens: height 64px, titleLarge (22sp / 28sp w400).
    expect(view).toMatch(/\.preference-toolbar\s*\{[^}]*height:\s*64px/)
    expect(view).toMatch(/font-size:\s*22px;\s*line-height:\s*28px;\s*font-weight:\s*400/)
    // Title format: "$name (${lang.uppercase()})" matching HttpSource.kt / StubSource.kt.
    expect(view).toContain('current.lang.toUpperCase()')
  })

  it('renders MihonEmptyScreen for error and empty states', () => {
    expect(view).toContain('<MihonEmptyScreen')
    expect(view).toContain('No preferences available')
  })

  it('renders PreferenceGroupHeader with secondary color and M3 typography', () => {
    expect(view).toContain('preference-category-title')
    expect(view).toMatch(/\.preference-category\s*\{[^}]*padding:\s*14px 16px 8px 16px/)
    expect(view).toMatch(/\.preference-category-title\s*\{[^}]*font-size:\s*14px;\s*line-height:\s*20px;\s*font-weight:\s*500/)
    expect(view).toContain('color: rgb(var(--v-theme-secondary))')
  })

  it('renders BasePreferenceWidget with minHeight 56dp and titleLarge 16sp', () => {
    expect(view).toMatch(/\.preference-row\s*\{[^}]*min-height:\s*56px/)
    expect(view).toMatch(/\.preference-title\s*\{[^}]*font-size:\s*16px;\s*line-height:\s*24px;\s*font-weight:\s*400/)
    expect(view).toMatch(/\.preference-summary\s*\{[^}]*font-size:\s*12px;\s*line-height:\s*16px/)
  })

  it('renders SwitchPreferenceWidget with Md3Switch', () => {
    expect(view).toContain('<Md3Switch')
    expect(view).toContain("row.kind === 'switch'")
  })

  it('renders CheckBoxPreference with M3 Checkbox in trailing slot', () => {
    expect(view).toContain("row.kind === 'checkbox'")
    expect(view).toContain('preference-checkbox-box')
    expect(view).toMatch(/\.preference-checkbox-box\s*\{[^}]*width:\s*20px;\s*height:\s*20px;\s*border:\s*2px solid/)
  })

  it('renders ListPreference dialog with RadioButton and immediate select-and-apply', () => {
    expect(view).toContain("activeKind === 'list'")
    expect(view).toContain('onListSelectAndApply')
    expect(view).toContain('pref-radio')
    expect(view).toMatch(/\.pref-radio\s*\{[^}]*width:\s*20px;\s*height:\s*20px;\s*border:\s*2px solid/)
    expect(view).toMatch(/\.pref-dialog-row\s*\{[^}]*min-height:\s*48px/)
  })

  it('renders MultiSelectListPreference dialog with Checkbox items and Cancel/OK', () => {
    expect(view).toContain("activeKind === 'multiselect'")
    expect(view).toContain('onMultiToggle')
  })

  it('renders EditTextPreference dialog with OutlinedTextField and error/clear icon', () => {
    expect(view).toContain("activeKind === 'text'")
    expect(view).toContain('pref-outlined-field')
    expect(view).toContain('pref-field-error-icon')
    expect(view).toContain('pref-field-clear-btn')
    expect(view).toContain('autocomplete="off"')
    expect(view).toContain('autocorrect="off"')
    expect(view).toContain('spellcheck="false"')
  })

  it('renders InfoWidget with info icon and bodySmall text', () => {
    expect(view).toContain("row.kind === 'info'")
    expect(view).toContain('preference-info')
    expect(view).toContain('preference-info-icon')
    expect(view).toContain('preference-info-text')
  })

  it('formats ListPreference summary with %s replaced by entry name', () => {
    expect(view).toContain("summary.split('%s').join(entry)")
  })
})
