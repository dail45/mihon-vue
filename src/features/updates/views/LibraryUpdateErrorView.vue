<script setup lang="ts">
/**
 * LibraryUpdateErrorView — pixel parity target:
 *   komikku/app/src/main/java/eu/kanade/presentation/libraryUpdateError/LibraryUpdateErrorScreen.kt
 *   komikku/app/src/main/java/eu/kanade/tachiyomi/ui/libraryUpdateError/LibraryUpdateErrorScreenModel.kt
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { useLibraryUpdateErrorsStore, type LibraryUpdateError } from '../stores/libraryUpdateErrors'
import MihonEmptyScreen from '@/core/components/MihonEmptyScreen.vue'
import { stringResource, MR } from '@/core/i18n'

const router = useRouter()
const server = useSuwayomiStore()
const store = useLibraryUpdateErrorsStore()

const selectedIds = ref<string[]>([])
const retryingIds = ref<Set<string>>(new Set())
const retryingAll = ref(false)

const selectionMode = computed(() => selectedIds.value.length > 0)
const selectedCount = computed(() => selectedIds.value.length)
const totalCount = computed(() => store.errors.length)

interface ErrorGroup {
  message: string
  items: LibraryUpdateError[]
  count: number
}

const groups = computed<ErrorGroup[]>(() => {
  const map = new Map<string, LibraryUpdateError[]>()
  for (const error of store.errors) {
    const list = map.get(error.message) || []
    list.push(error)
    map.set(error.message, list)
  }

  const result: ErrorGroup[] = []
  for (const [message, items] of map.entries()) {
    result.push({
      message,
      items,
      count: items.length,
    })
  }
  return result
})

function toggleSelection(id: string) {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter(item => item !== id)
  } else {
    selectedIds.value.push(id)
  }
}

function selectAll(select: boolean) {
  if (select) {
    selectedIds.value = store.errors.map(e => e.id)
  } else {
    selectedIds.value = []
  }
}

function invertSelection() {
  const current = new Set(selectedIds.value)
  selectedIds.value = store.errors.filter(e => !current.has(e.id)).map(e => e.id)
}

function deleteSelected() {
  store.removeErrors(selectedIds.value)
  selectedIds.value = []
}

function deleteSingle(id: string) {
  store.removeError(id)
  selectedIds.value = selectedIds.value.filter(item => item !== id)
}

async function retrySingle(error: LibraryUpdateError) {
  if (retryingIds.value.has(error.id)) return
  retryingIds.value.add(error.id)
  try {
    await store.retryError(error.id, server.apiUrl)
  } finally {
    retryingIds.value.delete(error.id)
  }
}

async function handleRetryAll() {
  if (retryingAll.value || !store.errors.length) return
  retryingAll.value = true
  try {
    await store.retryAll(server.apiUrl)
  } finally {
    retryingAll.value = false
  }
}

function clearAllErrors() {
  store.clearErrors()
  selectedIds.value = []
}

function openManga(mangaId: number) {
  void router.push(`/manga/${mangaId}`)
}

function handoffMultiMigrate() {
  const selectedErrors = store.errors.filter(e => selectedIds.value.includes(e.id))
  if (!selectedErrors.length) return

  if (selectedErrors.length === 1) {
    void router.push(`/migrate/manga/${selectedErrors[0]!.mangaId}`)
  } else {
    const ids = selectedErrors.map(e => e.mangaId).join(',')
    void router.push({ path: '/migrate/list', query: { mangaIds: ids } })
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function scrollToBottom() {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
}

function scrollToPreviousGroup() {
  const headers = document.querySelectorAll('.error-group-header')
  const currentY = window.scrollY
  let target: HTMLElement | null = null

  for (let i = headers.length - 1; i >= 0; i--) {
    const h = headers[i] as HTMLElement
    const top = h.getBoundingClientRect().top + window.scrollY
    if (top < currentY - 10) {
      target = h
      break
    }
  }

  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } else {
    scrollToTop()
  }
}

function scrollToNextGroup() {
  const headers = document.querySelectorAll('.error-group-header')
  const currentY = window.scrollY
  let target: HTMLElement | null = null

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i] as HTMLElement
    const top = h.getBoundingClientRect().top + window.scrollY
    if (top > currentY + 10) {
      target = h
      break
    }
  }

  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } else {
    scrollToBottom()
  }
}
</script>

<template>
  <div class="library-update-error-view">
    <!-- Top App Bar -->
    <header class="update-error-toolbar" :class="{ 'is-selection': selectionMode }">
      <!-- Regular mode -->
      <template v-if="!selectionMode">
        <v-btn
          icon="arrow_back"
          variant="text"
          class="toolbar-btn"
          aria-label="Navigate up"
          title="Navigate up"
          @click="router.back()"
        />
        <h1 class="toolbar-title">
          {{ stringResource(MR.strings.label_library_update_errors, totalCount) || `Library update errors (${totalCount})` }}
        </h1>
        <div class="toolbar-actions">
          <v-btn
            icon="refresh"
            variant="text"
            class="toolbar-btn"
            :loading="retryingAll"
            aria-label="Retry all"
            title="Retry all"
            @click="handleRetryAll"
          />
          <v-btn
            icon="delete_sweep"
            variant="text"
            class="toolbar-btn"
            aria-label="Clear all"
            title="Clear all"
            @click="clearAllErrors"
          />
        </div>
      </template>

      <!-- Selection mode -->
      <template v-else>
        <v-btn
          icon="close"
          variant="text"
          class="toolbar-btn"
          aria-label="Cancel selection"
          title="Cancel selection"
          @click="selectAll(false)"
        />
        <h1 class="toolbar-title">{{ selectedCount }}</h1>
        <div class="toolbar-actions">
          <v-btn
            icon="select_all"
            variant="text"
            class="toolbar-btn"
            aria-label="Select all"
            title="Select all"
            @click="selectAll(true)"
          />
          <v-btn
            icon="flip_to_back"
            variant="text"
            class="toolbar-btn"
            aria-label="Invert selection"
            title="Invert selection"
            @click="invertSelection"
          />
          <v-btn
            icon="delete"
            variant="text"
            class="toolbar-btn"
            aria-label="Delete selected"
            title="Delete selected"
            @click="deleteSelected"
          />
        </div>
      </template>
    </header>

    <!-- Main Content -->
    <main ref="listContainer" class="update-error-content">
      <template v-if="groups.length">
        <div v-for="group in groups" :key="group.message" class="error-group">
          <!-- Group Header: sticky header with error message and badge -->
          <div class="error-group-header">
            <span class="error-group-message">{{ group.message }}</span>
            <span class="error-group-badge">{{ group.count }}</span>
          </div>

          <!-- Error Items in group -->
          <div
            v-for="item in group.items"
            :key="item.id"
            class="error-item"
            :class="{ 'is-selected': selectedIds.includes(item.id) }"
            @click="selectionMode ? toggleSelection(item.id) : undefined"
          >
            <!-- Checkbox in selection mode -->
            <div v-if="selectionMode" class="error-item__checkbox">
              <v-checkbox
                :model-value="selectedIds.includes(item.id)"
                color="primary"
                density="compact"
                hide-details
                aria-label="Select entry"
                @click.stop="toggleSelection(item.id)"
              />
            </div>

            <!-- Manga Cover (square 48dp) -->
            <button
              type="button"
              class="error-item__cover"
              :aria-label="item.title"
              @click.stop="openManga(item.mangaId)"
            >
              <v-img
                :src="server.thumbnailUrl(item.mangaId)"
                aspect-ratio="1"
                cover
                alt=""
                class="error-item__cover-img"
              />
            </button>

            <!-- Info Column -->
            <div class="error-item__info" @click="selectionMode ? undefined : openManga(item.mangaId)">
              <div class="error-item__title">{{ item.title }}</div>
              <div class="error-item__source">{{ item.sourceName }}</div>
            </div>

            <!-- Actions -->
            <div class="error-item__actions">
              <v-btn
                icon="refresh"
                variant="text"
                size="small"
                class="error-item__action-btn"
                :loading="retryingIds.has(item.id)"
                aria-label="Retry"
                title="Retry"
                @click.stop="retrySingle(item)"
              />
              <v-btn
                icon="delete"
                variant="text"
                size="small"
                class="error-item__action-btn"
                aria-label="Delete"
                title="Delete"
                @click.stop="deleteSingle(item.id)"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- Empty state -->
      <MihonEmptyScreen
        v-else
        :message="stringResource(MR.strings.info_empty_library_update_errors) || 'You have no library update errors.'"
      />
    </main>

    <!-- Bottom Action Bar (Navigation and Multi-Migration Handoff) -->
    <footer class="update-error-bottom-bar" :class="{ 'has-selection': selectionMode }">
      <v-btn
        icon="vertical_align_top"
        variant="text"
        class="bottom-btn"
        aria-label="Scroll to top"
        title="Scroll to top"
        @click="scrollToTop"
      />
      <v-btn
        icon="arrow_upward"
        variant="text"
        class="bottom-btn"
        aria-label="Scroll to previous"
        title="Scroll to previous"
        @click="scrollToPreviousGroup"
      />
      <v-btn
        icon="find_replace"
        variant="text"
        class="bottom-btn migrate-btn"
        :disabled="!selectionMode"
        :color="selectionMode ? 'primary' : undefined"
        aria-label="Migrate selected"
        title="Migrate selected"
        @click="handoffMultiMigrate"
      />
      <v-btn
        icon="arrow_downward"
        variant="text"
        class="bottom-btn"
        aria-label="Scroll to next"
        title="Scroll to next"
        @click="scrollToNextGroup"
      />
      <v-btn
        icon="vertical_align_bottom"
        variant="text"
        class="bottom-btn"
        aria-label="Scroll to bottom"
        title="Scroll to bottom"
        @click="scrollToBottom"
      />
    </footer>
  </div>
</template>

<style scoped>
.library-update-error-view {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

.update-error-toolbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 8px;
  background: rgb(var(--v-theme-surface));
  box-sizing: border-box;
}

.update-error-toolbar.is-selection {
  background: rgb(var(--v-theme-surface-container-high));
}

.toolbar-title {
  flex: 1 1 auto;
  margin: 0;
  padding: 0 12px;
  font-size: 20px;
  line-height: 28px;
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-btn {
  color: rgb(var(--v-theme-on-surface));
}

.update-error-content {
  flex: 1 1 auto;
  padding-bottom: 72px;
}

.error-group-header {
  position: sticky;
  top: 64px;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 16px;
  background: rgb(var(--v-theme-surface-container-low));
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface-variant));
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
}

.error-group-message {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.error-group-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: rgb(var(--v-theme-error));
  color: rgb(var(--v-theme-on-error));
  font-size: 12px;
  font-weight: 600;
}

.error-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  border-bottom: 1px solid color-mix(in srgb, rgb(var(--v-theme-outline-variant)) 30%, transparent);
  transition: background-color 0.15s ease;
  user-select: none;
}

.error-item:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 4%, transparent);
}

.error-item.is-selected {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 12%, transparent);
}

.error-item__checkbox {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

.error-item__cover {
  flex: 0 0 48px;
  width: 48px;
  height: 48px;
  border: 0;
  padding: 0;
  background: transparent;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
}

.error-item__cover-img {
  width: 100%;
  height: 100%;
}

.error-item__info {
  flex: 1 1 auto;
  min-width: 0;
  cursor: pointer;
}

.error-item__title {
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.error-item__source {
  font-size: 12px;
  line-height: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.error-item__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}

.error-item__action-btn {
  color: rgb(var(--v-theme-on-surface-variant));
}

.update-error-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: 56px;
  background: rgb(var(--v-theme-surface-container));
  border-top: 1px solid rgb(var(--v-theme-outline-variant));
  transition: box-shadow 0.2s ease;
}

.update-error-bottom-bar.has-selection {
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.15);
}

.bottom-btn {
  color: rgb(var(--v-theme-on-surface-variant));
}

.migrate-btn:not(:disabled) {
  color: rgb(var(--v-theme-primary));
}
</style>
