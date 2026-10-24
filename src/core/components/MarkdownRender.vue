<script setup lang="ts">
import { computed } from 'vue'
import { Marked, type RendererObject, type Tokens } from 'marked'

/**
 * Mirrors Mihon's `presentation/manga/components/MarkdownRender.kt`.
 *
 * Reference behaviour (pinned commit 446f6df):
 * - `MarkdownRender` parses the content with a CommonMark flavour (no HTML blocks,
 *   no reference links, GitHub tables) and renders it with the `markdown` compose
 *   library (com.mikepenz:multiplatform-markdown-renderer 0.46.0). The web client
 *   parses with `marked` and renders the same element tree through the CSS below.
 * - Typography (`getMarkdownTypography`):
 *   h1 = headlineMedium (28/36 w400), h2 = headlineSmall (24/32 w400),
 *   h3 = titleLarge (22/28 w400), h4 = titleMedium (16/24 w500),
 *   h5 = titleSmall (14/20 w500), h6 = bodyLarge (16/24 w400),
 *   text/paragraph/lists/table = bodyMedium (14/20 w400),
 *   code and inlineCode = bodyMedium with a monospace family,
 *   quote = bodyMedium + italic, links = bodyMedium + `colorScheme.primary` + Bold.
 * - Colors (`getMarkdownColors`):
 *   text = onSurface, codeBackground/inlineCodeBackground = onSurface @ 10%,
 *   dividerColor = outlineVariant, tableBackground = onSurface @ 5%,
 *   highlightText = onSecondaryContainer, highlightBackground = secondaryContainer.
 * - Padding (`markdownPadding`):
 *   block = 2dp, blockQuote = horizontal 16dp, blockQuoteBar = absolute 4/2/4/2dp,
 *   blockQuoteText = vertical 4dp, codeBlock = 8dp, list = 0dp, listIndent = 8dp,
 *   listItemTop/Bottom = 0dp.
 * - Components (`markdownComponents`):
 *   horizontalRule = divider with vertical padding of `MaterialTheme.padding.extraSmall`
 *   (4dp) and full width; ordered/unordered lists are wrapped in a column with
 *   `padding(start = MaterialTheme.padding.small)` (8dp); the bullet markers cycle
 *   through "•", "◦", "▸", "▹" by list depth; tables use a full width header and
 *   row blocks with 160dp column width, 16dp cell padding and 8dp radius.
 * - Task lists: GFM task list items with MD3 16x16dp checkbox (checked: primary
 *   background + onPrimary checkmark; unchecked: onSurfaceVariant border).
 * - Raw HTML is disabled (`DISALLOWED_MARKDOWN_TYPES = arrayOf(HTML_TAG)`): an HTML
 *   block or inline tag is displayed as literal escaped text.
 * - Inline images: with `loadImages = false` the image becomes a link with the
 *   `MaterialSymbols.Rounded.Image` icon (tint `colorScheme.primary`, size
 *   `bodyMedium.fontSize * 1.25`) followed by the alt text.
 */

