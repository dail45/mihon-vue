<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiErrorMessage } from '@/core/api/client'
import { fetchSource, fetchSourcePreferences, saveSourcePreference, type SourcePreference, type SourcePreferenceProps } from '@/core/api/sourcePreferences'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import Md3CircularProgress from '@/core/components/Md3CircularProgress.vue'
import Md3Switch from '@/core/components/Md3Switch.vue'
import MihonEmptyScreen from '@/core/components/MihonEmptyScreen.vue'
import type { Source } from '@/core/api/types'

/**
 * SourcePreferencesScreen — per-source settings screen.
 *
 * References:
 *  - Screen: `mihon/app/src/main/java/eu/kanade/tachiyomi/ui/browse/extension/details/SourcePreferencesScreen.kt`
 *  - Preference Widgets:
 *    * `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/BasePreferenceWidget.kt`
 *    * `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/SwitchPreferenceWidget.kt`
 *    * `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/TextPreferenceWidget.kt`
 *    * `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/ListPreferenceWidget.kt`
 *    * `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/MultiSelectListPreferenceWidget.kt`
 *    * `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/EditTextPreferenceWidget.kt`
 *    * `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/InfoWidget.kt`
 *    * `mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/PreferenceGroupHeader.kt`
 *  - Core components:
 *    * `tachiyomi/presentation/core/screens/LoadingScreen.kt`
 *    * `tachiyomi/presentation/core/screens/EmptyScreen.kt`
 *    * `tachiyomi/presentation/core/components/LabeledCheckbox.kt`
 *    * `eu/kanade/presentation/components/AppBar.kt`
 *
 * Screen architecture in Mihon:
 *   1. `produceState` loads `sourceManager.getOrStub(sourceId)`.
 *      While `source == null`, renders bare `LoadingScreen()` (centered CircularProgressIndicator)
 *      WITHOUT any app bar.
 *   2. `Scaffold` with `AppBar(title = source.toString(), navigateUp = navigator::pop, scrollBehavior = it)`.
 *      - TopAppBar: height 64dp, containerColor = surface (elevation 0dp).
 *      - Nav icon: `IconButton` with `MaterialSymbols.AutoMirroredRounded.ArrowBack` (24dp icon in 48dp target).
 *      - Title: `source.toString()` -> `"$name (${lang.uppercase()})"` (HttpSource:114 / StubSource:38),
 *        typography `titleLarge` (22sp/28sp w400, onSurface, maxLines 1, ellipsis).
 *   3. Body: AndroidX `SourcePreferencesFragment` embedding `ConfigurableSource` preferences.
 *      - PreferenceCategory: `PreferenceGroupHeader` (bodyMedium 14sp/20sp w500, secondary color, top 14dp, bottom 8dp).
 *      - SwitchPreference / SwitchPreferenceCompat: `SwitchPreferenceWidget` (minHeight 56dp, 16dp horizontal/vertical padding,
 *        titleLarge 16sp w400, bodySmall 12sp/16sp 0.78 alpha summary, M3 Switch 52x32dp track, 16/24dp thumb with checkmark).
 *      - CheckBoxPreference: BasePreferenceWidget with M3 Checkbox in trailing widget frame (20x20dp, 2dp radius, checked primary).
 *      - ListPreference: `ListPreferenceWidget` (title + summary, opens AlertDialog with `DialogRow` radio choices,
 *        clicking choice immediately selects and applies value, single "Cancel" TextButton).
 *      - MultiSelectListPreference: `MultiSelectListPreferenceWidget` (title + summary, opens AlertDialog with `LabeledCheckbox`
 *        rows, "Cancel" and "OK" TextButtons).
 *      - EditTextPreference: `EditTextPreferenceWidget` (opens AlertDialog with OutlinedTextField, error indicator when empty,
 *        clear button when non-empty, "Cancel" and "OK" TextButtons).
 *      - InfoPreference: `InfoWidget` (info icon, bodySmall 12sp/16sp text, secondaryItemAlpha 0.78).
 *
 * Web limitations:
 *   - Android Incognito IME (`it.setIncognito(...)` in SourcePreferencesScreen.kt:167): Browsers provide no Incognito IME API.
 *     We apply `autocomplete="off" autocorrect="off" spellcheck="false"`.
 *   - Local SharedPreferencesDataStore: Extension preferences are stored via Suwayomi REST `/source/{sourceId}/preferences`.
 */

