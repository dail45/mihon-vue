<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { usePreferencesStore } from '../stores/preferences'
import { useChapterSettings } from '../stores/chapterSettings'
import { useSuwayomiStore } from '../stores/suwayomi'
import { chapterSortOptions, type ChapterSettings } from '../utils/chapters'
import {
  availableScanlators as availableScanlatorsOf,
  loadExcludedScanlators,
  saveExcludedScanlators,
} from '../utils/scanlatorFilter'
import { nextTriState, type TriState } from '../utils/library'
import AdaptiveSettingsSheet from './AdaptiveSettingsSheet.vue'
import ScanlatorFilterDialog from './ScanlatorFilterDialog.vue'

/**
 * ChapterSettingsDialog.kt (mihon/app/src/main/java/eu/kanade/presentation/manga/ChapterSettingsDialog.kt)
 *
 * Reference structure, kept 1:1:
 *  - `TabbedDialog` (mihon/.../components/TabbedDialog.kt): a `PrimaryTabRow` (Filter / Sort /
 *    Display) inside a `Row` with a `MoreVert` `IconButton` that opens a `DropdownMenu` holding
 *    "Set as default" and "Reset"; below it a `HorizontalPager` whose page content is a
 *    vertically scrollable `Column` padded with `TabbedDialogPaddings.Vertical` (8dp).
 *  - FilterPage: `TriStateItem` Downloaded / Unread / Bookmarked, then `ScanlatorFilterItem`.
 *    `TriStateItem` (presentation-core/.../components/SettingsItems.kt) cycles
 *    DISABLED -> ENABLED_IS -> ENABLED_NOT -> DISABLED and draws
 *    CheckBoxOutlineBlank (onSurfaceVariant) / RoundedFilled.CheckBox (primary) /
 *    RoundedFilled.DisabledByDefault (primary). While the global "downloaded only" base
 *    preference is on, the Downloaded row gets no click handler, so it renders with
 *    `DISABLED_ALPHA` (0.38) and an onSurfaceVariant icon.
 *  - ScanlatorFilterItem: `Row` with `MaterialSymbols.Rounded.Group` (24dp) tinted with
 *    `colorScheme.active` (amber #ffc107 in light, #ffeb3b in dark) while the filter is active,
 *    `bodyMedium` label, 24dp horizontal and 12dp vertical padding, 24dp gap. It opens the
 *    separate `ScanlatorFilterDialog`.
 *  - SortPage: four `SortItem`s (By source / By chapter number / By upload date / Alphabetically);
 *    the arrow is drawn only on the selected mode (24dp slot, primary tint).
 *  - DisplayPage: two `RadioItem`s (Source title / Chapter number).
 *  - `SetAsDefaultDialog`: an MD3 AlertDialog titled "Chapter settings" (headlineSmall) with the
 *    confirmation text, the optional "Also apply to all entries in my library" `LabeledCheckbox`
 *    and the Cancel / OK text buttons. The confirmation shows the
 *    `chapter_settings_updated` snackbar.
 *
 * Web differences: chapter settings live in browser storage, so the "set as default" confirmation
 * applies the defaults to the library entries that are known to this client instead of writing
 * to the Android SQLite database. The excluded scanlator set is kept in browser storage as well,
 * because the Suwayomi REST API has no chapter-flag endpoints.
 */
const props = defineProps<{ mangaId: number; apiUrl: string }>()
const opened = defineModel<boolean>({ required: true })
const tab = ref('filter')
const theme = useTheme()
const prefs = usePreferencesStore()
const store = useChapterSettings()
const server = useSuwayomiStore()
const settings = computed(() => store.forManga(props.apiUrl, props.mangaId))

const confirmDefault = ref(false)
const applyLibrary = ref(false)
const savingDefault = ref(false)
const defaultError = ref('')
const snackbar = ref(false)
let snackbarTimer: ReturnType<typeof setTimeout> | undefined

// ColorScheme.active (Color.kt): Color(255, 235, 59) in dark, Color(255, 193, 7) in light
const activeColor = computed(() => (theme.current.value.dark ? '#ffeb3b' : '#ffc107'))