const props = withDefaults(
  defineProps<{
    /** The Markdown source. */
    content?: string
    /** Render images (Coil) or replace them with the image placeholder icon. */
    loadImages?: boolean
    /** Kept for API compatibility; the reference only ships the `simple` flavour. */
    flavour?: 'simple' | 'gfm'
    /** Applies `Modifier.secondaryItemAlpha()` (alpha 0.78) like the manga description. */
    dimmed?: boolean
    /** Whether single line breaks are preserved as newlines (eolAsNewLine). */
    breaks?: boolean
    eolAsNewLine?: boolean
  }>(),
  {
    content: '',
    loadImages: true,
    flavour: 'simple',
    dimmed: false,
    breaks: false,
    eolAsNewLine: false,
  },
)

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Only these schemes may become an anchor or image source; anything else stays plain text. */
const SAFE_LINK = /^(https?:|mailto:|tel:|\/|#)/i

function createRenderer(loadImages: boolean): RendererObject {
  let listDepth = 0

  return {
    heading({ tokens, depth }: Tokens.Heading) {
      const level = Math.min(Math.max(depth, 1), 6)
      const body = this.parser.parseInline(tokens)
      return `<h${level} class="md-h${level} md-block">${body}</h${level}>\n`
    },
    paragraph({ tokens }: Tokens.Paragraph) {
      const body = this.parser.parseInline(tokens)
      return `<p class="md-p md-block">${body}</p>\n`
    },
    blockquote({ tokens }: Tokens.Blockquote) {
      const body = this.parser.parse(tokens)
      return `<blockquote class="md-quote md-block"><span class="md-quote-bar" aria-hidden="true"></span><div class="md-quote-text">${body}</div></blockquote>\n`
    },
    list(token: Tokens.List) {
      listDepth += 1
      const depth = listDepth
      const body = token.items
        .map((item) => {
          const inner = item.tokens && item.tokens.length
            ? this.parser.parse(item.tokens)
            : `<p class="md-p">${escapeHtml(item.text ?? '')}</p>`

          if (item.task) {
            const isChecked = !!item.checked
            const checkedClass = isChecked ? ' md-task-checkbox--checked' : ''
            const checkIcon = isChecked
              ? '<svg class="md-task-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>'
              : ''
            return `<li class="md-li md-li--task"><span class="md-marker-slot md-marker-slot--task"><span class="md-task-checkbox${checkedClass}" role="checkbox" aria-checked="${isChecked ? 'true' : 'false'}" aria-disabled="true">${checkIcon}</span></span><div class="md-li-content">${inner}</div></li>\n`
          }

          return `<li class="md-li"><span class="md-marker-slot"><span class="md-marker" aria-hidden="true"></span></span><div class="md-li-content">${inner}</div></li>\n`
        })
        .join('')
      listDepth -= 1
      const tag = token.ordered ? 'ol' : 'ul'
      const type = token.ordered ? ' md-list--ordered' : ' md-list--bullet'
      // Only the top level list is a block of its own and gets the 2dp spacer.
      const block = depth === 1 ? ' md-block' : ''
      const startValue = Number(token.start)
      const start = token.ordered && Number.isFinite(startValue) && startValue !== 1
        ? ` style="--md-counter-start:${startValue - 1}"`
        : ''
      return `<${tag} class="md-list${type}${block} md-d${depth}"${start}>${body}</${tag}>\n`
    },
    code({ text }: Tokens.Code) {
      return `<pre class="md-code md-block"><code>${escapeHtml(text)}</code></pre>\n`
    },
    codespan({ text }: Tokens.Codespan) {
      return `<code class="md-inline-code">${escapeHtml(text)}</code>`
    },
    hr() {
      return '<hr class="md-divider md-block" />\n'
    },
    table(token: Tokens.Table) {
      const header = token.header
        .map((cell) => `<th class="md-th">${this.parser.parseInline(cell.tokens)}</th>`)
        .join('')
      const body = token.rows
        .map(
          (row) =>
            `<tr class="md-tr">${row
              .map((cell) => `<td class="md-td">${this.parser.parseInline(cell.tokens)}</td>`)
              .join('')}</tr>`,
        )
        .join('')
      const columns = Math.max(token.header.length, 1)
      return `<div class="md-table-wrapper md-block" style="--md-cols:${columns}"><table class="md-table"><thead class="md-thead"><tr class="md-tr">${header}</tr></thead><tbody class="md-tbody">${body}</tbody></table></div>\n`
    },
    link({ href, title, tokens }: Tokens.Link) {
      const label = this.parser.parseInline(tokens)
      const url = (href ?? '').trim()
      if (!SAFE_LINK.test(url)) return label
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
      return `<a class="md-link" href="${escapeHtml(url)}"${titleAttr} target="_blank" rel="noopener noreferrer">${label}</a>`
    },
    image({ href, title, text }: Tokens.Image) {
      const url = (href ?? '').trim()
      const alt = text ?? ''
      if (!SAFE_LINK.test(url)) return escapeHtml(alt)
      if (loadImages && url) {
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
        return `<img class="md-image" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${titleAttr} loading="lazy" />`
      }
      // `loadImages = false`: a link with the image placeholder icon plus the alt text.
      const icon = '<span class="material-symbols-rounded md-image-icon" aria-hidden="true">image</span>'
      if (!url) return `${icon}${escapeHtml(alt)}`
      return `<a class="md-link md-link--image" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${icon}${escapeHtml(alt)}</a>`
    },
    html({ text }: Tokens.HTML | Tokens.Tag) {
      // `markdownComponents` renders every `DISALLOWED_MARKDOWN_TYPES` node (the
      // HTML tag) as the raw source text, so HTML is always literal here.
      return escapeHtml(text)
    },
    text(token: Tokens.Text | Tokens.Escape) {
      // The reference highlights `==text==` with the secondary container colors.
      return escapeHtml(token.text).replace(/==(.+?)==/g, '<span class="md-highlight">$1</span>')
    },
  }
}

const html = computed(() => {
  const source = props.content ?? ''
  if (!source.trim()) return ''
  try {
    const shouldBreak = props.breaks || props.eolAsNewLine || false
    const md = new Marked({ gfm: true, breaks: shouldBreak })
    md.use({ renderer: createRenderer(props.loadImages) })
    return md.parse(source) as string
  } catch {
    return escapeHtml(source)
  }
})

function handleClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const anchor = target?.closest('a')
  if (anchor) {
    event.stopPropagation()
  }
}
</script>

