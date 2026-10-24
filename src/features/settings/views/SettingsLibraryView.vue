<script setup lang="ts">
/**
 * Settings - Library.
 *
 * Mirrors mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsLibraryScreen.kt
 * (inspected commit 446f6df8) and the shared preference widgets in
 * eu/kanade/presentation/more/settings/widget/*.kt.
 *
 * Reference structure (group order and item order are exact):
 *   1. "Categories"    - Edit categories (text), Default category (list), Per-category settings for sort (switch)
 *   2. "Global update" - Automatic updates (list), device restrictions (multi; visible only when interval > 0),
 *                        Categories (tri-state dialog), Automatically refresh metadata (switch),
 *                        Smart update (multi), Show unread count on Updates icon (switch)
 *   3. "Behavior"      - swipe to left / swipe to right (list), Mark duplicate read chapter as read (multi),
 *                        Hide missing chapter indicators (switch)
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createSuwayomiApi } from '@/core/api/client'
import { readServerSettings, saveServerSettings } from '@/core/api/serverSettings'
import type { Category } from '@/core/api/types'
import Md3Switch from '@/core/components/Md3Switch.vue'
import { readPreference, usePreferencesStore, writePreference } from '../stores/preferences'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'

const router = useRouter()
const server = useSuwayomiStore()
const preferences = usePreferencesStore()

// ---------------------------------------------------------------------------
// Local preference storage (the browser stands in for Mihon's PreferenceStore).
// ---------------------------------------------------------------------------
function readString(key: string, fallback: string) { return readPreference(key) ?? fallback }
function readBool(key: string, fallback: boolean) {
  const stored = readPreference(key)
  return stored === null ? fallback : stored === 'true'
}
function readSet(key: string, fallback: string[] = []): string[] {
  try {
    const raw = readPreference(key)
    if (raw === null) return fallback
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string') : fallback
  } catch { return fallback }
}
function writeSet(key: string, value: string[]) { writePreference(key, JSON.stringify(value)) }

// Categories group ------------------------------------------------------------
const defaultCategory = ref(readString('mihon.library.defaultCategory', '-1'))

// Global update group --------------------------------------------------------
const updateInterval = ref(readString('mihon.library.updateInterval', '0'))
/** Mihon default: setOf(DEVICE_ONLY_ON_WIFI). */
const deviceRestrictions = ref(readSet('mihon.library.updateRestrictions', ['wifi']))
/** Mihon default: all four smart-update restrictions are enabled. */
const smartUpdateRestrictions = ref(readSet('mihon.library.updateMangaRestrictions', ['unread', 'started', 'completed', 'release']))
const autoUpdateMetadata = ref(readBool('mihon.library.autoUpdateMetadata', false))
const newShowUpdatesCount = ref(readBool('mihon.library.showUpdatesCount', true))
const updateCategories = ref(readSet('mihon.library.updateCategories'))
const updateCategoriesExclude = ref(readSet('mihon.library.updateCategoriesExclude'))

// Behavior group -------------------------------------------------------------
const swipeToStartAction = ref(readString('mihon.library.swipeToStartAction', 'ToggleRead'))
const swipeToEndAction = ref(readString('mihon.library.swipeToEndAction', 'ToggleBookmark'))
const markDuplicateRead = ref(readSet('mihon.library.markDuplicateReadChapter'))
const hideMissingChapters = ref(readBool('mihon.library.hideMissingChapters', false))

// Categories from the server (read-only GET /category).
const categories = ref<Category[]>([])
const categoriesError = ref('')
onMounted(async () => {
  try {
    const list = await createSuwayomiApi(server.apiUrl).categories()
    categories.value = [...list].sort((a, b) => a.order - b.order)
    categoriesError.value = ''
  } catch (error) {
    categoriesError.value = error instanceof Error ? error.message : 'Could not read categories from the server.'
  }
})
/** Mihon: Category::isSystemCategory - the default category is not a user category. */
const userCategories = computed(() => categories.value.filter(c => !(c.id === 0 || c.isDefaultCategory === true || c.default === true)))
/** Mihon: pluralStringResource(MR.plurals.num_categories, count) */
const categoriesCountLabel = computed(() => `${userCategories.value.length} ${userCategories.value.length === 1 ? 'category' : 'categories'}`)
const sortTagsCountLabel = computed(() => `${preferences.sortTags.length} ${preferences.sortTags.length === 1 ? 'tag' : 'tags'}`)

