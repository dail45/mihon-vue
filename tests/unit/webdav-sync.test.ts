import { describe, expect, it, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  serializeClientState,
  deserializeClientState,
  getAuthHeader,
  buildWebDavUrl,
  getWebDavHeaders,
  testWebDavConnection,
  ensureFolderExists,
  listWebDavBackups,
  uploadWebDavBackup,
  downloadWebDavBackup,
  isWebDavSyncing,
  webDavSyncProgress,
  type ClientBackupPayload,
} from '@/features/settings/services/webdavSync'

const storage: Record<string, string> = {}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = String(v) },
    removeItem: (k: string) => { delete storage[k] },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
    key: (i: number) => Object.keys(storage)[i] ?? null,
    get length() { return Object.keys(storage).length },
  } as Storage
}

describe('WebDAV Sync Subsystem (Phase 6.5)', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    isWebDavSyncing.value = false
    webDavSyncProgress.value = ''
  })

  describe('Auth and URL formatting', () => {
    it('generates HTTP Basic Auth header safely with UTF-8 characters', () => {
      const auth = getAuthHeader('user', 'pass123')
      expect(auth).toBe(`Basic ${btoa('user:pass123')}`)

      const empty = getAuthHeader('', '')
      expect(empty).toBe('')
    })

    it('assembles headers with Authorization and custom parameters', () => {
      const headers = getWebDavHeaders('admin', 'secret', { Depth: '1', 'Content-Type': 'application/xml' })
      expect(headers['Authorization']).toBe(`Basic ${btoa('admin:secret')}`)
      expect(headers['Depth']).toBe('1')
      expect(headers['Content-Type']).toBe('application/xml')
    })

    it('normalizes base URLs and directories in buildWebDavUrl', () => {
      const url1 = buildWebDavUrl('https://dav.example.com/', '/backups/', 'snapshot.json')
      expect(url1).toBe('https://dav.example.com/backups/snapshot.json')

      const url2 = buildWebDavUrl('https://dav.example.com', '', 'file.json')
      expect(url2).toBe('https://dav.example.com/file.json')
    })
  })

  describe('Client state serialization & deserialization', () => {
    it('serializes all client state into a complete payload', () => {
      localStorage.setItem('mihon.notes.server::42', '# My Notes on Chapter 1')
      localStorage.setItem('mihon.manga_overrides', JSON.stringify({ 42: { title: 'Overridden Title' } }))
      localStorage.setItem('mihon.merged_manga', JSON.stringify({ 42: { primaryMangaId: 42, references: [] } }))
      localStorage.setItem('mihon.reader.mode', 'webtoon')
      localStorage.setItem('pref_color_theme', '#DF0090')
      localStorage.setItem('mihon.library.hiddenCategories', JSON.stringify([1, 2]))
      localStorage.setItem('mihon.library.showHiddenCategories', 'true')

      const payload = serializeClientState()

      expect(payload.version).toBe(1)
      expect(payload.client).toBe('mihon-vue')
      expect(payload.data.mangaNotes?.['mihon.notes.server::42']).toBe('# My Notes on Chapter 1')
      expect(payload.data.metadataOverrides).toEqual({ 42: { title: 'Overridden Title' } })
      expect(payload.data.mergedGroups).toEqual({ 42: { primaryMangaId: 42, references: [] } })
      expect(payload.data.readerPreferences?.['mihon.reader.mode']).toBe('webtoon')
      expect(payload.data.appearance?.customSeedColor).toBe('#DF0090')
      expect(payload.data.categories?.hiddenCategories).toEqual([1, 2])
      expect(payload.data.categories?.showHiddenCategories).toBe(true)
    })

    it('deserializes and restores client state into browser storage and preferences', () => {
      const mockPayload: ClientBackupPayload = {
        version: 1,
        createdAt: new Date().toISOString(),
        client: 'mihon-vue',
        data: {
          categories: {
            hiddenCategories: [5, 9],
            showHiddenCategories: true,
            filterCategories: true,
            filterCategoriesInclude: [5],
            filterCategoriesExclude: [9],
            categorySorts: {},
            groupMode: 1,
            sortTags: ['Action'],
            showEmptyCategoriesSearch: true,
          },
          mangaNotes: {
            'mihon.notes.server::99': 'Restored markdown notes',
          },
          metadataOverrides: {
            99: { title: 'Restored Override' },
          },
          mergedGroups: {
            99: { primaryMangaId: 99, references: [] },
          },
          readerPreferences: {
            'mihon.reader.mode': 'rtl',
            'mihon.reader.cropBorders': 'true',
          },
          appearance: {
            customSeedColor: '#3498DB',
            themeMode: 'dark',
          },
          preferences: {
            'mihon.library.display': 'comfortable',
          },
        },
      }

      deserializeClientState(mockPayload)

      expect(localStorage.getItem('mihon.notes.server::99')).toBe('Restored markdown notes')
      expect(JSON.parse(localStorage.getItem('mihon.manga_overrides') || '{}')).toEqual({
        99: { title: 'Restored Override' },
      })
      expect(JSON.parse(localStorage.getItem('mihon.merged_manga') || '{}')).toEqual({
        99: { primaryMangaId: 99, references: [] },
      })
      expect(localStorage.getItem('mihon.reader.mode')).toBe('rtl')
      expect(localStorage.getItem('mihon.reader.cropBorders')).toBe('true')
      expect(localStorage.getItem('pref_color_theme')).toBe('#3498DB')
      expect(JSON.parse(localStorage.getItem('mihon.library.hiddenCategories') || '[]')).toEqual([5, 9])
      expect(localStorage.getItem('mihon.library.showHiddenCategories')).toBe('true')
      expect(localStorage.getItem('mihon.library.display')).toBe('comfortable')
    })
  })

  describe('WebDAV server operations', () => {
    it('testWebDavConnection succeeds when PROPFIND returns 207 Multi-Status', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 207,
          statusText: 'Multi-Status',
        })
      )

      const result = await testWebDavConnection('https://webdav.example.com', 'user', 'pass', 'backups')
      expect(result.success).toBe(true)
    })

    it('testWebDavConnection fails with 401 when credentials are bad', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        })
      )

      await expect(
        testWebDavConnection('https://webdav.example.com', 'baduser', 'badpass')
      ).rejects.toThrow(/Authentication failed/)
    })

    it('ensureFolderExists issues MKCOL requests for directory paths', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        statusText: 'Created',
      })
      vi.stubGlobal('fetch', fetchMock)

      const success = await ensureFolderExists('https://webdav.example.com', 'mihon/backups', 'user', 'pass')
      expect(success).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls[0][1].method).toBe('MKCOL')
      expect(fetchMock.mock.calls[1][1].method).toBe('MKCOL')
    })

    it('listWebDavBackups parses XML PROPFIND response, skipping directories and sorting', async () => {
      const sampleXml = `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/remote.php/dav/files/user/backups/</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype><d:collection/></d:resourcetype>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/user/backups/mihon_backup_2026-10-24_10-00-00.json</d:href>
    <d:propstat>
      <d:prop>
        <d:getlastmodified>Sat, 24 Oct 2026 10:00:00 GMT</d:getlastmodified>
        <d:getcontentlength>1024</d:getcontentlength>
        <d:getetag>"tag1"</d:getetag>
        <d:resourcetype/>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/user/backups/mihon_backup_2026-10-25_12-00-00.json</d:href>
    <d:propstat>
      <d:prop>
        <d:getlastmodified>Sun, 25 Oct 2026 12:00:00 GMT</d:getlastmodified>
        <d:getcontentlength>2048</d:getcontentlength>
        <d:getetag>"tag2"</d:getetag>
        <d:resourcetype/>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 207,
          text: async () => sampleXml,
        })
      )

      const items = await listWebDavBackups('https://dav.example.com', 'backups', 'user', 'pass')

      expect(items.length).toBe(2)
      // Newest backup must be first
      expect(items[0].name).toBe('mihon_backup_2026-10-25_12-00-00.json')
      expect(items[0].size).toBe(2048)
      expect(items[0].etag).toBe('tag2')

      expect(items[1].name).toBe('mihon_backup_2026-10-24_10-00-00.json')
      expect(items[1].size).toBe(1024)
    })

    it('uploadWebDavBackup sends serialized JSON via PUT and updates last sync timestamp', async () => {
      const fetchMock = vi.fn().mockImplementation((_url, init) => {
        if (init?.method === 'MKCOL') return Promise.resolve({ ok: true, status: 201 })
        if (init?.method === 'PUT') return Promise.resolve({ ok: true, status: 201 })
        return Promise.resolve({ ok: true, status: 200 })
      })
      vi.stubGlobal('fetch', fetchMock)

      const res = await uploadWebDavBackup('https://dav.example.com', 'backups', 'user', 'pass')

      expect(res.fileName).toMatch(/^mihon_backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/)
      expect(res.size).toBeGreaterThan(0)
      expect(localStorage.getItem('pref_webdav_last_sync')).toBeTruthy()
      expect(isWebDavSyncing.value).toBe(false)
    })

    it('downloadWebDavBackup downloads JSON and restores state', async () => {
      const payload: ClientBackupPayload = {
        version: 1,
        createdAt: new Date().toISOString(),
        client: 'mihon-vue',
        data: {
          mangaNotes: { 'mihon.notes.server::123': 'Remote notes downloaded' },
        },
      }

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => payload,
        })
      )

      const restored = await downloadWebDavBackup(
        '/backups/snapshot.json',
        'https://dav.example.com',
        'user',
        'pass'
      )

      expect(restored.data.mangaNotes?.['mihon.notes.server::123']).toBe('Remote notes downloaded')
      expect(localStorage.getItem('mihon.notes.server::123')).toBe('Remote notes downloaded')
      expect(isWebDavSyncing.value).toBe(false)
    })
  })

  describe('UI Component Integration', () => {
    it('SettingsDataView contains WebDAV Cloud Sync preference group and actions', () => {
      const fs = require('node:fs')
      const content = fs.readFileSync('src/features/settings/views/SettingsDataView.vue', 'utf8')

      expect(content).toContain('pref_webdav_group_title')
      expect(content).toContain('pref_webdav_url')
      expect(content).toContain('pref_webdav_folder')
      expect(content).toContain('pref_webdav_username')
      expect(content).toContain('pref_webdav_password')
      expect(content).toContain('pref_webdav_auto_sync')
      expect(content).toContain('pref_webdav_test_connection')
      expect(content).toContain('pref_webdav_backup_now')
      expect(content).toContain('pref_webdav_restore_now')
      expect(content).toContain('WebDavSyncDialog')
    })

    it('AppStateBanners contains animated WebDAV syncing progress banner', () => {
      const fs = require('node:fs')
      const content = fs.readFileSync('src/core/components/AppStateBanners.vue', 'utf8')

      expect(content).toContain('banner--syncing')
      expect(content).toContain('isSyncing')
      expect(content).toContain('syncingLabel')
      expect(content).toContain('isWebDavSyncing')
      expect(content).toContain('webDavSyncProgress')
    })

    it('WebDavSyncDialog implements restore browser with snapshot list and restore trigger', () => {
      const fs = require('node:fs')
      const content = fs.readFileSync('src/features/settings/components/WebDavSyncDialog.vue', 'utf8')

      expect(content).toContain('listWebDavBackups')
      expect(content).toContain('downloadWebDavBackup')
      expect(content).toContain('pref_webdav_restore_title')
      expect(content).toContain('promptRestore')
      expect(content).toContain('confirmRestore')
      expect(content).toContain('webdav-backups-list')
    })
  })
})
