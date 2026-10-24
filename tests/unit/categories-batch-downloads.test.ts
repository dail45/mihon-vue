import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  updateMangasCategories,
  updateMangasCategoriesBatch,
  updateMangaCategories,
  updateManga,
} from '@/core/api/categoriesBatch'
import { enqueueChapterDownloadsBatch } from '@/core/api/chapterDownloads'
import en from '@/locales/en.json'
import ru from '@/locales/ru.json'

describe('Feature 1.1 & 1.2: Categories Batch & Library Batch Downloads', () => {
  it('exports required GraphQL batch category mutation functions and interfaces', () => {
    expect(typeof updateMangasCategories).toBe('function')
    expect(typeof updateMangasCategoriesBatch).toBe('function')
    expect(typeof updateMangaCategories).toBe('function')
    expect(typeof updateManga).toBe('function')
  })

  it('exports required chapter download batch queueing helper', () => {
    expect(typeof enqueueChapterDownloadsBatch).toBe('function')
  })

  it('contains expected i18n keys in en.json and ru.json', () => {
    expect(en.categories_updated).toBe('Categories updated')
    expect(ru.categories_updated).toBe('Категории обновлены')

    expect(en.chapters_queued_for_download).toBeDefined()
    expect(ru.chapters_queued_for_download).toBeDefined()

    expect(en.no_chapters_queued).toBeDefined()
    expect(ru.no_chapters_queued).toBeDefined()
  })

  it('wires MangaBottomActionMenu with can-download and download event in LibraryView', () => {
    const libraryViewSource = readFileSync('src/features/library/views/LibraryView.vue', 'utf8')
    expect(libraryViewSource).toMatch(/<MangaBottomActionMenu[\s\S]*?:can-download="true"/)
    expect(libraryViewSource).toMatch(/@download="onBatchDownload"/)
    expect(libraryViewSource).toContain('Categories updated')
    expect(libraryViewSource).not.toContain('Setting categories is not supported in the web version')
  })

  it('enables canDownload by default for library variant in MangaBottomActionMenu', () => {
    const bottomMenuSource = readFileSync('src/features/manga/components/MangaBottomActionMenu.vue', 'utf8')
    expect(bottomMenuSource).toContain("const downloadAllowed = props.variant === 'library' ? (props.canDownload ?? true) : Boolean(props.canDownload)")
    expect(bottomMenuSource).toContain("if (props.variant === 'library') return false")
  })
})
