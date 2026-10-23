import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/views/CrashView.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/views/CrashView.vue` with
 * mihon/app/src/main/java/eu/kanade/tachiyomi/crash/CrashActivity.kt and
 * mihon/app/src/main/java/eu/kanade/presentation/crash/CrashScreen.kt, which
 * renders tachiyomi.presentation.core.screens.InfoScreen.
 * The reference is Kotlin, so the invariants are asserted on the ported metrics.
 */
describe('CrashView parity with Mihon', () => {
  it('uses the reference heading, description and action labels', () => {
    // MR.strings.crash_screen_title = "Whoops!".
    expect(source).toContain('>Whoops!</h1>')
    // MR.strings.crash_screen_description = "%s ran into an unexpected error. ...".
    expect(source).toContain('ran into an unexpected error')
    expect(source).toContain('share the crash logs in our support channel on Discord')
    // MR.strings.pref_dump_crash_logs = "Share crash logs".
    expect(source).toContain('Share crash logs')
    // MR.strings.crash_screen_restart_application = "Restart the application".
    expect(source).toContain('Restart the application')
  })

  it('renders the reference icon, heading and description in order', () => {
    // Icon(MaterialSymbols.Rounded.BugReport, 48.dp, tint = primary).
    expect(source).toContain('icon="bug_report"')
    expect(source.indexOf('icon="bug_report"')).toBeLessThan(source.indexOf('>Whoops!</h1>'))
    expect(source.indexOf('>Whoops!</h1>')).toBeLessThan(source.indexOf('crash-screen__subtitle'))
  })

  it('keeps the content column metrics of InfoScreen', () => {
    // Column(verticalScroll, fillMaxWidth, padding(paddingValues), padding(top = 48.dp),
    //        padding(horizontal = 16.dp)).
    expect(source).toMatch(/\.crash-screen__content \{[^}]*overflow-y: auto/)
    expect(source).toMatch(/\.crash-screen__content \{[^}]*padding-top: calc\(env\(safe-area-inset-top, 0px\) \+ 48px\)/)
    expect(source).toMatch(/\.crash-screen__content \{[^}]*padding-left: 16px/)
    expect(source).toMatch(/\.crash-screen__content \{[^}]*padding-right: 16px/)
  })

  it('keeps the typography of the reference headings', () => {
    // Text(crash_screen_title, typography.headlineLarge) — 32.sp / 40.sp, Regular.
    expect(source).toMatch(/\.crash-screen__heading \{[^}]*font-size: 32px/)
    expect(source).toMatch(/\.crash-screen__heading \{[^}]*line-height: 40px/)
    expect(source).toMatch(/\.crash-screen__heading \{[^}]*font-weight: 400/)
    // Text(crash_screen_description, titleSmall) — 14.sp / 20.sp, Medium,
    // with secondaryItemAlpha() = 0.78.
    expect(source).toMatch(/\.crash-screen__subtitle \{[^}]*font-size: 14px/)
    expect(source).toMatch(/\.crash-screen__subtitle \{[^}]*line-height: 20px/)
    expect(source).toMatch(/\.crash-screen__subtitle \{[^}]*font-weight: 500/)
    expect(source).toMatch(/\.crash-screen__subtitle \{[^}]*opacity: \.78/)
  })

  it('keeps the exception box metrics of CrashScreen', () => {
    // Box(padding(vertical = 8.dp).clip(shapes.small).fillMaxSize()
    //       .background(surfaceVariant)).
    expect(source).toMatch(/\.crash-screen__exception \{[^}]*padding: 8px 0/)
    expect(source).toMatch(/\.crash-screen__exception-box \{[^}]*border-radius: 8px/)
    expect(source).toMatch(/\.crash-screen__exception-box \{[^}]*background: rgb\(var\(--v-theme-surface-variant\)\)/)
    // Text(exception.toString(), padding(all = 8.dp), color = onSurfaceVariant) —
    // default typography.bodyLarge: 16.sp / 24.sp, Regular.
    expect(source).toMatch(/\.crash-screen__exception-text \{[^}]*padding: 8px/)
    expect(source).toMatch(/\.crash-screen__exception-text \{[^}]*font-size: 16px/)
    expect(source).toMatch(/\.crash-screen__exception-text \{[^}]*line-height: 24px/)
    expect(source).toMatch(/\.crash-screen__exception-text \{[^}]*color: rgb\(var\(--v-theme-on-surface-variant\)\)/)
  })

  it('keeps the bottom bar metrics of InfoScreen', () => {
    // Column(background = background, hairline top rule of `outline`,
    //        windowInsetsPadding(NavigationBarDefaults.windowInsets),
    //        padding(horizontal = 16.dp, vertical = 8.dp)).
    expect(source).toMatch(/\.crash-screen__bottom-bar \{[^}]*border-top: 1px solid rgb\(var\(--v-theme-outline\)\)/)
    expect(source).toMatch(/\.crash-screen__bottom-bar \{[^}]*background: rgb\(var\(--v-theme-background\)\)/)
    expect(source).toMatch(/\.crash-screen__bottom-bar \{[^}]*padding-bottom: calc\(env\(safe-area-inset-bottom, 0px\) \+ 8px\)/)
    expect(source).toMatch(/\.crash-screen__bottom-bar \{[^}]*padding-left: 16px/)
    expect(source).toMatch(/\.crash-screen__bottom-bar \{[^}]*padding-right: 16px/)
    expect(source).toMatch(/\.crash-screen__bottom-bar \{[^}]*padding-top: 8px/)
    // Material3 Button / OutlinedButton: 40.dp tall, fully rounded, labelLarge.
    expect(source).toMatch(/\.crash-screen__button \{[^}]*height: 40px/)
    expect(source).toMatch(/\.crash-screen__button \{[^}]*border-radius: 20px/)
    expect(source).toMatch(/\.crash-screen__button \{[^}]*font-size: 14px/)
    // The accept button is filled, the reject button is outlined.
    expect(source).toMatch(/<v-btn color="primary" variant="flat" block class="crash-screen__button"/)
    expect(source).toMatch(/<v-btn color="primary" variant="outlined" block class="crash-screen__button crash-screen__button--outlined"/)
  })

  it('keeps the restart action and the honest share-crash-logs stub', () => {
    // onRestartClick restarts the app task: the web equivalent is a full reload.
    expect(source).toContain('window.location.reload()')
    // The Android log dump has no web equivalent, so the action states it plainly.
    expect(source).toContain('not supported here')
    expect(source).toContain('shareDialog = true')
    // Offers honest copy-to-clipboard fallback and snackbar feedback.
    expect(source).toContain('copyErrorToClipboard')
    expect(source).toContain('Copied to clipboard')
  })

  it('keeps the M3 layout tokens for status bar scrim, bottom bar gap and actions row', () => {
    // Status bar scrim: z-index: 2 matching Modifier.zIndex(2f).
    expect(source).toMatch(/\.crash-screen__scrim \{[^}]*z-index: 2/)
    // Bottom bar: 8dp gap between accept button and actions row.
    expect(source).toMatch(/\.crash-screen__bottom-bar \{[^}]*gap: 8px/)
    // Actions row: Row(horizontalArrangement = spacedBy(MaterialTheme.padding.extraSmall = 4dp)).
    expect(source).toMatch(/\.crash-screen__actions-row \{[^}]*gap: 4px/)
    // Monospace font on exception text.
    expect(source).toMatch(/\.crash-screen__exception-text \{[^}]*font-family:[^;]*monospace/)
  })
})
