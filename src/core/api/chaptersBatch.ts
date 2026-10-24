/**
 * Suwayomi GraphQL chapters batch client.
 *
 * Utilizes Suwayomi-Server's native GraphQL batch mutation:
 *   mutation UpdateChapters($input: UpdateChaptersInput!) {
 *     updateChapters(input: $input) { chapters { id isRead lastPageRead } }
 *   }
 */
import { ofetch } from 'ofetch'
import { serverGraphqlUrl } from './serverSettings'
import type { GraphQLResponse } from './types'

export interface UpdateChaptersPatch {
  isRead?: boolean
  lastPageRead?: number
}

export interface ChapterProgressSyncItem {
  id: number
  index: number
  isRead?: boolean
  lastPageRead?: number
  bookmarked?: boolean
}

const updateChaptersMutation = `mutation UpdateChapters($input: UpdateChaptersInput!) {
  updateChapters(input: $input) {
    chapters {
      id
      isRead
      lastPageRead
    }
  }
}`

export async function updateChaptersBatch(
  apiUrl: string,
  ids: number[],
  patch: UpdateChaptersPatch,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!ids.length) return true
  try {
    const response = await ofetch<GraphQLResponse<{ updateChapters: { chapters: { id: number }[] } }>>(
      serverGraphqlUrl(apiUrl),
      {
        method: 'POST',
        body: { query: updateChaptersMutation, variables: { input: { ids, patch } } },
        credentials: 'include',
        timeout: 15000,
        retry: 0,
        signal,
      },
    )
    if (response.errors?.length) return false
    return !!response.data?.updateChapters
  } catch {
    return false
  }
}
