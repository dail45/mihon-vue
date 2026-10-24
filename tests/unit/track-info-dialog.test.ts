import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/trackers/components/TrackInfoDialog.vue', 'utf8')

describe('TrackInfoDialog matches the Mihon reference (TrackInfoDialogHome.kt)', () => {
  it('uses the scrollable column geometry of the reference', () => {
    // Column(padding(16.dp), spacedBy(24.dp), verticalScroll)
    expect(source).toMatch(/gap:\s*24px/)
    expect(source).toMatch(/padding:\s*16px/)
    expect(source).toMatch(/overflow-y:\s*auto/)
    // The host sheet: widthIn(max = 460.dp), extraLarge shape, surfaceContainerHigh.
    expect(source).toMatch(/max-width:\s*460px/)
    expect(source).toMatch(/border-radius:\s*28px/)
    expect(source).toMatch(/background:\s*rgb\(var\(--v-theme-surface-container-high\)\)/)
  })

  it('renders the tracker logo with the private badge', () => {
    expect(source).toContain('class="ti__logo"')
    expect(source).toContain('visibility_off')
    expect(source).toContain('Tracked privately')
    // Badge(containerColor = primary, contentColor = onPrimary, offset x = -5.dp)
    expect(source).toMatch(/\.ti__badge \{[^}]*background:\s*rgb\(var\(--v-theme-primary\)\)/s)
    expect(source).toMatch(/margin-right:\s*5px/)
  })

  it('uses the reference typography of the title and of the detail cells', () => {
    // titleMedium: 16sp / 24sp / Medium / 0.15sp
    expect(source).toMatch(/font-size:\s*16px;\s*line-height:\s*24px;\s*font-weight:\s*500;\s*letter-spacing:\s*0\.15px/)
    // bodyMedium: 14sp / 20sp
    expect(source).toMatch(/font-size:\s*14px;\s*line-height:\s*20px;/)
  })

  it('keeps the details box shape and background of the reference', () => {
    // Box(clip(medium = 12dp), background(surfaceContainerHighest), padding(8.dp), clip(RoundedCornerShape(6.dp)))
    expect(source).toMatch(/border-radius:\s*12px/)
    expect(source).toMatch(/background:\s*rgb\(var\(--v-theme-surface-container-highest\)\)/)
    expect(source).toMatch(/margin-top:\s*12px/)
  })

  it('renders the item menu entries of the reference', () => {
    expect(source).toContain('Open in browser')
    expect(source).toContain('Copy link')
    expect(source).toContain('Track privately')
    expect(source).toContain('Track publicly')
    expect(source).toContain('Remove')
    // DropdownMenu: 196dp wide, 4dp radius, 48dp items.
    expect(source).toMatch(/width:\s*196px/)
    expect(source).toMatch(/height:\s*48px/)
  })

  it('renders the empty tracker state with the Add tracking button', () => {
    expect(source).toContain('Add tracking')
    expect(source).toMatch(/margin:\s*0 0 0 16px/)
  })

  it('uses the placeholders of the reference for unset values', () => {
    expect(source).toContain('Start date')
    expect(source).toContain('Finish date')
    expect(source).toContain("'Score'")
    // UNSET_TEXT_ALPHA = 0.5F
    expect(source).toMatch(/const UNSET_TEXT_ALPHA = 0\.5/)
  })

  it('renders the remove confirmation of TrackerRemoveScreen', () => {
    expect(source).toContain('This will remove the tracking locally.')
    expect(source).toContain('Also remove from')
    expect(source).toContain('>OK</button>')
  })

  it('reads the tracking data over the Suwayomi GraphQL endpoint', () => {
    expect(source).toContain('listTrackers')
    expect(source).toContain('fetchMangaTrackRecords')
  })
})