// Entries --------------------------------------------------------------------
const defaultCategoryEntries = computed(() => [
  { value: '-1', title: 'Always ask' },
  ...categories.value.map(c => ({ value: String(c.id), title: c.name })),
])
const defaultCategoryLabel = computed(() => defaultCategoryEntries.value.find(e => e.value === defaultCategory.value)?.title ?? 'Always ask')

const intervalEntries = [
  { value: '0', title: 'Off' },
  { value: '12', title: 'Every 12 hours' },
  { value: '24', title: 'Daily' },
  { value: '48', title: 'Every 2 days' },
  { value: '72', title: 'Every 3 days' },
  { value: '168', title: 'Weekly' },
]
const intervalLabel = computed(() => intervalEntries.find(e => e.value === updateInterval.value)?.title ?? 'Off')
const restrictionEntries = [
  { value: 'wifi', title: 'Only on Wi-Fi' },
  { value: 'unmetered', title: 'Only on unmetered network' },
  { value: 'charging', title: 'When charging' },
]
const smartUpdateEntries = [
  { value: 'unread', title: 'Skip entries with unread chapter(s)' },
  { value: 'started', title: 'Skip unstarted entries' },
  { value: 'completed', title: 'Skip entries with "Completed" status' },
  { value: 'release', title: 'Predict next release time' },
]
const swipeEntries = [
  { value: 'Disabled', title: 'Disabled' },
  { value: 'ToggleBookmark', title: 'Bookmark chapter' },
  { value: 'ToggleRead', title: 'Mark as read' },
  { value: 'Download', title: 'Download' },
]
const swipeToStartLabel = computed(() => swipeEntries.find(e => e.value === swipeToStartAction.value)?.title ?? 'Disabled')
const swipeToEndLabel = computed(() => swipeEntries.find(e => e.value === swipeToEndAction.value)?.title ?? 'Disabled')
const duplicateEntries = [
  { value: 'existing', title: 'After reading a chapter' },
  { value: 'new', title: 'After fetching new chapter' },
]
/** Mihon: MultiSelectListPreference subtitle provider joins the selected labels, or "None". */
function joinedLabels(entries: { value: string; title: string }[], values: string[]) {
  const joined = entries.filter(e => values.includes(e.value)).map(e => e.title).join(', ')
  return joined || 'None'
}
const restrictionsLabel = computed(() => `Restrictions: ${joinedLabels(restrictionEntries, deviceRestrictions.value)}`)
const smartUpdateLabel = computed(() => joinedLabels(smartUpdateEntries, smartUpdateRestrictions.value))
const duplicateLabel = computed(() => joinedLabels(duplicateEntries, markDuplicateRead.value))

// Categories tri-state label -------------------------------------------------
/** Mihon: getCategoriesLabel() - "Include: x\nExclude: y". */
const categoriesLabel = computed(() => {
  const included = categories.value.filter(c => updateCategories.value.includes(String(c.id)))
  const excluded = categories.value.filter(c => updateCategoriesExclude.value.includes(String(c.id)))
  const includedText = included.length === 0 ? 'None' : included.length === categories.value.length ? 'All' : included.map(c => c.name).join(', ')
  const excludedText = excluded.length === 0 ? 'None' : excluded.length === categories.value.length ? 'All' : excluded.map(c => c.name).join(', ')
  return `Include: ${includedText}\nExclude: ${excludedText}`
})

// Dialog state ---------------------------------------------------------------
const dialog = ref<null | 'defaultCategory' | 'interval' | 'restrictions' | 'categories' | 'smartUpdate' | 'swipeStart' | 'swipeEnd' | 'duplicate'>(null)
const triState = ref<Record<string, 'include' | 'exclude' | 'none'>>({})
const notice = ref('')
const noticeError = ref(false)

function openTriState() {
  const next: Record<string, 'include' | 'exclude' | 'none'> = {}
  for (const c of categories.value) {
    const id = String(c.id)
    next[id] = updateCategories.value.includes(id) ? 'include' : updateCategoriesExclude.value.includes(id) ? 'exclude' : 'none'
  }
  triState.value = next
  dialog.value = 'categories'
}
/** Mihon: UNCHECKED -> CHECKED -> INVERSED -> UNCHECKED. */
function cycleTriState(id: string) {
  const current = triState.value[id] ?? 'none'
  triState.value = { ...triState.value, [id]: current === 'none' ? 'include' : current === 'include' ? 'exclude' : 'none' }
}

