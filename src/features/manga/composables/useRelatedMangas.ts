import { computed, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { ofetch } from 'ofetch'
import type { Manga } from '@/core/api/types'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'

export interface RelatedMangaItem {
  id: string | number
  title: string
  coverUrl?: string
  mangaId?: number | null
  inLibrary: boolean
  description?: string
  score?: number | null
  genres?: string[]
  relationType?: string | null
  group: 'relation' | 'recommendation' | 'library'
}

export interface RelatedMangaGroup {
  key: string
  title: string
  items: RelatedMangaItem[]
}

const cache = new Map<string, { items: RelatedMangaItem[]; timestamp: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Normalizes title by removing noise like (Official), [Digital], scanlator brackets, etc.
 */
export function cleanTitle(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/\s*(\(|\[)(Official|Digital|Colored|Color|Webcomic|Light Novel|LN|Comic|Manga|Eng|English|Raw)(\)|\])/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Strips title into significant keywords (length >= 3, no digits only), matching Komikku's heuristic.
 */
export function extractKeywords(title: string): string[] {
  const cleaned = cleanTitle(title)
  const regexSpecial = /([!~#$%^&*+_|/\\,?:;'“”‘’"<>(){}\[\]。・～：—！？、―«»《》〘〙【】「」｜]|\s-|-+\s|\s\.|\.\s)/g
  const tokens = cleaned
    .replace(regexSpecial, ' ')
    .split(/\s+/)
    .map(t => t.toLowerCase().trim())
    .filter(t => t.length >= 3 && !/^\d+$/.test(t))
  return Array.from(new Set(tokens))
}

export function formatRelationType(raw?: string | null): string | null {
  if (!raw) return null
  const map: Record<string, string> = {
    SEQUEL: 'Sequel',
    PREQUEL: 'Prequel',
    SPIN_OFF: 'Spin-off',
    SIDE_STORY: 'Side story',
    ALTERNATIVE: 'Alternative',
    ADAPTATION: 'Adaptation',
    CHARACTER: 'Character',
    SUMMARY: 'Summary',
    OTHER: 'Related',
  }
  return map[raw] || raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase().replace(/_/g, ' ')
}

export function useRelatedMangas(
  mangaGetter: MaybeRefOrGetter<Manga | null | undefined>,
  apiUrlGetter?: MaybeRefOrGetter<string>,
) {
  const server = useSuwayomiStore()
  const loading = ref(false)
  const error = ref<string | null>(null)
  const rawItems = shallowRef<RelatedMangaItem[]>([])

  const currentManga = computed(() => toValue(mangaGetter))
  const apiUrl = computed(() => (apiUrlGetter ? toValue(apiUrlGetter) : server.apiUrl))

  // Find if matching manga exists in user's library
  function findInLibrary(title: string): Manga | undefined {
    if (!title || !server.library.length) return undefined
    const norm = title.toLowerCase().trim()
    return server.library.find(m => {
      const targetNorm = m.title.toLowerCase().trim()
      return targetNorm === norm || cleanTitle(targetNorm) === cleanTitle(norm)
    })
  }

  // Fallback: search library manga sharing genres, author, or title keywords
  function getLibraryFallbacks(current: Manga): RelatedMangaItem[] {
    const results: RelatedMangaItem[] = []
    const keywords = extractKeywords(current.title)
    const currentGenres = new Set((current.genre || []).map(g => g.toLowerCase().trim()))
    const currentAuthor = current.author?.toLowerCase().trim()

    for (const libManga of server.library) {
      if (libManga.id === current.id) continue

      let matchScore = 0
      let matchRelation: string | null = null

      // Check author match
      if (currentAuthor && libManga.author && libManga.author.toLowerCase().trim() === currentAuthor) {
        matchScore += 3
        matchRelation = 'Same Author'
      }

      // Check keyword match
      const libKeywords = extractKeywords(libManga.title)
      const sharedKeywords = keywords.filter(k => libKeywords.includes(k))
      if (sharedKeywords.length > 0) {
        matchScore += sharedKeywords.length * 2
        matchRelation = matchRelation || 'Related Title'
      }

      // Check genre matches
      if (currentGenres.size > 0 && libManga.genre?.length) {
        const sharedGenres = libManga.genre.filter(g => currentGenres.has(g.toLowerCase().trim()))
        if (sharedGenres.length >= 2) {
          matchScore += sharedGenres.length
          matchRelation = matchRelation || `${sharedGenres[0]} / ${sharedGenres[1]}`
        }
      }

      if (matchScore > 0) {
        results.push({
          id: `lib-${libManga.id}`,
          title: libManga.title,
          coverUrl: server.thumbnailUrl(libManga.id),
          mangaId: libManga.id,
          inLibrary: true,
          genres: libManga.genre || [],
          relationType: matchRelation,
          group: 'library',
          score: matchScore,
        })
      }
    }

    results.sort((a, b) => (b.score || 0) - (a.score || 0))
    return results.slice(0, 15)
  }

  async function queryAniList(searchQuery: string, current: Manga): Promise<RelatedMangaItem[]> {
    const query = `
      query ($search: String) {
        Media(search: $search, type: MANGA) {
          id
          title { userPreferred english romaji native }
          genres
          relations {
            edges {
              relationType
              node {
                id
                title { userPreferred english romaji }
                type
                format
                status
                averageScore
                genres
                coverImage { large medium }
                description(asHtml: false)
              }
            }
          }
          recommendations(page: 1, perPage: 25, sort: [RATING_DESC]) {
            nodes {
              mediaRecommendation {
                id
                title { userPreferred english romaji }
                type
                format
                status
                averageScore
                genres
                coverImage { large medium }
                description(asHtml: false)
              }
            }
          }
        }
      }
    `

    const response = await ofetch<{
      data?: {
        Media?: {
          id: number
          title?: { userPreferred?: string; english?: string; romaji?: string; native?: string }
          relations?: {
            edges?: Array<{
              relationType?: string
              node?: {
                id: number
                title?: { userPreferred?: string; english?: string; romaji?: string }
                type?: string
                format?: string
                averageScore?: number
                genres?: string[]
                coverImage?: { large?: string; medium?: string }
                description?: string
              }
            }>
          }
          recommendations?: {
            nodes?: Array<{
              mediaRecommendation?: {
                id: number
                title?: { userPreferred?: string; english?: string; romaji?: string }
                type?: string
                format?: string
                averageScore?: number
                genres?: string[]
                coverImage?: { large?: string; medium?: string }
                description?: string
              }
            }>
          }
        }
      }
    }>('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { search: searchQuery } }),
      timeout: 10000,
    })

    const media = response?.data?.Media
    if (!media) return []

    const items: RelatedMangaItem[] = []
    const seenTitles = new Set<string>()
    seenTitles.add(current.title.toLowerCase().trim())
    const cleanedCurrent = cleanTitle(current.title).toLowerCase().trim()
    if (cleanedCurrent) seenTitles.add(cleanedCurrent)

    // Process relations (Sequels, Prequels, Spin-offs, etc.)
    if (media.relations?.edges?.length) {
      for (const edge of media.relations.edges) {
        const node = edge.node
        if (!node) continue
        // Filter out anime formats (keep manga, manhwa, manhua, novel, one_shot)
        const format = (node.format || '').toUpperCase()
        if (format === 'TV' || format === 'TV_SHORT' || format === 'MOVIE' || format === 'SPECIAL' || format === 'OVA' || format === 'ONA' || format === 'MUSIC') {
          continue
        }

        const title = node.title?.userPreferred || node.title?.english || node.title?.romaji || ''
        if (!title || seenTitles.has(title.toLowerCase().trim())) continue
        seenTitles.add(title.toLowerCase().trim())

        const match = findInLibrary(title)
        items.push({
          id: `anilist-rel-${node.id}`,
          title,
          coverUrl: node.coverImage?.large || node.coverImage?.medium,
          mangaId: match?.id ?? null,
          inLibrary: Boolean(match),
          description: node.description,
          score: node.averageScore,
          genres: node.genres,
          relationType: formatRelationType(edge.relationType),
          group: 'relation',
        })
      }
    }

    // Process recommendations
    if (media.recommendations?.nodes?.length) {
      for (const node of media.recommendations.nodes) {
        const rec = node.mediaRecommendation
        if (!rec) continue
        const format = (rec.format || '').toUpperCase()
        if (format === 'TV' || format === 'TV_SHORT' || format === 'MOVIE' || format === 'SPECIAL' || format === 'OVA' || format === 'ONA' || format === 'MUSIC') {
          continue
        }

        const title = rec.title?.userPreferred || rec.title?.english || rec.title?.romaji || ''
        if (!title || seenTitles.has(title.toLowerCase().trim())) continue
        seenTitles.add(title.toLowerCase().trim())

        const match = findInLibrary(title)
        items.push({
          id: `anilist-rec-${rec.id}`,
          title,
          coverUrl: rec.coverImage?.large || rec.coverImage?.medium,
          mangaId: match?.id ?? null,
          inLibrary: Boolean(match),
          description: rec.description,
          score: rec.averageScore,
          genres: rec.genres,
          relationType: null,
          group: 'recommendation',
        })
      }
    }

    return items
  }

  // Attempt server custom suggestions endpoint if available
  async function queryServerSuggestions(current: Manga): Promise<RelatedMangaItem[]> {
    if (!apiUrl.value || !current.id) return []
    try {
      const res = await ofetch<Array<{ id: number; title: string; coverUrl?: string; relationType?: string }>>(
        `${apiUrl.value}/api/v1/manga/${current.id}/related`,
        { timeout: 3000 },
      )
      if (Array.isArray(res) && res.length) {
        return res.map(r => {
          const match = findInLibrary(r.title)
          return {
            id: `server-${r.id}`,
            title: r.title,
            coverUrl: r.coverUrl || server.thumbnailUrl(r.id),
            mangaId: match?.id ?? r.id,
            inLibrary: Boolean(match),
            relationType: r.relationType || null,
            group: 'relation',
          }
        })
      }
    } catch {
      // Endpoint not supported by standard Suwayomi-Server build; ignore
    }
    return []
  }

  async function fetchRelated(force = false) {
    const current = currentManga.value
    if (!current?.title) {
      rawItems.value = []
      loading.value = false
      return
    }

    const cacheKey = `${current.id || current.title}`
    const cached = cache.get(cacheKey)
    if (!force && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      // Re-evaluate library presence for cached items
      rawItems.value = cached.items.map(it => {
        const match = findInLibrary(it.title)
        return {
          ...it,
          inLibrary: Boolean(match),
          mangaId: match?.id ?? it.mangaId,
        }
      })
      return
    }

    loading.value = true
    error.value = null

    try {
      // 1. Try server endpoint first
      const serverItems = await queryServerSuggestions(current)
      if (serverItems.length) {
        rawItems.value = serverItems
        cache.set(cacheKey, { items: serverItems, timestamp: Date.now() })
        loading.value = false
        return
      }

      // 2. Query AniList GraphQL recommendation engine
      const searchTitle = cleanTitle(current.title)
      let aniItems = await queryAniList(searchTitle, current)

      // If no results and cleanTitle differs from raw, try raw
      if (!aniItems.length && searchTitle !== current.title) {
        aniItems = await queryAniList(current.title, current)
      }

      if (aniItems.length) {
        rawItems.value = aniItems
        cache.set(cacheKey, { items: aniItems, timestamp: Date.now() })
        loading.value = false
        return
      }

      // 3. Fallback to Library heuristic if online returns no suggestions
      const libFallbacks = getLibraryFallbacks(current)
      rawItems.value = libFallbacks
      cache.set(cacheKey, { items: libFallbacks, timestamp: Date.now() })
    } catch (err) {
      // Fallback to library suggestions on error / offline
      const libFallbacks = getLibraryFallbacks(current)
      if (libFallbacks.length > 0) {
        rawItems.value = libFallbacks
      } else {
        error.value = err instanceof Error ? err.message : 'Failed to load suggestions'
      }
    } finally {
      loading.value = false
    }
  }

  // Watch for manga changes
  watch(() => currentManga.value?.id, () => {
    void fetchRelated()
  }, { immediate: true })

  // Keep library membership reactive when server.library changes
  const items = computed(() => {
    return rawItems.value.map(it => {
      const match = findInLibrary(it.title)
      return {
        ...it,
        inLibrary: Boolean(match),
        mangaId: match?.id ?? it.mangaId,
      }
    })
  })

  const relations = computed(() => items.value.filter(it => it.group === 'relation'))
  const recommendations = computed(() => items.value.filter(it => it.group === 'recommendation' || it.group === 'library'))

  const groups = computed<RelatedMangaGroup[]>(() => {
    const list: RelatedMangaGroup[] = []
    if (relations.value.length) {
      list.push({
        key: 'relations',
        title: 'Relations',
        items: relations.value,
      })
    }
    if (recommendations.value.length) {
      list.push({
        key: 'recommendations',
        title: 'Recommendations',
        items: recommendations.value,
      })
    }
    return list
  })

  return {
    loading,
    error,
    items,
    relations,
    recommendations,
    groups,
    fetchRelated,
    refresh: () => fetchRelated(true),
  }
}
