import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { formatDuration, formatMeanScore } from '../../src/utils/statsFormatters'

const statsViewSource = readFileSync('src/views/StatsView.vue', 'utf8')
const routerSource = readFileSync('src/router/index.ts', 'utf8')
const appSource = readFileSync('src/App.vue', 'utf8')

describe('StatsView formatDuration matches Mihon TimeUtils.toDurationString', () => {
  it('returns fallback ("None") for 0 or negative values', () => {
    expect(formatDuration(0)).toBe('None')
    expect(formatDuration(-500)).toBe('None')
  })

  it('formats seconds only when duration < 1 minute', () => {
    expect(formatDuration(45000)).toBe('45s')
  })

  it('formats minutes and seconds when duration < 1 hour', () => {
    expect(formatDuration(125000)).toBe('2m 5s')
  })

  it('formats hours and minutes when duration < 1 day', () => {
    expect(formatDuration(3660000)).toBe('1h 1m')
  })

  it('omits minutes and seconds when both days and hours are non-zero', () => {
    // Mihon logic: `if (minutes != 0 && (days == 0L || hours == 0)) add(...)`
    // 1 day + 2 hours + 30 minutes -> "1d 2h"
    const ms = (1 * 86400 + 2 * 3600 + 30 * 60) * 1000
    expect(formatDuration(ms)).toBe('1d 2h')
  })

  it('includes minutes when days > 0 but hours == 0', () => {
    // 1 day + 0 hours + 15 minutes -> "1d 15m"
    const ms = (1 * 86400 + 15 * 60) * 1000
    expect(formatDuration(ms)).toBe('1d 15m')
  })
})

describe('StatsView formatMeanScore matches StatsScreenContent.kt', () => {
  it('returns "N/A" when trackedTitleCount is 0', () => {
    expect(formatMeanScore(0, 8.5)).toBe('N/A')
  })

  it('returns "N/A" when meanScore is null or NaN', () => {
    expect(formatMeanScore(5, null)).toBe('N/A')
    expect(formatMeanScore(5, Number.NaN)).toBe('N/A')
  })

  it('formats score to 2 decimal places with star when trackedTitleCount > 0', () => {
    expect(formatMeanScore(3, 8.5)).toBe('8.50 ★')
    expect(formatMeanScore(1, 10)).toBe('10.00 ★')
    expect(formatMeanScore(10, 7.33333)).toBe('7.33 ★')
  })
})

