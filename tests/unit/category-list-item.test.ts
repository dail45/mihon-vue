import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/category/CategoryListItem.vue', 'utf8')

describe('CategoryListItem matches the Mihon reference', () => {
  it('renders the drag handle, the name and the two icon buttons', () => {
    expect(source).toContain('category-list-item__handle')
    expect(source).toContain('>drag_handle<')
    expect(source).toContain('category-list-item__name')
    expect(source).toContain('>edit<')
    expect(source).toContain('>delete<')
    expect(source).toContain('aria-label="Rename category"')
    expect(source).toContain('aria-label="Delete"')
    expect(source).toContain('title="Rename category"')
    expect(source).toContain('title="Delete"')
  })

  it('keeps the ElevatedCard geometry of the reference', () => {
    // ElevatedCard: container = surfaceContainerLow, shape = CardDefaults.shape (12dp),
    // elevation level 1 (0 1dp 2dp 0 rgba(0,0,0,.3), 0 1dp 3px 1px rgba(0,0,0,.15)).
    expect(source).toContain('rgb(var(--v-theme-surface-container-low))')
    expect(source).toMatch(/border-radius:\s*12px/)
    expect(source).toMatch(/box-shadow:\s*0 1px 2px 0 rgba\(0, 0, 0, 0\.3\), 0 1px 3px 1px rgba\(0, 0, 0, 0\.15\)/)
    expect(source).toMatch(/min-height:\s*72px/)
    // Dragged elevation level 4 (8dp)
    expect(source).toMatch(/box-shadow:\s*0 2px 3px 0 rgba\(0, 0, 0, 0\.3\), 0 6px 10px 4px rgba\(0, 0, 0, 0\.15\)/)
  })

  it('keeps the row paddings of the reference', () => {
    // Row.padding(vertical = padding.small 8dp).padding(start = padding.small 8dp, end = padding.medium 16dp)
    expect(source).toMatch(/padding:\s*8px 16px 8px 8px/)
    // Icon(DragHandle).padding(padding.medium 16dp)
    expect(source).toMatch(/\.category-list-item__handle \{[^}]*padding:\s*16px;/s)
  })

  it('uses the bodyLarge typography of the default Text', () => {
    expect(source).toMatch(/font-size:\s*16px;\s*line-height:\s*24px;\s*font-weight:\s*400;\s*letter-spacing:\s*0\.03125em/)
  })

  it('uses the MD3 IconButton metrics', () => {
    // IconButton layout = StateLayerSize 40dp, the state layer is a fully rounded 40dp circle,
    // the icon is 24dp and the content color is onSurfaceVariant.
    expect(source).toMatch(/\.category-list-item__action \{[^}]*width:\s*40px;\s*height:\s*40px;/s)
    expect(source).toMatch(/width:\s*40px;\s*height:\s*40px;\s*border-radius:\s*20px/)
    expect(source).toMatch(/font-size:\s*24px;\s*line-height:\s*24px/)
    expect(source).toContain('rgb(var(--v-theme-on-surface-variant))')
    // 8dp gap between consecutive action buttons (48dp Compose layout slot spacing)
    expect(source).toMatch(/\.category-list-item__action \+ \.category-list-item__action \{[^}]*margin-inline-start:\s*8px;/s)
  })

  it('guards inner interactive actions against bubbling to card click/keydown', () => {
    expect(source).toContain('@keydown.stop')
    expect(source).toContain('event.target !== event.currentTarget')
  })
})
