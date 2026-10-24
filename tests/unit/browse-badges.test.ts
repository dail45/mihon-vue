import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const badgesVue = readFileSync('src/features/manga/components/MangaBadges.vue', 'utf8')
const inLibraryBadgeVue = readFileSync('src/features/library/components/InLibraryBadge.vue', 'utf8')
const styles = readFileSync('src/styles/main.scss', 'utf8')
const collectionsBookmarkSvg = readFileSync(
  'mihon/icons/material-symbols/src/main/valkyrieResources/rounded/collections_bookmark.svg',
  'utf8',
)
const folderSvg = readFileSync(
  'mihon/icons/material-symbols/src/main/valkyrieResources/rounded/folder.svg',
  'utf8',
)

/**
 * Pixel-parity guardrails for Mihon's BrowseBadges and presentation-core Badges:
 * - `mihon/app/src/main/java/eu/kanade/presentation/browse/components/BrowseBadges.kt`:
 *     @Composable
 *     internal fun InLibraryBadge(enabled: Boolean) {
 *         if (enabled) {
 *             Badge(
 *                 imageVector = MaterialSymbols.Rounded.CollectionsBookmark,
 *             )
 *         }
 *     }
 *
 * - `mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/Badges.kt`:
 *     @Composable
 *     fun BadgeGroup(
 *         modifier: Modifier = Modifier,
 *         shape: Shape = MaterialTheme.shapes.extraSmall, // 4.dp
 *         content: @Composable RowScope.() -> Unit,
 *     )
 *
 *     @Composable
 *     fun Badge(
 *         text: String,
 *         modifier: Modifier = Modifier,
 *         color: Color = MaterialTheme.colorScheme.secondary,
 *         textColor: Color = MaterialTheme.colorScheme.onSecondary,
 *         shape: Shape = RectangleShape,
 *     ) // bodySmall (12sp/16sp), FontWeight.Medium (500), padding(3.dp, 1.dp)
 *
 *     @Composable
 *     fun Badge(
 *         imageVector: ImageVector,
 *         modifier: Modifier = Modifier,
 *         color: Color = MaterialTheme.colorScheme.secondary,
 *         iconColor: Color = MaterialTheme.colorScheme.onSecondary,
 *         shape: Shape = RectangleShape,
 *     ) // Placeholder(12sp, 12sp, Center), padding(3.dp, 1.dp)
 */
