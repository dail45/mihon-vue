import { describe, expect, it } from 'vitest'
import { estimateSchedule, nextCheck, toEpochDay } from '../../src/utils/releaseSchedule'

const DAY = 86_400_000
const today = toEpochDay(new Date(2024, 0, 10))

/** A weekly release run: chapters every 7 days. */
const weekly = (count: number, step = 7) => Array.from({ length: count }, (_, index) => ({
  uploadDate: (today - index * step) * DAY,
  fetchedAt: (today - index * step) * DAY / 1000,
}))

describe('release schedule', () => {
  it('detects a weekly schedule and returns the next release day', () => {
    const schedule = estimateSchedule(weekly(8), today)
    expect(schedule.interval).toBe(7)
    expect(nextCheck(schedule, today)).toBe(today + 7)
  })

  it('keeps today when the release is still due', () => {
    // The newest release was a week ago, so the next one is due today.
    const schedule = estimateSchedule(weekly(8).map(chapter => ({
      uploadDate: chapter.uploadDate - 7 * DAY,
      fetchedAt: chapter.fetchedAt,
    })), today)
    expect(nextCheck(schedule, today)).toBe(today)
  })

  it('never returns a day further away than the maximum interval', () => {
    const stale = Array.from({ length: 4 }, (_, index) => ({
      uploadDate: (today - 200 - index * 400) * DAY,
      fetchedAt: 0,
    }))
    const schedule = estimateSchedule(stale, today)
    expect(nextCheck(schedule, today)).toBeLessThanOrEqual(today + 28)
  })

  it('falls back to a default interval without enough history', () => {
    const schedule = estimateSchedule([{ uploadDate: today * DAY, fetchedAt: 0 }], today)
    expect(schedule.interval).toBe(7)
    expect(nextCheck(schedule, today)).toBeGreaterThanOrEqual(today)
  })
})