// Reset SetAsDefaultDialog state when reopened
watch(confirmDefault, open => {
  if (open) {
    applyLibrary.value = false
    defaultError.value = ''
  }
})

// Touch navigation between tabs (HorizontalPager parity)
const touchStartX = ref<number | null>(null)
const touchStartY = ref<number | null>(null)

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 1) {
    touchStartX.value = e.touches[0]!.clientX
    touchStartY.value = e.touches[0]!.clientY
  }
}

function onTouchEnd(e: TouchEvent) {
  if (touchStartX.value === null || touchStartY.value === null) return
  const dx = e.changedTouches[0]!.clientX - touchStartX.value
  const dy = e.changedTouches[0]!.clientY - touchStartY.value
  touchStartX.value = null
  touchStartY.value = null

  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    const tabs = ['filter', 'sort', 'display']
    const currentIndex = tabs.indexOf(tab.value)
    if (dx < 0 && currentIndex < tabs.length - 1) {
      tab.value = tabs[currentIndex + 1]!
    } else if (dx > 0 && currentIndex > 0) {
      tab.value = tabs[currentIndex - 1]!
    }
  }
}

// --- Filter page -----------------------------------------------------------------------------
type FilterKey = 'downloaded' | 'unread' | 'bookmarked'
const filterRows = computed(() => [
  { key: 'downloaded' as FilterKey, label: 'Downloaded', state: settings.value.downloaded, locked: prefs.downloadedOnly },
  { key: 'unread' as FilterKey, label: 'Unread', state: settings.value.unread, locked: false },
  { key: 'bookmarked' as FilterKey, label: 'Bookmarked', state: settings.value.bookmarked, locked: false },
])
// TriStateItem cycles DISABLED -> ENABLED_IS -> ENABLED_NOT -> DISABLED.
function advanceFilter(key: FilterKey) {
  settings.value[key] = nextTriState(settings.value[key])
}
// TriStateItem.kt: DISABLED -> CheckBoxOutlineBlank, ENABLED_IS -> RoundedFilled.CheckBox,
// ENABLED_NOT -> RoundedFilled.DisabledByDefault.
function filterIcon(state: TriState) {
  if (state === 'include') return 'check_box'
  if (state === 'exclude') return 'disabled_by_default'
  return 'check_box_outline_blank'
}
function filterIconFilled(state: TriState) { return state !== 'all' }
// TriStateItem.kt tint: the DISABLED state and a disabled row use onSurfaceVariant, a row
// without a click handler uses onSurface, every other row uses primary. The alpha of the
// disabled rows (DISABLED_ALPHA = 0.38) comes from the row opacity.
function filterIconColor(row: { state: TriState; locked: boolean }) {
  if (row.state === 'all') return 'on-surface-variant'
  if (row.locked) return 'on-surface'
  return 'primary'
}
function filterChecked(state: TriState) { return state === 'include' ? 'true' : state === 'exclude' ? 'mixed' : 'false' }

// --- Scanlator filter -------------------------------------------------------------------------
const scanlatorOpen = ref(false)
const availableScanlators = computed(() => availableScanlatorsOf(server.chapters))
const excludedScanlatorList = ref<string[]>([])
// MangaViewModel.scanlatorFilterActive: the filter is active when at least one available scanlator is excluded.
const scanlatorActive = computed(() => availableScanlators.value.some(s => excludedScanlatorList.value.includes(s)))
watch(() => [props.apiUrl, props.mangaId], () => {
  excludedScanlatorList.value = loadExcludedScanlators(props.apiUrl, props.mangaId)
}, { immediate: true })
function openScanlatorDialog() { scanlatorOpen.value = true }
function confirmScanlators(excluded: string[]) {
  saveExcludedScanlators(props.apiUrl, props.mangaId, excluded)
  excludedScanlatorList.value = [...excluded]
  scanlatorOpen.value = false
}

// --- Sort / display ---------------------------------------------------------------------------
function chooseSort(mode: typeof chapterSortOptions[number]['value']) { store.choose(settings.value, mode) }

