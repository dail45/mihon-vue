import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import {
  bindTracker,
  listTrackers,
  loginTrackerCredentials,
  searchTracker,
  type Tracker,
  type TrackerSearchResult,
} from '@/core/api/trackers'

export function useTrackerSearch(options: {
  apiUrl: MaybeRefOrGetter<string>
  mangaId: MaybeRefOrGetter<number | null>
  trackerId: MaybeRefOrGetter<number | null>
  initialQuery?: string
  currentUrl?: string
}) {
  const query = ref(options.initialQuery ?? '')
  const queryResult = ref<{ ok: true; items: TrackerSearchResult[] } | { ok: false; message: string } | null>(null)
  const selected = ref<TrackerSearchResult | null>(null)
  const trackers = ref<Tracker[]>([])
  const errorMessage = ref('')
  const loggingIn = ref(false)
  const loginError = ref('')
  let job = 0

  const getApiUrl = () => toValue(options.apiUrl)
  const getMangaId = () => toValue(options.mangaId)
  const getTrackerId = () => toValue(options.trackerId)

  const tracker = computed(() => {
    const tid = getTrackerId()
    return trackers.value.find(t => t.id === tid) ?? null
  })

  const supportsPrivateTracking = computed(() => tracker.value?.supportsPrivateTracking ?? false)

  async function loadTrackers() {
    try {
      trackers.value = await listTrackers(getApiUrl())
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Unknown error'
    }
  }

  async function runSearch(text: string) {
    const trimmed = text.trim()
    const tid = getTrackerId()
    if (!trimmed || tid === null) {
      queryResult.value = null
      return
    }
    const current = ++job
    queryResult.value = null
    selected.value = null
    try {
      const items = await searchTracker(getApiUrl(), tid, trimmed)
      if (current !== job) return
      queryResult.value = { ok: true, items }
      const currentUrl = options.currentUrl ?? ''
      if (currentUrl) {
        selected.value = items.find(it => it.trackingUrl === currentUrl) ?? null
      }
    } catch (error) {
      if (current !== job) return
      queryResult.value = {
        ok: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async function bindSelected(isPrivate: boolean = false): Promise<boolean> {
    const tid = getTrackerId()
    const mid = getMangaId()
    if (!selected.value || tid === null || mid === null) {
      return false
    }
    errorMessage.value = ''
    try {
      await bindTracker(getApiUrl(), mid, tid, selected.value.remoteId, isPrivate)
      return true
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Unknown error'
      return false
    }
  }

  async function loginCredentials(user: string, pass: string): Promise<boolean> {
    const current = tracker.value
    if (!current || !user || !pass) return false
    loggingIn.value = true
    loginError.value = ''
    try {
      const ok = await loginTrackerCredentials(getApiUrl(), current.id, user, pass)
      if (ok) {
        await loadTrackers()
        await runSearch(query.value)
        return true
      }
      loginError.value = 'The tracker refused the login. Check the credentials.'
      return false
    } catch (error) {
      loginError.value = error instanceof Error ? error.message : 'Unknown error'
      return false
    } finally {
      loggingIn.value = false
    }
  }

  return {
    query,
    queryResult,
    selected,
    trackers,
    tracker,
    supportsPrivateTracking,
    errorMessage,
    loggingIn,
    loginError,
    loadTrackers,
    runSearch,
    bindSelected,
    loginCredentials,
  }
}