type RowKind = 'category' | 'switch' | 'checkbox' | 'list' | 'multiselect' | 'text' | 'info' | 'plain'

interface Row {
  index: number
  kind: RowKind
  title: string
  summary: string | null
  enabled: boolean
  visible: boolean
  entries: string[]
  entryValues: string[]
  value: string | boolean | string[]
  dialogTitle: string
  dialogMessage: string | null
  editable: boolean
}

const route = useRoute(), router = useRouter(), server = useSuwayomiStore()
const sourceId = computed(() => String(route.params.sourceId ?? ''))
const source = ref<Source | null>(null)
const preferences = ref<SourcePreference[]>([])
const loadingSource = ref(true)
const loadingPreferences = ref(false)
const error = ref<string | null>(null)
const saveError = ref<string | null>(null)
const showSaveError = ref(false)
const saving = ref(false)
const dialog = ref<{ kind: 'list' | 'multiselect' | 'text'; row: Row } | null>(null)
const textDraft = ref('')
const multiDraft = ref<string[]>([])
const listDraft = ref('')

/** Mihon titles the screen with `source.toString()` -> "Name (LANG)" (HttpSource / StubSource). */
const title = computed(() => {
  const current = source.value
  if (!current) return 'Source'
  if (current.name && current.lang) return `${current.name} (${current.lang.toUpperCase()})`
  return current.displayName || current.name || current.id || 'Source'
})

const rows = computed<Row[]>(() => preferences.value.map((pref, index) => buildRow(pref, index)).filter(row => row.visible))
const activeRow = computed(() => dialog.value?.row ?? null)
const activeKind = computed(() => dialog.value?.kind ?? null)
const activeValues = computed(() => activeRow.value?.entryValues ?? [])
const activeEntries = computed(() => activeRow.value?.entries ?? [])

function stringValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  return ''
}

function booleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return false
}

function listValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => stringValue(item)).filter(item => item !== '')
  if (typeof value === 'string' && value.trim() !== '') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map(item => stringValue(item))
    } catch { /* not a JSON array */ }
  }
  return []
}

function buildRow(pref: SourcePreference, index: number): Row {
  const props = pref.props as SourcePreferenceProps
  const type = pref.type || ''
  const entries = Array.isArray(props.entries) ? props.entries.map(entry => stringValue(entry)) : []
  const entryValues = Array.isArray(props.entryValues) ? props.entryValues.map(value => stringValue(value)) : []
  const kind: RowKind = type === 'SwitchPreferenceCompat' || type === 'SwitchPreference' ? 'switch'
    : type === 'CheckBoxPreference' ? 'checkbox'
      : type === 'ListPreference' ? 'list'
        : type === 'MultiSelectListPreference' ? 'multiselect'
          : type === 'EditTextPreference' ? 'text'
            : type === 'PreferenceCategory' ? 'category'
              : type === 'InfoPreference' || type === 'InfoWidget' ? 'info'
                : 'plain'
  const rawValue = (kind === 'text' && (props.currentValue === null || props.currentValue === undefined))
    ? props.text
    : props.currentValue
  const value: string | boolean | string[] = kind === 'switch' || kind === 'checkbox' ? booleanValue(rawValue)
    : kind === 'multiselect' ? listValue(rawValue)
      : stringValue(rawValue)
  const rawSummary = props.summary === null || props.summary === undefined ? null : stringValue(props.summary)
  const summary = resolveSummary(rawSummary, kind, entries, entryValues, stringValue(rawValue))
  const editable = kind === 'list' || kind === 'multiselect' || kind === 'text' || kind === 'switch' || kind === 'checkbox'
  return {
    index,
    kind,
    title: props.title ?? '',
    summary,
    enabled: props.enabled !== false,
    visible: props.visible !== false,
    entries,
    entryValues,
    value,
    dialogTitle: (!props.dialogTitle || props.dialogTitle === '') ? (props.title ?? '') : stringValue(props.dialogTitle),
    dialogMessage: (!props.dialogMessage) ? null : stringValue(props.dialogMessage),
    editable,
  }
}

