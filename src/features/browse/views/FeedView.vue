<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useFeedStore, type FeedEntry } from '../stores/feed'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { useSavedSearchesStore } from '../stores/savedSearches'
import GlobalSearchResultItem from '../components/GlobalSearchResultItems.vue'
import GlobalSearchCardRow from '../components/GlobalSearchCardRow.vue'
import GlobalSearchLoadingResultItem from '../components/GlobalSearchLoadingResultItem.vue'
import GlobalSearchErrorResultItem from '../components/GlobalSearchErrorResultItem.vue'
import FeedAddDialog from '../components/FeedAddDialog.vue'
import FeedOrderScreen from '../components/FeedOrderScreen.vue'
import BulkSelectionToolbar from '../components/BulkSelectionToolbar.vue'
import DuplicateMangaDialog from '@/features/library/components/DuplicateMangaDialog.vue'
import ChangeCategoryDialog from '@/features/library/components/ChangeCategoryDialog.vue'
import MihonEmptyScreen from '@/core/components/MihonEmptyScreen.vue'
import { useBulkFavorite } from '../composables/useBulkFavorite'
import type { Manga } from '@/core/api/types'

const props = withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})

const { t } = useI18n()
const router = useRouter()
const feedStore = useFeedStore()
const server = useSuwayomiStore()
const savedSearchesStore = useSavedSearchesStore()
const bulkFavorite = useBulkFavorite()

const allFeedItems = computed<Manga[]>(() => {
  const list: Manga[] = []
  for (const res of Object.values(feedStore.results)) {
    if (res?.items) {
      list.push(...res.items)
    }
  }
  return list
})

function onMangaClick(manga: Manga) {
  if (bulkFavorite.selectionMode.value) {
    bulkFavorite.toggleSelection(manga)
  } else {
    void router.push(`/manga/${manga.id}`)
  }
}

function onMangaLongClick(manga: Manga) {
  try { navigator.vibrate?.(20) } catch { /* optional haptics */ }
  if (bulkFavorite.selectionMode.value) {
    bulkFavorite.toggleSelection(manga)
  } else {
    bulkFavorite.select(manga)
  }
}

const addDialogOpen = ref(false)
const isOrdering = ref(false)
const snackbar = ref('')
const snackbarTimer = ref<number | null>(null)

function showNotification(msg: string) {
  snackbar.value = msg
  if (snackbarTimer.value) clearTimeout(snackbarTimer.value)
  snackbarTimer.value = window.setTimeout(() => {
    snackbar.value = ''
  }, 4000)
}

function getFeedTitle(feed: FeedEntry): string {
  if (feed.title) return feed.title
  if (feed.feedType === 'saved_search') {
    const saved = feed.savedSearchId ? savedSearchesStore.getSearchById(feed.savedSearchId) : null
    return saved?.name || 'Saved search'
  }
  const source = server.sources.find(s => s.id === feed.sourceId)
  return source?.name || feed.sourceId
}

function getFeedSubtitle(feed: FeedEntry): string {
  const source = server.sources.find(s => s.id === feed.sourceId)
  const sourceName = source?.name || feed.sourceId
  if (feed.feedType === 'latest') return `${sourceName} • ${t('latest', 'Latest')}`
  if (feed.feedType === 'popular') return `${sourceName} • ${t('popular', 'Popular')}`
  if (feed.feedType === 'saved_search') return `${sourceName} • ${t('feed_type_saved_search', 'Saved search')}`
  return sourceName
}

function feedTargetRoute(feed: FeedEntry) {
  if (feed.feedType === 'latest') {
    return { path: `/browse/source/${encodeURIComponent(feed.sourceId)}`, query: { mode: 'latest' } }
  }
  if (feed.feedType === 'popular') {
    return { path: `/browse/source/${encodeURIComponent(feed.sourceId)}`, query: { mode: 'popular' } }
  }
  if (feed.feedType === 'saved_search' && feed.savedSearchId) {
    return { path: `/browse/source/${encodeURIComponent(feed.sourceId)}`, query: { savedSearch: feed.savedSearchId } }
  }
  return { path: `/browse/source/${encodeURIComponent(feed.sourceId)}` }
}

function openAddDialog() {
  if (feedStore.isFull) {
    showNotification(t('too_many_in_feed', 'Too many sources in your feed, cannot add more than 20'))
    return
  }
  addDialogOpen.value = true
}

function onFeedAdded() {
  showNotification(t('saved_search_added_to_feed', 'Added to feed'))
}

async function refresh() {
  await feedStore.loadAllFeeds()
}

onMounted(() => {
  if (!feedStore.initialLoaded) {
    void feedStore.loadAllFeeds()
  }
})

defineExpose({
  openAddDialog,
  toggleReorder: () => { isOrdering.value = !isOrdering.value },
  refresh,
  isOrdering,
})
</script>

