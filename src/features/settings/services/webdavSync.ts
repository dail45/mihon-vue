/**
 * Client-Side WebDAV Cloud Backup Sync Subsystem.
 *
 * Implements WebDAV client capabilities (PROPFIND, MKCOL, PUT, GET) via fetch with Basic Auth,
 * plus full serialization and deserialization of client state (categories, manga notes,
 * metadata overrides, merged groups, reader preferences, custom theme seed, and general UI preferences).
 *
 * Reference: komikku/app/src/main/java/eu/kanade/tachiyomi/data/sync/service/WebDavSyncService.kt
 */
import { ref } from 'vue'
import {
  readPreference,
  writePreference,
  usePreferencesStore,
} from '@/features/settings/stores/preferences'
import { useMangaNotesStore } from '@/features/manga/stores/mangaNotes'
import { useMangaOverridesStore } from '@/features/manga/stores/mangaOverrides'
import { useMergedMangaStore } from '@/features/manga/stores/mergedManga'

export interface ClientBackupPayload {
  version: number
  createdAt: string
  client: 'mihon-vue'
  data: {
    categories?: {
      hiddenCategories: number[]
      showHiddenCategories: boolean
      filterCategories: boolean
      filterCategoriesInclude: number[]
      filterCategoriesExclude: number[]
      categorySorts: Record<string, unknown>
      groupMode: number
      sortTags: string[]
      showEmptyCategoriesSearch: boolean
    }
    mangaNotes?: Record<string, string>
    metadataOverrides?: Record<string, unknown>
    mergedGroups?: Record<string, unknown>
    readerPreferences?: Record<string, string>
    appearance?: {
      customSeedColor?: string | null
      themeMode?: string | null
      appTheme?: string | null
      amoled?: boolean
      [key: string]: unknown
    }
    preferences?: Record<string, string>
  }
}

export interface WebDavBackupItem {
  name: string
  href: string
  fullUrl: string
  size: number
  lastModified: string
  etag: string
}

/** Reactive sync state for AppStateBanners progress display */
export const isWebDavSyncing = ref(false)
export const webDavSyncProgress = ref<string>('')

/**
 * Builds HTTP Basic Auth header safely supporting UTF-8 credentials.
 */
export function getAuthHeader(username: string, password: string): string {
  if (!username && !password) return ''
  try {
    const encoded = btoa(unescape(encodeURIComponent(`${username}:${password}`)))
    return `Basic ${encoded}`
  } catch {
    return ''
  }
}

/**
 * Helper to construct WebDAV request headers.
 */
export function getWebDavHeaders(
  username: string,
  password: string,
  additionalHeaders: Record<string, string> = {}
): Record<string, string> {
  const headers: Record<string, string> = { ...additionalHeaders }
  const auth = getAuthHeader(username, password)
  if (auth) {
    headers['Authorization'] = auth
  }
  return headers
}

/**
 * Normalizes base URL and folder path into clean WebDAV URL parts.
 */
export function normalizeWebDavUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

export function normalizeFolder(folder: string): string {
  return folder.trim().replace(/^\/+|\/+$/g, '')
}

export function buildWebDavUrl(baseUrl: string, folder = '', fileName = ''): string {
  const cleanBase = normalizeWebDavUrl(baseUrl)
  const cleanFolder = normalizeFolder(folder)
  const cleanFile = fileName.trim().replace(/^\/+/, '')

  let path = cleanBase
  if (cleanFolder) path = `${path}/${cleanFolder}`
  if (cleanFile) path = `${path}/${cleanFile}`
  return path
}

/**
 * Serializes all client state into a complete JSON backup payload:
 * - Categories (hidden, filters, categorySorts, sortTags, groupMode)
 * - Manga notes (localStorage keys starting with mihon.notes.)
 * - Local metadata overrides (localStorage mihon.manga_overrides)
 * - Merged manga groups (localStorage mihon.merged_manga)
 * - Reader preferences (mihon.reader.*, pref_reader_*)
 * - Custom theme seed & appearance (pref_color_theme, pref_theme_cover_based, mihon.appearance.*)
 * - General UI preferences
 */