function saveTriState() {
  const included = Object.entries(triState.value).filter(([, s]) => s === 'include').map(([id]) => id)
  const excluded = Object.entries(triState.value).filter(([, s]) => s === 'exclude').map(([id]) => id)
  updateCategories.value = included
  updateCategoriesExclude.value = excluded
  writeSet('mihon.library.updateCategories', included)
  writeSet('mihon.library.updateCategoriesExclude', excluded)
  dialog.value = null
  showNotice('Category include/exclude is stored in this browser. Suwayomi-Server has no endpoint that writes the per-category update flags, so the server-side update job is unchanged.', true)
}

/** Suwayomi-Server owns the update schedule; Mihon's interval maps to globalUpdateInterval (hours). */
async function applyInterval(value: string) {
  updateInterval.value = value
  writePreference('mihon.library.updateInterval', value)
  const hours = Number(value)
  try {
    await saveServerSettings(server.apiUrl, { globalUpdateInterval: hours })
    showNotice('The update interval was saved to Suwayomi-Server.', false)
  } catch {
    try {
      const settings = await readServerSettings(server.apiUrl)
      if (settings.globalUpdateInterval !== hours) throw new Error('not confirmed')
      showNotice('The update interval is confirmed by Suwayomi-Server.', false)
    } catch {
      showNotice('The server did not confirm the update interval. The value is kept in this browser only.', true)
    }
  }
}

function showNotice(message: string, isError: boolean) {
  notice.value = message
  noticeError.value = isError
}

function persistSwitch(key: string, value: boolean) { writePreference(key, String(value)) }
function persistString(key: string, value: string) { writePreference(key, value) }
function persistSet(key: string, value: string[]) { writeSet(key, value) }

function toggleSet(list: string[], entry: string, checked: boolean) {
  return checked ? [...new Set([...list, entry])] : list.filter(v => v !== entry)
}

// Multi-select dialogs: Mihon keeps the selection local until "OK" is pressed.
const pending = ref<string[]>([])
function openMulti(kind: 'restrictions' | 'smartUpdate' | 'duplicate') {
  pending.value = kind === 'restrictions' ? [...deviceRestrictions.value] : kind === 'smartUpdate' ? [...smartUpdateRestrictions.value] : [...markDuplicateRead.value]
  dialog.value = kind
}
function commitMulti(kind: 'restrictions' | 'smartUpdate' | 'duplicate') {
  if (kind === 'restrictions') { deviceRestrictions.value = [...pending.value]; persistSet('mihon.library.updateRestrictions', deviceRestrictions.value) }
  else if (kind === 'smartUpdate') { smartUpdateRestrictions.value = [...pending.value]; persistSet('mihon.library.updateMangaRestrictions', smartUpdateRestrictions.value) }
  else { markDuplicateRead.value = [...pending.value]; persistSet('mihon.library.markDuplicateReadChapter', markDuplicateRead.value) }
  dialog.value = null
}
</script>

