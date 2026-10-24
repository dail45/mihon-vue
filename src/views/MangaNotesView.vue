<script setup lang="ts">
/**
 * Manga notes screen.
 *
 * Reference (Mihon, pinned commit 446f6df82c390ab760802c2fce3b677bce3f31c1):
 *   mihon/app/src/main/java/eu/kanade/presentation/manga/MangaNotesScreen.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/manga/components/MangaNotesTextArea.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt
 *   mihon/presentation-core/src/main/main/java/tachiyomi/presentation/core/components/material/Scaffold.kt
 *
 * Structure of the reference:
 *  - `Scaffold` (Mihon's own, container = colorScheme.background) with a `topBar` slot that
 *    renders `AppBar` -> `TopAppBar` (64dp) with `AppBarTitle(title = "Edit notes",
 *    subtitle = manga.title)` and a `navigateUp` `IconButton`.
 *  - The scaffold scroll behaviour is `TopAppBarDefaults.pinnedScrollBehavior`: the bar stays
 *    pinned and keeps `surfaceColorAtElevation(0.dp)` = colorScheme.surface, so its colour
 *    never changes while the rich text editor scrolls inside itself.
 *  - The content is `MangaNotesTextArea`: a `Column` with `padding(horizontal = 8dp)` that
 *    holds the `RichTextEditor` (weight 1f, `contentPadding` horizontal = 16dp, bodyLarge
 *    typography, placeholder "Enjoyed the part where…") and below it a `Row` with
 *    `padding(vertical = 8dp)`: a `LazyRow` of the five formatting buttons (2dp spacing,
 *    a `VerticalDivider` in between) and the character counter.
 *  - `MangaNotesTextAreaButton`: a clickable `Box` clipped to `MaterialTheme.shapes.small`
 *    (8dp) holding the 24dp icon with `padding(4dp)`; when the format is active the icon
 *    is painted on `colorScheme.onBackground` and tinted with `colorScheme.onPrimary`,
 *    otherwise the tint is `colorScheme.primary`.
 *  - The notes are saved with a 0.25s debounce and once more when the screen is disposed.
 *
 * Suwayomi-Server (REST v1, pinned revision e2ce828a) has no notes field on the manga
 * payload, so - like Mihon, which keeps the notes in its own local database - the web
 * client keeps the Markdown text of the notes in browser storage under
 * `mihon.notes.<apiUrl>::<mangaId>` (the same key `src/utils/mangaNotes.ts` uses).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSuwayomiStore } from '../stores/suwayomi'
import { useMangaNotesStore } from '../stores/mangaNotes'
import { htmlToMarkdown, htmlToPlainText, markdownToHtml } from '../utils/notesMarkdown'

const route = useRoute(), router = useRouter(), server = useSuwayomiStore(), notesStore = useMangaNotesStore()
const mangaId = computed(() => Number(route.params.id))
const manga = computed(() => (server.manga?.id === mangaId.value ? server.manga : null))

const editor = ref<HTMLElement | null>(null)
const subtitleEl = ref<HTMLElement | null>(null)
const textLength = ref(0)
const editorEmpty = ref(true)
const activeBold = ref(false), activeItalic = ref(false), activeUnderline = ref(false)
const activeUnordered = ref(false), activeOrdered = ref(false)
const keyboardInset = ref(0)

let saveTimer = 0
let lastRange: Range | null = null

/* ------------------------------------------------------------------ storage */

/**
 * Suwayomi exposes no notes field, so the notes are kept in browser storage.
 * Mihon stores them in its own local database, so the same is done here.
 */
function readNotes() {
  return notesStore.getNotes(server.apiUrl, mangaId.value)
}
function writeNotes(value: string) {
  notesStore.setNotes(server.apiUrl, mangaId.value, value)
}

function saveNow() {
  if (saveTimer) { window.clearTimeout(saveTimer); saveTimer = 0 }
  const element = editor.value
  if (!element) return
  writeNotes(htmlToMarkdown(element.innerHTML))
}

/** Mirrors the reference debounce of 0.25 seconds. */
function scheduleSave() {
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(saveNow, 250)
}

