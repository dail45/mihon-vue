import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/MarkdownRender.vue', 'utf8')

describe('MarkdownRender matches Mihon Compose reference (MarkdownRender.kt)', () => {
  it('defines M3 typography tokens for all headings h1-h6', () => {
    // h1: headlineMedium (28/36 w400)
    expect(source).toMatch(/\.md-h1\)\s*\{[^}]*font-size:\s*28px;[^}]*line-height:\s*36px/)
    // h2: headlineSmall (24/32 w400)
    expect(source).toMatch(/\.md-h2\)\s*\{[^}]*font-size:\s*24px;[^}]*line-height:\s*32px/)
    // h3: titleLarge (22/28 w400)
    expect(source).toMatch(/\.md-h3\)\s*\{[^}]*font-size:\s*22px;[^}]*line-height:\s*28px/)
    // h4: titleMedium (16/24 w500)
    expect(source).toMatch(/\.md-h4\)\s*\{[^}]*font-size:\s*16px;[^}]*font-weight:\s*500;[^}]*line-height:\s*24px/)
    // h5: titleSmall (14/20 w500)
    expect(source).toMatch(/\.md-h5\)\s*\{[^}]*font-size:\s*14px;[^}]*font-weight:\s*500;[^}]*line-height:\s*20px/)
    // h6: bodyLarge (16/24 w400)
    expect(source).toMatch(/\.md-h6\)\s*\{[^}]*font-size:\s*16px;[^}]*font-weight:\s*400;[^}]*line-height:\s*24px/)
  })

  it('sets base typography to bodyMedium (14/20 w400) with onSurface color', () => {
    expect(source).toMatch(/font-size:\s*14px;\s*font-weight:\s*400;\s*line-height:\s*20px;\s*letter-spacing:\s*\.0178571429em/)
    expect(source).toContain('color: rgb(var(--v-theme-on-surface))')
  })

  it('matches getMarkdownColors codeBackground (onSurface @ 10%) and corner size (8dp)', () => {
    expect(source).toMatch(/\.md-code\)\s*\{[^}]*padding:\s*8px/)
    expect(source).toMatch(/\.md-code\)\s*\{[^}]*border-radius:\s*8px/)
    expect(source).toContain('color-mix(in srgb, rgb(var(--v-theme-on-surface)) 10%, transparent)')
  })

  it('matches getMarkdownLinkStyle (colorScheme.primary, bold 700)', () => {
    expect(source).toMatch(/\.md-link\)\s*\{[^}]*color:\s*rgb\(var\(--v-theme-primary\)\);[^}]*font-weight:\s*700/)
    expect(source).toMatch(/\.md-link:hover\)\s*\{[^}]*text-decoration:\s*underline/)
  })

  it('matches blockQuote metrics (horizontal 16dp, bar 4/2/4/2dp, vertical 4dp text, italic)', () => {
    expect(source).toMatch(/\.md-quote\)\s*\{[^}]*padding:\s*0 16px/)
    expect(source).toMatch(/\.md-quote-bar\)\s*\{[^}]*left:\s*4px;[^}]*top:\s*2px;[^}]*bottom:\s*2px;[^}]*width:\s*2px/)
    expect(source).toMatch(/\.md-quote-text\)\s*\{[^}]*padding:\s*4px 0;[^}]*font-style:\s*italic/)
  })

  it('matches horizontalRule (outlineVariant, padding vertical extraSmall 4dp, height 1px)', () => {
    expect(source).toMatch(/\.md-divider\)\s*\{[^}]*height:\s*1px/)
    expect(source).toMatch(/\.md-divider\)\s*\{[^}]*padding:\s*4px 0/)
    expect(source).toContain('background-color: rgb(var(--v-theme-outline-variant))')
  })

  it('matches list padding and markers cycling through •, ◦, ▸, ▹', () => {
    expect(source).toMatch(/\.md-list\.md-d1\)\s*\{[^}]*padding-left:\s*16px/)
    expect(source).toMatch(/\.md-list:not\(\.md-d1\)\)\s*\{[^}]*padding-left:\s*8px/)
    expect(source).toContain("content: '• ';")
    expect(source).toContain("content: '◦ ';")
    expect(source).toContain("content: '▸ ';")
    expect(source).toContain("content: '▹ ';")
  })

  it('renders MD3 task list checkboxes with accessible role and primary checked styling', () => {
    expect(source).toContain('md-task-checkbox')
    expect(source).toContain('md-task-checkbox--checked')
    expect(source).toContain('role="checkbox"')
    expect(source).toContain('aria-checked')
    expect(source).toMatch(/width:\s*16px;\s*height:\s*16px/)
  })

  it('matches table specifications (onSurface @ 5%, 8dp radius, 16dp cell padding, 160dp column width)', () => {
    expect(source).toMatch(/\.md-table\)\s*\{[^}]*border-radius:\s*8px/)
    expect(source).toContain('color-mix(in srgb, rgb(var(--v-theme-on-surface)) 5%, transparent)')
    expect(source).toMatch(/\.md-th\),\s*\.markdown-render :deep\(\.md-td\)\s*\{[^}]*padding:\s*16px/)
    expect(source).toContain('calc(160px * var(--md-cols, 1))')
  })

  it('renders inline image icon placeholder (17.5px, primary tint) when loadImages is false', () => {
    expect(source).toMatch(/\.md-image-icon\)\s*\{[^}]*width:\s*17\.5px;\s*height:\s*17\.5px/)
    expect(source).toContain('color: rgb(var(--v-theme-primary))')
  })

  it('disallows raw HTML and sanitizes untrusted input', () => {
    expect(source).toContain('function escapeHtml')
    expect(source).toContain('const SAFE_LINK = /^(https?:|mailto:|tel:|\\/|#)/i')
    expect(source).toContain('return escapeHtml(text)')
  })

  it('supports Modifier.secondaryItemAlpha() via dimmed prop (0.78 opacity)', () => {
    expect(source).toMatch(/\.markdown-render--dimmed\s*\{[^}]*opacity:\s*\.78/)
  })
})
