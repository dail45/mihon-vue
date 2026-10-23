import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/views/WorkerInfoView.vue', 'utf8')

/**
 * Guards for the pixel parity of `src/views/WorkerInfoView.vue` with
 * mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/debug/WorkerInfoScreen.kt.
 * The reference is Kotlin, so the invariants are asserted on the ported metrics.
 */
describe('WorkerInfoView parity with Mihon', () => {
  it('renders the reference title and the three worker sections in order', () => {
    // WorkerInfoScreen.TITLE = "Worker info".
    expect(source).toContain("const TITLE = 'Worker info'")
    // The LazyColumn items are Enqueued, Finished, Running (title + text each).
    expect(source).toContain('>Enqueued</h2>')
    expect(source).toContain('>Finished</h2>')
    expect(source).toContain('>Running</h2>')
    expect(source.indexOf('>Enqueued</h2>')).toBeLessThan(source.indexOf('>Finished</h2>'))
    expect(source.indexOf('>Finished</h2>')).toBeLessThan(source.indexOf('>Running</h2>'))
  })

  it('shows the reference empty marker for a work list without entries', () => {
    // WorkerInfoViewModel.constructString() appends "-" for an empty list.
    expect(source).toContain("const EMPTY_SECTION = '-\\n'")
  })

  it('keeps the top bar metrics of AppBar.kt', () => {
    // TopAppBar: 64dp tall, surface container color at 0dp elevation.
    expect(source).toMatch(/\.worker-toolbar \{[^}]*height: 64px/)
    expect(source).toMatch(/\.worker-toolbar \{[^}]*background: rgb\(var\(--v-theme-surface\)\)/)
    // TopAppBar title slot uses titleLarge (22sp / 28sp, weight 400).
    expect(source).toMatch(/\.worker-toolbar-title \{[^}]*font-size: 22px/)
    expect(source).toMatch(/\.worker-toolbar-title \{[^}]*line-height: 28px/)
    expect(source).toMatch(/\.worker-toolbar-title \{[^}]*font-weight: 400/)
  })

  it('keeps the section title and text typography of the reference', () => {
    // SectionTitle: titleMedium (16sp / 24sp, Medium) with 8dp vertical padding.
    expect(source).toMatch(/\.worker-section-title \{[^}]*padding: 8px 0/)
    expect(source).toMatch(/\.worker-section-title \{[^}]*font-size: 16px/)
    expect(source).toMatch(/\.worker-section-title \{[^}]*line-height: 24px/)
    expect(source).toMatch(/\.worker-section-title \{[^}]*font-weight: 500/)
    // SectionText: softWrap = false, FontFamily.Monospace.
    expect(source).toMatch(/\.worker-section-text \{[^}]*font-family: 'Roboto Mono'/)
    expect(source).toMatch(/\.worker-section-text \{[^}]*white-space: pre/)
  })

  it('keeps the list metrics of the reference LazyColumn', () => {
    // contentPadding = contentPadding + PaddingValues(horizontal = 16.dp).
    expect(source).toMatch(/\.worker-column \{[^}]*padding: 0 16px/)
    // Modifier.horizontalScroll(rememberScrollState()).
    expect(source).toMatch(/\.worker-scroll \{[^}]*overflow-x: auto/)
  })

  it('copies the concatenated sections to the clipboard like the reference action', () => {
    // context.copyToClipboard(TITLE, enqueued + finished + running).
    expect(source).toContain('enqueued.value + finished.value + running.value')
    expect(source).toContain('navigator.clipboard.writeText(content)')
    // The action icon is MaterialSymbols.Rounded.ContentCopy.
    expect(source).toContain('icon="content_copy"')
  })
})
