<script setup lang="ts">
/**
 * Settings — Downloads.
 *
 * Reference: mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsDownloadScreen.kt
 * (Mihon 446f6df) plus the widgets it renders:
 *   widget/BasePreferenceWidget.kt      — Row(minHeight 56dp), title titleLarge @16sp (max 2 lines),
 *                                          subtitle bodySmall @ .78 alpha, 16dp paddings.
 *   widget/SwitchPreferenceWidget.kt   — text row + trailing Switch (whole row toggles).
 *   widget/PreferenceGroupHeader.kt     — bodyMedium, colorScheme.secondary, padding(14dp, 8dp, 16dp).
 *   widget/InfoWidget.kt                — Column(padding 16dp) { Icon(Info 24dp), Text(bodySmall) }, alpha .78.
 *   widget/ListPreferenceWidget.kt      — row with the current entry as subtitle + AlertDialog with radio rows.
 *   widget/MultiSelectListPreferenceWidget.kt — AlertDialog with LabeledCheckbox rows, OK / Cancel.
 *   widget/TriStateListDialog.kt        — tri-state category picker (ported as TriStateListDialog.vue).
 *   PreferenceItem.kt (SliderPreference) + presentation-core SettingsItems.kt BaseSliderItem
 *                                        — title / optional subtitle / Pill(value) above a Slider.
 *   PreferenceScreen.kt                 — 12dp spacer after every group except the last one.
 *
 * Mihon keeps every one of these preferences on the device (DownloadPreferences). Suwayomi-Server
 * exposes only a part of them (downloadAsCbz, maxSourcesInParallel, autoDownloadNewChapters and the
 * per category includeInDownload flag). This client therefore stores the values in this browser and
 * states plainly which behaviour the server cannot provide; the server-side equivalents stay in the
 * "Connection" settings section and are never modified from this screen.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import Md3Slider from '@/core/components/Md3Slider.vue'
import Md3Switch from '@/core/components/Md3Switch.vue'
import TriStateListDialog from '@/features/settings/components/TriStateListDialog.vue'
import { readPreference, writePreference } from '@/features/settings/stores/preferences'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import type { Category } from '@/core/api/types'

const server = useSuwayomiStore()

/* --- local preferences (browser only) --------------------------------------------------- */

function persistedBool(key: string, fallback: boolean) {
  const stored = readPreference(key)
  const value = ref(stored === null ? fallback : stored === 'true')
  watch(value, v => writePreference(key, String(v)))
  return value
}
function persistedInt(key: string, fallback: number) {
  const stored = readPreference(key)
  const parsed = stored === null ? Number.NaN : Number(stored)
  const value = ref(Number.isFinite(parsed) ? parsed : fallback)
  watch(value, v => writePreference(key, String(v)))
  return value
}
function persistedSet(key: string) {
  const stored = readPreference(key)
  let initial: string[] = []
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) initial = parsed.map(String)
    } catch { /* corrupted value */ }
  }
  const value = ref<string[]>(initial)
  watch(value, v => writePreference(key, JSON.stringify(v)))
  return value
}

// DownloadPreferences.downloadOnlyOverWifi (default true).
const onlyOverWifi = persistedBool('mihon.download.onlyOverWifi', true)
// DownloadPreferences.saveChaptersAsCBZ (default true).
const saveAsCbz = persistedBool('mihon.download.saveAsCbz', true)
// DownloadPreferences.parallelSourceLimit (default 5, range 1..10).
const parallelSourceLimit = persistedInt('mihon.download.parallelSourceLimit', 5)
// DownloadPreferences.parallelPageLimit (default 5, range 1..15).
const parallelPageLimit = persistedInt('mihon.download.parallelPageLimit', 5)
// DownloadPreferences.removeAfterMarkedAsRead (default false).
const removeAfterMarkedAsRead = persistedBool('mihon.download.removeAfterMarkedAsRead', false)
// DownloadPreferences.removeAfterReadSlots (default -1 = Disabled).
const removeAfterReadSlots = persistedInt('mihon.download.removeAfterReadSlots', -1)
// DownloadPreferences.removeBookmarkedChapters (default false).
const removeBookmarkedChapters = persistedBool('mihon.download.removeBookmarkedChapters', false)
// DownloadPreferences.removeExcludeCategories.
const removeExcludeCategories = persistedSet('mihon.download.removeExcludeCategories')
// DownloadPreferences.downloadNewChapters (default false).
const downloadNewChapters = persistedBool('mihon.download.downloadNewChapters', false)
// DownloadPreferences.downloadNewUnreadChaptersOnly (default false).
const downloadNewUnreadChaptersOnly = persistedBool('mihon.download.downloadNewUnreadChaptersOnly', false)
// DownloadPreferences.downloadNewChapterCategories / downloadNewChapterCategoriesExclude.
const downloadNewCategories = persistedSet('mihon.download.downloadNewCategories')
const downloadNewCategoriesExclude = persistedSet('mihon.download.downloadNewCategoriesExclude')
// DownloadPreferences.autoDownloadWhileReading (default 0 = Disabled).
const autoDownloadWhileReading = persistedInt('mihon.download.autoDownloadWhileReading', 0)