// --- Overflow actions -------------------------------------------------------------------------
function notify() {
  snackbar.value = false
  if (snackbarTimer) clearTimeout(snackbarTimer)
  snackbar.value = true
  snackbarTimer = setTimeout(() => { snackbar.value = false }, 4000)
}
function resetToDefault() { store.reset(props.apiUrl, props.mangaId) }
async function saveDefault() {
  if (savingDefault.value) return
  savingDefault.value = true
  defaultError.value = ''
  const selected: ChapterSettings = { ...settings.value }
  try {
    let ids: number[] = []
    if (applyLibrary.value) {
      const { createSuwayomiApi } = await import('../api/client')
      const client = createSuwayomiApi(props.apiUrl)
      const categories = await client.categories()
      const libraries = await Promise.all(categories.map(c => client.categoryManga(c.id)))
      ids = [...new Set(libraries.flat().map(m => m.id))]
    }
    store.setDefault(selected)
    for (const id of ids) Object.assign(store.forManga(props.apiUrl, id), selected)
    confirmDefault.value = false
    // MangaViewModel.setCurrentSettingsAsDefault shows MR.strings.chapter_settings_updated.
    notify()
  } catch {
    defaultError.value = 'Could not read the library. No defaults were applied; check the connection and try again.'
  } finally {
    savingDefault.value = false
  }
}
</script>

