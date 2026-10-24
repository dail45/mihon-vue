<script setup lang="ts">
import { computed } from 'vue'
import { stringResource } from '@/core/i18n'

/**
 * Bulk Selection Toolbar.
 *
 * Mirrors Komikku's `BulkSelectionToolbar.kt`:
 * - Dismiss / cancel action mode button
 * - Selected items count badge / title
 * - Select All action
 * - Invert / reverse selection action
 * - Progress indicator when batch mutation is running
 * - Favorite button (triggers duplicate check & category assignment)
 */
const props = withDefaults(
  defineProps<{
    selectedCount: number
    isRunning?: boolean
    asAppBar?: boolean
    hasSelectAll?: boolean
    hasReverseSelection?: boolean
  }>(),
  {
    isRunning: false,
    asAppBar: false,
    hasSelectAll: true,
    hasReverseSelection: true,
  },
)

const emit = defineEmits<{
  (event: 'clear-selection'): void
  (event: 'favorite'): void
  (event: 'select-all'): void
  (event: 'reverse-selection'): void
}>()

const clearTitle = computed(() => stringResource('clear_selection') || 'Clear selection')
const selectAllTitle = computed(() => stringResource('action_select_all') || 'Select all')
const selectInverseTitle = computed(() => stringResource('action_select_inverse') || 'Select inverse')
const addToLibraryTitle = computed(() => stringResource('add_to_library') || 'Add to library')
</script>

