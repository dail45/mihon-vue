<script setup lang="ts">
/**
 * Restore backup screen.
 *
 * Reference (Mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1):
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/data/RestoreBackupScreen.kt
 *   mihon/app/src/main/java/eu/kanade/tachiyomi/data/backup/BackupFileValidator.kt
 *   mihon/app/src/main/java/eu/kanade/tachiyomi/data/backup/restore/RestoreOptions.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/SectionCard.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/LabeledCheckbox.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/LazyColumnWithAction.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/components/Banners.kt (WarningBanner)
 *
 * Structure of the reference screen:
 *   - `Scaffold(topBar = AppBar(title = pref_restore_backup, navigateUp = navigator::pop, scrollBehavior = it))`
 *   - `LazyColumnWithAction(contentPadding, actionLabel = action_restore,
 *       actionEnabled = state.canRestore && state.options.canRestore(),
 *       onClickAction = { viewModel.startRestore(); navigator.pop() })` with
 *       * a `WarningBanner(restore_miui_warning)` item, but only when
 *         `DeviceUtil.isMiui && DeviceUtil.isMiuiOptimizationDisabled()` (MIUI only, never in a browser)
 *       * `SectionCard { RestoreOptions.options.forEach { LabeledCheckbox(...) } }` when `state.canRestore`
 *       * an error card (`errorMessageItem`) when `state.error != null`
 *     and, below the scrolling list, a `HorizontalDivider` plus a full width `Button` labelled "Restore".
 *
 * The reference receives the backup `uri` from the Android document picker
 * (`SettingsDataScreen.kt:206`, `ActivityResultContracts.OpenDocument`). A browser has no such
 * picker, so the file is chosen with a plain `<input type="file">` and read locally
 * (`src/api/backupFile.ts`) to reproduce `BackupFileValidator.validate()`:
 * the sources that are missing on the server and the trackers that are not logged into.
 * The file itself never leaves the browser.
 *
 * The restore itself is Android only: Mihon restores into its *local* database through
 * `BackupRestoreWorker`, and the Suwayomi REST API of the pinned revision exposes no backup
 * endpoint, so the "Restore" action opens an explicit "not supported in the web version" dialog
 * instead of silently doing nothing.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listTrackers, type Tracker } from '../api/trackers'
import { readBackupFile } from '../api/backupFile'
import { useSuwayomiStore } from '../stores/suwayomi'

const router = useRouter()
const server = useSuwayomiStore()

const props = withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})

/** `RestoreOptions` (RestoreOptions.kt:6-12) — the five toggles of the reference model. */
const options = reactive({
  libraryEntries: true,
  categories: true,
  appSettings: true,
  extensionStores: true,
  sourceSettings: true,
})

/** `RestoreOptions.options` (RestoreOptions.kt:25-51) — order and labels. */
interface RestoreOption {
  key: keyof typeof options
  label: string
}

const restoreOptions: RestoreOption[] = [
  { key: 'libraryEntries', label: 'Library' },
  { key: 'categories', label: 'Categories' },
  { key: 'appSettings', label: 'App settings' },
  { key: 'extensionStores', label: 'Extension stores' },
  { key: 'sourceSettings', label: 'Source settings' },
]

/** Flag IDs corresponding to Tachiyomi / Mihon restore flags. */
const FLAG_BY_KEY: Record<keyof typeof options, string> = {
  libraryEntries: 'restore_options_library',
  categories: 'restore_options_categories',
  appSettings: 'restore_options_settings',
  extensionStores: 'restore_options_extension_settings',
  sourceSettings: 'restore_options_source_settings',
}

/** `RestoreOptions.canRestore()` (RestoreOptions.kt:22). */
const canRestore = computed(
  () => options.libraryEntries || options.categories || options.appSettings || options.extensionStores || options.sourceSettings,
)

function toggle(key: keyof typeof options, value: boolean) {
  options[key] = value
}

/** Optional MIUI optimization warning (DeviceUtil.isMiui && DeviceUtil.isMiuiOptimizationDisabled()). */
const showMiuiWarning = ref(false)

