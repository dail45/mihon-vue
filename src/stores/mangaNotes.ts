import { defineStore } from 'pinia'
import { ref } from 'vue'
import { notesStorageKey } from '../utils/mangaNotes'

export const useMangaNotesStore = defineStore('mangaNotes', () => {
  const notesByManga = ref<Record<string, string>>({})

  function getNotes(apiUrl: string, mangaId: number): string {
    const key = notesStorageKey(apiUrl, mangaId)
    if (notesByManga.value[key] === undefined) {
      try {
        notesByManga.value[key] = localStorage.getItem(key) || ''
      } catch {
        notesByManga.value[key] = ''
      }
    }
    return notesByManga.value[key]
  }

  function setNotes(apiUrl: string, mangaId: number, markdown: string): void {
    const key = notesStorageKey(apiUrl, mangaId)
    notesByManga.value[key] = markdown
    try {
      localStorage.setItem(key, markdown)
    } catch {}
  }

  return {
    notesByManga,
    getNotes,
    setNotes,
  }
})
