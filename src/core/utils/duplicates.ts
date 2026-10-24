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
        const other = (item.title ?? '').toLowerCase()
        if (other.includes(title)) return true
      }
      return sharesTracker(current, item)
    })
    .map(item => ({ manga: item, chapterCount: item.chapterCount ?? 0 }))
}
