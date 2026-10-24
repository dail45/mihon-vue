<script setup lang="ts">
/**
 * EditMergedSettingsDialog.vue
 *
 * Pixel-parity and UX port of TachiyomiSY's `EditMergedSettingsDialog.kt`.
 * Allows:
 * - Choosing chapter deduplication mode ('priority' vs 'chapterNumber')
 * - Designating the "Info Manga" for metadata
 * - Drag-handle and button-based priority reordering
 * - Toggling chapter updates (`getChapterUpdates`) per source
 * - Toggling chapter downloads (`downloadChapters`) per source
 * - Adding and removing merged manga references
 */
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Manga } from '@/core/api/types'
import {
  useMergedMangaStore,
  type MergedMangaGroup,
  type MergedSourceReference,
} from '../stores/mergedManga'
import { useLibraryStore } from '@/features/library/stores/library'

const props = defineProps<{
  primaryManga: Manga
}>()

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{
  (e: 'updated'): void
}>()

const { t } = useI18n()
const mergedMangaStore = useMergedMangaStore()
const libraryStore = useLibraryStore()

const draftGroup = ref<MergedMangaGroup>({
  id: '',
  primaryMangaId: props.primaryManga.id,
  chapterSortMode: 'priority',
  references: [],
  createdAt: Date.now(),
})

const showAddPicker = ref(false)
const searchQuery = ref('')
const draggedIndex = ref<number | null>(null)

function initDraft() {
  const existing = mergedMangaStore.getGroup(props.primaryManga.id)
  if (existing) {
    draftGroup.value = JSON.parse(JSON.stringify(existing))
    // Ensure primary manga is in the references
    if (!draftGroup.value.references.some(r => r.mangaId === props.primaryManga.id)) {
      draftGroup.value.references.unshift({
        mangaId: props.primaryManga.id,
        sourceId: props.primaryManga.sourceId || '',
        sourceName: props.primaryManga.source?.name || props.primaryManga.sourceId || 'Primary',
        title: props.primaryManga.title,
        coverUrl: props.primaryManga.thumbnailUrl || '',
        chapterPriority: 0,
        isInfoManga: true,
        getChapterUpdates: true,
        downloadChapters: true,
      })
      updatePriorities()
    }
  } else {
    draftGroup.value = {
      id: `merge-${props.primaryManga.id}`,
      primaryMangaId: props.primaryManga.id,
      chapterSortMode: 'priority',
      references: [
        {
          mangaId: props.primaryManga.id,
          sourceId: props.primaryManga.sourceId || '',
          sourceName: props.primaryManga.source?.name || props.primaryManga.sourceId || 'Primary',
          title: props.primaryManga.title,
          coverUrl: props.primaryManga.thumbnailUrl || '',
          chapterPriority: 0,
          isInfoManga: true,
          getChapterUpdates: true,
          downloadChapters: true,
        },
      ],
      createdAt: Date.now(),
    }
  }
  showAddPicker.value = false
  searchQuery.value = ''
}

watch(open, isOpen => {
  if (isOpen) {
    initDraft()
  }
})

const sortedReferences = computed(() => {
  return [...draftGroup.value.references].sort((a, b) => a.chapterPriority - b.chapterPriority)
})

function selectInfoManga(mangaId: number) {
  draftGroup.value.references.forEach(r => {
    r.isInfoManga = r.mangaId === mangaId
  })
}

function updatePriorities() {
  draftGroup.value.references.forEach((r, idx) => {
    r.chapterPriority = idx
  })
}

function moveUp(index: number) {
  if (index <= 0) return
  const item = draftGroup.value.references.splice(index, 1)[0]
  draftGroup.value.references.splice(index - 1, 0, item)
  updatePriorities()
}

function moveDown(index: number) {
  if (index >= draftGroup.value.references.length - 1) return
  const item = draftGroup.value.references.splice(index, 1)[0]
  draftGroup.value.references.splice(index + 1, 0, item)
  updatePriorities()
}

