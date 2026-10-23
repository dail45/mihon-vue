import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/HistoryItem.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/components/HistoryItem.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/history/components/HistoryItem.kt
 * (Mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1). The reference is Kotlin, so the
 * invariants are asserted on the ported Material3 metrics.
 */
describe('HistoryItem parity with Mihon', () => {
  it('keeps the reference row geometry', () => {
    // HistoryItemHeight = 96.dp.
    expect(source).toMatch(/\.history-item \{[^}]*height: 96px;/s)
    // padding(horizontal = MaterialTheme.padding.medium, vertical = MaterialTheme.padding.small)
    // = 16dp / 8dp (presentation-core Constants.kt:18-20).
    expect(source).toMatch(/\.history-item \{[^}]*padding: 8px 16px;/s)
    // Row(verticalAlignment = Alignment.CenterVertically).
    expect(source).toMatch(/\.history-item \{[^}]*align-items: center;/s)
  })

  it('renders the 2:3 cover with the 4dp extraSmall shape', () => {
    // MangaCover.Book: ratio = 2f / 3f, shape = MaterialTheme.shapes.extraSmall (4dp).
    expect(source).toMatch(/\.history-item__cover \{[^}]*width: 53\.3333px;/s)
    expect(source).toMatch(/\.history-item__cover \{[^}]*height: 80px;/s)
    expect(source).toMatch(/\.history-item__cover \{[^}]*border-radius: 4px;/s)
    // The placeholder / error colour is @color/cover_placeholder = #1F888888.
    expect(source).toContain('#8888881f')
  })

  it('uses the reference column padding and bodyMedium typography', () => {
    // Column(weight(1f)).padding(start = 16.dp, end = 8.dp).
    expect(source).toMatch(/\.history-item__body \{[^}]*padding: 0 8px 0 16px;/s)
    // MaterialTheme.typography.bodyMedium: 14sp / 20sp / 0.0178em tracking.
    expect(source).toMatch(/font-size: 0\.875rem;/)
    expect(source).toMatch(/line-height: 20px;/)
    expect(source).toContain('letter-spacing: 0.0178571429em')
    expect(source).toContain('color: rgb(var(--v-theme-on-surface))')
  })

  it('styles the title SemiBold, two lines, with an ellipsis', () => {
    // Text(fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis).
    expect(source).toMatch(/\.history-item__title \{[^}]*font-weight: 600;/s)
    expect(source).toContain('-webkit-line-clamp: 2')
    expect(source).toContain('text-overflow: ellipsis')
    // Text(modifier = Modifier.padding(top = 4.dp)).
    expect(source).toMatch(/\.history-item__subtitle \{ margin-top: 4px; \}/)
  })

  it('shows the favorite action only outside the library', () => {
    // if (!history.coverData.isMangaFavorite) renders the favorite IconButton.
    expect(source).toMatch(/const showFavorite = computed\(\(\) => !props\.entry\.inLibrary\)/)
    expect(source).toContain('v-if="showFavorite"')
    // The delete IconButton is always rendered.
    expect(source).toContain('aria-label="Delete"')
  })

  it('renders the reference icon buttons and their tint', () => {
    // MD3 IconButton: 48dp touch target, 40dp state layer, 24dp icon.
    expect(source).toMatch(/\.history-item__action \{[^}]*width: 48px;/s)
    expect(source).toMatch(/\.history-item__action \{[^}]*height: 48px;/s)
    expect(source).toMatch(/\.history-item__action-icon \{[^}]*font-size: 24px;/s)
    // Icon(tint = MaterialTheme.colorScheme.onSurface).
    expect(source).toMatch(/\.history-item__action \{[^}]*color: rgb\(var\(--v-theme-on-surface\)\);/s)
    // MaterialSymbols.Rounded.Favorite / MaterialSymbols.Rounded.Delete.
    expect(source).toContain('>favorite</span>')
    expect(source).toContain('>delete</span>')
  })

  it('formats the subtitle like MR.strings.recent_manga_time', () => {
    // "Ch. %1$s - %2$s", and the prefix is only added for chapterNumber > -1.
    expect(source).toContain('formatRecentMangaTime')
    const format = readFileSync('src/utils/history.ts', 'utf8')
    expect(format).toContain('`Ch. ${formatChapterNumber(chapterNumber)} - ${readAt}`')
    expect(format).toContain('chapterNumber > -1')
  })
})
