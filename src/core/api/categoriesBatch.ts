/**
 * Suwayomi GraphQL batch category mutation client.
 *
 * Utilizes Suwayomi-Server's native GraphQL batch category mutation:
 *   mutation UpdateMangasCategories($input: UpdateMangasCategoriesInput!) {
 *     updateMangasCategories(input: $input) { clientMutationId }
 *   }
 *
 * With automated fallback to per-manga GraphQL mutations if the host server
 * lacks the batch mutation endpoint.
 */
import { ofetch } from 'ofetch'
import { serverGraphqlUrl } from './serverSettings'
import type { GraphQLResponse } from './types'

export interface UpdateMangaCategoriesPatch {
  addToCategories?: number[]
  removeFromCategories?: number[]
  clearCategories?: boolean
}

export interface UpdateMangasCategoriesInput {
  ids: number[]
  patch: UpdateMangaCategoriesPatch
}

export interface UpdateMangaCategoriesInput {
  id: number
  patch: UpdateMangaCategoriesPatch
}

export interface UpdateMangaPatch {
  categories?: number[]
}

export interface UpdateMangaInput {
  id: number
  patch: UpdateMangaPatch
}

const updateMangasCategoriesMutation = `mutation UpdateMangasCategories($input: UpdateMangasCategoriesInput!) {
  updateMangasCategories(input: $input) {
    clientMutationId
  }
}`

const updateMangaCategoriesMutation = `mutation UpdateMangaCategories($input: UpdateMangaCategoriesInput!) {
  updateMangaCategories(input: $input) {
    clientMutationId
  }
}`

const updateMangaMutation = `mutation UpdateManga($input: UpdateMangaInput!) {
  updateManga(input: $input) {
    clientMutationId
  }
}`

/**
 * Executes a single GraphQL request against the Suwayomi server.
 */
async function graphqlRequest<T>(apiUrl: string, query: string, variables: Record<string, unknown>, signal?: AbortSignal): Promise<GraphQLResponse<T>> {
  return ofetch<GraphQLResponse<T>>(serverGraphqlUrl(apiUrl), {
    method: 'POST',
    body: { query, variables },
    credentials: 'include',
    timeout: 15000,
    retry: 0,
    signal,
  })
}

/**
 * Updates categories for a single manga via GraphQL.
 */
export async function updateMangaCategories(
  apiUrl: string,
  id: number,
  patch: UpdateMangaCategoriesPatch,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const response = await graphqlRequest<{ updateMangaCategories?: { clientMutationId?: string } }>(
      apiUrl,
      updateMangaCategoriesMutation,
      { input: { id, patch } },
      signal,
    )
    if (response.errors?.length) return false
    return !!response.data?.updateMangaCategories
  } catch {
    return false
  }
}

/**
 * Fallback update for servers that only accept full categories list via updateManga.
 */
export async function updateManga(
  apiUrl: string,
  id: number,
  patch: UpdateMangaPatch,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const response = await graphqlRequest<{ updateManga?: { clientMutationId?: string } }>(
      apiUrl,
      updateMangaMutation,
      { input: { id, patch } },
      signal,
    )
    if (response.errors?.length) return false
    return !!response.data?.updateManga
  } catch {
    return false
  }
}

/**
 * Batch-updates categories for multiple manga entries.
 * Attempts native batch mutation first; on failure, falls back to sequential single-item updates.
 */
export async function updateMangasCategoriesBatch(
  apiUrl: string,
  ids: number[],
  patch: UpdateMangaCategoriesPatch,
  currentCategoriesByManga?: Record<number, number[]>,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!ids.length) return true

  // Strategy 1: Attempt native GraphQL batch mutation
  try {
    const response = await graphqlRequest<{ updateMangasCategories?: { clientMutationId?: string } }>(
      apiUrl,
      updateMangasCategoriesMutation,
      { input: { ids, patch } },
      signal,
    )
    if (!response.errors?.length && response.data?.updateMangasCategories) {
      return true
    }
  } catch {
    // Continue to fallback
  }

  // Strategy 2: Fallback to per-manga updateMangaCategories or updateManga
  let allSucceeded = true
  for (const id of ids) {
    const singleSuccess = await updateMangaCategories(apiUrl, id, patch, signal)
    if (!singleSuccess) {
      // If updateMangaCategories is also unsupported, try updateManga with computed categories
      if (currentCategoriesByManga && currentCategoriesByManga[id]) {
        const current = new Set(currentCategoriesByManga[id])
        for (const addId of patch.addToCategories || []) current.add(addId)
        for (const remId of patch.removeFromCategories || []) current.delete(remId)
        const mangaSuccess = await updateManga(apiUrl, id, { categories: [...current] }, signal)
        if (!mangaSuccess) {
          allSucceeded = false
        }
      } else {
        allSucceeded = false
      }
    }
  }

  return allSucceeded
}

/**
 * Direct UpdateMangasCategories GraphQL mutation wrapper accepting UpdateMangasCategoriesInput.
 */
export async function updateMangasCategories(
  apiUrl: string,
  input: UpdateMangasCategoriesInput,
  signal?: AbortSignal,
): Promise<boolean> {
  return updateMangasCategoriesBatch(apiUrl, input.ids, input.patch, undefined, signal)
}
