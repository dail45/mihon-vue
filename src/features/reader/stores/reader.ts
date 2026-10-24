import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createSuwayomiApi, apiErrorMessage } from '@/core/api/client'
import type { Chapter, ChapterPatch, Manga } from '@/core/api/types'
export const useReaderStore = defineStore('reader', () => {
  const manga = ref<Manga | null>(null), chapter = ref<Chapter | null>(null), chapters = ref<Chapter[]>([])
  const loading = ref(false), error = ref<string | null>(null), pageIndex = ref(0)
  const saveError = ref<string | null>(null), pendingWrites = ref(0), lastSavedPage = ref<number | null>(null)
  const notice = ref('')
  const queuedPages = new Set<string>()
  let generation = 0, baseUrl = '', writes: Promise<unknown> = Promise.resolve()
  const pageCount = computed(() => Math.max(0, chapter.value?.pageCount ?? 0))
  const orderedChapters = computed(() => chapters.value.slice().sort((a, b) => a.index - b.index))
  const chapterPosition = computed(() => orderedChapters.value.findIndex(c => c.index === chapter.value?.index))
  const previousChapter = computed(() => orderedChapters.value[chapterPosition.value - 1] ?? null)
  const nextChapter = computed(() => chapterPosition.value < 0 ? null : orderedChapters.value[chapterPosition.value + 1] ?? null)
  async function open(apiUrl: string, mangaId: number, chapterIndex: number) {
    const request = ++generation
    queuedPages.clear(); baseUrl = apiUrl; manga.value = null; chapter.value = null; chapters.value = []
    pageIndex.value = 0; error.value = null; saveError.value = null; notice.value = ''; pendingWrites.value = 0; lastSavedPage.value = null; loading.value = true
    const api = createSuwayomiApi(apiUrl)
    try {
      const [detail, list, selected] = await Promise.all([api.manga(mangaId), api.chapters(mangaId), api.chapter(mangaId, chapterIndex)])
      if (request !== generation) return
      if (selected.mangaId !== mangaId || selected.index !== chapterIndex) throw new Error('Invalid chapter response')
      manga.value = detail; chapters.value = list; chapter.value = selected
      const resume = Number.isInteger(selected.lastPageRead) ? selected.lastPageRead : 0
      pageIndex.value = Math.max(0, Math.min(resume, Math.max(0, selected.pageCount - 1)))
    } catch (e) { if (request === generation) error.value = apiErrorMessage(e) }
    finally { if (request === generation) loading.value = false }
  }
  function close() { generation++; loading.value = false; chapter.value = null; manga.value = null; chapters.value = []; pendingWrites.value = 0; lastSavedPage.value = null; saveError.value = null; notice.value = ''; queuedPages.clear() }
  function setPage(index: number) {
    if (!Number.isFinite(index)) return
    pageIndex.value = Math.max(0, Math.min(Math.round(index), Math.max(0, pageCount.value - 1)))
  }
  function pageUrl(index: number, revision = 0) {
    if (!chapter.value) return ''
    return `${baseUrl}/manga/${chapter.value.mangaId}/chapter/${chapter.value.index}/page/${index}?updateProgress=false${revision ? `&retry=${revision}` : ''}`
  }
  async function write(patch: ChapterPatch): Promise<boolean> {
    if (!chapter.value) return false
    const request = generation, selected = chapter.value, api = createSuwayomiApi(baseUrl)
    pendingWrites.value++
    const task = writes.catch(() => {}).then(async () => {
      if (request !== generation || saveError.value) return false
      await api.modifyChapter(selected.mangaId, selected.index, patch)
      return true
    })
    writes = task
    try {
      const sent = await task
      if (!sent || request !== generation) return false
      // Only a successful server response updates the visible confirmation.
      if (patch.lastPageRead !== undefined) lastSavedPage.value = patch.lastPageRead
      if (patch.bookmarked !== undefined) {
        notice.value = patch.bookmarked ? 'Bookmark added on server' : 'Bookmark removed on server'
        // Mirror the confirmed server state so the reader top bar icon updates.
        if (chapter.value) chapter.value = { ...chapter.value, bookmarked: patch.bookmarked }
      }
      return true
    } catch (e) {
      if (request === generation) saveError.value = `${apiErrorMessage(e)} The write may have reached the server. Automatic saving is paused; verify server state before trying again.`
      return false
    } finally { if (request === generation) pendingWrites.value-- }
  }
  async function savePage(index: number, explicit = false) {
    if (!chapter.value || !Number.isInteger(index) || index < 0 || index >= pageCount.value) return false
    if (saveError.value && !explicit) return false
    if (!explicit && index === lastSavedPage.value) return true
    if (explicit) saveError.value = null
    const key = `${generation}:${index}`
    if (queuedPages.has(key)) return false
    queuedPages.add(key)
    try { return await write({ lastPageRead: index, ...(index === pageCount.value - 1 ? { read: true } : {}) }) }
    finally { queuedPages.delete(key) }
  }
  async function bookmark(value: boolean) { if (saveError.value) return false; return write({ bookmarked: value }) }
  return { manga, chapter, chapters, loading, error, pageIndex, pageCount, orderedChapters, previousChapter, nextChapter,
    saveError, pendingWrites, lastSavedPage, notice, open, close, setPage, pageUrl, savePage, bookmark }
})
