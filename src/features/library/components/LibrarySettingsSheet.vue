<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import { useSuwayomiStore } from '../stores/suwayomi'
import { librarySortOptions, LIBRARY_GROUP, type LibraryGroupMode, type LibrarySortType, type TriState } from '@/core/utils/library'
import { listTrackers, type Tracker } from '@/core/api/trackers'
import AdaptiveSettingsSheet from '@/features/settings/components/AdaptiveSettingsSheet.vue'
import LibraryDisplaySettings from './LibraryDisplaySettings.vue'
import TriStateRow from '@/features/settings/components/TriStateRow.vue'
import TriStateListDialog from '@/core/components/TriStateListDialog.vue'
import type { Category } from '@/core/api/types'

const open = defineModel<boolean>({ required: true })
const tab = ref('filter')
const prefs = usePreferencesStore()
const server = useSuwayomiStore()

const categoriesDialogOpen = ref(false)
const filterCategoriesList = computed<Category[]>(() => [...server.categories].sort((a, b) => a.order - b.order))
const filterCategoriesIncludedList = computed<Category[]>(() =>
  filterCategoriesList.value.filter(c => prefs.filterCategoriesInclude.includes(c.id)),
)
const filterCategoriesExcludedList = computed<Category[]>(() =>
  filterCategoriesList.value.filter(c => prefs.filterCategoriesExclude.includes(c.id)),
)

function onCategoryFiltersChanged(included: unknown[], excluded: unknown[]) {
  prefs.filterCategoriesInclude = (included as Category[]).map(c => c.id)
  prefs.filterCategoriesExclude = (excluded as Category[]).map(c => c.id)
}

const sort = computed(() => prefs.getLibrarySort(server.apiUrl, server.activeCategoryId))
const downloaded = computed({
  get: () => prefs.downloadedOnly ? 'include' as const : prefs.filters.downloaded,
  set: v => {
    if (!prefs.downloadedOnly) prefs.filters.downloaded = v
  },
})

const trackers = ref<Tracker[]>([])
async function loadTrackers() {
  try {
    trackers.value = await listTrackers(server.apiUrl)
  } catch {
    trackers.value = []
  }
}

watch(open, isOpen => {
  if (isOpen) {
    loadTrackers()
  }
}, { immediate: true })

const loggedInTrackers = computed(() => trackers.value.filter(t => t.isLoggedIn))

function trackerFilter(id: number) {
  return computed<TriState>({
    get: () => prefs.filters.tracking?.[id] ?? 'all',
    set: val => {
      if (!prefs.filters.tracking) prefs.filters.tracking = {}
      prefs.filters.tracking[id] = val
    },
  })
}

const singleTrackerFilter = computed<TriState>({
  get: () => {
    const id = loggedInTrackers.value[0]?.id
    return id !== undefined ? (prefs.filters.tracking?.[id] ?? 'all') : 'all'
  },
  set: val => {
    const id = loggedInTrackers.value[0]?.id
    if (id !== undefined) {
      if (!prefs.filters.tracking) prefs.filters.tracking = {}
      prefs.filters.tracking[id] = val
    }
  },
})

const sortOptions = computed(() => {
  const options = [...librarySortOptions]
  if (prefs.sortTags && prefs.sortTags.length > 0) {
    options.push({ value: 'tagList', label: 'Tag sorting' })
  }
  if (loggedInTrackers.value.length > 0) {
    const randomIndex = options.findIndex(o => o.value === 'random')
    if (randomIndex >= 0) {
      options.splice(randomIndex, 0, { value: 'trackerScore', label: 'Tracker score' })
    } else {
      options.push({ value: 'trackerScore', label: 'Tracker score' })
    }
  }
  return options
})

function onSelectSort(mode: LibrarySortType) {
  prefs.chooseLibrarySort(server.apiUrl, server.activeCategoryId, mode)
}

const groupOptions = [
  { value: LIBRARY_GROUP.BY_DEFAULT, label: 'Default' },
  { value: LIBRARY_GROUP.BY_SOURCE, label: 'By Source' },
  { value: LIBRARY_GROUP.BY_STATUS, label: 'By Status' },
  { value: LIBRARY_GROUP.BY_TRACK_STATUS, label: 'By Track Status' },
  { value: LIBRARY_GROUP.UNGROUPED, label: 'Ungrouped' },
] as const

function onSelectGroup(mode: LibraryGroupMode) {
  prefs.groupMode = mode
}

const touchStartX = ref<number | null>(null)
const touchStartY = ref<number | null>(null)

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 1) {
    touchStartX.value = e.touches[0]!.clientX
    touchStartY.value = e.touches[0]!.clientY
  }
}

function onTouchEnd(e: TouchEvent) {
  if (touchStartX.value === null || touchStartY.value === null) return
  const dx = e.changedTouches[0]!.clientX - touchStartX.value
  const dy = e.changedTouches[0]!.clientY - touchStartY.value
  touchStartX.value = null
  touchStartY.value = null

  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    const tabs = ['filter', 'sort', 'display', 'group']
    const currentIndex = tabs.indexOf(tab.value)
    if (dx < 0 && currentIndex < tabs.length - 1) {
      tab.value = tabs[currentIndex + 1]!
    } else if (dx > 0 && currentIndex > 0) {
      tab.value = tabs[currentIndex - 1]!
    }
  }
}
</script>

