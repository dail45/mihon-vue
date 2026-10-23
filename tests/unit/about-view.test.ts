import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const aboutViewSource = readFileSync('src/views/AboutView.vue', 'utf8')
const routerSource = readFileSync('src/router/index.ts', 'utf8')

describe('AboutView parity with Mihon AboutScreen.kt', () => {
  it('renders TopAppBar with navigateUp button and title "About"', () => {
    // AboutScreen.kt: Scaffold(topBar = { AppBar(title = MR.strings.pref_category_about, navigateUp = back) })
    expect(aboutViewSource).toContain('class="about-top-bar"')
    expect(aboutViewSource).toContain('aria-label="Navigate up"')
    expect(aboutViewSource).toContain('arrow_back')
    expect(aboutViewSource).toContain('{{ aboutTitle }}')
    expect(aboutViewSource).toContain("aboutTitle = 'About'")
  })

  it('renders LogoHeader with 64dp icon, 56dp vertical padding and HorizontalDivider', () => {
    // LogoHeader.kt: Icon(ic_mihon, Modifier.padding(iconPadding).size(64.dp), tint = onSurface)
    // AboutScreen.kt: LogoHeader(iconPadding = PaddingValues(vertical = 56.dp))
    expect(aboutViewSource).toMatch(/width="64"\s+height="64"/)
    expect(aboutViewSource).toMatch(/\.about-logo-wrap\s*\{[^}]*padding:\s*56px 0;/s)
    expect(aboutViewSource).toMatch(/\.about-logo\s*\{[^}]*color:\s*rgb\(var\(--v-theme-on-surface\)\);/s)
    expect(aboutViewSource).toMatch(/\.about-logo\s*\{[^}]*width:\s*64px;\s*height:\s*64px;/s)
    expect(aboutViewSource).toMatch(/\.about-divider\s*\{[^}]*height:\s*1px;/s)
    expect(aboutViewSource).toMatch(/\.about-divider\s*\{[^}]*background:\s*rgb\(var\(--v-theme-outline-variant\)\);/s)
  })

  it('contains all preference items in the exact reference order', () => {
    // Order in AboutScreen.kt:
    // LogoHeader -> Version -> Check for updates -> What's new -> Open source licenses -> Privacy policy -> Divider -> LinkIcon Row
    const items = [
      'about-logo-header',
      'versionTitle',
      'checkUpdatesTitle',
      'whatsNewTitle',
      'licensesTitle',
      'privacyTitle',
      'about-divider',
      'about-links',
    ]

    let lastIndex = -1
    for (const item of items) {
      const idx = aboutViewSource.indexOf(item, lastIndex + 1)
      expect(idx).toBeGreaterThan(lastIndex)
      lastIndex = idx
    }
  })

  it('configures Version preference row with debug info copying and snackbar feedback', () => {
    // AboutScreen.kt: TextPreferenceWidget(title = MR.strings.version, subtitle = getVersionName(withBuildDate = true))
    // onPreferenceClick: context.copyToClipboard("Debug information", crashLogUtil.getDebugInfo())
    expect(aboutViewSource).toContain("versionTitle = 'Version'")
    expect(aboutViewSource).toContain('copyDebugInfo')
    expect(aboutViewSource).toContain('navigator.clipboard.writeText')
    expect(aboutViewSource).toContain('Copied to clipboard')
    expect(aboutViewSource).toContain('about-snackbar')
  })

  it('configures Check for updates with CircularProgressIndicator (28dp, 3dp stroke)', () => {
    // AboutScreen.kt: CircularProgressIndicator(modifier = Modifier.size(28.dp), strokeWidth = 3.dp)
    expect(aboutViewSource).toContain("checkUpdatesTitle = 'Check for updates'")
    expect(aboutViewSource).toMatch(/<v-progress-circular[^>]*size="28"[^>]*width="3"/)
    expect(aboutViewSource).toContain('No new updates available')
  })

  it('configures "What\'s new" navigating to /new-update', () => {
    expect(aboutViewSource).toContain("whatsNewTitle = \"What's new\"")
    expect(aboutViewSource).toContain("router.push('/new-update')")
  })

  it('configures "Open source licenses" navigating to /about/licenses', () => {
    expect(aboutViewSource).toContain("licensesTitle = 'Open source licenses'")
    expect(aboutViewSource).toContain("router.push('/about/licenses')")
  })

  it('configures "Privacy policy" opening https://mihon.app/privacy/', () => {
    expect(aboutViewSource).toContain("privacyTitle = 'Privacy policy'")
    expect(aboutViewSource).toContain('https://mihon.app/privacy/')
  })

  it('renders all 6 social link icons with exact URLs, order, and styling', () => {
    // AboutScreen.kt order: Website, Discord, X, Facebook, Reddit, GitHub
    const linkKeys = ['website', 'discord', 'x', 'facebook', 'reddit', 'github']
    for (const key of linkKeys) {
      expect(aboutViewSource).toContain(`key: '${key}'`)
    }

    // Exact URLs from AboutScreen.kt / Constants.kt
    expect(aboutViewSource).toContain('https://mihon.app')
    expect(aboutViewSource).toContain('https://discord.gg/mihon')
    expect(aboutViewSource).toContain('https://x.com/mihonapp')
    expect(aboutViewSource).toContain('https://facebook.com/mihonapp')
    expect(aboutViewSource).toContain('https://www.reddit.com/r/mihonapp')
    expect(aboutViewSource).toContain('https://github.com/mihonapp')

    // LinkIcon.kt: IconButton(padding(4.dp)) -> 48dp circular icon button with 4dp margin
    expect(aboutViewSource).toMatch(/\.about-link\s*\{[^}]*width:\s*48px;\s*height:\s*48px;/s)
    expect(aboutViewSource).toMatch(/\.about-link\s*\{[^}]*border-radius:\s*50%;/s)
    expect(aboutViewSource).toMatch(/\.about-link\s*\{[^}]*margin:\s*4px;/s)
    expect(aboutViewSource).toMatch(/\.about-link\s*\{[^}]*color:\s*rgb\(var\(--v-theme-primary\)\);/s)
  })

  it('uses M3 typography tokens and layout in CSS', () => {
    // TopAppBar: height 64px, titleLarge 22sp / 28sp w400
    expect(aboutViewSource).toMatch(/\.about-top-bar\s*\{[^}]*height:\s*64px;/s)
    expect(aboutViewSource).toMatch(/\.about-top-title\s*\{[^}]*font-size:\s*22px;\s*line-height:\s*28px;\s*font-weight:\s*400;/s)

    // BasePreferenceWidget: minHeight 56px, title 16sp / 28sp w400, subtitle 12sp / 16sp w400 with 0.78 opacity
    expect(aboutViewSource).toMatch(/\.about-item\s*\{[^}]*min-height:\s*56px;/s)
    expect(aboutViewSource).toMatch(/\.about-item-title\s*\{[^}]*font-size:\s*16px;\s*line-height:\s*28px;\s*font-weight:\s*400;/s)
    expect(aboutViewSource).toMatch(/\.about-item-subtitle\s*\{[^}]*font-size:\s*12px;\s*line-height:\s*16px;\s*font-weight:\s*400;/s)
    expect(aboutViewSource).toMatch(/\.about-item-subtitle\s*\{[^}]*opacity:\s*0\.78;/s)
  })

  it('configures /about and /new-update routes properly in router', () => {
    expect(routerSource).toContain("path: '/about'")
    expect(routerSource).toContain("ownToolbar: true")
    expect(routerSource).toContain("path: '/new-update'")
  })
})
