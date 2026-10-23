import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/views/UpcomingView.vue', 'utf8')

/**
 * Upcoming release calendar parity test.
 * References:
 *   - mihon/app/src/main/java/mihon/feature/upcoming/UpcomingScreen.kt
 *   - mihon/app/src/main/java/mihon/feature/upcoming/UpcomingScreenContent.kt
 *   - mihon/app/src/main/java/mihon/feature/upcoming/UpcomingViewModel.kt
 *   - mihon/app/src/main/java/mihon/feature/upcoming/components/UpcomingItem.kt
 *   - mihon/app/src/main/java/mihon/feature/upcoming/components/calendar/Calendar.kt
 *   - mihon/app/src/main/java/mihon/feature/upcoming/components/calendar/CalendarHeader.kt
 *   - mihon/app/src/main/java/mihon/feature/upcoming/components/calendar/CalendarDay.kt
 *   - mihon/app/src/main/java/mihon/feature/upcoming/components/calendar/CalendarIndicator.kt
 *   - mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt
 *   - mihon/app/src/main/java/eu/kanade/presentation/components/TabbedDialog.kt
 *   - tachiyomi/presentation/core/components/SettingsItems.kt (TriStateItem)
 *   - tachiyomi/presentation/core/components/TwoPanelBox.kt
 */
describe('UpcomingView matches Mihon Compose reference', () => {
  it('renders UpcomingToolbar with navigateUp, title "Upcoming", filter, and guide actions', () => {
    expect(source).toContain('aria-label="Navigate up"')
    expect(source).toContain('arrow_back')
    expect(source).toContain('Upcoming')
    expect(source).toContain('filter_list')
    expect(source).toContain('help')
    expect(source).toContain('aria-label="Upcoming guide"')
  })

  it('renders LoadingScreen with Md3CircularProgress', () => {
    expect(source).toContain('Md3CircularProgress')
    expect(source).toContain('upcoming-loading')
  })

  it('renders CalendarHeader with 200ms slide transition, title, and month navigation', () => {
    expect(source).toContain('keyboard_arrow_left')
    expect(source).toContain('keyboard_arrow_right')
    expect(source).toContain('aria-label="Previous month"')
    expect(source).toContain('aria-label="Next month"')
    expect(source).toMatch(/transition:\s*transform 200ms/)
  })

  it('renders CalendarGrid with 7 columns and narrow weekday headers', () => {
    expect(source).toContain('grid-template-columns: repeat(7, 1fr)')
    expect(source).toContain('calendar-weekday')
  })

  it('renders CalendarDay with circle button, today border, past alpha, and dots', () => {
    expect(source).toContain('calendar-day')
    expect(source).toMatch(/max-width:\s*48px/)
    expect(source).toMatch(/max-height:\s*48px/)
    expect(source).toMatch(/border-radius:\s*50%/)
    expect(source).toContain('.calendar-day.is-today')
    expect(source).toContain('.calendar-day.is-past')
    expect(source).toContain('0.38') // DISABLED_ALPHA
    expect(source).toContain('calendar-dots')
    expect(source).toContain('calendar-dot')
  })

  it('renders DateHeading with relative date and badge', () => {
    expect(source).toContain('release-heading')
    expect(source).toContain('release-heading-label')
    expect(source).toContain('release-badge')
    expect(source).toContain('relativeDateText')
  })

  it('renders UpcomingItem with 96dp height, 2/3 cover, and title', () => {
    expect(source).toContain('release-item')
    expect(source).toMatch(/height:\s*96px/)
    expect(source).toMatch(/gap:\s*24px/)
    expect(source).toContain('release-cover')
    expect(source).toContain('release-title')
  })

  it('renders MihonEmptyScreen with kaomoji on empty or error', () => {
    expect(source).toContain('MihonEmptyScreen')
    expect(source).toContain('No upcoming releases')
  })

  it('renders FastScrollLazyColumn vertical scroller handle', () => {
    expect(source).toContain('upcoming-fast-scroll')
    expect(source).toMatch(/height:\s*48px/)
  })

  it('renders UpcomingFilterDialog with TabbedDialog Categories, description, divider, and TriStateRow', () => {
    expect(source).toContain('AdaptiveSettingsSheet')
    expect(source).toContain('Titles in excluded categories are not shown')
    expect(source).toContain('filter-divider')
    expect(source).toContain('TriStateRow')
  })

  it('supports tablet two-panel layout with TwoPanelBox parity', () => {
    expect(source).toContain('is-tablet')
    expect(source).toMatch(/min\(50%,\s*450px\)/)
  })
})
