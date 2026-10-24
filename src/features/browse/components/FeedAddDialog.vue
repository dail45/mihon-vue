<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import { MAX_FEED_ITEMS, useFeedStore, type FeedType } from '../stores/feed'
import { useSavedSearchesStore } from '../stores/savedSearches'
import type { Source } from '@/core/api/types'
import { languageName } from '../utils/sourceLanguage'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'added'): void
}>()

const { t } = useI18n()
const server = useSuwayomiStore()
const feedStore = useFeedStore()
const savedSearchesStore = useSavedSearchesStore()

const searchQuery = ref('')
const selectedSourceId = ref<string>('')
const selectedFeedType = ref<FeedType>('popular')
const selectedSavedSearchId = ref<string>('')
const customTitle = ref('')

const open = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val),
})

const filteredSources = computed<Source[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const list = server.sources.filter(s => s.id !== '0' && s.lang !== 'localsourcelang')
  if (!q) return list
  return list.filter(s => s.name.toLowerCase().includes(q) || s.lang.toLowerCase().includes(q))
})

const selectedSource = computed(() => {
  return server.sources.find(s => s.id === selectedSourceId.value)
})

const availableSavedSearches = computed(() => {
  if (!selectedSourceId.value) return []
  return savedSearchesStore.getSearchesForSource(selectedSourceId.value)
})

watch(open, isOpen => {
  if (isOpen) {
    searchQuery.value = ''
    if (server.sources.length > 0 && !selectedSourceId.value) {
      const first = server.sources.find(s => s.id !== '0')
      if (first) selectedSourceId.value = first.id
    }
    selectedFeedType.value = selectedSource.value?.supportsLatest ? 'latest' : 'popular'
    selectedSavedSearchId.value = availableSavedSearches.value[0]?.id || ''
    customTitle.value = ''
  }
})

watch(selectedSourceId, () => {
  if (selectedSource.value && !selectedSource.value.supportsLatest && selectedFeedType.value === 'latest') {
    selectedFeedType.value = 'popular'
  }
  selectedSavedSearchId.value = availableSavedSearches.value[0]?.id || ''
})

const canAdd = computed(() => {
  if (feedStore.isFull) return false
  if (!selectedSourceId.value) return false
  if (selectedFeedType.value === 'saved_search' && !selectedSavedSearchId.value) return false
  return true
})

function onAdd() {
  if (!canAdd.value) return

  let title = customTitle.value.trim()
  if (!title) {
    if (selectedFeedType.value === 'saved_search') {
      const saved = savedSearchesStore.getSearchById(selectedSavedSearchId.value)
      title = saved?.name || 'Saved search'
    } else {
      title = selectedSource.value?.name || 'Feed'
    }
  }

  const res = feedStore.addFeed({
    sourceId: selectedSourceId.value,
    savedSearchId: selectedFeedType.value === 'saved_search' ? selectedSavedSearchId.value : undefined,
    feedType: selectedFeedType.value,
    global: true,
    title,
  })

  if (res.success) {
    emit('added')
    open.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="480">
    <v-card class="feed-add-dialog" color="surface-container-high" rounded="xl">
      <v-card-item class="pb-2">
        <v-card-title class="text-title-large font-weight-medium">
          {{ t('feed_add', 'Add feed') }}
        </v-card-title>
        <v-card-subtitle v-if="feedStore.isFull" class="text-error mt-1">
          {{ t('too_many_in_feed', `Too many sources in your feed, cannot add more than ${MAX_FEED_ITEMS}`) }}
        </v-card-subtitle>
      </v-card-item>

      <v-card-text class="feed-add-dialog-content pt-2 pb-0">
        <!-- Source Selection -->
        <div class="mb-4">
          <label class="text-label-medium text-medium-emphasis mb-1 d-block">
            {{ t('feed_select_source', 'Select source') }}
          </label>
          <v-autocomplete
            v-model="selectedSourceId"
            :items="filteredSources"
            item-title="name"
            item-value="id"
            :placeholder="t('action_search_for_source', 'Search for sources')"
            density="compact"
            variant="outlined"
            hide-details
            class="mb-2"
          >
            <template #item="{ props: itemProps, item }">
              <v-list-item v-bind="itemProps" :subtitle="languageName(item.lang || (item as any).raw?.lang || '')" />
            </template>
          </v-autocomplete>
        </div>

        <!-- Feed Type Selector -->
        <div class="mb-4">
          <label class="text-label-medium text-medium-emphasis mb-2 d-block">
            {{ t('feed_type', 'Feed type') }}
          </label>
          <v-radio-group v-model="selectedFeedType" hide-details density="compact">
            <v-radio
              value="popular"
              :label="t('popular', 'Popular')"
              class="mb-1"
            />
            <v-radio
              value="latest"
              :label="t('latest', 'Latest')"
              :disabled="selectedSource?.supportsLatest === false"
              class="mb-1"
            />
            <v-radio
              value="saved_search"
              :label="t('feed_type_saved_search', 'Saved search')"
              :disabled="availableSavedSearches.length === 0"
            />
          </v-radio-group>
        </div>

        <!-- Saved Search Selector if type is saved_search -->
        <div v-if="selectedFeedType === 'saved_search'" class="mb-4">
          <label class="text-label-medium text-medium-emphasis mb-1 d-block">
            {{ t('feed_select_saved_search', 'Select saved search') }}
          </label>
          <v-select
            v-if="availableSavedSearches.length > 0"
            v-model="selectedSavedSearchId"
            :items="availableSavedSearches"
            item-title="name"
            item-value="id"
            density="compact"
            variant="outlined"
            hide-details
          />
          <div v-else class="text-body-small text-medium-emphasis py-2">
            {{ t('feed_no_saved_searches', 'No saved searches for this source') }}
          </div>
        </div>

        <!-- Custom Title (Optional) -->
        <div class="mb-2">
          <label class="text-label-medium text-medium-emphasis mb-1 d-block">
            {{ t('name', 'Name') }} ({{ t('label_default', 'Default') }})
          </label>
          <v-text-field
            v-model="customTitle"
            placeholder="Custom feed lane title (optional)"
            density="compact"
            variant="outlined"
            hide-details
          />
        </div>
      </v-card-text>

      <v-card-actions class="px-6 py-4">
        <v-spacer />
        <v-btn variant="text" @click="open = false">
          {{ t('action_cancel', 'Cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :disabled="!canAdd"
          @click="onAdd"
        >
          {{ t('action_add', 'Add') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.feed-add-dialog {
  border-radius: 28px !important;
  padding: 8px 0;
}
.feed-add-dialog-content {
  max-height: 70vh;
  overflow-y: auto;
}
</style>