/* --- categories (read only, Suwayomi GET /category) --------------------------------------- */

/** CategoryExtensions.kt visualName: the system category is shown as "Default". */
function visualName(category: Category): string {
  return category.id === 0 || category.default ? 'Default' : category.name
}

const categories = computed<Category[]>(() => [...server.categories].sort((a, b) => a.order - b.order))

/* --- Commons.kt getCategoriesLabel ------------------------------------------------------- */

const categoriesLabel = computed(() => {
  const all = categories.value
  const included = downloadNewCategories.value
    .map(id => all.find(c => c.id.toString() === id))
    .filter((c): c is Category => !!c)
    .sort((a, b) => a.order - b.order)
  const excluded = downloadNewCategoriesExclude.value
    .map(id => all.find(c => c.id.toString() === id))
    .filter((c): c is Category => !!c)
    .sort((a, b) => a.order - b.order)
  const allExcluded = excluded.length === all.length
  const includedText = included.length && included.length !== all.length
    ? included.map(visualName).join(', ')
    : included.length === all.length ? 'All' : allExcluded ? 'None' : 'All'
  const excludedText = !excluded.length ? 'None' : allExcluded ? 'All' : excluded.map(visualName).join(', ')
  return `Include: ${includedText}\nExclude: ${excludedText}`
})

/* --- list preferences ------------------------------------------------------------------- */

// SettingsDownloadScreen.getDeleteChaptersGroup(): removeAfterReadSlots entries.
const REMOVE_AFTER_READ_ENTRIES = [
  { value: -1, title: 'Disabled' },
  { value: 0, title: 'Last read chapter' },
  { value: 1, title: 'Second to last read chapter' },
  { value: 2, title: 'Third to last read chapter' },
  { value: 3, title: 'Fourth to last read chapter' },
  { value: 4, title: 'Fifth to last read chapter' },
]

// SettingsDownloadScreen.getDownloadAheadGroup(): autoDownloadWhileReading entries.
const DOWNLOAD_AHEAD_ENTRIES = [
  { value: 0, title: 'Disabled' },
  { value: 2, title: 'Next 2 unread chapters' },
  { value: 3, title: 'Next 3 unread chapters' },
  { value: 5, title: 'Next 5 unread chapters' },
  { value: 10, title: 'Next 10 unread chapters' },
]

const removeAfterReadTitle = computed(
  () => REMOVE_AFTER_READ_ENTRIES.find(e => e.value === removeAfterReadSlots.value)?.title ?? 'Disabled',
)
const downloadAheadTitle = computed(
  () => DOWNLOAD_AHEAD_ENTRIES.find(e => e.value === autoDownloadWhileReading.value)?.title ?? 'Disabled',
)

/** Generic radio list dialog (ListPreferenceWidget). */
const listOpen = ref(false)
const listTitle = ref('')
const listEntries = ref<{ value: number; title: string }[]>([])
const listValue = ref<number | null>(null)
const listApply = ref<(value: number) => void>(() => {})

const listBodyEl = ref<HTMLElement | null>(null)
const listCanScrollBackward = ref(false)
const listCanScrollForward = ref(false)

function updateListScroll() {
  const el = listBodyEl.value
  if (!el) {
    listCanScrollBackward.value = false
    listCanScrollForward.value = false
    return
  }
  listCanScrollBackward.value = el.scrollTop > 0
  listCanScrollForward.value = el.scrollHeight - el.scrollTop - el.clientHeight > 0
}

