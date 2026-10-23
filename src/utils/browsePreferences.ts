import { ref, watch } from 'vue'
import { readPreference, writePreference } from '../stores/preferences'

/**
 * Browse settings preferences.
 *
 * Mihon keeps them in `SourcePreferences` (an Android DataStore):
 *   - `hideInLibraryItems`          → "browse_hide_in_library_items"   (default false)
 *   - `enabledContentWarnings`      → setOf(SAFE, MIXED, NSFW)          (default all three)
 *   - `applyContentWarningsToInstalled` → true
 *
 * The web client is a headless REST client for Suwayomi-Server, which stores no such
 * preferences, so they live in this browser's local storage (same approach as the other
 * UI-only preferences in `stores/preferences.ts`).
 */
export type ContentWarningKey = 'safe' | 'mixed' | 'nsfw'

/** MR.strings.ext_content_warning_safe / _mixed / _nsfw */
export const contentWarningEntries: { key: ContentWarningKey; title: string }[] = [
  { key: 'safe', title: 'Safe' },
  { key: 'mixed', title: 'Mixed' },
  { key: 'nsfw', title: '18+' },
]

const HIDE_IN_LIBRARY_KEY = 'mihon.browse.hideInLibraryItems'
const CONTENT_WARNINGS_KEY = 'mihon.browse.contentWarnings'
const APPLY_TO_INSTALLED_KEY = 'mihon.browse.applyContentWarningsToInstalled'

function readWarnings(): ContentWarningKey[] {
  const raw = readPreference(CONTENT_WARNINGS_KEY)
  if (raw === null) return contentWarningEntries.map(entry => entry.key)
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return contentWarningEntries.map(entry => entry.key)
    const valid = parsed.filter((value): value is ContentWarningKey =>
      contentWarningEntries.some(entry => entry.key === value))
    return valid
  } catch {
    return contentWarningEntries.map(entry => entry.key)
  }
}

export const hideInLibraryItems = ref(readPreference(HIDE_IN_LIBRARY_KEY) === 'true')
export const enabledContentWarnings = ref<ContentWarningKey[]>(readWarnings())
export const applyContentWarningsToInstalled = ref(readPreference(APPLY_TO_INSTALLED_KEY) !== 'false')

watch(hideInLibraryItems, value => writePreference(HIDE_IN_LIBRARY_KEY, String(value)))
watch(enabledContentWarnings, value => writePreference(CONTENT_WARNINGS_KEY, JSON.stringify(value)), { deep: true })
watch(applyContentWarningsToInstalled, value => writePreference(APPLY_TO_INSTALLED_KEY, String(value)))

/** The subtitle of the multi-select preference: the selected labels joined by ", ", or "None". */
export function contentWarningsSubtitle(selected: ContentWarningKey[]): string {
  const titles = contentWarningEntries
    .filter(entry => selected.includes(entry.key))
    .map(entry => entry.title)
  return titles.length ? titles.join(', ') : 'None'
}
