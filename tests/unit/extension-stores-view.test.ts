import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const view = readFileSync('src/features/browse/views/ExtensionStoresView.vue', 'utf8') + '\n' + readFileSync('src/features/browse/components/ExtensionStoresPanel.vue', 'utf8')
const api = readFileSync('src/core/api/extensionStores.ts', 'utf8')

describe('ExtensionStoresView matches the Mihon reference', () => {
  it('uses the reference app bar title and refresh action', () => {
    expect(view).toContain('Extension stores')
    expect(view).toContain('aria-label="Refresh"')
    expect(view).toContain('icon="refresh"')
  })

  it('renders the store card header with the label icon and the titleMedium name', () => {
    expect(view).toContain('>label<')
    expect(view).toMatch(/font-size:\s*16px;\s*line-height:\s*24px;\s*font-weight:\s*500/)
    // 16dp start / top / end padding of the header row.
    expect(view).toMatch(/padding:\s*16px 16px 0/)
  })

  it('keeps the LazyColumn content padding and the 8dp item spacing', () => {
    // topSmallPaddingValues (8dp) + horizontal medium padding (16dp).
    expect(view).toMatch(/padding:\s*8px 16px 16px/)
    expect(view).toMatch(/gap:\s*8px/)
  })

  it('renders the four reference store actions', () => {
    expect(view).toContain('aria-label="Open in browser"')
    expect(view).toContain('aria-label="Open Discord"')
    expect(view).toContain('aria-label="Copy to clipboard"')
    expect(view).toContain('aria-label="Delete"')
    // IconButton: 48dp touch target.
    expect(view).toMatch(/width:\s*48px !important/)
  })

  it('renders the empty screen with a kaomoji face and the reference label', () => {
    expect(view).toContain('empty-face')
    expect(view).toContain("You haven't added an extension store yet")
  })

  it('renders the create and delete dialogs with the reference titles', () => {
    expect(view).toContain('Add extension store')
    expect(view).toContain('Remove extension store')
    expect(view).toContain('Store index URL')
    expect(view).toContain('This extension store already exists')
    expect(view).toContain('Processing…')
  })

  it('uses the extended FAB for the add action', () => {
    expect(view).toContain('<CategoryFab')
    expect(view).toContain('@create="openCreateDialog"')
  })

  it('derives the stores from the Suwayomi catalogue and exposes no store management API', () => {
    expect(api).toContain('/extension/list')
    expect(api).not.toContain('method: \'POST\'')
  })
})
