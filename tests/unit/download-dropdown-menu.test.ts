import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/DownloadDropdownMenu.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/components/DownloadDropdownMenu.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/components/DownloadDropdownMenu.kt
 * (Mihon, commit 446f6df82c390ab760802c2fce3b677bce3f31c1) and with the menu wrapper
 * `presentation/components/DropdownMenu.kt` it resolves to.
 */
describe('DownloadDropdownMenu parity with Mihon', () => {
  it('renders the six reference items in the reference order with the reference strings', () => {
    // DownloadDropdownMenuItems: NEXT_1/5/10/25 chapters, then Unread and Bookmarked.
    expect(source).toMatch(/NEXT_1_CHAPTER', label: downloadAmountLabel\(1\)/)
    expect(source).toMatch(/NEXT_5_CHAPTERS', label: downloadAmountLabel\(5\)/)
    expect(source).toMatch(/NEXT_10_CHAPTERS', label: downloadAmountLabel\(10\)/)
    expect(source).toMatch(/NEXT_25_CHAPTERS', label: downloadAmountLabel\(25\)/)
    expect(source).toMatch(/UNREAD_CHAPTERS', label: 'Unread'/)
    expect(source).toMatch(/BOOKMARKED_CHAPTERS', label: 'Bookmarked'/)
    // MR.plurals.download_amount: one -> "Next chapter", other -> "Next %d chapters".
    expect(source).toMatch(/amount === 1 \? 'Next chapter' : `Next \$\{amount\} chapters`/)
    // MR.strings.download_unread / MR.strings.download_bookmarked.
    expect(source).toContain("'Unread'")
    expect(source).toContain("'Bookmarked'")
  })

  it('uses the width, shape, colour and elevation of the reference menu', () => {
    // presentation/components/DropdownMenu.kt: sizeIn(minWidth = 196.dp, maxWidth = 196.dp).
    expect(source).toMatch(/\.v-overlay__content\.download-dropdown-menu \{[^}]*width: 196px;/s)
    expect(source).toMatch(/min-width: 196px;/)
    expect(source).toMatch(/max-width: 196px;/)
    // MD3 MenuTokens.ContainerShape = corner extra small (4dp).
    expect(source).toMatch(/\.v-overlay__content\.download-dropdown-menu \{[^}]*border-radius: 4px;/s)
    // MD3 MenuTokens.ContainerColor = surface container.
    expect(source).toContain('background: rgb(var(--v-theme-surface-container))')
    // MD3 MenuTokens.ContainerElevation = level 2.
    expect(source).toContain('box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)')
  })

  it('uses the Material3 menu list item metrics', () => {
    // MD3 DropdownMenuVerticalPadding = 8dp.
    expect(source).toMatch(/padding: 8px 0;/)
    // MD3 MenuListItemContainerHeight = 48dp.
    expect(source).toMatch(/min-height: 48px;/)
    // MD3 DropdownMenuItemContentPadding = horizontal 12dp, vertical 0dp.
    expect(source).toMatch(/padding: 0 12px;/)
    // MD3 bodyLarge: 16sp / 24sp, weight 400, letter spacing 0.5px.
    expect(source).toMatch(/font-size: 16px;/)
    expect(source).toMatch(/line-height: 24px;/)
    expect(source).toMatch(/font-weight: 400;/)
    expect(source).toMatch(/letter-spacing: 0\.5px;/)
    // MD3 hover & active state layers: 8% / 12% on-surface.
    expect(source).toContain('rgba(var(--v-theme-on-surface), 0.08)')
    expect(source).toContain('rgba(var(--v-theme-on-surface), 0.12)')
  })

  it('maps the Compose DpOffset of the reference onto the menu position', () => {
    // presentation/components/DropdownMenu.kt: offset = DpOffset(8.dp, (-56).dp).
    expect(source).toContain('defaultDownloadMenuOffset = { x: 8, y: -56 }')
    // Vuetify: offset[0] is the placement axis, offset[1] the alignment axis (mirrored).
    expect(source).toMatch(/return \[offset\.y, -offset\.x\]/)
  })

  it('reports the picked action and dismisses the menu like the reference item', () => {
    // `onClick = { onDownloadClicked(downloadAction); onDismissRequest() }`.
    expect(source).toMatch(/emit\('download', action\)/)
    expect(source).toMatch(/emit\('update:expanded', false\)/)
  })

  it('keeps the menu openable and dismissable without the Vuetify delays', () => {
    // Compose opens the popup immediately; Vuetify delays it by 300ms by default.
    expect(source).toContain(':open-delay="0"')
    expect(source).toContain(':close-delay="0"')
    // The popup of the reference is focusable (PopupProperties(focusable = true)).
    expect(source).toContain('location="bottom start"')
  })

  it('explains the missing download action instead of silently doing nothing', () => {
    // The Suwayomi download queue is GraphQL only and the chapter selection of the
    // reference view model is not implemented in the web client.
    expect(source).toContain('downloadUnsupported')
    expect(source).toContain('not supported in the web version')
  })
})
