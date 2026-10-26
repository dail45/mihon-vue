<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import { useSuwayomiStore } from '../stores/suwayomi'
import { LIBRARY_GROUP, type LibraryGroupMode, type LibrarySortType, type TriState } from '@/core/utils/library'
import { listTrackers, type Tracker } from '@/core/api/trackers'
import { stringResource, MR } from '@/core/i18n'
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
    nextTick(updateContainerHeight)
    setTimeout(updateContainerHeight, 50)
    setTimeout(updateContainerHeight, 200)
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

const tabs = computed(() => [
  { value: 'filter', label: stringResource(MR.strings.action_filter) || 'Filter' },
  { value: 'sort', label: stringResource(MR.strings.action_sort) || 'Sort' },
  { value: 'display', label: stringResource(MR.strings.action_display) || 'Display' },
  { value: 'group', label: stringResource(MR.strings.group) || 'Group' },
])

const sortOptions = computed(() => {
  const options: { value: LibrarySortType; label: string }[] = [
    { value: 'title', label: stringResource(MR.strings.action_sort_alpha) || 'Alphabetically' },
    { value: 'total', label: stringResource(MR.strings.action_sort_total) || 'Total chapters' },
    { value: 'lastRead', label: stringResource(MR.strings.action_sort_last_read) || 'Last read' },
    { value: 'lastUpdate', label: stringResource(MR.strings.action_sort_last_manga_update) || 'Last update check' },
    { value: 'unread', label: stringResource(MR.strings.action_sort_unread_count) || 'Unread count' },
    { value: 'latestChapter', label: stringResource(MR.strings.action_sort_latest_chapter) || 'Latest chapter' },
    { value: 'chapterFetched', label: stringResource(MR.strings.action_sort_chapter_fetch_date) || 'Chapter fetch date' },
    { value: 'added', label: stringResource(MR.strings.action_sort_date_added) || 'Date added' },
  ]
  if (prefs.sortTags && prefs.sortTags.length > 0) {
    options.push({ value: 'tagList', label: stringResource(MR.strings.tag_sorting) || 'Tag sorting' })
  }
  if (loggedInTrackers.value.length > 0) {
    options.push({ value: 'trackerScore', label: stringResource(MR.strings.action_sort_tracker_score) || 'Tracker score' })
  }
  options.push({ value: 'random', label: stringResource(MR.strings.action_sort_random) || 'Random' })
  return options
})

function onSelectSort(mode: LibrarySortType) {
  prefs.chooseLibrarySort(server.apiUrl, server.activeCategoryId, mode)
}

const groupOptions = computed(() => [
  { value: LIBRARY_GROUP.BY_DEFAULT, label: stringResource(MR.strings.by_default) || 'Default' },
  { value: LIBRARY_GROUP.BY_SOURCE, label: stringResource(MR.strings.by_source) || 'By Source' },
  { value: LIBRARY_GROUP.BY_STATUS, label: stringResource(MR.strings.by_status) || 'By Status' },
  { value: LIBRARY_GROUP.BY_TRACK_STATUS, label: stringResource(MR.strings.by_track_status) || 'By Track Status' },
  { value: LIBRARY_GROUP.UNGROUPED, label: stringResource(MR.strings.ungrouped) || 'Ungrouped' },
])

function onSelectGroup(mode: LibraryGroupMode) {
  prefs.groupMode = mode
}

const tabOrder = ['filter', 'sort', 'display', 'group']
const currentTabIndex = computed(() => {
  const idx = tabOrder.indexOf(tab.value)
  return idx >= 0 ? idx : 0
})

const containerEl = ref<HTMLElement | null>(null)
const filterPageEl = ref<HTMLElement | null>(null)
const sortPageEl = ref<HTMLElement | null>(null)
const displayPageEl = ref<HTMLElement | null>(null)
const groupPageEl = ref<HTMLElement | null>(null)

const pageEls = computed(() => [
  filterPageEl.value,
  sortPageEl.value,
  displayPageEl.value,
  groupPageEl.value,
])

const containerHeight = ref<number | null>(null)

function updateContainerHeight() {
  const el = pageEls.value[currentTabIndex.value]
  if (el) {
    const h = el.scrollHeight || el.offsetHeight
    if (h > 0) {
      containerHeight.value = h
    }
  }
}

const trackStyle = computed(() => ({
  transform: `translateX(-${currentTabIndex.value * 100}%)`,
}))

const containerStyle = computed(() => {
  if (containerHeight.value === null) return {}
  return {
    height: `${containerHeight.value}px`,
  }
})

watch(tab, () => {
  updateContainerHeight()
  nextTick(() => {
    updateContainerHeight()
    const scrollEl = containerEl.value?.closest('.settings-scroll')
    if (scrollEl && scrollEl.scrollTop > 0) {
      scrollEl.scrollTo({ top: 0, behavior: 'smooth' })
    }
  })
})

let pageResizeObserver: ResizeObserver | null = null
onMounted(() => {
  nextTick(() => {
    updateContainerHeight()
    if (typeof ResizeObserver !== 'undefined') {
      pageResizeObserver = new ResizeObserver(() => updateContainerHeight())
      pageEls.value.forEach(el => {
        if (el) pageResizeObserver?.observe(el)
      })
    }
  })
})

