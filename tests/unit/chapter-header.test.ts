import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'src/components/ChapterHeader.vue'), 'utf8')

describe('ChapterHeader (ChapterHeader.kt) pixel-parity', () => {
  it('implements the reference structure: Row with Column content and optional filter action', () => {
    // Jetpack Compose reference:
    // Column(modifier.fillMaxWidth().clickable(enabled = enabled, onClick = onClick)
    //   .padding(horizontal = 16.dp, vertical = 4.dp),
    //   verticalArrangement = Arrangement.spacedBy(MaterialTheme.padding.extraSmall))
    // Or Row with end filter button: padding(start = 16.dp, top = 4.dp, end = 4.dp, bottom = 4.dp)
    expect(source).toContain('chapter-header')
    expect(source).toContain('chapter-header__content')
    expect(source).toContain('chapter-header__title')
    expect(source).toContain('chapter-header__missing')
    expect(source).toContain('chapter-header__filter-btn')
  })

  it('preserves exact paddings matching Compose 1dp=1px', () => {
    // padding(horizontal = 16.dp, vertical = 4.dp)
    expect(source).toMatch(/padding:\s*4px 16px/)
    // padding(start = 16.dp, top = 4.dp, end = 4.dp, bottom = 4.dp)
    expect(source).toMatch(/padding:\s*4px 4px 4px 16px/)
  })

  it('keeps verticalArrangement spacedBy extraSmall (4dp)', () => {
    // MaterialTheme.padding.extraSmall = 4.dp
    expect(source).toMatch(/gap:\s*4px/)
  })

  it('applies titleMedium typography to the chapter count', () => {
    // titleMedium: 16sp / 24sp, weight 500, letter-spacing 0.15px, color onBackground
    expect(source).toMatch(/font-size:\s*16px/)
    expect(source).toMatch(/line-height:\s*24px/)
    expect(source).toMatch(/font-weight:\s*500/)
    expect(source).toMatch(/letter-spacing:\s*0\.15px/)
    expect(source).toContain('var(--v-theme-on-background)')
  })

  it('applies bodySmall typography and error color with SECONDARY_ALPHA (.78f) to missing chapters warning', () => {
    // bodySmall: 12sp / 16sp, weight 400, letter-spacing 0.4px
    // colorScheme.error.copy(alpha = SECONDARY_ALPHA = 0.78f)
    expect(source).toMatch(/font-size:\s*12px/)
    expect(source).toMatch(/line-height:\s*16px/)
    expect(source).toMatch(/font-weight:\s*400/)
    expect(source).toMatch(/letter-spacing:\s*0\.4px/)
    expect(source).toMatch(/color-mix\(in srgb, rgb\(var\(--v-theme-error\)\) 78%, transparent\)/)
    expect(source).toContain('text-overflow: ellipsis')
    expect(source).toContain('white-space: nowrap')
  })

  it('implements plural strings matching MR.plurals.manga_num_chapters and MR.plurals.missing_chapters', () => {
    expect(source).toContain("if (props.chapterCount === null || props.chapterCount === undefined) return 'Chapters'")
    expect(source).toContain("return `${props.chapterCount} ${props.chapterCount === 1 ? 'chapter' : 'chapters'}`")
    expect(source).toContain("if (count <= 0) return ''")
    expect(source).toContain("return `Missing ${count} ${count === 1 ? 'chapter' : 'chapters'}`")
  })

  it('implements 48x48dp MD3 IconButton with 40dp state layer and 24dp filter_list icon', () => {
    // IconButton: 48x48dp interactive target, 40dp circle state layer, 24dp icon
    expect(source).toMatch(/width:\s*48px;\s*height:\s*48px/)
    expect(source).toMatch(/width:\s*40px;\s*height:\s*40px/)
    expect(source).toMatch(/width:\s*24px;\s*height:\s*24px/)
    expect(source).toContain('var(--v-theme-on-surface-variant)')
    expect(source).toContain('var(--v-theme-primary)')
  })

  it('respects enabled state and emits click and click:filter', () => {
    expect(source).toContain("if (!props.enabled) return")
    expect(source).toContain("emit('click', e)")
    expect(source).toContain("emit('click:filter', e)")
  })
})
