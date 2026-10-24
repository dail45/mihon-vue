import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const view = readFileSync('src/features/browse/views/ExtensionDetailsView.vue', 'utf8')
const router = readFileSync('src/router/index.ts', 'utf8')

describe('ExtensionDetailsView pixel-parity with Mihon ExtensionDetailsScreen.kt', () => {
  it('registers /browse/extension/:pkgName in router mapping to ExtensionDetailsView.vue', () => {
    expect(router).toContain('/browse/extension/:pkgName')
    expect(router).toContain('ExtensionDetailsView.vue')
  })

  it('contains AppBar with title "Extension info", navigateUp back arrow and overflow menu', () => {
    expect(view).toContain('Extension info')
    expect(view).toContain('arrow_back')
    expect(view).toContain('more_vert')
    expect(view).toContain('Enable all')
    expect(view).toContain('Disable all')
    expect(view).toContain('Clear cookies')
  })

  it('renders WarningBanner for obsolete extensions with error background and 16dp padding', () => {
    expect(view).toContain('This extension is not associated with any store')
    expect(view).toContain('Uninstalling it is recommended')
    expect(view).toMatch(/\.ext-details-banner\s*\{[^}]*padding:\s*16px/)
    expect(view).toMatch(/\.ext-details-banner\s*\{[^}]*background:\s*rgb\(var\(--v-theme-error\)\)/)
    expect(view).toMatch(/\.ext-details-banner\s*\{[^}]*color:\s*rgb\(var\(--v-theme-on-error\)\)/)
    expect(view).toMatch(/\.ext-details-banner\s*\{[^}]*text-align:\s*center/)
  })

  it('DetailsHeader identity block has 112dp icon, headlineSmall name, bodySmall pkgName, labelLarge store link and Private pill', () => {
    expect(view).toMatch(/\.ext-details-icon\s*\{[^}]*width:\s*112px;\s*height:\s*112px/)
    expect(view).toMatch(/\.ext-details-name\s*\{[^}]*font-size:\s*24px;\s*line-height:\s*32px;\s*font-weight:\s*400/)
    expect(view).toMatch(/\.ext-details-package\s*\{[^}]*font-size:\s*12px;\s*line-height:\s*16px/)
    expect(view).toMatch(/\.ext-details-store\s*\{[^}]*font-size:\s*14px;\s*line-height:\s*20px;\s*font-weight:\s*500/)
    expect(view).toContain('ExtensionPill')
    expect(view).toContain('text="Private"')
  })

  it('DetailsHeader identity block click copies debug information in exact reference format', () => {
    expect(view).toContain('Extension name:')
    expect(view).toContain('Extension version:')
    expect(view).toContain('lib:')
    expect(view).toContain('version code:')
    expect(view).toContain('Content warning:')
    expect(view).toContain('Update available:')
    expect(view).toContain('Orphaned:')
    expect(view).toContain('Shared:')
    expect(view).toContain('Repository:')
  })

  it('renders InfoText columns: Version, Language, Warning with 24dp vertical divider', () => {
    expect(view).toContain('Version')
    expect(view).toContain('Language')
    expect(view).toContain('Warning ⓘ')
    expect(view).toMatch(/\.ext-details-info-divider\s*\{[^}]*width:\s*1px;\s*height:\s*24px;\s*margin:\s*0 8px/)
    expect(view).toMatch(/\.ext-details-info-primary\s*\{[^}]*font-size:\s*14px;\s*line-height:\s*20px;\s*font-weight:\s*500/)
    expect(view).toMatch(/\.ext-details-info-secondary\s*\{[^}]*font-size:\s*12px;\s*line-height:\s*16px/)
  })

  it('supports MIXED (primary) and NSFW (error) content warning colors', () => {
    expect(view).toContain('.ext-details-info-primary.is-error')
    expect(view).toContain('.ext-details-info-primary.is-primary')
    expect(view).toContain('ContentWarningDialog')
  })

  it('renders action buttons: OutlinedButton Uninstall and filled Button App info (when isShared)', () => {
    expect(view).toContain('Uninstall')
    expect(view).toContain('App info')
    expect(view).toMatch(/\.ext-details-button--outlined\s*\{[^}]*border:\s*1px solid rgb\(var\(--v-theme-outline\)\)/)
    expect(view).toMatch(/\.ext-details-button--filled\s*\{[^}]*background:\s*rgb\(var\(--v-theme-primary\)\)/)
    expect(view).toMatch(/\.ext-details-button\s*\{[^}]*height:\s*40px;\s*padding:\s*0 24px;\s*border-radius:\s*20px/)
  })

  it('renders Incognito mode preference with exact Eyeglasses2 icon and Md3Switch', () => {
    expect(view).toContain('Incognito mode')
    expect(view).toContain('Pause reading history for extension')
    // Eyeglasses2 reference SVG path from Mihon icons
    expect(view).toContain('M218-320q-42 0-75.5-27T100-416L71-550h-4q-17 2-29.5-9T23-587')
    expect(view).toContain('Md3Switch')
  })

  it('renders SourceSwitchPreference with source toggling, settings button and Md3Switch', () => {
    expect(view).toContain('toggleSource')
    expect(view).toContain('openSourcePreferences')
    expect(view).toContain('isConfigurable')
    expect(view).toContain('aria-label="Settings"')
    expect(view).toContain('DISABLED_SOURCES_KEY')
    expect(view).toContain('mihon.disabledSources')
  })

  it('renders M3 AlertDialog stub notice for unexecutable web features', () => {
    expect(view).toContain('Not supported in the web version')
    expect(view).toContain('ext-details-dialog')
    expect(view).toMatch(/border-radius:\s*28px/)
    expect(view).toMatch(/background:\s*rgb\(var\(--v-theme-surface-container-high\)\)/)
  })
})
