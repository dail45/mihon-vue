import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/MangaChapterListItem.vue', 'utf8')

/**
 * Parity guards for MangaChapterListItem.vue with
 * mihon/app/src/main/java/eu/kanade/presentation/manga/components/MangaChapterListItem.kt
 */
describe('MangaChapterListItem parity with Mihon', () => {
  it('applies exact layout geometry and padding matching Compose Row', () => {
    // Row.padding(start = 16.dp, top = 12.dp, end = 8.dp, bottom = 12.dp)
    expect(source).toContain('padding: 12px 8px 12px 16px;')
    // Min height 56dp
    expect(source).toContain('min-height: 56px;')
    // Column(verticalArrangement = Arrangement.spacedBy(6.dp))
    expect(source).toContain('gap: 6px;')
    // Title row gap: Arrangement.spacedBy(2.dp)
    expect(source).toContain('gap: 2px;')
  })

  it('applies Material 3 typography tokens to title and subtitle', () => {
    // MaterialTheme.typography.bodyMedium: 14sp / 20sp, weight 400, letter-spacing 0.25px
    expect(source).toContain('font-size: 14px;')
    expect(source).toContain('line-height: 20px;')
    expect(source).toContain('letter-spacing: 0.25px;')
    // MaterialTheme.typography.bodySmall: 12sp / 16sp, weight 400, letter-spacing 0.4px
    expect(source).toContain('font-size: 12px;')
    expect(source).toContain('line-height: 16px;')
    expect(source).toContain('letter-spacing: 0.4px;')
  })

  it('matches Compose alpha tokens for read and secondary text', () => {
    // DISABLED_ALPHA = 0.38 for read title and read subtitle
    expect(source).toMatch(/\.manga-chapter-item\.is-read\s+\.manga-chapter-item__title\s*\{[^}]*0\.38/s)
    expect(source).toMatch(/\.manga-chapter-item\.is-read\s+\.manga-chapter-item__subtitle\s*\{[^}]*0\.38/s)
    // SECONDARY_ALPHA = 0.78 for unread subtitle
    expect(source).toMatch(/\.manga-chapter-item__subtitle\s*\{[^}]*0\.78/s)
    // readProgress is always DISABLED_ALPHA (0.38)
    expect(source).toMatch(/\.manga-chapter-item__progress\s*\{[^}]*0\.38/s)
  })

  it('renders exact Mihon vector bookmark and unread circle', () => {
    // MaterialSymbols.RoundedFilled.Circle: 8dp, primary color, 4dp end margin
    expect(source).toContain('width: 8px;')
    expect(source).toContain('height: 8px;')
    expect(source).toContain('margin-inline-end: 4px;')
    expect(source).toContain('rgb(var(--v-theme-primary))')

    // MaterialSymbols.RoundedFilled.Bookmark exact path from mihon/icons
    expect(source).toContain('m480-240-168 72q-40 17-76-6.5T200-241v-519q0-33 23.5-56.5T280-840h400q33 0 56.5 23.5T760-760v519q0 43-36 66.5t-76 6.5l-168-72Z')
    expect(source).toContain('width="18"')
    expect(source).toContain('height="18"')

    // DotSeparatorText: " • "
    expect(source).toContain(' • ')
    expect(source).toContain('white-space: pre;')
  })

  it('applies selectedBackground matching Compose Modifier.selectedBackground', () => {
    // secondary with alpha 0.22 (light) / 0.16 (dark)
    expect(source).toContain('rgba(var(--v-theme-secondary), 0.22)')
    expect(source).toContain('rgba(var(--v-theme-secondary), 0.16)')
  })

  it('implements Material 3 state layers for hover, pressed and focus', () => {
    // Hover: 8% onSurface
    expect(source).toContain('opacity: 0.08;')
    // Pressed/active: 12% onSurface
    expect(source).toContain('opacity: 0.12;')
    // Focus visible outline
    expect(source).toContain('outline: 2px solid rgb(var(--v-theme-primary));')
  })

  it('adheres to SwipeableActionsBox specifications', () => {
    // swipeActionThreshold = 56.dp
    expect(source).toContain('SWIPE_THRESHOLD = 56')
    // surfaceContainerLowest until threshold
    expect(source).toContain('rgb(var(--v-theme-surface-container-lowest))')
    // primaryContainer when threshold reached
    expect(source).toContain('rgb(var(--v-theme-primary-container))')
    // file_download_off for active queue/downloading in swipe
    expect(source).toContain('file_download_off')
  })

  it('supports LongPress and Shift+Click gestures', () => {
    // Long press timeout 500ms
    expect(source).toContain('LONG_PRESS_MS = 500')
    // Shift+click triggers longpress for selection mode
    expect(source).toContain('event.shiftKey')
    expect(source).toContain("emit('longpress')")
    // Haptic feedback fallback
    expect(source).toContain('navigator.vibrate')
  })
})
