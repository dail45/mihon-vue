import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(
  resolve(process.cwd(), 'src/features/reader/components/ReaderPageActionsDialog.vue'),
  'utf8',
)

describe('ReaderPageActionsDialog Spread Actions', () => {
  it('supports spread props including secondaryPageIndex and direction', () => {
    expect(source).toContain('secondaryPageIndex?: number | null')
    expect(source).toContain("direction?: 'ltr' | 'rtl'")
    expect(source).toContain('hasExtraPage')
  })

  it('declares combined action callbacks and emits', () => {
    expect(source).toContain('onShareCombined?: (toClipboard: boolean) => void')
    expect(source).toContain('onSaveCombined?: () => void')
    expect(source).toContain("(e: 'share-combined', toClipboard: boolean): void")
    expect(source).toContain("(e: 'save-combined'): void")
  })

  it('defines 3 distinct action sets for spread mode', () => {
    expect(source).toContain('firstPageActions')
    expect(source).toContain('secondPageActions')
    expect(source).toContain('combinedPageActions')

    // First page actions
    expect(source).toContain('action_set_first_page_cover')
    expect(source).toContain('action_copy_to_clipboard_first_page')
    expect(source).toContain('action_share_first_page')
    expect(source).toContain('action_save_first_page')

    // Second page actions
    expect(source).toContain('action_set_second_page_cover')
    expect(source).toContain('action_copy_to_clipboard_second_page')
    expect(source).toContain('action_share_second_page')
    expect(source).toContain('action_save_second_page')

    // Combined actions
    expect(source).toContain('action_copy_to_clipboard_combined_page')
    expect(source).toContain('action_share_combined_page')
    expect(source).toContain('action_save_combined_page')
  })

  it('stitches combined pages with canvasStitch utility', () => {
    expect(source).toContain('stitchPagesToBlob(')
    expect(source).toContain('copyCombinedToClipboard')
    expect(source).toContain('shareCombined')
    expect(source).toContain('saveCombined')
    expect(source).toContain('combined_page_copied')
  })

  it('renders 3 action rows when hasExtraPage is active', () => {
    expect(source).toContain('v-if="!hasExtraPage"')
    expect(source).toContain('v-else class="reader-page-actions-column"')
    expect(source).toContain('runSpreadAction')
  })
})
