import { ofetch } from 'ofetch'
import { normalizeApiUrl } from './client'
import type { Category, Manga } from './types'

export interface UpdateSummary {
  running: boolean
  categoryStatusMap?: Record<string, Category[]>
  mangaStatusMap?: Record<'COMPLETE' | 'FAILED' | 'SKIPPED' | string, Manga[]>
}

/**
 * Triggers a library update on the Suwayomi server.
 * Calls POST /update/fetch with optional ?category={categoryId}.
 * Returns true if the HTTP response status is 200 or 204.
 */
export async function triggerLibraryUpdate(apiUrl: string, categoryId?: number | null): Promise<boolean> {
  const query = categoryId != null ? `?category=${categoryId}` : ''
  const url = `${normalizeApiUrl(apiUrl)}/update/fetch${query}`
  try {
    if (typeof ofetch.raw === 'function') {
      const res = await ofetch.raw(url, {
        method: 'POST',
        credentials: 'include',
        timeout: 15000,
        retry: 0,
      })
      return res.status === 200 || res.status === 204
    }
    await ofetch(url, {
      method: 'POST',
      credentials: 'include',
      timeout: 15000,
      retry: 0,
    })
    return true
  } catch {
    return false
  }
}

/**
 * Retrieves the current update summary status from the Suwayomi server.
 * Calls GET /update/summary.
 */
export async function getUpdateSummary(apiUrl: string): Promise<UpdateSummary> {
  const url = `${normalizeApiUrl(apiUrl)}/update/summary`
  if (typeof ofetch.raw === 'function') {
    const res = await ofetch.raw<UpdateSummary>(url, {
      method: 'GET',
      credentials: 'include',
      timeout: 15000,
      retry: 0,
    })
    return res._data as UpdateSummary
  }
  return ofetch<UpdateSummary>(url, {
    method: 'GET',
    credentials: 'include',
    timeout: 15000,
    retry: 0,
  })
}