<template>
  <AdaptiveSettingsSheet
    v-model="open"
    v-model:tab="tab"
    title="Library settings"
    :tabs="['Filter', 'Sort', 'Display', 'Group']"
    flat-tabs
  >
    <div
      class="library-settings-page-container"
      @touchstart="onTouchStart"
      @touchend="onTouchEnd"
    >
      <!-- FilterPage (LibrarySettingsDialog.kt:76-154) -->
      <div v-if="tab === 'filter'" class="library-settings-page">
        <TriStateRow
          v-model="downloaded"
          label="Downloaded"
          :disabled="prefs.downloadedOnly"
        />
        <TriStateRow
          v-model="prefs.filters.unread"
          label="Unread"
        />
        <TriStateRow
          v-model="prefs.filters.started"
          label="Started"
        />
        <TriStateRow
          v-model="prefs.filters.bookmarked"
          label="Bookmarked"
        />
        <TriStateRow
          v-model="prefs.filters.completed"
          label="Completed"
        />

        <!-- Categories filter row (Komikku LibrarySettingsDialog.kt:184, 470-520) -->
        <div class="settings-row categories-filter-row" @click="prefs.filterCategories = !prefs.filterCategories">
          <span class="settings-icon-slot">
            <v-checkbox v-model="prefs.filterCategories" density="compact" hide-details />
          </span>
          <span class="settings-row-label">Categories</span>
          <v-btn
            variant="text"
            color="primary"
            density="comfortable"
            @click.stop="categoriesDialogOpen = true"
          >
            Edit
          </v-btn>
        </div>

        <div class="settings-row categories-hidden-row" @click="prefs.showHiddenCategories = !prefs.showHiddenCategories">
          <span class="settings-icon-slot">
            <v-switch
              v-model="prefs.showHiddenCategories"
              color="primary"
              density="compact"
              hide-details
            />
          </span>
          <span class="settings-row-label">Show hidden categories</span>
        </div>

        <template v-if="loggedInTrackers.length === 1">
          <TriStateRow
            v-model="singleTrackerFilter"
            label="Tracked"
          />
        </template>
        <template v-else-if="loggedInTrackers.length > 1">
          <h3 class="settings-heading">Tracked</h3>
          <TriStateRow
            v-for="service in loggedInTrackers"
            :key="service.id"
            v-model="trackerFilter(service.id).value"
            :label="service.name"
          />
        </template>
      </div>

      <!-- SortPage (LibrarySettingsDialog.kt:156-218) -->
      <div v-else-if="tab === 'sort'" class="library-settings-page">
        <button
          v-for="option in sortOptions"
          :key="option.value"
          type="button"
          class="settings-row"
          :data-sort="option.value"
          :aria-label="option.label"
          :aria-pressed="sort.type === option.value"
          @click="onSelectSort(option.value)"
        >
          <span class="settings-icon-slot">
            <v-icon
              v-if="sort.type === option.value"
              :icon="option.value === 'random' ? 'refresh' : sort.descending ? 'arrow_downward' : 'arrow_upward'"
              color="primary"
              size="24"
            />
            <span v-else class="settings-icon-space" />
          </span>
          <span class="settings-row-label">{{ option.label }}</span>
        </button>
      </div>

      <!-- DisplayPage (LibrarySettingsDialog.kt:227-298) -->
      <div v-else-if="tab === 'display'" class="library-settings-page">
        <LibraryDisplaySettings />
      </div>

      <!-- GroupPage (TachiyomiSY LibrarySettingsDialog.kt:392-429) -->
      <div v-else-if="tab === 'group'" class="library-settings-page">
        <button
          v-for="option in groupOptions"
          :key="option.value"
          type="button"
          class="settings-row"
          :data-group="option.value"
          :aria-label="option.label"
          :aria-pressed="prefs.groupMode === option.value"
          @click="onSelectGroup(option.value)"
        >
          <span class="settings-icon-slot">
            <v-icon
              :icon="prefs.groupMode === option.value ? 'radio_button_checked' : 'radio_button_unchecked'"
              :color="prefs.groupMode === option.value ? 'primary' : undefined"
              size="24"
            />
          </span>
          <span class="settings-row-label">{{ option.label }}</span>
        </button>
      </div>
    </div>
  </AdaptiveSettingsSheet>

  <TriStateListDialog
    v-if="categoriesDialogOpen"
    v-model="categoriesDialogOpen"
    title="Categories"
    message="Entries in excluded categories will not be shown even if they are also in included categories."
    :items="filterCategoriesList"
    :initial-checked="filterCategoriesIncludedList"
    :initial-inversed="filterCategoriesExcludedList"
    :item-label="(c: any) => c.name"
    :item-key="(c: any) => c.id"
    @value-changed="onCategoryFiltersChanged"
  />
</template>

<style scoped>
@layer app-components {
.categories-filter-row {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 24px;
  min-height: 44px;
  padding: 10px 24px;
}
.categories-filter-row:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.categories-hidden-row {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 24px;
  min-height: 44px;
  padding: 10px 24px;
}
.categories-hidden-row:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.library-settings-page-container {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.library-settings-page {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.settings-icon-slot {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  display: grid;
  place-items: center;
}

.settings-icon-space {
  width: 24px;
  height: 24px;
  display: inline-block;
}

.settings-row-label {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}

.settings-heading {
  margin: 0;
  padding: 10px 24px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
}
}
</style>
