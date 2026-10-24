import { onBeforeUnmount, ref, toValue, type MaybeRefOrGetter } from 'vue'
import {
  deleteDownloadedChapter,
  dequeueChapterDownload,
  enqueueChapterDownload,
  readDownloadQueue,
  startDownloader,
} from '../api/downloads'
import type { DownloadAction } from '../components/DownloadDropdownMenu.vue'

export interface ChapterDownloadInfo {
  state: 'not-downloaded' | 'queue' | 'downloading' | 'downloaded' | 'error'
  progress: number
}

function queueState(state: string): ChapterDownloadInfo['state'] {
  if (state === 'DOWNLOADING') return 'downloading'
  if (state === 'QUEUED') return 'queue'
  if (state === 'ERROR') return 'error'
  if (state === 'FINISHED') return 'downloaded'
  return 'downloaded'
}

function normalizeDownloadProgress(progress: number | undefined): number {
  if (typeof progress !== 'number' || !Number.isFinite(progress) || progress <= 0) return 0
  if (progress <= 1) return Math.round(progress * 100)
  return Math.min(100, Math.round(progress))
}

export function useMangaDownloads(options: {
  apiUrl: MaybeRefOrGetter<string>
  mangaId: MaybeRefOrGetter<number | null>
  updateChapterByIdLocally?: (chapterId: number, patch: { downloaded: boolean }) => void
  onMangaReloadNeeded?: () => Promise<void> | void
  notify: (msg: string) => void
}) {
  const downloadInfos = ref<Record<number, ChapterDownloadInfo>>({})
  let downloadPoll: number | undefined
  let currentPollInterval = 3000
  const cancelledChapterIds = new Set<number>()

  const getApiUrl = () => toValue(options.apiUrl)
  const getMangaId = () => toValue(options.mangaId)

  function adjustPollingInterval(ms: number) {
    if (currentPollInterval === ms && downloadPoll !== undefined) return
    currentPollInterval = ms
    if (downloadPoll !== undefined) {
      window.clearInterval(downloadPoll)
    }
    downloadPoll = window.setInterval(() => { void refreshDownloadInfos() }, ms)
  }

  async function refreshDownloadInfos() {
    const mangaId = getMangaId()
    const apiUrl = getApiUrl()
    if (!mangaId || !apiUrl) return

    try {
      const snapshot = await readDownloadQueue(apiUrl)
      const next: Record<number, ChapterDownloadInfo> = {}
      const inQueue = new Set<number>()

      for (const entry of snapshot.queue) {
        if (entry.manga.id !== mangaId) continue
        const chapterId = entry.chapter.id
        inQueue.add(chapterId)
        next[chapterId] = {
          state: queueState(entry.state),
          progress: normalizeDownloadProgress(entry.progress),
        }
      }

      for (const [idStr, prevInfo] of Object.entries(downloadInfos.value)) {
        const chapterId = Number(idStr)
        if (prevInfo.state === 'downloading' || prevInfo.state === 'queue') {
          if (!inQueue.has(chapterId)) {
            if (cancelledChapterIds.has(chapterId)) {
              cancelledChapterIds.delete(chapterId)
              next[chapterId] = { state: 'not-downloaded', progress: 0 }
              options.updateChapterByIdLocally?.(chapterId, { downloaded: false })
            } else {
              next[chapterId] = { state: 'downloaded', progress: 100 }
              options.updateChapterByIdLocally?.(chapterId, { downloaded: true })
            }
          }
        } else if (prevInfo.state === 'downloaded' && !next[chapterId]) {
          next[chapterId] = prevInfo
        }
      }

      downloadInfos.value = next

      const hasActiveDownloads = Object.values(next).some(
        info => info.state === 'downloading' || info.state === 'queue',
      )
      adjustPollingInterval(hasActiveDownloads ? 1000 : 4000)
    } catch {
      // queue stays
    }
  }

  function startDownloadPolling() {
    if (downloadPoll !== undefined) window.clearInterval(downloadPoll)
    currentPollInterval = 3000
    void refreshDownloadInfos()
    downloadPoll = window.setInterval(() => { void refreshDownloadInfos() }, currentPollInterval)
  }

  function stopDownloadPolling() {
    if (downloadPoll !== undefined) {
      window.clearInterval(downloadPoll)
      downloadPoll = undefined
    }
  }

  onBeforeUnmount(stopDownloadPolling)

  function downloadInfo(chapter: { id: number; downloaded: boolean }): ChapterDownloadInfo {
    const info = downloadInfos.value[chapter.id]
    if (info) return info
    return {
      state: chapter.downloaded ? 'downloaded' : 'not-downloaded',
      progress: chapter.downloaded ? 100 : 0,
    }
  }

  async function onDownload(action: DownloadAction, orderedChapters: Array<{ id: number; read: boolean; bookmarked: boolean }>) {
    if (!orderedChapters.length) return
    const next = orderedChapters.filter(c => !c.read)
    let targets: typeof orderedChapters = []
    if (action === 'NEXT_1_CHAPTER') targets = next.slice(0, 1)
    else if (action === 'NEXT_5_CHAPTERS') targets = next.slice(0, 5)
    else if (action === 'NEXT_10_CHAPTERS') targets = next.slice(0, 10)
    else if (action === 'NEXT_25_CHAPTERS') targets = next.slice(0, 25)
    else if (action === 'UNREAD_CHAPTERS') targets = next
    else if (action === 'BOOKMARKED_CHAPTERS') targets = orderedChapters.filter(c => c.bookmarked)

    if (!targets.length) {
      options.notify('No chapters match this download action.')
      return
    }

    const apiUrl = getApiUrl()
    for (const chapter of targets) {
      cancelledChapterIds.delete(chapter.id)
      downloadInfos.value[chapter.id] = { state: 'queue', progress: 0 }
    }

    try {
      for (const chapter of targets) await enqueueChapterDownload(apiUrl, chapter.id)
      await startDownloader(apiUrl)
      options.notify(`${targets.length} chapter${targets.length === 1 ? '' : 's'} queued for download.`)
      await refreshDownloadInfos()
    } catch (error) {
      options.notify(error instanceof Error ? error.message : 'The server rejected the request.')
    }
  }

  async function onDownloadAction(chapter: { id: number; name?: string }, action: string) {
    const apiUrl = getApiUrl()
    try {
      if (action === 'start' || action === 'start-now') {
        cancelledChapterIds.delete(chapter.id)
        downloadInfos.value[chapter.id] = { state: 'queue', progress: 0 }
        await enqueueChapterDownload(apiUrl, chapter.id)
        await startDownloader(apiUrl)
      } else if (action === 'cancel') {
        cancelledChapterIds.add(chapter.id)
        downloadInfos.value[chapter.id] = { state: 'not-downloaded', progress: 0 }
        await dequeueChapterDownload(apiUrl, chapter.id)
      } else if (action === 'delete') {
        options.updateChapterByIdLocally?.(chapter.id, { downloaded: false })
        downloadInfos.value[chapter.id] = { state: 'not-downloaded', progress: 0 }
        await deleteDownloadedChapter(apiUrl, chapter.id)
        await options.onMangaReloadNeeded?.()
      }
      await refreshDownloadInfos()
      options.notify(
        action === 'delete'
          ? `${chapter.name ?? 'Chapter'} deleted`
          : action === 'cancel'
            ? 'Download cancelled'
            : 'Chapter queued for download',
      )
    } catch (error) {
      options.notify(error instanceof Error ? error.message : 'The server rejected the request.')
    }
  }

  return {
    downloadInfos,
    downloadInfo,
    onDownload,
    onDownloadAction,
    refreshDownloadInfos,
    startDownloadPolling,
    stopDownloadPolling,
  }
}
