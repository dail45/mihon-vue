import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('3.10 Granular History Filters, Multi-Select & Row Indicators', () => {
  it('HistoryFilterDialog implements TriState filters and panorama cover switch', () => {
    const source = readFileSync('src/features/history/components/HistoryFilterDialog.vue', 'utf8')
    expect(source).toContain('filterUnfinishedManga')
    expect(source).toContain('filterUnfinishedChapter')
    expect(source).toContain('filterNonLibrary')
    expect(source).toContain('wideCover')
    expect(source).toContain('TriStateRow')
    expect(source).toContain('AdaptiveSettingsSheet')
    expect(source).toContain('action_filter_unfinished_manga')
    expect(source).toContain('action_filter_unfinished_chapter')
    expect(source).toContain('action_filter_non_library_entries')
    expect(source).toContain('action_panorama_cover')
  })

  it('HistoryItem implements unread blue dot, page progress, and 16:9 wide cover toggle', () => {
    const source = readFileSync('src/features/history/components/HistoryItem.vue', 'utf8')
    expect(source).toContain('history-item__unread-dot')
    expect(source).toContain('history-item__progress')
    expect(source).toContain('history-item__cover--wide')
    expect(source).toContain('entry.hasUnread')
    expect(source).toContain('entry.readProgress')
    expect(source).toContain('wideCover')
    expect(source).toContain('selectionMode')
    expect(source).toContain('selected')
  })

  it('HistoryView implements filter button, storage keys, and multi-selection mode', () => {
    const source = readFileSync('src/features/history/views/HistoryView.vue', 'utf8')
    expect(source).toContain('mihon.history.filterUnfinishedManga')
    expect(source).toContain('mihon.history.filterUnfinishedChapter')
    expect(source).toContain('mihon.history.filterNonLibrary')
    expect(source).toContain('mihon.history.wideCover')
    expect(source).toContain('HistoryFilterDialog')
    expect(source).toContain('filter_list')
    expect(source).toContain('selectionMode')
    expect(source).toContain('selectAll')
    expect(source).toContain('invertSelection')
    expect(source).toContain('confirmBatchDelete')
    expect(source).toContain('onLongPress')
  })
})
