/**
 * Upcoming and "To Be Updated" Queue Computation.
 *
 * Reference:
 *   komikku/app/src/main/java/mihon/feature/upcoming/UpcomingScreenContent.kt
 *   komikku/app/src/main/java/mihon/feature/upcoming/UpcomingScreenModel.kt
 *   komikku/domain/src/main/java/mihon/domain/upcoming/interactor/GetUpcomingManga.kt
 */
import type { Chapter, Manga } from '@/core/api/types'
import { estimateSchedule, nextCheck, toEpochDay } from './releaseSchedule'

export interface UpcomingRelease {
  manga: Manga
  /** Epoch day of the expected next update. */
  day: number
  /** The library categories the title belongs to. */
  categories: number[]
}

export interface ToBeUpdatedEntry {
  manga: Manga
  /** Epoch day of the scheduled check that has elapsed or is due. */
  day: number
  /** The library categories the title belongs to. */
  categories: number[]
  /** Number of days the check is overdue (>= 0). */
  overdueDays: number
}

/**
 * Checks if a manga has an eligible status for upcoming schedule derivation.
 * Komikku / Mihon GetUpcomingManga: ONGOING or PUBLISHING_FINISHED.
 */
export function isUpcomingStatus(manga: Manga): boolean {
  return manga.status === 'ONGOING' || manga.status === 'PUBLISHING_FINISHED'
}

/**
 * Determines whether a manga passes category inclusion/exclusion criteria.
 */
export function filterByCategory(
  categories: number[],
  includedCategories: Set<number>,
  excludedCategories: Set<number>,
): boolean {
  if (categories.some(id => excludedCategories.has(id))) return false
  if (includedCategories.size > 0 && !categories.some(id => includedCategories.has(id))) return false
  return true
}

/**
 * Calculates the next expected update day (epoch day) based on chapter history.
 */
export function calculateNextUpdateDay(
  chapters: Array<{ uploadDate: number; fetchedAt: number }>,
  todayEpochDay: number = toEpochDay(new Date()),
): number | null {
  if (!chapters.length) return null
  const schedule = estimateSchedule(
    chapters.map(c => ({ uploadDate: c.uploadDate, fetchedAt: c.fetchedAt })),
    todayEpochDay,
  )
  return nextCheck(schedule, todayEpochDay)
}

/**
 * Checks if a scheduled update timestamp / epoch day is in the past (overdue) or due today.
 */
export function isUpdateDue(day: number, todayEpochDay: number = toEpochDay(new Date())): boolean {
  return day <= todayEpochDay
}

/**
 * Derives both upcoming predicted chapter releases and "To be updated" pending queue
 * from library candidates and their chapter metadata.
 */
export function partitionUpcomingAndDue(
  items: Array<{ manga: Manga; chapters: Chapter[]; categories: number[] }>,
  todayEpochDay: number = toEpochDay(new Date()),
): {
  upcoming: UpcomingRelease[]
  toBeUpdated: ToBeUpdatedEntry[]
} {
  const upcoming: UpcomingRelease[] = []
  const toBeUpdated: ToBeUpdatedEntry[] = []

  for (const item of items) {
    if (!item.chapters.length) continue
    const day = calculateNextUpdateDay(
      item.chapters.map(c => ({
        uploadDate: c.uploadDate,
        fetchedAt: c.fetchedAt * 1000,
      })),
      todayEpochDay,
    )
    if (day === null) continue

    if (day <= todayEpochDay) {
      toBeUpdated.push({
        manga: item.manga,
        day,
        categories: item.categories,
        overdueDays: Math.max(0, todayEpochDay - day),
      })
    } else {
      upcoming.push({
        manga: item.manga,
        day,
        categories: item.categories,
      })
    }
  }

  upcoming.sort((a, b) => a.day - b.day || a.manga.title.localeCompare(b.manga.title))
  toBeUpdated.sort((a, b) => a.day - b.day || a.manga.title.localeCompare(b.manga.title))

  return { upcoming, toBeUpdated }
}
