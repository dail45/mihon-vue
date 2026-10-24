import { ofetch } from 'ofetch'
import { normalizeApiUrl } from './client'

/**
 * Category mutations against Suwayomi-Server.
 *
 * Contract taken from the pinned Suwayomi revision
 * e2ce828abb81f0f5ce1a3fb86194a2746b519c85:
 * - `delete("/api/v1/category/{categoryId}")` -> CategoryController.categoryDelete ->
 *   Category.removeCategory(userId, categoryId), responds with HTTP 200 and an empty body.
 *
 * Mihon performs the same operation locally (`DeleteCategory` use case,
 * mihon/app/src/main/java/eu/kanade/tachiyomi/ui/category/CategoryViewModel.kt:71-79) and
 * reports a failure with the `internal_error` message.
 *
 * The request is never retried: a delete is not idempotent from the caller's point of view and
 * the client must not silently repeat a mutation.
 */
export async function deleteCategory(apiUrl: string, categoryId: number): Promise<void> {
  const api = ofetch.create({
    baseURL: normalizeApiUrl(apiUrl),
    timeout: 15000,
    retry: 0,
    credentials: 'include',
  })
  await api(`/category/${categoryId}`, { method: 'DELETE' })
}
