<script setup lang="ts">
import { computed } from 'vue'
import Md3PrimaryTabs, { type Md3TabItem } from '@/core/components/Md3PrimaryTabs.vue'

/**
 * Pixel-parity port of Mihon's `presentation/library/components/LibraryTabs.kt`
 * (mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1).
 *
 * Uses the reusable Material Design 3 Primary Tabs primitive (`Md3PrimaryTabs.vue`).
 */
export interface LibraryTabCategory {
  id: number
  /** `Category.visualName` — "Default" for the system category, the category name otherwise. */
  visualName: string
  /** `getItemCountForCategory(category)` — null when the count is not shown. */
  count: number | null
}

const props = defineProps<{
  categories: LibraryTabCategory[]
  /** `pagerState.currentPage`. */
  currentPage: number
}>()

const emit = defineEmits<{ 'update:currentPage': [value: number] }>()

const tabItems = computed<Md3TabItem<number>[]>(() =>
  props.categories.map((cat, index) => ({
    value: index,
    label: cat.visualName,
    badge: cat.count,
  })),
)
</script>

<template>
  <Md3PrimaryTabs
    :model-value="currentPage"
    :items="tabItems"
    :scrollable="true"
    aria-label="Library categories"
    @update:model-value="emit('update:currentPage', $event)"
  />
</template>
