import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  fetchTrackerMetadata,
} from '@/features/manga/composables/useTrackerAutofill'
import type { Tracker, TrackerRecord } from '@/core/api/trackers'

describe('EditMangaDialog Component & Tracker Autofill (Section 5.1)', () => {
  it('EditMangaDialog.vue implements all specification requirements', () => {
    const sfcPath = join(process.cwd(), 'src/features/manga/components/EditMangaDialog.vue')
    const source = readFileSync(sfcPath, 'utf8')

    // Title, Author, Artist, Cover URL, Description, Status, Tags
    expect(source).toContain("t('title')")
    expect(source).toContain("t('author')")
    expect(source).toContain("t('artist')")
    expect(source).toContain("t('thumbnail_url')")
    expect(source).toContain("t('entry_description')")
    expect(source).toContain("t('status')")
    expect(source).toContain("t('entry_tags')")
    expect(source).toContain("t('add_tag')")
    expect(source).toContain("t('add_tags')")
    expect(source).toContain("t('multi_tags_comma_separated')")

    // Actions: Autofill, individual reset, reset all, cancel, save
    expect(source).toContain("t('fill_from_tracker')")
    expect(source).toContain("t('reset_info')")
    expect(source).toContain("t('reset_tags')")
    expect(source).toContain("t('action_reset')")
    expect(source).toContain("t('action_cancel')")
    expect(source).toContain("t('action_save')")

    // Uses native Vuetify 4 MD3 components
    expect(source).toContain('<v-dialog')
    expect(source).toContain('<v-card')
    expect(source).toContain('<v-text-field')
    expect(source).toContain('<v-textarea')
    expect(source).toContain('<v-select')
    expect(source).toContain('<v-chip')
    expect(source).toContain('<v-btn')
  })

  it('MangaToolbar.vue integrates Edit info in overflow menu', () => {
    const toolbarPath = join(process.cwd(), 'src/features/manga/components/MangaToolbar.vue')
    const source = readFileSync(toolbarPath, 'utf8')

    expect(source).toContain("(event: 'editInfo'): void")
    expect(source).toContain('<v-list-item title="Edit info" @click="emit(\'editInfo\')" />')
  })

  it('All required i18n strings exist in en.json and ru.json', () => {
    const en = JSON.parse(readFileSync(join(process.cwd(), 'src/locales/en.json'), 'utf8'))
    const ru = JSON.parse(readFileSync(join(process.cwd(), 'src/locales/ru.json'), 'utf8'))

    const requiredKeys = [
      'action_edit_info',
      'fill_from_tracker',
      'reset_info',
      'reset_tags',
      'add_tag',
      'add_tags',
      'multi_tags_comma_separated',
      'select_tracker',
      'entry_not_tracked',
      'source_value_hint',
      'thumbnail_url',
      'entry_description',
      'entry_tags',
      'custom_info_saved',
      'custom_info_reset',
    ]

    for (const key of requiredKeys) {
      expect(en[key], `Missing en key: ${key}`).toBeTruthy()
      expect(ru[key], `Missing ru key: ${key}`).toBeTruthy()
    }
  })

  it('fetchTrackerMetadata handles AniList GraphQL responses', async () => {
    const fakeAnilistResponse = {
      data: {
        Media: {
          id: 98436,
          title: {
            userPreferred: 'Chainsaw Man',
            english: 'Chainsaw Man',
          },
          coverImage: {
            extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx117580.jpg',
          },
          description: 'Denji was a small-time devil hunter<br>trying to survive.',
          status: 'RELEASING',
          genres: ['Action', 'Supernatural'],
          staff: {
            edges: [
              {
                role: 'Story & Art',
                node: { name: { userPreferred: 'Tatsuki Fujimoto' } },
              },
            ],
          },
        },
      },
    }

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeAnilistResponse,
    }) as any

    try {
      const tracker: Tracker = {
        id: 2,
        name: 'AniList',
        icon: '',
        isLoggedIn: true,
        authUrl: null,
        supportsPrivateTracking: true,
        supportsReadingDates: true,
        statuses: [],
        scores: [],
        supportsTrackDeletion: false,
      }

      const record: TrackerRecord = {
        id: 101,
        trackerId: 2,
        title: 'Chainsaw Man',
        status: 1,
        score: 9,
        displayScore: '9',
        lastChapterRead: 100,
        totalChapters: 0,
        startDate: '0',
        finishDate: '0',
        private: false,
        remoteUrl: 'https://anilist.co/manga/98436',
      }

      const meta = await fetchTrackerMetadata('http://localhost:4567', tracker, record)
      expect(meta).not.toBeNull()
      expect(meta?.title).toBe('Chainsaw Man')
      expect(meta?.thumbnailUrl).toContain('bx117580.jpg')
      expect(meta?.description).toBe('Denji was a small-time devil hunter\ntrying to survive.')
      expect(meta?.authors).toBe('Tatsuki Fujimoto')
      expect(meta?.artists).toBe('Tatsuki Fujimoto')
      expect(meta?.status).toBe(1) // ONGOING
      expect(meta?.tags).toEqual(['Action', 'Supernatural'])
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