watch(listOpen, async value => {
  if (!value) return
  listCanScrollBackward.value = false
  listCanScrollForward.value = false
  await nextTick()
  updateListScroll()
})

function openList(title: string, entries: { value: number; title: string }[], value: number, apply: (value: number) => void) {
  listTitle.value = title
  listEntries.value = entries
  listValue.value = value
  listApply.value = apply
  listOpen.value = true
}
function pickList(value: number) {
  listApply.value(value)
  listOpen.value = false
}

/* --- multi select list preference (excluded categories) ----------------------------------- */

const excludedOpen = ref(false)
const excludedSelection = ref<string[]>([])

const excludedBodyEl = ref<HTMLElement | null>(null)
const excludedCanScrollBackward = ref(false)
const excludedCanScrollForward = ref(false)

function updateExcludedScroll() {
  const el = excludedBodyEl.value
  if (!el) {
    excludedCanScrollBackward.value = false
    excludedCanScrollForward.value = false
    return
  }
  excludedCanScrollBackward.value = el.scrollTop > 0
  excludedCanScrollForward.value = el.scrollHeight - el.scrollTop - el.clientHeight > 0
}

watch(excludedOpen, async value => {
  if (!value) return
  excludedCanScrollBackward.value = false
  excludedCanScrollForward.value = false
  await nextTick()
  updateExcludedScroll()
})

function openExcluded() {
  excludedSelection.value = [...removeExcludeCategories.value]
  excludedOpen.value = true
}
function toggleExcluded(id: string) {
  excludedSelection.value = excludedSelection.value.includes(id)
    ? excludedSelection.value.filter(entry => entry !== id)
    : [...excludedSelection.value, id]
}
function confirmExcluded() {
  removeExcludeCategories.value = [...excludedSelection.value]
  excludedOpen.value = false
}

const excludedSummary = computed(() => {
  const names = removeExcludeCategories.value
    .map(id => categories.value.find(c => c.id.toString() === id))
    .filter((c): c is Category => !!c)
    .sort((a, b) => a.order - b.order)
    .map(visualName)
  return names.length ? names.join(', ') : 'None'
})

/* --- tri state category dialog (auto download categories) --------------------------------- */

const triStateOpen = ref(false)
function openTriState() {
  triStateOpen.value = true
}
function onTriStateChanged(included: unknown[], excluded: unknown[]) {
  downloadNewCategories.value = included.map(c => String((c as Category).id))
  downloadNewCategoriesExclude.value = excluded.map(c => String((c as Category).id))
}

onMounted(async () => {
  if (!server.categories.length && !server.loadingLibrary) await server.loadLibrary()
})
</script>

