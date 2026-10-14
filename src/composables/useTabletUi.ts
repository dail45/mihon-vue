import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import { usePreferencesStore, type TabletUiMode } from '../stores/preferences'
/** Mihon's orientation thresholds, expressed in CSS pixels for the web viewport. */
export function isTabletUi(mode: TabletUiMode, width: number, height: number) {
  if (mode === 'always') return true
  if (mode === 'never') return false
  const landscape = width > height
  if (mode === 'landscape') return landscape
  return Math.min(width, height) >= (landscape ? 600 : 700)
}
export function useTabletUi() {
  const prefs = usePreferencesStore(), display = useDisplay()
  return computed(() => isTabletUi(prefs.tabletUiMode, display.width.value, display.height.value))
}
