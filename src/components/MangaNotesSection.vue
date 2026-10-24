<script setup lang="ts">
import { Marked } from 'marked'
import type { Tokens } from 'marked'
import { computed, nextTick, onActivated, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSuwayomiStore } from '../stores/suwayomi'
import { useMangaNotesStore } from '../stores/mangaNotes'

/**
 * Mirrors Mihon's `presentation/manga/components/MangaNotesSection.kt` and its
 * helper `presentation/manga/components/MangaNotesDisplay.kt`.
 *
 * Reference behaviour (Mihon @ 446f6df, richeditor-compose 1.2.1):
 * - `MangaNotesSection`: `if (content.isBlank()) return` - a blank notes text
 *   renders nothing at all (no divider either).
 * - `Column(modifier.fillMaxWidth(), horizontalAlignment = CenterHorizontally)`
 *   holding `MangaNotesDisplay`, then, only while `expanded`, the "Edit notes"
 *   button, then a `HorizontalDivider`.
 * - The button is the tachiyomi material `Button`: transparent container,
 *   `contentColor = colorScheme.primary`, `RoundedCornerShape(8.dp)`, an outer
 *   `padding(horizontal = 16.dp, vertical = 4.dp)`, `defaultMinSize(64, 40)`,
 *   `M3ButtonDefaults.ContentPadding` (24dp horizontal / 8dp vertical) and the
 *   `labelLarge` typography. Its content is a `Row(spacedBy(4.dp))` of a 16dp
 *   `MaterialSymbols.Rounded.EditNote` icon and the `action_edit_notes` label.
 *   Hover elevation is 1dp, pressed elevation 0dp.
 * - The divider is 1dp thick in `outlineVariant`, padded 0dp/16dp while expanded
 *   and 12dp/12dp while collapsed.
 * - `MangaNotesDisplay` renders the notes with the rich text editor in the
 *   `bodyMedium` typography (14sp / 20sp / letterSpacing 0.0178571429em), the
 *   text is selectable, links use `colorScheme.primary`, unordered list indent is
 *   4dp and ordered list indent is 20dp. The content fades in over 500ms on
 *   every change but the very first one, and the block size is animated.
 *
 * The notes themselves are rendered with the same Markdown flavour the rich
 * text editor uses (GFM). The styles below follow the editor's spans:
 * headings are bold with em based sizes, links are underlined, inline code is a
 * transparent box with a light grey 1sp stroke, and lists use the editor's
 * markers and indents.
 */
const props = withDefaults(
  defineProps<{
    /** The notes as Markdown. Blank text renders nothing. */
    content?: string
    /**
     * Mihon shows the edit button only while the manga summary is expanded.
     * The section is only mounted while the summary is expanded, so the button
     * is shown by default; a parent that keeps the section mounted can hide it
     * by passing `false`.
     */
    expanded?: boolean
    /** Manga the notes belong to; used to read the stored notes and to build the edit link. */
    mangaId?: number
    /** Server the notes belong to; part of the storage key. */
    apiUrl?: string
    /** Route of the notes editor. Defaults to the notes screen of the manga. */
    notesHref?: string
    /** Called instead of navigating when the parent handles the notes editor. */
    onEdit?: () => void
    /** Pinned reference parameter name in MangaNotesSection.kt */
    onEditNotes?: () => void
  }>(),
  { expanded: true },
)

const emit = defineEmits<{
  (e: 'editNotes'): void
  (e: 'edit'): void
}>()

const server = useSuwayomiStore()
const notesStore = useMangaNotesStore()
const router = useRouter()

const bodyRef = ref<HTMLElement | null>(null)
const stubOpen = ref(false)
const revision = ref(0)

function refreshNotes() {
  revision.value += 1
}

/** Mihon reads the notes from its local database; the web client keeps them per server. */
const storedNotes = computed(() => {
  void revision.value
  if (props.mangaId === undefined) return ''
  return notesStore.getNotes(props.apiUrl ?? server.apiUrl, props.mangaId)
})

const notes = computed(() => (props.content === undefined ? storedNotes.value : props.content))
/** `content.isBlank()` - whitespace only notes render nothing. */
const hasNotes = computed(() => notes.value.trim().length > 0)

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * The rich text editor consumes the HTML tags of the notes: the ones it knows
 * (`<b>`, `<i>`, `<u>`, `<s>`, `<code>`, `<br>`, ...) become spans with the
 * matching style, every other tag is dropped and only its content is shown.
 * The tags are rebuilt here without attributes so nothing but the formatting
 * survives.
 */