<template>
  <div class="download-settings" role="group" aria-label="Downloads">
    <!-- SwitchPreference(downloadPreferences.downloadOnlyOverWifi). The reference row is
         clickable (Modifier.clickable) and the trailing Switch has onCheckedChange = null. -->
    <div
      class="pref-row pref-row--button"
      role="button"
      tabindex="0"
      @click="onlyOverWifi = !onlyOverWifi"
      @keydown.space.prevent="onlyOverWifi = !onlyOverWifi"
      @keydown.enter.prevent="onlyOverWifi = !onlyOverWifi"
    >
      <span class="pref-text">
        <span class="pref-title">Only on Wi-Fi</span>
      </span>
      <div class="pref-trailing">
        <Md3Switch
          :model-value="onlyOverWifi"
          label="Only on Wi-Fi"
          @update:model-value="(value: boolean) => { onlyOverWifi = value }"
        />
      </div>
    </div>

    <!-- SwitchPreference(downloadPreferences.saveChaptersAsCBZ). -->
    <div
      class="pref-row pref-row--button"
      role="button"
      tabindex="0"
      @click="saveAsCbz = !saveAsCbz"
      @keydown.space.prevent="saveAsCbz = !saveAsCbz"
      @keydown.enter.prevent="saveAsCbz = !saveAsCbz"
    >
      <span class="pref-text">
        <span class="pref-title">Save as CBZ archive</span>
      </span>
      <div class="pref-trailing">
        <Md3Switch
          :model-value="saveAsCbz"
          label="Save as CBZ archive"
          @update:model-value="(value: boolean) => { saveAsCbz = value }"
        />
      </div>
    </div>

    <!-- SliderPreference(parallelSourceLimit, 1..10). -->
    <div class="pref-slider">
      <div class="pref-slider-head">
        <span class="pref-slider-text">
          <span class="pref-title pref-slider-title">Concurrent source downloads</span>
        </span>
        <span class="pref-pill">{{ parallelSourceLimit }}</span>
      </div>
      <Md3Slider
        v-model="parallelSourceLimit"
        :min="1"
        :max="10"
        :step="1"
        label="Concurrent source downloads"
        :value-text="String(parallelSourceLimit)"
      />
    </div>

    <!-- SliderPreference(parallelPageLimit, 1..15) with a subtitle. -->
    <div class="pref-slider">
      <div class="pref-slider-head">
        <span class="pref-slider-text">
          <span class="pref-title pref-slider-title">Concurrent page downloads</span>
          <span class="pref-subtitle">Pages downloaded simultaneously per source</span>
        </span>
        <span class="pref-pill">{{ parallelPageLimit }}</span>
      </div>
      <Md3Slider
        v-model="parallelPageLimit"
        :min="1"
        :max="15"
        :step="1"
        label="Concurrent page downloads"
        :value-text="String(parallelPageLimit)"
      />
    </div>

    <!-- getDeleteChaptersGroup(). -->
    <h2 class="pref-group-header">Delete chapters</h2>
    <!-- SwitchPreference(removeAfterMarkedAsRead). -->
    <div
      class="pref-row pref-row--button"
      role="button"
      tabindex="0"
      @click="removeAfterMarkedAsRead = !removeAfterMarkedAsRead"
      @keydown.space.prevent="removeAfterMarkedAsRead = !removeAfterMarkedAsRead"
      @keydown.enter.prevent="removeAfterMarkedAsRead = !removeAfterMarkedAsRead"
    >
      <span class="pref-text">
        <span class="pref-title">After manually marked as read</span>
      </span>
      <div class="pref-trailing">
        <Md3Switch
          :model-value="removeAfterMarkedAsRead"
          label="After manually marked as read"
          @update:model-value="(value: boolean) => { removeAfterMarkedAsRead = value }"
        />
      </div>
    </div>
    <!-- ListPreference(removeAfterReadSlots). -->
    <button
      type="button"
      class="pref-row pref-row--button"
      @click="openList('After reading automatically delete', REMOVE_AFTER_READ_ENTRIES, removeAfterReadSlots, value => { removeAfterReadSlots = value })"
    >
      <span class="pref-text">
        <span class="pref-title">After reading automatically delete</span>
        <span class="pref-subtitle">{{ removeAfterReadTitle }}</span>
      </span>
    </button>
    <!-- SwitchPreference(removeBookmarkedChapters). -->
    <div
      class="pref-row pref-row--button"
      role="button"
      tabindex="0"
      @click="removeBookmarkedChapters = !removeBookmarkedChapters"
      @keydown.space.prevent="removeBookmarkedChapters = !removeBookmarkedChapters"
      @keydown.enter.prevent="removeBookmarkedChapters = !removeBookmarkedChapters"
    >
      <span class="pref-text">
        <span class="pref-title">Allow deleting bookmarked chapters</span>
      </span>
      <div class="pref-trailing">
        <Md3Switch
          :model-value="removeBookmarkedChapters"
          label="Allow deleting bookmarked chapters"
          @update:model-value="(value: boolean) => { removeBookmarkedChapters = value }"
        />
      </div>
    </div>
    <!-- MultiSelectListPreference(removeExcludeCategories). -->
    <button type="button" class="pref-row pref-row--button" @click="openExcluded">
      <span class="pref-text">
        <span class="pref-title">Excluded categories</span>
        <span class="pref-subtitle">{{ excludedSummary }}</span>
      </span>
    </button>
    <!-- PreferenceScreen.kt: Spacer(12.dp) after every group except the last one. -->
    <div class="pref-group-spacer" />

    <!-- getAutoDownloadGroup(). -->
    <h2 class="pref-group-header">Auto-download</h2>
    <!-- SwitchPreference(downloadNewChapters). -->
    <div
      class="pref-row pref-row--button"
      role="button"
      tabindex="0"
      @click="downloadNewChapters = !downloadNewChapters"
      @keydown.space.prevent="downloadNewChapters = !downloadNewChapters"
      @keydown.enter.prevent="downloadNewChapters = !downloadNewChapters"
    >
      <span class="pref-text">
        <span class="pref-title">Download new chapters</span>
      </span>
      <div class="pref-trailing">
        <Md3Switch
          :model-value="downloadNewChapters"
          label="Download new chapters"
          @update:model-value="(value: boolean) => { downloadNewChapters = value }"
        />
      </div>
    </div>
    <!-- SwitchPreference(downloadNewUnreadChaptersOnly), visible only with downloadNewChapters. -->
    <div
      v-if="downloadNewChapters"
      class="pref-row pref-row--button"
      role="button"
      tabindex="0"
      @click="downloadNewUnreadChaptersOnly = !downloadNewUnreadChaptersOnly"
      @keydown.space.prevent="downloadNewUnreadChaptersOnly = !downloadNewUnreadChaptersOnly"
      @keydown.enter.prevent="downloadNewUnreadChaptersOnly = !downloadNewUnreadChaptersOnly"
    >
      <span class="pref-text">
        <span class="pref-title">Skip downloading duplicate read chapters</span>
      </span>
      <div class="pref-trailing">
        <Md3Switch
          :model-value="downloadNewUnreadChaptersOnly"
          label="Skip downloading duplicate read chapters"
          @update:model-value="(value: boolean) => { downloadNewUnreadChaptersOnly = value }"
        />
      </div>
    </div>
    <!-- TextPreference(categories) with the getCategoriesLabel() subtitle. -->
    <button v-if="downloadNewChapters" type="button" class="pref-row pref-row--button" @click="openTriState">
      <span class="pref-text">
        <span class="pref-title">Categories</span>
        <span class="pref-subtitle pref-subtitle--multiline">{{ categoriesLabel }}</span>
      </span>
    </button>
    <div class="pref-group-spacer" />

    <!-- getDownloadAheadGroup(). -->
    <h2 class="pref-group-header">Download ahead</h2>
    <!-- ListPreference(autoDownloadWhileReading). -->
    <button
      type="button"
      class="pref-row pref-row--button"
      @click="openList('Auto download while reading', DOWNLOAD_AHEAD_ENTRIES, autoDownloadWhileReading, value => { autoDownloadWhileReading = value })"
    >
      <span class="pref-text">
        <span class="pref-title">Auto download while reading</span>
        <span class="pref-subtitle">{{ downloadAheadTitle }}</span>
      </span>
    </button>
    <!-- InfoPreference(download_ahead_info). -->
    <div class="pref-info">
      <v-icon icon="info" size="24" class="pref-info-icon" />
      <p class="pref-info-text">Only works if the current chapter + the next one are already downloaded.</p>
    </div>

    <!-- Web-only notice: the download pipeline itself lives on the Suwayomi server. -->
    <p class="pref-notice">
      These preferences are stored in this browser only. Downloading on Wi-Fi, the CBZ archive format, the
      concurrency limits, deleting read chapters and downloading ahead are executed by Suwayomi, which
      offers no matching API for them; the server-side download options stay in the
      "Connection" settings section.
    </p>

    <!-- ListPreferenceWidget(): AlertDialog with radio rows and a "Cancel" confirm button. -->
    <v-dialog
      :model-value="listOpen"
      content-class="pref-dialog-overlay"
      max-width="560"
      @update:model-value="value => { if (!value) listOpen = false }"
    >
      <v-card v-if="listOpen" class="pref-dialog" rounded="28px" color="surface-container-high">
        <h3 class="pref-dialog-title">{{ listTitle }}</h3>
        <div class="pref-dialog-wrap">
          <div ref="listBodyEl" class="pref-dialog-body" role="radiogroup" :aria-label="listTitle" @scroll.passive="updateListScroll">
            <button
              v-for="entry in listEntries"
              :key="entry.value"
              type="button"
              class="pref-dialog-row"
              role="radio"
              :aria-checked="listValue === entry.value"
              @click="pickList(entry.value)"
            >
              <span class="pref-radio" :class="{ 'pref-radio--on': listValue === entry.value }" aria-hidden="true"><i /></span>
              <span class="pref-dialog-label">{{ entry.title }}</span>
            </button>
          </div>
          <div v-if="listCanScrollBackward" class="pref-dialog-divider is-top" aria-hidden="true" />
          <div v-if="listCanScrollForward" class="pref-dialog-divider is-bottom" aria-hidden="true" />
        </div>
        <div class="pref-dialog-actions">
          <button type="button" class="pref-dialog-button" @click="listOpen = false">Cancel</button>
        </div>
      </v-card>
    </v-dialog>

    <!-- MultiSelectListPreferenceWidget(): AlertDialog with LabeledCheckbox rows, OK / Cancel. -->
    <v-dialog
      :model-value="excludedOpen"
      content-class="pref-dialog-overlay"
      max-width="560"
      @update:model-value="value => { if (!value) excludedOpen = false }"
    >
      <v-card v-if="excludedOpen" class="pref-dialog" rounded="28px" color="surface-container-high">
        <h3 class="pref-dialog-title">Excluded categories</h3>
        <div class="pref-dialog-wrap">
          <div ref="excludedBodyEl" class="pref-dialog-body" role="group" aria-label="Excluded categories" @scroll.passive="updateExcludedScroll">
            <button
              v-for="category in categories"
              :key="category.id"
              type="button"
              class="pref-dialog-row"
              role="checkbox"
              :aria-checked="excludedSelection.includes(String(category.id))"
              @click="toggleExcluded(String(category.id))"
            >
              <span class="pref-checkbox" :class="{ 'pref-checkbox--on': excludedSelection.includes(String(category.id)) }" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
              </span>
              <span class="pref-dialog-label pref-dialog-label--checkbox">{{ visualName(category) }}</span>
            </button>
            <p v-if="!categories.length" class="pref-dialog-empty">No categories were returned by the server.</p>
          </div>
          <div v-if="excludedCanScrollBackward" class="pref-dialog-divider is-top" aria-hidden="true" />
          <div v-if="excludedCanScrollForward" class="pref-dialog-divider is-bottom" aria-hidden="true" />
        </div>
        <div class="pref-dialog-actions">
          <button type="button" class="pref-dialog-button" @click="excludedOpen = false">Cancel</button>
          <button type="button" class="pref-dialog-button" @click="confirmExcluded">OK</button>
        </div>
      </v-card>
    </v-dialog>

    <!-- TriStateListDialog.kt: tri-state picker for the auto-download categories. -->
    <TriStateListDialog
      v-model="triStateOpen"
      title="Categories"
      message="Entries in excluded categories will not be downloaded even if they are also in included categories."
      :items="categories"
      :initial-checked="categories.filter(c => downloadNewCategories.includes(String(c.id)))"
      :initial-inversed="categories.filter(c => downloadNewCategoriesExclude.includes(String(c.id)))"
      :item-label="(item: unknown) => visualName(item as Category)"
      :item-key="(item: unknown) => (item as Category).id"
      @value-changed="onTriStateChanged"
    />
  </div>