/* ------------------------------------------------------------------- editor */

function refreshLength(element: HTMLElement) {
  const text = htmlToPlainText(element.innerHTML)
  textLength.value = text.length
  editorEmpty.value = text.length === 0
}

function refreshActiveStates() {
  activeBold.value = document.queryCommandState('bold')
  activeItalic.value = document.queryCommandState('italic')
  activeUnderline.value = document.queryCommandState('underline')
  activeUnordered.value = document.queryCommandState('insertUnorderedList')
  activeOrdered.value = document.queryCommandState('insertOrderedList')
}

function rememberSelection() {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return
  const range = selection.getRangeAt(0)
  if (editor.value && editor.value.contains(range.commonAncestorContainer)) lastRange = range.cloneRange()
}

function restoreSelection() {
  const element = editor.value
  if (!element) return
  element.focus()
  const selection = window.getSelection()
  if (!selection) return
  if (lastRange && element.contains(lastRange.commonAncestorContainer)) {
    selection.removeAllRanges()
    selection.addRange(lastRange)
  } else {
    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

function applyCommand(command: string, value?: string) {
  restoreSelection()
  document.execCommand(command, false, value)
  const element = editor.value
  if (element) refreshLength(element)
  refreshActiveStates()
  scheduleSave()
}

function onInput(event: Event) {
  const element = event.target as HTMLElement
  refreshLength(element)
  refreshActiveStates()
  scheduleSave()
}

function onKeydown(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey)) return
  const key = event.key.toLowerCase()
  if (key === 'b') { event.preventDefault(); applyCommand('bold') }
  else if (key === 'i') { event.preventDefault(); applyCommand('italic') }
  else if (key === 'u') { event.preventDefault(); applyCommand('underline') }
}

