<script setup lang="ts">
import { ref } from 'vue'
import DownloadDropdownMenu, { type DownloadAction } from './DownloadDropdownMenu.vue'

defineProps<{
  detail: { title: string }
  isActionMode: boolean
  selectedCount: number
  canDownload: boolean
  hasFilters: boolean
  activeColor: string
  isInLibrary: boolean
  canShare: boolean
  titleAlpha: number
  backgroundAlpha: number
}>()

const emit = defineEmits<{
  (event: 'navigateUp'): void
  (event: 'cancelSelection'): void
  (event: 'selectAll'): void
  (event: 'invertSelection'): void
  (event: 'download', action: DownloadAction): void
  (event: 'openFilters'): void
  (event: 'refresh'): void
  (event: 'editCategories'): void
  (event: 'migrate'): void
  (event: 'share'): void
  (event: 'editNotes'): void
}>()

const downloadExpanded = ref(false)
</script>

<template>
  <header class="manga-toolbar" :class="{ 'manga-toolbar--action': isActionMode }">
    <div class="manga-toolbar__background" :style="{ opacity: backgroundAlpha }" />
    <div class="manga-toolbar__nav-wrap">
      <button
        type="button"
        class="manga-toolbar__nav"
        :aria-label="isActionMode ? 'Cancel' : 'Navigate up'"
        @click="isActionMode ? emit('cancelSelection') : emit('navigateUp')"
      >
        <v-icon :icon="isActionMode ? 'close' : 'arrow_back'" size="24" />
      </button>
      <span class="manga-toolbar__tooltip" role="tooltip">{{ isActionMode ? 'Cancel' : 'Navigate up' }}</span>
    </div>
    <div class="manga-toolbar__title" :style="{ opacity: titleAlpha }">
      {{ isActionMode ? selectedCount : detail.title }}
    </div>
    <div class="manga-toolbar__actions">
      <template v-if="isActionMode">
        <div class="manga-toolbar__action-wrap">
          <button type="button" class="manga-toolbar__icon" aria-label="Select all" @click="emit('selectAll')">
            <v-icon icon="select_all" size="24" />
          </button>
          <span class="manga-toolbar__tooltip" role="tooltip">Select all</span>
        </div>
        <div class="manga-toolbar__action-wrap">
          <button type="button" class="manga-toolbar__icon" aria-label="Invert selection" @click="emit('invertSelection')">
            <v-icon icon="flip_to_back" size="24" />
          </button>
          <span class="manga-toolbar__tooltip" role="tooltip">Invert selection</span>
        </div>
      </template>
      <template v-else>
        <!-- Download dropdown: only rendered if not local or stub source (takeIf { !source.isLocalOrStub() }) -->
        <div v-if="canDownload" class="manga-toolbar__action-wrap">
          <DownloadDropdownMenu v-model="downloadExpanded" @download="emit('download', $event)">
            <template #activator="{ props: activatorProps }">
              <button type="button" v-bind="activatorProps" class="manga-toolbar__icon" aria-label="Download">
                <v-icon icon="download" size="24" />
              </button>
            </template>
          </DownloadDropdownMenu>
          <span class="manga-toolbar__tooltip" role="tooltip">Download</span>
        </div>

        <!-- Filter button: tinted with activeColor when filters are applied -->
        <div class="manga-toolbar__action-wrap">
          <button
            type="button"
            class="manga-toolbar__icon"
            aria-label="Filter"
            :style="hasFilters ? { color: activeColor } : undefined"
            @click="emit('openFilters')"
          >
            <v-icon icon="filter_list" size="24" />
          </button>
          <span class="manga-toolbar__tooltip" role="tooltip">Filter</span>
        </div>

        <!-- More options overflow menu -->
        <div class="manga-toolbar__action-wrap">
          <v-menu location="bottom end" :offset="[0, 0]" content-class="manga-overflow-menu">
            <template #activator="{ props: activatorProps }">
              <button type="button" v-bind="activatorProps" class="manga-toolbar__icon" aria-label="More options">
                <v-icon icon="more_vert" size="24" />
              </button>
            </template>
            <v-list class="manga-overflow-list" density="default">
              <v-list-item title="Refresh" @click="emit('refresh')" />
              <v-list-item v-if="isInLibrary" title="Edit categories" @click="emit('editCategories')" />
              <v-list-item v-if="isInLibrary" title="Migrate" @click="emit('migrate')" />
              <v-list-item v-if="canShare" title="Share" @click="emit('share')" />
              <v-list-item title="Notes" @click="emit('editNotes')" />
            </v-list>
          </v-menu>
          <span class="manga-toolbar__tooltip" role="tooltip">More options</span>
        </div>
      </template>
    </div>
  </header>
</template>

<style scoped>
/* MangaToolbar: 64dp TopAppBar container */
.manga-toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 4px;
}

.manga-toolbar__background {
  position: absolute;
  inset: 0;
  background: rgb(var(--v-theme-surface-container));
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}

.manga-toolbar__nav-wrap,
.manga-toolbar__action-wrap {
  position: relative;
  display: inline-flex;
}

.manga-toolbar__nav,
.manga-toolbar__icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  color: rgb(var(--v-theme-on-surface));
}

.manga-toolbar__nav::before,
.manga-toolbar__icon::before {
  content: '';
  position: absolute;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0;
  transition: opacity 0.15s ease-in-out;
}

.manga-toolbar__nav:hover::before,
.manga-toolbar__icon:hover::before {
  opacity: 0.08;
}

.manga-toolbar__title {
  flex: 1;
  margin-inline-start: 4px;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: opacity 0.2s ease-in-out;
}

.manga-toolbar__actions {
  display: flex;
  align-items: center;
}

.manga-toolbar__tooltip {
  position: absolute;
  bottom: -32px;
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
  transition: opacity 0.15s ease-in-out;
  z-index: 20;
}

.manga-toolbar__nav-wrap:hover .manga-toolbar__tooltip,
.manga-toolbar__action-wrap:hover .manga-toolbar__tooltip {
  opacity: 1;
}

.manga-overflow-list {
  width: 196px !important;
  border-radius: 4px !important;
  padding: 8px 0 !important;
}

.manga-overflow-list .v-list-item {
  min-height: 48px !important;
  padding: 0 12px !important;
}
</style>
