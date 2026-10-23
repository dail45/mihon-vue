/** Suwayomi client for the "Clear database" screen.
 *
 * Mihon reference: mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/advanced/ClearDatabaseScreen.kt
 *   - `GetSourcesWithNonLibraryManga` (mihon/domain/.../source/interactor/GetSourcesWithNonLibraryManga.kt)
 *     reads `getSourceIdsWithNonLibraryManga()` from the local database and returns one
 *     `SourceWithCount(source, count)` per source that owns at least one non-library entry.
 *   - The local database has no counterpart in Suwayomi: the equivalent set is the server side
 *     manga that is NOT part of the library, which the GraphQL endpoint exposes through
 *     `mangas(condition: { inLibrary: false })`.
 *
 * Deleting those entries (and resetting the read history) is NOT possible against a Suwayomi
 * server: the REST v1 surface has no delete-manga route and the GraphQL mutation set contains
 * no `deleteManga`. The screen therefore renders the reference list read-only and reports the
 * limitation instead of pretending to delete anything.
 *
 * Headless REST/GraphQL client only: no scraping, no extension management, no local database.
 */
import { ofetch } from 'ofetch'
import { serverGraphqlUrl } from './serverSettings'

/** One source that owns at least one non-library entry, with the number of those entries. */
export interface SourceWithCount {
  /** Suwayomi source id (a 64-bit id transported as a string). */
  sourceId: string
  /** Number of non-library entries owned by this source. */
  count: number
}

interface GraphQLResponse<T> { data?: T; errors?: { message: string }[] }

const nonLibraryQuery = `query ClearDatabase($offset: Int!, $first: Int!) {
  mangas(condition: { inLibrary: false }, offset: $offset, first: $first) {
    totalCount
    nodes { id sourceId }
  }
}`

async function request<T>(apiUrl: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await ofetch<GraphQLResponse<T>>(serverGraphqlUrl(apiUrl), {
    method: 'POST',
    body: { query, variables },
    credentials: 'include',
    timeout: 20000,
    retry: 0,
  })
  if (response.errors?.length) throw new Error(response.errors.map(e => e.message).join(' '))
  if (!response.data) throw new Error('The server returned no data for the non-library entries.')
  return response.data
}

const PAGE_SIZE = 500

/**
 * Groups the non-library entries of the server by source.
 * Mihon sorts the result by the source name (`items.sortedBy { it.name }`).
 */
export async function fetchNonLibraryEntriesBySource(apiUrl: string): Promise<SourceWithCount[]> {
  const counts = new Map<string, number>()
  let offset = 0
  let total = Number.POSITIVE_INFINITY
  while (offset < total) {
    const data = await request<{
      mangas: { totalCount: number; nodes: { id: number; sourceId: string }[] }
    }>(apiUrl, nonLibraryQuery, { offset, first: PAGE_SIZE })
    const page = data.mangas
    total = page.totalCount
    for (const node of page.nodes) counts.set(node.sourceId, (counts.get(node.sourceId) ?? 0) + 1)
    if (!page.nodes.length) break
    offset += page.nodes.length
    if (offset >= total) break
  }
  return [...counts.entries()].map(([sourceId, count]) => ({ sourceId, count }))
}
