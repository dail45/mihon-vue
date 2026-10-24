<script setup lang="ts">
/**
 * Create backup screen.
 *
 * Reference (Mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1):
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/data/CreateBackupScreen.kt
 *   mihon/app/src/main/java/eu/kanade/tachiyomi/data/backup/create/BackupOptions.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/SectionCard.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/LabeledCheckbox.kt
 *   mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/LazyColumnWithAction.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/components/AppBar.kt
 *
 * Structure of the reference screen:
 *   - `Scaffold(topBar = AppBar(title = pref_create_backup, navigateUp = navigator::pop, scrollBehavior = it))`
 *   - `LazyColumnWithAction(contentPadding, actionLabel = action_create, actionEnabled = state.options.canCreate())`
 *       * a `WarningBanner(restore_miui_warning)` item, but only when
 *         `DeviceUtil.isMiui && DeviceUtil.isMiuiOptimizationDisabled()` (MIUI only, never in a browser)
 *       * `SectionCard(label_library) { Options(BackupOptions.libraryOptions, ...) }`
 *       * `SectionCard(label_settings) { Options(BackupOptions.settingsOptions, ...) }`
 *     and, below the scrolling list, a `HorizontalDivider` plus a full width `Button` labelled "Create".
 *
 * Backup creation itself is an Android-only flow: Mihon archives its *local* database into a
 * `.tachibk` file through the system document picker (`ActivityResultContracts.CreateDocument`).
 * This client keeps no local database and the Suwayomi REST API exposes no backup endpoint, so the
 * "Create" action opens an explicit "not supported in the web version" dialog instead of silently
 * doing nothing.
 */
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const props = withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})

/** `BackupOptions` (BackupOptions.kt:6-17) — the ten toggles of the reference model. */
const options = reactive({
  libraryEntries: true,
  categories: true,
  chapters: true,
  tracking: true,
  history: true,
  readEntries: true,
  appSettings: true,
  extensionStores: true,
  sourceSettings: true,
  privateSettings: false,
})

/** `BackupOptions.Entry` (BackupOptions.kt:110-115) — label, getter, setter and an `enabled` predicate. */
interface BackupOption {
  key: keyof typeof options
  label: string
  enabled?: () => boolean
}

/** `BackupOptions.libraryOptions` (BackupOptions.kt:35-70) — order and `enabled` predicates. */
const libraryOptions: BackupOption[] = [
  { key: 'libraryEntries', label: 'Library entries' },
  { key: 'chapters', label: 'Chapters', enabled: () => options.libraryEntries },
  { key: 'tracking', label: 'Tracking', enabled: () => options.libraryEntries },
  { key: 'history', label: 'History', enabled: () => options.libraryEntries },
  { key: 'categories', label: 'Categories' },
  { key: 'readEntries', label: 'All read entries', enabled: () => options.libraryEntries },
]

/** `BackupOptions.settingsOptions` (BackupOptions.kt:72-94). */
const settingsOptions: BackupOption[] = [
  { key: 'appSettings', label: 'App settings' },
  { key: 'extensionStores', label: 'Extension stores' },
  { key: 'sourceSettings', label: 'Source settings' },
  {
    key: 'privateSettings',
    label: 'Include sensitive settings (e.g., tracker login tokens)',
    enabled: () => options.appSettings || options.sourceSettings,
  },
]

/** `BackupOptions.canCreate()` (BackupOptions.kt:32). */
const canCreate = computed(
  () => options.libraryEntries || options.categories || options.appSettings || options.extensionStores || options.sourceSettings,
)

function toggle(key: keyof typeof options, value: boolean) {
  options[key] = value
}

/** `BackupOptions.Entry.enabled` — the reference disables an entry through its `enabled` predicate. */
function isEnabled(entry: { enabled?: () => boolean }): boolean {
  return entry.enabled ? entry.enabled() : true
}

/**
 * `BackupCreator.getFilename()` (BackupCreator.kt:172-175):
 * `"${BuildConfig.APPLICATION_ID}_yyyy-MM-dd_HH-mm.tachibk"` with applicationId = "app.mihon".
 */
