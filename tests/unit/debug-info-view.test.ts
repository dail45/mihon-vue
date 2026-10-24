import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/settings/views/DebugInfoView.vue', 'utf8')
const routerSource = readFileSync('src/router/index.ts', 'utf8')

/**
 * Guards for the pixel parity of `src/features/settings/views/DebugInfoView.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/debug/DebugInfoScreen.kt.
 * The reference is Kotlin, so the invariants are asserted on the ported metrics.
 */
describe('DebugInfoView parity with Mihon', () => {
  it('renders TopAppBar with navigate up button and title "Debug information"', () => {
    // Scaffold.topBar = AppBar(title = MR.strings.pref_debug_info, navigateUp = pop)
    expect(source).toContain('class="debug-toolbar"')
    expect(source).toContain('aria-label="Navigate up"')
    expect(source).toContain('arrow_back')
    expect(source).toContain('Debug information</h1>')
    expect(source).toMatch(/\.debug-toolbar \{[^}]*height: 64px/)
    expect(source).toMatch(/\.debug-toolbar-title \{[^}]*font-size: 22px/)
    expect(source).toMatch(/\.debug-toolbar-title \{[^}]*line-height: 28px/)
    expect(source).toMatch(/\.debug-toolbar-title \{[^}]*font-weight: 400/)
    expect(source).toMatch(/\.debug-nav-btn \{[^}]*width: 48px/)
    expect(source).toMatch(/\.debug-nav-btn \{[^}]*height: 48px/)
  })

  it('renders AppBar actions: Share and Copy to clipboard with PlainTooltip', () => {
    // AppBar actions: Share (share 24dp) and Copy to clipboard (content_copy 24dp)
    expect(source).toContain('icon="share"')
    expect(source).toContain('icon="content_copy"')
    expect(source).toContain('aria-label="Share"')
    expect(source).toContain('aria-label="Copy to clipboard"')
    expect(source).toContain('class="debug-action-tooltip"')
    expect(source).toContain('shareDebugInfo')
    expect(source).toContain('copyAllDebugInfo')
  })

  it('renders the reference items and groups in the reference order', () => {
    // The two navigable rows come first, then the App info, Device info, Server info, and Memory groups.
    expect(source).toContain('>Worker info<')
    expect(source).toContain('>Backup file schema<')
    expect(source).toContain('>App info<')
    expect(source).toContain('>Device info<')
    expect(source).toContain('>Server info<')
    expect(source).toContain('>Memory & storage info<')

    expect(source.indexOf('>Worker info<')).toBeLessThan(source.indexOf('>Backup file schema<'))
    expect(source.indexOf('>Backup file schema<')).toBeLessThan(source.indexOf('>App info<'))
    expect(source.indexOf('>App info<')).toBeLessThan(source.indexOf('>Device info<'))
    expect(source.indexOf('>Device info<')).toBeLessThan(source.indexOf('>Server info<'))
    expect(source.indexOf('>Server info<')).toBeLessThan(source.indexOf('>Memory & storage info<'))
  })

  it('renders every App info and Device info row of the reference', () => {
    for (const title of ['Version', 'Build time', 'Commit', 'Installation ID', 'Profile compilation status', 'WebView version', 'Model', 'User-Agent', 'Screen resolution & DPI', 'Android version']) {
      expect(source).toContain(`>${title}<`)
    }
  })

  it('renders every Server info and Memory & storage info row', () => {
    for (const title of ['Suwayomi server URL', 'Server version', 'Server revision', 'Server channel', 'JS heap memory', 'Storage quota']) {
      expect(source).toContain(`>${title}<`)
    }
  })

  it('keeps the typography of BasePreferenceWidget and PreferenceGroupHeader', () => {
    // Title: titleLarge with TitleFontSize = 16.sp, maxLines 2, ellipsis.
    expect(source).toMatch(/\.pref-title \{[^}]*font-size: 16px/)
    expect(source).toMatch(/\.pref-title \{[^}]*line-height: 28px/)
    expect(source).toMatch(/\.pref-title \{[^}]*font-weight: 400/)
    expect(source).toMatch(/\.pref-title \{[^}]*-webkit-line-clamp: 2/)
    // Subtitle: bodySmall (12sp / 16sp) with secondaryItemAlpha (.78).
    expect(source).toMatch(/\.pref-subtitle \{[^}]*font-size: 12px/)
    expect(source).toMatch(/\.pref-subtitle \{[^}]*line-height: 16px/)
    expect(source).toMatch(/\.pref-subtitle \{[^}]*opacity: \.78/)
    // Group header: bodyMedium (14sp / 20sp) in the secondary color with 500 weight.
    expect(source).toMatch(/\.pref-group-header \{[^}]*padding: 14px 16px 8px/)
    expect(source).toMatch(/\.pref-group-header \{[^}]*font-size: 14px/)
    expect(source).toMatch(/\.pref-group-header \{[^}]*line-height: 20px/)
    expect(source).toMatch(/\.pref-group-header \{[^}]*font-weight: 500/)
    expect(source).toMatch(/\.pref-group-header \{[^}]*color: rgb\(var\(--v-theme-secondary\)\)/)
  })

  it('keeps the padding and the min height of the reference widget', () => {
    // PrefsHorizontalPadding = 16.dp, PrefsVerticalPadding = 16.dp, minHeight = 56.dp.
    expect(source).toMatch(/\.pref-title \{[^}]*padding: 0 16px/)
    expect(source).toMatch(/\.pref-subtitle \{[^}]*padding: 0 16px/)
    expect(source).toMatch(/\.pref-column \{[^}]*padding: 16px 0/)
    expect(source).toMatch(/\.pref-row \{[^}]*min-height: 56px/)
    // The trailing widget slot is padded by 16.dp on the end side.
    expect(source).toMatch(/\.pref-widget \{[^}]*padding: 0 16px/)
  })

  it('keeps the group spacing of PreferenceScreen', () => {
    // A group is followed by a Spacer(12.dp) unless it is the last item.
    expect(source).toMatch(/\.pref-group \{[^}]*margin-bottom: 12px/)
    expect(source).toMatch(/\.pref-group:last-child \{[^}]*margin-bottom: 0/)
  })

  it('reproduces the installation id behaviour of the reference', () => {
    // The Autorenew widget regenerates the id, the row click copies it to the clipboard.
    expect(source).toContain('icon="autorenew"')
    expect(source).toContain('navigator.clipboard.writeText(value)')
    expect(source).toContain('Installation ID regenerated')
    // The reference uses the ProfileVerifier "Not supported" branch.
    expect(source).toContain("const profileCompilationStatus = 'Not supported'")
  })

  it('keeps the version name format of AboutScreen.getVersionName', () => {
    // "$channel v$VERSION_NAME" for a release build.
    expect(source).toContain('const BUILD_TYPE = \'Stable\'')
    expect(source).toContain('`${BUILD_TYPE} v${CLIENT_VERSION}`')
  })

  it('supports row click copying with MD3 snackbar feedback', () => {
    expect(source).toContain('copyRow')
    expect(source).toContain('debug-snackbar')
    expect(source).toContain('Copied to clipboard')
  })

  it('registers debug routes in router/index.ts', () => {
    expect(routerSource).toContain("path: '/settings/advanced/debug'")
    expect(routerSource).toContain("path: '/settings/debug'")
    expect(routerSource).toContain("path: '/settings/debug/worker'")
    expect(routerSource).toContain("path: '/settings/debug/backup-schema'")
  })
})
