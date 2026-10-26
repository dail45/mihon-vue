<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { useLibraryStore } from '@/features/library/stores/library'
import type { DisplayMode } from '@/features/settings/stores/preferences'
import { useRelatedMangas, type RelatedMangaItem } from '../composables/useRelatedMangas'
import { stringResource } from '@/core/i18n'
import MihonEmptyScreen from '@/core/components/MihonEmptyScreen.vue'
import ChangeCategoryDialog from '@/features/library/components/ChangeCategoryDialog.vue'
import DuplicateMangaDialog from '@/features/library/components/DuplicateMangaDialog.vue'
import { findDuplicateManga, type DuplicateManga } from '@/core/utils/duplicates'
import { stateSelection, type CategorySelection } from '@/core/utils/categorySelection'
import type { Manga } from '@/core/api/types'

/**
 * Pixel-parity implementation of Komikku's `RelatedMangasScreen.kt`.
 *
 * Full grid view of related manga suggestions with:
 *  - Top bar with display mode toggle and bulk selection mode
 *  - Bulk selection action bar (Select All, Invert Selection, Add to Library)
 *  - Display modes: Comfortable grid, Compact grid, List
 *  - Selection checkmark overlay and primary selection border
 *  - Background duplicate check, category assignment, and library addition
 *  - Filter tabs: All, Relations, Recommendations
 */
const route = useRoute()
const router = useRouter()
const server = useSuwayomiStore()
const libraryStore = useLibraryStore()

const mangaId = computed(() => Number(route.params.id))
const currentManga = computed(() => {
  if (server.manga?.id === mangaId.value) return server.manga
  return server.library.find(m => m.id === mangaId.value) || null
})

// Ensure manga and library are loaded
watch(() => [mangaId.value, server.apiUrl], () => {
  if (mangaId.value && (!server.manga || server.manga.id !== mangaId.value)) {
    void server.loadManga(mangaId.value)
  }
  if (!server.library.length) {
    void server.loadLibrary()
  }
}, { immediate: true })

const {
  loading,
  error,
  items,
  relations,
  recommendations,
  refresh,
} = useRelatedMangas(currentManga, () => server.apiUrl)

// Tabs filter: 'all' | 'relations' | 'recommendations'
const activeTab = ref<'all' | 'relations' | 'recommendations'>('all')

const filteredItems = computed<RelatedMangaItem[]>(() => {
  if (activeTab.value === 'relations') return relations.value
  if (activeTab.value === 'recommendations') return recommendations.value
  return items.value
})

// Display mode
const displayMode = ref<DisplayMode>('comfortable')

// Bulk Selection Mode
const selectionMode = ref(false)
const selectedKeys = ref<Set<string | number>>(new Set())

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) {
    selectedKeys.value.clear()
  }
}

function toggleItemSelection(item: RelatedMangaItem) {
  const next = new Set(selectedKeys.value)
  if (next.has(item.id)) {
    next.delete(item.id)
  } else {
    next.add(item.id)
  }
  selectedKeys.value = next
}

function selectAll() {
  const next = new Set(selectedKeys.value)
  for (const item of filteredItems.value) {
    next.add(item.id)
  }
  selectedKeys.value = next
}

function invertSelection() {
  const next = new Set<string | number>()
  for (const item of filteredItems.value) {
    if (!selectedKeys.value.has(item.id)) {
      next.add(item.id)
    }
  }
  selectedKeys.value = next
}

function clearSelection() {
  selectedKeys.value.clear()
  selectionMode.value = false
}

// Long-press handling (500ms)
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let longPressFired = false

function startLongPress(item: RelatedMangaItem) {
  longPressFired = false
  if (longPressTimer) clearTimeout(longPressTimer)
  longPressTimer = setTimeout(() => {
    longPressTimer = null
    longPressFired = true
    if (!selectionMode.value) {
      selectionMode.value = true
    }
    toggleItemSelection(item)
    try { navigator.vibrate?.(20) } catch { /* ignore */ }
  }, 500)
}

function cancelLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function onItemClick(item: RelatedMangaItem) {
  if (longPressFired) {
    longPressFired = false
    return
  }

  if (selectionMode.value) {
    toggleItemSelection(item)
    return
  }

  // Navigate to manga details if already in library, otherwise global search
  if (item.mangaId) {
    void router.push(`/manga/${item.mangaId}`)
  } else {
    void router.push({
      path: '/browse/global-search',
      query: { q: item.title },
    })
  }
}

// Bulk Favorite & Category assignment
const changeCategoryOpen = ref(false)
const duplicateOpen = ref(false)
const duplicateEntries = ref<DuplicateManga[]>([])
const pendingMangaToAdd = ref<RelatedMangaItem[]>([])
const snackbarMessage = ref('')
const snackbarVisible = ref(false)

const categorySelection = computed<CategorySelection[]>(() => {
  return server.categories
    .filter(c => c.id !== 0 && c.id !== -1)
    .map(category => stateSelection(category, false))
})

async function onBulkFavorite() {
  if (!selectedKeys.value.size) return

  const selectedItems = items.value.filter(it => selectedKeys.value.has(it.id))
  pendingMangaToAdd.value = selectedItems

  // Check for duplicates in library among selected items
  const foundDuplicates: DuplicateManga[] = []
  for (const item of selectedItems) {
    const candidate = { id: item.mangaId ?? 0, title: item.title } as Manga
    const dupes = findDuplicateManga(candidate, server.library)
    for (const d of dupes) {
      if (!foundDuplicates.some(f => f.manga.id === d.manga.id)) {
        foundDuplicates.push(d)
      }
    }
  }

  if (foundDuplicates.length > 0) {
    duplicateEntries.value = foundDuplicates
    duplicateOpen.value = true
    return
  }

  await proceedWithBulkFavorite()
}

async function proceedWithBulkFavorite() {
  const nonSystemCategories = server.categories.filter(c => c.id !== 0 && c.id !== -1)
  if (nonSystemCategories.length > 0) {
    changeCategoryOpen.value = true
    return
  }

  await executeAddFavorite([], [])
}

async function executeAddFavorite(addToCategories: number[], removeFromCategories: number[]) {
  const toAdd = pendingMangaToAdd.value
  let addedCount = 0

  for (const item of toAdd) {
    if (item.mangaId) {
      const success = await libraryStore.setLibraryMembership(item.mangaId, true)
      if (success) {
        if (addToCategories.length || removeFromCategories.length) {
          await server.setMangaCategories([item.mangaId], addToCategories, removeFromCategories)
        }
        addedCount++
      }
    }
  }

  clearSelection()
  snackbarMessage.value = stringResource('related_mangas_added_to_library', addedCount || toAdd.length)
  snackbarVisible.value = true
  await refresh()
}

function onCategoryConfirm(selectedCategoryIds: number[]) {
  changeCategoryOpen.value = false
  const allCategoryIds = server.categories.filter(c => c.id !== 0 && c.id !== -1).map(c => c.id)
  const removeIds = allCategoryIds.filter(id => !selectedCategoryIds.includes(id))
  void executeAddFavorite(selectedCategoryIds, removeIds)
}

function onDuplicateConfirm() {
  duplicateOpen.value = false
  void proceedWithBulkFavorite()
}

function onNavigateUp() {
  if (mangaId.value) {
    void router.push(`/manga/${mangaId.value}`)
  } else {
    router.back()
  }
}
</script>

