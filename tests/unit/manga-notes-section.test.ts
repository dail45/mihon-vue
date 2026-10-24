import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/features/manga/components/MangaNotesSection.vue', 'utf8')

describe('MangaNotesSection matches the Mihon reference', () => {
  it('renders nothing for blank notes and shows the notes body otherwise', () => {
    // MangaNotesSection.kt: `if (content.isBlank()) return`.
    expect(source).toContain('const hasNotes = computed(() => notes.value.trim().length > 0)')
    expect(source).toContain('<div v-if="hasNotes" class="manga-notes-section">')
  })

  it('shows the "Edit notes" button only while the summary is expanded', () => {
    expect(source).toMatch(/<button[\s\S]*?v-if="expanded"[\s\S]*?manga-notes-edit/)
    expect(source).toContain('>Edit notes<')
  })

  it('uses the EditNote icon of the reference at 16dp', () => {
    expect(source).toContain('material-symbols-rounded manga-notes-edit-icon')
    expect(source).toContain('>edit_note<')
    expect(source).toMatch(/manga-notes-edit-icon\s*\{[^}]*font-size:\s*16px/)
  })

  it('keeps the MD3 button metrics of the tachiyomi material Button', () => {
    // defaultMinSize(64, 40), ContentPadding 24dp/8dp, RoundedCornerShape(8.dp),
    // outer padding(horizontal = 16.dp, vertical = 4.dp), labelLarge typography.
    expect(source).toMatch(/min-width:\s*64px/)
    expect(source).toMatch(/min-height:\s*40px/)
    expect(source).toMatch(/padding:\s*8px 24px/)
    expect(source).toMatch(/border-radius:\s*8px/)
    expect(source).toMatch(/margin:\s*4px 16px/)
    expect(source).toMatch(/gap:\s*4px/)
    expect(source).toMatch(/font-size:\s*14px;\s*font-weight:\s*500;\s*line-height:\s*20px/)
  })

  it('keeps the divider padding of the reference (12dp collapsed, 0/16dp expanded)', () => {
    expect(source).toMatch(/\.manga-notes-divider\s*\{[^}]*margin:\s*12px 0/)
    expect(source).toMatch(/\.manga-notes-divider--expanded\s*\{[^}]*margin-top:\s*0;[^}]*margin-bottom:\s*16px/)
  })

  it('renders the notes in the bodyMedium typography of the notes display', () => {
    expect(source).toMatch(/font-size:\s*14px;\s*font-weight:\s*400;\s*line-height:\s*20px;\s*letter-spacing:\s*\.0178571429em/)
    expect(source).toContain('user-select: text')
  })

  it('marks links with the primary color and the underline of the editor', () => {
    expect(source).toMatch(/a\)\s*\{[^}]*rgb\(var\(--v-theme-primary\)\)[^}]*text-decoration:\s*underline/)
  })

  it('uses the heading sizes of the rich text editor', () => {
    expect(source).toMatch(/manga-notes-h1\)\s*\{[^}]*font-size:\s*2em;[^}]*font-weight:\s*700/)
    expect(source).toMatch(/manga-notes-h2\)\s*\{[^}]*font-size:\s*1\.5em/)
    expect(source).toMatch(/manga-notes-h3\)\s*\{[^}]*font-size:\s*1\.17em/)
    expect(source).toMatch(/manga-notes-h4\)\s*\{[^}]*font-size:\s*1\.12em/)
    expect(source).toMatch(/manga-notes-h5\)\s*\{[^}]*font-size:\s*\.83em/)
    expect(source).toMatch(/manga-notes-h6\)\s*\{[^}]*font-size:\s*\.75em/)
  })

  it('indents lists like the editor (4dp unordered, 20dp ordered)', () => {
    expect(source).toMatch(/ul\)\s*\{[^}]*padding-left:\s*4px/)
    expect(source).toMatch(/ol\)\s*\{[^}]*padding-left:\s*20px/)
  })

  it('reproduces the 500ms fade of the notes display', () => {
    expect(source).toContain('duration: 500')
  })
})
