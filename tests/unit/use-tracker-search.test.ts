import { describe, expect, it, vi } from 'vitest'
import { useTrackerSearch } from '../../src/composables/useTrackerSearch'
import * as trackerApi from '../../src/api/trackers'

vi.mock('../../src/api/trackers', () => ({
  listTrackers: vi.fn(),
  searchTracker: vi.fn(),
  bindTracker: vi.fn(),
  loginTrackerCredentials: vi.fn(),
}))

describe('useTrackerSearch composable', () => {
  it('loads trackers and finds tracker by id', async () => {
    vi.mocked(trackerApi.listTrackers).mockResolvedValueOnce([
      { id: 1, name: 'AniList', authUrl: null, isLoggedIn: true, supportsPrivateTracking: true },
      { id: 2, name: 'MyAnimeList', authUrl: null, isLoggedIn: false, supportsPrivateTracking: false },
    ] as any)

    const search = useTrackerSearch({
      apiUrl: 'http://localhost:4567',
      mangaId: 100,
      trackerId: 1,
    })

    await search.loadTrackers()
    expect(search.trackers.value).toHaveLength(2)
    expect(search.tracker.value?.name).toBe('AniList')
    expect(search.supportsPrivateTracking.value).toBe(true)
  })

  it('runs search and sets results', async () => {
    vi.mocked(trackerApi.searchTracker).mockResolvedValueOnce([
      { id: 10, remoteId: 999, title: 'One Piece', summary: '', coverUrl: '', totalChapters: 1000, trackingUrl: '', publishingStatus: 'PUBLISHING', publishingType: 'MANGA', startDate: '' },
    ] as any)

    const search = useTrackerSearch({
      apiUrl: 'http://localhost:4567',
      mangaId: 100,
      trackerId: 1,
    })

    await search.runSearch('One Piece')
    expect(search.queryResult.value).toEqual({
      ok: true,
      items: expect.arrayContaining([expect.objectContaining({ title: 'One Piece' })]),
    })
  })
})