function loadIntoEditor() {
  const element = editor.value
  if (!element) return
  element.innerHTML = markdownToHtml(readNotes())
  refreshLength(element)
  refreshActiveStates()
  element.focus()
  const selection = window.getSelection()
  if (selection) {
    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

/* --------------------------------------------------------------- app bar */

/**
 * `AppBarTitle` gives the subtitle a `basicMarquee(repeatDelayMillis = 2_000)`: the title
 * scrolls horizontally when it does not fit and repeats after a two second pause.
 */
function updateMarquee() {
  const element = subtitleEl.value
  if (!element) return
  element.classList.remove('notes-subtitle--marquee')
  const overflow = element.scrollWidth - element.clientWidth
  if (overflow > 0) {
    element.style.setProperty('--marquee-distance', `${overflow + 16}px`)
    element.style.setProperty('--marquee-duration', `${Math.max(4, (overflow + 16) / 12)}s`)
    void element.offsetWidth
    element.classList.add('notes-subtitle--marquee')
  }
}

/* --------------------------------------------------------------- keyboard */

/** `Modifier.imePadding()`: the content shrinks above the soft keyboard. */
function updateKeyboardInset() {
  const viewport = window.visualViewport
  if (!viewport) { keyboardInset.value = 0; return }
  keyboardInset.value = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
}

/* -------------------------------------------------------------- lifecycle */

onMounted(() => {
  updateKeyboardInset()
  window.visualViewport?.addEventListener('resize', updateKeyboardInset)
  window.visualViewport?.addEventListener('scroll', updateKeyboardInset)
  window.addEventListener('resize', updateKeyboardInset)
  void nextTick(() => { updateMarquee() })
  if (server.manga?.id !== mangaId.value && !server.loadingManga) void server.loadManga(mangaId.value)
})

onBeforeUnmount(() => {
  window.visualViewport?.removeEventListener('resize', updateKeyboardInset)
  window.visualViewport?.removeEventListener('scroll', updateKeyboardInset)
  window.removeEventListener('resize', updateKeyboardInset)
  saveNow()
})

watch(
  () => [mangaId.value, server.apiUrl],
  async () => {
    await nextTick()
    loadIntoEditor()
  },
  { immediate: true },
)

watch(() => manga.value?.title ?? '', () => { void nextTick(() => updateMarquee()) })
</script>

<template>
  <div class="notes-screen">
    <!-- AppBar.kt: TopAppBar, 64dp, pinned scroll behaviour (the container colour stays surface). -->
    <header class="notes-app-bar">
      <!-- TopAppBar navigation icon: IconButton with the arrow back icon. -->
      <button class="notes-back" type="button" aria-label="Navigate up" @click="router.back()">
        <span class="material-symbols-rounded">arrow_back</span>
      </button>
      <!-- AppBarTitle: titleLarge title + bodyMedium subtitle. -->
      <div class="notes-app-bar-titles">
        <span class="notes-title">Edit notes</span>
        <span ref="subtitleEl" class="notes-subtitle">{{ manga?.title || '' }}</span>
      </div>
    </header>

    <!-- MangaNotesTextArea.kt: Column(padding horizontal 8dp) with the editor and the tool row. -->
    <div class="notes-body" :style="keyboardInset ? { paddingBottom: `${keyboardInset}px` } : undefined">
      <div class="notes-editor-wrap">
        <div
          ref="editor"
          class="notes-editor"
          :class="{ 'notes-editor--empty': editorEmpty }"
          contenteditable="true"
          role="textbox"
          aria-multiline="true"
          aria-label="Notes"
          data-placeholder="Enjoyed the part where…"
          spellcheck="true"
          @input="onInput"
          @keydown="onKeydown"
          @mouseup="refreshActiveStates"
          @keyup="refreshActiveStates"
          @blur="rememberSelection"
        />
      </div>

      <!-- Row(padding vertical 8dp, SpaceBetween): the format buttons and the character count. -->
      <div class="notes-toolbar">
        <div class="notes-format-row" role="toolbar" aria-label="Text formatting">
          <button
            type="button" class="notes-format-button" aria-label="FormatBold"
            :class="{ 'notes-format-button--selected': activeBold }"
            @mousedown.prevent @click="applyCommand('bold')"
          ><span class="material-symbols-rounded">format_bold</span></button>
          <button
            type="button" class="notes-format-button" aria-label="FormatItalic"
            :class="{ 'notes-format-button--selected': activeItalic }"
            @mousedown.prevent @click="applyCommand('italic')"
          ><span class="material-symbols-rounded">format_italic</span></button>
          <button
            type="button" class="notes-format-button" aria-label="FormatUnderlined"
            :class="{ 'notes-format-button--selected': activeUnderline }"
            @mousedown.prevent @click="applyCommand('underline')"
          ><span class="material-symbols-rounded">format_underlined</span></button>
          <!-- VerticalDivider(padding horizontal 4dp, height 24dp). -->
          <span class="notes-divider" role="separator" aria-orientation="vertical" />
          <button
            type="button" class="notes-format-button" aria-label="FormatListBulleted"
            :class="{ 'notes-format-button--selected': activeUnordered }"
            @mousedown.prevent @click="applyCommand('insertUnorderedList')"
          ><span class="material-symbols-rounded">format_list_bulleted</span></button>
          <button
            type="button" class="notes-format-button" aria-label="FormatListNumbered"
            :class="{ 'notes-format-button--selected': activeOrdered }"
            @mousedown.prevent @click="applyCommand('insertOrderedList')"
          ><span class="material-symbols-rounded">format_list_numbered</span></button>
        </div>
        <!-- Box(contentAlignment = Center) with the character counter. -->
        <span class="notes-length">{{ textLength }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@layer app-components {
  /* The reference screen fills the whole window: Scaffold -> fillMaxSize. */
  .notes-screen {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: var(--v-layout-left);
    right: var(--v-layout-right);
    z-index: 5;
    display: flex;
    flex-direction: column;
    min-height: 0;
    /* Scaffold(containerColor = colorScheme.background). */
    background: rgb(var(--v-theme-background));
    color: rgb(var(--v-theme-on-surface));
  }

  /* TopAppBar: 64dp tall, container = surfaceColorAtElevation(0.dp) = colorScheme.surface. */
  .notes-app-bar {
    flex: none;
    height: 64px;
    display: flex;
    align-items: center;
    padding-left: 4px;
    background: rgb(var(--v-theme-surface));
  }

  /* IconButton: 40dp container with a 24dp icon. */
  .notes-back {
    width: 40px;
    height: 40px;
    flex: none;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    padding: 0;
    background: transparent;
    color: rgb(var(--v-theme-on-surface));
    cursor: pointer;
  }
  .notes-back:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
  .notes-back .material-symbols-rounded { font-size: 24px; line-height: 1; }

  .notes-app-bar-titles {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    flex: 1 1 auto;
    padding-right: 4px;
  }

  /* TopAppBar title: titleLarge (22sp / 28sp, Regular). */
  .notes-title {
    font-size: 22px;
    font-weight: 400;
    line-height: 28px;
    letter-spacing: normal;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* AppBarTitle subtitle: bodyMedium (14sp / 20sp) with a basicMarquee. */
  .notes-subtitle {
    display: block;
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    letter-spacing: .0178571429em;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .notes-subtitle--marquee {
    text-overflow: clip;
    animation: notes-marquee var(--marquee-duration, 6s) linear 2s infinite;
  }
  @keyframes notes-marquee {
    0%, 12% { transform: translateX(0); }
    24%, 100% { transform: translateX(calc(-1 * var(--marquee-distance, 0px))); }
  }

  /* Column(padding horizontal = 8dp). */
  .notes-body {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 0 8px;
  }

  .notes-editor-wrap {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
  }

  /* RichTextEditor: bodyLarge typography, container colour transparent. */
  .notes-editor {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    outline: none;
    background: transparent;
    color: rgb(var(--v-theme-on-surface));
    font-size: 16px;
    font-weight: 400;
    line-height: 24px;
    letter-spacing: .03125em;
    /* contentPadding: horizontal = MaterialTheme.padding.medium (16dp). */
    padding: 0 16px;
    overflow-wrap: break-word;
    white-space: pre-wrap;
  }
  .notes-editor--empty::before {
    content: attr(data-placeholder);
    color: rgb(var(--v-theme-on-surface-variant));
    pointer-events: none;
  }
  /* unorderedListIndent = 4dp, orderedListIndent = 20dp. */
  .notes-editor ul { margin: 0; padding-left: 4px; list-style-position: inside; }
  .notes-editor ol { margin: 0; padding-left: 20px; }
  .notes-editor li { margin: 0; }
  /* config.linkColor = primaryColor. */
  .notes-editor a { color: rgb(var(--v-theme-primary)); }

  /* Row(padding vertical = 8dp, SpaceBetween, CenterVertically). */
  .notes-toolbar {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
  }

  /* LazyRow(spacedBy = 2dp). */
  .notes-format-row {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .notes-format-row::-webkit-scrollbar { display: none; }

  /* MangaNotesTextAreaButton: Box clipped to shapes.small (8dp) with a 24dp icon (4dp padding). */
  .notes-format-button {
    width: 32px;
    height: 32px;
    flex: none;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 8px;
    padding: 4px;
    background: transparent;
    color: rgb(var(--v-theme-primary));
    cursor: pointer;
  }
  .notes-format-button:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
  /* Active format: the icon is painted on onBackground and tinted with onPrimary. */
  .notes-format-button--selected,
  .notes-format-button--selected:hover {
    background: rgb(var(--v-theme-on-background));
    color: rgb(var(--v-theme-on-primary));
  }
  .notes-format-button .material-symbols-rounded { font-size: 24px; line-height: 1; }

  /* VerticalDivider: 1dp wide, outlineVariant, height = padding.large (24dp). */
  .notes-divider {
    width: 1px;
    height: 24px;
    flex: none;
    margin: 0 4px;
    background: rgb(var(--v-theme-outline-variant));
  }

  /* Character counter: default Text style (bodyLarge), padding = extraSmall (4dp). */
  .notes-length {
    flex: none;
    font-size: 16px;
    font-weight: 400;
    line-height: 24px;
    letter-spacing: .03125em;
    padding: 4px;
  }
}
</style>
