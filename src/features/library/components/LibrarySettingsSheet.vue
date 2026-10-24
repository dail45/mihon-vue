<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import { useSuwayomiStore } from '../stores/suwayomi'
import { librarySortOptions, type LibrarySortType, type TriState } from '@/core/utils/library'
import { listTrackers, type Tracker } from '@/core/api/trackers'
import AdaptiveSettingsSheet from '@/features/settings/components/AdaptiveSettingsSheet.vue'
import LibraryDisplaySettings from './LibraryDisplaySettings.vue'
import TriStateRow from '@/features/settings/components/TriStateRow.vue'

const open = defineModel<boolean>({ required: true })
const tab = ref('filter')
const prefs = usePreferencesStore()
const server = useSuwayomiStore()

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
    const tabs = ['filter', 'sort', 'display']
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
    :tabs="['Filter', 'Sort', 'Display']"
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
      <div v-else class="library-settings-page">
        <LibraryDisplaySettings />
      </div>
    </div>
  </AdaptiveSettingsSheet>
</template>

<style scoped>
@layer app-components {
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
