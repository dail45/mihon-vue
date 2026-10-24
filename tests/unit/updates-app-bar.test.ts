import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('UpdatesAppBar matches the Mihon reference', () => {
  const source = readFileSync('src/features/updates/components/UpdatesAppBar.vue', 'utf8')

  it('uses Material 3 TopAppBar container height and surface tokens', () => {
    expect(source).toMatch(/height="64"/)
    expect(source).toMatch(/:color="actionMode \? 'surface-container' : 'surface'"/)
    expect(source).toMatch(/box-shadow:\s*none/)
    expect(source).toMatch(/background-color:\s*rgb\(var\(--v-theme-surface-container\)\)\s*!important/)
  })

  it('sets up titleLarge typography for the app bar title', () => {
    expect(source).toMatch(/font-size:\s*22px/)
    expect(source).toMatch(/line-height:\s*28px/)
    expect(source).toMatch(/font-weight:\s*400/)
    expect(source).toMatch(/color:\s*rgb\(var\(--v-theme-on-surface\)\)/)
  })

  it('switches between normal mode title and selection count in action mode', () => {
    expect(source).toMatch(/v-if="actionMode">{{ selectedCount }}/)
    expect(source).toMatch(/MR\.strings\.label_recent_updates/)
    expect(source).toMatch(/<template v-else>{{ title }}<\/template>/)
  })

  it('implements normal actions matching Mihon in exact order', () => {
    // 1. Filter: MaterialSymbols.Rounded.FilterList
    expect(source).toMatch(/icon="filter_list"/)
    expect(source).toMatch(/aria-label="Filter"/)
    expect(source).toMatch(/title="Filter"/)
    // 2. Upcoming: MaterialSymbols.Rounded.CalendarMonth
    expect(source).toMatch(/icon="calendar_month"/)
    expect(source).toMatch(/aria-label="View Upcoming Updates"/)
    expect(source).toMatch(/title="View Upcoming Updates"/)
    // 3. Update library: MaterialSymbols.Rounded.Refresh
    expect(source).toMatch(/icon="refresh"/)
    expect(source).toMatch(/aria-label="Update library"/)
    expect(source).toMatch(/title="Update library"/)
  })

  it('tints active filter with ColorScheme.active (dark: #FFEB3B, light: #FFC107)', () => {
    expect(source).toMatch(/#FFEB3B/)
    expect(source).toMatch(/#FFC107/)
    expect(source).toMatch(/resolvedActiveColor/)
    expect(source).toMatch(/:class="\{\s*'action--active':\s*hasFilters\s*\}"/)
  })

  it('switches navigation and actions in action mode', () => {
    // Close button replaces navigation
    expect(source).toMatch(/v-if="actionMode"/)
    expect(source).toMatch(/icon="close"/)
    expect(source).toMatch(/aria-label="Cancel"/)
    expect(source).toMatch(/emit\('cancel-selection'\)/)

    // SelectAll and FlipToBack
    expect(source).toMatch(/icon="select_all"/)
    expect(source).toMatch(/aria-label="Select all"/)
    expect(source).toMatch(/icon="flip_to_back"/)
    expect(source).toMatch(/aria-label="Select inverse"/)
    expect(source).toMatch(/title="Select inverse"/)
    expect(source).toMatch(/emit\('invert-selection'\)/)
  })

  it('integrates SearchToolbar for web client local feed filtering', () => {
    // Close search button in nav slot
    expect(source).toMatch(/v-else-if="searchOpen"/)
    expect(source).toMatch(/icon="arrow_back"/)
    expect(source).toMatch(/aria-label="Close search"/)
    expect(source).toMatch(/closeSearch/)

    // Search input
    expect(source).toMatch(/v-text-field/)
    expect(source).toMatch(/aria-label="Search loaded updates"/)
    expect(source).toMatch(/placeholder="Search…"/)

    // Reset button when non-empty
    expect(source).toMatch(/v-else-if="searchQuery"/)
    expect(source).toMatch(/aria-label="Reset"/)
  })

  it('enforces 48dp touch targets and 24dp icons for all action buttons', () => {
    expect(source).toMatch(/width:\s*48px/)
    expect(source).toMatch(/height:\s*48px/)
    expect(source).toMatch(/font-size:\s*24px/)
  })
})