<template>
  <div
    class="markdown-render"
    :class="{ 'markdown-render--dimmed': dimmed }"
    @click="handleClick"
    v-html="html"
  />
</template>

<style scoped>
@layer app-components {
  .markdown-render {
    width: 100%;
    box-sizing: border-box;
    user-select: text;
    overflow-wrap: anywhere;
    color: rgb(var(--v-theme-on-surface));
    font-family: var(--v-theme-font-family, inherit);
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    letter-spacing: .0178571429em;
  }
  /* `Modifier.secondaryItemAlpha()` - SECONDARY_ALPHA = .78f. */
  .markdown-render--dimmed {
    opacity: .78;
  }

  /* `MarkdownElement` inserts a Spacer of `markdownPadding.block` (2dp) before
     every block. First child has margin-top: 0 to align with container top. */
  .markdown-render :deep(.md-block) {
    margin: 2px 0 0;
  }
  .markdown-render :deep(.md-block:first-child) {
    margin-top: 0;
  }
  .markdown-render :deep(.md-block:last-child) {
    margin-bottom: 0;
  }

  /* Headings: headlineMedium / headlineSmall / titleLarge / titleMedium /
     titleSmall / bodyLarge of MaterialTheme.typography. */
  .markdown-render :deep(.md-h1) {
    font-size: 28px;
    font-weight: 400;
    line-height: 36px;
    letter-spacing: normal;
  }
  .markdown-render :deep(.md-h2) {
    font-size: 24px;
    font-weight: 400;
    line-height: 32px;
    letter-spacing: normal;
  }
  .markdown-render :deep(.md-h3) {
    font-size: 22px;
    font-weight: 400;
    line-height: 28px;
    letter-spacing: normal;
  }
  .markdown-render :deep(.md-h4) {
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
    letter-spacing: .009375em;
  }
  .markdown-render :deep(.md-h5) {
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    letter-spacing: .0071428571em;
  }
  .markdown-render :deep(.md-h6) {
    font-size: 16px;
    font-weight: 400;
    line-height: 24px;
    letter-spacing: .03125em;
  }

  /* Paragraphs */
  .markdown-render :deep(.md-p) {
    margin: 2px 0 0;
  }
  .markdown-render :deep(.md-p:first-child) {
    margin-top: 0;
  }
  .markdown-render :deep(.md-p:last-child) {
    margin-bottom: 0;
  }

  /* Inline typography: bold, italic, strikethrough */
  .markdown-render :deep(strong),
  .markdown-render :deep(b) {
    font-weight: 700;
  }
  .markdown-render :deep(em),
  .markdown-render :deep(i) {
    font-style: italic;
  }
  .markdown-render :deep(del),
  .markdown-render :deep(s) {
    text-decoration: line-through;
  }

  /* Links: bodyMedium with `colorScheme.primary` and FontWeight.Bold. */
  .markdown-render :deep(.md-link) {
    color: rgb(var(--v-theme-primary));
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }
  .markdown-render :deep(.md-link:hover) {
    text-decoration: underline;
  }

  /* Code block: codeBackground = onSurface @ 10%, radius 8dp
     (codeBackgroundCornerSize), codeBlock padding 8dp. */
  .markdown-render :deep(.md-code) {
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 8px;
    border-radius: 8px;
    background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 10%, transparent);
    font-family: ui-monospace, 'Roboto Mono', 'Cascadia Mono', monospace;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: .0178571429em;
    white-space: pre;
    overflow-x: auto;
  }
  .markdown-render :deep(.md-code code) {
    padding: 0;
    background: none;
    font: inherit;
  }

  /* Inline code: inlineCodeBackground = onSurface @ 10%, radius 4dp, padding 0 4px. */
  .markdown-render :deep(.md-inline-code) {
    padding: 0 4px;
    border-radius: 4px;
    background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 10%, transparent);
    font-family: ui-monospace, 'Roboto Mono', 'Cascadia Mono', monospace;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: .0178571429em;
  }

  /* Block quote: horizontal 16dp padding, a 2dp line drawn at x = 4dp in the
     text color (blockQuoteThickness = 2dp, bar = 4/2/4/2dp), quote text with
     vertical 4dp padding and italic bodyMedium. */
  .markdown-render :deep(.md-quote) {
    position: relative;
    display: block;
    box-sizing: border-box;
    padding: 0 16px;
  }
  .markdown-render :deep(.md-quote-bar) {
    position: absolute;
    left: 4px;
    top: 2px;
    bottom: 2px;
    width: 2px;
    background: rgb(var(--v-theme-on-surface));
  }
  .markdown-render :deep(.md-quote-text) {
    padding: 4px 0;
    font-style: italic;
  }
  .markdown-render :deep(.md-quote-text > :deep(*:first-child)) {
    margin-top: 0;
  }
  .markdown-render :deep(.md-quote-text > :deep(*:last-child)) {
    margin-bottom: 0;
  }

  /* Lists: list = 0dp, listIndent = 8dp, listItem top/bottom = 0dp, the list
     itself is inset by MaterialTheme.padding.small (8dp). The marker and the
     item content are aligned by the first baseline. */
  .markdown-render :deep(.md-list) {
    margin: 2px 0 0;
    padding: 0;
    list-style: none;
  }
  /* The top list column is inset by MaterialTheme.padding.small (8dp) plus listIndent (8dp) = 16dp.
     Nested sublists are indented by listIndent (8dp). */
  .markdown-render :deep(.md-list.md-d1) {
    padding-left: 16px;
  }
  .markdown-render :deep(.md-list:not(.md-d1)) {
    padding-left: 8px;
  }

  .markdown-render :deep(.md-li) {
    display: flex;
    align-items: baseline;
    margin: 0;
    padding: 0;
  }
  .markdown-render :deep(.md-marker-slot) {
    flex: none;
    white-space: pre;
  }
  .markdown-render :deep(.md-li-content) {
    flex: 1 1 auto;
    min-width: 0;
  }
  .markdown-render :deep(.md-li-content > :deep(*:first-child)) {
    margin-top: 0;
  }
  .markdown-render :deep(.md-li-content > :deep(*:last-child)) {
    margin-bottom: 0;
  }
  /* The 2dp block spacer only applies to the top level blocks. */
  .markdown-render :deep(.md-li-content .md-p) {
    margin: 0;
  }
  .markdown-render :deep(.md-li-content .md-list) {
    margin: 0;
  }

  /* Bullet markers cycling through "•", "◦", "▸", "▹" by list depth */
  .markdown-render :deep(.md-list--bullet .md-marker) {
    font-family: inherit;
  }
  .markdown-render :deep(.md-list--bullet.md-d1 > .md-li > .md-marker-slot .md-marker)::before,
  .markdown-render :deep(.md-list--bullet.md-d5 > .md-li > .md-marker-slot .md-marker)::before { content: '• '; }
  .markdown-render :deep(.md-list--bullet.md-d2 > .md-li > .md-marker-slot .md-marker)::before,
  .markdown-render :deep(.md-list--bullet.md-d6 > .md-li > .md-marker-slot .md-marker)::before { content: '◦ '; }
  .markdown-render :deep(.md-list--bullet.md-d3 > .md-li > .md-marker-slot .md-marker)::before,
  .markdown-render :deep(.md-list--bullet.md-d7 > .md-li > .md-marker-slot .md-marker)::before { content: '▸ '; }
  .markdown-render :deep(.md-list--bullet.md-d4 > .md-li > .md-marker-slot .md-marker)::before,
  .markdown-render :deep(.md-list--bullet.md-d8 > .md-li > .md-marker-slot .md-marker)::before { content: '▹ '; }

  /* Ordered lists */
  .markdown-render :deep(.md-list--ordered) {
    counter-reset: md-counter var(--md-counter-start, 0);
  }
  .markdown-render :deep(.md-list--ordered > .md-li) {
    counter-increment: md-counter;
  }
  .markdown-render :deep(.md-list--ordered > .md-li > .md-marker-slot .md-marker)::before {
    content: counter(md-counter) '. ';
  }

  /* GFM Task List items */
  .markdown-render :deep(.md-marker-slot--task) {
    display: inline-flex;
    align-items: center;
    margin-right: 8px;
    line-height: 1;
    transform: translateY(2px);
  }
  .markdown-render :deep(.md-task-checkbox) {
    width: 16px;
    height: 16px;
    box-sizing: border-box;
    border-radius: 2px;
    border: 2px solid rgb(var(--v-theme-on-surface-variant));
    background: transparent;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    pointer-events: none;
  }
  .markdown-render :deep(.md-task-checkbox--checked) {
    background: rgb(var(--v-theme-primary));
    border-color: rgb(var(--v-theme-primary));
    color: rgb(var(--v-theme-on-primary));
  }
  .markdown-render :deep(.md-task-check-icon) {
    width: 12px;
    height: 12px;
    stroke: currentColor;
    stroke-width: 3.5;
    fill: none;
  }

  /* Divider: outlineVariant, vertical padding of extraSmall (4dp), full width. */
  .markdown-render :deep(.md-divider) {
    display: block;
    width: 100%;
    box-sizing: content-box;
    height: 1px;
    margin: 2px 0 0;
    padding: 4px 0;
    border: 0;
    background-color: rgb(var(--v-theme-outline-variant));
    background-clip: content-box;
  }

  /* Table: tableBackground = onSurface @ 5% with an 8dp radius
     (tableCornerSize), cell padding 16dp (tableCellPadding), 160dp per column
     (tableCellWidth), bold header, no cell borders. */
  .markdown-render :deep(.md-table-wrapper) {
    width: 100%;
    overflow-x: auto;
    box-sizing: border-box;
    border-radius: 8px;
  }
  .markdown-render :deep(.md-table) {
    border-collapse: separate;
    border-spacing: 0;
    border-radius: 8px;
    overflow: hidden;
    background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 5%, transparent);
    table-layout: fixed;
    min-width: 100%;
    width: calc(160px * var(--md-cols, 1));
  }
  .markdown-render :deep(.md-th),
  .markdown-render :deep(.md-td) {
    padding: 16px;
    text-align: start;
    vertical-align: middle;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: .0178571429em;
  }
  .markdown-render :deep(.md-th) {
    font-weight: 700;
  }

  /* Highlight: highlightBackground = secondaryContainer, highlightText = onSecondaryContainer. */
  .markdown-render :deep(.md-highlight) {
    background: rgb(var(--v-theme-secondary-container));
    color: rgb(var(--v-theme-on-secondary-container));
    padding: 0 2px;
    border-radius: 2px;
  }

  .markdown-render :deep(.md-image) {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    vertical-align: bottom;
  }
  .markdown-render :deep(.md-image-icon) {
    display: inline-block;
    width: 17.5px;
    height: 17.5px;
    font-size: 17.5px;
    line-height: 17.5px;
    vertical-align: -3.5px;
    color: rgb(var(--v-theme-primary));
    margin-right: 4px;
  }
}
</style>