/** AndroidX / Mihon ListPreference summary formatting (%s is replaced with the selected entry label). */
function resolveSummary(summary: string | null, kind: RowKind, entries: string[], entryValues: string[], currentValue: string): string | null {
  if (summary === null) return null
  if (kind === 'list' && summary.includes('%s')) {
    const index = entryValues.indexOf(currentValue)
    const entry = index >= 0 ? entries[index] ?? entryValues[index] ?? '' : ''
    const formatted = summary.split('%s').join(entry)
    return formatted === '' ? null : formatted
  }
  return summary === '' ? null : summary
}

function isInteractive(row: Row): boolean {
  return row.enabled && row.editable
}

function rowChecked(row: Row): boolean {
  return booleanValue(row.value)
}

function onRowClick(event: Event, row: Row) {
  if (!isInteractive(row)) return
  const target = event.target as HTMLElement | null
  if (target?.closest('.md3-switch, .preference-checkbox-box')) return
  if (row.kind === 'switch' || row.kind === 'checkbox') {
    onToggle(row, !rowChecked(row))
    return
  }
  openDialog(row)
}

function onRowKeydown(event: KeyboardEvent, row: Row) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  onRowClick(event, row)
}

function openDialog(row: Row) {
  dialog.value = { kind: row.kind as 'list' | 'multiselect' | 'text', row }
  if (row.kind === 'text') textDraft.value = stringValue(row.value)
  if (row.kind === 'multiselect') multiDraft.value = listValue(row.value)
  if (row.kind === 'list') listDraft.value = stringValue(row.value)
}

function closeDialog() {
  dialog.value = null
  textDraft.value = ''
  multiDraft.value = []
  listDraft.value = ''
}

/**
 * In Mihon's `ListPreferenceWidget.kt` and AndroidX `ListPreferenceDialogFragmentCompat`,
 * selecting an entry in the list immediately applies the value and dismisses the dialog.
 */
function onListSelectAndApply(value: string) {
  const row = activeRow.value
  if (!row) return
  listDraft.value = value
  closeDialog()
  void persist(row, value)
}

function onMultiToggle(value: string) {
  multiDraft.value = multiDraft.value.includes(value)
    ? multiDraft.value.filter(item => item !== value)
    : [...multiDraft.value, value]
}

async function persist(row: Row, rawValue: string) {
  saving.value = true
  saveError.value = null
  try {
    await saveSourcePreference(server.apiUrl, sourceId.value, row.index, rawValue)
    preferences.value = await fetchSourcePreferences(server.apiUrl, sourceId.value)
  } catch (failure) {
    saveError.value = apiErrorMessage(failure)
    showSaveError.value = true
  } finally {
    saving.value = false
  }
}

function onToggle(row: Row, value: boolean | null) {
  if (!isInteractive(row) || value === null) return
  void persist(row, value ? 'true' : 'false')
}

function onConfirm() {
  const row = activeRow.value
  if (!row) return
  if (activeKind.value === 'multiselect') {
    const payload = JSON.stringify(multiDraft.value)
    closeDialog()
    void persist(row, payload)
    return
  }
  if (activeKind.value === 'text') {
    const payload = textDraft.value
    closeDialog()
    void persist(row, payload)
  }
}

function goBack() {
  if (typeof window.history.state?.back === 'string') { router.back(); return }
  void router.push('/browse')
}

async function load() {
  const id = sourceId.value
  if (!id) { error.value = 'This source id is missing.'; loadingSource.value = false; return }
  loadingSource.value = true
  error.value = null
  saveError.value = null
  try {
    let found = server.sources.find(item => item.id === id) ?? null
    if (!found) found = await fetchSource(server.apiUrl, id)
    source.value = found
    if (!found) {
      error.value = `Source not installed: ${id}`
      preferences.value = []
      return
    }
    loadingPreferences.value = true
    try {
      preferences.value = await fetchSourcePreferences(server.apiUrl, id)
    } catch (failure) {
      error.value = apiErrorMessage(failure)
    } finally {
      loadingPreferences.value = false
    }
  } catch (failure) {
    error.value = apiErrorMessage(failure)
  } finally {
    loadingSource.value = false
  }
}

