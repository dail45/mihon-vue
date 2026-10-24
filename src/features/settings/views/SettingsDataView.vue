<script setup lang="ts">
/**
 * Settings — Data and storage.
 *
 * Reference: mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsDataScreen.kt
 * (Mihon 446f6df) plus the widgets it renders:
 *   widget/BasePreferenceWidget.kt    — Row(minHeight 56dp), title titleLarge @16sp (max 2 lines),
 *                                       subtitle bodySmall @ .78 alpha, 16dp paddings.
 *   widget/PreferenceGroupHeader.kt   — bodyMedium, colorScheme.secondary, padding(top 14dp, bottom 8dp, horizontal 16dp).
 *   widget/InfoWidget.kt               — Column(padding 16dp) { Icon(Info 24dp), Text(bodySmall) }, alpha .78.
 *   widget/ListPreferenceWidget.kt     — row with the current entry as subtitle + AlertDialog with radio rows.
 *   widget/SwitchPreferenceWidget.kt  — row with a trailing Switch.
 *   screen/data/StorageInfo.kt         — StorageInfoItem.vue reproduces that block pixel by pixel.
 *   data/export/LibraryExporter.kt     — CSV: "\r\n" rows, "," columns, quoted when the value holds \r \n " or ,.
 *   PreferenceScreen.kt                — 12dp spacer after every group except the last one.
 *
 * The library list export is backed by real data (the Suwayomi library). Everything that depends on
 * Android SAF / WorkManager / local storage keeps the reference layout and opens an explicit
 * "not supported in the web version" dialog instead of silently disappearing.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Md3Switch from '@/core/components/Md3Switch.vue'
import StorageInfoItem from '@/core/components/StorageInfoItem.vue'
import { readPreference, writePreference } from '@/features/settings/stores/preferences'
import { useSuwayomiStore } from '@/features/library/stores/suwayomi'
import type { Manga } from '@/core/api/types'

const router = useRouter()
const server = useSuwayomiStore()

/* --- local preferences (browser only, the Suwayomi REST API has no endpoint for them) --------- */

function persistedInt(key: string, fallback: number) {
  const stored = readPreference(key)
  const parsed = stored === null ? Number.NaN : Number(stored)
  const value = ref(Number.isFinite(parsed) ? parsed : fallback)
  watch(value, v => writePreference(key, String(v)))
  return value
}
function persistedBool(key: string, fallback: boolean) {
  const stored = readPreference(key)
  const value = ref(stored === null ? fallback : stored === 'true')
  watch(value, v => writePreference(key, String(v)))
  return value
}

// BackupPreferences.backupInterval (hours).
const backupInterval = persistedInt('mihon.data.backupInterval', 0)
// LibraryPreferences.autoClearChapterCache.
const autoClearChapterCache = persistedBool('mihon.data.autoClearChapterCache', false)

/* --- library export -------------------------------------------------------------------- */

const libraryManga = computed<Manga[]>(() => {
  const seen = new Map<number, Manga>()
  for (const list of Object.values(server.libraryByCategory)) for (const manga of list) if (!seen.has(manga.id)) seen.set(manga.id, manga)
  return [...seen.values()]
})

/** LibraryExporter.generateCsvData: "\r\n" rows, "," columns, quoted when the value holds \r \n " or ,. */
function generateCsv(manga: Manga[], options: { includeTitle: boolean; includeAuthor: boolean; includeArtist: boolean }): string {
  const escapeRequired = ['\r', '\n', '"', ',']
  return manga.map(item => {
    const columns: (string | null | undefined)[] = []
    if (options.includeTitle) columns.push(item.title)
    if (options.includeAuthor) columns.push(item.author)
    if (options.includeArtist) columns.push(item.artist)
    return columns.map(column => {
      if (!column || column.trim() === '') return ''
      return escapeRequired.some(character => column.includes(character)) ? `"${column.replace(/"/g, '""')}"` : column
    }).join(',')
  }).join('\r\n')
}

