import type { Manga } from '../api/types'

/**
 * Mirrors `tachiyomi.data.manga.MangaRepository.getDuplicateLibraryManga`
 * (SQL: `mihon/data/src/main/sqldelight/tachiyomi/data/manga.sq`, `getDuplicateLibraryManga`).
 *
 * The reference query returns every library entry (`user_favorite_at IS NOT NULL`) that
 *
 *  - is not the manga itself (`M.id != :id`),
 *  - whose title contains the current title
 *    (`lower(M.remote_title) LIKE '%' || lower(:remoteTitle) || '%'`, skipped for a blank title),
 *  - or shares a tracker entry with it (`track_dupes`: same `tracker_id` and `remote_id`,
 *    `remote_id != 0`, different `manga_id`).
 *
 * The chapter count is the number of chapters of the entry, excluding excluded scanlators.
 */
export interface DuplicateManga {
  manga: Manga
  chapterCount: number
}

export type DuplicateResolutionMode = 'prompt' | 'allow_all' | 'skip_all'
export type DuplicateAction = 'add' | 'allow_all' | 'skip' | 'skip_all' | 'cancel'

function sharesTracker(current: Manga, other: Manga): boolean {
  const currentRecords = (current.trackers ?? []).map(t => t.record).filter((r): r is NonNullable<typeof r> => !!r)
  if (!currentRecords.length) return false
  const otherRecords = (other.trackers ?? []).map(t => t.record).filter((r): r is NonNullable<typeof r> => !!r)
  if (!otherRecords.length) return false
  return currentRecords.some(t => t.remoteId !== 0 && otherRecords.some(o => o.trackerId === t.trackerId && o.remoteId === t.remoteId))
}

/** The duplicate candidates of `current` inside the library, in library order. */
export function findDuplicateManga(current: Manga, library: Manga[]): DuplicateManga[] {
  const title = (current.title ?? '').trim().toLowerCase()
  return library
    .filter(item => item.id !== current.id)
    .filter(item => {
      if (title) {
        const other = (item.title ?? '').trim().toLowerCase()
        if (other && (other.includes(title) || title.includes(other))) return true
      }
      return sharesTracker(current, item)
    })
    .map(item => ({ manga: item, chapterCount: item.chapterCount ?? 0 }))
}

/**
 * Bulk duplicate resolution state runner.
 * Manages iterating through a batch of manga candidates, detecting duplicates against
 * library items, and handling user resolution modes ('prompt', 'allow_all', 'skip_all').
 */
export class BulkDuplicateQueueRunner {
  private items: Manga[]
  private library: Manga[]
  private currentIndex = 0
  private mode: DuplicateResolutionMode = 'prompt'
  private resolved: Manga[] = []
  private skipped: Manga[] = []

  constructor(items: Manga[], library: Manga[]) {
    this.items = [...items]
    this.library = [...library]
  }

  get currentItem(): Manga | null {
    if (this.currentIndex >= this.items.length) return null
    return this.items[this.currentIndex]!
  }

  get currentDuplicates(): DuplicateManga[] {
    const item = this.currentItem
    if (!item) return []
    return findDuplicateManga(item, this.library)
  }

  get isDone(): boolean {
    return this.currentIndex >= this.items.length
  }

  get resolvedItems(): Manga[] {
    return [...this.resolved]
  }

  get skippedItems(): Manga[] {
    return [...this.skipped]
  }

  get currentMode(): DuplicateResolutionMode {
    return this.mode
  }

  setMode(mode: DuplicateResolutionMode) {
    this.mode = mode
  }

  /**
   * Advances the runner to the next item requiring user decision, or finishes if none.
   * Returns true if there is a pending duplicate requiring user decision, or false if finished.
   */
  next(): boolean {
    while (this.currentIndex < this.items.length) {
      const item = this.items[this.currentIndex]!
      if (item.inLibrary || this.library.some(l => l.id === item.id)) {
        this.currentIndex++
        continue
      }

      const dupes = findDuplicateManga(item, this.library)
      if (dupes.length === 0) {
        this.resolved.push(item)
        this.currentIndex++
        continue
      }

      if (this.mode === 'allow_all') {
        this.resolved.push(item)
        this.currentIndex++
        continue
      }

      if (this.mode === 'skip_all') {
        this.skipped.push(item)
        this.currentIndex++
        continue
      }

      // Mode is 'prompt' and duplicate found
      return true
    }
    return false
  }

  /** Add anyway: add current duplicate item and proceed */
  addAnyway() {
    if (this.currentItem) {
      this.resolved.push(this.currentItem)
      this.currentIndex++
    }
  }

  /** Allow all: set mode to allow_all and add current item */
  allowAll() {
    this.mode = 'allow_all'
    if (this.currentItem) {
      this.resolved.push(this.currentItem)
      this.currentIndex++
    }
  }

  /** Skip it: skip current item and proceed */
  skipCurrent() {
    if (this.currentItem) {
      this.skipped.push(this.currentItem)
      this.currentIndex++
    }
  }

  /** Skip all: set mode to skip_all and skip current item */
  skipAll() {
    this.mode = 'skip_all'
    if (this.currentItem) {
      this.skipped.push(this.currentItem)
      this.currentIndex++
    }
  }

  cancel() {
    this.currentIndex = this.items.length
  }
}
