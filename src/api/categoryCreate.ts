import { ofetch } from 'ofetch'
import { normalizeApiUrl } from './client'

/**
 * Creates a category in Suwayomi-Server.
 *
 * Contract taken from the pinned Suwayomi revision
 * e2ce828abb81f0f5ce1a3fb86194a2746b519c85
 * (server/src/main/kotlin/suwayomi/tachidesk/manga/MangaAPI.kt and
 * server/src/main/kotlin/suwayomi/tachidesk/manga/controller/CategoryController.kt):
 *
 * - `post("/api/v1/category")` -> `CategoryController.categoryCreate` ->
 *   `Category.createCategory(userId, name)`. The handler reads the field with
 *   `formParam<String>("name")`, so the body must be `application/x-www-form-urlencoded`.
 *   The server answers with HTTP 200 when the category was created and with
 *   HTTP 400 (BAD_REQUEST) when it refused the name.
 *
 * Mihon performs the same operation locally (`CreateCategoryWithName` use case,
 * mihon/domain/src/main/java/tachiyomi/domain/category/interactor/CreateCategoryWithName.kt) and
 * reports a failure with the `internal_error` message.
 *
 * The request is never retried: a create is not idempotent from the caller's point of view and
 * the client must not silently repeat a mutation.
 */
export async function createCategory(apiUrl: string, name: string): Promise<void> {
  const api = ofetch.create({
    baseURL: normalizeApiUrl(apiUrl),
    timeout: 15000,
    retry: 0,
    credentials: 'include',
  })
  const body = new URLSearchParams()
  body.set('name', name)
  // URLSearchParams is not JSON serializable, so ofetch forwards it untouched and the browser
  // sends it as application/x-www-form-urlencoded, which is what the server formParam reads.
  await api('/category', { method: 'POST', body })
}
