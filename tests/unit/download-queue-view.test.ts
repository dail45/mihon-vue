import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/downloads/views/DownloadQueueView.vue', 'utf8')

/**
 * Download queue screen parity test.
 * References:
 *   - mihon/app/src/main/java/eu/kanade/tachiyomi/ui/download/DownloadQueueScreen.kt
 *   - mihon/app/src/main/java/eu/kanade/presentation/download/DownloadQueueList.kt
 *   - mihon/app/src/main/java/eu/kanade/tachiyomi/ui/download/DownloadQueueViewModel.kt
 */
describe('DownloadQueueView matches Mihon Compose reference', () => {
  it('renders TopAppBar with navigateUp, title "Download queue" and Pill counter', () => {
    expect(source).toContain('aria-label="Navigate up"')
    expect(source).toContain('icon="arrow_back"')
    expect(source).toContain('Download queue')
    expect(source).toContain('queue.downloadCount.value > 0')
    expect(source).toContain('queue-pill')
  })

  it('renders Sort and Overflow actions only when queue is not empty', () => {
    expect(source).toContain('v-if="queue.downloadCount.value > 0"')
    expect(source).toContain('aria-label="Sort"')
    expect(source).toContain('icon="sort"')
    expect(source).toContain('aria-label="More options"')
    expect(source).toContain('icon="more_vert"')
  })

  it('renders Sort menu with exact nested ordering options', () => {
    expect(source).toContain('title="By upload date"')
    expect(source).toContain('title="Newest"')
    expect(source).toContain('title="Oldest"')
    expect(source).toContain('title="By chapter number"')
    expect(source).toContain('title="Ascending"')
    expect(source).toContain('title="Descending"')
  })

  it('renders Overflow menu with "Cancel all"', () => {
    expect(source).toContain('title="Cancel all"')
    expect(source).toContain('onCancelAllClick')
  })

  it('renders MihonEmptyScreen when queue is empty', () => {
    expect(source).toContain('<MihonEmptyScreen message="No downloads" />')
  })

  it('renders group headers with section name and download count', () => {
    expect(source).toContain('{{ section.name }} ({{ section.downloads.length }})')
    expect(source).toContain('queue-group-header')
  })

  it('renders queue items with drag handle, manga title, pages, chapter name, and progress track', () => {
    expect(source).toContain('queue-drag-handle')
    expect(source).toContain('queue-manga-title')
    expect(source).toContain('queue-pages')
    expect(source).toContain('queue-chapter-name')
    expect(source).toContain('queue-progress-track')
    expect(source).toContain('queue-progress-bar')
  })

  it('renders item action menu with all 6 reference actions', () => {
    expect(source).toContain('title="Move to top"')
    expect(source).toContain('title="Move series to top"')
    expect(source).toContain('title="Move to bottom"')
    expect(source).toContain('title="Move series to bottom"')
    expect(source).toContain('title="Cancel"')
    expect(source).toContain('title="Cancel all for this series"')
  })

  it('renders SmallExtendedFloatingActionButton with Pause/Resume and expands on scroll up', () => {
    expect(source).toContain('queue-fab')
    expect(source).toContain("queue.isRunning.value ? 'Pause' : 'Resume'")
    expect(source).toContain("queue.isRunning.value ? 'pause' : 'play_arrow'")
    expect(source).toContain("delta > 0")
    expect(source).toContain("fabExpanded.value = false")
    expect(source).toContain("delta < 0")
    expect(source).toContain("fabExpanded.value = true")
  })

  it('respects M3 styling tokens (196dp menu, 56dp FAB, 4dp progress track, 48dp interactive item targets)', () => {
    expect(source).toMatch(/width:\s*196px/)
    expect(source).toMatch(/min-width:\s*196px/)
    expect(source).toMatch(/max-width:\s*196px/)
    expect(source).toMatch(/height:\s*56px/)
    expect(source).toMatch(/min-width:\s*56px/)
    expect(source).toMatch(/border-radius:\s*16px/)
    expect(source).toMatch(/height:\s*4px/)
  })
})
