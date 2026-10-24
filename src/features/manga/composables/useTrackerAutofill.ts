import { ref } from 'vue'
import {
  fetchMangaTrackRecords,
  listTrackers,
  searchTracker,
  trackerIconUrl,
  type Tracker,
  type TrackerRecord,
} from '@/core/api/trackers'

export interface ExtractedTrackerMetadata {
  title?: string
  thumbnailUrl?: string
  description?: string
  authors?: string
  artists?: string
  status?: number
  tags?: string[]
}

export interface BoundTrackerItem {
  record: TrackerRecord
  tracker: Tracker
}

async function fetchAnilistMetadata(
  remoteUrl?: string,
  searchTitle?: string,
): Promise<ExtractedTrackerMetadata | null> {
  let id: number | undefined
  if (remoteUrl) {
    const match = remoteUrl.match(/(?:manga|anime)\/(\d+)/i)
    if (match) id = Number.parseInt(match[1], 10)
  }

  const query = `
    query ($id: Int, $search: String) {
      Media(id: $id, search: $search, type: MANGA) {
        id
        title {
          userPreferred
          english
          romaji
          native
        }
        coverImage {
          extraLarge
          large
        }
        description(asHtml: false)
        status
        genres
        staff {
          edges {
            role
            node {
              name {
                userPreferred
              }
            }
          }
        }
      }
    }
  `

  const variables: Record<string, unknown> = {}
  if (id) variables.id = id
  else if (searchTitle) variables.search = searchTitle
  else return null

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    })
    if (!res.ok) return null
    const json = await res.json()
    const media = json.data?.Media
    if (!media) return null

    const title =
      media.title?.userPreferred ||
      media.title?.english ||
      media.title?.romaji ||
      media.title?.native
    const thumbnailUrl = media.coverImage?.extraLarge || media.coverImage?.large
    let description = media.description || ''
    if (description) {
      description = description
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim()
    }

    const staffEdges = media.staff?.edges || []
    const authorRoles = /story|author|writer|creator/i
    const artistRoles = /art|illustration|draw/i

    const authors = staffEdges
      .filter((e: any) => authorRoles.test(e.role || ''))
      .map((e: any) => e.node?.name?.userPreferred)
      .filter(Boolean)
      .join(', ')

    const artists = staffEdges
      .filter((e: any) => artistRoles.test(e.role || ''))
      .map((e: any) => e.node?.name?.userPreferred)
      .filter(Boolean)
      .join(', ')

    let status: number | undefined
    if (media.status === 'RELEASING') status = 1 // ONGOING
    else if (media.status === 'FINISHED') status = 2 // COMPLETED
    else if (media.status === 'CANCELLED') status = 5 // CANCELLED
    else if (media.status === 'HIATUS') status = 6 // ON_HIATUS

    return {
      title,
      thumbnailUrl,
      description,
      authors: authors || undefined,
      artists: artists || undefined,
      status,
      tags: media.genres || [],
    }
  } catch {
    return null
  }
}

async function fetchMalMetadata(remoteUrl?: string): Promise<ExtractedTrackerMetadata | null> {
  let id: number | undefined
  if (remoteUrl) {
    const match = remoteUrl.match(/manga\/(\d+)/i)
    if (match) id = Number.parseInt(match[1], 10)
  }
  if (!id) return null

  try {
    const res = await fetch(`https://api.jikan.moe/v4/manga/${id}`)
    if (!res.ok) return null
    const json = await res.json()
    const data = json.data
    if (!data) return null

    let status: number | undefined
    if (data.status === 'Publishing') status = 1
    else if (data.status === 'Finished') status = 2
    else if (data.status === 'On Hiatus') status = 6
    else if (data.status === 'Discontinued') status = 5

    const authors = (data.authors || []).map((a: any) => a.name).filter(Boolean).join(', ')
    const tags = (data.genres || []).map((g: any) => g.name).filter(Boolean)

    return {
      title: data.title || data.title_english,
      thumbnailUrl: data.images?.jpg?.large_image_url || data.images?.jpg?.image_url,
      description: data.synopsis || '',
      authors: authors || undefined,
      status,
      tags,
    }
  } catch {
    return null
  }
}

