import { marked } from 'marked'

/**
 * Notes are stored as Markdown (Mihon keeps them in its local database and
 * converts between the rich editor state and Markdown). The web client has no
 * server side notes field, so the Markdown text is kept in browser storage.
 */

/** Removes active content so editor markup can never execute scripts. */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|form)\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"')
}

function isListTag(node: Node): boolean {
  return node.nodeType === 1 && (node as HTMLElement).tagName === 'UL' || node.nodeType === 1 && (node as HTMLElement).tagName === 'OL'
}

/** Serializes a single list element into Markdown list items. */
function renderList(element: HTMLElement, ordered: boolean): string {
  const items = Array.from(element.children).filter(child => child.tagName === 'LI')
  const lines = items.map((item, index) => {
    const marker = ordered ? `${index + 1}. ` : '- '
    const inline = Array.from(item.childNodes).filter(node => !isListTag(node)).map(renderNode).join('').trim()
    const nested = Array.from(item.childNodes).filter(isListTag).map(renderNode).join('').trim()
    return marker + inline + (nested ? '\n' + nested : '')
  })
  return lines.join('\n') + '\n\n'
}

/** Converts one DOM node into its Markdown representation. */
function renderNode(node: Node): string {
  if (node.nodeType === 3) return (node.textContent || '').replace(/\s+/g, ' ')
  if (node.nodeType !== 1) return ''
  const element = node as HTMLElement
  const tag = element.tagName
  const inner = () => Array.from(element.childNodes).map(renderNode).join('')
  switch (tag) {
    case 'BR':
      return '\n'
    case 'STRONG':
    case 'B': {
      const text = inner().trim()
      return text ? `**${text}**` : ''
    }
    case 'EM':
    case 'I': {
      const text = inner().trim()
      return text ? `*${text}*` : ''
    }
    case 'U': {
      const text = inner().trim()
      return text ? `<u>${text}</u>` : ''
    }
    case 'S':
    case 'DEL': {
      const text = inner().trim()
      return text ? `~~${text}~~` : ''
    }
    case 'A': {
      const text = inner().trim()
      const href = element.getAttribute('href') || ''
      return text ? `[${text}](${href})` : ''
    }
    case 'CODE': {
      const text = element.textContent || ''
      return text ? `\`${text}\`` : ''
    }
    case 'UL':
      return renderList(element, false)
    case 'OL':
      return renderList(element, true)
    case 'LI':
      return inner().trim()
    case 'P':
    case 'DIV':
    case 'SECTION': {
      const text = inner().trim()
      return text ? text + '\n\n' : ''
    }
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6': {
      const text = inner().trim()
      const level = Number(tag.slice(1))
      return text ? `${'#'.repeat(level)} ${text}\n\n` : ''
    }
    case 'BLOCKQUOTE': {
      const text = inner().trim()
      return text ? text.split('\n').map(line => `> ${line}`).join('\n') + '\n\n' : ''
    }
    default:
      return inner()
  }
}

/** Renders Markdown into the HTML the rich editor displays. */
export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return ''
  const html = marked.parse(markdown, { async: false, gfm: true, breaks: true }) as string
  return sanitizeHtml(html)
}

/** Extracts the plain text of the editor, the way the reference counts characters. */
export function htmlToPlainText(html: string): string {
  if (!html.trim()) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks: string[] = []
  const visit = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) { blocks.push(child.textContent || ''); continue }
      if (child.nodeType !== 1) continue
      const element = child as HTMLElement
      if (element.tagName === 'BR') { blocks.push('\n'); continue }
      if (element.tagName === 'UL' || element.tagName === 'OL') {
        for (const item of Array.from(element.children)) {
          const text = Array.from(item.childNodes).filter(node => !isListTag(node)).map(part => part.textContent || '').join('')
          blocks.push(text)
          for (const nested of Array.from(item.childNodes).filter(isListTag)) visit(nested)
        }
        blocks.push('\n')
        continue
      }
      visit(element)
    }
  }
  visit(doc.body)
  return blocks.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim()
}

/** Converts the editor HTML back into the Markdown that gets stored. */
export function htmlToMarkdown(html: string): string {
  if (!html.trim()) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const markdown = Array.from(doc.body.childNodes).map(renderNode).join('')
  return markdown.replace(/\n{3,}/g, '\n\n').trim()
}