/** The state of `RestoreBackupViewModel.State` (RestoreBackupScreen.kt:249-254). */
const state = reactive({
  error: null as RestoreError | null,
  canRestore: true,
  validating: false,
})

/** The two error shapes of the reference screen (RestoreBackupScreen.kt:257-266). */
type RestoreError =
  | { kind: 'missing'; sources: string[]; trackers: string[] }
  | { kind: 'invalid'; uri: string; message: string }

/** One line of the annotated message of `errorMessageItem` (RestoreBackupScreen.kt:122-168). */
interface ErrorLine {
  text: string
  bold: boolean
}

/**
 * `buildAnnotatedString` of the reference (RestoreBackupScreen.kt:122-168): the message is a single
 * Text whose bold parts are the "Missing sources:", "Trackers not logged into:", "Invalid backup
 * file:" and "Full error:" headings; the list items are prefixed with "- " and separated by newlines.
 */
const errorLines = computed<ErrorLine[]>(() => {
  const error = state.error
  if (!error) return []
  const lines: ErrorLine[] = []
  if (error.kind === 'missing') {
    lines.push({ text: 'You may need to install any missing extensions and log in to tracking services afterwards to use them.', bold: false })
    if (error.sources.length > 0) {
      lines.push({ text: '', bold: false })
      lines.push({ text: 'Missing sources:', bold: true })
      error.sources.forEach(source => lines.push({ text: `- ${source}`, bold: false }))
    }
    if (error.trackers.length > 0) {
      lines.push({ text: '', bold: false })
      lines.push({ text: 'Trackers not logged into:', bold: true })
      error.trackers.forEach(tracker => lines.push({ text: `- ${tracker}`, bold: false }))
    }
  } else {
    lines.push({ text: 'Invalid backup file:', bold: true })
    lines.push({ text: error.uri, bold: false })
    lines.push({ text: '', bold: false })
    lines.push({ text: 'Full error:', bold: true })
    lines.push({ text: error.message, bold: false })
  }
  return lines
})

/** The picked backup file, the browser equivalent of the Android document picker result. */
const selectedFile = ref<File | null>(null)
const fileName = ref('')

/** `MihonTrackerManager` ids (TrackerManager.kt:24-50) mapped onto the Suwayomi tracker ids. */
const MIHON_TRACKER_NAMES: Record<number, string> = {
  1: 'MyAnimeList',
  2: 'AniList',
  3: 'Kitsu',
  4: 'Shikimori',
  5: 'Bangumi',
  6: 'Komga',
  7: 'MangaUpdates',
  8: 'Kavita',
  9: 'Suwayomi',
  10: 'Hikka',
  11: 'MangaBaka',
  12: 'Comick',
}

/** Tracker name of a Suwayomi tracker (the id order matches `TrackerManager`). */
function trackerName(tracker: Tracker): string {
  return MIHON_TRACKER_NAMES[tracker.id] ?? tracker.name
}

async function ensureServerData() {
  if (!server.sourcesLoaded) {
    try {
      await server.loadSources()
    } catch {
      /* the store keeps the error; the validator then reports what it could not check */
    }
  }
  let trackers: Tracker[] = []
  try {
    trackers = await listTrackers(server.apiUrl)
  } catch {
    trackers = []
  }
  return trackers
}

/**
 * `BackupFileValidator.validate(uri)` (BackupFileValidator.kt:21-55):
 * a source of the backup that the server does not know is "missing", and a tracker of the
 * backup that exists on the server but is not logged into is "not logged into".
 */
