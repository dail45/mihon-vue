import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/settings/views/SettingsSecurityView.vue', 'utf8')
const composable = readFileSync('src/features/settings/composables/useSecurityPreferences.ts', 'utf8')

/**
 * Settings — Security and privacy (Mihon `SettingsSecurityScreen.kt`, pinned commit 446f6df).
 *
 * The assertions follow the reference file item by item: the two group headers, the five items
 * of the "Security" group, the three items of the "Analytics and Crash logs" group, the entry
 * lists of the two ListPreferences and the two InfoPreference texts.
 */
describe('SettingsSecurityScreen matches the Mihon reference', () => {
  it('renders the two reference group headers', () => {
    const headers = [...source.matchAll(/pref-group-header">([^<]+)</g)].map(match => match[1])
    expect(headers).toEqual(['Security', 'Analytics and Crash logs'])
  })

  it('keeps the reference order of the Security group items', () => {
    const order = [
      'Require unlock',
      'Lock when idle',
      'Hide notification content',
      'Secure screen',
    ]
    const positions = order.map(title => source.indexOf(`>${title}<`))
    expect(positions.every(position => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('keeps the reference order of the telemetry group items', () => {
    const order = ['Send crash logs', 'Allow analytics']
    const positions = order.map(title => source.indexOf(`>${title}<`))
    expect(positions.every(position => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('shows "Lock when idle" only while the app lock is enabled', () => {
    expect(source).toContain('v-if="useAuthenticator"')
  })

  it('keeps the reference entries of "Lock when idle"', () => {
    expect(source).toContain('const LOCK_AFTER_ENTRIES = [0, 1, 2, 5, 10, -1]')
    // lock_always / lock_never / plurals.lock_after_mins ("After %1$s minute(s)").
    expect(source).toContain("if (value === 0) return 'Always'")
    expect(source).toContain("if (value === -1) return 'Never'")
    expect(source).toContain("return value === 1 ? 'After 1 minute' : `After ${value} minutes`")
  })

  it('keeps the reference entries of "Secure screen"', () => {
    for (const title of ['Always', 'Incognito mode', 'Never']) {
      expect(source).toContain(`label: '${title}'`)
    }
  })

  it('keeps the reference InfoPreference texts', () => {
    expect(source).toContain('Secure screen hides app contents when switching apps and block screenshots')
    expect(source).toContain('Sending crash logs and analytics will allow us to identify and fix issues, improve performance, and make future updates more relevant to your needs')
  })

  it('keeps the reference telemetry subtitles', () => {
    expect(source).toContain('Send anonymized crash logs to the developers.')
    expect(source).toContain('Send anonymized usage data to improve app features.')
  })

  it('keeps the reference MD3 metrics of the preference widgets', () => {
    expect(source).toMatch(/pref-group-header\s*\{[^}]*padding:\s*14px 16px 8px/)
    expect(source).toMatch(/pref-group-spacer\s*\{\s*height:\s*12px/)
    expect(source).toMatch(/pref-row\s*\{[^}]*min-height:\s*56px/)
    expect(source).toMatch(/pref-info\s*\{[^}]*padding:\s*16px/)
    expect(source).toMatch(/pref-title\s*\{[^}]*font-size:\s*16px/)
    expect(source).toMatch(/pref-subtitle\s*\{[^}]*font-size:\s*12px/)
    expect(source).toMatch(/pref-subtitle\s*\{[^}]*opacity:\s*\.78/)
  })

  it('keeps the MD3 AlertDialog metrics of the list dialogs', () => {
    expect(source).toMatch(/pref-dialog\s*\{[^}]*padding:\s*24px/)
    expect(source).toMatch(/pref-dialog-title\s*\{[^}]*font-size:\s*24px/)
    expect(source).toMatch(/pref-dialog-row\s*\{[^}]*min-height:\s*48px/)
    expect(source).toMatch(/pref-radio\s*\{[^}]*width:\s*20px/)
  })

  it('persists the app lock preferences like the reference SecurityPreferences', () => {
    expect(composable).toContain("mihon.security.useAuthenticator")
    expect(composable).toContain("mihon.security.lockAppAfter")
    expect(composable).toContain("mihon.security.secureScreen")
    expect(composable).toContain("mihon.security.hideNotificationContent")
  })

  it('implements honest MD3 AlertDialog stubs for Android platform limitations', () => {
    // Biometrics stub
    expect(source).toContain('Unlocking the app with biometrics is an Android feature')
    // FLAG_SECURE screenshot blocking stub
    expect(source).toContain('Web browsers do not support Android\'s FLAG_SECURE window flag')
    // System lock screen notification redaction stub
    expect(source).toContain('System-level lock screen notification redaction is an Android feature')
    // Telemetry stub
    expect(source).toContain('The web version does not collect or send crash logs')
  })

  it('provides accessibility attributes and keyboard triggers on preference rows', () => {
    expect(source).toContain('data-pref="Require unlock"')
    expect(source).toContain('data-pref="Lock when idle"')
    expect(source).toContain('data-pref="Hide notification content"')
    expect(source).toContain('data-pref="Secure screen"')
    expect(source).toContain('@keydown.space.prevent')
    expect(source).toContain('@keydown.enter.prevent')
  })

  it('is integrated in SettingsView.vue for route /settings/security', () => {
    const settingsView = readFileSync('src/features/settings/views/SettingsView.vue', 'utf8')
    expect(settingsView).toContain("import SettingsSecurityScreen from '@/features/settings/views/SettingsSecurityView.vue'")
    expect(settingsView).toContain("<SettingsSecurityScreen />")
  })
})
