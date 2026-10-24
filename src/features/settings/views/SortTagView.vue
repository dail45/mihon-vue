<script setup lang="ts">
/**
 * Tag Priority Sorting Screen — "Sort tags" / "Tag sorting".
 *
 * References:
 * - TachiyomiSY: `eu/kanade/presentation/category/SortTagScreen.kt`
 * - TachiyomiSY: `eu/kanade/presentation/category/components/genre/SortTagContent.kt`
 * - TachiyomiSY: `eu/kanade/presentation/category/components/genre/SortTagListItem.kt`
 * - TachiyomiSY: `eu/kanade/tachiyomi/ui/category/genre/SortTagViewModel.kt`
 */
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import { t } from '@/core/i18n'
import MihonEmptyScreen from '@/core/components/MihonEmptyScreen.vue'

const props = withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})

const router = useRouter()
const preferences = usePreferencesStore()

const isScrolled = ref(false)
function onWindowScroll() {
  isScrolled.value = window.scrollY > 0
}

onMounted(() => {
  window.addEventListener('scroll', onWindowScroll, { passive: true })
  onWindowScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onWindowScroll)
})

function goBack() {
  if (typeof window.history.state?.back === 'string') router.back()
  else void router.push('/settings/library')
}

// Reorder via Up/Down
function moveTag(fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= preferences.sortTags.length) return
  const tags = [...preferences.sortTags]
  const [removed] = tags.splice(fromIndex, 1)
  if (removed !== undefined) {
    tags.splice(toIndex, 0, removed)
    preferences.sortTags = tags
  }
}

// Drag and drop reordering
const draggingIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart(index: number, event: DragEvent) {
  draggingIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(index: number, event: DragEvent) {
  event.preventDefault()
  dragOverIndex.value = index
}

function onDragLeave(index: number) {
  if (dragOverIndex.value === index) {
    dragOverIndex.value = null
  }
}

function onDrop(index: number, event: DragEvent) {
  event.preventDefault()
  if (draggingIndex.value !== null && draggingIndex.value !== index) {
    moveTag(draggingIndex.value, index)
  }
  draggingIndex.value = null
  dragOverIndex.value = null
}

function onDragEnd() {
  draggingIndex.value = null
  dragOverIndex.value = null
}

// Create dialog
const createOpen = ref(false)
const newTagName = ref('')
const createError = ref('')

function openCreateDialog() {
  newTagName.value = ''
  createError.value = ''
  createOpen.value = true
}

function onCreateTag() {
  const trimmed = newTagName.value.trim()
  if (!trimmed) return
  const exists = preferences.sortTags.some(t => t.toLowerCase() === trimmed.toLowerCase())
  if (exists) {
    createError.value = t('error_tag_exists') || 'This tag already exists!'
    return
  }
  preferences.sortTags = [...preferences.sortTags, trimmed]
  createOpen.value = false
}

// Delete dialog
const deleteOpen = ref(false)
const tagToDelete = ref('')

function openDeleteDialog(tag: string) {
  tagToDelete.value = tag
  deleteOpen.value = true
}

function onConfirmDelete() {
  if (!tagToDelete.value) return
  preferences.sortTags = preferences.sortTags.filter(t => t !== tagToDelete.value)
  deleteOpen.value = false
}

const isEmpty = computed(() => preferences.sortTags.length === 0)
</script>

<template>
  <div class="sort-tag-screen" :class="{ 'sort-tag-screen--embedded': embedded }">
    <!-- Top toolbar when not embedded -->
    <header v-if="!embedded" class="sort-tag-toolbar" :class="{ 'is-scrolled': isScrolled }">
      <button
        type="button"
        class="sort-tag-toolbar__icon"
        aria-label="Navigate up"
        @click="goBack"
      >
        <v-icon icon="arrow_back" size="24" />
      </button>
      <h1 class="sort-tag-toolbar__title">{{ t('pref_tag_sorting') || 'Tag sorting' }}</h1>
    </header>

    <div class="sort-tag-content">
      <!-- Empty screen -->
      <div v-if="isEmpty" class="sort-tag-empty-wrap">
        <MihonEmptyScreen
          icon="label_outline"
          :message="t('information_empty_tags') || 'You have no tags. Tap the plus button to create one for sorting your library by tags.'"
        />
      </div>

      <!-- Tag list -->
      <div v-else class="sort-tag-list" role="list">
        <div
          v-for="(tag, index) in preferences.sortTags"
          :key="tag"
          class="sort-tag-card"
          :class="{
            'is-dragging': draggingIndex === index,
            'is-drag-over': dragOverIndex === index,
          }"
          draggable="true"
          role="listitem"
          @dragstart="onDragStart(index, $event)"
          @dragover="onDragOver(index, $event)"
          @dragleave="onDragLeave(index)"
          @drop="onDrop(index, $event)"
          @dragend="onDragEnd"
        >
          <div class="sort-tag-card__header">
            <v-icon icon="label" size="24" class="sort-tag-card__icon" />
            <span class="sort-tag-card__name">{{ tag }}</span>
            <span class="sort-tag-card__priority-badge">#{{ index + 1 }}</span>
          </div>

          <div class="sort-tag-card__actions">
            <button
              type="button"
              class="sort-tag-action-btn"
              :disabled="index === 0"
              aria-label="Move up"
              title="Move up"
              @click="moveTag(index, index - 1)"
            >
              <v-icon icon="keyboard_arrow_up" size="24" />
            </button>
            <button
              type="button"
              class="sort-tag-action-btn"
              :disabled="index === preferences.sortTags.length - 1"
              aria-label="Move down"
              title="Move down"
              @click="moveTag(index, index + 1)"
            >
              <v-icon icon="keyboard_arrow_down" size="24" />
            </button>
            <div class="sort-tag-card__spacer" />
            <button
              type="button"
              class="sort-tag-action-btn sort-tag-action-btn--delete"
              aria-label="Delete tag"
              title="Delete tag"
              @click="openDeleteDialog(tag)"
            >
              <v-icon icon="delete_outline" size="24" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- FAB for adding tag -->
    <v-btn
      color="primary"
      class="sort-tag-fab"
      icon="add"
      size="large"
      elevation="3"
      aria-label="Add tag"
      @click="openCreateDialog"
    />

    <!-- Add Tag Dialog -->
    <v-dialog v-model="createOpen" max-width="440">
      <v-card rounded="xl" class="pref-dialog">
        <v-card-title class="pref-dialog-title">{{ t('add_tag') || 'Add tag' }}</v-card-title>
        <v-card-text class="pref-dialog-text">
          <p class="tag-helper-text">
            {{ t('action_add_tags_message') || 'Tags must match exactly as they appear in manga genres.' }}
          </p>
          <v-text-field
            v-model="newTagName"
            variant="outlined"
            :placeholder="t('tag_input_placeholder') || 'Tag name (e.g. Action)'"
            autofocus
            hide-details="auto"
            :error-messages="createError"
            class="mt-3"
            @keydown.enter="onCreateTag"
          />
        </v-card-text>
        <v-card-actions class="pref-dialog-actions">
          <v-spacer />
          <v-btn variant="text" @click="createOpen = false">{{ t('action_cancel') || 'Cancel' }}</v-btn>
          <v-btn variant="text" color="primary" :disabled="!newTagName.trim()" @click="onCreateTag">
            {{ t('action_add') || 'Add' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Tag Dialog -->
    <v-dialog v-model="deleteOpen" max-width="440">
      <v-card rounded="xl" class="pref-dialog">
        <v-card-title class="pref-dialog-title">{{ t('delete_tag') || 'Delete tag' }}</v-card-title>
        <v-card-text class="pref-dialog-text">
          {{ t('delete_tag_confirmation', tagToDelete) || `Do you wish to delete the tag "${tagToDelete}"?` }}
        </v-card-text>
        <v-card-actions class="pref-dialog-actions">
          <v-spacer />
          <v-btn variant="text" @click="deleteOpen = false">{{ t('action_cancel') || 'Cancel' }}</v-btn>
          <v-btn variant="text" color="error" @click="onConfirmDelete">
            {{ t('action_delete') || 'Delete' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
@layer app-components {
.sort-tag-screen {
  position: relative;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
}

.sort-tag-screen--embedded {
  background: transparent;
}

.sort-tag-toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 4px;
  background: rgb(var(--v-theme-surface));
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}

.sort-tag-toolbar.is-scrolled {
  background: rgb(var(--v-theme-surface-container-high, var(--v-theme-surface)));
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.sort-tag-toolbar__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  border-radius: 50%;
  cursor: pointer;
}

.sort-tag-toolbar__icon:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.sort-tag-toolbar__title {
  margin: 0;
  padding: 0 8px;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}

.sort-tag-content {
  flex: 1 1 auto;
  padding: 16px;
  padding-bottom: 88px;
}

.sort-tag-empty-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
}

.sort-tag-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 600px;
  margin: 0 auto;
}

.sort-tag-card {
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface-container-low, var(--v-theme-surface-variant)));
  border-radius: 12px;
  padding: 12px 16px 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  user-select: none;
}

