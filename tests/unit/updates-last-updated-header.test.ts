import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { relativeTimeSpanString } from '../../src/utils/dates'

describe('UpdatesLastUpdatedHeader matches Mihon reference', () => {
  const source = readFileSync('src/components/UpdatesLastUpdatedHeader.vue', 'utf8')
  const viewSource = readFileSync('src/views/UpdatesView.vue', 'utf8')

  it('matches Mihon compose layout padding (horizontal = 16dp, vertical = 8dp)', () => {
    // Reference: Box(modifier.padding(horizontal = MaterialTheme.padding.medium, vertical = MaterialTheme.padding.small))
    expect(source).toMatch(/padding:\s*8px 16px/)
  })

  it('matches Material 3 typography tokens (bodyLarge: 16/24 w400, italic, onSurface)', () => {
    // Reference: Text(text = ..., fontStyle = FontStyle.Italic)
    expect(source).toMatch(/font-size:\s*16px/)
    expect(source).toMatch(/line-height:\s*24px/)
    expect(source).toMatch(/font-weight:\s*400/)
    expect(source).toMatch(/letter-spacing:\s*0\.03125em/)
    expect(source).toMatch(/font-style:\s*italic/)
    expect(source).toMatch(/color:\s*rgb\(var\(--v-theme-on-surface\)\)/)
  })

  it('matches Mihon string resource MR.strings.updates_last_update_info', () => {
    // Reference: stringResource(MR.strings.updates_last_update_info, relativeTimeSpanString(lastUpdated))
    // where updates_last_update_info = "Library last updated: %s"
    expect(source).toMatch(/Library last updated:\s*\{\{\s*formattedRelative\s*\}\}/)
  })

  it('is integrated into UpdatesView in both empty and non-empty list branches', () => {
    // Reference: UpdatesScreen.kt:123 (empty branch) and UpdatesScreen.kt:137 (FastScrollLazyColumn branch)
    expect(viewSource).toMatch(/import UpdatesLastUpdatedHeader from '\.\.\/components\/UpdatesLastUpdatedHeader\.vue'/)
    const headerMatches = viewSource.match(/<UpdatesLastUpdatedHeader/g)
    expect(headerMatches).not.toBeNull()
    expect(headerMatches!.length).toBe(2)
  })

  describe('relativeTimeSpanString formatting (eu/kanade/presentation/util/TimeUtils.kt)', () => {
    const fixedNow = 1729600000000 // A fixed reference time in milliseconds
    const fixedNowSec = Math.floor(fixedNow / 1000)

    it('returns "Never" for 0 or non-positive values (MR.strings.relative_time_span_never)', () => {
      expect(relativeTimeSpanString(0, fixedNow)).toBe('Never')
      expect(relativeTimeSpanString(-1, fixedNow)).toBe('Never')
      expect(relativeTimeSpanString(NaN, fixedNow)).toBe('Never')
    })

    it('returns "Just now" for elapsed time under 1 minute (MR.strings.updates_last_update_info_just_now)', () => {
      // Under 60 seconds ago
      expect(relativeTimeSpanString(fixedNowSec, fixedNow)).toBe('Just now')
      expect(relativeTimeSpanString(fixedNowSec - 30, fixedNow)).toBe('Just now')
      expect(relativeTimeSpanString(fixedNowSec - 59, fixedNow)).toBe('Just now')
      // Supports milliseconds too
      expect(relativeTimeSpanString(fixedNow - 30000, fixedNow)).toBe('Just now')
    })

    it('returns minute spans for elapsed time under 1 hour (DateUtils MINUTE_IN_MILLIS)', () => {
      expect(relativeTimeSpanString(fixedNowSec - 60, fixedNow)).toBe('1 minute ago')
      expect(relativeTimeSpanString(fixedNowSec - 300, fixedNow)).toBe('5 minutes ago')
      expect(relativeTimeSpanString(fixedNowSec - 3540, fixedNow)).toBe('59 minutes ago')
      // Milliseconds support
      expect(relativeTimeSpanString(fixedNow - 300000, fixedNow)).toBe('5 minutes ago')
    })

    it('returns hour spans for elapsed time under 24 hours (DateUtils HOUR_IN_MILLIS)', () => {
      expect(relativeTimeSpanString(fixedNowSec - 3600, fixedNow)).toBe('1 hour ago')
      expect(relativeTimeSpanString(fixedNowSec - 3600 * 3, fixedNow)).toBe('3 hours ago')
      expect(relativeTimeSpanString(fixedNowSec - 3600 * 23, fixedNow)).toBe('23 hours ago')
      // Milliseconds support
      expect(relativeTimeSpanString(fixedNow - 3600000 * 3, fixedNow)).toBe('3 hours ago')
    })

    it('returns day spans for elapsed time under 7 days (DateUtils DAY_IN_MILLIS)', () => {
      expect(relativeTimeSpanString(fixedNowSec - 86400, fixedNow)).toBe('1 day ago')
      expect(relativeTimeSpanString(fixedNowSec - 86400 * 2, fixedNow)).toBe('2 days ago')
      expect(relativeTimeSpanString(fixedNowSec - 86400 * 6, fixedNow)).toBe('6 days ago')
      // Milliseconds support
      expect(relativeTimeSpanString(fixedNow - 86400000 * 2, fixedNow)).toBe('2 days ago')
    })

    it('falls back to formatted calendar date for spans >= 7 days (DateUtils formatDateRange)', () => {
      const formatted = relativeTimeSpanString(fixedNowSec - 86400 * 10, fixedNow)
      // Matches localized / formatted short month + day + year (e.g. "Oct 12, 2024")
      expect(formatted).toMatch(/[A-Za-z]+ \d{1,2}, \d{4}/)
    })
  })
})
