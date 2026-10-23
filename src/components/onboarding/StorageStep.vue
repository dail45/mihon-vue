<script setup lang="ts">
/**
 * Pixel-parity port of `StorageStep` in
 * mihon/app/src/main/java/eu/kanade/presentation/more/onboarding/StorageStep.kt:30-89
 *
 *   internal class StorageStep : OnboardingStep {
 *       private var _isComplete by mutableStateOf(false)
 *       override val isComplete: Boolean get() = _isComplete
 *
 *       @Composable
 *       override fun Content() {
 *           val storagePref = remember { context.appGraph.storagePreferences.baseStorageDirectory }
 *           val pickStorageLocation = SettingsDataScreen.storageLocationPicker(storagePref)
 *
 *           Column(
 *               modifier = Modifier.padding(16.dp),
 *               verticalArrangement = Arrangement.spacedBy(MaterialTheme.padding.small),
 *           ) {
 *               Text(stringResource(MR.strings.onboarding_storage_info,
 *                   stringResource(MR.strings.app_name),
 *                   SettingsDataScreen.storageLocationText(storagePref)))
 *
 *               Button(modifier = Modifier.fillMaxWidth(), onClick = {
 *                   try { pickStorageLocation.launch(null) }
 *                   catch (e: ActivityNotFoundException) { context.toast(MR.strings.file_picker_error) }
 *               }) { Text(stringResource(MR.strings.onboarding_storage_action_select)) }
 *
 *               HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp),
 *                   color = MaterialTheme.colorScheme.onPrimaryContainer)
 *
 *               Text(stringResource(MR.strings.onboarding_storage_help_info, stringResource(MR.strings.app_name)))
 *               Button(modifier = Modifier.fillMaxWidth(),
 *                   onClick = { handler.openUri(SettingsDataScreen.HELP_URL) }) {
 *                   Text(stringResource(MR.strings.onboarding_storage_help_action))
 *               }
 *           }
 *
 *           LaunchedEffect(Unit) { storagePref.changes().collectLatest { _isComplete = storagePref.isSet() } }
 *       }
 *   }
 *
 * Metrics taken from the reference and from the pinned Mihon sources:
 * - Column padding 16dp (StorageStep.kt:46), vertical arrangement spacedBy
 *   `MaterialTheme.padding.small` = 8dp (Constants.kt:20).
 * - Default Compose `Text` style = MaterialTheme.typography.bodyLarge (16sp/24sp, tracking 0.5sp
 *   = 0.03125em) in the local content colour `onSurface`.
 * - `Button` = tachiyomi `Button` (presentation-core/.../material/Button.kt:87-131): a clickable
 *   `Surface` (not the MD3 Button widget), container `primary`, content `onPrimary`,
 *   label `labelLarge` (14sp/20sp, weight 500, letterSpacing 0.1sp = 0.0071428571em),
 *   minWidth 58dp, minHeight 40dp (M3ButtonDefaults.MinHeight), contentPadding =
 *   M3ButtonDefaults.ContentPadding (24dp horizontal / 8dp vertical), shape =
 *   M3ButtonDefaults.textShape = RoundedCornerShape(20dp), default elevation 0dp, hovered 1dp,
 *   pressed 0dp, disabled container onSurface@12%, disabled content onSurface@38%
 *   (Button.kt:143-180).
 * - `HorizontalDivider` (StorageStep.kt:70-73): vertical padding 8dp on top of the 8dp column gap,
 *   colour `onPrimaryContainer`; MD3 divider thickness 1dp.
 * - The step content is hosted by `InfoScreen` (presentation-core/.../screens/InfoScreen.kt:103-132)
 *   inside a `Box` painted with `surfaceVariant` and clipped to `MaterialTheme.shapes.small`
 *   (OnboardingScreen.kt:69-75), so the step itself paints no background.
 *
 * Strings (mihon/i18n/src/commonMain/moko-resources/base/strings.xml):
 * - onboarding_storage_info      = "Select a folder where %1$s will store chapter downloads, backups,
 *   and more.\n\nA dedicated folder is recommended.\n\nSelected folder: %2$s"  (L186)
 * - onboarding_storage_action_select = "Select a folder"   (L187)
 * - onboarding_storage_help_info = "Updating from an older version and not sure what to select? Refer
 *   to the storage guide for more information."  (L189)
 * - onboarding_storage_help_action = "Storage guide"  (L190)
 * - app_name = "Mihon"  (L3), no_location_set = "No storage location set" (L567),
 *   file_picker_error = "No file picker app found" (L1001)
 *
 * Web caveats (Android-only APIs):
 * - The reference picks a folder with the Android SAF
 *   (`ActivityResultContracts.OpenDocumentTree`, SettingsDataScreen.kt:113-142) and stores the
 *   granted URI in the app preferences, so `storageLocationText` can print the absolute path.
 *   The browser has no equivalent persistable tree grant and no absolute path, so the picker is
 *   approximated with the File System Access API (`showDirectoryPicker`) and the
 *   `webkitdirectory` file input fallback; only the folder *name* can be shown. When the browser
 *   exposes neither picker, the reference's `ActivityNotFoundException` branch is reproduced as a
 *   toast with `file_picker_error` ("No file picker app found").
 * - The actual chapter downloads, backups and the database live on Suwayomi-Server, so the
 *   selected folder is informational only; the web client keeps no local database (AGENTS.md).
 */