watch(() => [server.apiUrl, sourceId.value], () => { void load() }, { immediate: true })
watch(() => server.sources, () => {
  const found = server.sources.find(item => item.id === sourceId.value)
  if (found && found !== source.value) source.value = found
})
if (!server.sources.length) void server.loadSources()
</script>

<template>
  <!-- LoadingScreen: Box(modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator() } without app bar. -->
  <div v-if="loadingSource && !source" class="preferences-loading" role="status" aria-label="Loading source">
    <Md3CircularProgress :size="40" :stroke="4" />
  </div>

  <div v-else class="source-preferences">
    <!-- TopAppBar: height 64dp, surface background, arrow_back nav button, titleLarge title. -->
    <header class="preference-toolbar" role="banner">
      <button
        type="button"
        class="preference-toolbar-nav"
        aria-label="Back"
        title="Back"
        @click="goBack"
      >
        <span class="material-symbols-rounded preference-toolbar-icon" aria-hidden="true">arrow_back</span>
      </button>
      <h1 class="preference-toolbar-title">{{ title }}</h1>
    </header>

    <!-- Error state: EmptyScreen with error message and action buttons. -->
    <MihonEmptyScreen v-if="error" :message="error">
      <button type="button" class="pref-action-btn pref-action-btn--primary" @click="load">Try again</button>
      <button type="button" class="pref-action-btn" @click="router.push('/browse')">Back to sources</button>
    </MihonEmptyScreen>

    <!-- Loading preferences below the AppBar. -->
    <div v-else-if="loadingPreferences" class="preferences-content-loading" role="status" aria-label="Loading preferences">
      <Md3CircularProgress :size="40" :stroke="4" />
    </div>

    <!-- Empty preferences screen (sources without configurable preferences render empty). -->
    <div v-else-if="rows.length === 0" class="preferences-empty">
      <MihonEmptyScreen message="No preferences available" />
    </div>

    <!-- Preference rows. -->
    <div v-else class="preference-list" role="list">
      <template v-for="row in rows" :key="row.index">
        <!-- PreferenceGroupHeader (PreferenceCategory): bodyMedium, secondary color, 14dp top / 8dp bottom padding. -->
        <div v-if="row.kind === 'category'" class="preference-category" role="presentation">
          <span class="preference-category-title">{{ row.title }}</span>
          <span v-if="row.summary" class="preference-category-summary">{{ row.summary }}</span>
        </div>

        <!-- InfoWidget: info icon, bodySmall text with 0.78 alpha. -->
        <div v-else-if="row.kind === 'info'" class="preference-info" role="note">
          <span class="material-symbols-rounded preference-info-icon" aria-hidden="true">info</span>
          <span class="preference-info-text">{{ row.title || row.summary }}</span>
        </div>

        <!-- BasePreferenceWidget: minHeight 56dp, titleLarge 16sp w400, bodySmall 12sp summary. -->
        <div
          v-else
          class="preference-row"
          :class="{
            'preference-row--interactive': isInteractive(row),
            'preference-row--disabled': !row.enabled,
          }"
          role="listitem"
          :tabindex="isInteractive(row) ? 0 : -1"
          :aria-disabled="row.enabled ? undefined : 'true'"
          @click="onRowClick($event, row)"
          @keydown="onRowKeydown($event, row)"
        >
          <div class="preference-text">
            <span class="preference-title">{{ row.title }}</span>
            <span v-if="row.summary" class="preference-summary">{{ row.summary }}</span>
          </div>

          <!-- SwitchPreferenceWidget: M3 Switch (52x32dp track, 16/24dp thumb with checkmark). -->
          <div v-if="row.kind === 'switch'" class="preference-widget">
            <Md3Switch
              :model-value="rowChecked(row)"
              :disabled="!row.enabled"
              :label="row.title"
              @update:model-value="onToggle(row, $event)"
            />
          </div>

          <!-- CheckBoxPreference: Material 3 Checkbox in trailing slot (20x20dp, 2dp radius). -->
          <div v-else-if="row.kind === 'checkbox'" class="preference-widget">
            <span
              class="preference-checkbox-box"
              :class="{
                'preference-checkbox-box--checked': rowChecked(row),
                'preference-checkbox-box--disabled': !row.enabled,
              }"
              role="checkbox"
              :aria-checked="rowChecked(row)"
              :aria-label="row.title"
            >
              <span v-if="rowChecked(row)" class="material-symbols-rounded preference-checkbox-icon" aria-hidden="true">check</span>
            </span>
          </div>
        </div>
      </template>
    </div>

    <!-- M3 Snackbar for save failure notification. -->
    <v-snackbar
      v-model="showSaveError"
      timeout="4000"
      color="error"
      location="bottom"
    >
      {{ saveError }}
    </v-snackbar>
  </div>

  <!-- Material 3 AlertDialog (m3_alert_dialog): 28dp corners, headlineSmall title, surfaceContainerHigh. -->
  <v-dialog
    :model-value="dialog !== null"
    max-width="560"
    @update:model-value="value => { if (!value) closeDialog() }"
  >
    <div v-if="activeRow" class="pref-alert-dialog" role="dialog" :aria-labelledby="activeRow.dialogTitle">
      <h2 class="pref-alert-title">{{ activeRow.dialogTitle }}</h2>

      <div class="pref-alert-content">
        <!-- ListPreference: DialogRow with RadioButton. Clicking immediately selects and dismisses. -->
        <template v-if="activeKind === 'list'">
          <div class="pref-alert-list" role="radiogroup">
            <button
              v-for="(entry, index) in activeEntries"
              :key="activeValues[index]"
              type="button"
              class="pref-dialog-row"
              role="radio"
              :aria-checked="listDraft === activeValues[index]"
              @click="onListSelectAndApply(activeValues[index]!)"
            >
              <span
                class="pref-radio"
                :class="{ 'pref-radio--selected': listDraft === activeValues[index] }"
                aria-hidden="true"
              >
                <span v-if="listDraft === activeValues[index]" class="pref-radio-dot" />
              </span>
              <span class="pref-dialog-row-label">{{ entry }}</span>
            </button>
          </div>
        </template>

        <!-- MultiSelectListPreference: LabeledCheckbox items. -->
        <template v-else-if="activeKind === 'multiselect'">
          <div class="pref-alert-list">
            <button
              v-for="(entry, index) in activeEntries"
              :key="activeValues[index]"
              type="button"
              class="pref-dialog-row"
              role="checkbox"
              :aria-checked="multiDraft.includes(activeValues[index]!)"
              @click="onMultiToggle(activeValues[index]!)"
            >
              <span
                class="preference-checkbox-box"
                :class="{ 'preference-checkbox-box--checked': multiDraft.includes(activeValues[index]!) }"
                aria-hidden="true"
              >
                <span v-if="multiDraft.includes(activeValues[index]!)" class="material-symbols-rounded preference-checkbox-icon">check</span>
              </span>
              <span class="pref-dialog-row-label">{{ entry }}</span>
            </button>
          </div>
        </template>

        <!-- EditTextPreference: OutlinedTextField with error / clear trailing icon. -->
        <template v-else-if="activeKind === 'text'">
          <p v-if="activeRow.dialogMessage" class="pref-alert-message">{{ activeRow.dialogMessage }}</p>
          <div class="pref-outlined-field" :class="{ 'pref-outlined-field--error': textDraft.trim() === '' }">
            <input
              v-model="textDraft"
              class="pref-outlined-input"
              :aria-label="activeRow.title"
              autocomplete="off"
              autocorrect="off"
              spellcheck="false"
              placeholder=" "
              @keydown.enter.prevent="textDraft.trim() !== '' && onConfirm()"
            />
            <div class="pref-outlined-trailing">
              <span v-if="textDraft.trim() === ''" class="material-symbols-rounded pref-field-error-icon" aria-hidden="true">error</span>
              <button
                v-else
                type="button"
                class="pref-field-clear-btn"
                aria-label="Clear input"
                title="Clear"
                @click="textDraft = ''"
              >
                <span class="material-symbols-rounded pref-field-clear-icon" aria-hidden="true">cancel</span>
              </button>
            </div>
          </div>
        </template>
      </div>

      <!-- Action buttons: M3 TextButtons. ListPreference has only Cancel; Multi/Text have Cancel and OK. -->
      <div class="pref-alert-actions">
        <template v-if="activeKind === 'list'">
          <button type="button" class="pref-alert-btn" @click="closeDialog">Cancel</button>
        </template>
        <template v-else>
          <button type="button" class="pref-alert-btn" :disabled="saving" @click="closeDialog">Cancel</button>
          <button
            type="button"
            class="pref-alert-btn pref-alert-btn--confirm"
            :disabled="saving || (activeKind === 'text' && (textDraft.trim() === '' || textDraft === String(activeRow.value)))"
            @click="onConfirm"
          >
            OK
          </button>
        </template>
      </div>
    </div>
  </v-dialog>