async function validate(file: File) {
  state.validating = true
  state.error = null
  state.canRestore = false
  try {
    const contents = await readBackupFile(file)
    const trackers = await ensureServerData()
    const knownSourceIds = new Set(
      server.sources.map(source => Number(source.id)).filter(id => Number.isFinite(id)),
    )
    const missingSources = Array.from(
      new Set(
        contents.sources
          .filter(source => !knownSourceIds.has(source.sourceId))
          .map(source =>
            source.name.trim() === '' || Number.isFinite(Number(source.name))
              ? `Source #${source.sourceId}`
              : source.name,
          ),
      ),
    ).sort()
    const trackerById = new Map(trackers.map(tracker => [tracker.id, tracker]))
    const missingTrackers = Array.from(
      new Set(
        contents.trackerIds
          .map(id => trackerById.get(id))
          .filter((tracker): tracker is Tracker => !!tracker && !tracker.isLoggedIn)
          .map(tracker => trackerName(tracker)),
      ),
    ).sort()

    if (missingSources.length > 0 || missingTrackers.length > 0) {
      state.error = { kind: 'missing', sources: missingSources, trackers: missingTrackers }
      state.canRestore = true
    } else {
      state.error = null
      state.canRestore = true
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    state.error = { kind: 'invalid', uri: file.name, message }
    state.canRestore = false
  } finally {
    state.validating = false
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  if (!file) return
  selectedFile.value = file
  fileName.value = file.name
  void validate(file)
}

/** Stub dialog for the Android-only restore worker. */
const stubOpen = ref(false)

/** Android toast (eu.kanade.tachiyomi.util.system.toast) for the transient messages. */
const toast = ref<string | null>(null)
let toastTimer: number | undefined
function showToast(message: string) {
  toast.value = message
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = null }, 3000)
}

/** `onClickAction` of the reference: start the restore and pop the screen. */
function onRestore() {
  if (!state.canRestore || !canRestore.value) return
  showToast('Restoring backup…')
  stubOpen.value = true
}

function closeStubAndGoBack() {
  stubOpen.value = false
  goBack()
}

function goBack() {
  if (typeof window.history.state?.back === 'string') { router.back(); return }
  void router.push('/settings/data')
}

/** The shared shell bar is hidden while this screen provides its own top bar (see AppBar.kt). */
onMounted(() => {
  if (!props.embedded) {
    document.body.classList.add('restore-backup-active')
  }
})
onBeforeUnmount(() => {
  if (!props.embedded) {
    document.body.classList.remove('restore-backup-active')
  }
  if (toastTimer) window.clearTimeout(toastTimer)
})
</script>