const INLINE_TAGS = [
  'b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'sub', 'sup', 'mark', 'small', 'br',
] as const

const INLINE_TAG_RE = new RegExp(`^</?(?:${INLINE_TAGS.join('|')}|code)\\s*>$`, 'i')
const ANY_TAG_RE = /^<\/?[a-zA-Z][^>]*>$/

function sanitizeInlineHtml(value: string): string {
  const text = value.trim()
  if (!text) return escapeHtml(value)
  const parts = text.split(/(<\/?[^>]+>)/).filter(part => part !== '')
  if (!parts.some(part => part.startsWith('<'))) return escapeHtml(value)
  return parts
    .map((part) => {
      if (!part.startsWith('<')) return escapeHtml(part)
      if (INLINE_TAG_RE.test(part)) {
        return /^<code>$/i.test(part) ? '<code class="manga-notes-code">' : part
      }
      // A tag the editor does not know is dropped, only its content remains.
      return ANY_TAG_RE.test(part) ? '' : escapeHtml(part)
    })
    .join('')
}

/** Only these schemes may become an anchor; anything else degrades to plain text. */
const SAFE_LINK = /^(https?:|mailto:|tel:|\/|#)/i

const notesMarkdown = new Marked({ gfm: true, breaks: true })

notesMarkdown.use({
  renderer: {
    /**
     * `HeadingStyle` of the rich text editor: every heading level is bold and
     * scales with the `bodyMedium` font size (2em, 1.5em, 1.17em, 1.12em, 0.83em
     * and 0.75em).
     */
    heading({ tokens, depth }: Tokens.Heading) {
      const level = Math.min(Math.max(depth, 1), 6)
      return `<h${level} class="manga-notes-h${level}">${this.parser.parseInline(tokens)}</h${level}>\n`
    },
    /**
     * The editor has no quote style: a block quote is shown as plain text.
     */
    blockquote(token: Tokens.Blockquote) {
      const inner = token.tokens
        .filter((t): t is Tokens.Paragraph => t.type === 'paragraph')
        .flatMap(t => t.tokens)
      return `<p class="manga-notes-p">${this.parser.parseInline(inner)}</p>\n`
    },
    paragraph({ tokens }: Tokens.Paragraph) {
      return `<p class="manga-notes-p">${this.parser.parseInline(tokens)}</p>\n`
    },
    /** Inline code keeps the surrounding font and gets a light grey 1sp stroke. */
    codespan({ text }: Tokens.Codespan) {
      return `<code class="manga-notes-code">${escapeHtml(text)}</code>`
    },
    /**
     * A fenced code block is plain text for the editor (the fence content is
     * emitted as ordinary text), so it is shown as one line of plain text.
     */
    code({ text }: Tokens.Code) {
      // The editor emits the fence content as ordinary text, the line breaks of
      // the fence become spaces.
      return `<p class="manga-notes-p">${escapeHtml(text.replace(/\r?\n/g, ' '))}</p>\n`
    },
    /** The editor cannot load images (its default image loader returns null). */
    image() {
      return ''
    },
    /** A thematic break has no representation in the editor. */
    hr() {
      return ''
    },
    /** The editor does not render tables; their cells are plain text. */
    table(token: Tokens.Table) {
      const lines = [
        ...token.header.map(cell => cell.text),
        ...token.rows.map(row => row.map(cell => cell.text).join(' ')),
      ]
      return `<p class="manga-notes-p">${escapeHtml(lines.join(' '))}</p>\n`
    },
    html(token: Tokens.HTML | Tokens.Tag) {
      return sanitizeInlineHtml(token.text)
    },
    link(token: Tokens.Link) {
      const label = this.parser.parseInline(token.tokens)
      const href = (token.href ?? '').trim()
      if (!SAFE_LINK.test(href)) return label
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`
    },
  },
})

/** The rendered notes, mirroring the rich text editor's Markdown parsing. */
const html = computed(() => (hasNotes.value ? (notesMarkdown.parse(notes.value) as string) : ''))

const editHref = computed(() => {
  if (props.notesHref) return props.notesHref
  if (props.mangaId === undefined) return undefined
  return `/manga/${props.mangaId}/notes`
})

/** True when the notes editor route is not registered in this build. */
const editTargetMissing = computed(() => {
  if (!editHref.value) return true
  try {
    return router.resolve(editHref.value).matched.every(record => record.path.includes(':pathMatch'))
  } catch {
    return true
  }
})

function onEditClick() {
  emit('editNotes')
  emit('edit')
  if (props.onEditNotes) {
    props.onEditNotes()
    return
  }
  if (props.onEdit) {
    props.onEdit()
    return
  }
  if (!editTargetMissing.value) {
    void router.push(editHref.value!)
    return
  }
  stubOpen.value = true
}

/**
 * Mirrors the `Animatable` alpha 0 -> 1 plus `animateContentSize()` of the notes display.
 *
 * `MangaNotesDisplay.kt` keeps a `contentUpdatedOnce` flag: the very first content
 * is shown without a fade, every later change fades the notes out and in again
 * (500ms) while the size of the block is animated.
 */
const contentUpdatedOnce = ref(false)

let lastHeight = 0
async function animateNotes() {
  await nextTick()
  const element = bodyRef.value
  if (!element) return
  const from = lastHeight
  element.style.height = 'auto'
  const to = element.offsetHeight
  lastHeight = to
  if (from !== to && from > 0) {
    element.style.height = `${from}px`
    element.getBoundingClientRect()
    const animation = element.animate(
      [{ height: `${from}px` }, { height: `${to}px` }],
      { duration: 300, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
    )
    animation.onfinish = () => { element.style.height = '' }
  }
  element.getBoundingClientRect()
  // alpha.snapTo(0f) then alpha.animateTo(1f, FADE_TIME).
  element.animate(
    [{ opacity: 0 }, { opacity: 1 }],
    { duration: 500, easing: 'linear' },
  )
}

onMounted(() => {
  lastHeight = bodyRef.value?.offsetHeight ?? 0
  // The very first content is shown without a fade.
  contentUpdatedOnce.value = true
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', refreshNotes)
    window.addEventListener('focus', refreshNotes)
  }
})

onActivated(() => {
  refreshNotes()
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('storage', refreshNotes)
    window.removeEventListener('focus', refreshNotes)
  }
})

watch(notes, () => {
  if (!contentUpdatedOnce.value) {
    contentUpdatedOnce.value = true
    return
  }
  void animateNotes()
})
</script>

<template>
  <div v-if="hasNotes" class="manga-notes-section">
    <!-- MangaNotesDisplay.kt: selectable markdown text in bodyMedium typography. -->
    <div ref="bodyRef" class="manga-notes-body" v-html="html" />

    <button
      v-if="expanded"
      type="button"
      class="manga-notes-edit"
      aria-label="Edit notes"
      @click="onEditClick"
    >
      <span class="material-symbols-rounded manga-notes-edit-icon" aria-hidden="true">edit_note</span>
      <span class="manga-notes-edit-label">Edit notes</span>
    </button>

    <hr class="manga-notes-divider" :class="expanded ? 'manga-notes-divider--expanded' : 'manga-notes-divider--collapsed'" />

    <v-dialog v-model="stubOpen" max-width="520">
      <v-card class="manga-notes-stub-card" rounded="xl">
        <v-card-title class="d-flex align-center font-weight-regular text-title-large text-on-surface">Edit notes<v-spacer /><v-btn icon="close" variant="text" density="compact" aria-label="Close" @click="stubOpen = false" /></v-card-title>
        <v-card-text>
          <p class="text-body-medium mb-2 text-on-surface">Notes editing is not supported in the web version.</p>
          <p class="text-body-medium text-on-surface-variant">The notes are shown read-only here.</p>
        </v-card-text>
        <v-card-actions><v-spacer /><v-btn variant="text" color="primary" @click="stubOpen = false">Close</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
@layer app-components {
  .manga-notes-section { display: flex; flex-direction: column; align-items: center; width: 100%; }
  /* MangaNotesDisplay.kt: MaterialTheme.typography.bodyMedium. */
  .manga-notes-body {
    width: 100%;
    box-sizing: border-box;
    text-align: start;
    overflow-wrap: anywhere;
    user-select: text;
    -webkit-user-select: text;
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    letter-spacing: .0178571429em;
    color: rgb(var(--v-theme-on-surface));
  }
  /* The editor stacks its paragraphs without any extra spacing. */
  .manga-notes-body :deep(.manga-notes-p) { margin: 0; }
  /* HeadingStyle: bold, em based sizes on top of the bodyMedium font size. */
  .manga-notes-body :deep(.manga-notes-h1) { margin: 0; font-size: 2em; font-weight: 700; }
  .manga-notes-body :deep(.manga-notes-h2) { margin: 0; font-size: 1.5em; font-weight: 700; }
  .manga-notes-body :deep(.manga-notes-h3) { margin: 0; font-size: 1.17em; font-weight: 700; }
  .manga-notes-body :deep(.manga-notes-h4) { margin: 0; font-size: 1.12em; font-weight: 700; }
  .manga-notes-body :deep(.manga-notes-h5) { margin: 0; font-size: .83em; font-weight: 700; }
  .manga-notes-body :deep(.manga-notes-h6) { margin: 0; font-size: .75em; font-weight: 700; }
  .manga-notes-body :deep(strong) { font-weight: 700; }
  .manga-notes-body :deep(em) { font-style: italic; }
  .manga-notes-body :deep(del) { text-decoration: line-through; }
  .manga-notes-body :deep(u), .manga-notes-body :deep(ins) { text-decoration: underline; }
  .manga-notes-body :deep(sub) { vertical-align: sub; font-size: smaller; }
  .manga-notes-body :deep(sup) { vertical-align: super; font-size: smaller; }
  .manga-notes-body :deep(mark) { background: #ffff00; color: inherit; }
  .manga-notes-body :deep(small) { font-size: .8em; }
  /* Link span style: colorScheme.primary with an underline. */
  .manga-notes-body :deep(a) { color: rgb(var(--v-theme-primary)); text-decoration: underline; }
  /*
   * Code span: the editor draws a transparent box with a light grey 1sp stroke,
   * an 8sp corner radius and 2sp padding around the text.
   */
  .manga-notes-body :deep(.manga-notes-code) {
    display: inline-block;
    box-sizing: border-box;
    padding: 2px;
    border: 1px solid #ccc;
    border-radius: 8px;
    background: transparent;
    font: inherit;
  }
  /*
   * Lists: the editor indents unordered items by 4dp and ordered items by 20dp
   * per level and uses the markers "•", "◦", "▪" and decimal / lower roman /
   * lower alpha numbering.
   */
  .manga-notes-body :deep(ul) { margin: 0; padding-left: 4px; list-style-type: disc; list-style-position: inside; }
  .manga-notes-body :deep(ul ul) { padding-left: 4px; list-style-type: circle; }
  .manga-notes-body :deep(ul ul ul) { padding-left: 4px; list-style-type: square; }
  /*
   * Ordered items: the editor puts the marker in the gutter (right aligned in the
   * 20dp indent) and the text of every item starts at the same 20dp offset.
   */
  .manga-notes-body :deep(ol) { margin: 0; padding-left: 20px; list-style-type: decimal; list-style-position: outside; }
  .manga-notes-body :deep(ol ol) { padding-left: 20px; list-style-type: lower-roman; }
  .manga-notes-body :deep(ol ol ol) { padding-left: 20px; list-style-type: lower-alpha; }
  .manga-notes-body :deep(li) { margin: 0; }
  .manga-notes-body :deep(li > p) { margin: 0; }

  /* Material Button: transparent container, primary content, labelLarge, 8dp shape. */
  .manga-notes-edit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    box-sizing: border-box;
    min-width: 64px;
    min-height: 40px;
    margin: 4px 16px;
    padding: 8px 24px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: rgb(var(--v-theme-primary));
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    letter-spacing: .0071428571em;
    text-decoration: none;
    cursor: pointer;
    position: relative;
    user-select: none;
    -webkit-user-select: none;
    transition: background-color 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1);
  }
  /* Hovered elevation is 1dp, state layer is 8% primary. */
  .manga-notes-edit:hover {
    background-color: rgba(var(--v-theme-primary), 0.08);
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, .3), 0 1px 3px 1px rgba(0, 0, 0, .15);
  }
  /* Pressed elevation is 0dp, state layer is 12% primary. */
  .manga-notes-edit:active {
    background-color: rgba(var(--v-theme-primary), 0.12);
    box-shadow: none;
  }
  .manga-notes-edit:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: 2px;
    background-color: rgba(var(--v-theme-primary), 0.12);
  }
  .manga-notes-edit-icon {
    flex: none;
    font-size: 16px;
    line-height: 16px;
    width: 16px;
    height: 16px;
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
  }
  .manga-notes-edit-label { white-space: nowrap; }

  /* HorizontalDivider: outlineVariant, 12dp above/below collapsed, 0dp/16dp expanded. */
  .manga-notes-divider { width: 100%; height: 1px; margin: 12px 0; border: 0; background: rgb(var(--v-theme-outline-variant)); }
  .manga-notes-divider--expanded { margin-top: 0; margin-bottom: 16px; }

  /* MD3 AlertDialog styling for the stub fallback */
  .manga-notes-stub-card {
    border-radius: 28px !important;
    background: rgb(var(--v-theme-surface-container-high)) !important;
  }
}
</style>
