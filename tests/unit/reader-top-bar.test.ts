import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'src/components/reader/ReaderTopBar.vue'), 'utf8')

describe('ReaderTopBar matches the Mihon reference', () => {
  it('keeps the reference structure: up button, title/subtitle column, bookmark action, overflow menu', () => {
    expect(source).toContain('arrow_back')
    expect(source).toContain('mr-topbar-manga')
    expect(source).toContain('mr-topbar-chapter')
    expect(source).toContain('bookmark')
    expect(source).toContain('more_vert')
    expect(source).toContain('Open in web view')
    expect(source).toContain('Open in browser')
    expect(source).toContain('Share')
  })

  it('uses the MD3 app bar metrics: 64dp bar, 48dp icon buttons, titleLarge and bodyMedium text', () => {
    expect(source).toMatch(/min-height: 64px/)
    expect(source).toMatch(/width: 48px;\s*\n\s*height: 48px/)
    expect(source).toMatch(/font-size: 22px;\s*\n\s*line-height: 28px/)
    expect(source).toMatch(/font-size: 14px;\s*\n\s*line-height: 20px/)
  })

  it('paints the bar with surfaceColorAtElevation(3.dp) at the reference alpha', () => {
    expect(source).toContain('Math.log(4)')
    expect(source).toContain('dark ? 0.9 : 0.95')
  })

  it('hides the overflow button when the source provides no overflow action', () => {
    expect(source).toContain('const hasOverflow = computed(() => !!props.chapterUrl)')
    expect(source).toContain('v-if="hasOverflow"')
  })

  it('closes the dropdown on an outside click and on Escape', () => {
    expect(source).toContain("document.addEventListener('click', onDocumentClick, true)")
    expect(source).toContain("event.key === 'Escape'")
  })

  it('keeps the subtitle marquee with the reference 2s delay', () => {
    expect(source).toContain('mr-marquee')
    expect(source).toMatch(/animation: mr-marquee [^;]*2s infinite/)
  })
})