export function serializeClientState(): ClientBackupPayload {
  let prefsStore: ReturnType<typeof usePreferencesStore> | null = null
  try {
    prefsStore = usePreferencesStore()
  } catch {
    // Pinia not active (e.g. standalone test)
  }

  // Categories & category filter state
  const categories = {
    hiddenCategories: prefsStore?.hiddenCategories ?? JSON.parse(readPreference('mihon.library.hiddenCategories') || '[]'),
    showHiddenCategories: prefsStore?.showHiddenCategories ?? (readPreference('mihon.library.showHiddenCategories') === 'true'),
    filterCategories: prefsStore?.filterCategories ?? (readPreference('mihon.library.filterCategories') === 'true'),
    filterCategoriesInclude: prefsStore?.filterCategoriesInclude ?? JSON.parse(readPreference('mihon.library.filterCategoriesInclude') || '[]'),
    filterCategoriesExclude: prefsStore?.filterCategoriesExclude ?? JSON.parse(readPreference('mihon.library.filterCategoriesExclude') || '[]'),
    categorySorts: (prefsStore?.categorySorts as any) ?? JSON.parse(readPreference('mihon.library.categorySorts') || '{}'),
    groupMode: prefsStore?.groupMode ?? Number(readPreference('mihon.library.groupMode') || 0),
    sortTags: prefsStore?.sortTags ?? JSON.parse(readPreference('mihon.library.sortTags') || '[]'),
    showEmptyCategoriesSearch: prefsStore?.showEmptyCategoriesSearch ?? (readPreference('mihon.library.showEmptyCategoriesSearch') === 'true'),
  }

  // Manga notes
  const mangaNotes: Record<string, string> = {}
  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('mihon.notes.')) {
        mangaNotes[key] = localStorage.getItem(key) || ''
      }
    }
  }

  // Metadata overrides
  let metadataOverrides: Record<string, unknown> = {}
  try {
    const raw = readPreference('mihon.manga_overrides')
    if (raw) metadataOverrides = JSON.parse(raw)
  } catch {}

  // Merged groups
  let mergedGroups: Record<string, unknown> = {}
  try {
    const raw = readPreference('mihon.merged_manga')
    if (raw) mergedGroups = JSON.parse(raw)
  } catch {}

  // Reader preferences
  const readerPreferences: Record<string, string> = {}
  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (
        key &&
        (key.startsWith('mihon.reader.') ||
          key.startsWith('pref_reader_') ||
          key === 'cutout_short' ||
          key === 'always_show_chapter_transition')
      ) {
        readerPreferences[key] = localStorage.getItem(key) || ''
      }
    }
  }

  // Appearance & custom seed color
  const appearance: Record<string, unknown> = {}
  appearance.customSeedColor = readPreference('pref_color_theme')
  appearance.coverBased = readPreference('pref_theme_cover_based') === 'true'
  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (
        key &&
        (key.startsWith('mihon.appearance.') ||
          key.startsWith('mihon.theme') ||
          key === 'pref_color_theme' ||
          key === 'pref_theme_cover_based')
      ) {
        appearance[key] = localStorage.getItem(key)
      }
    }
  }

  // General preferences
  const preferences: Record<string, string> = {}
  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (
        key &&
        (key.startsWith('mihon.library.') ||
          key.startsWith('mihon.catalogue.') ||
          key === 'mihon.tabletUiMode' ||
          key === 'mihon.theme' ||
          key.startsWith('pref_show_') ||
          key === 'track_on_adding_to_library' ||
          key === 'pref_auto_sync_progress_from_trackers_key')
      ) {
        preferences[key] = localStorage.getItem(key) || ''
      }
    }
  }

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    client: 'mihon-vue',
    data: {
      categories,
      mangaNotes,
      metadataOverrides,
      mergedGroups,
      readerPreferences,
      appearance,
      preferences,
    },
  }
}

/**
 * Restores all client state from backup payload and updates reactive stores.
 */