</template>

<style>
/* Material3 BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp) around a content sized dialog. */
.v-dialog > .pref-dialog-overlay {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}
.v-dialog > .pref-dialog-overlay > .v-card {
  box-shadow: none !important;
}
</style>

<style scoped>
@layer app-components {
.download-settings { display: block; }

/* PreferenceGroupHeader.kt: bodyMedium (14/20), colorScheme.secondary, padding 14dp/8dp/16dp. */
.pref-group-header {
  margin: 0;
  padding: 14px 16px 8px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-secondary));
}

/* PreferenceScreen.kt: Spacer(12.dp) between groups. */
.pref-group-spacer { height: 12px; }

/* BasePreferenceWidget.kt: sizeIn(minHeight = 56dp), 16dp paddings. */
.pref-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 56px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
}
.pref-row--button { cursor: pointer; }
.pref-row--button:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.pref-row--button:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent); }
.pref-row--button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }

.pref-text {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  padding: 16px;
}
.pref-title {
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
/* TextPreferenceWidget.kt: subtitle bodySmall with secondaryItemAlpha (.78), max 10 lines. */
.pref-subtitle {
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 78%, transparent);
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 10;
}
/* getCategoriesLabel() joins the include and exclude lines with a line break. */
.pref-subtitle--multiline { white-space: pre-line; }
/* BasePreferenceWidget.kt: trailing widget Box padding(end = PrefsHorizontalPadding). */
.pref-trailing {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  padding-inline-end: 16px;
}