type ExportOptions = { includeTitle: boolean; includeAuthor: boolean; includeArtist: boolean }
const exportOpen = ref(false)
const exportOptions = ref<ExportOptions>({ includeTitle: true, includeAuthor: true, includeArtist: true })
const exportError = ref<string | null>(null)

/** ColumnSelectionDialog: unchecking Title also unchecks Author and Artist. */
function toggleTitle() {
  const checked = !exportOptions.value.includeTitle
  exportOptions.value.includeTitle = checked
  if (!checked) {
    exportOptions.value.includeAuthor = false
    exportOptions.value.includeArtist = false
  }
}

function confirmExport() {
  exportError.value = null
  try {
    const csv = generateCsv(libraryManga.value, exportOptions.value)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'mihon_library.csv'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    exportOpen.value = false
    // MR.strings.library_exported, shown as an Android toast in the reference.
    showToast('Library Exported')
  } catch (error) {
    exportError.value = error instanceof Error ? error.message : 'The library list could not be exported.'
  }
}

/** Android toast (eu.kanade.tachiyomi.util.system.toast) for the transient messages. */
const toast = ref<string | null>(null)
let toastTimer: number | undefined
function showToast(message: string) {
  toast.value = message
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = null }, 3000)
}

/* --- stubs for the Android-only actions -------------------------------------------------- */

type StubReason = 'storage' | 'create-backup' | 'restore-backup' | 'clear-cache'
const stubOpen = ref(false)
const stubReason = ref<StubReason>('storage')

const STUB_TEXT: Record<StubReason, { title: string; body: string }> = {
  'storage': {
    title: 'Storage location',
    body: 'Not supported in the web version. Choosing a storage folder needs the Android document picker; manga, downloads and backups are stored by your Suwayomi server, not by this browser.',
  },
  'create-backup': {
    title: 'Create backup',
    body: 'Not supported in the web version. Creating a backup needs the Android file picker and the local Mihon database; the Suwayomi REST API exposes no backup endpoint.',
  },
  'restore-backup': {
    title: 'Restore backup',
    body: 'Not supported in the web version. Restoring a backup needs the Android file picker and the local Mihon database; the Suwayomi REST API exposes no backup endpoint.',
  },
  'clear-cache': {
    title: 'Clear chapter cache',
    body: 'Not supported in the web version. This client keeps no local manga database, so there is no chapter cache to clear; the server keeps its own cache.',
  },
}
function openStub(reason: StubReason) { stubReason.value = reason; stubOpen.value = true }

/**
 * The reference pushes CreateBackupScreen / RestoreBackupScreen. Both screens exist in this client
 * (src/views/CreateBackupView.vue, src/views/RestoreBackupView.vue) but their routes are owned by
 * the integration task, so the action falls back to the stub dialog while the route is missing.
 */
function openBackupScreen(path: string, reason: StubReason) {
  if (router.resolve(path).matched.length) { void router.push(path); return }
  openStub(reason)
}

/* --- backup interval dialog -------------------------------------------------------------- */

const intervalOpen = ref(false)
// MR.strings.off / update_6hour / update_12hour / update_24hour / update_48hour / update_weekly
const BACKUP_INTERVALS = [
  { value: 0, title: 'Off' },
  { value: 6, title: 'Every 6 hours' },
  { value: 12, title: 'Every 12 hours' },
  { value: 24, title: 'Daily' },
  { value: 48, title: 'Every 2 days' },
  { value: 168, title: 'Weekly' },
]
const backupIntervalTitle = computed(() => BACKUP_INTERVALS.find(i => i.value === backupInterval.value)?.title ?? 'Off')
function pickBackupInterval(value: number) {
  backupInterval.value = value
  intervalOpen.value = false
}

/* --- help action ------------------------------------------------------------------------- */