<template>
  <div class="related-mangas-screen">
    <!-- Top App Bar -->
    <header class="related-mangas-toolbar" :class="{ 'related-mangas-toolbar--selection': selectionMode }">
      <!-- Standard Mode -->
      <template v-if="!selectionMode">
        <button
          type="button"
          class="toolbar-btn"
          aria-label="Back"
          @click="onNavigateUp"
        >
          <span class="material-symbols-rounded">arrow_back</span>
        </button>

        <div class="toolbar-title-box">
          <h1 class="toolbar-title">
            {{ currentManga?.title || stringResource('pref_source_related_mangas') }}
          </h1>
          <span class="toolbar-subtitle">
            {{ stringResource('pref_source_related_mangas') }}
          </span>
        </div>

        <div class="toolbar-actions">
          <!-- Display Mode Menu -->
          <v-menu location="bottom end">
            <template #activator="{ props: menuProps }">
              <button
                type="button"
                class="toolbar-btn"
                aria-label="Display mode"
                v-bind="menuProps"
              >
                <span class="material-symbols-rounded">
                  {{ displayMode === 'compact' ? 'view_module' : displayMode === 'comfortable' ? 'grid_view' : 'view_list' }}
                </span>
              </button>
            </template>
            <v-list density="compact">
              <v-list-item
                prepend-icon="grid_view"
                :active="displayMode === 'comfortable'"
                title="Comfortable grid"
                @click="displayMode = 'comfortable'"
              />
              <v-list-item
                prepend-icon="view_module"
                :active="displayMode === 'compact'"
                title="Compact grid"
                @click="displayMode = 'compact'"
              />
              <v-list-item
                prepend-icon="view_list"
                :active="displayMode === 'list'"
                title="List"
                @click="displayMode = 'list'"
              />
            </v-list>
          </v-menu>

          <!-- Toggle Selection Mode -->
          <button
            type="button"
            class="toolbar-btn"
            aria-label="Selection mode"
            @click="toggleSelectionMode"
          >
            <span class="material-symbols-rounded">checklist</span>
          </button>
        </div>
      </template>

      <!-- Selection Mode -->
      <template v-else>
        <button
          type="button"
          class="toolbar-btn"
          aria-label="Cancel selection"
          @click="clearSelection"
        >
          <span class="material-symbols-rounded">close</span>
        </button>

        <div class="toolbar-title-box">
          <h1 class="toolbar-title">
            {{ selectedKeys.size }} {{ stringResource('selected') }}
          </h1>
        </div>

        <div class="toolbar-actions">
          <button
            type="button"
            class="toolbar-btn"
            :title="stringResource('action_select_all')"
            @click="selectAll"
          >
            <span class="material-symbols-rounded">select_all</span>
          </button>

          <button
            type="button"
            class="toolbar-btn"
            :title="stringResource('action_select_inverse')"
            @click="invertSelection"
          >
            <span class="material-symbols-rounded">flip_to_back</span>
          </button>

          <button
            type="button"
            class="toolbar-btn toolbar-btn--primary"
            title="Add to library"
            :disabled="!selectedKeys.size"
            @click="onBulkFavorite"
          >
            <span class="material-symbols-rounded">favorite</span>
          </button>
        </div>
      </template>
    </header>

    <!-- Filter Tabs -->
    <div v-if="items.length > 0" class="related-mangas-tabs" role="tablist">
      <button
        type="button"
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'all' }"
        role="tab"
        :aria-selected="activeTab === 'all'"
        @click="activeTab = 'all'"
      >
        <span>All</span>
        <span class="tab-badge">{{ items.length }}</span>
      </button>

      <button
        v-if="relations.length"
        type="button"
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'relations' }"
        role="tab"
        :aria-selected="activeTab === 'relations'"
        @click="activeTab = 'relations'"
      >
        <span>{{ stringResource('related_mangas_relations') }}</span>
        <span class="tab-badge">{{ relations.length }}</span>
      </button>

      <button
        v-if="recommendations.length"
        type="button"
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'recommendations' }"
        role="tab"
        :aria-selected="activeTab === 'recommendations'"
        @click="activeTab = 'recommendations'"
      >
        <span>{{ stringResource('related_mangas_recommendations') }}</span>
        <span class="tab-badge">{{ recommendations.length }}</span>
      </button>
    </div>

    <!-- Main Content -->
    <main class="related-mangas-body">
      <!-- Loading State -->
      <div v-if="loading && !filteredItems.length" class="loading-container">
        <v-progress-circular indeterminate color="primary" size="40" width="4" />
      </div>

      <!-- Error State -->
      <div v-else-if="error && !filteredItems.length" class="error-container">
        <v-alert type="error" variant="tonal" class="mb-4">
          {{ error }}
        </v-alert>
        <v-btn color="primary" variant="text" prepend-icon="refresh" @click="refresh">
          Retry
        </v-btn>
      </div>

      <!-- Empty State -->
      <MihonEmptyScreen
        v-else-if="!filteredItems.length"
        :message="stringResource('related_mangas_no_results')"
        action-label="Refresh"
        @action="refresh"
      />

      <!-- Grid / List Content -->
      <div
        v-else
        class="items-container"
        :class="[`items-container--${displayMode}`]"
      >
        <!-- Cards -->
        <article
          v-for="item in filteredItems"
          :key="item.id"
          class="item-card"
          :class="{
            'item-card--selected': selectedKeys.has(item.id),
            'item-card--selection-mode': selectionMode,
          }"
          role="button"
          tabindex="0"
          @pointerdown="startLongPress(item)"
          @pointerup="cancelLongPress"
          @pointerleave="cancelLongPress"
          @click="onItemClick(item)"
          @keydown.enter="onItemClick(item)"
        >
          <!-- Cover Box -->
          <div class="item-cover-box">
            <img
              v-if="item.coverUrl"
              :src="item.coverUrl"
              :alt="item.title"
              class="item-cover"
              loading="lazy"
              decoding="async"
              @error="(e: Event) => { ((e.target as HTMLElement).style.display = 'none') }"
            />
            <div class="item-cover-placeholder">
              <span class="material-symbols-rounded">auto_stories</span>
            </div>

            <!-- In-Library Badge -->
            <div v-if="item.inLibrary" class="card-badge card-badge--favorite">
              <span class="material-symbols-rounded">favorite</span>
            </div>

            <!-- Relation Badge -->
            <div v-if="item.relationType && displayMode !== 'list'" class="card-badge card-badge--relation">
              {{ item.relationType }}
            </div>

            <!-- Score Badge -->
            <div v-else-if="item.score && displayMode !== 'list'" class="card-badge card-badge--score">
              ★ {{ item.score }}%
            </div>

            <!-- Selection Checkmark Overlay -->
            <div v-if="selectedKeys.has(item.id)" class="selection-overlay">
              <span class="material-symbols-rounded selection-check">check_circle</span>
            </div>

            <!-- Compact Grid Overlay Title -->
            <div v-if="displayMode === 'compact'" class="compact-title-overlay">
              <span class="compact-title">{{ item.title }}</span>
            </div>
          </div>

          <!-- Metadata (Comfortable Grid & List) -->
          <div v-if="displayMode !== 'compact'" class="item-info">
            <h2 class="item-title">{{ item.title }}</h2>
            <div class="item-meta">
              <span v-if="item.relationType" class="meta-tag">{{ item.relationType }}</span>
              <span v-if="item.score" class="meta-score">★ {{ item.score }}%</span>
              <span v-if="item.genres?.length" class="meta-genre">{{ item.genres.slice(0, 2).join(', ') }}</span>
            </div>
            <p v-if="displayMode === 'list' && item.description" class="item-description">
              {{ item.description }}
            </p>
          </div>
        </article>
      </div>
    </main>

    <!-- Dialogs -->
    <ChangeCategoryDialog
      v-model="changeCategoryOpen"
      :initial-selection="categorySelection"
      @confirm="onCategoryConfirm"
      @edit-categories="router.push('/settings/library/categories')"
    />

    <DuplicateMangaDialog
      v-model="duplicateOpen"
      :duplicates="duplicateEntries"
      @confirm="onDuplicateConfirm"
    />

    <!-- Snackbar -->
    <v-snackbar v-model="snackbarVisible" :timeout="3000">
      {{ snackbarMessage }}
    </v-snackbar>
  </div>