<template>
  <AdaptiveSettingsSheet
    v-model="opened"
    v-model:tab="tab"
    title="Chapter settings"
    :tabs="['Filter', 'Sort', 'Display']"
    flat-tabs
  >
    <template #overflow>
      <v-menu location="bottom end" class="chapter-overflow">
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            icon="more_vert"
            aria-label="More"
            variant="text"
            class="chapter-overflow__button"
          />
        </template>
        <v-list class="chapter-overflow__list" elevation="2">
          <v-list-item title="Set as default" @click="confirmDefault = true" />
          <v-list-item title="Reset" @click="resetToDefault" />
        </v-list>
      </v-menu>
    </template>

    <div
      class="chapter-settings-page-container"
      @touchstart="onTouchStart"
      @touchend="onTouchEnd"
    >
      <!-- FilterPage (ChapterSettingsDialog.kt:131-161) -->
      <div v-if="tab === 'filter'" class="chapter-filter-page">
        <button
          v-for="row in filterRows"
          :key="row.key"
          type="button"
          role="checkbox"
          class="settings-row chapter-tristate"
          :class="{ 'chapter-tristate--locked': row.locked }"
          :aria-checked="filterChecked(row.state)"
          :aria-label="row.label"
          :aria-disabled="row.locked ? 'true' : undefined"
          @click="row.locked ? undefined : advanceFilter(row.key)"
        >
          <span class="settings-icon-slot">
            <v-icon
              :icon="filterIcon(row.state)"
              :class="{ 'filled-symbol': filterIconFilled(row.state) }"
              :color="filterIconColor(row)"
              size="24"
            />
          </span>
          <span class="settings-row-label">{{ row.label }}</span>
        </button>
        <!-- ScanlatorFilterItem.kt: 12dp vertical padding, active amber/yellow "Group" icon while active. -->
        <button
          type="button"
          class="settings-row chapter-scanlator"
          :class="{ 'chapter-scanlator--active': scanlatorActive }"
          aria-label="Scanlator"
          @click="openScanlatorDialog"
        >
          <span class="settings-icon-slot">
            <v-icon
              icon="group"
              size="24"
              :style="{ color: scanlatorActive ? activeColor : undefined }"
            />
          </span>
          <span class="settings-row-label">Scanlator</span>
        </button>
      </div>

      <!-- SortPage (ChapterSettingsDialog.kt:192-210) -->
      <div v-else-if="tab === 'sort'" class="chapter-sort-page">
        <button
          v-for="option in chapterSortOptions"
          :key="option.value"
          type="button"
          class="settings-row chapter-sort"
          :aria-label="option.label"
          :aria-pressed="settings.sort === option.value"
          :aria-description="settings.sort === option.value ? (settings.descending ? 'Descending' : 'Ascending') : undefined"
          @click="chooseSort(option.value)"
        >
          <span class="settings-icon-slot">
            <v-icon
              v-if="settings.sort === option.value"
              :icon="settings.descending ? 'arrow_downward' : 'arrow_upward'"
              color="primary"
              size="24"
            />
          </span>
          <span class="settings-row-label">{{ option.label }}</span>
        </button>
      </div>

      <!-- DisplayPage (ChapterSettingsDialog.kt:212-227) -->
      <div v-else class="chapter-display-page">
        <button
          v-for="option in [{ value: 'title', label: 'Source title' }, { value: 'number', label: 'Chapter number' }] as const"
          :key="option.value"
          type="button"
          role="radio"
          class="settings-row chapter-radio-item"
          :aria-checked="settings.display === option.value"
          :aria-label="option.label"
          @click="settings.display = option.value"
        >
          <span class="settings-icon-slot">
            <span
              class="chapter-radio"
              :class="{ 'chapter-radio--selected': settings.display === option.value }"
              aria-hidden="true"
            >
              <span class="chapter-radio__dot" />
            </span>
          </span>
          <span class="settings-row-label">{{ option.label }}</span>
        </button>
      </div>
    </div>
  </AdaptiveSettingsSheet>

  <!-- SetAsDefaultDialog.kt: MD3 AlertDialog (ChapterSettingsDialog.kt:229-268) -->
  <v-dialog v-model="confirmDefault" content-class="chapter-alert-overlay" aria-label="Chapter settings">
    <div class="chapter-alert">
      <h2 class="chapter-alert__title">Chapter settings</h2>
      <div class="chapter-alert__text">
        <p class="chapter-alert__message">Are you sure you want to save these settings as default?</p>
        <button
          type="button"
          role="checkbox"
          class="chapter-labeled-checkbox"
          :aria-checked="applyLibrary"
          @click="applyLibrary = !applyLibrary"
        >
          <span class="chapter-checkbox" :class="{ 'chapter-checkbox--checked': applyLibrary }">
            <v-icon v-if="applyLibrary" icon="check" size="14" />
          </span>
          <span class="chapter-labeled-checkbox__label">Also apply to all entries in my library</span>
        </button>
        <p v-if="defaultError" role="alert" class="chapter-alert__error">{{ defaultError }}</p>
      </div>
      <div class="chapter-alert__actions">
        <button type="button" class="chapter-alert__button" @click="confirmDefault = false">Cancel</button>
        <button type="button" class="chapter-alert__button" :disabled="savingDefault" @click="saveDefault">OK</button>
      </div>
    </div>
  </v-dialog>

  <!-- ScanlatorFilterDialog.kt -->
  <ScanlatorFilterDialog
    v-model="scanlatorOpen"
    :available-scanlators="availableScanlators"
    :excluded-scanlators="excludedScanlatorList"
    @confirm="confirmScanlators"
  />

  <v-snackbar v-model="snackbar" :timeout="4000" color="inverse-surface" location="bottom">Updated default chapter settings</v-snackbar>
</template>

<style>
/* MD3 BasicAlertDialog: sizeIn(minWidth = 280dp, maxWidth = 560dp) around a content sized
   dialog; the Vuetify overlay content is stretched by default and has to be constrained. */
.v-dialog > .chapter-alert-overlay {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}
/* Compose draws the alert dialog surface with tonalElevation = 0.dp and without a shadow. */
.v-dialog > .chapter-alert-overlay > .chapter-alert { box-shadow: none; }
</style>

<style scoped>
@layer app-components {
.chapter-overflow__button {
  width: 48px;
  height: 48px;
  min-width: 48px;
  color: rgb(var(--v-theme-on-surface));
}

.chapter-settings-page-container {
  min-height: 196px;
  user-select: none;
}

.settings-icon-slot {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  display: grid;
  place-items: center;
}

.settings-row-label {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface));
}

/* TriStateItem -> BaseSettingsItem: padding(horizontal = 24.dp, vertical = 10.dp) with a
   24dp icon and a bodyMedium label (14/20), so the row is 44dp high. */
