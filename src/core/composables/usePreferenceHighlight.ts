import { nextTick, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { SETTINGS_PREF_LABELS, useSettingsHighlight } from '@/features/settings/stores/settingsHighlight'

/**
 * Mihon: `PreferenceScreen.kt` reacts to `SearchableSettings.highlightKey`.
 *
 * ```kotlin
 * val highlightKey = SearchableSettings.highlightKey
 * if (highlightKey != null) {
 *     LaunchedEffect(Unit) {
 *         val i = items.findHighlightedIndex(highlightKey)
 *         if (i >= 0) {
 *             delay(0.5.seconds)
 *             state.animateScrollToItem(i)
 *         }
 *         SearchableSettings.highlightKey = null
 *     }
 * }
 * ```
 *
 * The matching row is then drawn with `BasePreferenceWidget.highlightBackground`:
 * `surfaceTint.copy(alpha = 0.12f)`, animated with five 200ms reverse iterations after a 600ms
 * delay.
 *
 * The web client has no per item widgets, so the highlighted row is found in the rendered
 * settings detail by its title and marked with the `pref-highlight` class.
 */
export function usePreferenceHighlight(rootSelector = '.settings-detail') {
  const route = useRoute()
  const highlight = useSettingsHighlight()

  function findRow(title: string): HTMLElement | null {
    const root = document.querySelector<HTMLElement>(rootSelector)
    if (!root) return null
    const wanted = [title, SETTINGS_PREF_LABELS[title] ?? ''].filter(Boolean).map(t => t.toLowerCase())
    const candidates = root.querySelectorAll<HTMLElement>(
      '.pref-row__title, .pref-title, .v-list-item-title, .pref-heading, h2, h3',
    )
    for (const candidate of candidates) {
      const text = (candidate.textContent ?? '').trim().toLowerCase()
      if (wanted.includes(text)) {
        return (candidate.closest('.pref-row, .v-list-item, li, div') as HTMLElement | null) ?? candidate
      }
    }
    return null
  }

  async function applyHighlight() {
    const key = highlight.highlightKey || (typeof route.query.highlight === 'string' ? route.query.highlight : null)
    if (!key) return
    // Mihon: `delay(0.5.seconds)` before scrolling to the item.
    await new Promise(resolve => setTimeout(resolve, 500))
    await nextTick()
    const row = findRow(key)
    highlight.reset()
    if (!row) return
    row.scrollIntoView({ block: 'center', behavior: 'smooth' })
    row.classList.add('pref-highlight')
    setTimeout(() => row.classList.remove('pref-highlight'), 3000)
  }

  onMounted(() => void applyHighlight())
  watch(() => route.fullPath, () => void applyHighlight())
}