import { computed, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Text shown as "Selected folder: %2$s"; the reference shows the current SAF folder. */
    storageLocation?: string
    /** App name used in the info texts (%1$s). */
    appName?: string
  }>(),
  { storageLocation: 'No storage location set', appName: 'Mihon' },
)

/** `isComplete` of the reference step: true once a storage location has been set. */
const complete = defineModel<boolean>('complete', { default: false })

/** Storage guide URL, `SettingsDataScreen.HELP_URL` (SettingsDataScreen.kt:79). */
const HELP_URL = 'https://mihon.app/docs/faq/storage'

/** `MR.strings.no_location_set` (strings.xml:567). */
const NO_LOCATION_SET = 'No storage location set'

/** `MR.strings.file_picker_error` (strings.xml:1001). */
const FILE_PICKER_ERROR = 'No file picker app found'

const STORAGE_KEY = 'mihon-vue:onboarding:storage-location'

const stubOpen = ref(false)
const toastOpen = ref(false)
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

const fileInput = ref<HTMLInputElement | null>(null)

/** Folder chosen in the browser; overrides the prop when set. */
const selectedFolder = ref('')

/** `SettingsDataScreen.storageLocationText(storagePref)` (SettingsDataScreen.kt:145-159). */
const storageLocation = computed(() => selectedFolder.value || props.storageLocation)

const infoText = computed(
  () =>
    `Select a folder where ${props.appName} will store chapter downloads, backups, and more.\n\n` +
    'A dedicated folder is recommended.\n\n' +
    `Selected folder: ${storageLocation.value}`,
)
const helpText = computed(
  () =>
    `Updating from an older version and not sure what to select? Refer to the storage guide for ` +
    'more information.',
)

/** `storagePref.isSet()` - the step is complete once a folder has been chosen. */
watch(
  storageLocation,
  (value) => { complete.value = value !== NO_LOCATION_SET },
  { immediate: true },
)

function notify(message: string) {
  toast.value = message
  toastOpen.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastOpen.value = false }, 5000)
}

function persistLocation(name: string) {
  selectedFolder.value = name
  try {
    localStorage.setItem(STORAGE_KEY, name)
  } catch {
    /* storage may be unavailable */
  }
}

function useDefaultLocation() {
  persistLocation('Mihon')
}

/** `pickStorageLocation.launch(null)` (StorageStep.kt:61). */
async function pickStorageLocation() {
  const picker = (window as unknown as {
    showDirectoryPicker?: (options?: { id?: string; mode?: string }) => Promise<{ name: string }>
  }).showDirectoryPicker

  if (typeof picker === 'function') {
    try {
      const dir = await picker.call(window, { id: 'mihon-vue-storage', mode: 'readwrite' })
      if (dir?.name) persistLocation(dir.name)
      return
    } catch (error) {
      // The user dismissed the picker: nothing to report, the reference behaves the same way.
      if ((error as { name?: string })?.name === 'AbortError') return
      notify(FILE_PICKER_ERROR)
      stubOpen.value = true
      return
    }
  }

  // Fallback for browsers without the File System Access API: the directory upload input.
  if (typeof document !== 'undefined' && 'webkitdirectory' in document.createElement('input')) {
    fileInput.value?.click()
    return
  }

  // Reference branch: `catch (e: ActivityNotFoundException) { context.toast(file_picker_error) }`.
  notify(FILE_PICKER_ERROR)
  // The browser exposes no folder picker at all: show the explicit stub dialog.
  stubOpen.value = true
}

function onDirectoryChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const relativePath = file?.webkitRelativePath ?? ''
  const folder = relativePath.split('/')[0]
  if (folder) persistLocation(folder)
  input.value = ''
}

function openStorageGuide() {
  window.open(HELP_URL, '_blank', 'noopener,noreferrer')
}

onMounted(() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) persistLocation(stored)
  } catch {
    /* storage may be unavailable */
  }
})
</script>

