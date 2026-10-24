import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  cleanTitle,
  extractKeywords,
  formatRelationType,
} from '@/features/manga/composables/useRelatedMangas'
import en from '@/locales/en.json'
import ru from '@/locales/ru.json'

const mangaViewSource = readFileSync(resolve(process.cwd(), 'src/features/manga/views/MangaView.vue'), 'utf8')
const relatedRowSource = readFileSync(resolve(process.cwd(), 'src/features/manga/components/RelatedMangasRow.vue'), 'utf8')
const relatedViewSource = readFileSync(resolve(process.cwd(), 'src/features/manga/views/RelatedMangasView.vue'), 'utf8')
const routerSource = readFileSync(resolve(process.cwd(), 'src/router/index.ts'), 'utf8')

describe('4.5 Related Manga Suggestions (Komikku parity)', () => {
  describe('Title Normalization & Keyword Heuristics', () => {
    it('cleans noisy suffixes from titles (e.g. Official, Digital, Webcomic)', () => {
      expect(cleanTitle('Chainsaw Man (Official)')).toBe('Chainsaw Man')
      expect(cleanTitle('One Piece [Digital]')).toBe('One Piece')
      expect(cleanTitle('Solo Leveling (Colored)')).toBe('Solo Leveling')
      expect(cleanTitle('Omniscient Reader (Webcomic)')).toBe('Omniscient Reader')
      expect(cleanTitle('Overlord [Light Novel]')).toBe('Overlord')
    })

    it('extracts significant keywords according to Komikku heuristic', () => {
      const keywords = extractKeywords('Attack on Titan: Before the Fall (Official)')
      expect(keywords).toContain('attack')
      expect(keywords).toContain('titan')
      expect(keywords).toContain('before')
      expect(keywords).toContain('fall')
      // Short words (< 3 chars) or digits only must be excluded
      expect(keywords).not.toContain('on')
    })

    it('formats AniList relation types into user-friendly names', () => {
      expect(formatRelationType('SEQUEL')).toBe('Sequel')
      expect(formatRelationType('PREQUEL')).toBe('Prequel')
      expect(formatRelationType('SPIN_OFF')).toBe('Spin-off')
      expect(formatRelationType('SIDE_STORY')).toBe('Side story')
      expect(formatRelationType('ALTERNATIVE')).toBe('Alternative')
      expect(formatRelationType('ADAPTATION')).toBe('Adaptation')
      expect(formatRelationType(null)).toBeNull()
    })
  })

  describe('RelatedMangasRow.vue Component Parity', () => {
    it('renders horizontal carousel with header and see all action', () => {
      expect(relatedRowSource).toContain('pref_source_related_mangas')
      expect(relatedRowSource).toContain('related_mangas_see_all')
      expect(relatedRowSource).toContain('onSeeAll')
      expect(relatedRowSource).toContain('/suggestions')
    })

    it('uses 2:3 book aspect ratio covers and supports in-library and relation badges', () => {
      expect(relatedRowSource).toContain('aspect-ratio: 2 / 3')
      expect(relatedRowSource).toContain('related-manga-badge--favorite')
      expect(relatedRowSource).toContain('related-manga-badge--relation')
      expect(relatedRowSource).toContain('related-manga-badge--score')
    })

    it('navigates to manga page if in library or executes global search if external', () => {
      expect(relatedRowSource).toContain('router.push(`/manga/${item.mangaId}`)')
      expect(relatedRowSource).toContain("path: '/browse/global-search'")
      expect(relatedRowSource).toContain('query: { q: item.title }')
    })
  })

  describe('RelatedMangasView.vue Full Screen Parity', () => {
    it('implements normal top app bar and selection mode toolbar', () => {
      expect(relatedViewSource).toContain('related-mangas-toolbar--selection')
      expect(relatedViewSource).toContain('toggleSelectionMode')
      expect(relatedViewSource).toContain('clearSelection')
      expect(relatedViewSource).toContain('action_select_all')
      expect(relatedViewSource).toContain('action_select_inverse')
    })

    it('supports display mode toggling: comfortable, compact, and list', () => {
      expect(relatedViewSource).toContain('Comfortable grid')
      expect(relatedViewSource).toContain('Compact grid')
      expect(relatedViewSource).toContain('items-container--comfortable')
      expect(relatedViewSource).toContain('items-container--compact')
      expect(relatedViewSource).toContain('items-container--list')
    })

    it('displays selection checkmark overlay and primary selection border on selected cards', () => {
      expect(relatedViewSource).toContain('item-card--selected')
      expect(relatedViewSource).toContain('selection-overlay')
      expect(relatedViewSource).toContain('check_circle')
      expect(relatedViewSource).toContain('outline: 3px solid rgb(var(--v-theme-primary))')
    })

    it('integrates duplicate checking and category assignment on bulk favorite', () => {
      expect(relatedViewSource).toContain('findDuplicateManga')
      expect(relatedViewSource).toContain('ChangeCategoryDialog')
      expect(relatedViewSource).toContain('DuplicateMangaDialog')
      expect(relatedViewSource).toContain('onBulkFavorite')
    })

    it('supports tabbed filtering between All, Relations, and Recommendations', () => {
      expect(relatedViewSource).toContain('related-mangas-tabs')
      expect(relatedViewSource).toContain('related_mangas_relations')
      expect(relatedViewSource).toContain('related_mangas_recommendations')
    })
  })

  describe('MangaView.vue Embedding', () => {
    it('embeds RelatedMangasRow in MangaView.vue between synopsis and chapter list', () => {
      expect(mangaViewSource).toContain("import RelatedMangasRow from '../components/RelatedMangasRow.vue'")
      expect(mangaViewSource).toContain('<RelatedMangasRow')
      expect(mangaViewSource).toContain(':manga="detail"')
      expect(mangaViewSource).toContain('v-if="detail && !isStubSource"')
    })
  })

  describe('Router Registration', () => {
    it('registers /manga/:id/suggestions route pointing to RelatedMangasView.vue', () => {
      expect(routerSource).toMatch(/\/manga\/:id\(\\\\d\+\)\/suggestions/)
      expect(routerSource).toContain('RelatedMangasView.vue')
    })
  })

  describe('Localization Parity (en.json & ru.json)', () => {
    it('contains all required related manga keys in en.json', () => {
      expect((en as any).pref_source_related_mangas).toBe('Related manga')
      expect((en as any).related_mangas_see_all).toBe('See all')
      expect((en as any).related_mangas_relations).toBe('Relations')
      expect((en as any).related_mangas_recommendations).toBe('Recommendations')
      expect((en as any).related_mangas_no_results).toBe('No suggestions found')
      expect((en as any).related_mangas_added_to_library).toContain('{0}')
    })

    it('contains all required related manga keys in ru.json', () => {
      expect((ru as any).pref_source_related_mangas).toBe('Похожая манга')
      expect((ru as any).related_mangas_see_all).toBe('Все')
      expect((ru as any).related_mangas_relations).toBe('Связанное')
      expect((ru as any).related_mangas_recommendations).toBe('Рекомендации')
      expect((ru as any).related_mangas_no_results).toBe('Рекомендации не найдены')
      expect((ru as any).related_mangas_added_to_library).toContain('{0}')
    })
  })
})
