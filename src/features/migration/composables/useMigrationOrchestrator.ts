/**
 * Client-Side Migration Orchestration Engine.
 *
 * Implements a 4-step transactional migration runner with automatic rollback stack:
 *  1. ADD_TARGET: Add target manga to library via POST (fallback GET).
 *  2. SYNC_CHAPTERS: Match and transfer chapter progress (read, lastPageRead, bookmarked)
 *     using Suwayomi GraphQL batch mutation with concurrency-limited REST fallback.
 *  3. ASSIGN_CATEGORIES: Transfer source category memberships to target manga.
 *  4. COPY_NOTES & DELETE_SOURCE: Transfer user notes; remove source if replace === true.
 *
 * Rollback Handler: If an error occurs during step 2 or 3, newly added target manga is
 * removed from library, leaving source manga untouched.
 */
import { ref } from 'vue'
import { ofetch } from 'ofetch'
import { createSuwayomiApi, normalizeApiUrl } from '@/core/api/client'
import { updateChaptersBatch } from '@/core/api/chaptersBatch'
import { updateMangasCategoriesBatch } from '@/core/api/categoriesBatch'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { useMangaNotesStore } from '@/features/manga/stores/mangaNotes'
import { pLimit } from '@/core/utils/pLimit'
import { t } from '@/core/i18n'
import type { Manga } from '@/core/api/types'

export interface MigrationFlags {
  copyChapters: boolean
  copyCategories: boolean
  copyNotes: boolean
  copyCustomCover: boolean
}

export interface MigrationOptions {
  replace: boolean // true: Migrate (delete source); false: Copy (keep source)
  flags: MigrationFlags
}

export interface MigrationStepStatus {
  step: 'ADD_TARGET' | 'SYNC_CHAPTERS' | 'ASSIGN_CATEGORIES' | 'COPY_NOTES' | 'DELETE_SOURCE'
  current: number
  total: number
  currentMangaTitle: string
  stepLabel: string
}

export function flagsFromBitmask(bitmask: number): MigrationFlags {
  return {
    copyChapters: (bitmask & 0b00001) !== 0,
    copyCategories: (bitmask & 0b00010) !== 0,
    copyCustomCover: (bitmask & 0b01000) !== 0,
    copyNotes: (bitmask & 0b100000) !== 0,
  }
}