const HELP_URL = 'https://mihon.app/docs/faq/storage'

onMounted(async () => {
  // The library list export needs the library; the reference reads it before opening the dialog.
  if (!server.categories.length && !server.loadingLibrary) await server.loadLibrary()
})
onBeforeUnmount(() => { if (toastTimer) window.clearTimeout(toastTimer) })
</script>

<template>
  <div class="data-settings" role="group" aria-label="Data and storage">
    <!-- SettingsDataScreen.AppBarAction(): MaterialSymbols.AutoMirroredRounded.Help.
         The shared app bar (src/App.vue) is owned by another task, so the action is rendered at
         the top of the section instead of inside the app bar. -->
    <div class="data-settings__actions">
      <a class="data-settings__help" :href="HELP_URL" target="_blank" rel="noopener noreferrer" aria-label="Tracking guide">
        <v-icon icon="help" size="24" />
      </a>
    </div>

    <!-- getStorageLocationPref(): TextPreference without a group header. -->
    <button type="button" class="pref-row pref-row--button" @click="openStub('storage')">
      <span class="pref-text">
        <span class="pref-title">Storage location</span>
        <span class="pref-subtitle">No storage location set</span>
      </span>
    </button>

    <!-- InfoPreference(pref_storage_location_info). -->
    <div class="pref-info">
      <v-icon icon="info" size="24" />
      <p class="pref-info-text">Used for automatic backups, chapter downloads, and local source.</p>
    </div>

    <!-- getBackupAndRestoreGroup(). -->
    <h2 class="pref-group-header">Backup and restore</h2>
    <!-- CustomPreference with a MultiChoiceSegmentedButtonRow of two items. -->
    <div class="pref-row pref-row--custom">
      <div class="segmented" role="group" aria-label="Backup and restore">
        <button type="button" class="segmented-item segmented-item--start" @click="openBackupScreen('/settings/data/create-backup', 'create-backup')">Create backup</button>
        <button type="button" class="segmented-item segmented-item--end" @click="openBackupScreen('/settings/data/restore-backup', 'restore-backup')">Restore backup</button>
      </div>
    </div>
    <!-- ListPreference(pref_backup_interval). -->
    <button type="button" class="pref-row pref-row--button" @click="intervalOpen = true">
      <span class="pref-text">
        <span class="pref-title">Automatic backup frequency</span>
        <span class="pref-subtitle">{{ backupIntervalTitle }}</span>
      </span>
    </button>
    <!-- InfoPreference(backup_info + "\n\n" + last_auto_backup_info). -->
    <div class="pref-info">
      <v-icon icon="info" size="24" />
      <p class="pref-info-text">You should keep copies of backups in other places as well. Backups may contain sensitive data including any stored passwords; be careful if sharing.