</template>

<style scoped>
@layer app-components {
/* ========================================================================= */
/* LoadingScreen: Box(fillMaxSize, Alignment.Center)                         */
/* ========================================================================= */
.preferences-loading {
  min-height: 100dvh;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--v-theme-background));
}

.preferences-content-loading {
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preferences-empty {
  padding-top: 48px;
}

/* ========================================================================= */
/* TopAppBar: 64dp, surface, 4dp start pad, 12dp gap, titleLarge 22sp/28sp  */
/* ========================================================================= */
.source-preferences {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}

.preference-toolbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 16px 0 4px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  box-sizing: border-box;
}

.preference-toolbar-nav {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 0;
  border-radius: 9999px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.preference-toolbar-nav:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.preference-toolbar-nav:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.preference-toolbar-icon {
  font-size: 24px;
  width: 24px;
  height: 24px;
}

.preference-toolbar-title {
  margin: 0 0 0 12px;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ========================================================================= */
/* Preference List & Rows                                                    */
/* BasePreferenceWidget: minHeight 56dp, padding 16dp                        */
/* Title: titleLarge 16sp / 24sp w400                                        */
/* Summary: bodySmall 12sp / 16sp w400 0.78 alpha                            */
/* ========================================================================= */
.preference-list {
  display: flex;
  flex-direction: column;
  padding-bottom: 32px;
}

.preference-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 56px;
  padding: 0 16px;
  color: rgb(var(--v-theme-on-surface));
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

.preference-row--interactive {
  cursor: pointer;
}
.preference-row--interactive:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.preference-row--interactive:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.preference-row:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.preference-row--disabled {
  opacity: 0.38;
  cursor: default;
  pointer-events: none;
}

.preference-text {
  flex: 1 1 auto;
  min-width: 0;
  padding: 16px 0;
}

.preference-title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.5px;
  color: rgb(var(--v-theme-on-surface));
  overflow-wrap: anywhere;
}

.preference-summary {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 10;
  overflow: hidden;
  margin-top: 0;
  font-size: 12px;
  line-height: 16px;
  letter-spacing: 0.4px;
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 78%, transparent);
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.preference-widget {
  flex: 0 0 auto;
  margin-left: 16px;
  display: flex;
  align-items: center;
}

/* ========================================================================= */
/* PreferenceGroupHeader: bodyMedium 14sp/20sp w500, secondary color         */
/* ========================================================================= */
.preference-category {
  display: flex;
  flex-direction: column;
  padding: 14px 16px 8px 16px;
  box-sizing: border-box;
}

.preference-category-title {
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-secondary));
}

