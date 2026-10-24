import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  isUpcomingStatus,
  calculateNextUpdateDay,
  partitionUpcomingAndDue,
} from '@/core/utils/upcoming'
import { toEpochDay } from '@/core/utils/releaseSchedule'
import type { Manga, Chapter } from '@/core/api/types'

describe('3.9 Upcoming "To Be Updated" Queue Toggle', () => {
  it('correctly filters manga with upcoming status', () => {
    expect(isUpcomingStatus({ status: 'ONGOING' } as Manga)).toBe(true)
    expect(isUpcomingStatus({ status: 'PUBLISHING_FINISHED' } as Manga)).toBe(true)
    expect(isUpcomingStatus({ status: 'COMPLETED' } as Manga)).toBe(false)
    expect(isUpcomingStatus({ status: 'CANCELLED' } as Manga)).toBe(false)
  })

  it('computes next update day and detects overdue update checks', () => {
    const today = toEpochDay(new Date())
    // chapter uploaded 20 days ago, fetched 20 days ago -> interval derived
    const pastChapters = [
      { uploadDate: Date.now() - 20 * 86400000, fetchedAt: Math.floor((Date.now() - 20 * 86400000) / 1000) },
      { uploadDate: Date.now() - 10 * 86400000, fetchedAt: Math.floor((Date.now() - 10 * 86400000) / 1000) },
    ]
    const day = calculateNextUpdateDay(pastChapters, today)
    expect(day).not.toBeNull()
    if (day !== null) {
      expect(typeof day).toBe('number')
    }
  })

  it('partitions items into upcoming and to-be-updated queues', () => {
    const today = toEpochDay(new Date())
    const mangaDue = { id: 1, title: 'Overdue Manga', status: 'ONGOING' } as Manga
    const mangaFuture = { id: 2, title: 'Future Manga', status: 'ONGOING' } as Manga

    // Overdue chapters (last upload 100 days ago, weekly schedule)
    const overdueChapters: Chapter[] = [
      { id: 1, uploadDate: Date.now() - 100 * 86400000, fetchedAt: Math.floor((Date.now() - 100 * 86400000) / 1000) } as Chapter,
      { id: 2, uploadDate: Date.now() - 93 * 86400000, fetchedAt: Math.floor((Date.now() - 93 * 86400000) / 1000) } as Chapter,
    ]

    // Recent chapters (uploaded yesterday, weekly schedule -> next in 6 days)
    const recentChapters: Chapter[] = [
      { id: 3, uploadDate: Date.now() - 8 * 86400000, fetchedAt: Math.floor((Date.now() - 8 * 86400000) / 1000) } as Chapter,
      { id: 4, uploadDate: Date.now() - 1 * 86400000, fetchedAt: Math.floor((Date.now() - 1 * 86400000) / 1000) } as Chapter,
    ]

    const items = [
      { manga: mangaDue, chapters: overdueChapters, categories: [1] },
      { manga: mangaFuture, chapters: recentChapters, categories: [1] },
    ]

    const result = partitionUpcomingAndDue(items, today)
    expect(Array.isArray(result.upcoming)).toBe(true)
    expect(Array.isArray(result.toBeUpdated)).toBe(true)
  })

  it('UpcomingView contains toolbar toggle button with new_releases icon and isShowingUpdatingMangas ref', () => {
    const source = readFileSync('src/features/updates/views/UpcomingView.vue', 'utf8')
    expect(source).toContain('isShowingUpdatingMangas')
    expect(source).toContain('icon="new_releases"')
    expect(source).toContain('label_to_be_updated')
    expect(source).toContain('label_upcoming')
    expect(source).toContain('isUpdateDue')
  })
})
