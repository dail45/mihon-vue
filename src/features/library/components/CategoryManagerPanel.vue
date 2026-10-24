<script setup lang="ts">
/**
 * CategoryManagerPanel — reusable domain panel for managing categories.
 *
 * Implements the Container/Panel pattern:
 * Encapsulates category list presentation, drag & drop reordering,
 * FAB action, and create/rename/delete modal dialogs.
 * Used inside `CategoriesView.vue` (as a route) and in modal/sheet dialogs without route navigation.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import { createSuwayomiApi } from '@/core/api/client'
import { reorderCategory } from '@/core/api/categoryReorder'
import type { Category } from '@/core/api/types'
import CategoryListItem from './CategoryListItem.vue'
import CategoryFab from '@/features/library/components/CategoryFab.vue'
import CategoryCreateDialog from '@/features/library/components/CategoryCreateDialog.vue'
import CategoryRenameDialog from '@/features/library/components/CategoryRenameDialog.vue'
import CategoryDeleteDialog from '@/features/library/components/CategoryDeleteDialog.vue'
import MihonEmptyScreen from '@/core/components/MihonEmptyScreen.vue'
import Md3CircularProgress from '@/core/components/Md3CircularProgress.vue'

const server = useSuwayomiStore()
const preferences = usePreferencesStore()

/** Mihon hides its system (uncategorized) category; Suwayomi keeps the default category at id 0. */
const SYSTEM_CATEGORY_ID = 0

const categories = ref<Category[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const dragOverIndex = ref<number | null>(null)
const createOpen = ref(false)

const visibleCategories = computed(() =>
  categories.value.filter(item => item.id !== SYSTEM_CATEGORY_ID),
)
const categoryNames = computed(() => visibleCategories.value.map(item => item.name))
const isEmpty = computed(() => !loading.value && !error.value && visibleCategories.value.length === 0)

async function loadCategories() {
  loading.value = true
  error.value = null
  try {
    const fetched = await createSuwayomiApi(server.apiUrl).categories()
    categories.value = [...fetched].sort((a, b) => a.order - b.order)
    server.categories = categories.value
    server.connected = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadCategories()
})

onBeforeUnmount(() => {
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
})

/* ------------------------------------------------------------------ *
 * Reorder
 * ------------------------------------------------------------------ */

const draggingId = ref<number | null>(null)

function onDragStart(category: Category, event: DragEvent) {
  draggingId.value = category.id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(category.id))
  }
}

function onDragEnd() {
  draggingId.value = null
  dragOverIndex.value = null
}

function onDragOver(index: number) {
  dragOverIndex.value = index
}

function onDragLeave(_event: DragEvent, index: number) {
  if (dragOverIndex.value === index) {
    dragOverIndex.value = null
  }
}

async function onDrop(index: number) {
  const sourceId = draggingId.value
  dragOverIndex.value = null
  onDragEnd()
  const list = visibleCategories.value
  const from = list.findIndex(item => item.id === sourceId)
  const to = index
  if (from < 0 || to < 0 || from === to) return
  await moveCategory(from, to)
}

async function moveCategory(from: number, to: number) {
  const list = visibleCategories.value
  if (from < 0 || to < 0 || from >= list.length || to >= list.length || from === to) return
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  categories.value = categories.value
    .map(item => next.find(entry => entry.id === item.id) ?? item)
  await nextTick()
  await persistOrder(moved, to)
}

function onTouchStartHandle(category: Category) {
  draggingId.value = category.id
}

function onTouchMoveHandle(event: TouchEvent) {
  if (draggingId.value === null) return
  const touch = event.touches[0]
  if (!touch) return
  const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.categories-screen__row') as HTMLElement | null
  if (target && target.dataset.index !== undefined) {
    dragOverIndex.value = Number(target.dataset.index)
  }
}

async function onTouchEndHandle() {
  if (draggingId.value === null) return
  const targetIndex = dragOverIndex.value
  const sourceId = draggingId.value
  draggingId.value = null
  dragOverIndex.value = null
  if (targetIndex === null) return
  const list = visibleCategories.value
  const from = list.findIndex(item => item.id === sourceId)
  if (from >= 0 && targetIndex >= 0 && from !== targetIndex) {
    await moveCategory(from, targetIndex)
  }
}

function onTouchCancelHandle() {
  draggingId.value = null
  dragOverIndex.value = null
}

async function persistOrder(category: Category, index: number) {
  if (!server.apiUrl) {
    await loadCategories()
    return
  }
  try {
    await reorderCategory(server.apiUrl, category.id, index + 1)
    await loadCategories()
  } catch (e) {
    showSnackbar(
      `InternalError: could not change the category order. ${e instanceof Error ? e.message : String(e)}`,
    )
    await loadCategories()
  }
}