export function deserializeClientState(payload: ClientBackupPayload): void {
  if (!payload || !payload.data) {
    throw new Error('Invalid backup payload: missing data')
  }

  const { data } = payload

  // 1. Restore categories & sorting preferences
  if (data.categories) {
    const c = data.categories
    if (c.hiddenCategories !== undefined) writePreference('mihon.library.hiddenCategories', JSON.stringify(c.hiddenCategories))
    if (c.showHiddenCategories !== undefined) writePreference('mihon.library.showHiddenCategories', String(c.showHiddenCategories))
    if (c.filterCategories !== undefined) writePreference('mihon.library.filterCategories', String(c.filterCategories))
    if (c.filterCategoriesInclude !== undefined) writePreference('mihon.library.filterCategoriesInclude', JSON.stringify(c.filterCategoriesInclude))
    if (c.filterCategoriesExclude !== undefined) writePreference('mihon.library.filterCategoriesExclude', JSON.stringify(c.filterCategoriesExclude))
    if (c.categorySorts !== undefined) writePreference('mihon.library.categorySorts', JSON.stringify(c.categorySorts))
    if (c.groupMode !== undefined) writePreference('mihon.library.groupMode', String(c.groupMode))
    if (c.sortTags !== undefined) writePreference('mihon.library.sortTags', JSON.stringify(c.sortTags))
    if (c.showEmptyCategoriesSearch !== undefined) writePreference('mihon.library.showEmptyCategoriesSearch', String(c.showEmptyCategoriesSearch))

    try {
      const prefsStore = usePreferencesStore()
      if (c.hiddenCategories !== undefined) prefsStore.hiddenCategories = c.hiddenCategories
      if (c.showHiddenCategories !== undefined) prefsStore.showHiddenCategories = c.showHiddenCategories
      if (c.filterCategories !== undefined) prefsStore.filterCategories = c.filterCategories
      if (c.filterCategoriesInclude !== undefined) prefsStore.filterCategoriesInclude = c.filterCategoriesInclude
      if (c.filterCategoriesExclude !== undefined) prefsStore.filterCategoriesExclude = c.filterCategoriesExclude
      if (c.categorySorts !== undefined) prefsStore.categorySorts = c.categorySorts as any
      if (c.groupMode !== undefined) prefsStore.groupMode = c.groupMode as any
      if (c.sortTags !== undefined) prefsStore.sortTags = c.sortTags
      if (c.showEmptyCategoriesSearch !== undefined) prefsStore.showEmptyCategoriesSearch = c.showEmptyCategoriesSearch
    } catch {}
  }

  // 2. Restore manga notes
  if (data.mangaNotes && typeof data.mangaNotes === 'object') {
    for (const [key, val] of Object.entries(data.mangaNotes)) {
      if (typeof val === 'string') {
        writePreference(key, val)
      }
    }
    try {
      const notesStore = useMangaNotesStore()
      for (const [key, val] of Object.entries(data.mangaNotes)) {
        if (typeof val === 'string') {
          notesStore.notesByManga[key] = val
        }
      }
    } catch {}
  }

  // 3. Restore metadata overrides
  if (data.metadataOverrides && typeof data.metadataOverrides === 'object') {
    writePreference('mihon.manga_overrides', JSON.stringify(data.metadataOverrides))
    try {
      const overridesStore = useMangaOverridesStore()
      overridesStore.loadOverrides()
    } catch {}
  }

  // 4. Restore merged manga groups
  if (data.mergedGroups && typeof data.mergedGroups === 'object') {
    writePreference('mihon.merged_manga', JSON.stringify(data.mergedGroups))
    try {
      const mergedStore = useMergedMangaStore()
      mergedStore.groups = data.mergedGroups as any
    } catch {}
  }

  // 5. Restore reader preferences
  if (data.readerPreferences && typeof data.readerPreferences === 'object') {
    for (const [key, val] of Object.entries(data.readerPreferences)) {
      if (typeof val === 'string') {
        writePreference(key, val)
      }
    }
  }

  // 6. Restore appearance & theme seed
  if (data.appearance && typeof data.appearance === 'object') {
    for (const [key, val] of Object.entries(data.appearance)) {
      if (val !== null && val !== undefined) {
        writePreference(key, String(val))
      }
    }
    if (data.appearance.customSeedColor) {
      writePreference('pref_color_theme', String(data.appearance.customSeedColor))
    }
  }

  // 7. Restore general preferences
  if (data.preferences && typeof data.preferences === 'object') {
    for (const [key, val] of Object.entries(data.preferences)) {
      if (typeof val === 'string') {
        writePreference(key, val)
      }
    }
  }
}