<template>
  <section class="restore-backup" :class="{ 'restore-backup--embedded': embedded }">
    <!-- AppBar.kt: TopAppBar (64.dp) with the up arrow and the screen title, pinned while scrolling. -->
    <header v-if="!embedded" class="restore-backup-toolbar">
      <button
        class="restore-backup-icon-button"
        type="button"
        aria-label="Navigate up"
        title="Navigate up"
        @click="goBack"
      >
        <v-icon icon="arrow_back" size="24" />
      </button>
      <h1 class="restore-backup-title">Restore backup</h1>
    </header>

    <!-- LazyColumnWithAction: scrolling list (weight 1) + divider + full width action button. -->
    <div class="restore-backup-body">
      <div class="restore-backup-list">
        <!-- WarningBanner(MR.strings.restore_miui_warning) when DeviceUtil.isMiui && DeviceUtil.isMiuiOptimizationDisabled() -->
        <div v-if="showMiuiWarning" class="restore-backup-warning-banner" role="alert">
          Backup/restore may not function properly if MIUI Optimization is disabled.
        </div>

        <!-- The Android document picker has no web counterpart: the file is chosen in the browser.
             The reference receives the file uri before the screen opens, so this block replaces the
             picker itself and is not part of the reference layout. -->
        <section class="restore-backup-picker-section">
          <div class="restore-backup-card restore-backup-picker-card">
            <span class="restore-backup-picker-label">Backup file (.tachibk / .proto.gz)</span>
            <span class="restore-backup-picker-value">{{ fileName || 'No file selected' }}</span>
            <div class="restore-backup-picker-actions">
              <label class="restore-backup-picker-button" role="button" tabindex="0">
                <v-icon icon="folder_open" size="20" class="mr-2" />
                Select file
                <input
                  class="restore-backup-file-input"
                  type="file"
                  accept=".tachibk,.proto,.gz,.proto.gz,application/octet-stream,application/gzip"
                  @change="onFileChange"
                />
              </label>
              <span v-if="state.validating" class="restore-backup-picker-hint">Checking the backup file…</span>
            </div>
          </div>
        </section>

        <!-- SectionCard { RestoreOptions.options.forEach { LabeledCheckbox(...) } } (state.canRestore). -->
        <section v-if="!state.error || state.canRestore" class="restore-backup-section">
          <div class="restore-backup-card">
            <div
              v-for="option in restoreOptions"
              :key="option.key"
              :id="FLAG_BY_KEY[option.key]"
              :data-flag="FLAG_BY_KEY[option.key]"
              class="restore-backup-option"
              role="checkbox"
              :aria-checked="options[option.key]"
              tabindex="0"
              @click="toggle(option.key, !options[option.key])"
              @keydown.space.prevent="toggle(option.key, !options[option.key])"
            >
              <span class="restore-backup-checkbox" :class="{ 'restore-backup-checkbox-checked': options[option.key] }">
                <span class="restore-backup-checkbox-box">
                  <v-icon v-if="options[option.key]" icon="check" size="18" />
                </span>
              </span>
              <span class="restore-backup-option-label">{{ option.label }}</span>
            </div>
          </div>
        </section>

        <!-- errorMessageItem(state.error): one Text with the annotated message of the reference. -->
        <section v-if="state.error" class="restore-backup-section">
          <div class="restore-backup-card">
            <div class="restore-backup-error">
              <span
                v-for="(line, index) in errorLines"
                :key="index"
                class="restore-backup-error-line"
                :class="{ 'restore-backup-error-bold': line.bold }"
              >{{ line.text }}</span>
            </div>
          </div>
        </section>
      </div>

      <!-- HorizontalDivider() + Button(fillMaxWidth, action_restore). -->
      <div class="restore-backup-action">
        <hr class="restore-backup-divider" />
        <div class="restore-backup-action-inner">
          <button
            class="restore-backup-button"
            type="button"
            :disabled="!state.canRestore || !canRestore"
            @click="onRestore"
          >
            Restore
          </button>
        </div>
      </div>
    </div>

    <!-- Stub for the Android-only local database restore worker. -->
    <v-dialog v-model="stubOpen" max-width="560">
      <div class="restore-backup-dialog">
        <h2 class="restore-backup-dialog-title">Restore backup</h2>
        <div class="restore-backup-dialog-text">
          <p>
            Restoring a backup is not supported in the web version: Mihon restores the archive into
            its own local database through <code>BackupRestoreWorker</code>, while this client keeps
            no local database and the Suwayomi REST API exposes no backup endpoint.
          </p>
          <p class="restore-backup-dialog-file">
            The selected file would have been <strong>{{ fileName || 'app.mihon_backup.tachibk' }}</strong>
          </p>
        </div>
        <div class="restore-backup-dialog-actions">
          <button class="restore-backup-dialog-button" type="button" @click="stubOpen = false">Cancel</button>
          <button class="restore-backup-dialog-button" type="button" @click="closeStubAndGoBack">OK</button>
        </div>
      </div>
    </v-dialog>

    <!-- Android toast (eu.kanade.tachiyomi.util.system.toast). -->
    <div v-if="toast" class="restore-backup-toast" role="status" aria-live="polite">{{ toast }}</div>
  </section>
</template>

<style>
/* The shared shell bar is hidden while this screen provides its own top bar (see AppBar.kt). */
body.restore-backup-active .app-toolbar { display: none; }
</style>

