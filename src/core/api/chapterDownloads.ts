import { ofetch } from 'ofetch'
import { normalizeApiUrl } from './client'
import { enqueueChapterDownload, startDownloader } from './downloads'
import { serverGraphqlUrl } from './serverSettings'
import type { GraphQLResponse } from './types'

/** Deletes the downloaded chapter (and its files) through REST v1.
 * Suwayomi route: DELETE /manga/{mangaId}/chapter/{chapterIndex}
 * (MangaController.chapterDelete -> Chapter.deleteChapter -> deleteDownloadedChapters).
 * The /download endpoints throw "Removed support for downloads in v1 REST API" and are unusable.
 */
export async function deleteChapterDownload(baseURL: string, mangaId: number, chapterIndex: number): Promise<void> {
  const api = ofetch.create({ baseURL: normalizeApiUrl(baseURL), timeout: 15000, retry: 0, credentials: 'include' })
  await api<void>(`/manga/${mangaId}/chapter/${chapterIndex}`, { method: 'DELETE' })
}

const enqueueChapterDownloadsMutation = `mutation EnqueueChapterDownloads($input: EnqueueChapterDownloadsInput!) {
  enqueueChapterDownloads(input: $input) {
    clientMutationId
  }
}`

/**
 * Enqueues a list of chapter IDs into the Suwayomi download queue.
 * Attempts native GraphQL batch mutation first; on failure, falls back to
 * sequential enqueueChapterDownload requests and starts the downloader.
 */
export async function enqueueChapterDownloadsBatch(apiUrl: string, chapterIds: number[]): Promise<number> {
  if (!chapterIds.length) return 0

  let batchSucceeded = false
  try {
    const response = await ofetch<GraphQLResponse<{ enqueueChapterDownloads?: { clientMutationId?: string } }>>(
      serverGraphqlUrl(apiUrl),
      {
        method: 'POST',
        body: {
          query: enqueueChapterDownloadsMutation,
          variables: { input: { ids: chapterIds } },
        },
        credentials: 'include',
        timeout: 15000,
        retry: 0,
      },
    )
    if (!response.errors?.length && response.data?.enqueueChapterDownloads) {
      batchSucceeded = true
    }
  } catch {
    batchSucceeded = false
  }

  if (!batchSucceeded) {
    for (const id of chapterIds) {
      await enqueueChapterDownload(apiUrl, id)
    }
  }

  try {
    await startDownloader(apiUrl)
  } catch {
    // Best effort downloader start
  }

  return chapterIds.length
}
