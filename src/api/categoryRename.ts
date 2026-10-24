/** Suwayomi GraphQL category client — renaming a category.
 *
 * The legacy REST v1 surface exposes only read endpoints for categories
 * (GET /category, GET /category/{id}), so a rename is only reachable through
 * the GraphQL endpoint (/api/graphql):
 *
 *   mutation UpdateCategory($input: UpdateCategoryInput!) {
 *     updateCategory(input: $input) { category { id name } }
 *   }
 *   variables: { input: { id: Int!, patch: { name: String! } } }
 *
 * Headless GraphQL client only: no scraping, no extension management.
 */
import { ofetch } from 'ofetch'
import { serverGraphqlUrl } from './serverSettings'
import type { GraphQLResponse } from './types'

const updateCategoryMutation = `mutation UpdateCategory($input: UpdateCategoryInput!) {
  updateCategory(input: $input) { category { id name } }
}`

/** Renames the category with the given id and returns the category confirmed by the server. */
export async function renameCategory(
  apiUrl: string,
  id: number,
  name: string,
): Promise<{ id: number; name: string }> {
  const response = await ofetch<GraphQLResponse<{ updateCategory: { category: { id: number; name: string } } }>>(
    serverGraphqlUrl(apiUrl),
    {
      method: 'POST',
      body: { query: updateCategoryMutation, variables: { input: { id, patch: { name } } } },
      credentials: 'include',
      timeout: 15000,
      retry: 0,
    },
  )
  if (response.errors?.length) throw new Error(response.errors.map(e => e.message).join(' '))
  const category = response.data?.updateCategory?.category
  if (!category) throw new Error('The server did not confirm the category rename.')
  if (category.name !== name) throw new Error('The server did not apply the requested category name.')
  return category
}