async function fetchKitsuMetadata(remoteUrl?: string): Promise<ExtractedTrackerMetadata | null> {
  let id: number | undefined
  if (remoteUrl) {
    const match = remoteUrl.match(/manga\/(\d+)/i)
    if (match) id = Number.parseInt(match[1], 10)
  }
  if (!id) return null

  try {
    const res = await fetch(`https://kitsu.io/api/edge/manga/${id}`)
    if (!res.ok) return null
    const json = await res.json()
    const attrs = json.data?.attributes
    if (!attrs) return null

    let status: number | undefined
    if (attrs.status === 'current') status = 1
    else if (attrs.status === 'finished') status = 2

    return {
      title: attrs.canonicalTitle,
      thumbnailUrl: attrs.posterImage?.original || attrs.posterImage?.large,
      description: attrs.synopsis || '',
      status,
    }
  } catch {
    return null
  }
}

async function fetchSuwayomiTrackerMetadata(
  apiUrl: string,
  trackerId: number,
  query: string,
): Promise<ExtractedTrackerMetadata | null> {
  if (!apiUrl || !trackerId || !query) return null
  try {
    const results = await searchTracker(apiUrl, trackerId, query)
    if (!results || results.length === 0) return null
    const first = results[0]
    return {
      title: first.title,
      thumbnailUrl: first.coverUrl,
      description: first.summary,
      authors: first.authors?.join(', '),
      artists: first.artists?.join(', '),
      status: first.status || undefined,
    }
  } catch {
    return null
  }
}

export async function fetchTrackerMetadata(
  apiUrl: string,
  tracker: Tracker,
  record: TrackerRecord,
  mangaTitle?: string,
): Promise<ExtractedTrackerMetadata | null> {
  const trackerName = tracker.name?.toLowerCase() || ''

  // 1. Service specific direct APIs
  if (tracker.id === 2 || trackerName.includes('anilist')) {
    const res = await fetchAnilistMetadata(record.remoteUrl, record.title || mangaTitle)
    if (res) return res
  } else if (tracker.id === 1 || trackerName.includes('myanimelist')) {
    const res = await fetchMalMetadata(record.remoteUrl)
    if (res) return res
  } else if (tracker.id === 3 || trackerName.includes('kitsu')) {
    const res = await fetchKitsuMetadata(record.remoteUrl)
    if (res) return res
  }

  // 2. Generic backend tracker search fallback
  const query = record.title || mangaTitle || ''
  if (apiUrl && query) {
    const res = await fetchSuwayomiTrackerMetadata(apiUrl, tracker.id, query)
    if (res) return res
  }

  return null
}

export function useTrackerAutofill() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function getBoundTrackers(
    apiUrl: string,
    mangaId: number,
  ): Promise<BoundTrackerItem[]> {
    if (!apiUrl || !mangaId) return []
    try {
      const [records, trackers] = await Promise.all([
        fetchMangaTrackRecords(apiUrl, mangaId),
        listTrackers(apiUrl),
      ])

      const result: BoundTrackerItem[] = []
      for (const rec of records) {
        const found = trackers.find(t => t.id === rec.trackerId)
        if (found) {
          result.push({ record: rec, tracker: found })
        } else {
          result.push({
            record: rec,
            tracker: {
              id: rec.trackerId,
              name: `Tracker ${rec.trackerId}`,
              icon: '',
              isLoggedIn: true,
              authUrl: null,
              supportsPrivateTracking: false,
              supportsReadingDates: false,
              statuses: [],
              scores: [],
              supportsTrackDeletion: false,
            },
          })
        }
      }
      return result
    } catch (e: any) {
      error.value = e?.message || 'Failed to fetch bound trackers'
      return []
    }
  }

  return {
    loading,
    error,
    getBoundTrackers,
    fetchTrackerMetadata,
    trackerIconUrl,
  }
}