.preference-category-summary {
  margin-top: 2px;
  font-size: 12px;
  line-height: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* ========================================================================= */
/* InfoWidget: info icon, bodySmall text, secondaryItemAlpha 0.78            */
/* ========================================================================= */
.preference-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 78%, transparent);
}

.preference-info-icon {
  font-size: 24px;
  width: 24px;
  height: 24px;
}

.preference-info-text {
  font-size: 12px;
  line-height: 16px;
  letter-spacing: 0.4px;
}

/* ========================================================================= */
/* M3 Checkbox: 20x20dp, 2dp border, 2dp radius, checked primary            */
/* ========================================================================= */
.preference-checkbox-box {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
  border-radius: 2px;
  background: transparent;
  color: rgb(var(--v-theme-on-primary));
  box-sizing: border-box;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.preference-checkbox-box--checked {
  background: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
}

.preference-checkbox-box--disabled {
  opacity: 0.38;
}

.preference-checkbox-icon {
  font-size: 14px;
  width: 14px;
  height: 14px;
  font-weight: 700;
}

/* ========================================================================= */
/* M3 Radio Button: 20x20dp circle, 2px border, 10dp inner dot              */
/* ========================================================================= */
.pref-radio {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
  border-radius: 50%;
  background: transparent;
  box-sizing: border-box;
  transition: border-color 150ms ease;
  flex: 0 0 20px;
}

.pref-radio--selected {
  border-color: rgb(var(--v-theme-primary));
}

.pref-radio-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
}