.chapter-tristate { gap: 24px; }
/* DISABLED_ALPHA = 0.38 (presentation-core/.../material/Constants.kt). */
.chapter-tristate--locked { opacity: .38; cursor: default; }
.chapter-tristate--locked:hover { background: transparent; }

/* ScanlatorFilterItem.kt: padding(horizontal = 24.dp, vertical = 12.dp), min-height 48dp. */
.chapter-scanlator {
  gap: 24px;
  padding-top: 12px;
  padding-bottom: 12px;
  min-height: 48px;
}
.chapter-scanlator .v-icon { color: rgb(var(--v-theme-on-surface)); }
/* colorScheme.active: Color(255, 193, 7) in light, Color(255, 235, 59) in dark. */
.chapter-scanlator--active .v-icon { color: #ffc107; }
:root[data-theme='dark'] .chapter-scanlator--active .v-icon,
.v-theme--mihonDark .chapter-scanlator--active .v-icon,
.v-theme--dark .chapter-scanlator--active .v-icon {
  color: #ffeb3b;
}

.chapter-sort { gap: 24px; }
.chapter-display-page { display: flex; flex-direction: column; }
.chapter-radio-item { gap: 24px; }

/* MD3 RadioButton: 20dp control, 2dp stroke, primary when selected, centered in 24dp slot. */
.chapter-radio {
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
  display: grid;
  place-items: center;
  box-sizing: border-box;
}
.chapter-radio--selected { border-color: rgb(var(--v-theme-primary)); }
.chapter-radio__dot { width: 10px; height: 10px; border-radius: 50%; background: transparent; }
.chapter-radio--selected .chapter-radio__dot { background: rgb(var(--v-theme-primary)); }

/* MD3 AlertDialog container: shape = CornerExtraLarge (28dp), container color =
   surface-container-high, container padding = 24dp. */
.chapter-alert {
  box-sizing: border-box;
  padding: 24px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
}
/* Title: headlineSmall (24sp / 32sp, weight 400) in on-surface, 16dp bottom padding. */
.chapter-alert__title {
  margin: 0 0 16px;
  font-family: var(--v-font-heading, var(--v-font-body, Roboto, sans-serif));
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface));
}
/* Supporting text block: bodyMedium (14/20) in on-surface-variant, 24dp bottom padding. */
.chapter-alert__text {
  padding-bottom: 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface-variant));
}
.chapter-alert__message { margin: 0 0 12px; }
/* LabeledCheckbox.kt: min height 48dp, shapes.small (8dp) clip, padding.small (8dp) gap. */
.chapter-labeled-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 48px;
  padding: 0 4px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font-family: inherit;
  text-align: start;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.chapter-labeled-checkbox:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.chapter-labeled-checkbox:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }
/* MD3 Checkbox: 18dp box, 2dp stroke, primary fill when checked. */
.chapter-checkbox {
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  border-radius: 2px;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
  display: grid;
  place-items: center;
  color: rgb(var(--v-theme-on-primary));
  box-sizing: border-box;
  transition: background-color 150ms ease, border-color 150ms ease;
}
.chapter-checkbox--checked { background: rgb(var(--v-theme-primary)); border-color: rgb(var(--v-theme-primary)); }
.chapter-labeled-checkbox__label {
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface));
}
.chapter-alert__error { margin: 12px 0 0; color: rgb(var(--v-theme-error)); }
/* MD3 TextButton: height 40dp, min width 58dp, content padding 12dp, shape = CornerFull (20dp),
   label = labelLarge (14/20, weight 500) in primary. */
.chapter-alert__actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.chapter-alert__button {
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
.chapter-alert__button::after {
  content: '';
  position: absolute;
  inset: 0;
  background-color: currentColor;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none;
}
.chapter-alert__button:hover::after { opacity: 0.08; }
.chapter-alert__button:active::after { opacity: 0.12; }
.chapter-alert__button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.chapter-alert__button:disabled { opacity: .38; cursor: default; }
}
</style>
