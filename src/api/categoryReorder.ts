/** Suwayomi GraphQL category client — reordering categories.
 *
 * The legacy REST v1 surface exposes no reorder endpoint for categories
 * (`GET /api/v1/category/reorder` is not registered and answers 404), so the order is changed
 * through the GraphQL endpoint (/api/graphql):
 *
 *   mutation UpdateCategoryOrder($input: UpdateCategoryOrderInput!) {
 *     updateCategoryOrder(input: $input) { categories { id name order } }
 *   }
 *   variables: { input: { id: Int!, position: Int! } }
 *
 * `position` is 1-based and counted over the non-default categories, in the order the server
 * stores them (Suwayomi `Category.moveCategoryToPosition`,
 * server/src/main/kotlin/suwayomi/tachidesk/manga/impl/Category.kt). The server renumbers the
 * remaining categories and returns the whole ordered list.
 *
 * Headless GraphQL client only: no scraping, no extension management.
 */
import { ofetch } from 'ofetch'
import { serverGraphqlUrl } from './serverSettings'

export interface GraphQLResponse<T> {
  data?: T
  errors?: { message: string }[]
}

const updateCategoryOrderMutation = `mutation UpdateCategoryOrder($input: UpdateCategoryOrderInput!) {
  updateCategoryOrder(input: $input) { categories { id name order } }
}`

export interface OrderedCategory {
  id: number
  name: string
  order: number
}

/** Moves the category with the given id to the 1-based `position` and returns the new order. */
export async function reorderCategory(
  apiUrl: string,
  id: number,
  position: number,
): Promise<OrderedCategory[]> {
  const response = await ofetch<GraphQLResponse<{ updateCategoryOrder: { categories: OrderedCategory[] } }>>(
    serverGraphqlUrl(apiUrl),
    {
      method: 'POST',
      body: { query: updateCategoryOrderMutation, variables: { input: { id, position } } },
      credentials: 'include',
      timeout: 15000,
      retry: 0,
    },
  )
  if (response.errors?.length) throw new Error(response.errors.map(e => e.message).join(' '))
  const categories = response.data?.updateCategoryOrder?.categories
  if (!categories) throw new Error('The server did not confirm the new category order.')
  return categories
}