Last automatically backed up: never</p>
    </div>
    <!-- PreferenceScreen.kt: Spacer(12.dp) after every group except the last one. -->
    <div class="pref-group-spacer" />

    <!-- getDataGroup(). -->
    <h2 class="pref-group-header">Storage usage</h2>
    <!-- CustomPreference with the StorageInfo subcomponent. -->
    <div class="pref-row pref-row--custom">
      <div class="storage-info-wrap">
        <StorageInfoItem />
      </div>
    </div>
    <!-- TextPreference(pref_clear_chapter_cache). -->
    <button type="button" class="pref-row pref-row--button" @click="openStub('clear-cache')">
      <span class="pref-text">
        <span class="pref-title">Clear chapter cache</span>
        <span class="pref-subtitle">Used: 0 B</span>
      </span>
    </button>
    <!-- SwitchPreference(pref_auto_clear_chapter_cache). SwitchPreferenceWidget.kt makes the whole
         row clickable (onPreferenceClick toggles the switch); the Switch itself has onCheckedChange
         = null, so it never handles the click on its own. -->
    <div class="pref-row pref-row--button" @click="autoClearChapterCache = !autoClearChapterCache">
      <span class="pref-text">
        <span class="pref-title">Clear chapter cache on app launch</span>
      </span>
      <div class="pref-trailing">
        <Md3Switch
          :model-value="autoClearChapterCache"
          label="Clear chapter cache on app launch"
          @update:model-value="(value: boolean) => { autoClearChapterCache = value }"
        />
      </div>
    </div>
    <!-- PreferenceScreen.kt: Spacer(12.dp) after every group except the last one. -->
    <div class="pref-group-spacer" />

    <!-- getExportGroup(). -->
    <h2 class="pref-group-header">Export</h2>
    <!-- TextPreference(library_list) opening the ColumnSelectionDialog. -->
    <button type="button" class="pref-row pref-row--button" @click="exportOpen = true">
      <span class="pref-text">
        <span class="pref-title">Library List</span>
      </span>
    </button>

    <!-- ColumnSelectionDialog(): title "Select data to include", Title / Author / Artist checkboxes. -->
    <v-dialog
      :model-value="exportOpen"
      max-width="560"
      @update:model-value="value => { if (!value) exportOpen = false }"
    >
      <v-card v-if="exportOpen" class="pref-dialog" rounded="xl">
        <h3 class="pref-dialog-title">Select data to include</h3>
        <div class="pref-dialog-body">
          <button
            type="button"
            class="pref-dialog-row"
            role="checkbox"
            :aria-checked="exportOptions.includeTitle"
            @click="toggleTitle"
          >
            <span class="pref-control" aria-hidden="true">
              <span class="pref-checkbox" :class="{ 'pref-checkbox--on': exportOptions.includeTitle }">
                <svg viewBox="0 0 24 24"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
              </span>
            </span>
            <span class="pref-dialog-label pref-dialog-label--tight">Title</span>
          </button>
          <button
            type="button"
            class="pref-dialog-row"
            role="checkbox"
            :aria-checked="exportOptions.includeAuthor"
            :disabled="!exportOptions.includeTitle"
            @click="exportOptions.includeAuthor = !exportOptions.includeAuthor"
          >
            <span class="pref-control" aria-hidden="true">
              <span class="pref-checkbox" :class="{ 'pref-checkbox--on': exportOptions.includeAuthor }">
                <svg viewBox="0 0 24 24"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
              </span>
            </span>
            <span class="pref-dialog-label pref-dialog-label--tight">Author</span>
          </button>
          <button
            type="button"
            class="pref-dialog-row"
            role="checkbox"
            :aria-checked="exportOptions.includeArtist"
            :disabled="!exportOptions.includeTitle"
            @click="exportOptions.includeArtist = !exportOptions.includeArtist"
          >
            <span class="pref-control" aria-hidden="true">
              <span class="pref-checkbox" :class="{ 'pref-checkbox--on': exportOptions.includeArtist }">
                <svg viewBox="0 0 24 24"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
              </span>
            </span>
            <span class="pref-dialog-label pref-dialog-label--tight">Artist</span>
          </button>
          <p v-if="exportError" class="pref-dialog-error">{{ exportError }}</p>
        </div>
        <div class="pref-dialog-actions">
          <v-btn variant="text" color="primary" class="pref-dialog-button" @click="exportOpen = false">Cancel</v-btn>
          <v-btn variant="text" color="primary" class="pref-dialog-button" @click="confirmExport">Save</v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- ListPreferenceWidget(): AlertDialog with radio rows and a "Cancel" confirm button. -->
    <v-dialog
      :model-value="intervalOpen"
      max-width="560"
      @update:model-value="value => { if (!value) intervalOpen = false }"
    >
      <v-card v-if="intervalOpen" class="pref-dialog" rounded="xl">
        <h3 class="pref-dialog-title">Automatic backup frequency</h3>
        <div class="pref-dialog-body">
          <button
            v-for="entry in BACKUP_INTERVALS"
            :key="entry.value"
            type="button"
            class="pref-dialog-row"
            role="radio"
            :aria-checked="backupInterval === entry.value"
            @click="pickBackupInterval(entry.value)"
          >
            <span class="pref-control" aria-hidden="true">
              <span class="pref-radio" :class="{ 'pref-radio--on': backupInterval === entry.value }"><i /></span>
            </span>
            <span class="pref-dialog-label pref-dialog-label--radio">{{ entry.title }}</span>
          </button>
        </div>
        <div class="pref-dialog-actions">
          <v-btn variant="text" color="primary" class="pref-dialog-button" @click="intervalOpen = false">Cancel</v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- Stub dialog for the Android-only actions. -->
    <v-dialog
      :model-value="stubOpen"
      max-width="560"
      @update:model-value="value => { if (!value) stubOpen = false }"
    >
      <v-card v-if="stubOpen" class="pref-dialog" rounded="xl">
        <h3 class="pref-dialog-title">{{ STUB_TEXT[stubReason].title }}</h3>
        <div class="pref-dialog-body">
          <p class="pref-dialog-text">{{ STUB_TEXT[stubReason].body }}</p>
        </div>
        <div class="pref-dialog-actions">
          <v-btn variant="text" color="primary" class="pref-dialog-button" @click="stubOpen = false">Close</v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- Android toast (eu.kanade.tachiyomi.util.system.toast). -->
    <div v-if="toast" class="pref-toast" role="status" aria-live="polite">{{ toast }}</div>
  </div>
