import { defineStore } from 'pinia'
import {
  hideInLibraryItems,
  enabledContentWarnings,
  applyContentWarningsToInstalled,
  contentWarningsSubtitle,
  contentWarningEntries,
  type ContentWarningKey,
} from '../utils/browsePreferences'

export { contentWarningEntries, contentWarningsSubtitle, type ContentWarningKey }

export const useBrowsePreferencesStore = defineStore('browsePreferences', () => {
  return {
    hideInLibraryItems,
    enabledContentWarnings,
    applyContentWarningsToInstalled,
    contentWarningsSubtitle,
  }
})
