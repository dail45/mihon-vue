import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const card = readFileSync('src/features/browse/components/MangaCard.vue', 'utf8')
const styles = readFileSync('src/styles/main.scss', 'utf8')

/**
 * Pixel-parity verification with Mihon's CommonMangaItem.kt
 * (mihon/app/src/main/java/eu/kanade/presentation/library/components/CommonMangaItem.kt)
 * and MangaCover.kt
 * (mihon/app/src/main/java/eu/kanade/presentation/manga/components/MangaCover.kt)
 */
describe('CommonMangaItem pixel-parity with Mihon reference', () => {
  describe('GridItemSelectable', () => {
    it('applies shapes.small (8dp) clip and 4dp inner padding', () => {
      expect(styles).toMatch(/\.manga-tile\s*\{[^}]*border-radius:\s*8px/)
      expect(styles).toMatch(/\.manga-tile\s*\{[^}]*overflow:\s*hidden/)
      expect(styles).toMatch(/\.manga-tile-link\s*\{[^}]*padding:\s*4px/)
      expect(styles).toMatch(/\.manga-tile-link\s*\{[^}]*border-radius:\s*8px/)
    })

    it('paints selectedOutline in colorScheme.secondary with onSecondary text', () => {
      expect(styles).toMatch(/\.manga-tile-selected\s*\{[^}]*background:\s*rgb\(var\(--v-theme-secondary\)\)/)
      expect(styles).toMatch(/\.manga-tile-selected\s*\{[^}]*color:\s*rgb\(var\(--v-theme-on-secondary\)\)/)
    })

    it('attaches v-ripple to the selectable link', () => {
      expect(card).toContain('v-ripple')
    })

    it('handles long-press, click, pointercancel, and contextmenu gestures', () => {
      expect(card).toContain('@pointerdown="onPointerDown"')
      expect(card).toContain('@pointerup="onPointerUp"')
      expect(card).toContain('@pointercancel="onPointerUp"')
      expect(card).toContain('@pointerleave="onPointerLeave"')
      expect(card).toContain('@contextmenu="onContextMenu"')
      expect(card).toContain('@click="onClick"')
    })
  })

  describe('MangaGridCover & MangaCover.Book', () => {
    it('sets 2:3 aspect ratio and 4dp rounded cover shape', () => {
      expect(styles).toMatch(/\.manga-grid-cover\s*\{[^}]*aspect-ratio:\s*2 \/ 3/)
      expect(styles).toMatch(/\.manga-grid-cover\s*\{[^}]*border-radius:\s*4px/)
      expect(styles).toMatch(/\.manga-cover-media\s*\{[^}]*border-radius:\s*4px/)
      expect(styles).toMatch(/\.manga-cover-media\s*\{[^}]*overflow:\s*hidden/)
    })

    it('uses GRID_SELECTED_COVER_ALPHA = 0.76f for selected covers', () => {
      expect(styles).toMatch(/\.manga-cover-selected\s*\{[^}]*opacity:\s*\.?76/)
    })

    it('uses BrowseFavoriteCoverAlpha = 0.34f for catalogue in-library items', () => {
      expect(styles).toMatch(/\.in-library-cover\s*\{[^}]*opacity:\s*\.?34/)
    })

    it('uses #8888881f for cover placeholder and error vector', () => {
      expect(styles).toMatch(/\.manga-cover-media\s*\{[^}]*background:\s*#8888881f/)
      expect(styles).toMatch(/\.cover-fallback\s*\{[^}]*background:\s*#8888881f/)
      expect(card).toContain('fill="#8888881f"')
    })

    it('positions badgesStart at TopStart and badgesEnd at TopEnd with 4dp padding', () => {
      expect(styles).toMatch(/\.grid-badges-start\s*\{[^}]*top:\s*4px;\s*left:\s*4px/)
      expect(styles).toMatch(/\.grid-badges-end\s*\{[^}]*top:\s*4px;\s*right:\s*4px/)
    })
  })

  describe('CoverTextOverlay (MangaCompactGridItem)', () => {
    it('sets 33% height gradient with bottom 4dp corner radius', () => {
      expect(styles).toMatch(/\.manga-shade\s*\{[^}]*height:\s*33%/)
      expect(styles).toMatch(/\.manga-shade\s*\{[^}]*border-bottom-left-radius:\s*4px/)
      expect(styles).toMatch(/\.manga-shade\s*\{[^}]*border-bottom-right-radius:\s*4px/)
    })

    it('styles overlay title with 12sp/18sp medium white text with black shadow', () => {
      expect(styles).toMatch(/\.manga-title\s*\{[^}]*font-size:\s*12px/)
      expect(styles).toMatch(/\.manga-title\s*\{[^}]*line-height:\s*18px/)
      expect(styles).toMatch(/\.manga-title\s*\{[^}]*font-weight:\s*500/)
      expect(styles).toMatch(/\.manga-title\s*\{[^}]*letter-spacing:\s*\.?1px/)
      expect(styles).toMatch(/\.manga-title-overlay\s*\{[^}]*color:\s*white/)
      expect(styles).toMatch(/\.manga-title-overlay\s*\{[^}]*text-shadow:\s*0 0 4px black/)
      expect(styles).toMatch(/\.manga-title-overlay\s*\{[^}]*padding:\s*8px/)
    })

    it('reserves 42px right padding when continue button is shown', () => {
      expect(styles).toMatch(/\.manga-title-overlay\.has-continue\s*\{[^}]*padding-right:\s*42px/)
    })
  })

  describe('MangaComfortableGridItem', () => {
    it('sets 4dp padding and minimum 2 lines (36px) for title below cover', () => {
      expect(styles).toMatch(/\.manga-title-below\s*\{[^}]*padding:\s*4px/)
      expect(styles).toMatch(/\.manga-card-comfortable \.manga-title-below \.manga-title-text\s*\{[^}]*min-height:\s*36px/)
    })

    it('sets onSurface color when default and onSecondary when selected', () => {
      expect(styles).toMatch(/\.manga-title-below\s*\{[^}]*color:\s*rgb\(var\(--v-theme-on-surface\)\)/)
      expect(styles).toMatch(/\.manga-tile-selected \.manga-title-below\s*\{[^}]*color:\s*rgb\(var\(--v-theme-on-secondary\)\)/)
    })
  })

  describe('ContinueReadingButton', () => {
    it('supports small (28dp) and large (32dp) sizes with shapes.small (8dp)', () => {
      expect(styles).toMatch(/\.continue-reading\s*\{[^}]*border-radius:\s*8px/)
      expect(styles).toMatch(/\.continue-reading-small[^{]*\{[^}]*width:\s*28px;\s*height:\s*28px/)
      expect(styles).toMatch(/\.continue-reading-large\s*\{[^}]*width:\s*32px;\s*height:\s*32px/)
    })

    it('uses primaryContainer 90% alpha and onPrimaryContainer color', () => {
      expect(styles).toMatch(/\.continue-reading\s*\{[^}]*background:\s*color-mix\(in srgb, rgb\(var\(--v-theme-primary-container\)\) 90%, transparent\)/)
      expect(styles).toMatch(/\.continue-reading\s*\{[^}]*color:\s*rgb\(var\(--v-theme-on-primary-container\)\)/)
    })

    it('positions button in cover with ContinueReadingButtonGridPadding (6dp)', () => {
      expect(styles).toMatch(/\.manga-cover-anchor \.continue-reading\s*\{[^}]*position:\s*absolute;\s*right:\s*6px;\s*bottom:\s*6px/)
    })

    it('sets icon size: 16dp for small (overlay) and 20dp for large (covers/comfortable)', () => {
      expect(card).toContain("const continueIcon = computed(() => overlayTitle.value ? 16 : 20)")
    })

    it('handles resume click and prevents event bubbling to tile link', () => {
      expect(card).toContain('@click.stop="onContinueClick"')
      expect(card).toContain('@pointerdown.stop')
      expect(card).toContain('@pointerup.stop')
    })
  })
})