export function useMigrationOrchestrator() {
  const server = useSuwayomiStore()
  const isMigrating = ref(false)
  const currentStep = ref<MigrationStepStatus | null>(null)
  const progress = ref(0)
  const error = ref<string | null>(null)

  let abortController: AbortController | null = null

  function normalizeTitle(s: string): string {
    return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  async function migrateItem(
    current: Manga,
    target: Manga,
    options: MigrationOptions,
    index: number,
    total: number,
  ): Promise<void> {
    const api = createSuwayomiApi(server.apiUrl)
    const baseUrl = normalizeApiUrl(server.apiUrl)
    const rollbackStack: Array<() => Promise<void>> = []

    const allLibraryMangas = Object.values(server.libraryByCategory).flat()
    const targetAlreadyInLibrary = allLibraryMangas.some(m => m.id === target.id)

    function updateStep(
      step: MigrationStepStatus['step'],
      stepNum: number,
      stepLabel: string,
    ) {
      currentStep.value = {
        step,
        current: index + 1,
        total,
        currentMangaTitle: current.title,
        stepLabel,
      }
      progress.value = (index + (stepNum / 4)) / total
    }

    try {
      // ------------------------------------------------------------- STEP 1: ADD_TARGET
      updateStep('ADD_TARGET', 1, t('migration_step_add_target', 'Step 1/4: Adding to library...'))
      if (!targetAlreadyInLibrary) {
        try {
          await ofetch(`${baseUrl}/manga/${target.id}/library`, {
            method: 'POST',
            credentials: 'include',
            timeout: 15000,
            retry: 0,
            signal: abortController?.signal,
          })
        } catch {
          // Fallback to GET for legacy REST v1
          await api.addToLibrary(target.id)
        }

        // Register rollback action: delete newly created target from library
        rollbackStack.push(async () => {
          await api.removeFromLibrary(target.id).catch(() => {})
        })
      }

      if (abortController?.signal.aborted) throw new DOMException('Aborted', 'AbortError')

      // ----------------------------------------------------------- STEP 2: SYNC_CHAPTERS
      updateStep('SYNC_CHAPTERS', 2, t('migration_step_sync_chapters', 'Step 2/4: Copying chapter progress...'))
      if (options.flags.copyChapters) {
        const sourceChapters = await api.chapters(current.id, false)
        const targetChapters = await api.chapters(target.id, true)

        if (abortController?.signal.aborted) throw new DOMException('Aborted', 'AbortError')

        const readSourceChapters = sourceChapters.filter(
          c => c.read && typeof c.chapterNumber === 'number' && c.chapterNumber > 0,
        )
        const maxChapterRead = readSourceChapters.length > 0
          ? Math.max(...readSourceChapters.map(c => c.chapterNumber))
          : -1

        const readChapterIds: number[] = []
        const targetChaptersWithProgress: Array<{ id: number; index: number; lastPageRead: number }> = []
        const targetChaptersToBookmark: Array<{ id: number; index: number }> = []

        for (const tch of targetChapters) {
          let sch = typeof tch.chapterNumber === 'number' && tch.chapterNumber > 0
            ? sourceChapters.find(s => s.chapterNumber === tch.chapterNumber)
            : undefined

          if (!sch && tch.name) {
            sch = sourceChapters.find(s => normalizeTitle(s.name) === normalizeTitle(tch.name))
          }

          const shouldMarkRead = !!sch?.read || (
            maxChapterRead > 0 && typeof tch.chapterNumber === 'number' && tch.chapterNumber > 0 && tch.chapterNumber <= maxChapterRead
          )

          if (shouldMarkRead && !tch.read) {
            readChapterIds.push(tch.id)
          }

          if (sch && sch.lastPageRead > 0 && sch.lastPageRead !== tch.lastPageRead) {
            targetChaptersWithProgress.push({ id: tch.id, index: tch.index, lastPageRead: sch.lastPageRead })
          }

          if (sch?.bookmarked && !tch.bookmarked) {
            targetChaptersToBookmark.push({ id: tch.id, index: tch.index })
          }
        }

        if (readChapterIds.length > 0) {
          const success = await updateChaptersBatch(
            server.apiUrl,
            readChapterIds,
            { isRead: true },
            abortController?.signal,
          )
          if (!success) {
            const limit = pLimit(6)
            await Promise.all(
              targetChapters
                .filter(c => readChapterIds.includes(c.id))
                .map(c => limit(() => api.modifyChapter(target.id, c.index, { read: true }))),
            )
          }
        }

        if (targetChaptersWithProgress.length > 0) {
          const limit = pLimit(6)
          await Promise.all(
            targetChaptersWithProgress.map(c =>
              limit(() => api.modifyChapter(target.id, c.index, { lastPageRead: c.lastPageRead })),
            ),
          )
        }

        if (targetChaptersToBookmark.length > 0) {
          const limit = pLimit(6)
          await Promise.all(
            targetChaptersToBookmark.map(c =>
              limit(() => api.modifyChapter(target.id, c.index, { bookmarked: true })),
            ),
          )
        }
      }

      if (abortController?.signal.aborted) throw new DOMException('Aborted', 'AbortError')

      // -------------------------------------------------------- STEP 3: ASSIGN_CATEGORIES
      updateStep('ASSIGN_CATEGORIES', 3, t('migration_step_assign_categories', 'Step 3/4: Assigning categories...'))
      if (options.flags.copyCategories) {
        const sourceCategoryIds: number[] = []
        for (const [catIdStr, list] of Object.entries(server.libraryByCategory)) {
          const catId = Number(catIdStr)
          if (catId > 0 && list.some(m => m.id === current.id)) {
            sourceCategoryIds.push(catId)
          }
        }

        if (sourceCategoryIds.length > 0) {
          await updateMangasCategoriesBatch(
            server.apiUrl,
            [target.id],
            { addToCategories: sourceCategoryIds },
            undefined,
            abortController?.signal,
          )

          // Optimistically update server.libraryByCategory
          for (const catId of sourceCategoryIds) {
            const existing = server.libraryByCategory[catId]
            if (existing && !existing.some(m => m.id === target.id)) {
              server.libraryByCategory[catId] = [...existing, target]
            }
          }
        }
      }

      if (abortController?.signal.aborted) throw new DOMException('Aborted', 'AbortError')

      // -------------------------------------------------- STEP 4: COPY_NOTES & DELETE_SOURCE
      updateStep('COPY_NOTES', 4, t('migration_step_copy_notes', 'Step 4/4: Finalizing migration...'))
      if (options.flags.copyNotes) {
        const notesStore = useMangaNotesStore()
        const notes = notesStore.getNotes(server.apiUrl, current.id)
        if (notes) {
          notesStore.setNotes(server.apiUrl, target.id, notes)
        }
      }

      if (options.replace) {
        updateStep('DELETE_SOURCE', 4, t('migration_step_copy_notes', 'Step 4/4: Finalizing migration...'))
        await api.removeFromLibrary(current.id)

        // Optimistically remove source from libraryByCategory
        for (const catId of Object.keys(server.libraryByCategory)) {
          const numId = Number(catId)
          if (server.libraryByCategory[numId]) {
            server.libraryByCategory[numId] = server.libraryByCategory[numId]!.filter(m => m.id !== current.id)
          }
        }
      }

      // Success: clear rollback stack so target is preserved
      rollbackStack.length = 0
    } catch (err) {
      // Rollback newly added target manga if failure occurred during steps 1..3
      for (const rollback of rollbackStack.reverse()) {
        try {
          await rollback()
        } catch (rbErr) {
          console.warn('Rollback failed:', rbErr)
        }
      }
      throw err
    }
  }

  async function migrate(
    items: Array<{ current: Manga; target: Manga }>,
    options: MigrationOptions,
  ): Promise<boolean> {
    if (!items.length) return true
    isMigrating.value = true
    error.value = null
    progress.value = 0
    abortController = new AbortController()

    try {
      for (let i = 0; i < items.length; i++) {
        if (abortController.signal.aborted) break
        const item = items[i]!
        await migrateItem(item.current, item.target, options, i, items.length)
        progress.value = (i + 1) / items.length
      }
      // Refresh library on server
      await server.loadLibrary().catch(() => {})
      return true
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        error.value = t('migration_cancelled', 'Migration cancelled')
      } else {
        error.value = err instanceof Error ? err.message : String(err)
      }
      return false
    } finally {
      isMigrating.value = false
      currentStep.value = null
      abortController = null
    }
  }

  function cancel(): void {
    if (abortController) {
      abortController.abort()
    }
  }

  return {
    isMigrating,
    currentStep,
    progress,
    error,
    migrate,
    cancel,
  }
}
