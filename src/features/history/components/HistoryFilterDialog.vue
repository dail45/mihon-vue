<script setup lang="ts">
/**
 * HistoryFilterDialog — pixel parity target:
 *   komikku/app/src/main/java/eu/kanade/presentation/history/components/HistoryFilterDialog.kt
 */
import type { TriState } from '@/core/utils/library'
import AdaptiveSettingsSheet from '@/features/settings/components/AdaptiveSettingsSheet.vue'
import TriStateRow from '@/features/settings/components/TriStateRow.vue'
import Md3Switch from '@/core/components/Md3Switch.vue'
import { stringResource, MR } from '@/core/i18n'

const opened = defineModel<boolean>('opened', { required: true })
const filterUnfinishedManga = defineModel<TriState>('filterUnfinishedManga', { required: true })
const filterUnfinishedChapter = defineModel<TriState>('filterUnfinishedChapter', { required: true })
const filterNonLibrary = defineModel<TriState>('filterNonLibrary', { required: true })
const wideCover = defineModel<boolean>('wideCover', { required: true })

const currentTab = defineModel<string>('tab', { default: 'filter' })
</script>

<template>
  <AdaptiveSettingsSheet
    v-model="opened"
    v-model:tab="currentTab"
    :title="stringResource(MR.strings.action_filter) || 'Filter'"
    :tabs="['Filter']"
  >
    <div class="history-filter-sheet">
      <!-- TriState: Unfinished manga (action_filter_unfinished_manga) -->
      <TriStateRow
        v-model="filterUnfinishedManga"
        :label="stringResource(MR.strings.action_filter_unfinished_manga) || 'Unfinished manga'"
      />

      <!-- TriState: Unfinished chapter (action_filter_unfinished_chapter) -->
      <TriStateRow
        v-model="filterUnfinishedChapter"
        :label="stringResource(MR.strings.action_filter_unfinished_chapter) || 'Unfinished chapter'"
      />

      <!-- TriState: Non-library entries (action_filter_non_library_entries) -->
      <TriStateRow
        v-model="filterNonLibrary"
        :label="stringResource(MR.strings.action_filter_non_library_entries) || 'Non-library entries'"
      />

      <v-divider class="my-2" />

      <!-- Panorama / Wide cover switch (action_panorama_cover) -->
      <div
        class="wide-cover-row"
        role="switch"
        :aria-checked="wideCover"
        tabindex="0"
        @click="wideCover = !wideCover"
        @keydown.enter.prevent="wideCover = !wideCover"
        @keydown.space.prevent="wideCover = !wideCover"
      >
        <span class="wide-cover-label">
          {{ stringResource(MR.strings.action_panorama_cover) || 'Panorama cover' }}
        </span>
        <Md3Switch v-model="wideCover" />
      </div>
    </div>
  </AdaptiveSettingsSheet>
</template>

<style scoped>
@layer app-components {
  .history-filter-sheet {
    padding: 8px 0;
    display: flex;
    flex-direction: column;
  }

  .wide-cover-row {
    width: 100%;
    min-height: 48px;
    padding: 10px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: rgb(var(--v-theme-on-surface));
    font-size: 14px;
    line-height: 20px;
    font-weight: 400;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .wide-cover-row:hover {
    background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
  }

  .wide-cover-row:active {
    background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
  }

  .wide-cover-label {
    flex: 1 1 auto;
  }
}
</style>
