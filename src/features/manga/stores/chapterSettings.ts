import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { readPreference, writePreference } from '@/features/settings/stores/preferences'
import { chapterSortOptions, defaultChapterSettings, type ChapterSettings, type ChapterSortType } from '@/core/utils/chapters'
function valid(raw: unknown): ChapterSettings {
  const value = defaultChapterSettings()
  if (!raw || typeof raw !== 'object') return value
  const r = raw as Record<string, unknown>
  for (const key of ['downloaded', 'unread', 'bookmarked'] as const) if (['all', 'include', 'exclude'].includes(String(r[key]))) value[key] = r[key] as ChapterSettings[typeof key]
  if (chapterSortOptions.some(o => o.value === r.sort)) value.sort = r.sort as ChapterSortType
  if (typeof r.descending === 'boolean') value.descending = r.descending
  if (r.display === 'number') value.display = 'number'
  return value
}
function json(key: string): unknown { try { return JSON.parse(readPreference(key) || 'null') } catch { return null } }
export const useChapterSettings = defineStore('chapter-settings', () => {
  const defaults = ref(valid(json('mihon.chapters.default'))), items = ref<Record<string, ChapterSettings>>({})
  const raw = json('mihon.chapters.settings')
  if (raw && typeof raw === 'object') for (const [key, value] of Object.entries(raw)) items.value[key] = valid(value)
  function forManga(apiUrl: string, id: number): ChapterSettings {
    const key = `${apiUrl}::${id}`
    return items.value[key] ? { ...items.value[key] } : { ...defaults.value }
  }
  function set(apiUrl: string, id: number, settings: ChapterSettings) {
    items.value[`${apiUrl}::${id}`] = { ...settings }
  }
  function update(apiUrl: string, id: number, patch: Partial<ChapterSettings>) {
    const key = `${apiUrl}::${id}`
    items.value[key] = { ...(items.value[key] ?? defaults.value), ...patch }
  }
  function choose(settings: ChapterSettings, mode: ChapterSortType, apiUrl?: string, id?: number) {
    if (settings.sort === mode) settings.descending = !settings.descending
    else { settings.sort = mode; settings.descending = false }
    if (apiUrl && id !== undefined) {
      update(apiUrl, id, { sort: settings.sort, descending: settings.descending })
    }
  }
  function reset(apiUrl: string, id: number) { items.value[`${apiUrl}::${id}`] = { ...defaults.value } }
  function setDefault(settings: ChapterSettings) { defaults.value = { ...settings } }
  watch(defaults, v => writePreference('mihon.chapters.default', JSON.stringify(v)), { deep: true })
  watch(items, v => writePreference('mihon.chapters.settings', JSON.stringify(v)), { deep: true })
  return { defaults, items, forManga, set, update, choose, reset, setDefault }
})
