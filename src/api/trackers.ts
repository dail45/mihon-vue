/** Suwayomi tracker client (headless REST/GraphQL client only).
 *
 * The tracker surface of Suwayomi-Server is only reachable through the
 * GraphQL endpoint (/api/graphql); the legacy REST v1 surface exposes the
 * tracker list, the login/logout calls and the bind call, but the *search*
 * endpoint requires a logged-in tracker and is not exposed over REST in the
 * pinned revision (e2ce828abb81f0f5ce1a3fb86194a2746b519c85).
 *
 * See docs/REFERENCES.md. No tokens are stored here.
 */
import { ofetch } from 'ofetch'
import { serverGraphqlUrl } from './serverSettings'
import type { GraphQLResponse } from './types'

/** One status option of a tracker, e.g. `{ name: 'Reading', value: 1 }`. */
export interface TrackerStatus {
  name: string
  value: number
}

export interface Tracker {
  id: number
  name: string
  icon: string
  isLoggedIn: boolean
  authUrl: string | null
  supportsPrivateTracking: boolean
  supportsReadingDates: boolean
  /** Status list of the tracker (Suwayomi `TrackerType.statuses`). */
  statuses: TrackerStatus[]
  /** Score labels of the tracker (Suwayomi `TrackerType.scores`), empty when it has none. */
  scores: string[]
  /** True when the entry can also be deleted on the tracker service itself. */
  supportsTrackDeletion: boolean
}

/** One tracking record of a manga (Suwayomi `TrackRecordType`). */
export interface TrackerRecord {
  id: number
  trackerId: number
  title: string
  status: number
  score: number
  displayScore: string
  lastChapterRead: number
  totalChapters: number
  /** Epoch milliseconds as a decimal string, `0` when unset. */
  startDate: string
  finishDate: string
  private: boolean
  remoteUrl: string
}

/** One search result of a tracker, mirroring Suwayomi's `TrackSearchType`. */
export interface TrackerSearchResult {
  id: number
  trackerId: number
  remoteId: number
  libraryId: number | null
  title: string
  lastChapterRead: number
  totalChapters: number
  trackingUrl: string
  coverUrl: string
  summary: string
  publishingStatus: string
  publishingType: string
  startDate: string
  status: number
  score: number
  private: boolean
  authors?: string[]
  artists?: string[]
}


async function request<T>(apiUrl: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await ofetch<GraphQLResponse<T>>(serverGraphqlUrl(apiUrl), {
    method: 'POST',
    body: { query, variables },
    credentials: 'include',
    timeout: 20000,
    retry: 0,
  })
  if (response.errors?.length) throw new Error(response.errors.map(e => e.message).join(' '))
  if (!response.data) throw new Error('The server returned no data for the tracker request.')
  return response.data
}

const trackerFields = `id name icon isLoggedIn authUrl supportsPrivateTracking supportsReadingDates supportsTrackDeletion statuses { name value } scores`

/** Mihon: `TrackerManager.getTrackerList()` – every tracker known to the server. */
export async function listTrackers(apiUrl: string): Promise<Tracker[]> {
  const data = await request<{ trackers: { nodes: Tracker[] } }>(
    apiUrl,
    `query Trackers { trackers { nodes { ${trackerFields} } } }`,
  )
  return data.trackers?.nodes ?? []
}

const recordFields = `id trackerId title status score displayScore lastChapterRead totalChapters startDate finishDate private remoteUrl`

/** Mihon: `getTracks.subscribe(mangaId)` – the tracking records of one manga. */
export async function fetchMangaTrackRecords(apiUrl: string, mangaId: number): Promise<TrackerRecord[]> {
  const data = await request<{ manga: { trackRecords: { nodes: TrackerRecord[] } } }>(
    apiUrl,
    `query MangaTrackRecords($id: Int!) { manga(id: $id) { id trackRecords { nodes { ${recordFields} } } } }`,
    { id: mangaId },
  )
  return data.manga?.trackRecords?.nodes ?? []
}

export interface UpdateTrackPayload {
  recordId: number
  status?: number
  scoreString?: string
  lastChapterRead?: number
  /** Epoch milliseconds. */
  startDate?: number
  /** Epoch milliseconds. */
  finishDate?: number
  private?: boolean
}

