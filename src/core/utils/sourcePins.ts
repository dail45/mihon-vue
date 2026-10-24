import { ref, watch } from 'vue'
import { readPreference, writePreference } from '@/features/settings/stores/preferences'

/**
 * Source pin state.
 *
 * Mihon stores it in app-local preferences, not on the server:
 * `SourcePreferences.pinnedSources` = preferenceStore.getStringSet("pinned_catalogues")
 * (mihon/app/src/main/java/eu/kanade/domain/source/service/SourcePreferences.kt:39),
 * toggled by `ToggleSourcePin.await(source)`.
 *
 * Suwayomi-Server exposes no REST contract for pinning a source, so the web client
 * keeps the same local set in localStorage under the same key the Sources screen uses.
 */
export const PINNED_SOURCES_KEY = 'mihon.sources.pinned'

const pinnedIds = ref<string[]>(readPinned())

function readPinned(): string[] {
  const raw = readPreference(PINNED_SOURCES_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

/** Re-reads the stored set so this module stays in sync with other writers. */
function sync(): string[] {
  const stored = readPinned()
  if (stored.join('\u0000') !== pinnedIds.value.join('\u0000')) pinnedIds.value = stored
  return pinnedIds.value
}

watch(pinnedIds, (ids) => writePreference(PINNED_SOURCES_KEY, JSON.stringify(ids)))

export function isSourcePinned(sourceId: string): boolean {
  return sync().includes(sourceId)
}

export function setSourcePinned(sourceId: string, pinned: boolean): void {
  const ids = sync().slice()
  const index = ids.indexOf(sourceId)
  if (pinned && index < 0) ids.push(sourceId)
  else if (!pinned && index >= 0) ids.splice(index, 1)
  pinnedIds.value = ids
  writePreference(PINNED_SOURCES_KEY, JSON.stringify(ids))
}

export function toggleSourcePin(sourceId: string): boolean {
  const next = !isSourcePinned(sourceId)
  setSourcePinned(sourceId, next)
  return next
}

export function pinnedSourceIds(): string[] {
  return sync().slice()
}