function backupFilename(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`
  return `app.mihon_${stamp}.tachibk`
}

const fileName = ref(backupFilename())

/** Stub dialog state for the Android-only document picker / backup writer. */
const stubOpen = ref(false)

/** Android toast (eu.kanade.tachiyomi.util.system.toast) for the transient messages. */
const toast = ref<string | null>(null)
let toastTimer: number | undefined
function showToast(message: string) {
  toast.value = message
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = null }, 3000)
}

function onCreate() {
  if (!canCreate.value) return
  /* The reference refuses to start a second backup while a manual job is running
   * (BackupCreateWorker.isManualJobRunning) and toasts "Backup is already in progress". */
  if (stubOpen.value) { showToast('Backup is already in progress'); return }
  fileName.value = backupFilename()
  stubOpen.value = true
}

function goBack() {
  if (typeof window.history.state?.back === 'string') { router.back(); return }
  void router.push('/settings/data')
}

onBeforeUnmount(() => {
  if (toastTimer) window.clearTimeout(toastTimer)
})
</script>

<template>
  <section class="create-backup" :class="{ 'create-backup--embedded': embedded }">
    <!-- AppBar.kt: TopAppBar (64.dp) with the up arrow and the screen title, pinned while scrolling. -->
    <header v-if="!embedded" class="create-backup-toolbar">
      <button class="create-backup-icon-button" type="button" aria-label="Back" @click="goBack">
        <v-icon icon="arrow_back" size="24" />
      </button>
      <h1 class="create-backup-title">Create backup</h1>
    </header>

    <!-- LazyColumnWithAction: scrolling list (weight 1) + divider + full width action button. -->
    <div class="create-backup-body">
      <div class="create-backup-list">
        <!-- SectionCard(label_library): title above the elevated card. -->
        <section class="create-backup-section">
          <h2 class="create-backup-section-title">Library</h2>
          <div class="create-backup-card">
            <div
              v-for="option in libraryOptions"
              :key="option.key"
              class="create-backup-option"
              :class="{ 'create-backup-option-disabled': !isEnabled(option) }"
              role="checkbox"
              :aria-checked="options[option.key]"
              :aria-disabled="isEnabled(option) ? undefined : 'true'"
              @click="isEnabled(option) && toggle(option.key, !options[option.key])"
            >
              <span class="create-backup-checkbox" :class="{ 'create-backup-checkbox-checked': options[option.key], 'create-backup-checkbox-disabled': !isEnabled(option) }">
                <span class="create-backup-checkbox-box">
                  <v-icon v-if="options[option.key]" icon="check" size="18" />
                </span>
              </span>
              <span class="create-backup-option-label">{{ option.label }}</span>
            </div>
          </div>
        </section>

        <!-- SectionCard(label_settings). -->
        <section class="create-backup-section">
          <h2 class="create-backup-section-title">Settings</h2>
          <div class="create-backup-card">
            <div
              v-for="option in settingsOptions"
              :key="option.key"
              class="create-backup-option"
              :class="{ 'create-backup-option-disabled': !isEnabled(option) }"
              role="checkbox"
              :aria-checked="options[option.key]"
              :aria-disabled="isEnabled(option) ? undefined : 'true'"
              @click="isEnabled(option) && toggle(option.key, !options[option.key])"
            >
              <span class="create-backup-checkbox" :class="{ 'create-backup-checkbox-checked': options[option.key], 'create-backup-checkbox-disabled': !isEnabled(option) }">
                <span class="create-backup-checkbox-box">
                  <v-icon v-if="options[option.key]" icon="check" size="18" />
                </span>
              </span>
              <span class="create-backup-option-label">{{ option.label }}</span>
            </div>
          </div>
        </section>
      </div>

      <!-- HorizontalDivider() + Button(fillMaxWidth, action_create). -->
      <div class="create-backup-action">
        <hr class="create-backup-divider" />
        <div class="create-backup-action-inner">
          <button class="create-backup-button" type="button" :disabled="!canCreate" @click="onCreate">Create</button>
        </div>
      </div>
    </div>

    <!-- Stub for the Android-only document picker + local database backup writer. -->
    <v-dialog v-model="stubOpen" max-width="560">
      <div class="create-backup-dialog">
        <h2 class="create-backup-dialog-title">Create backup</h2>
        <div class="create-backup-dialog-text">
          <p>
            Creating a backup is not supported in the web version: Mihon writes a
            <code>.tachibk</code> archive of its own local database through the system document
            picker, while this client keeps no local database and the Suwayomi REST API exposes no
            backup endpoint.
          </p>
          <p class="create-backup-dialog-file">
            The selected file would have been <strong>{{ fileName }}</strong>
          </p>
        </div>
        <div class="create-backup-dialog-actions">
          <button class="create-backup-dialog-button" type="button" @click="stubOpen = false">Cancel</button>
          <button class="create-backup-dialog-button" type="button" @click="stubOpen = false">OK</button>
        </div>
      </div>
    </v-dialog>

    <!-- Android toast (eu.kanade.tachiyomi.util.system.toast). -->
    <div v-if="toast" class="create-backup-toast" role="status" aria-live="polite">{{ toast }}</div>
  </section>
</template>

<style scoped>
@layer app-components {
.create-backup { display: flex; flex-direction: column; min-height: 100%; }

/* AppBar.kt: TopAppBar, 64.dp tall, container = surface at 0.dp elevation. */
.create-backup-toolbar {
  position: fixed;
  top: 0;
  inset-inline-start: var(--v-layout-left, 0px);
  inset-inline-end: var(--v-layout-right, 0px);
  z-index: 3;
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 4px 0 0;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}
/* IconButton: 40.dp container with a 24.dp icon. */
.create-backup-icon-button { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; margin: 0 4px; padding: 8px; border: none; border-radius: 20px; background: none; color: inherit; cursor: pointer; }
.create-backup-icon-button:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
/* AppBarTitle: titleLarge (22.sp / 28.sp, Regular). */
.create-backup-title { flex: 1 1 auto; min-width: 0; margin: 0; padding: 0 4px; font-size: 22px; line-height: 28px; font-weight: 400; color: rgb(var(--v-theme-on-surface)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* LazyColumnWithAction: Column(fillMaxSize) with the list taking the remaining height. */
.create-backup-body { flex: 1 1 auto; display: flex; flex-direction: column; min-height: calc(100dvh - 64px); padding-top: 64px; }
.create-backup--embedded .create-backup-body { min-height: auto; padding-top: 0; }
.create-backup-list { flex: 1 1 auto; overflow-y: auto; padding-bottom: 8px; }
.create-backup--embedded .create-backup-list { overflow-y: visible; }

/* SectionCard.kt: title (titleSmall) above an ElevatedCard (shapes.extraLarge) with 16.dp inner padding. */
/* The 8.dp vertical card padding is the only spacing between a card and the next section title. */
.create-backup-section-title { margin: 0; padding: 0 32px; font-size: 14px; line-height: 20px; font-weight: 500; letter-spacing: 0.1px; color: rgb(var(--v-theme-on-surface)); }
.create-backup-card { margin: 8px 16px; padding: 16px; border-radius: 28px; background: rgb(var(--v-theme-surface-container-low)); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15); }

/* LabeledCheckbox.kt: Row(min height 48.dp, spacedBy 8.dp, clip shapes.small) with a Checkbox and a Text. */
.create-backup-option { display: flex; align-items: center; gap: 8px; min-height: 48px; border-radius: 8px; cursor: pointer; }
.create-backup-option:active { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent); }
.create-backup-option-disabled { cursor: default; }
/* Material3 Checkbox: 18.dp box, 2.dp corner radius, 2.dp outline, 16.dp check icon. */
.create-backup-checkbox { flex: 0 0 auto; display: grid; place-items: center; width: 48px; height: 48px; }
.create-backup-checkbox-box { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 2px; border: 2px solid rgb(var(--v-theme-on-surface-variant)); background: transparent; color: rgb(var(--v-theme-on-primary)); }
.create-backup-checkbox-checked .create-backup-checkbox-box { border-color: rgb(var(--v-theme-primary)); background: rgb(var(--v-theme-primary)); }
.create-backup-checkbox-disabled .create-backup-checkbox-box { border-color: rgb(var(--v-theme-on-surface)); opacity: .38; }
.create-backup-checkbox-disabled .material-symbols-rounded { color: rgb(var(--v-theme-on-surface)); opacity: .38; }
/* Compose default Text style: bodyLarge (16.sp / 24.sp, letterSpacing 0.03125em). */
.create-backup-option-label { font-size: 16px; line-height: 24px; letter-spacing: 0.03125em; color: rgb(var(--v-theme-on-surface)); }
.create-backup-option-disabled .create-backup-option-label { color: rgb(var(--v-theme-on-surface)); opacity: .38; }

/* LazyColumnWithAction: HorizontalDivider() then Button(padding 16.dp horizontal / 8.dp vertical, fillMaxWidth). */
.create-backup-action { flex: 0 0 auto; background: rgb(var(--v-theme-surface)); }
.create-backup-action-inner { padding: 8px 16px; }
.create-backup-divider { margin: 0; border: 0; border-top: 1px solid rgb(var(--v-theme-outline-variant)); }
/* Material3 Button: 40.dp height, CornerFull (20.dp) shape, container primary, label labelLarge. */
.create-backup-button { box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: 100%; min-width: 58px; height: 40px; padding: 8px 24px; border: 0; border-radius: 20px; background: rgb(var(--v-theme-primary)); color: rgb(var(--v-theme-on-primary)); font-family: inherit; font-size: 14px; line-height: 20px; font-weight: 500; letter-spacing: 0.0071428571em; cursor: pointer; }
.create-backup-button:disabled { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent); color: rgb(var(--v-theme-on-surface)); opacity: .38; cursor: default; }
.create-backup-button:not(:disabled):hover { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }
.create-backup-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* MD3 AlertDialog: surface-container-high, CornerExtraLarge (28.dp), 24.dp content padding. */
.create-backup-dialog { box-sizing: border-box; width: fit-content; min-width: min(280px, calc(100vw - 48px)); max-width: min(560px, calc(100vw - 48px)); margin: 0 auto; padding: 24px; border-radius: 28px; background: rgb(var(--v-theme-surface-container-high)); color: rgb(var(--v-theme-on-surface)); box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px 0 rgba(0, 0, 0, 0.3); }
.create-backup-dialog-title { margin: 0 0 16px; font-size: 24px; line-height: 32px; font-weight: 400; color: rgb(var(--v-theme-on-surface)); }
.create-backup-dialog-text { margin-bottom: 24px; }
.create-backup-dialog-text p { margin: 0 0 16px; font-size: 14px; line-height: 20px; letter-spacing: 0.0071428571em; color: rgb(var(--v-theme-on-surface-variant)); }
.create-backup-dialog-text p:last-child { margin-bottom: 0; }
.create-backup-dialog-file { font-family: ui-monospace, monospace; }
.create-backup-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
.create-backup-dialog-button { height: 40px; min-width: 58px; padding: 0 12px; border: 0; border-radius: 20px; background: transparent; color: rgb(var(--v-theme-primary)); font-family: inherit; font-size: 14px; line-height: 20px; font-weight: 500; letter-spacing: 0.0071428571em; cursor: pointer; }
.create-backup-dialog-button:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }
.create-backup-dialog-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* Android toast: small dark rounded panel near the bottom of the screen. */
.create-backup-toast {
  position: fixed;
  left: calc((100% + var(--v-layout-left, 0px) - var(--v-layout-right, 0px)) / 2);
  bottom: calc(var(--v-layout-bottom, 0px) + 24px + env(safe-area-inset-bottom, 0px));
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