<style scoped>
@layer app-components {
.restore-backup { display: flex; flex-direction: column; min-height: 100%; }

/* AppBar.kt: TopAppBar, 64.dp tall, container = surface at 0.dp elevation. */
.restore-backup-toolbar {
  position: fixed;
  top: 0;
  left: var(--v-layout-left);
  right: var(--v-layout-right);
  z-index: 3;
  display: flex;
  align-items: center;
  height: 64px;
  box-sizing: border-box;
  padding: 0 4px 0 0;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}
/* IconButton: 48.dp interactive container with a 40.dp circular state layer and a 24.dp icon. */
.restore-backup-icon-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin: 0 4px;
  padding: 0;
  border: none;
  border-radius: 24px;
  background: none;
  color: inherit;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.restore-backup-icon-button::before {
  content: '';
  position: absolute;
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background: transparent;
  transition: background-color 0.2s ease;
}
.restore-backup-icon-button:hover::before {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.restore-backup-icon-button:active::before {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.restore-backup-icon-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
/* AppBarTitle: titleLarge (22.sp / 28.sp, Regular). */
.restore-backup-title { flex: 1 1 auto; min-width: 0; margin: 0; padding: 0 4px; font-size: 22px; line-height: 28px; font-weight: 400; color: rgb(var(--v-theme-on-surface)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* WarningBanner.kt: fillMaxWidth, background error, padding 16.dp, color onError, bodyMedium, text center. */
.restore-backup-warning-banner {
  width: 100%;
  padding: 16px;
  background: rgb(var(--v-theme-error));
  color: rgb(var(--v-theme-on-error));
  font-size: 14px;
  line-height: 20px;
  text-align: center;
}

/* LazyColumnWithAction: Column(fillMaxSize) with the list taking the remaining height. */
.restore-backup-body { flex: 1 1 auto; display: flex; flex-direction: column; min-height: calc(100dvh - 64px); padding-top: 64px; }
.restore-backup--embedded .restore-backup-body { min-height: auto; padding-top: 0; }
.restore-backup-list { flex: 1 1 auto; overflow-y: auto; padding-bottom: 8px; }
.restore-backup--embedded .restore-backup-list { overflow-y: visible; }

/* SectionCard.kt: ElevatedCard(shapes.extraLarge) with 16.dp inner padding, 16.dp horizontal margin. */
.restore-backup-section { display: flex; flex-direction: column; }
.restore-backup-card { margin: 8px 16px; padding: 16px; border-radius: 28px; background: rgb(var(--v-theme-surface-container-low)); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15); }

/* The file picker replaces the Android document picker that opens this screen. */
.restore-backup-picker-section { display: flex; flex-direction: column; }
.restore-backup-picker-card { display: flex; flex-direction: column; gap: 8px; }
.restore-backup-picker-label { font-size: 12px; line-height: 16px; font-weight: 500; letter-spacing: 0.5px; color: rgb(var(--v-theme-on-surface-variant)); }
.restore-backup-picker-value { font-size: 16px; line-height: 24px; letter-spacing: 0.03125em; color: rgb(var(--v-theme-on-surface)); overflow-wrap: anywhere; }
.restore-backup-picker-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 4px; }
.restore-backup-picker-hint { font-size: 12px; line-height: 16px; color: rgb(var(--v-theme-on-surface-variant)); }
/* Material3 Button: 40.dp height, CornerFull (20.dp) shape, container primary. */
.restore-backup-picker-button { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; height: 40px; padding: 8px 24px; border: 0; border-radius: 20px; background: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-on-primary)); font-size: 14px; line-height: 20px; font-weight: 500; letter-spacing: 0.0071428571em; cursor: pointer; user-select: none; transition: background-color 0.2s ease, box-shadow 0.2s ease; }
.restore-backup-picker-button:hover { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); background: color-mix(in srgb, rgb(var(--v-theme-primary)) 92%, white); }
.restore-backup-picker-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.restore-backup-file-input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

/* LabeledCheckbox.kt: Row(min height 48.dp, spacedBy 8.dp, clip shapes.small) with a Checkbox and a Text. */
.restore-backup-option { display: flex; align-items: center; gap: 8px; min-height: 48px; border-radius: 8px; cursor: pointer; user-select: none; transition: background-color 0.2s ease; }
.restore-backup-option:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.restore-backup-option:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent); }
.restore-backup-option:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
/* Material3 Checkbox: 18.dp box, 2.dp corner radius, 2.dp outline, 16.dp check icon. */
.restore-backup-checkbox { flex: 0 0 auto; display: grid; place-items: center; width: 48px; height: 48px; }
.restore-backup-checkbox-box { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 2px; border: 2px solid rgb(var(--v-theme-on-surface-variant)); background: transparent; color: rgb(var(--v-theme-on-primary)); transition: border-color 0.2s ease, background-color 0.2s ease; }
.restore-backup-checkbox-checked .restore-backup-checkbox-box { border-color: rgb(var(--v-theme-primary)); background: rgb(var(--v-theme-primary)); }
/* Compose default Text style: bodyLarge (16.sp / 24.sp, letterSpacing 0.03125em). */
.restore-backup-option-label { font-size: 16px; line-height: 24px; letter-spacing: 0.03125em; color: rgb(var(--v-theme-on-surface)); }