/** Mihon: `track.setStatus` / `setScore` / `setLastChapterRead` – updates one record. */
export async function updateTrackerRecord(apiUrl: string, payload: UpdateTrackPayload): Promise<void> {
  const input: Record<string, unknown> = { recordId: payload.recordId }
  if (payload.status !== undefined) input.status = payload.status
  if (payload.scoreString !== undefined) input.scoreString = payload.scoreString
  if (payload.lastChapterRead !== undefined) input.lastChapterRead = payload.lastChapterRead
  if (payload.startDate !== undefined) input.startDate = String(payload.startDate)
  if (payload.finishDate !== undefined) input.finishDate = String(payload.finishDate)
  if (payload.private !== undefined) input.private = payload.private
  await request(
    apiUrl,
    `mutation UpdateTrack($input: UpdateTrackInput!) { updateTrack(input: $input) { clientMutationId } }`,
    { input },
  )
}

/** Mihon: `track.delete` / the "Remove" entry of the item menu. */
export async function unbindTrackerRecord(apiUrl: string, recordId: number, deleteRemoteTrack = false): Promise<void> {
  await request(
    apiUrl,
    `mutation UnbindTrack($input: UnbindTrackInput!) { unbindTrack(input: $input) { clientMutationId } }`,
    { input: { recordId, deleteRemoteTrack } },
  )
}

const searchFields = `id trackerId remoteId libraryId title lastChapterRead totalChapters trackingUrl coverUrl summary publishingStatus publishingType startDate status score private`

/** Mihon: `TrackerSearchViewModel.trackingSearch(query)` – the tracker search. */
export async function searchTracker(apiUrl: string, trackerId: number, query: string): Promise<TrackerSearchResult[]> {
  const data = await request<{ searchTracker: { trackSearches: TrackerSearchResult[] } }>(
    apiUrl,
    `query SearchTracker($input: SearchTrackerInput!) { searchTracker(input: $input) { trackSearches { ${searchFields} } } }`,
    { input: { trackerId, query } },
  )
  return data.searchTracker?.trackSearches ?? []
}

/** Mihon: `registerTracking(track)` – binds the remote entry to the local manga. */
export async function bindTracker(
  apiUrl: string,
  mangaId: number,
  trackerId: number,
  remoteId: number,
  isPrivate: boolean,
): Promise<void> {
  await request(
    apiUrl,
    `mutation BindTrack($input: BindTrackInput!) { bindTrack(input: $input) { trackRecord { id } } }`,
    { input: { mangaId, trackerId, remoteId, private: isPrivate } },
  )
}

/** Mihon: `loginTracker` with a user name and a password. */
export async function loginTrackerCredentials(apiUrl: string, trackerId: number, username: string, password: string): Promise<boolean> {
  const data = await request<{ loginTrackerCredentials: { isLoggedIn: boolean } }>(
    apiUrl,
    `mutation LoginTrackerCredentials($input: LoginTrackerCredentialsInput!) { loginTrackerCredentials(input: $input) { isLoggedIn } }`,
    { input: { trackerId, username, password } },
  )
  return data.loginTrackerCredentials?.isLoggedIn ?? false
}

/** Mihon: `logoutTracker`. */
export async function logoutTracker(apiUrl: string, trackerId: number): Promise<boolean> {
  const data = await request<{ logoutTracker: { isLoggedIn: boolean } }>(
    apiUrl,
    `mutation LogoutTracker($input: LogoutTrackerInput!) { logoutTracker(input: $input) { isLoggedIn } }`,
    { input: { trackerId } },
  )
  return data.logoutTracker?.isLoggedIn ?? true
}

/** The absolute URL of a tracker icon (Suwayomi serves them under /api/v1/track/{id}/thumbnail). */
export function trackerIconUrl(apiUrl: string, tracker: Tracker): string {
  if (!tracker.icon) return ''
  if (/^https?:\/\//i.test(tracker.icon)) return tracker.icon
  const base = apiUrl.replace(/\/api\/v1\/?$/, '')
  return `${base}${tracker.icon.startsWith('/') ? '' : '/'}${tracker.icon}`
}
