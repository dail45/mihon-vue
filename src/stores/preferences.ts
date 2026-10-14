import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
export type DisplayMode = 'compact' | 'comfortable' | 'covers' | 'list'
export type ThemeMode = 'system' | 'light' | 'dark'
// Only harmless UI preferences are stored; no manga database or credentials.
export function readPreference(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
export function writePreference(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* private mode: session-only preference */ }
}
export const usePreferencesStore = defineStore('preferences', () => {
  const savedTheme = readPreference('mihon.theme')
  const themeMode = ref<ThemeMode>(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : 'system')
  watch(themeMode, value => writePreference('mihon.theme', value))
  const savedDisplay = readPreference('mihon.library.display')
  const libraryDisplay = ref<DisplayMode>(['comfortable', 'covers', 'list'].includes(savedDisplay || '') ? savedDisplay as DisplayMode : 'compact')
  const savedCatalogueDisplay = readPreference('mihon.catalogue.display')
  const catalogueDisplay = ref<DisplayMode>(['comfortable', 'covers', 'list'].includes(savedCatalogueDisplay || '') ? savedCatalogueDisplay as DisplayMode : 'compact')
  watch(catalogueDisplay, v => writePreference('mihon.catalogue.display', v))
  const downloadedOnly = ref(readPreference('mihon.library.downloadedOnly') === 'true')
  const showBadges = ref(readPreference('mihon.library.badges') !== 'false')
  watch(libraryDisplay, v => writePreference('mihon.library.display', v))
  watch(downloadedOnly, v => writePreference('mihon.library.downloadedOnly', String(v)))
  watch(showBadges, v => writePreference('mihon.library.badges', String(v)))
  return { themeMode, libraryDisplay, catalogueDisplay, downloadedOnly, showBadges }
})
