import { computed, ref } from 'vue'
import {
  clearDownloader,
  dequeueChapterDownloads,
  readDownloadQueue,
  reorderChapterDownloads,
  startDownloader,
  stopDownloader,
  type DownloadQueueEntry,
  type DownloaderState,
} from '../api/downloads'

/** Downloads of the queue that come from one source. */
export interface DownloadQueueSection {
  id: string
  name: string
  downloads: DownloadQueueEntry[]
}

export type QueueSort = 'upload-newest' | 'upload-oldest' | 'chapter-asc' | 'chapter-desc'

function groupBySource(entries: DownloadQueueEntry[]): DownloadQueueSection[] {
  const sections: DownloadQueueSection[] = []
  for (const entry of entries) {
    const id = entry.manga.sourceId || 'unknown'
    let section = sections.find(s => s.id === id)
    if (!section) { section = { id, name: entry.manga.sourceName || id, downloads: [] }; sections.push(section) }
    section.downloads.push(entry)
  }
  return sections
}

/**
 * Download queue state for the download queue screen.
 * The Suwayomi REST v1 surface has no download endpoints, so the queue is only
 * reachable through the GraphQL endpoint. Progress is polled because the
 * GraphQL subscription needs a websocket transport the web client does not ship.
 */
export function useDownloadQueue(apiUrl: string) {
  const entries = ref<DownloadQueueEntry[]>([])
  const downloaderState = ref<DownloaderState>('STOPPED')
  const loading = ref(false)
  const error = ref<string | null>(null)
  const notice = ref<string | null>(null)
  let timer: number | undefined
  let generation = 0

  const sections = computed<DownloadQueueSection[]>(() => groupBySource(entries.value))
  const downloadCount = computed(() => entries.value.length)
  const isRunning = computed(() => downloaderState.value === 'STARTED')

  async function refresh() {
    const request = ++generation
    loading.value = true
    try {
      const snapshot = await readDownloadQueue(apiUrl)
      if (request !== generation) return
      entries.value = snapshot.queue
      downloaderState.value = snapshot.state
      error.value = null
    } catch (e) {
      if (request === generation) error.value = e instanceof Error ? e.message : 'The download queue could not be loaded.'
    } finally {
      if (request === generation) loading.value = false
    }
  }

  function poll() {
    if (timer !== undefined) window.clearInterval(timer)
    timer = window.setInterval(() => { void refresh() }, 3000)
  }

  async function mutate(action: () => Promise<void>, message: string) {
    try {
      await action()
      error.value = null
      notice.value = message
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'The server rejected the request.'
    } finally {
      await refresh()
    }
  }

  function start() { return mutate(() => startDownloader(apiUrl), 'Downloader started.') }
  function pause() { return mutate(() => stopDownloader(apiUrl), 'Downloader paused.') }
  function clear() { return mutate(() => clearDownloader(apiUrl), 'Queue cleared.') }

  /** Persists a new absolute order of the whole queue. */
  async function applyOrder(order: DownloadQueueEntry[]) {
    const reorders = order.map((entry, index) => ({ chapterId: entry.chapter.id, to: index }))
    entries.value = order
    await mutate(() => reorderChapterDownloads(apiUrl, reorders), 'Queue reordered.')
  }

  function sectionOf(entry: DownloadQueueEntry): DownloadQueueSection | undefined {
    return sections.value.find(s => s.downloads.some(d => d.chapter.id === entry.chapter.id))
  }

  /** Moves a download to the top or the bottom of its own section. */
  function move(download: DownloadQueueEntry, toTop: boolean) {
    const index = entries.value.findIndex(e => e.chapter.id === download.chapter.id)
    if (index < 0) return
    const section = sectionOf(download)
    if (!section) return
    const without = entries.value.filter(e => e.chapter.id !== download.chapter.id)
    const siblings = without.filter(e => section.downloads.some(d => d.chapter.id === e.chapter.id))
    if (!siblings.length) return
    const anchor = toTop ? siblings[0]! : siblings[siblings.length - 1]!
    const at = without.indexOf(anchor)
    without.splice(toTop ? at : at + 1, 0, download)
    void applyOrder(without)
  }

  /** Moves every download of the same manga to the top or bottom of the queue. */
  function moveSeries(download: DownloadQueueEntry, toTop: boolean) {
    const series = entries.value.filter(e => e.manga.id === download.manga.id)
    if (!series.length) return
    const others = entries.value.filter(e => e.manga.id !== download.manga.id)
    void applyOrder(toTop ? [...series, ...others] : [...others, ...series])
  }

  /** Sorts the downloads of every section, like DownloadQueueViewModel.reorderQueue. */
  function sortQueue(sort: QueueSort) {
    const order: DownloadQueueEntry[] = []
    for (const section of sections.value) {
      const sorted = [...section.downloads].sort((a, b) => {
        if (sort === 'upload-newest' || sort === 'upload-oldest') {
          const diff = Number(a.chapter.uploadDate || 0) - Number(b.chapter.uploadDate || 0)
          return sort === 'upload-newest' ? -diff : diff
        }
        const diff = (a.chapter.chapterNumber || 0) - (b.chapter.chapterNumber || 0)
        return sort === 'chapter-desc' ? -diff : diff
      })
      order.push(...sorted)
    }
    void applyOrder(order)
  }

  function cancel(download: DownloadQueueEntry) {
    void mutate(() => dequeueChapterDownloads(apiUrl, [download.chapter.id]), 'Download cancelled.')
  }

  function cancelSeries(download: DownloadQueueEntry) {
    const ids = entries.value.filter(e => e.manga.id === download.manga.id).map(e => e.chapter.id)
    if (!ids.length) return
    void mutate(() => dequeueChapterDownloads(apiUrl, ids), 'Downloads cancelled for this series.')
  }

  /** Reorders one download inside its own section (drag and drop). */
  function reorderWithinSection(download: DownloadQueueEntry, targetId: number) {
    const section = sectionOf(download)
    if (!section) return
    const list = [...section.downloads]
    const from = list.findIndex(d => d.chapter.id === download.chapter.id)
    const to = list.findIndex(d => d.chapter.id === targetId)
    if (from < 0 || to < 0 || from === to) return
    const [moved] = list.splice(from, 1)
    list.splice(to, 0, moved!)
    const order: DownloadQueueEntry[] = []
    for (const s of sections.value) order.push(...(s.id === section.id ? list : s.downloads))
    void applyOrder(order)
  }

  /** Reorders whole sections (drag and drop on a section header). */
  function reorderSection(sectionId: string, targetId: string) {
    if (sectionId === targetId) return
    const list = [...sections.value]
    const from = list.findIndex(s => s.id === sectionId)
    const to = list.findIndex(s => s.id === targetId)
    if (from < 0 || to < 0) return
    const [moved] = list.splice(from, 1)
    list.splice(to, 0, moved!)
    void applyOrder(list.flatMap(s => s.downloads))
  }

  function dispose() {
    generation++
    if (timer !== undefined) window.clearInterval(timer)
    timer = undefined
  }

  return {
    entries, sections, downloadCount, isRunning, downloaderState,
    loading, error, notice,
    refresh, poll, start, pause, clear, move, moveSeries, cancel, cancelSeries,
    sortQueue, reorderWithinSection, reorderSection, dispose,
  }
}
