import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'src/features/manga/components/MangaInfoHeader.vue'), 'utf8')

describe('MangaInfoHeader (MangaInfoHeader.kt) pixel-parity', () => {
  it('implements reference structure: MangaInfoBox, MangaActionRow, ExpandableMangaDescription', () => {
    // Backdrop blur & vertical gradient
    expect(source).toContain('manga-info-backdrop')
    expect(source).toContain('manga-info-backdrop-image')
    expect(source).toContain('manga-info-backdrop-scrim')
    expect(source).toMatch(/filter:\s*blur\(8px\)/)
    expect(source).toMatch(/opacity:\s*0\.2/)
    expect(source).toContain('linear-gradient(to bottom, rgba(0, 0, 0, 0), rgb(var(--v-theme-background)))')

    // Titles section with cover and content
    expect(source).toContain('manga-info-titles')
    expect(source).toContain('manga-info-cover')
    expect(source).toContain('manga-info-content')

    // Action row
    expect(source).toContain('manga-action-row')
    expect(source).toContain('manga-action-button')

    // Summary (notes + markdown description + scrim caret)
    expect(source).toContain('manga-summary')
    expect(source).toContain('manga-summary-notes')
    expect(source).toContain('manga-summary-scrim')
    expect(source).toContain('manga-summary-caret')

    // Tags
    expect(source).toContain('manga-tags')
    expect(source).toContain('manga-tag-chip')
  })

  it('preserves MangaCover.Book geometry: aspect ratio 2/3, 4dp shape, placeholder background', () => {
    // aspectRatio 2/3, clip(MaterialTheme.shapes.extraSmall = 4dp)
    expect(source).toMatch(/aspect-ratio:\s*2\s*\/\s*3/)
    expect(source).toMatch(/border-radius:\s*4px/)
    expect(source).toContain('rgba(136, 136, 136, 0.12)')
  })

  it('supports small (phone) and large (tablet) layout modes', () => {
    // Small: maxWidth 100dp, gap 16dp
    expect(source).toMatch(/width:\s*100px/)
    expect(source).toMatch(/max-width:\s*100px/)
    expect(source).toMatch(/gap:\s*16px/)

    // Large: 65% width, centered
    expect(source).toContain('manga-info-header--large')
    expect(source).toMatch(/width:\s*65%/)
    expect(source).toMatch(/text-align:\s*center/)
  })

  it('applies titleLarge typography to manga title', () => {
    // MaterialTheme.typography.titleLarge: 22sp / 28sp w400
    expect(source).toMatch(/font-size:\s*22px/)
    expect(source).toMatch(/line-height:\s*28px/)
    expect(source).toMatch(/font-weight:\s*400/)
    expect(source).toContain('var(--v-theme-on-surface)')
  })

  it('applies titleSmall typography with secondaryItemAlpha (0.78) to author and artist', () => {
    // MaterialTheme.typography.titleSmall: 14sp / 20sp w500, alpha 0.78
    expect(source).toMatch(/font-size:\s*14px/)
    expect(source).toMatch(/line-height:\s*20px/)
    expect(source).toMatch(/font-weight:\s*500/)
    expect(source).toMatch(/opacity:\s*0\.78/)
  })

  it('renders artist row only when artist is present and differs from author', () => {
    expect(source).toContain('showArtist')
    expect(source).toContain("artist.value !== props.manga.author?.trim()")
    // Filled brush icon
    expect(source).toContain('manga-info-icon--filled')
  })

  it('renders status row with icon, DotSeparatorText, stub warning, and source name', () => {
    // Status text: bodyMedium (14sp / 20sp w400)
    expect(source).toContain('manga-info-status')
    expect(source).toContain('manga-info-dot')
    expect(source).toContain(' • ')
    expect(source).toContain('isStubSource')
    expect(source).toContain('manga-info-icon--stub')
    expect(source).toContain('var(--v-theme-error)')
    expect(source).toContain('manga-info-source')
  })

  it('implements MangaActionRow with 4 weighted buttons and M3 state styling', () => {
    // 4 weighted buttons (flex: 1 1 0), pill shape 20dp
    expect(source).toMatch(/flex:\s*1\s+1\s+0/)
    expect(source).toMatch(/border-radius:\s*20px/)
    // 20dp icon, 4dp spacer, 12sp label
    expect(source).toMatch(/width:\s*20px/)
    expect(source).toMatch(/height:\s*20px/)
    expect(source).toMatch(/font-size:\s*12px/)
    expect(source).toMatch(/line-height:\s*16px/)
    // Disabled alpha 0.38 for inactive buttons
    expect(source).toContain('color-mix(in srgb, rgb(var(--v-theme-on-surface)) 38%, transparent)')
    // Active color primary
    expect(source).toContain('var(--v-theme-primary)')
  })

  it('toggles filled heart icon when manga is in library vs outline when not', () => {
    expect(source).toContain('manga-action-icon--filled')
    expect(source).toMatch(/font-variation-settings:\s*'FILL'\s*1/)
    expect(source).toMatch(/font-variation-settings:\s*'FILL'\s*0/)
  })

  it('handles long press to edit categories and copy URLs/metadata', () => {
    expect(source).toContain('createLongPressHandler')
    expect(source).toContain("emit('edit-category')")
    expect(source).toContain("emit('toggle-library')")
    expect(source).toContain('copyToClipboard')
  })

  it('implements MangaSummary with collapsed height (3 lines vs 6 lines) and bottom scrim caret', () => {
    // 3 lines without notes = 60px; 6 lines with notes = 120px
    expect(source).toMatch(/max-height:\s*60px/)
    expect(source).toMatch(/max-height:\s*120px/)
    // 24dp scrim
    expect(source).toMatch(/height:\s*24px/)
    // Caret glyphs and radial gradient
    expect(source).toContain('expand_less')
    expect(source).toContain('expand_more')
    expect(source).toContain('radial-gradient(circle, rgb(var(--v-theme-background)) 0%,')
  })

  it('implements GenreChips (M3 SuggestionChip) with LazyRow (collapsed) and FlowRow (expanded)', () => {
    // Height 32dp, shape 8dp, border 1dp outlineVariant, 12sp bodySmall
    expect(source).toMatch(/height:\s*32px/)
    expect(source).toMatch(/border-radius:\s*8px/)
    expect(source).toContain('var(--v-theme-outline-variant)')
    expect(source).toContain('var(--v-theme-on-surface-variant)')
    expect(source).toMatch(/padding:\s*0\s+16px/)

    // Scrolling row when collapsed, wrapped when expanded
    expect(source).toContain('manga-tags--expanded')
    expect(source).toMatch(/flex-wrap:\s*wrap/)
  })

  it('anchors tag dropdown menu to clicked chip with Search and Copy options', () => {
    expect(source).toContain('selectedTagTarget')
    expect(source).toContain(':target="selectedTagTarget"')
    expect(source).toContain('title="Search"')
    expect(source).toContain('title="Copy to clipboard"')
  })
})