</template>

<style scoped>
.related-mangas-screen {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}

/* Toolbar */
.related-mangas-toolbar {
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 8px;
  background-color: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  position: sticky;
  top: 0;
  z-index: 10;
  transition: background-color 0.2s ease;
}

.related-mangas-toolbar--selection {
  background-color: rgb(var(--v-theme-surface-container-high, var(--v-theme-surface)));
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 24px;
  border: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.toolbar-btn:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.08);
}

.toolbar-btn--primary {
  color: rgb(var(--v-theme-primary));
}

.toolbar-title-box {
  flex: 1;
  min-width: 0;
  margin: 0 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.toolbar-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 24px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toolbar-subtitle {
  font-size: 12px;
  line-height: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Tabs */
.related-mangas-tabs {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  background-color: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  overflow-x: auto;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid rgba(var(--v-theme-outline), 0.38);
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.tab-btn--active {
  background-color: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
  border-color: transparent;
}

.tab-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(var(--v-theme-on-surface), 0.08);
}

.tab-btn--active .tab-badge {
  background: rgba(var(--v-theme-on-secondary-container), 0.12);
}

/* Body */
.related-mangas-body {
  flex: 1;
  padding: 12px 16px 32px;
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 16px;
}

/* Containers */
.items-container--comfortable,
.items-container--compact {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 12px;
}

@media (min-width: 600px) {
  .items-container--comfortable,
  .items-container--compact {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 16px;
  }
}

.items-container--list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Item Card */
.item-card {
  display: flex;
  position: relative;
  cursor: pointer;
  user-select: none;
  border-radius: 10px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.items-container--comfortable .item-card,
.items-container--compact .item-card {
  flex-direction: column;
}

.items-container--list .item-card {
  flex-direction: row;
  align-items: center;
  gap: 16px;
  padding: 8px 12px;
  background-color: rgba(var(--v-theme-on-surface), 0.02);
}

.items-container--list .item-card:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.06);
}

/* Selection state */
.item-card--selected .item-cover-box {
  outline: 3px solid rgb(var(--v-theme-primary));
  outline-offset: -1px;
}

.item-card--selected .item-cover {
  opacity: 0.72;
}

.selection-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(var(--v-theme-primary), 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 4;
}

.selection-check {
  font-size: 36px;
  color: rgb(var(--v-theme-primary));
  font-variation-settings: 'FILL' 1;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
}

/* Cover Box */
.item-cover-box {
  position: relative;
  aspect-ratio: 2 / 3;
  border-radius: 8px;
  overflow: hidden;
  background-color: rgba(var(--v-theme-on-surface), 0.08);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.14);
}