/**
 * Tests WebDAV connectivity via PROPFIND request with Depth 0.
 */
export async function testWebDavConnection(
  url: string,
  username: string,
  password: string,
  folder = ''
): Promise<{ success: boolean; message: string }> {
  if (!url || !url.startsWith('http')) {
    throw new Error('Invalid WebDAV URL. Address must begin with http:// or https://')
  }

  const cleanBase = normalizeWebDavUrl(url)
  const cleanFolder = normalizeFolder(folder)
  const targetUrl = cleanFolder ? `${cleanBase}/${cleanFolder}/` : `${cleanBase}/`

  try {
    const res = await fetch(targetUrl, {
      method: 'PROPFIND',
      headers: getWebDavHeaders(username, password, {
        Depth: '0',
      }),
    })

    if (res.status === 401 || res.status === 403) {
      throw new Error(`Authentication failed (HTTP ${res.status}). Verify username and password.`)
    }

    if (res.ok || res.status === 207) {
      return { success: true, message: 'WebDAV connection confirmed successfully!' }
    }

    // If folder returned 404, check root URL to verify server credentials
    if (res.status === 404 && cleanFolder) {
      const rootRes = await fetch(`${cleanBase}/`, {
        method: 'PROPFIND',
        headers: getWebDavHeaders(username, password, {
          Depth: '0',
        }),
      })

      if (rootRes.ok || rootRes.status === 207) {
        return {
          success: true,
          message: 'Server connection verified. Target folder will be created during the first backup.',
        }
      }
    }

    throw new Error(`WebDAV returned HTTP ${res.status}: ${res.statusText}`)
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
        throw new Error(
          `Network or CORS restriction connecting to "${cleanBase}". Ensure server is reachable and allows WebDAV CORS headers.`
        )
      }
      throw err
    }
    throw new Error('Unknown connection error occurred')
  }
}

/**
 * Ensures a remote WebDAV directory exists via recursive MKCOL calls.
 */