<template>
  <v-app-bar
    v-if="asAppBar"
    flat
    height="64"
    color="surface"
    class="bulk-selection-toolbar bulk-selection-toolbar--app-bar"
  >
    <!-- Dismiss selection mode -->
    <div class="toolbar-action-wrap toolbar-action-wrap--nav">
      <v-btn
        icon="close"
        variant="text"
        class="toolbar-action"
        :aria-label="clearTitle"
        :title="clearTitle"
        @click="emit('clear-selection')"
      />
      <span class="toolbar-tooltip" role="tooltip">{{ clearTitle }}</span>
    </div>

    <!-- Selected count title -->
    <v-app-bar-title class="bulk-toolbar__title text-title-large font-weight-regular">
      {{ selectedCount }}
    </v-app-bar-title>

    <!-- Actions -->
    <div v-if="hasSelectAll" class="toolbar-action-wrap">
      <v-btn
        icon="select_all"
        variant="text"
        class="toolbar-action"
        :aria-label="selectAllTitle"
        :title="selectAllTitle"
        @click="emit('select-all')"
      />
      <span class="toolbar-tooltip" role="tooltip">{{ selectAllTitle }}</span>
    </div>

    <div v-if="hasReverseSelection" class="toolbar-action-wrap">
      <v-btn
        icon="flip_to_back"
        variant="text"
        class="toolbar-action"
        :aria-label="selectInverseTitle"
        :title="selectInverseTitle"
        @click="emit('reverse-selection')"
      />
      <span class="toolbar-tooltip" role="tooltip">{{ selectInverseTitle }}</span>
    </div>

    <div v-if="isRunning" class="toolbar-action-wrap toolbar-action-wrap--loading">
      <v-progress-circular
        indeterminate
        size="24"
        width="2"
        color="primary"
        class="bulk-toolbar-loader"
        aria-label="Adding to library"
      />
    </div>

    <div v-else class="toolbar-action-wrap">
      <v-btn
        icon="favorite"
        variant="text"
        color="primary"
        class="toolbar-action"
        :disabled="selectedCount === 0"
        :aria-label="addToLibraryTitle"
        :title="addToLibraryTitle"
        @click="emit('favorite')"
      />
      <span class="toolbar-tooltip" role="tooltip">{{ addToLibraryTitle }}</span>
    </div>
  </v-app-bar>

  <div
    v-else
    class="bulk-selection-toolbar bulk-selection-toolbar--sticky"
    role="toolbar"
    aria-label="Bulk selection toolbar"
  >
    <div class="bst-bar">
      <!-- Dismiss selection mode -->
      <div class="toolbar-action-wrap toolbar-action-wrap--nav">
        <button
          type="button"
          class="bst-icon-btn"
          :aria-label="clearTitle"
          :title="clearTitle"
          @click="emit('clear-selection')"
        >
          <span class="material-symbols-rounded bst-icon" aria-hidden="true">close</span>
        </button>
        <span class="toolbar-tooltip" role="tooltip">{{ clearTitle }}</span>
      </div>

      <!-- Selected count title -->
      <div class="bst-title text-title-large font-weight-regular">
        {{ selectedCount }}
      </div>

      <div class="bst-actions">
        <!-- Select all action -->
        <div v-if="hasSelectAll" class="toolbar-action-wrap">
          <button
            type="button"
            class="bst-icon-btn"
            :aria-label="selectAllTitle"
            :title="selectAllTitle"
            @click="emit('select-all')"
          >
            <span class="material-symbols-rounded bst-icon" aria-hidden="true">select_all</span>
          </button>
          <span class="toolbar-tooltip" role="tooltip">{{ selectAllTitle }}</span>
        </div>

        <!-- Invert selection action -->
        <div v-if="hasReverseSelection" class="toolbar-action-wrap">
          <button
            type="button"
            class="bst-icon-btn"
            :aria-label="selectInverseTitle"
            :title="selectInverseTitle"
            @click="emit('reverse-selection')"
          >
            <span class="material-symbols-rounded bst-icon" aria-hidden="true">flip_to_back</span>
          </button>
          <span class="toolbar-tooltip" role="tooltip">{{ selectInverseTitle }}</span>
        </div>

        <!-- Progress or Favorite action -->
        <div v-if="isRunning" class="toolbar-action-wrap toolbar-action-wrap--loading">
          <v-progress-circular
            indeterminate
            size="24"
            width="2"
            color="primary"
            class="bulk-toolbar-loader"
            aria-label="Adding to library"
          />
        </div>

        <div v-else class="toolbar-action-wrap">
          <button
            type="button"
            class="bst-icon-btn bst-icon-btn--primary"
            :disabled="selectedCount === 0"
            :aria-label="addToLibraryTitle"
            :title="addToLibraryTitle"
            @click="emit('favorite')"
          >
            <span class="material-symbols-rounded bst-icon" aria-hidden="true">favorite</span>
          </button>
          <span class="toolbar-tooltip" role="tooltip">{{ addToLibraryTitle }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bulk-selection-toolbar--sticky {
  position: sticky;
  top: 0;
  z-index: 2;
  background: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgb(var(--v-theme-outline-variant));
}

.bst-bar {
  display: flex;
  align-items: center;
  height: 64px;
  padding-inline: 4px;
}

.bst-title {
  flex: 1 1 auto;
  min-width: 0;
  margin-inline: 8px 16px;
  color: rgb(var(--v-theme-on-surface));
  font-family: Roboto, sans-serif;
  font-size: 22px;
  line-height: 28px;
}

.bulk-toolbar__title {
  margin-inline-start: 4px !important;
  min-width: 0 !important;
  font-family: Roboto, sans-serif !important;
  font-size: 22px !important;
  line-height: 28px !important;
  font-weight: 400 !important;
}

.bst-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.bst-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  padding: 12px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  transition: background-color 150ms ease;
}

.bst-icon-btn:hover:not(:disabled) {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.bst-icon-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.bst-icon-btn--primary {
  color: rgb(var(--v-theme-primary));
}

.bst-icon {
  font-size: 24px;
  width: 24px;
  height: 24px;
}

.toolbar-action-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.toolbar-action-wrap--loading {
  padding-inline: 12px;
}

.bulk-toolbar-loader {
  margin-inline: 4px;
}

.toolbar-tooltip {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 150ms ease, visibility 150ms ease;
  z-index: 10;
}

.toolbar-action-wrap:hover .toolbar-tooltip,
.toolbar-action-wrap:focus-within .toolbar-tooltip {
  opacity: 1;
  visibility: visible;
}
</style>
