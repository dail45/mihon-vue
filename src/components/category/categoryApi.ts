import { ofetch } from 'ofetch'
import { normalizeApiUrl } from '../../api/client'
import type { Category } from '../../api/types'

/**
 * Category mutations for the "Edit categories" screen.
 *
 * Contracts come from Suwayomi-Server (pinned revision e2ce828a):
 *   POST   /category              form param `name`
 *   PATCH  /category/{id}         form param `name`
 *   DELETE /category/{id}
 *   PATCH  /category/reorder      form params `from` / `to` (1-based positions)
 *
 * The backend is a headless REST client: no scraping, no local database.
 */
export interface CategoryApi {
  list(): Promise<Category[]>
  create(name: string): Promise<void>
  rename(id: number, name: string): Promise<void>
  remove(id: number): Promise<void>
  reorder(from: number, to: number): Promise<void>
}

export function createCategoryApi(baseUrl: string): CategoryApi {
  const api = ofetch.create({
    baseURL: normalizeApiUrl(baseUrl),
    timeout: 15000,
    retry: 0,
    credentials: 'include',
  })
  return {
    list: () => api<Category[]>('/category'),
    create: (name: string) =>
      api('/category', { method: 'POST', body: new URLSearchParams({ name }) }),
    rename: (id: number, name: string) =>
      api(`/category/${id}`, { method: 'PATCH', body: new URLSearchParams({ name }) }),
    remove: (id: number) => api(`/category/${id}`, { method: 'DELETE' }),
    reorder: (from: number, to: number) =>
      api('/category/reorder', {
        method: 'PATCH',
        body: new URLSearchParams({ from: String(from), to: String(to) }),
      }),
  }
}
