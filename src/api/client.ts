import { ofetch } from 'ofetch'
import type { Category, Chapter, ChapterPatch, Manga, PagedMangaList, RecentChapters, Source } from './types'
export const DEFAULT_API_URL = import.meta.env.VITE_SUWAYOMI_API_URL || 'http://localhost:4567/api/v1'
export function normalizeApiUrl(value: string): string {
  const url = value.trim().replace(/\/+$/, '')
  if (url.startsWith('/') && !url.startsWith('//') && !/[?#]/.test(url)) return url
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error()
    return url
  } catch { throw new Error('Use an HTTP(S) API URL without credentials, query, or fragment; or a same-origin path like /api/v1.') }
}
export function createSuwayomiApi(baseURL: string) {
  const api = ofetch.create({ baseURL: normalizeApiUrl(baseURL), timeout: 15000, retry: 0, credentials: 'include' })
  return {
    recentChapters: (page = 0) => api<RecentChapters>(`/update/recentChapters/${page}`),
    categories: () => api<Category[]>('/category'),
    categoryManga: (id: number) => api<Manga[]>(`/category/${id}`),
    manga: (id: number, onlineFetch = false) => api<Manga>(`/manga/${id}/full`, { query: { onlineFetch } }),
    chapters: (id: number, onlineFetch = false) => api<Chapter[]>(`/manga/${id}/chapters`, { query: { onlineFetch } }),
    chapter: (mangaId: number, chapterIndex: number) => api<Chapter>(`/manga/${mangaId}/chapter/${chapterIndex}`),
    modifyChapter: (mangaId: number, chapterIndex: number, patch: ChapterPatch) => {
      const body = new URLSearchParams()
      for (const [key, value] of Object.entries(patch)) if (value !== undefined) body.set(key, String(value))
      return api<void>(`/manga/${mangaId}/chapter/${chapterIndex}`, { method: 'PATCH', body })
    },
    sources: () => api<Source[]>('/source/list'),
    sourceCatalogue: (sourceId: string, mode: 'popular' | 'latest' | 'search', page = 1, searchTerm = '') => {
      const source = encodeURIComponent(sourceId)
      return mode === 'search'
        ? api<PagedMangaList>(`/source/${source}/search`, { query: { searchTerm, pageNum: page } })
        : api<PagedMangaList>(`/source/${source}/${mode}/${page}`)
    },
    // Legacy REST v1 intentionally uses GET for add. Never retry this mutation.
    addToLibrary: (id: number) => api<void>(`/manga/${id}/library`, { method: 'GET' }),
    removeFromLibrary: (id: number) => api<void>(`/manga/${id}/library`, { method: 'DELETE' }),
  }
}
export function apiErrorMessage(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status === 401 || status === 403) return 'Suwayomi denied access. Sign in on your server or configure same-origin authentication.'
  if (status === 404) return 'This REST endpoint or manga was not found. Check the API URL and server version.'
  return status ? `Suwayomi returned HTTP ${status}. Try again or check the server logs.` : 'Cannot reach Suwayomi. Check the server address, CORS, and whether it is running.'
}