<template>
  <div class="pref-screen">
    <!-- ============================ Categories ============================ -->
    <div class="pref-group-header">Categories</div>
    <div class="pref-item" role="button" tabindex="0" @click="router.push('/settings/library/categories')" @keydown.enter="router.push('/settings/library/categories')">
      <div class="pref-text">
        <div class="pref-title">Edit categories</div>
        <div class="pref-subtitle">{{ categoriesCountLabel }}</div>
      </div>
    </div>
    <div class="pref-item" role="button" tabindex="0" @click="dialog = 'defaultCategory'" @keydown.enter="dialog = 'defaultCategory'">
      <div class="pref-text">
        <div class="pref-title">Default category</div>
        <div class="pref-subtitle">{{ defaultCategoryLabel }}</div>
      </div>
    </div>
    <div class="pref-item" role="button" tabindex="0" @click="router.push('/settings/library/sort-tags')" @keydown.enter="router.push('/settings/library/sort-tags')">
      <div class="pref-text">
        <div class="pref-title">Tag sorting</div>
        <div class="pref-subtitle">{{ sortTagsCountLabel }}</div>
      </div>
    </div>
    <div class="pref-item" role="switch" :aria-checked="preferences.categorizedSort" tabindex="0" @click="preferences.categorizedSort = !preferences.categorizedSort" @keydown.enter="preferences.categorizedSort = !preferences.categorizedSort">
      <div class="pref-text">
        <div class="pref-title">Per-category settings for sort</div>
      </div>
      <Md3Switch :model-value="preferences.categorizedSort" class="pref-switch" label="Per-category settings for sort" />
    </div>

    <div class="pref-group-gap"></div>

    <!-- =========================== Global update ========================== -->
    <div class="pref-group-header">Global update</div>
    <div class="pref-item" role="button" tabindex="0" @click="dialog = 'interval'" @keydown.enter="dialog = 'interval'">
      <div class="pref-text">
        <div class="pref-title">Automatic updates</div>
        <div class="pref-subtitle">{{ intervalLabel }}</div>
      </div>
    </div>
    <!-- Reference: visible = autoUpdateInterval > 0 -->
    <div v-if="Number(updateInterval) > 0" class="pref-item" role="button" tabindex="0" @click="openMulti('restrictions')" @keydown.enter="openMulti('restrictions')">
      <div class="pref-text">
        <div class="pref-title">Automatic updates device restrictions</div>
        <div class="pref-subtitle">{{ restrictionsLabel }}</div>
      </div>
    </div>
    <div class="pref-item" role="button" tabindex="0" @click="openTriState" @keydown.enter="openTriState">
      <div class="pref-text">
        <div class="pref-title">Categories</div>
        <div class="pref-subtitle pref-subtitle-multiline">{{ categoriesLabel }}</div>
      </div>
    </div>
    <div class="pref-item" role="switch" :aria-checked="autoUpdateMetadata" tabindex="0" @click="autoUpdateMetadata = !autoUpdateMetadata; persistSwitch('mihon.library.autoUpdateMetadata', autoUpdateMetadata)" @keydown.enter="autoUpdateMetadata = !autoUpdateMetadata; persistSwitch('mihon.library.autoUpdateMetadata', autoUpdateMetadata)">
      <div class="pref-text">
        <div class="pref-title">Automatically refresh metadata</div>
        <div class="pref-subtitle">Check for new cover and details when updating library</div>
      </div>
      <Md3Switch :model-value="autoUpdateMetadata" class="pref-switch" label="Automatically refresh metadata" />
    </div>
    <div class="pref-item" role="button" tabindex="0" @click="openMulti('smartUpdate')" @keydown.enter="openMulti('smartUpdate')">
      <div class="pref-text">
        <div class="pref-title">Smart update</div>
        <div class="pref-subtitle">{{ smartUpdateLabel }}</div>
      </div>
    </div>
    <div class="pref-item" role="switch" :aria-checked="newShowUpdatesCount" tabindex="0" @click="newShowUpdatesCount = !newShowUpdatesCount; persistSwitch('mihon.library.showUpdatesCount', newShowUpdatesCount)" @keydown.enter="newShowUpdatesCount = !newShowUpdatesCount; persistSwitch('mihon.library.showUpdatesCount', newShowUpdatesCount)">
      <div class="pref-text">
        <div class="pref-title">Show unread count on Updates icon</div>
      </div>
      <Md3Switch :model-value="newShowUpdatesCount" class="pref-switch" label="Show unread count on Updates icon" />
    </div>

    <div class="pref-group-gap"></div>

    <!-- ============================== Behavior ============================ -->
    <div class="pref-group-header">Behavior</div>
    <div class="pref-item" role="button" tabindex="0" @click="dialog = 'swipeStart'" @keydown.enter="dialog = 'swipeStart'">
      <div class="pref-text">
        <div class="pref-title">Chapter on swipe to left</div>
        <div class="pref-subtitle">{{ swipeToStartLabel }}</div>
      </div>
    </div>
    <div class="pref-item" role="button" tabindex="0" @click="dialog = 'swipeEnd'" @keydown.enter="dialog = 'swipeEnd'">
      <div class="pref-text">
        <div class="pref-title">Chapter on swipe to right</div>
        <div class="pref-subtitle">{{ swipeToEndLabel }}</div>
      </div>
    </div>
    <div class="pref-item" role="button" tabindex="0" @click="openMulti('duplicate')" @keydown.enter="openMulti('duplicate')">
      <div class="pref-text">
        <div class="pref-title">Mark duplicate read chapter as read</div>
        <div class="pref-subtitle">{{ duplicateLabel }}</div>
      </div>
    </div>
    <div class="pref-item" role="switch" :aria-checked="hideMissingChapters" tabindex="0" @click="hideMissingChapters = !hideMissingChapters; persistSwitch('mihon.library.hideMissingChapters', hideMissingChapters)" @keydown.enter="hideMissingChapters = !hideMissingChapters; persistSwitch('mihon.library.hideMissingChapters', hideMissingChapters)">
      <div class="pref-text">
        <div class="pref-title">Hide missing chapter indicators</div>
      </div>
      <Md3Switch :model-value="hideMissingChapters" class="pref-switch" label="Hide missing chapter indicators" />
    </div>
    <!-- 3.4 Empty Categories During Search (Komikku SettingsLibraryScreen.kt:290-294) -->
    <div class="pref-item" role="switch" :aria-checked="preferences.showEmptyCategoriesSearch" tabindex="0" @click="preferences.showEmptyCategoriesSearch = !preferences.showEmptyCategoriesSearch" @keydown.enter="preferences.showEmptyCategoriesSearch = !preferences.showEmptyCategoriesSearch">
      <div class="pref-text">
        <div class="pref-title">Show empty categories during search</div>
      </div>
      <Md3Switch :model-value="preferences.showEmptyCategoriesSearch" class="pref-switch" label="Show empty categories during search" />
    </div>

    <!-- Notices: honest statements about what the web client cannot do. -->
    <p v-if="categoriesError" class="pref-note pref-note-error" role="alert">Categories could not be read from the server: {{ categoriesError }}</p>
    <p v-if="notice" class="pref-note" :class="{ 'pref-note-error': noticeError }" role="status">{{ notice }}</p>
    <p class="pref-note">Device restrictions, smart update, metadata refresh, the update badge and the chapter swipe actions are applied by the client that schedules the work. Suwayomi-Server has no equivalent setting, so these values are kept in this browser only.</p>

    <!-- ============================ Dialogs ============================== -->
    <v-dialog :model-value="dialog !== null" max-width="560" @update:model-value="value => { if (!value) dialog = null }">
      <v-card rounded="xl" class="pref-dialog">
        <!-- List preference: radio rows, Cancel only (the selection applies immediately). -->
        <template v-if="dialog === 'defaultCategory'">
          <v-card-title class="pref-dialog-title">Default category</v-card-title>
          <v-card-text class="pref-dialog-text">
            <div v-for="entry in defaultCategoryEntries" :key="entry.value" class="pref-dialog-row" role="radio" :aria-checked="defaultCategory === entry.value" tabindex="0" @click="defaultCategory = entry.value; persistString('mihon.library.defaultCategory', entry.value); dialog = null" @keydown.enter="defaultCategory = entry.value; persistString('mihon.library.defaultCategory', entry.value); dialog = null">
              <v-icon :icon="defaultCategory === entry.value ? 'radio_button_checked' : 'radio_button_unchecked'" class="pref-radio-icon" :class="{ 'pref-radio-icon-on': defaultCategory === entry.value }" />
              <span class="pref-dialog-label">{{ entry.title }}</span>
            </div>
          </v-card-text>
          <v-card-actions><v-spacer /><v-btn variant="text" @click="dialog = null">Cancel</v-btn></v-card-actions>
        </template>

        <template v-else-if="dialog === 'interval'">
          <v-card-title class="pref-dialog-title">Automatic updates</v-card-title>
          <v-card-text class="pref-dialog-text">
            <div v-for="entry in intervalEntries" :key="entry.value" class="pref-dialog-row" role="radio" :aria-checked="updateInterval === entry.value" tabindex="0" @click="applyInterval(entry.value); dialog = null" @keydown.enter="applyInterval(entry.value); dialog = null">
              <v-icon :icon="updateInterval === entry.value ? 'radio_button_checked' : 'radio_button_unchecked'" class="pref-radio-icon" :class="{ 'pref-radio-icon-on': updateInterval === entry.value }" />
              <span class="pref-dialog-label">{{ entry.title }}</span>
            </div>
          </v-card-text>
          <v-card-actions><v-spacer /><v-btn variant="text" @click="dialog = null">Cancel</v-btn></v-card-actions>
        </template>

        <template v-else-if="dialog === 'swipeStart'">
          <v-card-title class="pref-dialog-title">Chapter on swipe to left</v-card-title>
          <v-card-text class="pref-dialog-text">
            <div v-for="entry in swipeEntries" :key="entry.value" class="pref-dialog-row" role="radio" :aria-checked="swipeToStartAction === entry.value" tabindex="0" @click="swipeToStartAction = entry.value; persistString('mihon.library.swipeToStartAction', entry.value); dialog = null" @keydown.enter="swipeToStartAction = entry.value; persistString('mihon.library.swipeToStartAction', entry.value); dialog = null">
              <v-icon :icon="swipeToStartAction === entry.value ? 'radio_button_checked' : 'radio_button_unchecked'" class="pref-radio-icon" :class="{ 'pref-radio-icon-on': swipeToStartAction === entry.value }" />
              <span class="pref-dialog-label">{{ entry.title }}</span>
            </div>
          </v-card-text>
          <v-card-actions><v-spacer /><v-btn variant="text" @click="dialog = null">Cancel</v-btn></v-card-actions>
        </template>

        <template v-else-if="dialog === 'swipeEnd'">
          <v-card-title class="pref-dialog-title">Chapter on swipe to right</v-card-title>
          <v-card-text class="pref-dialog-text">
            <div v-for="entry in swipeEntries" :key="entry.value" class="pref-dialog-row" role="radio" :aria-checked="swipeToEndAction === entry.value" tabindex="0" @click="swipeToEndAction = entry.value; persistString('mihon.library.swipeToEndAction', entry.value); dialog = null" @keydown.enter="swipeToEndAction = entry.value; persistString('mihon.library.swipeToEndAction', entry.value); dialog = null">
              <v-icon :icon="swipeToEndAction === entry.value ? 'radio_button_checked' : 'radio_button_unchecked'" class="pref-radio-icon" :class="{ 'pref-radio-icon-on': swipeToEndAction === entry.value }" />
              <span class="pref-dialog-label">{{ entry.title }}</span>
            </div>
          </v-card-text>
          <v-card-actions><v-spacer /><v-btn variant="text" @click="dialog = null">Cancel</v-btn></v-card-actions>
        </template>

        <!-- Multi select preferences: checkboxes with OK / Cancel. -->
        <template v-else-if="dialog === 'restrictions'">
          <v-card-title class="pref-dialog-title">Automatic updates device restrictions</v-card-title>
          <v-card-text class="pref-dialog-text">
            <v-checkbox v-for="entry in restrictionEntries" :key="entry.value" :model-value="pending.includes(entry.value)" :label="entry.title" hide-details density="compact" class="pref-dialog-check" @update:model-value="checked => { pending = toggleSet(pending, entry.value, Boolean(checked)) }" />
          </v-card-text>
          <v-card-actions><v-btn variant="text" @click="dialog = null">Cancel</v-btn><v-spacer /><v-btn variant="text" color="primary" @click="commitMulti('restrictions')">OK</v-btn></v-card-actions>
        </template>

        <template v-else-if="dialog === 'smartUpdate'">
          <v-card-title class="pref-dialog-title">Smart update</v-card-title>
          <v-card-text class="pref-dialog-text">
            <v-checkbox v-for="entry in smartUpdateEntries" :key="entry.value" :model-value="pending.includes(entry.value)" :label="entry.title" hide-details density="compact" class="pref-dialog-check" @update:model-value="checked => { pending = toggleSet(pending, entry.value, Boolean(checked)) }" />
          </v-card-text>
          <v-card-actions><v-btn variant="text" @click="dialog = null">Cancel</v-btn><v-spacer /><v-btn variant="text" color="primary" @click="commitMulti('smartUpdate')">OK</v-btn></v-card-actions>
        </template>

        <template v-else-if="dialog === 'duplicate'">
          <v-card-title class="pref-dialog-title">Mark duplicate read chapter as read</v-card-title>
          <v-card-text class="pref-dialog-text">
            <v-checkbox v-for="entry in duplicateEntries" :key="entry.value" :model-value="pending.includes(entry.value)" :label="entry.title" hide-details density="compact" class="pref-dialog-check" @update:model-value="checked => { pending = toggleSet(pending, entry.value, Boolean(checked)) }" />
          </v-card-text>
          <v-card-actions><v-btn variant="text" @click="dialog = null">Cancel</v-btn><v-spacer /><v-btn variant="text" color="primary" @click="commitMulti('duplicate')">OK</v-btn></v-card-actions>
        </template>

        <!-- Tri-state categories dialog. -->
        <template v-else-if="dialog === 'categories'">
          <v-card-title class="pref-dialog-title">Categories</v-card-title>
          <v-card-text class="pref-dialog-text">
            <p class="pref-dialog-message">Entries in excluded categories will not be updated even if they are also in included categories.</p>
            <div v-for="c in categories" :key="c.id" class="pref-dialog-row pref-dialog-row-tri" role="checkbox" :aria-checked="(triState[String(c.id)] ?? 'none') === 'include'" tabindex="0" @click="cycleTriState(String(c.id))" @keydown.enter="cycleTriState(String(c.id))">
              <v-icon
                class="pref-tri-icon"
                :icon="(triState[String(c.id)] ?? 'none') === 'include' ? 'check_box' : (triState[String(c.id)] ?? 'none') === 'exclude' ? 'disabled_by_default' : 'check_box_outline_blank'"
                :class="{ 'pref-tri-icon-on': (triState[String(c.id)] ?? 'none') !== 'none' }"
              />
              <span class="pref-dialog-label">{{ c.name }}</span>
            </div>
          </v-card-text>
          <v-card-actions><v-btn variant="text" @click="dialog = null">Cancel</v-btn><v-spacer /><v-btn variant="text" color="primary" @click="saveTriState">OK</v-btn></v-card-actions>
        </template>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