onBeforeUnmount(() => {
  pageResizeObserver?.disconnect()
  pageResizeObserver = null
})

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
    :title="stringResource(MR.strings.library_settings) || 'Library settings'"
    :tabs="tabs"
    flat-tabs
  >
    <div
      ref="containerEl"
      class="library-settings-page-container"
      :style="containerStyle"
      @touchstart="onTouchStart"
      @touchend="onTouchEnd"
    >
      <div
        class="library-settings-track"
        :style="trackStyle"
      >
        <!-- FilterPage (LibrarySettingsDialog.kt:76-154) -->
        <div
          ref="filterPageEl"
          class="library-settings-page"
          data-page="filter"
          :inert="tab !== 'filter' ? true : undefined"
          :aria-hidden="tab !== 'filter'"
        >
          <TriStateRow
            v-model="downloaded"
            :label="stringResource(MR.strings.label_downloaded) || 'Downloaded'"
            :disabled="prefs.downloadedOnly"
          />
          <TriStateRow
            v-model="prefs.filters.unread"
            :label="stringResource(MR.strings.action_filter_unread) || 'Unread'"
          />
          <TriStateRow
            v-model="prefs.filters.started"
            :label="stringResource(MR.strings.label_started) || 'Started'"
          />
          <TriStateRow
            v-model="prefs.filters.bookmarked"
            :label="stringResource(MR.strings.action_filter_bookmarked) || 'Bookmarked'"
          />
          <TriStateRow
            v-model="prefs.filters.completed"
            :label="stringResource(MR.strings.completed) || 'Completed'"
          />

          <!-- Categories filter row (Komikku LibrarySettingsDialog.kt:184, 470-520) -->
          <div class="settings-row categories-filter-row" @click="prefs.filterCategories = !prefs.filterCategories">
            <!-- MD3 Checkbox (replaces legacy <v-checkbox v-model="prefs.filterCategories" />) -->
            <span class="settings-icon-slot">
              <span
                class="m3-checkbox"
                :class="{ 'm3-checkbox--checked': prefs.filterCategories }"
                role="checkbox"
                :aria-checked="prefs.filterCategories"
              >
                <svg
                  v-if="prefs.filterCategories"
                  class="m3-checkbox-icon"
                  viewBox="0 0 18 18"
                  aria-hidden="true"
                >
                  <path
                    d="M 3.5 9.5 L 7 13 L 14.5 5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
            </span>
            <span class="settings-row-label">{{ stringResource(MR.strings.categories) || 'Categories' }}</span>
            <button
              type="button"
              class="categories-edit-btn"
              @click.stop="categoriesDialogOpen = true"
            >
              {{ stringResource(MR.strings.action_edit) || 'Edit' }}
            </button>
          </div>

          <template v-if="loggedInTrackers.length === 1">
            <TriStateRow
              v-model="singleTrackerFilter"
              :label="stringResource(MR.strings.action_filter_tracked) || 'Tracked'"
            />
          </template>
          <template v-else-if="loggedInTrackers.length > 1">
            <h3 class="settings-heading">{{ stringResource(MR.strings.action_filter_tracked) || 'Tracked' }}</h3>
            <TriStateRow
              v-for="service in loggedInTrackers"
              :key="service.id"
              v-model="trackerFilter(service.id).value"
              :label="service.name"
            />
          </template>
        </div>

        <!-- SortPage (LibrarySettingsDialog.kt:156-218) -->
        <div
          ref="sortPageEl"
          class="library-settings-page"
          data-page="sort"
          :inert="tab !== 'sort' ? true : undefined"
          :aria-hidden="tab !== 'sort'"
        >
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
        <div
          ref="displayPageEl"
          class="library-settings-page"
          data-page="display"
          :inert="tab !== 'display' ? true : undefined"
          :aria-hidden="tab !== 'display'"
        >
          <LibraryDisplaySettings />
        </div>

        <!-- GroupPage (TachiyomiSY LibrarySettingsDialog.kt:392-429) -->
        <div
          ref="groupPageEl"
          class="library-settings-page"
          data-page="group"
          :inert="tab !== 'group' ? true : undefined"
          :aria-hidden="tab !== 'group'"
        >
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
    </div>
  </AdaptiveSettingsSheet>

  <TriStateListDialog
    v-if="categoriesDialogOpen"
    v-model="categoriesDialogOpen"
    :title="stringResource(MR.strings.categories) || 'Categories'"
    :message="stringResource(MR.strings.pref_library_filter_categories_details) || 'Entries in excluded categories will not be shown even if they are also in included categories.'"
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
.categories-filter-row:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}

.m3-checkbox {
  width: 18px;
  height: 18px;
  border-radius: 2px;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
  display: grid;
  place-items: center;
  color: rgb(var(--v-theme-on-primary));
  transition: background-color 150ms ease, border-color 150ms ease;
  box-sizing: border-box;
}
.m3-checkbox--checked {
  background: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
}
.m3-checkbox-icon {
  width: 14px;
  height: 14px;
  display: block;
}

.categories-edit-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 12px;
  margin: -6px -12px -6px 0;
  border: 0;
  border-radius: 18px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.0071428571em;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 150ms ease;
}
@media (hover: hover) {
  .categories-edit-btn:hover {
    background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent);
  }
}
.categories-edit-btn:active {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 12%, transparent);
}
.categories-edit-btn:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.library-settings-page-container {
  position: relative;
  width: 100%;
  overflow: hidden;
  transition: height 280ms cubic-bezier(0.2, 0, 0, 1);
  box-sizing: border-box;
}

.library-settings-track {
  display: flex;
  width: 100%;
  align-items: flex-start;
  transition: transform 280ms cubic-bezier(0.2, 0, 0, 1);
  will-change: transform;
}

.library-settings-page {
  flex: 0 0 100%;
  width: 100%;
  min-width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
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
