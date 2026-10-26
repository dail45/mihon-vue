import { defineStore } from 'pinia'
import { ref, markRaw } from 'vue'
import type { Manga } from '@/core/api/types'

export const STORAGE_KEY_MANGA_OVERRIDES = 'mihon.manga_overrides'

export interface MangaMetadataOverride {
  title?: string
  author?: string
  artist?: string
  description?: string
  thumbnailUrl?: string
  genre?: string[]
  status?: number
  updatedAt: number
}

export type MangaOverridesMap = Record<number, MangaMetadataOverride>

export interface MangaWithOverrides extends Manga {
  ogTitle?: string
  ogAuthor?: string
  ogArtist?: string
  ogThumbnailUrl?: string
  ogDescription?: string
  ogGenre?: string[]
  ogStatus?: number
  hasCustomCover?: boolean
  isOverridden?: boolean
}

/**
 * Applies local metadata overrides to a Manga object while preserving
 * the original source values under `ogTitle`, `ogAuthor`, etc.
 */
export function applyMangaOverride<T extends Manga>(
  manga: T,
  override?: MangaMetadataOverride | null,
): T & MangaWithOverrides {
  const mAny = manga as any
  const ogTitle = mAny.ogTitle ?? manga.title
  const ogAuthor = mAny.ogAuthor ?? (manga.author || '')
  const ogArtist = mAny.ogArtist ?? (manga.artist || '')
  const ogThumbnailUrl = mAny.ogThumbnailUrl ?? (manga.thumbnailUrl || '')
  const ogDescription = mAny.ogDescription ?? (manga.description || '')
  const ogGenre = mAny.ogGenre ?? (manga.genre || [])
  const ogStatus = mAny.ogStatus ?? manga.status

  if (!override) {
    return markRaw({
      ...manga,
      ogTitle,
      ogAuthor,
      ogArtist,
      ogThumbnailUrl,
      ogDescription,
      ogGenre,
      ogStatus,
      _searchTitle: (ogTitle || '').toLowerCase(),
      hasCustomCover: false,
      isOverridden: false,
    })
  }

  const hasCustomCover = Boolean(
    override.thumbnailUrl &&
    override.thumbnailUrl.trim() &&
    override.thumbnailUrl !== ogThumbnailUrl,
  )

  const isOverridden = Boolean(
    (override.title && override.title.trim() && override.title !== ogTitle) ||
    (override.author && override.author.trim() && override.author !== ogAuthor) ||
    (override.artist && override.artist.trim() && override.artist !== ogArtist) ||
    (override.description && override.description.trim() && override.description !== ogDescription) ||
    hasCustomCover ||
    (override.genre && JSON.stringify(override.genre) !== JSON.stringify(ogGenre)) ||
    (override.status !== undefined && override.status !== ogStatus),
  )

  return markRaw({
    ...manga,
    ogTitle,
    ogAuthor,
    ogArtist,
    ogThumbnailUrl,
    ogDescription,
    ogGenre,
    ogStatus,
    title: override.title?.trim() || ogTitle,
    author: override.author !== undefined ? override.author.trim() : ogAuthor,
    artist: override.artist !== undefined ? override.artist.trim() : ogArtist,
    description: override.description !== undefined ? override.description.trim() : ogDescription,
    thumbnailUrl: override.thumbnailUrl?.trim() || ogThumbnailUrl,
    genre: override.genre !== undefined ? override.genre : ogGenre,
    status: override.status !== undefined ? override.status : ogStatus,
    hasCustomCover,
    _searchTitle: (override.title?.trim() || ogTitle || '').toLowerCase(),
    isOverridden,
  })
}

export const useMangaOverridesStore = defineStore('mangaOverrides', () => {
  const overrides = ref<MangaOverridesMap>({})

  function loadOverrides() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY_MANGA_OVERRIDES)
        if (raw) {
          overrides.value = JSON.parse(raw) as MangaOverridesMap
          return
        }
      }
    } catch (e) {
      console.error('Failed to parse manga overrides from localStorage:', e)
    }
    overrides.value = {}
  }

  function saveOverrides() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_MANGA_OVERRIDES, JSON.stringify(overrides.value))
      }
    } catch (e) {
      console.error('Failed to save manga overrides to localStorage:', e)
    }
  }

  function getOverride(mangaId: number): MangaMetadataOverride | undefined {
    return overrides.value[mangaId]
  }

  function hasOverride(mangaId: number): boolean {
    return Boolean(overrides.value[mangaId])
  }

  function isFieldOverridden(
    mangaId: number,
    field: keyof Omit<MangaMetadataOverride, 'updatedAt'>,
  ): boolean {
    const ov = overrides.value[mangaId]
    if (!ov) return false
    return ov[field] !== undefined
  }

  function setOverride(
    mangaId: number,
    patch: Partial<Omit<MangaMetadataOverride, 'updatedAt'>>,
  ) {
    const existing = overrides.value[mangaId] || { updatedAt: Date.now() }
    const merged: MangaMetadataOverride = {
      ...existing,
      ...patch,
      updatedAt: Date.now(),
    }

    const clean: Partial<MangaMetadataOverride> = { updatedAt: merged.updatedAt }
    if (merged.title?.trim()) clean.title = merged.title.trim()
    if (merged.author?.trim()) clean.author = merged.author.trim()
    if (merged.artist?.trim()) clean.artist = merged.artist.trim()
    if (merged.description?.trim()) clean.description = merged.description.trim()
    if (merged.thumbnailUrl?.trim()) clean.thumbnailUrl = merged.thumbnailUrl.trim()
    if (merged.genre && merged.genre.length > 0) clean.genre = merged.genre
    if (merged.status !== undefined) clean.status = merged.status

    // If only updatedAt remains, delete the override entry
    if (Object.keys(clean).length <= 1) {
      delete overrides.value[mangaId]
    } else {
      overrides.value[mangaId] = clean as MangaMetadataOverride
    }
    saveOverrides()
  }

  function resetOverride(mangaId: number) {
    if (overrides.value[mangaId]) {
      delete overrides.value[mangaId]
      saveOverrides()
    }
  }

  function resetField(
    mangaId: number,
    field: keyof Omit<MangaMetadataOverride, 'updatedAt'>,
  ) {
    if (overrides.value[mangaId]) {
      delete overrides.value[mangaId][field]
      if (Object.keys(overrides.value[mangaId]).filter(k => k !== 'updatedAt').length === 0) {
        delete overrides.value[mangaId]
      } else {
        overrides.value[mangaId].updatedAt = Date.now()
      }
      saveOverrides()
    }
  }

  function applyOverride<T extends Manga>(manga: T): T & MangaWithOverrides {
    return applyMangaOverride(manga, overrides.value[manga.id])
  }

  // Load persisted overrides immediately on store instantiation
  loadOverrides()

  return {
    overrides,
    loadOverrides,
    saveOverrides,
    getOverride,
    hasOverride,
    isFieldOverridden,
    setOverride,
    resetOverride,
    resetField,
    applyOverride,
  }
})