export async function ensureFolderExists(
  baseUrl: string,
  folder: string,
  username: string,
  password: string
): Promise<boolean> {
  const cleanBase = normalizeWebDavUrl(baseUrl)
  const cleanFolder = normalizeFolder(folder)
  if (!cleanFolder) return true

  const segments = cleanFolder.split('/').filter(Boolean)
  let currentPath = cleanBase

  for (const seg of segments) {
    currentPath = `${currentPath}/${encodeURIComponent(seg)}`
    try {
      const res = await fetch(currentPath, {
        method: 'MKCOL',
        headers: getWebDavHeaders(username, password),
      })

      // 201 Created -> success
      // 405 Method Not Allowed -> already exists
      // 409 Conflict -> already exists or intermediate
      if (res.ok || res.status === 201 || res.status === 405 || res.status === 409) {
        continue
      }

      // Fallback: check existence with PROPFIND Depth 0
      const checkRes = await fetch(`${currentPath}/`, {
        method: 'PROPFIND',
        headers: getWebDavHeaders(username, password, { Depth: '0' }),
      })
      if (checkRes.ok || checkRes.status === 207) {
        continue
      }

      throw new Error(`Failed to create remote directory "${seg}" (HTTP ${res.status})`)
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Failed to create remote directory')) {
        throw err
      }
      // If network fails, throw descriptive error
      throw new Error(`Directory check failed for "${seg}": ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return true
}

/**
 * Queries WebDAV folder with PROPFIND Depth 1 and returns parsed list of backup snapshots.
 */
export async function listWebDavBackups(
  baseUrl: string,
  folder: string,
  username: string,
  password: string
): Promise<WebDavBackupItem[]> {
  const cleanBase = normalizeWebDavUrl(baseUrl)
  const cleanFolder = normalizeFolder(folder)
  const folderUrl = cleanFolder ? `${cleanBase}/${cleanFolder}/` : `${cleanBase}/`

  const res = await fetch(folderUrl, {
    method: 'PROPFIND',
    headers: getWebDavHeaders(username, password, {
      Depth: '1',
      'Content-Type': 'application/xml; charset=utf-8',
    }),
  })

  if (res.status === 404) {
    return []
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(`Authentication error (HTTP ${res.status}). Verify credentials.`)
  }

  if (!res.ok && res.status !== 207) {
    throw new Error(`Failed to query remote directory: HTTP ${res.status} ${res.statusText}`)
  }

  const xmlText = await res.text()

  interface ExtractedResponse {
    href: string
    isCollection: boolean
    lastModified: string
    contentLength: string
    etag: string
  }

  const rawResponses: ExtractedResponse[] = []

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlText, 'application/xml')
    const parseError = doc.querySelector('parsererror')
    if (parseError) {
      throw new Error(`Malformed XML response from WebDAV: ${parseError.textContent}`)
    }
    const allElements = Array.from(doc.getElementsByTagName('*'))
    const responseNodes = allElements.filter(el => el.localName.toLowerCase() === 'response')
    for (const node of responseNodes) {
      const children = Array.from(node.getElementsByTagName('*'))
      const hrefEl = children.find(el => el.localName.toLowerCase() === 'href')
      const isCollection = children.some(el => el.localName.toLowerCase() === 'collection')
      const lastModifiedEl = children.find(el => el.localName.toLowerCase() === 'getlastmodified')
      const lengthEl = children.find(el => el.localName.toLowerCase() === 'getcontentlength')
      const etagEl = children.find(el => el.localName.toLowerCase() === 'getetag')
      rawResponses.push({
        href: hrefEl?.textContent?.trim() || '',
        isCollection,
        lastModified: lastModifiedEl?.textContent?.trim() || '',
        contentLength: lengthEl?.textContent?.trim() || '0',
        etag: etagEl?.textContent?.trim().replace(/^"|"$/g, '') || '',
      })
    }
  } else {
    // Headless / Node testing regex fallback
    const responseRegex = /<(?:\w+:)?response[^>]*>([\s\S]*?)<\/(?:\w+:)?response>/gi
    let match: RegExpExecArray | null
    while ((match = responseRegex.exec(xmlText)) !== null) {
      const block = match[1]
      const hrefMatch = /<(?:\w+:)?href[^>]*>([\s\S]*?)<\/(?:\w+:)?href>/i.exec(block)
      const isCollection = /<(?:\w+:)?collection\s*\/?>/i.test(block)
      const modMatch = /<(?:\w+:)?getlastmodified[^>]*>([\s\S]*?)<\/(?:\w+:)?getlastmodified>/i.exec(block)
      const lenMatch = /<(?:\w+:)?getcontentlength[^>]*>([\s\S]*?)<\/(?:\w+:)?getcontentlength>/i.exec(block)
      const etagMatch = /<(?:\w+:)?getetag[^>]*>([\s\S]*?)<\/(?:\w+:)?getetag>/i.exec(block)
      rawResponses.push({
        href: hrefMatch?.[1]?.trim() || '',
        isCollection,
        lastModified: modMatch?.[1]?.trim() || '',
        contentLength: lenMatch?.[1]?.trim() || '0',
        etag: etagMatch?.[1]?.trim().replace(/^"|"$/g, '') || '',
      })
    }
  }

  const items: WebDavBackupItem[] = []

  for (const entry of rawResponses) {
    const { href, isCollection, lastModified, contentLength, etag } = entry
    if (!href || isCollection) continue

    const cleanHref = href.split('?')[0].replace(/\/+$/, '')
    const fileName = decodeURIComponent(cleanHref.split('/').pop() || '')

    // Only include JSON backup files
    if (!fileName || !fileName.endsWith('.json')) {
      continue
    }

    let fullUrl = href
    if (!href.startsWith('http://') && !href.startsWith('https://')) {
      try {
        const origin = new URL(cleanBase).origin
        fullUrl = href.startsWith('/') ? `${origin}${href}` : `${cleanBase}/${href}`
      } catch {
        fullUrl = `${cleanBase}/${href}`
      }
    }

    items.push({
      name: fileName,
      href,
      fullUrl,
      size: parseInt(contentLength || '0', 10),
      lastModified,
      etag,
    })
  }

  // Sort backups descending (newest first)
  items.sort((a, b) => {
    const timeA = a.lastModified ? new Date(a.lastModified).getTime() : 0
    const timeB = b.lastModified ? new Date(b.lastModified).getTime() : 0
    if (timeA !== timeB) return timeB - timeA
    return b.name.localeCompare(a.name)
  })

  return items
}

/**
 * Uploads a client backup payload directly to WebDAV directory with timestamped filename.
 */
export async function uploadWebDavBackup(
  baseUrl: string,
  folder: string,
  username: string,
  password: string,
  customPayload?: ClientBackupPayload
): Promise<{ fileName: string; size: number; timestamp: string }> {
  if (!baseUrl || !baseUrl.startsWith('http')) {
    throw new Error('Invalid WebDAV URL. Address must begin with http:// or https://')
  }

  isWebDavSyncing.value = true
  webDavSyncProgress.value = 'Preparing backup payload...'

  try {
    const payload = customPayload || serializeClientState()
    const jsonString = JSON.stringify(payload, null, 2)

    webDavSyncProgress.value = 'Checking remote directory...'
    await ensureFolderExists(baseUrl, folder, username, password)

    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
    const fileName = `mihon_backup_${dateStr}.json`

    const cleanBase = normalizeWebDavUrl(baseUrl)
    const cleanFolder = normalizeFolder(folder)
    const folderUrl = cleanFolder ? `${cleanBase}/${cleanFolder}` : cleanBase
    const targetFileUrl = `${folderUrl}/${fileName}`

    webDavSyncProgress.value = `Uploading ${fileName}...`

    const res = await fetch(targetFileUrl, {
      method: 'PUT',
      headers: getWebDavHeaders(username, password, {
        'Content-Type': 'application/json; charset=utf-8',
      }),
      body: jsonString,
    })

    if (!res.ok && res.status !== 201 && res.status !== 204) {
      throw new Error(`Failed to upload backup: HTTP ${res.status} ${res.statusText}`)
    }

    const timestamp = now.toISOString()
    writePreference('pref_webdav_last_sync', timestamp)
    try {
      const prefs = usePreferencesStore()
      prefs.webdavLastSync = timestamp
    } catch {}

    return { fileName, size: jsonString.length, timestamp }
  } finally {
    isWebDavSyncing.value = false
    webDavSyncProgress.value = ''
  }
}

/**
 * Downloads and restores selected backup from WebDAV server.
 */
export async function downloadWebDavBackup(
  fileUrlOrHref: string,
  baseUrl: string,
  username: string,
  password: string
): Promise<ClientBackupPayload> {
  isWebDavSyncing.value = true
  webDavSyncProgress.value = 'Downloading backup...'

  try {
    const cleanBase = normalizeWebDavUrl(baseUrl)
    let targetUrl = fileUrlOrHref
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      try {
        const origin = new URL(cleanBase).origin
        targetUrl = fileUrlOrHref.startsWith('/') ? `${origin}${fileUrlOrHref}` : `${cleanBase}/${fileUrlOrHref}`
      } catch {
        targetUrl = `${cleanBase}/${fileUrlOrHref}`
      }
    }

    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: getWebDavHeaders(username, password, {
        Accept: 'application/json',
      }),
    })

    if (!res.ok) {
      throw new Error(`Failed to download backup (HTTP ${res.status}: ${res.statusText})`)
    }

    webDavSyncProgress.value = 'Restoring client state...'
    const json: ClientBackupPayload = await res.json()
    deserializeClientState(json)

    const now = new Date().toISOString()
    writePreference('pref_webdav_last_sync', now)
    try {
      const prefs = usePreferencesStore()
      prefs.webdavLastSync = now
    } catch {}

    return json
  } finally {
    isWebDavSyncing.value = false
    webDavSyncProgress.value = ''
  }
}