/* ========================================================================= */
/* Empty screen action buttons                                               */
/* ========================================================================= */
.pref-action-btn {
  height: 40px;
  padding: 0 16px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  cursor: pointer;
}
.pref-action-btn:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent);
}
.pref-action-btn--primary {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
.pref-action-btn--primary:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 92%, black);
}

/* ========================================================================= */
/* Material 3 Alert Dialog (m3_alert_dialog): 28dp corners, 24dp pad        */
/* Title: headlineSmall 24sp / 32sp w400                                     */
/* ========================================================================= */
.pref-alert-dialog {
  box-sizing: border-box;
  align-self: center;
  width: fit-content;
  min-width: min(280px, calc(100vw - 48px));
  max-width: 560px;
  max-height: calc(100dvh - 48px);
  margin: 0 auto;
  overflow-y: auto;
  padding: 24px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
  box-shadow: 0 6px 10px 0 rgba(0, 0, 0, 0.14), 0 1px 18px 0 rgba(0, 0, 0, 0.12), 0 3px 5px -1px rgba(0, 0, 0, 0.2);
}

.pref-alert-title {
  margin: 0 0 16px 0;
  font-size: 24px;
  line-height: 32px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  text-align: start;
}

.pref-alert-content {
  display: flex;
  flex-direction: column;
  margin-bottom: 24px;
  max-height: 60vh;
  overflow-y: auto;
}

.pref-alert-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Dialog row: minHeight 48dp, 8dp clip, padding 0 12dp, hover state        */
.pref-dialog-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 48px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  text-align: start;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  box-sizing: border-box;
}
.pref-dialog-row:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.pref-dialog-row:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.pref-dialog-row-label {
  flex: 1 1 auto;
  min-width: 0;
  margin-left: 24px;
}

.pref-dialog-row[role="checkbox"] .pref-dialog-row-label {
  margin-left: 16px;
}

/* ========================================================================= */
/* EditText OutlinedTextField: 56dp height, 8dp radius, error/clear trailing */
/* ========================================================================= */
.pref-alert-message {
  margin: 0 0 16px 0;
  font-size: 14px;
  line-height: 20px;
  color: rgb(var(--v-theme-on-surface-variant));
}

.pref-outlined-field {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 56px;
  border: 1px solid rgb(var(--v-theme-outline));
  border-radius: 8px;
  background: transparent;
  box-sizing: border-box;
  padding: 0 12px 0 16px;
  transition: border-color 150ms ease;
}
.pref-outlined-field:focus-within {
  border: 2px solid rgb(var(--v-theme-primary));
  padding: 0 11px 0 15px;
}
.pref-outlined-field--error {
  border-color: rgb(var(--v-theme-error)) !important;
}

.pref-outlined-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 52px;
  border: 0;
  outline: 0;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  font-size: 16px;
  line-height: 24px;
}

.pref-outlined-trailing {
  display: flex;
  align-items: center;
  margin-left: 8px;
}

.pref-field-error-icon {
  font-size: 24px;
  color: rgb(var(--v-theme-error));
}

.pref-field-clear-btn {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  cursor: pointer;
}
.pref-field-clear-btn:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.pref-field-clear-icon {
  font-size: 20px;
}

/* ========================================================================= */
/* Dialog Action Buttons (M3 TextButtons): 40dp height, labelLarge 14sp/20sp */
/* ========================================================================= */
.pref-alert-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.pref-alert-btn {
  height: 40px;
  min-width: 58px;
  padding: 0 12px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.pref-alert-btn:hover:not(:disabled) {
  background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent);
}
.pref-alert-btn:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
.pref-alert-btn:disabled {
  opacity: 0.38;
  cursor: default;
}
}
</style>