<template>
  <!-- StorageStep.Content(): Column(padding = 16.dp) with Arrangement.spacedBy(8.dp). -->
  <div class="storage-step">
    <!-- Text(bodyLarge, onSurface) with the literal \n\n breaks of onboarding_storage_info. -->
    <p class="storage-step__text">{{ infoText }}</p>

    <!-- Button(Modifier.fillMaxWidth()): tachiyomi filled Surface button. -->
    <button type="button" class="storage-step__button" @click="pickStorageLocation">
      <span class="storage-step__button-label">Select a folder</span>
    </button>
    <button type="button" class="storage-step__button storage-step__button--tonal" @click="useDefaultLocation">
      <span class="storage-step__button-label">Use default folder</span>
    </button>

    <!-- HorizontalDivider: 1dp line, onPrimaryContainer, 8dp vertical padding (8dp column gap
         + 8dp divider padding on each side). -->
    <hr class="storage-step__divider" />

    <p class="storage-step__text">{{ helpText }}</p>

    <!-- Button(Modifier.fillMaxWidth()) opening SettingsDataScreen.HELP_URL. -->
    <button type="button" class="storage-step__button" @click="openStorageGuide">
      <span class="storage-step__button-label">Storage guide</span>
    </button>

    <!-- Fallback directory picker for browsers without the File System Access API. -->
    <input
      ref="fileInput"
      class="storage-step__file-input"
      type="file"
      webkitdirectory
      multiple
      aria-hidden="true"
      tabindex="-1"
      @change="onDirectoryChosen"
    />

    <!-- Reference: context.toast(MR.strings.file_picker_error). -->
    <v-snackbar v-model="toastOpen" :timeout="5000" color="inverse-surface" location="bottom">
      {{ toast }}
    </v-snackbar>

    <!-- Stub for the case where the browser exposes no folder picker at all. -->
    <v-dialog v-model="stubOpen" max-width="360">
      <v-card rounded="28px" color="surface-container-high">
        <v-card-title class="storage-step__dialog-title">Storage location</v-card-title>
        <v-card-text class="storage-step__dialog-text">
          Selecting a storage folder is not supported in this browser: there is no file picker
          available. Chapter downloads, backups and the database are stored by Suwayomi-Server.
        </v-card-text>
        <v-card-actions class="storage-step__dialog-actions">
          <v-spacer />
          <v-btn variant="text" color="primary" @click="useDefaultLocation(); stubOpen = false">Use default</v-btn>
          <v-btn variant="text" color="primary" @click="stubOpen = false">OK</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
@layer app-components {
  /* Column(padding = 16dp) + Arrangement.spacedBy(MaterialTheme.padding.small = 8dp). */
  .storage-step {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
  }

  /* Compose `Text` default style: MaterialTheme.typography.bodyLarge (16sp/24sp, weight 400,
     letterSpacing 0.5sp = 0.03125em) in the local content color `onSurface`. */
  .storage-step__text {
    margin: 0;
    font-family: Roboto, sans-serif;
    font-size: 16px;
    line-height: 24px;
    font-weight: 400;
    letter-spacing: 0.03125em;
    color: rgb(var(--v-theme-on-surface));
    white-space: pre-line;
  }

  /* tachiyomi `Button` (presentation-core/.../material/Button.kt:87-131): a clickable Surface,
     container `primary`, content `onPrimary`, label labelLarge (14sp/20sp, weight 500,
     letterSpacing 0.1sp = 0.0071428571em), minWidth 58dp / minHeight 40dp,
     contentPadding 24dp horizontal / 8dp vertical, shape = RoundedCornerShape(20dp),
     default elevation 0dp, hovered elevation 1dp, pressed elevation 0dp. */
  .storage-step__button {
    position: relative;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-width: 58px;
    height: 40px;
    padding: 8px 24px;
    border: 0;
    border-radius: 20px;
    background: rgb(var(--v-theme-primary));
    color: rgb(var(--v-theme-on-primary));
    font-family: Roboto, sans-serif;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    letter-spacing: 0.0071428571em;
    cursor: pointer;
    overflow: hidden;
    transition: box-shadow 0.15s ease-in-out, background-color 0.15s ease-in-out;
  }
  /* The label is painted above the state layer, as in Compose (the layer sits under the content). */
  .storage-step__button-label {
    position: relative;
    z-index: 1;
  }

  /* Compose Surface state layer: onPrimary at 8% on hover, 10% while pressed. */
  .storage-step__button::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgb(var(--v-theme-on-primary));
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.1s ease-out;
  }
  @media (hover: hover) {
    .storage-step__button:hover { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }
    .storage-step__button:hover::after { opacity: 0.08; }
  }
  .storage-step__button:active { box-shadow: none; }
  .storage-step__button:active::after { opacity: 0.1; }
  .storage-step__button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

  .storage-step__button--tonal {
    background: rgb(var(--v-theme-secondary-container));
    color: rgb(var(--v-theme-on-secondary-container));
  }
  .storage-step__button--tonal::after {
    background: rgb(var(--v-theme-on-secondary-container));
  }

  /* HorizontalDivider: 1dp thickness, color onPrimaryContainer, 8dp vertical padding. */
  .storage-step__divider {
    margin: 8px 0;
    border: 0;
    border-top: 1px solid rgb(var(--v-theme-on-primary-container));
  }

  /* Hidden fallback directory input. */
  .storage-step__file-input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* MD3 AlertDialog: surface-container-high, CornerExtraLarge (28dp), container padding 24dp,
     title headlineSmall (24sp/32sp) in on-surface, text bodyMedium (14sp/20sp) in
     on-surface-variant, actions right aligned, button labelLarge in primary. */
  .storage-step__dialog-title {
    font-size: 24px;
    line-height: 32px;
    font-weight: 400;
  }
  .storage-step__dialog-text {
    font-size: 14px;
    line-height: 20px;
    color: rgb(var(--v-theme-on-surface-variant));
  }
  .storage-step__dialog-actions {
    justify-content: flex-end;
  }
}
</style>
