<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Manga } from '@/core/api/types'
import { useRelatedMangas, type RelatedMangaItem } from '../composables/useRelatedMangas'
import { stringResource } from '@/core/i18n'

/**
 * Pixel-parity implementation of Komikku's `RelatedMangasRow.kt`.
 *
 * Renders a horizontal scrolling row of related manga suggestions:
 * - Header with section title ("Related manga" / "Suggestions") and "See all" button
 * - Horizontal carousel of cards with cover (2:3 aspect ratio), in-library heart badge,
 *   relation badge ("Sequel", "Prequel", etc.), and title
 * - Shimmer skeleton when loading
 * - Clicking a card navigates to manga entry if in library, or executes global search
 */
const props = withDefaults(defineProps<{
  manga: Manga
  apiUrl?: string
}>(), {
  apiUrl: '',
})

const router = useRouter()
const { loading, items } = useRelatedMangas(() => props.manga, () => props.apiUrl)

const hasItems = computed(() => items.value.length > 0)
const displayItems = computed(() => items.value.slice(0, 16))

function onSeeAll() {
  if (!props.manga?.id) return
  void router.push(`/manga/${props.manga.id}/suggestions`)
}

function onCardClick(item: RelatedMangaItem) {
  if (item.mangaId) {
    void router.push(`/manga/${item.mangaId}`)
  } else {
    void router.push({
      path: '/browse/global-search',
      query: { q: item.title },
    })
  }
}
</script>

<template>
  <section
    v-if="loading || hasItems"
    class="related-mangas-row"
    aria-label="Related manga suggestions"
  >
    <!-- Header -->
    <div class="related-mangas-header" role="button" tabindex="0" @click="onSeeAll" @keydown.enter="onSeeAll">
      <div class="related-mangas-title-group">
        <h3 class="related-mangas-title">
          {{ stringResource('pref_source_related_mangas') }}
        </h3>
        <span v-if="items.length" class="related-mangas-count">
          ({{ items.length }})
        </span>
      </div>

      <button
        type="button"
        class="related-mangas-see-all-btn"
        aria-label="See all suggestions"
        @click.stop="onSeeAll"
      >
        <span class="related-mangas-see-all-text">
          {{ stringResource('related_mangas_see_all') }}
        </span>
        <span class="material-symbols-rounded related-mangas-arrow" aria-hidden="true">
          arrow_forward
        </span>
      </button>
    </div>

    <!-- Loading Shimmer / Skeletons -->
    <div v-if="loading && !hasItems" class="related-mangas-carousel" role="status" aria-busy="true">
      <div v-for="i in 6" :key="`skeleton-${i}`" class="related-manga-card related-manga-card--skeleton">
        <div class="related-manga-cover-box skeleton-box" />
        <div class="related-manga-title-skeleton skeleton-line" />
      </div>
    </div>

    <!-- Manga Cards Carousel -->
    <div v-else class="related-mangas-carousel">
      <div
        v-for="item in displayItems"
        :key="item.id"
        class="related-manga-card"
        role="button"
        tabindex="0"
        :title="item.title"
        @click="onCardClick(item)"
        @keydown.enter="onCardClick(item)"
      >
        <div class="related-manga-cover-box">
          <img
            v-if="item.coverUrl"
            :src="item.coverUrl"
            :alt="item.title"
            class="related-manga-cover"
            loading="lazy"
            decoding="async"
            @error="(e: Event) => { ((e.target as HTMLElement).style.display = 'none') }"
          />
          <div class="related-manga-cover-placeholder">
            <span class="material-symbols-rounded" aria-hidden="true">auto_stories</span>
          </div>

          <!-- In-Library Badge -->
          <div v-if="item.inLibrary" class="related-manga-badge related-manga-badge--favorite" title="In library">
            <span class="material-symbols-rounded" aria-hidden="true">favorite</span>
          </div>

          <!-- Relation Badge -->
          <div v-if="item.relationType" class="related-manga-badge related-manga-badge--relation">
            {{ item.relationType }}
          </div>

          <!-- Score Badge -->
          <div v-else-if="item.score" class="related-manga-badge related-manga-badge--score">
            ★ {{ item.score }}%
          </div>
        </div>

        <span class="related-manga-card-title">
          {{ item.title }}
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.related-mangas-row {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 12px 0 8px;
  box-sizing: border-box;
  overflow: hidden;
}

/* Header */
.related-mangas-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 16px 8px;
  cursor: pointer;
  user-select: none;
  border-radius: 8px;
  transition: background-color 0.15s ease;
}

.related-mangas-header:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.related-mangas-title-group {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.related-mangas-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  letter-spacing: 0.0125em;
  color: rgb(var(--v-theme-on-surface));
}

.related-mangas-count {
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface-variant));
}

.related-mangas-see-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  margin: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 16px;
  color: rgb(var(--v-theme-primary));
  font-size: 13px;
  font-weight: 600;
  transition: background-color 0.15s ease, opacity 0.15s ease;
}

.related-mangas-see-all-btn:hover {
  background-color: rgba(var(--v-theme-primary), 0.08);
}

.related-mangas-arrow {
  font-size: 18px;
}

/* Carousel */
.related-mangas-carousel {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 16px 12px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}

.related-mangas-carousel::-webkit-scrollbar {
  height: 4px;
}

.related-mangas-carousel::-webkit-scrollbar-thumb {
  background: rgba(var(--v-theme-on-surface), 0.2);
  border-radius: 4px;
}

/* Card */
.related-manga-card {
  flex: 0 0 100px;
  width: 100px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  scroll-snap-align: start;
  user-select: none;
  border-radius: 8px;
  padding: 2px;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.related-manga-card:hover {
  transform: translateY(-2px);
}

.related-manga-card:active {
  transform: translateY(0);
}

.related-manga-cover-box {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 8px;
  overflow: hidden;
  background-color: rgba(var(--v-theme-on-surface), 0.08);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.16);
}

.related-manga-cover {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
}

.related-manga-cover-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(var(--v-theme-on-surface), 0.25);
}

.related-manga-cover-placeholder .material-symbols-rounded {
  font-size: 32px;
}

/* Badges */
.related-manga-badge {
  position: absolute;
  z-index: 2;
  font-size: 10px;
  font-weight: 600;
  line-height: 14px;
  padding: 2px 6px;
  border-radius: 4px;
  backdrop-filter: blur(4px);
  pointer-events: none;
}

.related-manga-badge--favorite {
  top: 4px;
  left: 4px;
  background: rgba(var(--v-theme-primary-container), 0.9);
  color: rgb(var(--v-theme-on-primary-container));
  padding: 2px 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.related-manga-badge--favorite .material-symbols-rounded {
  font-size: 14px;
  font-variation-settings: 'FILL' 1;
}

.related-manga-badge--relation {
  bottom: 4px;
  left: 4px;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  max-width: 90px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.related-manga-badge--score {
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.72);
  color: #ffd54f;
}

.related-manga-card-title {
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
}

/* Skeleton animation */
.related-manga-card--skeleton {
  pointer-events: none;
}

.skeleton-box {
  background: linear-gradient(
    90deg,
    rgba(var(--v-theme-on-surface), 0.06) 25%,
    rgba(var(--v-theme-on-surface), 0.12) 50%,
    rgba(var(--v-theme-on-surface), 0.06) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-line {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    rgba(var(--v-theme-on-surface), 0.06) 25%,
    rgba(var(--v-theme-on-surface), 0.12) 50%,
    rgba(var(--v-theme-on-surface), 0.06) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  margin-top: 4px;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
