import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const itemComponent = readFileSync('src/components/LibraryListItem.vue', 'utf8')
const collectionComponent = readFileSync('src/components/MangaCollection.vue', 'utf8')
const styles = readFileSync('src/styles/main.scss', 'utf8')

/**
 * Pixel-parity verification for CHECKLIST item 4:
 * Library — список
 *
 * References:
 * - mihon/app/src/main/java/eu/kanade/presentation/library/components/LibraryList.kt
 * - mihon/app/src/main/java/eu/kanade/presentation/library/components/CommonMangaItem.kt (MangaListItem)
 * - mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/LazyList.kt (FastScrollLazyColumn)
 * - mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/VerticalFastScroller.kt
 * - mihon/presentation-core/src/main/java/tachiyomi/presentation/core/util/Modifier.kt (selectedBackground)
 */
describe('LibraryList pixel-parity with Mihon reference', () => {
  describe('FastScrollLazyColumn integration in MangaCollection.vue', () => {
    it('sets 8dp vertical content padding for the list column', () => {
      // LibraryList.kt: contentPadding = contentPadding + PaddingValues(vertical = 8.dp)
      expect(styles).toMatch(/\.manga-list\s*\{[^}]*padding:\s*8px\s+0/)
    })

    it('renders GlobalSearchItem with fillMaxWidth when searchQuery is present', () => {
      // LibraryList.kt: GlobalSearchItem(modifier = Modifier.fillMaxWidth(), searchQuery = searchQuery)
      expect(collectionComponent).toContain('<GlobalSearchItem v-if="showGlobalSearch"')
      expect(collectionComponent).toContain('variant="list"')
    })

    it('includes vertical fast scroller with 12dp width and 48dp thumb', () => {
      // VerticalFastScroller.kt: ThumbLength = 48.dp, ThumbThickness = 12.dp
      expect(collectionComponent).toContain('fastScrollVisible')
      expect(styles).toMatch(/\.fast-scroll-thumb\s*\{[^}]*width:\s*12px;\s*height:\s*48px/)
      expect(styles).toMatch(/\.fast-scroll-thumb\s*\{[^}]*border-radius:\s*6px/)
      expect(styles).toMatch(/\.fast-scroll-thumb\s*\{[^}]*background:\s*rgb\(var\(--v-theme-primary\)\)/)
    })

    it('insets the fast scroll bar by 8dp for list content', () => {
      // VerticalFastScroller.kt: padding(horizontal = 8.dp)
      expect(collectionComponent).toContain('const endPadding = listRef.value ? 8 : 0')
    })

    it('uses LibraryListItem component for each entry in list display mode', () => {
      expect(collectionComponent).toContain('<LibraryListItem')
      expect(collectionComponent).toContain('v-for="item in items"')
    })
  })

  describe('MangaListItem row container in LibraryListItem.vue', () => {
    it('sets 56dp height and 16dp horizontal padding', () => {
      // MangaListItem: Row(height(56.dp).padding(horizontal = 16.dp, vertical = 8.dp))
      expect(itemComponent).toMatch(/\.manga-list-row\s*\{[^}]*height:\s*56px/)
      expect(itemComponent).toMatch(/\.manga-list-row\s*\{[^}]*padding:\s*0\s+16px/)
      expect(itemComponent).toMatch(/\.manga-list-row\s*\{[^}]*display:\s*flex/)
      expect(itemComponent).toMatch(/\.manga-list-row\s*\{[^}]*align-items:\s*center/)
    })

    it('prevents user text selection during touch hold gestures', () => {
      expect(itemComponent).toMatch(/\.manga-list-row\s*\{[^}]*user-select:\s*none/)
    })

    it('paints selectedBackground with secondary alpha tint (0.22 light / 0.16 dark)', () => {
      // Modifier.selectedBackground: if (isSystemInDarkTheme()) 0.16f else 0.22f of colorScheme.secondary
      expect(itemComponent).toMatch(/\.manga-list-row\.is-selected\s*\{[^}]*background:\s*color-mix\(in srgb,\s*rgb\(var\(--v-theme-secondary\)\)\s*22%,\s*transparent\)/)
      expect(itemComponent).toMatch(/is-selected\s*\{[^}]*background:\s*color-mix\(in srgb,\s*rgb\(var\(--v-theme-secondary\)\)\s*16%,\s*transparent\)/)
    })

    it('attaches v-ripple across the row', () => {
      expect(itemComponent).toContain('v-ripple')
    })

    it('handles touch gestures with 500ms long press and 8px touch slop', () => {
      expect(itemComponent).toContain('@pointerdown="onPointerDown"')
      expect(itemComponent).toContain('@pointermove="onPointerMove"')
      expect(itemComponent).toContain('@pointerup="onPointerUp"')
      expect(itemComponent).toContain('@pointercancel="onPointerUp"')
      expect(itemComponent).toContain('@pointerleave="onPointerUp"')
      expect(itemComponent).toContain('@contextmenu="onContextMenu"')
      expect(itemComponent).toContain('LONG_PRESS_MS = 500')
      expect(itemComponent).toContain('TOUCH_SLOP_PX = 8')
    })

    it('supports Space and Enter keyboard keys for accessibility', () => {
      expect(itemComponent).toContain('@keydown.space="onSpaceKey"')
      expect(itemComponent).toContain('@keydown.enter="onEnterKey"')
    })
  })

  describe('MangaCover.Square geometry in LibraryListItem.vue', () => {
    it('sets 40px square cover with 4dp corner radius', () => {
      // MangaListItem: MangaCover.Square(fillMaxHeight()) inside 56dp row with 8dp vertical padding = 40x40, shapes.extraSmall = 4dp
      expect(itemComponent).toMatch(/\.list-cover-image\s*\{[^}]*width:\s*40px/)
      expect(itemComponent).toMatch(/\.list-cover-image\s*\{[^}]*height:\s*40px/)
      expect(itemComponent).toMatch(/\.list-cover-image\s*\{[^}]*border-radius:\s*4px/)
      expect(itemComponent).toMatch(/\.list-cover-image\s*\{[^}]*overflow:\s*hidden/)
    })

    it('uses #8888881f for placeholder and cover error fallback', () => {
      // MangaCover.kt: CoverPlaceholderColor = Color(0x1F888888) = #8888881f
      expect(itemComponent).toMatch(/\.list-cover-fallback\s*\{[^}]*background:\s*#8888881f/)
      expect(itemComponent).toMatch(/\.list-cover-fallback\s*\{[^}]*width:\s*40px/)
      expect(itemComponent).toMatch(/\.list-cover-fallback\s*\{[^}]*height:\s*40px/)
      expect(itemComponent).toMatch(/\.list-cover-fallback\s*\{[^}]*border-radius:\s*4px/)
    })

    it('dims favorite manga in catalogue to 0.34 alpha', () => {
      // CommonMangaItemDefaults.BrowseFavoriteCoverAlpha = 0.34f
      expect(itemComponent).toContain('coverAlpha')
      expect(itemComponent).toContain('0.34')
    })
  })

  describe('Title typography and layout in LibraryListItem.vue', () => {
    it('styles title with bodyMedium (14sp/20sp w400, letter-spacing 0.25px) and onSurface color', () => {
      // MangaListItem: Text(title, style = MaterialTheme.typography.bodyMedium)
      expect(itemComponent).toMatch(/\.manga-list-title\s*\{[^}]*font-size:\s*14px/)
      expect(itemComponent).toMatch(/\.manga-list-title\s*\{[^}]*line-height:\s*20px/)
      expect(itemComponent).toMatch(/\.manga-list-title\s*\{[^}]*font-weight:\s*400/)
      expect(itemComponent).toMatch(/\.manga-list-title\s*\{[^}]*letter-spacing:\s*0\.25px/)
      expect(itemComponent).toMatch(/\.manga-list-title\s*\{[^}]*color:\s*rgb\(var\(--v-theme-on-surface\)\)/)
    })

    it('pads title 16dp on horizontal axis (between cover and badges)', () => {
      // MangaListItem: Text(modifier = Modifier.padding(horizontal = 16.dp).weight(1f))
      expect(itemComponent).toMatch(/\.manga-list-title\s*\{[^}]*margin:\s*0\s+16px/)
      expect(itemComponent).toMatch(/\.manga-list-title\s*\{[^}]*flex:\s*1\s+1\s+0/)
    })

    it('clamps title to 2 lines with ellipsis', () => {
      expect(itemComponent).toMatch(/\.manga-list-title\s*\{[^}]*-webkit-line-clamp:\s*2/)
      expect(itemComponent).toMatch(/\.manga-list-title\s*\{[^}]*overflow:\s*hidden/)
      expect(itemComponent).toMatch(/\.manga-list-title\s*\{[^}]*text-overflow:\s*ellipsis/)
    })
  })

  describe('ContinueReadingButton in LibraryListItem.vue', () => {
    it('renders 28dp button with 16dp icon and 8dp shape', () => {
      // ContinueReadingButtonSizeSmall = 28.dp, ContinueReadingButtonIconSizeSmall = 16.dp, shapes.small = 8dp
      expect(itemComponent).toMatch(/\.continue-reading\.list-continue\s*\{[^}]*width:\s*28px/)
      expect(itemComponent).toMatch(/\.continue-reading\.list-continue\s*\{[^}]*height:\s*28px/)
      expect(styles).toMatch(/\.continue-reading\s*\{[^}]*border-radius:\s*8px/)
      expect(itemComponent).toContain('size="16"')
    })

    it('applies 8dp start spacing from badge group', () => {
      // MangaListItem: ContinueReadingButton(modifier = Modifier.padding(start = ContinueReadingButtonListSpacing = 8.dp))
      expect(itemComponent).toMatch(/\.continue-reading\.list-continue\s*\{[^}]*margin-left:\s*8px/)
    })

    it('styles button with primaryContainer 90% alpha and onPrimaryContainer icon', () => {
      expect(styles).toMatch(/\.continue-reading\s*\{[^}]*background:\s*color-mix\(in srgb,\s*rgb\(var\(--v-theme-primary-container\)\)\s*90%,\s*transparent\)/)
      expect(styles).toMatch(/\.continue-reading\s*\{[^}]*color:\s*rgb\(var\(--v-theme-on-primary-container\)\)/)
    })

    it('stops pointerdown/pointerup to prevent row click or selection conflict', () => {
      expect(itemComponent).toContain('@pointerdown.stop')
      expect(itemComponent).toContain('@pointerup.stop')
      expect(itemComponent).toContain('@click.stop')
    })

    it('only renders continue button when unread chapters exist', () => {
      // LibraryList.kt: onClickContinueReading = if (onClickContinueReading != null && libraryItem.unreadCount > 0)
      expect(itemComponent).toContain('unreadCount')
      expect(itemComponent).toContain('showContinue')
    })
  })
})