describe('BrowseBadges & Badges parity with Mihon reference', () => {
  it('implements InLibraryBadge with MaterialSymbols.Rounded.CollectionsBookmark', () => {
    // Extract SVG path from reference SVG
    const refPathMatch = collectionsBookmarkSvg.match(/d="([^"]+)"/)
    expect(refPathMatch).not.toBeNull()
    const refPath = refPathMatch![1]

    // Verify MangaBadges has identical collections_bookmark vector path
    expect(badgesVue).toContain(`collections_bookmark: '${refPath}'`)
  })

  it('renders collections_bookmark icon inside InLibraryBadge with exact 12sp (12px) dimensions and viewBox', () => {
    expect(badgesVue).toMatch(/viewBox="0 -960 960 960"/)
    expect(badgesVue).toMatch(/width="12"/)
    expect(badgesVue).toMatch(/height="12"/)
    expect(badgesVue).toMatch(/fill="currentColor"/)
  })

  it('gating InLibraryBadge: only shown when enabled in catalogue mode, hidden at end side', () => {
    // Catalogue mode check
    expect(badgesVue).toContain("if (props.catalogue)")
    expect(badgesVue).toContain("if (props.side === 'end' || !inLibrary.value) return []")
    expect(badgesVue).toContain("key: 'in-library'")
    expect(badgesVue).toContain("icon: 'collections_bookmark'")
    expect(badgesVue).toContain("color: 'secondary'")
  })

  it('supports explicit enabled prop as well as wire inLibrary and domain favorite', () => {
    expect(badgesVue).toContain("props.enabled !== undefined")
    expect(badgesVue).toContain("props.manga.inLibrary")
    expect(badgesVue).toContain("props.manga.favorite")
  })

  it('provides dedicated InLibraryBadge component conforming to BrowseBadges.kt signature', () => {
    expect(inLibraryBadgeVue).toContain('<MangaBadges :enabled="enabled" :manga="manga" catalogue side="start" />')
  })

  it('BadgeGroup matches MaterialTheme.shapes.extraSmall (4dp radius, overflow hidden)', () => {
    expect(styles).toMatch(/\.manga-badge-group\s*\{[^}]*border-radius:\s*4px/)
    expect(styles).toMatch(/\.manga-badge-group\s*\{[^}]*overflow:\s*hidden/)
    expect(styles).toMatch(/\.manga-badge-group\s*\{[^}]*display:\s*inline-flex/)
    expect(badgesVue).toMatch(/\.manga-badge-group\s*\{[^}]*border-radius:\s*4px/)
  })

  it('Badge matches M3 bodySmall typography: 12sp font-size, 16sp line-height, 0.4px letter-spacing, 500 Medium weight', () => {
    expect(styles).toMatch(/\.manga-badge\s*\{[^}]*font-size:\s*12px/)
    expect(styles).toMatch(/\.manga-badge\s*\{[^}]*line-height:\s*16px/)
    expect(styles).toMatch(/\.manga-badge\s*\{[^}]*font-weight:\s*500/)
    expect(styles).toMatch(/\.manga-badge\s*\{[^}]*letter-spacing:\s*\.?4px/)
    expect(badgesVue).toMatch(/\.manga-badge\s*\{[^}]*font-size:\s*12px/)
    expect(badgesVue).toMatch(/\.manga-badge\s*\{[^}]*line-height:\s*16px/)
    expect(badgesVue).toMatch(/\.manga-badge\s*\{[^}]*font-weight:\s*500/)
  })

  it('Badge matches padding(horizontal = 3.dp, vertical = 1.dp) and height = 18px', () => {
    expect(styles).toMatch(/\.manga-badge\s*\{[^}]*padding:\s*1px 3px/)
    expect(styles).toMatch(/\.manga-badge\s*\{[^}]*height:\s*18px/)
    expect(styles).toMatch(/\.manga-badge\s*\{[^}]*white-space:\s*nowrap/)
    expect(badgesVue).toMatch(/\.manga-badge\s*\{[^}]*padding:\s*1px 3px/)
    expect(badgesVue).toMatch(/\.manga-badge\s*\{[^}]*height:\s*18px/)
  })

  it('Badge matches RectangleShape (border-radius: 0) and box-sizing: border-box', () => {
    expect(styles).toMatch(/\.manga-badge\s*\{[^}]*border-radius:\s*0/)
    expect(styles).toMatch(/\.manga-badge\s*\{[^}]*box-sizing:\s*border-box/)
    expect(badgesVue).toMatch(/\.manga-badge\s*\{[^}]*border-radius:\s*0/)
    expect(badgesVue).toMatch(/\.manga-badge\s*\{[^}]*box-sizing:\s*border-box/)
  })

  it('Badge colors match Material 3 secondary / onSecondary and tertiary / onTertiary', () => {
    expect(styles).toMatch(/\.manga-badge\.bg-secondary\s*\{[^}]*--v-theme-secondary/)
    expect(styles).toMatch(/\.manga-badge\.bg-secondary\s*\{[^}]*--v-theme-on-secondary/)
    expect(styles).toMatch(/\.manga-badge\.bg-tertiary\s*\{[^}]*--v-theme-tertiary/)
    expect(styles).toMatch(/\.manga-badge\.bg-tertiary\s*\{[^}]*--v-theme-on-tertiary/)

    expect(badgesVue).toMatch(/\.manga-badge\.bg-secondary\s*\{[^}]*--v-theme-secondary/)
    expect(badgesVue).toMatch(/\.manga-badge\.bg-secondary\s*\{[^}]*--v-theme-on-secondary/)
    expect(badgesVue).toMatch(/\.manga-badge\.bg-tertiary\s*\{[^}]*--v-theme-tertiary/)
    expect(badgesVue).toMatch(/\.manga-badge\.bg-tertiary\s*\{[^}]*--v-theme-on-tertiary/)
  })

  it('Folder icon in LanguageBadge local source matches MaterialSymbols.Rounded.Folder v329', () => {
    const refFolderMatch = folderSvg.match(/d="([^"]+)"/)
    expect(refFolderMatch).not.toBeNull()
    const refFolderPath = refFolderMatch![1]

    expect(badgesVue).toContain(`folder: '${refFolderPath}'`)
  })
})
