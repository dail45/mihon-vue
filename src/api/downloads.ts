/** Suwayomi GraphQL download-queue client.
 * The legacy REST v1 surface has no download endpoints, so the queue is only
 * reachable through the GraphQL endpoint (/api/graphql). See docs/REFERENCES.md.
 * Headless REST/GraphQL client only: no scraping, no extension management.
 */
import { ofetch } from 'ofetch'
import { serverGraphqlUrl } from './serverSettings'

export type DownloadState = 'QUEUED' | 'DOWNLOADING' | 'FINISHED' | 'ERROR'
export type DownloaderState = 'STARTED' | 'STOPPED'

export interface DownloadQueueChapter {
  id: number
  name: string
  chapterNumber: number
  /** LongString scalar: milliseconds since epoch as text. */
  uploadDate: string
  pageCount: number
  mangaId: number
}

export interface DownloadQueueManga {
  id: number
  title: string
  sourceId: string
  sourceName: string
}

export interface DownloadQueueEntry {
  position: number
  /** Percent of the chapter already downloaded, 0..100. */
  progress: number
  state: DownloadState
  tries: number
  chapter: DownloadQueueChapter
  manga: DownloadQueueManga
}

/** Downloads of the queue that come from one source. */
export interface DownloadQueueSection {
  id: string
  name: string
  downloads: DownloadQueueEntry[]
}

export interface DownloadQueueSnapshot {
  state: DownloaderState
  queue: DownloadQueueEntry[]
  sections: DownloadQueueSection[]
}

const queueQuery = `query DownloadQueue {
  downloadStatus {
    state
    queue {
      position
      progress
      state
      tries
      chapter { id name chapterNumber uploadDate pageCount mangaId }
      manga { id title sourceId source { id name displayName } }
    }
  }
}`

interface GraphQLResponse<T> { data?: T; errors?: { message: string }[] }

async function request<T>(apiUrl: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await ofetch<GraphQLResponse<T>>(serverGraphqlUrl(apiUrl), {
    method: 'POST',
    body: { query, variables },
    credentials: 'include',
    timeout: 15000,
    retry: 0,
  })
  if (response.errors?.length) throw new Error(response.errors.map(e => e.message).join(' '))
  if (!response.data) throw new Error('The server returned no data for the download queue.')
  return response.data
}

function toSections(queue: DownloadQueueEntry[]): DownloadQueueSection[] {
  const sections: DownloadQueueSection[] = []
  for (const entry of queue) {
    const id = entry.manga.sourceId || 'unknown'
    let section = sections.find(s => s.id === id)
    if (!section) { section = { id, name: entry.manga.sourceName || id, downloads: [] }; sections.push(section) }
    section.downloads.push(entry)
  }
  return sections
}

export async function readDownloadQueue(apiUrl: string): Promise<DownloadQueueSnapshot> {
  const data = await request<{ downloadStatus: { state: DownloaderState; queue: DownloadQueueEntry[] } }>(apiUrl, queueQuery)
  const queue = [...(data.downloadStatus?.queue ?? [])].sort((a, b) => a.position - b.position)
  return { state: data.downloadStatus?.state ?? 'STOPPED', queue, sections: toSections(queue) }
}

export async function startDownloader(apiUrl: string) {
  await request(apiUrl, `mutation StartDownloader($input: StartDownloaderInput!) { startDownloader(input: $input) { clientMutationId } }`, { input: {} })
}

export async function stopDownloader(apiUrl: string) {
  await request(apiUrl, `mutation StopDownloader($input: StopDownloaderInput!) { stopDownloader(input: $input) { clientMutationId } }`, { input: {} })
}

export async function clearDownloader(apiUrl: string) {
  await request(apiUrl, `mutation ClearDownloader($input: ClearDownloaderInput!) { clearDownloader(input: $input) { clientMutationId } }`, { input: {} })
}

export async function dequeueChapterDownload(apiUrl: string, chapterId: number) {
  await request(apiUrl, `mutation DequeueChapterDownload($input: DequeueChapterDownloadInput!) { dequeueChapterDownload(input: $input) { clientMutationId } }`, { input: { id: chapterId } })
}

/** Queues one chapter for download. Suwayomi GraphQL: DownloadMutation.enqueueChapterDownload. */
export async function enqueueChapterDownload(apiUrl: string, chapterId: number) {
  await request(apiUrl, `mutation EnqueueChapterDownload($input: EnqueueChapterDownloadInput!) { enqueueChapterDownload(input: $input) { clientMutationId } }`, { input: { id: chapterId } })
}

/** Deletes the downloaded files of one chapter. Suwayomi GraphQL: DownloadMutation.deleteDownloadedChapter. */
export async function deleteDownloadedChapter(apiUrl: string, chapterId: number) {
  await request(apiUrl, `mutation DeleteDownloadedChapter($input: DeleteDownloadedChapterInput!) { deleteDownloadedChapter(input: $input) { clientMutationId } }`, { input: { id: chapterId } })
}

export async function dequeueChapterDownloads(apiUrl: string, ids: number[]) {
  if (!ids.length) return
  await request(apiUrl, `mutation DequeueChapterDownloads($input: DequeueChapterDownloadsInput!) { dequeueChapterDownloads(input: $input) { clientMutationId } }`, { input: { ids } })
}

/** Moves the given chapters to the given absolute queue positions. */
export async function reorderChapterDownloads(apiUrl: string, reorders: { chapterId: number; to: number }[]) {
  if (!reorders.length) return
  await request(apiUrl, `mutation ReorderChapterDownloads($input: ReorderChapterDownloadsInput!) { reorderChapterDownloads(input: $input) { clientMutationId } }`, { input: { reorders } })
}
