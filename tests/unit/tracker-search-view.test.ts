import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const view = readFileSync('src/views/TrackerSearchView.vue', 'utf8')
const api = readFileSync('src/api/trackers.ts', 'utf8')

/**
 * Guards for the pixel parity of `src/views/TrackerSearchView.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/track/TrackerSearch.kt
 * (Mihon commit 446f6df82c390ab760802c2fce3b677bce3f31c1).
 *
 * The reference is Kotlin, so the invariants are asserted on the ported
 * Material3 metrics.
 */
describe('TrackerSearchView parity with Mihon', () => {
  it('renders the top bar of the reference', () => {
    // TopAppBar: 64dp high.
    expect(view).toMatch(/\.ts__bar-row \{[^}]*height: 64px;/s)
    // IconButton: 48dp touch target, 24dp glyph tinted on-surface-variant.
    expect(view).toMatch(/\.ts__icon-button \{[^}]*width: 48px;[^}]*height: 48px;/s)
    expect(view).toContain('color: rgb(var(--v-theme-on-surface-variant))')
    expect(view).toContain('font-size: 24px;')
    // The title is a BasicTextField with the bodyLarge style.
    expect(view).toMatch(/\.ts__input \{[^}]*font-size: 16px;[^}]*line-height: 24px;/s)
    expect(view).toContain('placeholder="Search…"')
    // HorizontalDivider: 1dp.
    expect(view).toMatch(/\.ts__divider \{[^}]*height: 1px;/s)
    // The clear action only exists while the text is not empty.
    expect(view).toMatch(/v-if="query"/)
  })

  it('renders the result card of the reference', () => {
    // RoundedCornerShape(16.dp) and the 2dp border.
    expect(view).toContain('border-radius: 16px')
    expect(view).toMatch(/\.ts__card \{[^}]*border: 2px solid transparent;/s)
    // The selected state uses the outline colour.
    expect(view).toMatch(/\.ts__card--selected \{[^}]*border-color: rgb\(var\(--v-theme-outline\)\);/s)
    // The inner padding of the card is 12dp.
    expect(view).toMatch(/\.ts__card \{[^}]*padding: 12px;/s)
    // MangaCover.Book: 96dp high, 2:3 ratio, extraSmall (4dp) shape.
    expect(view).toMatch(/\.ts__cover \{[^}]*width: 64px;[^}]*height: 96px;[^}]*border-radius: 4px;/s)
    // The spacer between the cover and the text is 12dp.
    expect(view).toMatch(/\.ts__cover-gap \{[^}]*width: 12px;/s)
    // The title: titleMedium (16sp / 24sp / 500) with a 28dp end padding.
    expect(view).toMatch(/\.ts__title \{[^}]*font-size: 16px;[^}]*line-height: 24px;[^}]*font-weight: 500;/s)
    expect(view).toMatch(/\.ts__title \{[^}]*padding-right: 28px;/s)
    // The detail rows: titleSmall (14sp) and bodyMedium (14sp) with a 4dp gap.
    expect(view).toMatch(/\.ts__details \{[^}]*gap: 4px;/s)
    expect(view).toMatch(/\.ts__details-title \{[^}]*font-size: 14px;[^}]*line-height: 20px;[^}]*font-weight: 500;/s)
    expect(view).toMatch(/\.ts__details-text \{[^}]*font-size: 14px;[^}]*line-height: 20px;/s)
    // The summary: bodySmall (12sp / 16sp), 24dp above the baseline, four lines.
    expect(view).toMatch(/\.ts__description \{[^}]*margin: 24px 0 0;[^}]*font-size: 12px;[^}]*line-height: 16px;/s)
    expect(view).toContain('-webkit-line-clamp: 4;')
    // The secondary items use the 78% alpha of SECONDARY_ALPHA.
    expect(view).toContain('opacity: 0.78')
    // The selection marker: RoundedFilled.CheckCircle tinted primary.
    expect(view).toContain('check_circle')
    expect(view).toMatch(/\.ts__check \{[^}]*color: rgb\(var\(--v-theme-primary\)\);/s)
  })

  it('renders the drop down menu and the bottom bar of the reference', () => {
    // The menu items of SearchResultItemDropDownMenu.
    expect(view).toContain('Copy to clipboard')
    expect(view).toContain('Open in browser')
    // The bottom bar: padding(small = 8dp) and spacedBy(small = 8dp).
    expect(view).toMatch(/\.ts__bottom \{[^}]*gap: 8px;[^}]*padding: 8px;/s)
    // The MD3 elevated button: 40dp high, CornerFull (20dp), labelLarge.
    expect(view).toMatch(/\.ts__button \{[^}]*height: 40px;[^}]*border-radius: 20px;/s)
    expect(view).toMatch(/\.ts__button \{[^}]*font-size: 14px;[^}]*line-height: 20px;[^}]*font-weight: 500;/s)
    // The "Track" button and the private tracking button.
    expect(view).toContain('Track')
    expect(view).toContain('visibility_off')
    expect(view).toContain('aria-label="Track privately"')
  })

  it('renders the loading and the empty state of the reference', () => {
    // LoadingScreen: CircularProgressIndicator, 40dp wide with a 4dp stroke.
    expect(view).toContain('stroke-width: 4')
    // EmptyScreen: the face (displayMedium 45sp / 52sp) and the message (bodyMedium).
    expect(view).toMatch(/\.ts__face \{[^}]*font-size: 45px;[^}]*line-height: 52px;/s)
    expect(view).toMatch(/\.ts__empty-text \{[^}]*font-size: 14px;[^}]*line-height: 20px;/s)
    expect(view).toContain('No results found')
  })

  it('uses the Suwayomi tracker endpoints of the pinned revision', () => {
    // The tracker list and the search are only reachable over GraphQL.
    expect(api).toContain('searchTracker(input: $input)')
    expect(api).toContain('trackers { nodes {')
    // The binding of a selected result.
    expect(api).toContain('bindTrack(input: $input)')
    // The credentials login.
    expect(api).toContain('loginTrackerCredentials(input: $input)')
  })
})