<template>
  <div class="feed-view">
    <!-- Komikku Bulk Selection Toolbar -->
    <BulkSelectionToolbar
      v-if="bulkFavorite.selectionMode.value"
      :selected-count="bulkFavorite.selectedCount.value"
      :is-running="bulkFavorite.isRunning.value"
      @clear-selection="bulkFavorite.clearSelection"
      @favorite="bulkFavorite.startAddFavorite(allFeedItems)"
      @select-all="bulkFavorite.selectAll(allFeedItems)"
      @reverse-selection="bulkFavorite.reverseSelection(allFeedItems)"
    />

    <!-- Local actions strip if not embedded -->
    <div v-else-if="!props.embedded" class="feed-actions-bar">
      <div class="feed-actions-title text-title-medium font-weight-medium">
        {{ isOrdering ? t('action_sort_feed', 'Sort feeds') : t('feed', 'Feed') }}
      </div>
      <div class="feed-actions-buttons">
        <template v-if="!isOrdering">
          <v-btn
            icon="checklist"
            variant="text"
            density="comfortable"
            :title="t('action_bulk_select', 'Bulk favorite')"
            :aria-label="t('action_bulk_select', 'Bulk favorite')"
            @click="bulkFavorite.toggleSelectionMode()"
          />
          <v-btn
            icon="add"
            variant="text"
            density="comfortable"
            :title="t('feed_add', 'Add feed')"
            :aria-label="t('feed_add', 'Add feed')"
            @click="openAddDialog"
          />
          <v-btn
            icon="swap_vert"
            variant="text"
            density="comfortable"
            :disabled="feedStore.feeds.length === 0"
            :title="t('action_sort_feed', 'Sort feeds')"
            :aria-label="t('action_sort_feed', 'Sort feeds')"
            @click="isOrdering = true"
          />
          <v-btn
            icon="refresh"
            variant="text"
            density="comfortable"
            title="Refresh"
            aria-label="Refresh"
            @click="refresh"
          />
        </template>
        <template v-else>
          <v-btn
            icon="close"
            variant="text"
            density="comfortable"
            title="Done"
            aria-label="Done"
            color="primary"
            @click="isOrdering = false"
          />
        </template>
      </div>
    </div>

    <!-- Reorder View -->
    <FeedOrderScreen
      v-if="isOrdering"
      @close="isOrdering = false"
    />

    <!-- Main Feed View -->
    <div v-else class="feed-content">
      <!-- Empty State -->
      <div v-if="feedStore.feeds.length === 0" class="feed-empty-wrap">
        <MihonEmptyScreen
          :message="t('feed_tab_empty', `You don't have any sources in your feed, navigate to the top right to add one`)"
          :action-label="t('action_add', 'Add')"
          @action="openAddDialog"
        />
      </div>

      <!-- Feed Lanes -->
      <div v-else class="feed-lanes">
        <div
          v-for="feed in feedStore.feeds"
          :key="feed.id"
          class="feed-lane"
        >
          <GlobalSearchResultItem
            :title="getFeedTitle(feed)"
            :subtitle="getFeedSubtitle(feed)"
            :to="feedTargetRoute(feed)"
          >
            <!-- Loading state -->
            <GlobalSearchLoadingResultItem
              v-if="feedStore.results[feed.id]?.loading"
            />

            <!-- Error state -->
            <GlobalSearchErrorResultItem
              v-else-if="feedStore.results[feed.id]?.error"
              :message="feedStore.results[feed.id]?.error!"
            />

            <!-- Empty results -->
            <GlobalSearchErrorResultItem
              v-else-if="feedStore.results[feed.id]?.items?.length === 0"
              :message="t('no_results_found', 'No results found')"
            />

            <!-- Result Cards Row -->
            <GlobalSearchCardRow
              v-else-if="feedStore.results[feed.id]?.items"
              :titles="feedStore.results[feed.id]?.items!"
              :selection="bulkFavorite.selectedIds.value"
              :selection-mode="bulkFavorite.selectionMode.value"
              :on-click="onMangaClick"
              :on-long-click="onMangaLongClick"
            />
          </GlobalSearchResultItem>
        </div>
      </div>
    </div>

    <!-- Feed Add Dialog -->
    <FeedAddDialog
      v-model="addDialogOpen"
      @added="onFeedAdded"
    />

    <!-- Komikku Bulk Favorite duplicate check and category dialogs -->
    <DuplicateMangaDialog
      v-model="bulkFavorite.duplicateDialogOpen.value"
      :manga="bulkFavorite.duplicateManga.value"
      :duplicates="bulkFavorite.duplicateEntries.value"
      :bulk="true"
      @confirm="bulkFavorite.confirmDuplicateAndContinue"
      @allow-all="bulkFavorite.allowAllDuplicatesAndContinue"
      @skip="bulkFavorite.skipDuplicateAndContinue"
      @skip-all="bulkFavorite.skipAllDuplicatesAndContinue"
      @cancel="bulkFavorite.cancelAdd"
    />

    <ChangeCategoryDialog
      v-model="bulkFavorite.changeCategoryOpen.value"
      :initial-selection="bulkFavorite.categorySelection.value"
      @confirm="bulkFavorite.confirmCategories"
      @edit-categories="router.push('/categories')"
    />

    <!-- Snackbar notification -->
    <v-snackbar
      :model-value="Boolean(snackbar)"
      timeout="4000"
      location="bottom"
      @update:model-value="val => { if (!val) snackbar = '' }"
    >
      {{ snackbar }}
    </v-snackbar>
  </div>
</template>

<style scoped>
.feed-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: calc(100dvh - 112px);
  padding-bottom: max(env(safe-area-inset-bottom, 0px), 16px);
}

.feed-actions-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant) / 0.5);
}

.feed-content {
  flex: 1 1 auto;
}

.feed-empty-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.feed-lanes {
  display: flex;
  flex-direction: column;
  padding-top: 8px;
}

.feed-lane {
  width: 100%;
}
</style>
