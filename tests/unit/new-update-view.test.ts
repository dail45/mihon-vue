import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/views/NewUpdateView.vue', 'utf8')

describe('NewUpdateView parity with Mihon Compose (NewUpdateScreen.kt & InfoScreen.kt)', () => {
  it('mirrors InfoScreen structure with verified icon and typography tokens', () => {
    // InfoScreen icon: 48dp, padding(bottom = 8dp), tint = primary
    expect(source).toContain('verified')
    expect(source).toMatch(/\.new-update-icon \{[^}]*width:\s*48px;/s)
    expect(source).toMatch(/\.new-update-icon \{[^}]*height:\s*48px;/s)
    expect(source).toMatch(/\.new-update-icon \{[^}]*margin-bottom:\s*8px;/s)
    expect(source).toMatch(/\.new-update-icon \{[^}]*color:\s*rgb\(var\(--v-theme-primary\)\);/s)
    expect(source).toMatch(/\.new-update-icon \{[^}]*font-variation-settings:[^;]*'opsz'\s*48/s)

    // headlineLarge: 32sp / 40sp, w400
    expect(source).toMatch(/\.new-update-heading \{[^}]*font-size:\s*32px;/s)
    expect(source).toMatch(/\.new-update-heading \{[^}]*line-height:\s*40px;/s)
    expect(source).toMatch(/\.new-update-heading \{[^}]*font-weight:\s*400;/s)

    // titleSmall: 14sp / 20sp, w500, secondaryItemAlpha (0.78), padding(vertical = 8dp)
    expect(source).toMatch(/\.new-update-subtitle \{[^}]*font-size:\s*14px;/s)
    expect(source).toMatch(/\.new-update-subtitle \{[^}]*line-height:\s*20px;/s)
    expect(source).toMatch(/\.new-update-subtitle \{[^}]*font-weight:\s*500;/s)
    expect(source).toMatch(/\.new-update-subtitle \{[^}]*opacity:\s*\.?78;/s)
    expect(source).toMatch(/\.new-update-subtitle \{[^}]*padding:\s*8px\s+0;/s)
  })

  it('renders changelog column with 24dp vertical padding and GFM MarkdownRender', () => {
    // Column(fillMaxWidth, padding(vertical = MaterialTheme.padding.large = 24.dp))
    expect(source).toMatch(/\.new-update-body \{[^}]*padding:\s*24px\s+0;/s)
    expect(source).toContain('<MarkdownRender :content="release.changelog" flavour="gfm"')
  })

  it('renders TextButton("Open on GitHub") with 4dp spacer and open_in_new icon', () => {
    // MR.strings.update_check_open = "Open on GitHub"
    expect(source).toContain('Open on GitHub')
    expect(source).toContain('open_in_new')
    // TextButton height 40dp, labelLarge 14sp/20sp w500, primary tint
    expect(source).toMatch(/\.new-update-link \{[^}]*height:\s*40px;/s)
    expect(source).toMatch(/\.new-update-link \{[^}]*font-size:\s*14px;/s)
    expect(source).toMatch(/\.new-update-link \{[^}]*font-weight:\s*500;/s)
    expect(source).toMatch(/\.new-update-link \{[^}]*color:\s*rgb\(var\(--v-theme-primary\)\);/s)
    // Spacer(width = extraSmall = 4dp)
    expect(source).toMatch(/\.new-update-link-icon \{[^}]*margin-left:\s*4px;/s)
  })

  it('renders bottom bar Column with hairline top divider, filled button, and reject row', () => {
    // InfoScreen bottomBar: 1dp hairline divider of outline
    expect(source).toMatch(/\.new-update-bar \{[^}]*border-top:\s*1px\s+solid\s+rgb\(var\(--v-theme-outline\)\);/s)
    expect(source).toMatch(/\.new-update-bar \{[^}]*padding:\s*8px\s+16px;/s)
    expect(source).toMatch(/\.new-update-bar \{[^}]*display:\s*flex;/s)
    expect(source).toMatch(/\.new-update-bar \{[^}]*flex-direction:\s*column;/s)
    expect(source).toMatch(/\.new-update-bar \{[^}]*gap:\s*8px;/s)

    // Filled accept button: height 40dp, shape 20dp, filled primary
    expect(source).toMatch(/\.new-update-accept \{[^}]*height:\s*40px;/s)
    expect(source).toMatch(/\.new-update-accept \{[^}]*border-radius:\s*20px;/s)
    expect(source).toMatch(/\.new-update-accept \{[^}]*background:\s*rgb\(var\(--v-theme-primary\)\);/s)

    // Reject row: spacedBy(extraSmall = 4dp)
    expect(source).toMatch(/\.new-update-row \{[^}]*display:\s*flex;/s)
    expect(source).toMatch(/\.new-update-row \{[^}]*gap:\s*4px;/s)

    // Outlined "Not now" button: weight 1f, outline border, 40dp height
    expect(source).toMatch(/\.new-update-outlined \{[^}]*height:\s*40px;/s)
    expect(source).toMatch(/\.new-update-outlined \{[^}]*border:\s*1px\s+solid\s+rgb\(var\(--v-theme-outline\)\);/s)
    expect(source).toMatch(/\.new-update-outlined \{[^}]*border-radius:\s*20px;/s)

    // Skip button rejectAction: 64dp min width, update_disabled icon, aria-label
    expect(source).toMatch(/\.new-update-outlined--icon \{[^}]*width:\s*64px;/s)
    expect(source).toContain('update_disabled')
    expect(source).toContain('aria-label="Skip this version"')
    expect(source).toContain('title="Skip this version"')
  })

  it('renders M3 AlertDialog for skipping the version with exact MR.strings text', () => {
    // Title: Skip %s? (MR.strings.update_check_skip_title)
    expect(source).toContain('Skip {{ versionName }}?')
    // Message: MR.strings.update_check_skip_message
    expect(source).toMatch(/Updates often contain bug fixes and security improvements\.\s*You won't be reminded about\s*this version again,\s*but you'll still be notified when a newer one is released\./s)
    // Buttons: Cancel (action_cancel) and OK (action_ok)
    expect(source).toContain('Cancel')
    expect(source).toContain('OK')

    // Dialog container: M3 shape ExtraLarge (28dp), surfaceContainerHigh
    expect(source).toMatch(/\.update-alert-dialog \{[^}]*border-radius:\s*28px;/s)
    expect(source).toMatch(/\.update-alert-dialog \{[^}]*background:\s*rgb\(var\(--v-theme-surface-container-high\)\);/s)
  })

  it('formats downloading_with_progress with colon according to MR.strings', () => {
    // MR.strings.downloading_with_progress = "Downloading: (%d%%)"
    expect(source).toContain('Downloading: (${downloadProgress.value}%)')
  })

  it('implements honest web stub for native Android package installer (guideline 4)', () => {
    // Stage.Downloaded installUpdate triggers system package installer which cannot run in browser
    expect(source).toContain('showInstallNotice')
    expect(source).toContain('Install update')
    expect(source).toContain('Mihon downloads the update as an APK and hands it to the Android system installer')
  })

  it('switches acceptText across all 4 stages matching NewUpdateScreenModel.Stage', () => {
    // Stage.Available -> Download
    expect(source).toContain("case 'available': return 'Download'")
    // Stage.Downloading -> Downloading: (%d%%)
    expect(source).toContain("case 'downloading': return `Downloading: (${downloadProgress.value}%)`")
    // Stage.Downloaded -> Install
    expect(source).toContain("case 'downloaded': return 'Install'")
    // Stage.Failed -> Retry
    expect(source).toContain("case 'failed': return 'Retry'")
    // canAccept: stage != Stage.Downloading
    expect(source).toContain("canAccept = computed(() => stage.value !== 'downloading')")
  })

  it('handles navigation lifecycle actions correctly', () => {
    // onRejectUpdate: pops screen
    expect(source).toContain('function rejectUpdate()')
    expect(source).toContain('router.back()')
    // onSkipUpdate: saves skipped version to localStorage and pops screen
    expect(source).toContain('function skipUpdate()')
    expect(source).toContain("localStorage.setItem('mihon-vue:skipped-app-update', versionName.value)")
    // onOpenInBrowser: opens releaseLink with noopener,noreferrer
    expect(source).toContain("window.open(release.value.releaseLink, '_blank', 'noopener,noreferrer')")
  })
})