.sort-tag-card.is-dragging {
  opacity: 0.4;
}

.sort-tag-card.is-drag-over {
  border: 2px dashed rgb(var(--v-theme-primary));
}

.sort-tag-card__header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sort-tag-card__icon {
  color: rgb(var(--v-theme-primary));
  flex-shrink: 0;
}

.sort-tag-card__name {
  flex: 1 1 auto;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  color: rgb(var(--v-theme-on-surface));
  word-break: break-word;
}

.sort-tag-card__priority-badge {
  font-size: 12px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface-variant));
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface-variant)) 12%, transparent);
  padding: 2px 8px;
  border-radius: 12px;
}

.sort-tag-card__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.sort-tag-card__spacer {
  flex: 1 1 auto;
}

.sort-tag-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  border-radius: 50%;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.sort-tag-action-btn:hover:not(:disabled) {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface-variant)) 8%, transparent);
}

.sort-tag-action-btn:disabled {
  opacity: 0.38;
  cursor: default;
}

.sort-tag-action-btn--delete:hover:not(:disabled) {
  color: rgb(var(--v-theme-error));
  background: color-mix(in srgb, rgb(var(--v-theme-error)) 8%, transparent);
}

.sort-tag-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 10;
  border-radius: 16px !important;
}

.tag-helper-text {
  font-size: 13px;
  line-height: 18px;
  color: rgb(var(--v-theme-on-surface-variant));
  margin: 0 0 8px 0;
}

.pref-dialog {
  padding: 8px;
}

.pref-dialog-title {
  font-size: 20px;
  font-weight: 500;
}

.pref-dialog-text {
  padding: 8px 24px 16px;
}

.pref-dialog-actions {
  padding: 8px 16px;
}
}
</style>