.items-container--list .item-cover-box {
  width: 64px;
  flex: 0 0 64px;
}

.item-cover {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
}

.item-cover-placeholder {
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

/* Badges */
.card-badge {
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

.card-badge--favorite {
  top: 6px;
  left: 6px;
  background: rgba(var(--v-theme-primary-container), 0.9);
  color: rgb(var(--v-theme-on-primary-container));
  padding: 2px 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-badge--favorite .material-symbols-rounded {
  font-size: 14px;
  font-variation-settings: 'FILL' 1;
}

.card-badge--relation {
  bottom: 6px;
  left: 6px;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  max-width: 90px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-badge--score {
  bottom: 6px;
  right: 6px;
  background: rgba(0, 0, 0, 0.72);
  color: #ffd54f;
}

/* Compact title overlay */
.compact-title-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 16px 8px 6px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.85), transparent);
  z-index: 2;
}

.compact-title {
  color: #fff;
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Metadata */
.item-info {
  display: flex;
  flex-direction: column;
  padding: 6px 2px;
  min-width: 0;
  flex: 1;
}

.item-title {
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
}

.items-container--list .item-title {
  font-size: 15px;
  line-height: 20px;
  font-weight: 600;
}

.item-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
  font-size: 11px;
}

.meta-tag {
  background: rgba(var(--v-theme-on-surface), 0.08);
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.meta-score {
  color: #f59e0b;
  font-weight: 600;
}

.meta-genre {
  color: rgb(var(--v-theme-on-surface-variant));
}

.item-description {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
