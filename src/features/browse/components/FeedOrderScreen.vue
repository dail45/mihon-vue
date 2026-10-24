<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFeedStore, type FeedEntry } from '../stores/feed'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { useSavedSearchesStore } from '../stores/savedSearches'
import MihonEmptyScreen from '@/core/components/MihonEmptyScreen.vue'

const emit = defineEmits<{
  (event: 'close'): void
}>()

const { t } = useI18n()
const feedStore = useFeedStore()
const server = useSuwayomiStore()
const savedSearchesStore = useSavedSearchesStore()

const deleteConfirmOpen = ref(false)
const pendingDeleteFeed = ref<FeedEntry | null>(null)

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

function askDelete(feed: FeedEntry) {
  pendingDeleteFeed.value = feed
  deleteConfirmOpen.value = true
}

function confirmDelete() {
  if (pendingDeleteFeed.value) {
    feedStore.removeFeed(pendingDeleteFeed.value.id)
    pendingDeleteFeed.value = null
  }
  deleteConfirmOpen.value = false
}

// Drag and drop state
const draggedIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart(index: number, event: DragEvent) {
  draggedIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(index: number, event: DragEvent) {
  event.preventDefault()
  if (draggedIndex.value === null || draggedIndex.value === index) return
  dragOverIndex.value = index
}

function onDragLeave(index: number) {
  if (dragOverIndex.value === index) {
    dragOverIndex.value = null
  }
}

function onDrop(index: number, event: DragEvent) {
  event.preventDefault()
  if (draggedIndex.value !== null && draggedIndex.value !== index) {
    feedStore.moveFeed(draggedIndex.value, index)
  }
  draggedIndex.value = null
  dragOverIndex.value = null
}

function onDragEnd() {
  draggedIndex.value = null
  dragOverIndex.value = null
}

function moveUp(index: number) {
  if (index > 0) {
    feedStore.moveFeed(index, index - 1)
  }
}

function moveDown(index: number) {
  if (index < feedStore.feeds.length - 1) {
    feedStore.moveFeed(index, index + 1)
  }
}
</script>

<template>
  <div class="feed-order-screen">
    <!-- Empty state if no feeds -->
    <div v-if="feedStore.feeds.length === 0" class="feed-order-empty">
      <MihonEmptyScreen
        :message="t('feed_empty', 'No feeds configured')"
        action-label="Done"
        @action="emit('close')"
      />
    </div>

    <!-- Reorderable List -->
    <div v-else class="feed-order-list">
      <div
        v-for="(feed, index) in feedStore.feeds"
        :key="feed.id"
        class="feed-order-item-wrap"
        :class="{
          'feed-order-item--dragging': draggedIndex === index,
          'feed-order-item--drag-over': dragOverIndex === index,
        }"
        draggable="true"
        @dragstart="onDragStart(index, $event)"
        @dragover="onDragOver(index, $event)"
        @dragleave="onDragLeave(index)"
        @drop="onDrop(index, $event)"
        @dragend="onDragEnd"
      >
        <v-card
          class="feed-order-item"
          variant="elevated"
          elevation="1"
          rounded="lg"
          color="surface-container"
        >
          <div class="feed-order-item-content">
            <!-- Drag Handle -->
            <div class="drag-handle" title="Drag to reorder" aria-label="Drag to reorder">
              <span class="material-symbols-rounded">drag_handle</span>
            </div>

            <!-- Up / Down buttons for keyboard and quick access -->
            <div class="feed-order-arrows">
              <v-btn
                icon="arrow_upward"
                variant="text"
                density="compact"
                size="small"
                :disabled="index === 0"
                aria-label="Move up"
                @click="moveUp(index)"
              />
              <v-btn
                icon="arrow_downward"
                variant="text"
                density="compact"
                size="small"
                :disabled="index === feedStore.feeds.length - 1"
                aria-label="Move down"
                @click="moveDown(index)"
              />
            </div>

            <!-- Title & Subtitle -->
            <div class="feed-order-text">
              <div class="feed-order-title font-weight-medium text-body-medium">
                {{ getFeedTitle(feed) }}
              </div>
              <div class="feed-order-subtitle text-body-small text-medium-emphasis">
                {{ getFeedSubtitle(feed) }}
              </div>
            </div>

            <!-- Delete action -->
            <v-btn
              icon="delete"
              variant="text"
              color="error"
              density="comfortable"
              aria-label="Delete feed"
              title="Delete feed"
              @click="askDelete(feed)"
            />
          </div>
        </v-card>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteConfirmOpen" max-width="360">
      <v-card rounded="xl" color="surface-container-high">
        <v-card-title class="text-title-medium pt-4 px-6">
          {{ t('feed_delete', 'Delete feed item?') }}
        </v-card-title>
        <v-card-text class="px-6 py-2 text-body-medium text-medium-emphasis">
          {{ t('feed_delete_confirm', 'Are you sure you want to delete this feed?') }}
        </v-card-text>
        <v-card-actions class="px-6 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="deleteConfirmOpen = false">
            {{ t('action_cancel', 'Cancel') }}
          </v-btn>
          <v-btn color="error" variant="text" @click="confirmDelete">
            {{ t('action_delete', 'Delete') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.feed-order-screen {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 16px;
}

.feed-order-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feed-order-item-wrap {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.feed-order-item--dragging {
  opacity: 0.4;
}

.feed-order-item--drag-over {
  border-top: 2px solid rgb(var(--v-theme-primary));
}

.feed-order-item-content {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  gap: 8px;
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  color: rgb(var(--v-theme-on-surface-variant));
  padding: 4px;
  user-select: none;
}
.drag-handle:active {
  cursor: grabbing;
}

.feed-order-arrows {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.feed-order-text {
  flex: 1 1 auto;
  min-width: 0;
}

.feed-order-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feed-order-subtitle {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
