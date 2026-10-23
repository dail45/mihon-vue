/** Suwayomi statistics client.
 *
 * Mihon builds the statistics screen from its own local database
 * (mihon/app/src/main/java/eu/kanade/tachiyomi/ui/stats/StatsViewModel.kt).
 * This web client is a headless REST/GraphQL client, so every number is derived
 * from the data the server reports:
 *   - library entries, chapter counts, unread counts and download counts come
 *     from the REST v1 category listings (see src/stores/suwayomi.ts);
 *   - tracker counts, tracked titles and the mean score come from the
 *     GraphQL endpoint (/api/graphql), the only surface that exposes trackers;
 *   - the global-update restrictions map onto the server's own
 *     `excludeCompleted` / `excludeEntryWithUnreadChapters` / `excludeNotStarted`
 *     library-update settings.
 *
 * Read duration is NOT reported by Suwayomi-Server, so the overview falls back to
 * the same "None" placeholder Mihon shows for an empty duration.
 */
import { ofetch } from 'ofetch'
import { serverGraphqlUrl } from './serverSettings'

export interface TrackerStats {
  /** Trackers the server reports as logged in (Mihon: loggedInTrackers). */
  loggedInTrackerCount: number
  /** Library entries that carry at least one track record of a logged-in tracker. */
  trackedTitleCount: number
  /** Mean of the per-title mean scores, or null when there is nothing to average. */
  meanScore: number | null
}

export interface UpdateRestrictions {
  excludeCompleted: boolean
  excludeEntryWithUnreadChapters: boolean
  excludeNotStarted: boolean
}

interface GraphQLResponse<T> {
  data?: T
  errors?: { message: string }[]
}

const statsQuery = `query StatsScreen {
  trackers(first: 100) {
    edges { node { id isLoggedIn } }
  }
  trackRecords(first: 1000) {
    nodes { mangaId trackerId score }
  }
  settings {
    excludeCompleted
    excludeEntryWithUnreadChapters
    excludeNotStarted
  }
}`

interface StatsPayload {
  trackers?: { edges?: { node?: { id: number; isLoggedIn: boolean } | null }[] | null } | null
  trackRecords?: { nodes?: { mangaId: number; trackerId: number; score: number }[] | null } | null
  settings?: Partial<UpdateRestrictions> | null
}

/**
 * Reads the tracker statistics and the library-update restrictions.
 * `libraryMangaIds` restricts the tracked-title count to the library, exactly
 * like Mihon's `getMangaTrackMap` which only looks at library entries.
 */
export async function readTrackerStats(apiUrl: string, libraryMangaIds: number[]): Promise<{ trackers: TrackerStats; restrictions: UpdateRestrictions }> {
  const response = await ofetch<GraphQLResponse<StatsPayload>>(serverGraphqlUrl(apiUrl), {
    method: 'POST',
    body: { query: statsQuery },
    credentials: 'include',
    timeout: 15000,
    retry: 0,
  })
  if (response.errors?.length) throw new Error(response.errors.map(error => error.message).join(' '))
  const data = response.data
  if (!data) throw new Error('The server returned no data for the statistics query.')

  const nodes = (data.trackers?.edges ?? []).map(edge => edge.node).filter((node): node is { id: number; isLoggedIn: boolean } => !!node)
  const loggedInIds = new Set(nodes.filter(node => node.isLoggedIn).map(node => node.id))
  const records = data.trackRecords?.nodes ?? []

  const libraryIds = new Set(libraryMangaIds)
  const byManga = new Map<number, number[]>()
  for (const record of records) {
    if (!loggedInIds.has(record.trackerId)) continue
    if (!libraryIds.has(record.mangaId)) continue
    // Mihon ignores tracks without a score when computing the mean.
    if (!(record.score > 0)) continue
    const scores = byManga.get(record.mangaId) ?? []
    scores.push(record.score)
    byManga.set(record.mangaId, scores)
  }

  const perTitleMeans = [...byManga.values()].map(scores => scores.reduce((sum, score) => sum + score, 0) / scores.length)
  const meanScore = perTitleMeans.length ? perTitleMeans.reduce((sum, value) => sum + value, 0) / perTitleMeans.length : null

  return {
    trackers: {
      loggedInTrackerCount: loggedInIds.size,
      trackedTitleCount: byManga.size,
      meanScore,
    },
    restrictions: {
      excludeCompleted: data.settings?.excludeCompleted === true,
      excludeEntryWithUnreadChapters: data.settings?.excludeEntryWithUnreadChapters === true,
      excludeNotStarted: data.settings?.excludeNotStarted === true,
    },
  }
}