/* ------------------------------------------------------------------ *
 * Dialogs
 * ------------------------------------------------------------------ */

const renameTarget = ref<Category | null>(null)
const renameOpen = ref(false)
const deleteTarget = ref<Category | null>(null)
const deleteOpen = ref(false)

function openRename(category: Category) {
  renameTarget.value = category
  renameOpen.value = true
}
function openDelete(category: Category) {
  deleteTarget.value = category
  deleteOpen.value = true
}

/* ------------------------------------------------------------------ *
 * Snackbar
 * ------------------------------------------------------------------ */

const snackbar = ref('')
let snackbarTimer: number | undefined
function showSnackbar(message: string) {
  snackbar.value = message
  if (snackbarTimer) window.clearTimeout(snackbarTimer)
  snackbarTimer = window.setTimeout(() => { snackbar.value = '' }, 4000)
}

defineExpose({
  loadCategories,
})
</script>

<template>
  <div class="category-manager-panel">
    <!-- Loading progress -->
    <div v-if="loading" class="categories-screen__loading" role="status" aria-label="Loading categories">
      <Md3CircularProgress />
    </div>

    <template v-else>
      <MihonEmptyScreen
        v-if="isEmpty"
        class="categories-screen__empty"
        message="You have no categories. Tap the plus button to create one for organizing your library."
      />

      <MihonEmptyScreen
        v-else-if="error"
        class="categories-screen__empty"
        :message="error"
      />

      <TransitionGroup
        v-else
        name="category-row"
        tag="div"
        class="categories-screen__list"
      >
        <div
          v-for="(category, index) in visibleCategories"
          :key="category.id"
          class="categories-screen__row"
          :class="{
            'is-dragging': draggingId === category.id,
            'is-drag-over': dragOverIndex === index,
          }"
          :data-index="index"
          @dragover.prevent="onDragOver(index)"
          @dragleave="onDragLeave($event, index)"
          @drop.prevent="onDrop(index)"
        >
          <CategoryListItem
            :name="category.name"
            :category="category"
            :hidden="preferences.hiddenCategories.includes(category.id)"
            :dragging="draggingId === category.id"
            @rename="openRename(category)"
            @delete="openDelete(category)"
            @hide="preferences.toggleHiddenCategory(category.id)"
            @dragstart="onDragStart(category, $event)"
            @dragend="onDragEnd"
            @move-up="moveCategory(index, index - 1)"
            @move-down="moveCategory(index, index + 1)"
            @touch-start="onTouchStartHandle(category)"
            @touch-move="onTouchMoveHandle"
            @touch-end="onTouchEndHandle"
            @touch-cancel="onTouchCancelHandle"
          />
        </div>
      </TransitionGroup>

      <CategoryFab
        :existing-names="categoryNames"
        :manage-dialog="false"
        @create="createOpen = true"
      />
    </template>

    <CategoryCreateDialog
      v-model="createOpen"
      :categories="categoryNames"
      @created="loadCategories()"
    />

    <CategoryRenameDialog
      v-if="renameTarget"
      v-model="renameOpen"
      :category-id="renameTarget.id"
      :category-name="renameTarget.name"
      :categories="categoryNames"
      @rename="loadCategories()"
    />

    <CategoryDeleteDialog
      v-if="deleteTarget"
      v-model="deleteOpen"
      :category="deleteTarget"
      @deleted="loadCategories()"
    />

    <div v-if="snackbar" class="categories-screen__snackbar" role="status" aria-live="polite">
      {{ snackbar }}
    </div>
  </div>
</template>

<style scoped>
@layer app-components {
.category-manager-panel {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  position: relative;
  min-height: 200px;
}

.categories-screen__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  min-height: 240px;
}

.categories-screen__list {
  display: flex;
  flex-direction: column;
  padding: 8px 16px 96px;
  gap: 8px;
  position: relative;
}

.categories-screen__row {
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s ease;
}

.categories-screen__row.is-dragging {
  opacity: 0.35;
}

.categories-screen__row.is-drag-over {
  outline: 2px dashed rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 12px;
}

.category-row-move,
.category-row-enter-active,
.category-row-leave-active {
  transition: all 0.25s cubic-bezier(0.2, 0, 0, 1);
}

.category-row-enter-from,
.category-row-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.category-row-leave-active {
  position: absolute;
  left: 16px;
  right: 16px;
}

.categories-screen__snackbar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  padding: 14px 24px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 20px;
  max-width: min(560px, calc(100% - 32px));
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.24);
  z-index: 1000;
}
}
</style>