function onDragStart(index: number, e: DragEvent) {
  draggedIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(_index: number, e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
}

function onDrop(targetIndex: number, e: DragEvent) {
  e.preventDefault()
  if (draggedIndex.value === null || draggedIndex.value === targetIndex) return
  const item = draftGroup.value.references.splice(draggedIndex.value, 1)[0]
  draftGroup.value.references.splice(targetIndex, 0, item)
  updatePriorities()
  draggedIndex.value = null
}

function toggleUpdates(refItem: MergedSourceReference) {
  refItem.getChapterUpdates = !refItem.getChapterUpdates
}

function toggleDownloads(refItem: MergedSourceReference) {
  refItem.downloadChapters = !refItem.downloadChapters
}

function removeReference(mangaId: number) {
  draftGroup.value.references = draftGroup.value.references.filter(r => r.mangaId !== mangaId)
  updatePriorities()
  if (draftGroup.value.references.length > 0 && !draftGroup.value.references.some(r => r.isInfoManga)) {
    draftGroup.value.references[0].isInfoManga = true
  }
}

const availableLibraryManga = computed(() => {
  const existing = new Set(draftGroup.value.references.map(r => r.mangaId))
  const q = searchQuery.value.trim().toLowerCase()
  const list = libraryStore.library || []
  return list.filter(m => {
    if (existing.has(m.id)) return false
    if (!q) return true
    return m.title.toLowerCase().includes(q)
  })
})

function addMangaToMerge(manga: Manga) {
  draftGroup.value.references.push({
    mangaId: manga.id,
    sourceId: manga.sourceId || '',
    sourceName: manga.source?.name || manga.sourceId || 'Source',
    title: manga.title,
    coverUrl: manga.thumbnailUrl || '',
    chapterPriority: draftGroup.value.references.length,
    isInfoManga: false,
    getChapterUpdates: true,
    downloadChapters: true,
  })
  updatePriorities()
  searchQuery.value = ''
  showAddPicker.value = false
}

function onSave() {
  if (draftGroup.value.references.length <= 1) {
    mergedMangaStore.deleteGroup(props.primaryManga.id)
  } else {
    mergedMangaStore.saveGroup(draftGroup.value)
  }
  open.value = false
  emit('updated')
}

function onUnmerge() {
  mergedMangaStore.deleteGroup(props.primaryManga.id)
  open.value = false
  emit('updated')
}
</script>

<template>
  <v-dialog
    v-model="open"
    max-width="560px"
    content-class="merged-dialog-overlay"
  >
    <v-card class="merged-dialog-card" rounded="28px" color="surface-container-high">
      <!-- Title -->
      <div class="merged-dialog-header">
        <h2 class="merged-dialog-title">{{ t('merge_settings', 'Merge settings') }}</h2>
      </div>

      <div class="merged-dialog-body">
        <!-- 1. Chapter Deduplication Mode -->
        <section class="merged-section">
          <div class="merged-section-title">{{ t('merge_duplicate_chapters', 'Duplicate chapters') }}</div>
          <div class="merged-sort-toggle">
            <button
              type="button"
              class="merged-sort-btn"
              :class="{ 'is-active': draftGroup.chapterSortMode === 'priority' }"
              @click="draftGroup.chapterSortMode = 'priority'"
            >
              {{ t('merge_dedupe_priority', 'Priority') }}
            </button>
            <button
              type="button"
              class="merged-sort-btn"
              :class="{ 'is-active': draftGroup.chapterSortMode === 'chapterNumber' }"
              @click="draftGroup.chapterSortMode = 'chapterNumber'"
            >
              {{ t('merge_dedupe_keep_all', 'Keep all') }}
            </button>
          </div>
          <p class="merged-section-summary">
            {{ draftGroup.chapterSortMode === 'priority'
              ? t('merge_dedupe_priority_summary', 'Show each chapter once, from the highest entry below that has it.')
              : t('merge_dedupe_keep_all_summary', 'Show every chapter from every entry.')
            }}
          </p>
        </section>

        <!-- 2. Info Source Selector -->
        <section class="merged-section">
          <div class="merged-section-title">{{ t('merge_info_source', 'Info source') }}</div>
          <div class="merged-info-selector">
            <div
              v-for="refItem in sortedReferences"
              :key="`info-${refItem.mangaId}`"
              class="merged-info-option"
              :class="{ 'is-selected': refItem.isInfoManga }"
              @click="selectInfoManga(refItem.mangaId)"
            >
              <div class="merged-info-radio">
                <v-icon :icon="refItem.isInfoManga ? 'radio_button_checked' : 'radio_button_unchecked'" size="20" color="primary" />
              </div>
              <img
                v-if="refItem.coverUrl"
                :src="refItem.coverUrl"
                :alt="refItem.title"
                class="merged-entry-thumb"
              />
              <div v-else class="merged-entry-thumb merged-entry-thumb--placeholder">
                <v-icon icon="book" size="20" />
              </div>
              <div class="merged-info-meta">
                <div class="merged-info-title">{{ refItem.title }}</div>
                <div class="merged-info-source">{{ refItem.sourceName }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- 3. Sources Priority List -->
        <section class="merged-section">
          <div class="merged-section-row">
            <div class="merged-section-title">{{ t('label_sources', 'Sources') }}</div>
            <div class="merged-drag-hint">{{ t('merge_drag_to_set_priority', 'Drag to set priority') }}</div>
          </div>

          <div class="merged-entries-list">
            <div
              v-for="(refItem, idx) in sortedReferences"
              :key="refItem.mangaId"
              class="merged-entry-row"
              draggable="true"
              @dragstart="onDragStart(idx, $event)"
              @dragover="onDragOver(idx, $event)"
              @drop="onDrop(idx, $event)"
            >
              <!-- Drag Handle & Reorder buttons -->
              <div class="merged-entry-reorder">
                <v-icon icon="drag_indicator" size="20" class="merged-drag-icon" />
                <div class="merged-arrow-buttons">
                  <button
                    type="button"
                    class="merged-arrow-btn"
                    :disabled="idx === 0"
                    :title="t('action_move_to_top', 'Move up')"
                    @click="moveUp(idx)"
                  >
                    <v-icon icon="arrow_drop_up" size="18" />
                  </button>
                  <button
                    type="button"
                    class="merged-arrow-btn"
                    :disabled="idx === sortedReferences.length - 1"
                    :title="t('action_move_to_bottom', 'Move down')"
                    @click="moveDown(idx)"
                  >
                    <v-icon icon="arrow_drop_down" size="18" />
                  </button>
                </div>
              </div>

              <!-- Cover Thumbnail -->
              <img
                v-if="refItem.coverUrl"
                :src="refItem.coverUrl"
                :alt="refItem.title"
                class="merged-entry-thumb"
              />
              <div v-else class="merged-entry-thumb merged-entry-thumb--placeholder">
                <v-icon icon="book" size="20" />
              </div>

              <!-- Title & Source -->
              <div class="merged-entry-info">
                <div class="merged-entry-title">
                  <span class="merged-priority-badge">#{{ idx + 1 }}</span>
                  {{ refItem.title }}
                </div>
                <div class="merged-entry-source">{{ refItem.sourceName }}</div>
              </div>

              <!-- Action buttons: Updates, Downloads, Remove -->
              <div class="merged-entry-actions">
                <button
                  type="button"
                  class="merged-icon-btn"
                  :class="{ 'is-active': refItem.getChapterUpdates }"
                  :title="t('chapter_updates_merged_entry', 'Toggle chapter updates')"
                  @click="toggleUpdates(refItem)"
                >
                  <v-icon :icon="refItem.getChapterUpdates ? 'sync' : 'sync_disabled'" size="20" />
                </button>
                <button
                  type="button"
                  class="merged-icon-btn"
                  :class="{ 'is-active': refItem.downloadChapters }"
                  :title="t('download_merged_entry', 'Toggle new chapter downloads')"
                  @click="toggleDownloads(refItem)"
                >
                  <v-icon :icon="refItem.downloadChapters ? 'download' : 'file_download_off'" size="20" />
                </button>
                <button
                  v-if="sortedReferences.length > 1"
                  type="button"
                  class="merged-icon-btn merged-icon-btn--delete"
                  :title="t('delete_merged_entry', 'Remove entry')"
                  @click="removeReference(refItem.mangaId)"
                >
                  <v-icon icon="delete_outline" size="20" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- 4. Add Manga Section -->
        <section class="merged-section">
          <div v-if="!showAddPicker">
            <button
              type="button"
              class="merged-add-btn"
              @click="showAddPicker = true"
            >
              <v-icon icon="add" size="20" />
              <span>{{ t('merge_add_manga', 'Add manga to merge') }}</span>
            </button>
          </div>
          <div v-else class="merged-add-picker">
            <div class="merged-picker-header">
              <input
                v-model="searchQuery"
                type="text"
                class="merged-search-input"
                :placeholder="t('merge_search_hint', 'Search manga in library...')"
                autofocus
              />
              <button
                type="button"
                class="merged-picker-close-btn"
                @click="showAddPicker = false"
              >
                <v-icon icon="close" size="20" />
              </button>
            </div>

            <div class="merged-picker-results">
              <div
                v-for="libManga in availableLibraryManga.slice(0, 15)"
                :key="`picker-${libManga.id}`"
                class="merged-picker-item"
                @click="addMangaToMerge(libManga)"
              >
                <img
                  v-if="libManga.thumbnailUrl"
                  :src="libManga.thumbnailUrl"
                  :alt="libManga.title"
                  class="merged-picker-thumb"
                />
                <div v-else class="merged-picker-thumb merged-picker-thumb--placeholder">
                  <v-icon icon="book" size="18" />
                </div>
                <div class="merged-picker-meta">
                  <div class="merged-picker-title">{{ libManga.title }}</div>
                  <div class="merged-picker-source">{{ libManga.source?.name || libManga.sourceId || '' }}</div>
                </div>
                <v-icon icon="add_circle_outline" size="20" color="primary" />
              </div>
              <div v-if="!availableLibraryManga.length" class="merged-picker-empty">
                No entries available in library
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Action Buttons -->
      <div class="merged-dialog-actions">
        <button
          v-if="draftGroup.references.length > 1"
          type="button"
          class="merged-action-btn merged-action-btn--unmerge"
          @click="onUnmerge"
        >
          {{ t('unmerge', 'Unmerge') }}
        </button>
        <div class="merged-actions-spacer" />
        <button
          type="button"
          class="merged-action-btn"
          @click="open = false"
        >
          {{ t('action_cancel', 'Cancel') }}
        </button>
        <button
          type="button"
          class="merged-action-btn merged-action-btn--primary"
          @click="onSave"
        >
          {{ t('action_save', 'Save') }}
        </button>
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.merged-dialog-card {
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}

.merged-dialog-header {
  padding: 24px 24px 12px 24px;
}

.merged-dialog-title {
  font-size: 22px;
  line-height: 28px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  margin: 0;
}

.merged-dialog-body {
  padding: 0 24px 16px 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.merged-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.merged-section-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.merged-section-title {
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  letter-spacing: 0.1px;
}

.merged-drag-hint {
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* Sort Mode Segmented Buttons */
.merged-sort-toggle {
  display: flex;
  border-radius: 20px;
  background-color: rgb(var(--v-theme-surface-container-highest));
  padding: 2px;
  gap: 2px;
}

.merged-sort-btn {
  flex: 1;
  padding: 8px 16px;
  border-radius: 18px;
  font-size: 13px;
  font-weight: 500;
  border: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  cursor: pointer;
  transition: all 0.2s ease;
}

.merged-sort-btn.is-active {
  background-color: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
  font-weight: 600;
}

.merged-section-summary {
  font-size: 12px;
  line-height: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
  margin: 2px 0 0 0;
}

/* Info source selector */
.merged-info-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.merged-info-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 12px;
  background-color: rgb(var(--v-theme-surface-container-highest));
  cursor: pointer;
  border: 1px solid transparent;
  transition: border-color 0.2s ease;
}

.merged-info-option.is-selected {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.08);
}

.merged-info-radio {
  display: flex;
  align-items: center;
}

.merged-info-meta {
  flex: 1;
  min-width: 0;
}

.merged-info-title {
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.merged-info-source {
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Entries List */
.merged-entries-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.merged-entry-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  background-color: rgb(var(--v-theme-surface-container-highest));
  transition: background-color 0.2s;
}

.merged-entry-reorder {
  display: flex;
  align-items: center;
  gap: 2px;
  cursor: grab;
}

.merged-drag-icon {
  color: rgb(var(--v-theme-on-surface-variant));
}

.merged-arrow-buttons {
  display: flex;
  flex-direction: column;
}

.merged-arrow-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface-variant));
  padding: 0;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.merged-arrow-btn:disabled {
  opacity: 0.2;
  cursor: default;
}

.merged-entry-thumb {
  width: 36px;
  height: 50px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.merged-entry-thumb--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(var(--v-theme-outline), 0.15);
  color: rgb(var(--v-theme-on-surface-variant));
}

.merged-entry-info {
  flex: 1;
  min-width: 0;
}

.merged-entry-title {
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 6px;
}

.merged-priority-badge {
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.12);
  padding: 1px 4px;
  border-radius: 4px;
}

