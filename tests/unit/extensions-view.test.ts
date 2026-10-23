import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const view = readFileSync('src/views/ExtensionsView.vue', 'utf8')
const router = readFileSync('src/router/index.ts', 'utf8')

describe('ExtensionsView pixel-parity with Mihon Compose reference', () => {
  it('registers /browse/extension/:pkgName route for ExtensionDetailsView', () => {
    expect(router).toContain('/browse/extension/:pkgName')
    expect(router).toContain('ExtensionDetailsView.vue')
  })

  it('routes to ExtensionFilterView and ExtensionStoresView from toolbar and EmptyScreen', () => {
    expect(view).toContain('/browse/extensions/filter')
    expect(view).toContain('/browse/extensions/stores')
    expect(view).toContain('openFilter')
    expect(view).toContain('openStores')
  })

  it('filters available extensions by enabledLanguages preference', () => {
    expect(view).toContain('mihon.sourceLanguages')
    expect(view).toContain('enabledLanguages')
    expect(view).toContain('activeLanguages.has(extension.lang)')
  })

  it('preserves the four reference grouping sections in exact order', () => {
    expect(view).toContain('Updates pending')
    expect(view).toContain('Not loaded')
    expect(view).toContain('Installed')
    expect(view).toContain('Update all')
  })

  it('uses typography.header tokens (14px/20px, SemiBold 600, onSurfaceVariant)', () => {
    expect(view).toMatch(/font-size:\s*14px/)
    expect(view).toMatch(/line-height:\s*20px/)
    expect(view).toMatch(/font-weight:\s*600/)
    expect(view).toContain('color: rgb(var(--v-theme-on-surface-variant))')
  })

  it('renders BaseBrowseItem with 16dp horizontal and 8dp vertical padding', () => {
    expect(view).toMatch(/padding:\s*8px 16px/)
    expect(view).toMatch(/min-height:\s*64px/)
  })

  it('renders ExtensionItemIcon with 48dp box and 4dp extraSmall clip for available', () => {
    expect(view).toMatch(/width:\s*48px/)
    expect(view).toMatch(/height:\s*48px/)
    expect(view).toContain('extension-icon--available')
    expect(view).toMatch(/border-radius:\s*4px/)
    expect(view).toContain('background: #1f888888')
  })

  it('supports notable metadata pills: Untrusted, Filtered, Orphaned, Private, content warning', () => {
    expect(view).toContain('text="Untrusted"')
    expect(view).toContain('text="Filtered"')
    expect(view).toContain('text="Orphaned"')
    expect(view).toContain('text="Private"')
    expect(view).toContain('color="on-surface-variant"')
    expect(view).toContain('color="error"')
  })

  it('renders secondary action icons: public for available, settings for loaded, verified_user for untrusted, info for not-loaded', () => {
    expect(view).toContain('>public<')
    expect(view).toContain('>settings<')
    expect(view).toContain('>verified_user<')
    expect(view).toContain('>info<')
    expect(view).toContain('>download<')
  })

  it('uses VerticalFastScroller tokens (12dp width, 6dp radius, primary thumb)', () => {
    expect(view).toMatch(/width:\s*12px/)
    expect(view).toMatch(/border-radius:\s*6px/)
    expect(view).toContain('background: rgb(var(--v-theme-primary))')
    expect(view).toMatch(/height:\s*48px/)
  })

  it('integrates ExtensionTrustDialog, ExtensionNotLoadedDialog and uninstall confirmation', () => {
    expect(view).toContain('<ExtensionTrustDialog')
    expect(view).toContain('<ExtensionNotLoadedDialog')
    expect(view).toContain('Remove Extension?')
    expect(view).toContain('Do you really want to remove')
  })

  it('uses Md3CircularProgress and MihonEmptyScreen components', () => {
    expect(view).toContain('<Md3CircularProgress')
    expect(view).toContain('<MihonEmptyScreen')
  })
})