/* BaseSliderItem.kt: Column(spacedBy 2dp) with a Row(spacedBy 8dp) of title and Pill, then the Slider. */
.pref-slider {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 16px;
}
.pref-slider-head { display: flex; align-items: center; gap: 8px; }
.pref-slider-text { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
.pref-slider-title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}
/* Pill.kt: shape extraLarge (32dp), padding(start = 4dp), inner padding 6dp/1dp, onSurface text. */
.pref-pill {
  flex: 0 0 auto;
  margin-inline-start: 4px;
  padding: 1px 6px;
  border-radius: 32px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
}

/* InfoWidget.kt: Column(padding 16dp) { Icon(Info 24dp), Text(bodySmall) }, alpha .78, spacedBy 16dp. */
.pref-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  opacity: .78;
  color: rgb(var(--v-theme-on-surface-variant));
}
.pref-info-icon { font-size: 24px; width: 24px; height: 24px; }
.pref-info-text {
  margin: 0;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: pre-line;
}

/* Notice about the client-only nature of the preferences. */
.pref-notice {
  margin: 16px;
  font-size: 12px;
  line-height: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* MD3 AlertDialog: shape = CornerExtraLarge (28dp), padding = 24dp. */
.pref-dialog {
  border-radius: 28px !important;
  padding: 24px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
  box-shadow: none !important;
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 48px);
}
.pref-dialog-title {
  margin: 0 0 16px;
  font-family: var(--v-font-heading, var(--v-font-body, Roboto, sans-serif));
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}
.pref-dialog-wrap {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}
.pref-dialog-body {
  display: flex;
  flex-direction: column;
  max-height: 320px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.pref-dialog-divider {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: rgb(var(--v-theme-outline-variant));
  pointer-events: none;
}
.pref-dialog-divider.is-top { top: 0; }
.pref-dialog-divider.is-bottom { bottom: 0; }
.pref-dialog-empty { margin: 8px 0 0; font-size: 12px; line-height: 16px; color: rgb(var(--v-theme-on-surface-variant)); }

/* DialogRow.kt: clip(small) + selectable + minimumInteractiveComponentSize (48dp). */
.pref-dialog-row {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 0 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.pref-dialog-row:hover:not(:disabled) { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.pref-dialog-row:active:not(:disabled) { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent); }
.pref-dialog-row:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }
.pref-dialog-row:disabled { opacity: .38; cursor: default; }

/* MD3 RadioButton: 20dp outer circle, 10dp inner dot. */
.pref-radio {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
  transition: border-color 0.2s;
}
.pref-radio--on { border-color: rgb(var(--v-theme-primary)); }
.pref-radio i { width: 10px; height: 10px; border-radius: 50%; background: rgb(var(--v-theme-primary)); }
.pref-radio--on i { display: block; }
.pref-radio:not(.pref-radio--on) i { display: none; }

/* MD3 Checkbox (LabeledCheckbox): 18dp box, 2dp radius, 2dp outline. */
.pref-checkbox {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 2px;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
  transition: background-color 0.2s, border-color 0.2s;
}
.pref-checkbox--on { background: rgb(var(--v-theme-primary)); border-color: rgb(var(--v-theme-primary)); }
.pref-checkbox svg { width: 14px; height: 14px; fill: rgb(var(--v-theme-on-primary)); opacity: 0; transition: opacity 0.15s; }
.pref-checkbox--on svg { opacity: 1; }

/* Text(bodyLarge) with start padding 24dp for radio and 16dp for checkbox. */
.pref-dialog-label {
  margin-inline-start: 24px;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}
.pref-dialog-label--checkbox {
  margin-inline-start: 16px;
}
.pref-dialog-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

/* MD3 TextButton: height 40dp, min width 58dp, content padding 12dp horizontal, shape CornerFull 20dp. */
.pref-dialog-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  height: 40px;
  padding: 0 12px;
  border: none;
  border-radius: 20px;
  background: transparent;
  font-family: var(--v-font-body, Roboto, sans-serif);
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.0071428571em;
  text-transform: none;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  overflow: hidden;
}
.pref-dialog-button::after {
  content: '';
  position: absolute;
  inset: 0;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}
.pref-dialog-button:hover::after { opacity: 0.08; }
.pref-dialog-button:active::after { opacity: 0.12; }
.pref-dialog-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
}
</style>