.merged-entry-source {
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.merged-entry-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.merged-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: rgb(var(--v-theme-outline));
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.merged-icon-btn.is-active {
  color: rgb(var(--v-theme-primary));
}

.merged-icon-btn:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.08);
}

.merged-icon-btn--delete:hover {
  color: rgb(var(--v-theme-error));
  background-color: rgba(var(--v-theme-error), 0.08);
}

/* Add Manga Button */
.merged-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px;
  border-radius: 12px;
  border: 1px dashed rgb(var(--v-theme-outline));
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.merged-add-btn:hover {
  background-color: rgba(var(--v-theme-primary), 0.08);
  border-style: solid;
}

/* Add Manga Picker */
.merged-add-picker {
  border-radius: 12px;
  background-color: rgb(var(--v-theme-surface-container-highest));
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.merged-picker-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.merged-search-input {
  flex: 1;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(var(--v-theme-outline), 0.3);
  background-color: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font-size: 13px;
  outline: none;
}

.merged-search-input:focus {
  border-color: rgb(var(--v-theme-primary));
}

.merged-picker-close-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface-variant));
  display: flex;
  align-items: center;
}

.merged-picker-results {
  max-height: 160px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.merged-picker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.merged-picker-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.merged-picker-thumb {
  width: 28px;
  height: 38px;
  object-fit: cover;
  border-radius: 4px;
}

.merged-picker-thumb--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(var(--v-theme-outline), 0.15);
  color: rgb(var(--v-theme-on-surface-variant));
}

.merged-picker-meta {
  flex: 1;
  min-width: 0;
}

.merged-picker-title {
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.merged-picker-source {
  font-size: 11px;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.merged-picker-empty {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* Actions Footer */
.merged-dialog-actions {
  display: flex;
  align-items: center;
  padding: 12px 24px 20px 24px;
  gap: 8px;
}

.merged-actions-spacer {
  flex: 1;
}

.merged-action-btn {
  padding: 8px 16px;
  border-radius: 20px;
  border: none;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.merged-action-btn:hover {
  background-color: rgba(var(--v-theme-primary), 0.08);
}

.merged-action-btn--primary {
  background-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}

.merged-action-btn--primary:hover {
  background-color: rgb(var(--v-theme-primary));
  opacity: 0.9;
}

.merged-action-btn--unmerge {
  color: rgb(var(--v-theme-error));
}

.merged-action-btn--unmerge:hover {
  background-color: rgba(var(--v-theme-error), 0.08);
}
</style>
