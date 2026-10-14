import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
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
  return { themeMode }
})
