import { defineStore } from 'pinia'
import { ref, watch, type Ref } from 'vue'
import { readPreference, writePreference } from '@/features/settings/stores/preferences'
import {
  hideInLibraryItems,
  enabledContentWarnings,
  applyContentWarningsToInstalled,
  contentWarningsSubtitle,
  contentWarningEntries,
  type ContentWarningKey,
} from '@/core/utils/browsePreferences'

export { contentWarningEntries, contentWarningsSubtitle, type ContentWarningKey }

export type GlobalSearchPinnedState = 'All' | 'PinnedOnly' | 'Unpinned'

export const GLOBAL_SEARCH_PINNED_STATE_KEY = 'mihon.globalSearchPinnedState'

function readGlobalSearchPinnedState(): GlobalSearchPinnedState {
  const val = readPreference(GLOBAL_SEARCH_PINNED_STATE_KEY)
  if (val === 'PinnedOnly' || val === 'Unpinned' || val === 'All') {
    return val
  }
  return 'PinnedOnly'
}

export const globalSearchPinnedState: Ref<GlobalSearchPinnedState> = ref<GlobalSearchPinnedState>(readGlobalSearchPinnedState())

watch(globalSearchPinnedState, value => writePreference(GLOBAL_SEARCH_PINNED_STATE_KEY, value))

export function getNextGlobalSearchPinnedState(current: GlobalSearchPinnedState): GlobalSearchPinnedState {
  switch (current) {
    case 'PinnedOnly':
      return 'Unpinned'
    case 'Unpinned':
      return 'All'
    case 'All':
      return 'PinnedOnly'
    default:
      return 'PinnedOnly'
  }
}

export const useBrowsePreferencesStore = defineStore('browsePreferences', () => {
  return {
    hideInLibraryItems,
    enabledContentWarnings,
    applyContentWarningsToInstalled,
    contentWarningsSubtitle,
    globalSearchPinnedState,
    getNextGlobalSearchPinnedState,
  }
})