</template>

<style scoped>
@layer app-components {
.data-settings { display: block; }

/* PreferenceGroupHeader.kt: bodyMedium (14/20), colorScheme.secondary, padding 14dp/8dp/16dp. */
.pref-group-header {
  margin: 0;
  padding: 14px 16px 8px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.25px;
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
  padding: 16px;
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
.pref-row--custom { display: block; padding: 0; }
.pref-text { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
/* BasePreferenceWidget.kt: title style = titleLarge with fontSize = TitleFontSize (16.sp).
   Title line-height is 24sp (ratio 1.5). */
.pref-title {
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  letter-spacing: 0.15px;
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
  letter-spacing: 0.4px;
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 78%, transparent);
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 10;
}
/* BasePreferenceWidget.kt: trailing widget Box padding(end = PrefsHorizontalPadding). */
.pref-trailing { padding-inline-end: 16px; }

/* InfoWidget.kt: Column(padding 16dp) { Icon(Info 24dp), Text(bodySmall) }, alpha .78, spacedBy 16dp. */
.pref-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  opacity: .78;
  color: rgb(var(--v-theme-on-surface));
}
.pref-info-text {
  margin: 0;
  font-size: 12px;
  line-height: 16px;
  letter-spacing: 0.4px;
  color: rgb(var(--v-theme-on-surface));
  white-space: pre-line;
}

/* MultiChoiceSegmentedButtonRow: two SegmentedButtons with itemShape(0, 2) / itemShape(1, 2).
   MD3 (material3 1.4.x):
   - the row is `Arrangement.spacedBy(-space)` with space = BorderWidth (1dp): the items overlap by
     one border width instead of being separated by a gap;
   - itemShape(index, count) rounds only the outer corners of the whole row (baseShape.start() for
     the first item, baseShape.end() for the last one), the inner corners stay square;
   - each item is a Surface with a 1dp outline (colorScheme.outline), a transparent container and
     the label text (labelLarge) in colorScheme.onSurface;
   - the content padding is 12dp horizontal and the button height is 40dp (ContainerHeight). */
.segmented { display: flex; margin: 16px; }
.segmented-item {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 8px 12px;
  border: 1px solid rgb(var(--v-theme-outline));
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  cursor: pointer;
}
.segmented-item--start { border-radius: 20px 0 0 20px; }
/* The row overlaps the items by one border width, so the shared border is drawn once. */
.segmented-item--end { margin-inline-start: -1px; border-radius: 0 20px 20px 0; }
.segmented-item:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.segmented-item:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent); }

