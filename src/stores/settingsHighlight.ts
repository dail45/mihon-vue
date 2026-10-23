import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Mihon: `SearchableSettings.highlightKey`
 * (`app/src/main/java/eu/kanade/presentation/more/settings/screen/SearchableSettings.kt`).
 *
 * The static key is set by `SettingsSearchScreen` before it navigates to a settings screen.
 * `PreferenceScreen` then waits 0.5s, scrolls the matching preference into view and resets the
 * key to `null`. `StatusWrapper` reports the key as `LocalPreferenceHighlighted` and
 * `BasePreferenceWidget` draws the highlight background
 * (`surfaceTint.copy(alpha = 0.12f)`, animated, five 200ms iterations with a 600ms delay).
 *
 * The web client has no per widget widgets, so the key is kept in a store and the settings
 * screen applies the same highlight to the matching row.
 */
export const useSettingsHighlight = defineStore('settingsHighlight', () => {
  const highlightKey = ref<string | null>(null)

  function set(key: string) {
    highlightKey.value = key
  }

  function reset() {
    highlightKey.value = null
  }

  return { highlightKey, set, reset }
})

/**
 * Mihon searches the reference titles of the preferences; the web client renders its own
 * labels. The map translates a reference title into the `data-pref` key of the rendered row.
 */
export const SETTINGS_PREF_LABELS: Record<string, string> = {
  'Edit categories': 'Categories',
  'Per-category settings for sort': 'Per-category sorting',
  'Require unlock': 'Lock with biometrics',
}