/* errorMessageItem: Column(padding horizontal 16.dp) holding one selectable Text. */
.restore-backup-error { padding: 0 16px; user-select: text; }
.restore-backup-error-line { display: block; font-size: 16px; line-height: 24px; letter-spacing: 0.03125em; color: rgb(var(--v-theme-on-surface)); }
/* `appendLine()` of the reference produces a full empty line. */
.restore-backup-error-line:empty { min-height: 24px; }
.restore-backup-error-bold { font-weight: 700; }

/* LazyColumnWithAction: HorizontalDivider() then Button(padding 16.dp horizontal / 8.dp vertical, fillMaxWidth). */
.restore-backup-action { flex: 0 0 auto; background: rgb(var(--v-theme-surface)); }
.restore-backup-action-inner { padding: 8px 16px; }
.restore-backup-divider { margin: 0; border: 0; border-top: 1px solid rgb(var(--v-theme-outline-variant)); }
/* Material3 Button: 40.dp height, CornerFull (20.dp) shape, container primary, label labelLarge. */
.restore-backup-button { box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: 100%; min-width: 58px; height: 40px; padding: 8px 24px; border: 0; border-radius: 20px; background: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-on-primary)); font-family: inherit; font-size: 14px; line-height: 20px; font-weight: 500; letter-spacing: 0.0071428571em; cursor: pointer; transition: background-color 0.2s ease, box-shadow 0.2s ease; }
.restore-backup-button:disabled { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent); color: rgb(var(--v-theme-on-surface)); opacity: .38; cursor: default; }
.restore-backup-button:not(:disabled):hover { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); background: color-mix(in srgb, rgb(var(--v-theme-primary)) 92%, white); }
.restore-backup-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* MD3 AlertDialog: surface-container-high, CornerExtraLarge (28.dp), 24.dp content padding. */
.restore-backup-dialog { box-sizing: border-box; width: fit-content; min-width: min(280px, calc(100vw - 48px)); max-width: min(560px, calc(100vw - 48px)); margin: 0 auto; padding: 24px; border-radius: 28px; background: rgb(var(--v-theme-surface-container-high)); color: rgb(var(--v-theme-on-surface)); box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px 0 rgba(0, 0, 0, 0.3); }
.restore-backup-dialog-title { margin: 0 0 16px; font-size: 24px; line-height: 32px; font-weight: 400; color: rgb(var(--v-theme-on-surface)); }
.restore-backup-dialog-text { margin-bottom: 24px; }
.restore-backup-dialog-text p { margin: 0 0 16px; font-size: 14px; line-height: 20px; letter-spacing: 0.0071428571em; color: rgb(var(--v-theme-on-surface-variant)); }
.restore-backup-dialog-text p:last-child { margin-bottom: 0; }
.restore-backup-dialog-file { font-family: ui-monospace, monospace; }
.restore-backup-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
.restore-backup-dialog-button { height: 40px; min-width: 58px; padding: 0 12px; border: 0; border-radius: 20px; background: transparent; color: rgb(var(--v-theme-primary)); font-family: inherit; font-size: 14px; line-height: 20px; font-weight: 500; letter-spacing: 0.0071428571em; cursor: pointer; transition: background-color 0.2s ease; }
.restore-backup-dialog-button:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
.restore-backup-dialog-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* Android toast: small dark rounded panel near the bottom of the screen. */
.restore-backup-toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 20; max-width: min(560px, calc(100vw - 32px)); padding: 14px 16px; border-radius: 4px; background: rgb(var(--v-theme-inverse-surface)); color: rgb(var(--v-theme-inverse-on-surface)); font-size: 14px; line-height: 20px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.28); }
}
</style>
