import { ofetch } from 'ofetch'
import { normalizeApiUrl } from './client'

/** Deletes the downloaded chapter (and its files) through REST v1.
 * Suwayomi route: DELETE /manga/{mangaId}/chapter/{chapterIndex}
 * (MangaController.chapterDelete -> Chapter.deleteChapter -> deleteDownloadedChapters).
 * The /download endpoints throw "Removed support for downloads in v1 REST API" and are unusable.
 */
export async function deleteChapterDownload(baseURL: string, mangaId: number, chapterIndex: number): Promise<void> {
  const api = ofetch.create({ baseURL: normalizeApiUrl(baseURL), timeout: 15000, retry: 0, credentials: 'include' })
  await api<void>(`/manga/${mangaId}/chapter/${chapterIndex}`, { method: 'DELETE' })
}
