import { Marked } from 'marked'

/**
 * Storage and rendering helpers for the manga notes shown by `MangaNotesSection.vue`.
 *
 * Mihon keeps the notes of a manga in its local database
 * (`MangaNotesScreen.State.notes`). Suwayomi's REST v1 contract (pinned revision
 * e2ce828a) has no notes field on the manga payload, so the web client keeps the
 * Markdown text of the notes in browser storage instead, under the same key the
 * "Edit notes" screen (`src/views/MangaNotesView.vue`, CHECKLIST row 80) uses:
 * `mihon.notes.<apiUrl>::<mangaId>`.
 */

/** Storage key of the notes of one manga on one server. */
export function notesStorageKey(apiUrl: string, mangaId: number): string {
  return `mihon.notes.${apiUrl}::${mangaId}`
}

/** Reads the Markdown notes of a manga, or an empty string when there are none. */
export function readMangaNotes(apiUrl: string, mangaId: number): string {
  try {
    return localStorage.getItem(notesStorageKey(apiUrl, mangaId)) || ''
  } catch {
    return ''
  }
}

/** Writes the Markdown notes of a manga. */
export function writeMangaNotes(apiUrl: string, mangaId: number, markdown: string): void {
  try {
    localStorage.setItem(notesStorageKey(apiUrl, mangaId), markdown)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mihon:notes-updated', { detail: { apiUrl, mangaId } }))
    }
  } catch {
    /* private mode: the notes are only kept for this session */
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Inline tags the notes editor may produce (`htmlToMarkdown` writes an underline as
 * `<u>`). The rich text editor of Mihon keeps such inline formatting, everything else
 * is shown as literal text.
 */
const ALLOWED_INLINE_HTML = /^(<\/?(?:u|b|i|em|strong|s|del|br|code)\b[^>]*>)+$/i

/** Only these schemes may become an anchor; anything else degrades to plain text. */
const SAFE_LINK = /^(https?:|mailto:|tel:|\/|#)/i

const notesMarkdown = new Marked({ gfm: true, breaks: true })

notesMarkdown.use({
  renderer: {
    /**
     * The notes display of Mihon (`MangaNotesDisplay.kt`) shows the notes through the
     * rich text editor, which has no heading style: a heading is plain text in the
     * `bodyMedium` typography of the editor.
     */
    heading({ tokens }) {
      return `<p>${this.parser.parseInline(tokens)}</p>`
    },
    /** The rich text editor has no quote style either; the text stays plain. */
    blockquote({ tokens }) {
      return `<p>${this.parser.parseInline(tokens)}</p>`
    },
    html(token) {
      // Mihon disables raw HTML in markdown (MarkdownRender.kt: DISALLOWED_MARKDOWN_TYPES),
      // so HTML in the notes is shown as literal text.
      const text = token.text.trim()
      if (text && ALLOWED_INLINE_HTML.test(text)) return text
      return escapeHtml(token.text)
    },
    image(token) {
      // The rich text editor behind the notes has no inline image support.
      return escapeHtml(token.text)
    },
    link(token) {
      const label = this.parser.parseInline(token.tokens ?? [])
      const href = (token.href ?? '').trim()
      if (!SAFE_LINK.test(href)) return label
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`
    },
  },
})

/**
 * Renders the Markdown notes into the HTML of the read-only notes display.
 *
 * Reference: `MangaNotesDisplay.kt` renders the notes with the rich text editor's
 * markdown parser (`rememberRichTextState()` + `setMarkdown(content)`), which follows
 * CommonMark, keeps inline formatting, renders lists and marks links with
 * `colorScheme.primary`.
 */
export function renderNotesHtml(markdown: string): string {
  if (!markdown.trim()) return ''
  return notesMarkdown.parse(markdown) as string
}
