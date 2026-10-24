import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Chapter } from '@/core/api/types'

export interface MergedSourceReference {
  mangaId: number
  sourceId: string
  sourceName: string
  title: string
  coverUrl: string
  chapterPriority: number
  isInfoManga: boolean
  getChapterUpdates: boolean
  downloadChapters: boolean
}

export interface MergedMangaGroup {
  id: string
  primaryMangaId: number
  chapterSortMode: 'priority' | 'chapterNumber'
  references: MergedSourceReference[]
  createdAt: number
}

export type MergedChapterItem = Chapter & { sourceName?: string }

const STORAGE_KEY = 'mihon.merged_manga'

function loadMergedGroups(): Record<string, MergedMangaGroup> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, MergedMangaGroup>
    }
    return {}
  } catch {
    return {}
  }
}

function persistMergedGroups(groups: Record<string, MergedMangaGroup>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups))
  } catch (err) {
    console.error('Failed to persist merged manga groups:', err)
  }
}

/**
 * Deduplicates merged chapters sharing identical chapterNumber floats,
 * keeping the chapter from the higher priority source.
 * Follows TachiyomiSY `GetMergedChaptersByMangaId.kt` semantics.
 */
export function deduplicateMergedChapters(
  chapters: MergedChapterItem[],
  group: MergedMangaGroup,
): MergedChapterItem[] {
  if (group.chapterSortMode === 'chapterNumber') {
    return chapters
  }

  const priorityMap = new Map<number, number>()
  for (const ref of group.references) {
    priorityMap.set(ref.mangaId, ref.chapterPriority)
  }

  // Group chapters by mangaId
  const byManga = new Map<number, MergedChapterItem[]>()
  for (const chapter of chapters) {
    const mId = chapter.mangaId
    let list = byManga.get(mId)
    if (!list) {
      list = []
      byManga.set(mId, list)
    }
    list.push(chapter)
  }

  // Sort groups by chapterPriority ascending (0 is highest priority)
  const sortedEntries = Array.from(byManga.entries()).sort(([mangaIdA], [mangaIdB]) => {
    const prioA = priorityMap.get(mangaIdA) ?? Number.MAX_SAFE_INTEGER
    const prioB = priorityMap.get(mangaIdB) ?? Number.MAX_SAFE_INTEGER
    return prioA - prioB
  })

  const result: MergedChapterItem[] = []

  for (const [, sourceChapters] of sortedEntries) {
    for (const chapter of sourceChapters) {
      const isRecognized = typeof chapter.chapterNumber === 'number' && chapter.chapterNumber >= 0
      if (isRecognized) {
        const alreadyExistsFromOtherSource = result.some(
          existing =>
            typeof existing.chapterNumber === 'number' &&
            existing.chapterNumber >= 0 &&
            Math.abs(existing.chapterNumber - chapter.chapterNumber) < 0.0001 &&
            existing.mangaId !== chapter.mangaId,
        )
        if (!alreadyExistsFromOtherSource) {
          result.push(chapter)
        }
      } else {
        result.push(chapter)
      }
    }
  }

  return result
}

export const useMergedMangaStore = defineStore('mergedManga', () => {
  const groups = ref<Record<string, MergedMangaGroup>>(loadMergedGroups())

  function getGroup(mangaId: number): MergedMangaGroup | undefined {
    const strId = String(mangaId)
    if (groups.value[strId]) {
      return groups.value[strId]
    }
    for (const group of Object.values(groups.value)) {
      if (group.primaryMangaId === mangaId || group.references.some(r => r.mangaId === mangaId)) {
        return group
      }
    }
    return undefined
  }

  function saveGroup(group: MergedMangaGroup): void {
    groups.value[String(group.primaryMangaId)] = group
    persistMergedGroups(groups.value)
  }

  function deleteGroup(primaryMangaId: number): void {
    const next = { ...groups.value }
    delete next[String(primaryMangaId)]
    groups.value = next
    persistMergedGroups(groups.value)
  }

  function setSortMode(primaryMangaId: number, mode: 'priority' | 'chapterNumber'): void {
    const group = getGroup(primaryMangaId)
    if (group) {
      group.chapterSortMode = mode
      saveGroup(group)
    }
  }

  function setInfoManga(primaryMangaId: number, infoMangaId: number): void {
    const group = getGroup(primaryMangaId)
    if (group) {
      group.references.forEach(r => {
        r.isInfoManga = r.mangaId === infoMangaId
      })
      saveGroup(group)
    }
  }

  function toggleChapterUpdates(primaryMangaId: number, mangaId: number): void {
    const group = getGroup(primaryMangaId)
    if (group) {
      const ref = group.references.find(r => r.mangaId === mangaId)
      if (ref) {
        ref.getChapterUpdates = !ref.getChapterUpdates
        saveGroup(group)
      }
    }
  }

  function toggleDownloadChapters(primaryMangaId: number, mangaId: number): void {
    const group = getGroup(primaryMangaId)
    if (group) {
      const ref = group.references.find(r => r.mangaId === mangaId)
      if (ref) {
        ref.downloadChapters = !ref.downloadChapters
        saveGroup(group)
      }
    }
  }

  function reorderReferences(primaryMangaId: number, newReferences: MergedSourceReference[]): void {
    const group = getGroup(primaryMangaId)
    if (group) {
      group.references = newReferences.map((r, idx) => ({
        ...r,
        chapterPriority: idx,
      }))
      saveGroup(group)
    }
  }

  function addReference(primaryMangaId: number, ref: MergedSourceReference): void {
    const group = getGroup(primaryMangaId)
    if (group) {
      if (!group.references.some(r => r.mangaId === ref.mangaId)) {
        ref.chapterPriority = group.references.length
        group.references.push(ref)
        saveGroup(group)
      }
    } else {
      saveGroup({
        id: `merge-${primaryMangaId}`,
        primaryMangaId,
        chapterSortMode: 'priority',
        references: [ref],
        createdAt: Date.now(),
      })
    }
  }

  function removeReference(primaryMangaId: number, mangaId: number): void {
    const group = getGroup(primaryMangaId)
    if (group) {
      group.references = group.references.filter(r => r.mangaId !== mangaId)
      group.references.forEach((r, idx) => {
        r.chapterPriority = idx
      })
      if (group.references.length > 0 && !group.references.some(r => r.isInfoManga)) {
        group.references[0].isInfoManga = true
      }
      saveGroup(group)
    }
  }

  return {
    groups,
    getGroup,
    saveGroup,
    deleteGroup,
    setSortMode,
    setInfoManga,
    toggleChapterUpdates,
    toggleDownloadChapters,
    reorderReferences,
    addReference,
    removeReference,
  }
})
