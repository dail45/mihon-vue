import { ofetch } from 'ofetch'
import { serverGraphqlUrl } from './serverSettings'

/**
 * Extension store count.
 *
 * Mihon `SettingsBrowseScreen` shows the number of configured extension stores as the subtitle of
 * the "Extension stores" preference (`pluralStringResource(MR.plurals.num_repos, reposCount)`),
 * where the count comes from the local extension store database.
 *
 * Suwayomi-Server has no REST endpoint for extension stores, but its GraphQL API exposes
 * `extensionStores { nodes { indexUrl } }` (read-only). The count of the server side stores is the
 * observable equivalent of Mihon's local count.
 */
export async function fetchExtensionStoreCount(apiUrl: string): Promise<number> {
  const response = await ofetch<{ data?: { extensionStores?: { nodes?: unknown[] } }; errors?: { message: string }[] }>(
    serverGraphqlUrl(apiUrl),
    {
      method: 'POST',
      body: { query: '{ extensionStores { nodes { indexUrl } } }' },
      credentials: 'include',
      timeout: 15000,
      retry: 0,
    },
  )
  if (response.errors?.length) throw new Error('The server refused to list the extension stores.')
  const nodes = response.data?.extensionStores?.nodes
  return Array.isArray(nodes) ? nodes.length : 0
}
