import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const viewSource = readFileSync('src/views/SettingsView.vue', 'utf8')
const routerSource = readFileSync('src/router/index.ts', 'utf8')

describe('SettingsMainScreen parity with Mihon', () => {
  it('keeps the exact 10 Mihon sections in strict reference order with correct icons and summaries', () => {
    const expectedSections = [
      { title: 'Appearance', subtitle: 'Theme, date & time format', icon: 'palette', section: 'appearance' },
      { title: 'Library', subtitle: 'Categories, global update, chapter swipe', icon: 'collections_bookmark', section: 'library' },
      { title: 'Reader', subtitle: 'Reading mode, display, navigation', icon: 'chrome_reader_mode', section: 'reader' },
      { title: 'Downloads', subtitle: 'Automatic download, download ahead', icon: 'download', section: 'downloads' },
      { title: 'Tracking', subtitle: 'One-way progress sync, enhanced sync', icon: 'sync', section: 'tracking' },
      { title: 'Browse', subtitle: 'Sources, extensions, global search', icon: 'explore', section: 'browse' },
      { title: 'Data and storage', subtitle: 'Manual & automatic backups, storage space', icon: 'storage', section: 'data' },
      { title: 'Security and privacy', subtitle: 'App lock, secure screen', icon: 'security', section: 'security' },
      { title: 'Advanced', subtitle: 'Dump crash logs, battery optimizations', icon: 'code', section: 'advanced' },
      { title: 'About', icon: 'info', section: 'about' },
    ]

    let cursor = -1
    for (const s of expectedSections) {
      const idx = viewSource.indexOf(`title: '${s.title}'`)
      expect(idx, `missing section title: ${s.title}`).toBeGreaterThan(-1)
      expect(idx, `wrong order for section: ${s.title}`).toBeGreaterThan(cursor)
      cursor = idx

      if (s.subtitle) {
        expect(viewSource).toContain(`subtitle: '${s.subtitle}'`)
      }
      expect(viewSource).toContain(`icon: '${s.icon}'`)
      expect(viewSource).toContain(`section: '${s.section}'`)
    }
  })

  it('renders Scaffold and TopAppBar with 64dp height, surface container, Navigate up, and Search action', () => {
    expect(viewSource).toContain('height: 64px')
    expect(viewSource).toContain('min-height: 64px')
    expect(viewSource).toContain('background: rgb(var(--v-theme-surface))')
    expect(viewSource).toContain('aria-label="Navigate up"')
    expect(viewSource).toContain('title="Navigate up"')
    expect(viewSource).toContain('arrow_back')
    expect(viewSource).toContain('aria-label="Search"')
    expect(viewSource).toContain('title="Search"')
    expect(viewSource).toContain('icon="search"')
    expect(viewSource).toContain("router.push('/settings/search')")
    expect(viewSource).toContain("router.push('/more')")
  })

  it('implements Material 3 IconButton metrics with 48x48dp target, 40dp state layer, and hover/active layers', () => {
    expect(viewSource).toMatch(/\.settings-icon-btn \{[^}]*width: 48px;/s)
    expect(viewSource).toMatch(/\.settings-icon-btn \{[^}]*height: 48px;/s)
    expect(viewSource).toMatch(/\.settings-icon-btn::before \{[^}]*width: 40px;/s)
    expect(viewSource).toMatch(/\.settings-icon-btn::before \{[^}]*height: 40px;/s)
    expect(viewSource).toMatch(/\.settings-icon-btn::before \{[^}]*border-radius: 50%;/s)
    expect(viewSource).toMatch(/\.settings-icon-btn:hover::before \{[^}]*opacity: 0\.08;/s)
    expect(viewSource).toMatch(/\.settings-icon-btn:active::before \{[^}]*opacity: 0\.12;/s)
  })

  it('implements BasePreferenceWidget metrics (56dp min-height, 16dp padding, 24dp icon, 16sp title, 12sp subtitle at 0.78 alpha)', () => {
    expect(viewSource).toMatch(/\.pref-row \{[^}]*min-height: 56px;/s)
    expect(viewSource).toMatch(/\.pref-icon \{[^}]*padding-inline: 16px 8px;/s)
    expect(viewSource).toMatch(/\.pref-text \{[^}]*padding-block: 16px;/s)
    expect(viewSource).toMatch(/\.pref-text \{[^}]*padding-inline: 16px;/s)
    expect(viewSource).toMatch(/\.pref-title \{[^}]*font-size: 16px;/s)
    expect(viewSource).toMatch(/\.pref-title \{[^}]*line-height: 24px;/s)
    expect(viewSource).toMatch(/\.pref-title \{[^}]*font-weight: 400;/s)
    expect(viewSource).toMatch(/\.pref-subtitle \{[^}]*font-size: 12px;/s)
    expect(viewSource).toMatch(/\.pref-subtitle \{[^}]*line-height: 16px;/s)
    expect(viewSource).toMatch(/\.pref-subtitle \{[^}]*color: color-mix\(in srgb, currentColor 78%, transparent\);/s)
    expect(viewSource).toMatch(/\.pref-row:hover \{[^}]*background: color-mix\(in srgb, rgb\(var\(--v-theme-on-surface\)\) 8%, transparent\);/s)
    expect(viewSource).toMatch(/\.pref-row:active \{[^}]*background: color-mix\(in srgb, rgb\(var\(--v-theme-on-surface\)\) 12%, transparent\);/s)
  })

  it('implements TwoPanelBox layout with firstWidth up to 450dp and getPalerSurface color for left navigation', () => {
    expect(viewSource).toMatch(/\.settings-two-pane \{[^}]*grid-template-columns: min\(50%, 450px\) 1fr;/s)
    expect(viewSource).toContain('#ffffff')
    expect(viewSource).toContain('#0f0f11')
    expect(viewSource).toMatch(/\.settings-two-pane \.pref-row \{[^}]*border-radius: 24px;/s)
    expect(viewSource).toMatch(/\.settings-two-pane \.pref-row \{[^}]*margin-inline: 8px;/s)
    expect(viewSource).toMatch(/\.settings-two-pane \.pref-row\.is-selected \{[^}]*background: rgb\(var\(--v-theme-surface-variant\)\);/s)
    expect(viewSource).toMatch(/\.settings-two-pane \.pref-row\.is-selected \{[^}]*color: rgb\(var\(--v-theme-on-surface-variant\)\);/s)
  })

  it('integrates full sub-screens: Appearance, Library, Reader, Downloads, Tracking, Browse, Data, Security, Advanced, About', () => {
    expect(viewSource).toContain('<SettingsAppearanceView v-if="section === \'appearance\'"')
    expect(viewSource).toContain('<SettingsLibraryView v-else-if="section === \'library\'"')
    expect(viewSource).toContain('<ReaderSettingsScreen />')
    expect(viewSource).toContain('<SettingsDownloadScreen v-else-if="section === \'downloads\'"')
    expect(viewSource).toContain('<SettingsTrackingScreen v-else-if="section === \'tracking\'"')
    expect(viewSource).toContain('<SettingsBrowseScreen v-else-if="section === \'browse\'"')
    expect(viewSource).toContain('<SettingsDataScreen v-else-if="section === \'data\'"')
    expect(viewSource).toContain('<SettingsSecurityScreen />')
    expect(viewSource).toContain('<SettingsAdvancedView v-else-if="section === \'advanced\'"')
    expect(viewSource).toContain('<AboutView v-else-if="section === \'about\'"')
  })

  it('has ownToolbar: true configured in router for settings routes', () => {
    expect(routerSource).toContain("{ path: '/settings', component: () => import('../views/SettingsView.vue'), meta: { title: 'Settings', detail: true, ownToolbar: true } }")
    expect(routerSource).toContain("ownToolbar: true")
  })
})