describe('StatsView matches Mihon Compose reference (StatsScreenContent.kt, StatsItem.kt, SectionCard.kt)', () => {
  it('renders TopAppBar with navigateUp and title "Statistics"', () => {
    expect(statsViewSource).toContain('aria-label="Navigate up"')
    expect(statsViewSource).toContain('arrow_back')
    expect(statsViewSource).toContain('Statistics')
    expect(statsViewSource).toMatch(/\.stats-toolbar\s*\{[^}]*height:\s*64px;/s)
    expect(statsViewSource).toMatch(/\.stats-toolbar\s*\{[^}]*background:\s*rgb\(var\(--v-theme-surface\)\);/s)
  })

  it('contains all 4 sections in the exact reference order', () => {
    // Reference order in StatsScreenContent.kt:
    // 1. OverviewSection (MR.strings.label_overview_section = "Overview")
    // 2. TitlesStats (MR.strings.label_titles_section = "Entries")
    // 3. ChapterStats (MR.strings.chapters = "Chapters")
    // 4. TrackerStats (MR.strings.label_tracker_section = "Trackers")
    const sections = ['Overview', 'Entries', 'Chapters', 'Trackers']
    let lastIndex = -1
    for (const section of sections) {
      const idx = statsViewSource.indexOf(`class="stats-section-title">${section}<`, lastIndex + 1)
      expect(idx).toBeGreaterThan(lastIndex)
      lastIndex = idx
    }
  })

  it('renders Overview section with exact labels and Material Symbols icons', () => {
    // In library -> collections_bookmark
    expect(statsViewSource).toContain('In library')
    expect(statsViewSource).toContain('collections_bookmark')

    // Read duration -> schedule
    expect(statsViewSource).toContain('Read duration')
    expect(statsViewSource).toContain('schedule')

    // Completed entries -> local_library
    expect(statsViewSource).toContain('Completed entries')
    expect(statsViewSource).toContain('local_library')
  })

  it('renders Entries section with exact labels', () => {
    // TitlesStats: globalUpdateItemCount, startedMangaCount, localMangaCount
    expect(statsViewSource).toContain('In global update')
    expect(statsViewSource).toContain('Started')
    expect(statsViewSource).toContain('Local')
  })

  it('renders Chapters section with exact labels', () => {
    // ChapterStats: totalChapterCount, readChapterCount, downloadCount
    expect(statsViewSource).toContain('Total')
    expect(statsViewSource).toContain('Read')
    expect(statsViewSource).toContain('Downloaded')
  })

  it('renders Trackers section with exact labels', () => {
    // TrackerStats: trackedTitleCount, meanScore, trackerCount
    expect(statsViewSource).toContain('Trackers')
    expect(statsViewSource).toContain('Tracked entries')
    expect(statsViewSource).toContain('Mean score')
    expect(statsViewSource).toContain('Used')
  })

  it('uses SectionCard tokens (28dp extraLarge shape, surfaceContainerLow, 32dp extraLarge title padding)', () => {
    // SectionCard.kt
    expect(statsViewSource).toMatch(/\.stats-section-title\s*\{[^}]*padding:\s*0\s+32px;/s)
    expect(statsViewSource).toMatch(/\.stats-card\s*\{[^}]*border-radius:\s*28px;/s)
    expect(statsViewSource).toMatch(/\.stats-card\s*\{[^}]*background:\s*rgb\(var\(--v-theme-surface-container-low\)\);/s)
    expect(statsViewSource).toMatch(/\.stats-card\s*\{[^}]*padding:\s*16px;/s)
  })

  it('applies M3 typography and secondary alpha to subtitles', () => {
    // SECONDARY_ALPHA = 0.78
    expect(statsViewSource).toMatch(/rgba\(var\(--v-theme-on-surface\),\s*0\.78\)/)
    // Overview title: titleLarge 22/28sp bold 700
    expect(statsViewSource).toMatch(/\.stats-overview-title\s*\{[^}]*font-size:\s*22px;/s)
    expect(statsViewSource).toMatch(/\.stats-overview-title\s*\{[^}]*font-weight:\s*700;/s)
    // Item title: bodyMedium 14/20sp bold 700
    expect(statsViewSource).toMatch(/\.stats-item-title\s*\{[^}]*font-size:\s*14px;/s)
    expect(statsViewSource).toMatch(/\.stats-item-title\s*\{[^}]*font-weight:\s*700;/s)
    // Item subtitle: labelSmall 11/16sp w500
    expect(statsViewSource).toMatch(/\.stats-item-subtitle\s*\{[^}]*font-size:\s*11px;/s)
    expect(statsViewSource).toMatch(/\.stats-item-subtitle\s*\{[^}]*font-weight:\s*500;/s)
  })

  it('renders LoadingScreen and EmptyScreen for respective states', () => {
    expect(statsViewSource).toContain('Md3CircularProgress')
    expect(statsViewSource).toContain('MihonEmptyScreen')
    expect(statsViewSource).toContain('Your library is empty')
  })
})

describe('Routing and App shell integration', () => {
  it('registers /stats route with ownToolbar: true', () => {
    expect(routerSource).toContain("path: '/stats'")
    expect(routerSource).toContain("title: 'Statistics'")
    expect(routerSource).toContain('ownToolbar: true')
  })

  it('integrates /stats into App.vue back handler', () => {
    expect(appSource).toContain("route.path === '/stats'")
  })
})