/* StorageInfo.kt is rendered by StorageInfoItem.vue; M3 padding (12px vertical, 16px horizontal) is inside StorageInfoItem. */
.storage-info-wrap {
  width: 100%;
}

/* App bar action (IconButton with the Help icon). */
.data-settings__actions { display: flex; justify-content: flex-end; height: 48px; padding-inline: 4px; }
.data-settings__help {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  color: rgb(var(--v-theme-on-surface-variant));
  text-decoration: none;
}
.data-settings__help:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.data-settings__help:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent); }

/* MD3 AlertDialog. */
.pref-dialog { padding: 24px; background: rgb(var(--v-theme-surface-container-high)); color: rgb(var(--v-theme-on-surface)); }
.pref-dialog-title { margin: 0 0 16px; font-size: 24px; line-height: 32px; font-weight: 400; }
.pref-dialog-body { display: flex; flex-direction: column; max-height: 320px; overflow-y: auto; }
.pref-dialog-text { margin: 0; font-size: 16px; line-height: 24px; color: rgb(var(--v-theme-on-surface-variant)); }
.pref-dialog-error { margin: 8px 0 0; font-size: 12px; line-height: 16px; color: rgb(var(--v-theme-error)); }
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
}
.pref-dialog-row:hover:not(:disabled) { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.pref-dialog-row:disabled { cursor: default; }
/* MD3 disabled Checkbox: the box is drawn with the disabled outline colour, the label text of the
   reference row keeps its normal colour. */
.pref-dialog-row:disabled .pref-checkbox {
  border-color: color-mix(in srgb, rgb(var(--v-theme-on-surface-variant)) 38%, transparent);
  background: transparent;
}
/* MD3 RadioButton: 20dp outer circle, 10dp inner dot. */
.pref-radio {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
}
.pref-radio--on { border-color: rgb(var(--v-theme-primary)); }
.pref-radio i { width: 10px; height: 10px; border-radius: 50%; background: rgb(var(--v-theme-primary)); }
.pref-radio--on i { display: block; }
.pref-radio:not(.pref-radio--on) i { display: none; }
/* MD3 Checkbox: 18dp box, 2dp radius, 2dp outline. */
.pref-checkbox {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 2px;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
}
/* ColumnSelectionDialog: the Checkbox keeps its 48dp touch target, the Text follows directly. */
.pref-dialog-label--tight { margin-inline-start: 0; }
/* MD3 Checkbox / RadioButton are drawn inside a 48dp minimum interactive component size
   (minimumInteractiveComponentSize), so the control box is 48x48 and the drawn shape is centred. */
.pref-control {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
}
.pref-checkbox--on { background: rgb(var(--v-theme-primary)); border-color: rgb(var(--v-theme-primary)); }
.pref-checkbox svg { width: 14px; height: 14px; fill: rgb(var(--v-theme-on-primary)); opacity: 0; }
.pref-checkbox--on svg { opacity: 1; }
/* Text(bodyLarge) with start padding 24dp. */
.pref-dialog-label { margin-inline-start: 24px; font-size: 16px; line-height: 24px; letter-spacing: 0.5px; }
/* DialogRow.kt: the label follows the RadioButton's 48dp box with a 24dp start padding. */
.pref-dialog-label--radio { margin-inline-start: 24px; }
.pref-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
/* MD3 TextButton: 40dp height, 64dp min width, labelLarge (14sp / 20sp, 0.1sp tracking). */
.pref-dialog-button { min-width: 64px; min-height: 40px; letter-spacing: 0.1px; }

/* Android toast: small dark rounded panel near the bottom of the screen. */
.pref-toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 20;
  max-width: min(560px, calc(100vw - 32px));
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28);
}
}
</style>