/* Metrics taken from Mihon's preference widgets:
   PreferenceGroupHeader.kt  - bodyMedium (14sp/20sp), secondary color, 14dp top / 8dp bottom padding.
   BasePreferenceWidget.kt   - PrefsHorizontalPadding 16dp, PrefsVerticalPadding 16dp, TitleFontSize 16sp.
   TextPreferenceWidget.kt   - subtitle bodySmall (12sp/16sp) with SECONDARY_ALPHA 0.78.
   PreferenceScreen.kt       - 12dp spacer between groups, LocalPreferenceMinHeight 56dp. */
.pref-screen { padding-bottom: 24px; }
.pref-group-header {
  padding: 14px 16px 8px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  color: rgb(var(--v-theme-secondary));
}
/* PreferenceScreen.kt: a 12dp spacer separates the groups (not after the last one). */
.pref-group-gap { height: 12px; }
.pref-item {
  display: flex;
  align-items: center;
  min-height: 56px;
  padding: 16px;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface));
}
.pref-item:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 6%, transparent); }
.pref-item:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }
.pref-text { flex: 1 1 auto; min-width: 0; }
.pref-title { font-size: 16px; line-height: 24px; }
.pref-subtitle {
  margin-top: 2px;
  font-size: 12px;
  line-height: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: .78;
}
.pref-subtitle-multiline { white-space: pre-line; }
.pref-switch { pointer-events: none; }
.pref-note { margin: 16px; font-size: 12px; line-height: 18px; color: rgb(var(--v-theme-on-surface-variant)); }
.pref-note-error { color: rgb(var(--v-theme-error)); }
.pref-dialog { overflow: hidden; }
.pref-dialog-title { font-size: 22px; line-height: 28px; }
.pref-dialog-text { max-height: 320px; overflow-y: auto; padding: 8px 0; }
.pref-dialog-message { margin: 0 24px 8px; font-size: 14px; line-height: 20px; color: rgb(var(--v-theme-on-surface-variant)); }
.pref-dialog-row {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 0 16px 0 16px;
  border-radius: 4px;
  cursor: pointer;
}
.pref-dialog-row:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.pref-dialog-label { margin-left: 24px; font-size: 16px; line-height: 24px; }
.pref-dialog-check { padding: 0 24px; min-height: 48px; }
.pref-dialog-check :deep(.v-label) { font-size: 16px; line-height: 24px; }
.pref-radio-icon { color: rgb(var(--v-theme-on-surface-variant)); }
.pref-radio-icon-on { color: rgb(var(--v-theme-primary)); }
.pref-tri-icon { margin-right: 20px; color: rgb(var(--v-theme-on-surface)); }
.pref-tri-icon-on { color: rgb(var(--v-theme-primary)); }
</style>
