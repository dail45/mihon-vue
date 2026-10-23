<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VBottomSheet, VDialog, VSnackbar } from 'vuetify/components'
import { useTabletUi } from '../../composables/useTabletUi'
import { useReaderPreferences, type ReadingMode as StoreMode } from '../../stores/readerPreferences'
import { useReaderStore } from '../../stores/reader'
import { readPreference, writePreference } from '../../stores/preferences'
import { READER_MODE_ICONS } from './readerIcons'

/**
 * Mihon reference: eu/kanade/presentation/reader/ReadingModeSelectDialog.kt
 *  - AdaptiveSheet(onDismissRequest) { DialogContent(readingMode, onChangeReadingMode) }
 *  - DialogContent: `var selected by remember { mutableStateOf(readingMode) }`,
 *      ModeSelectionDialog(
 *          onUseDefault = { onChangeReadingMode(ReadingMode.DEFAULT) }.takeIf { readingMode != ReadingMode.DEFAULT },
 *          onApply = { onChangeReadingMode(selected) },
 *      ) { SettingsIconGrid(MR.strings.pref_category_reading_mode) { items(ReadingModesWithoutDefault) { IconToggleButton } } }
 *  - ReadingModeSelectDialog.kt: `private val ReadingModesWithoutDefault = ReadingMode.entries - ReadingMode.DEFAULT`
 *      -> LEFT_TO_RIGHT, RIGHT_TO_LEFT, VERTICAL, WEBTOON, CONTINUOUS_VERTICAL, in enum order.
 *  - ReadingMode.kt: labels MR.strings.left_to_right_viewer / right_to_left_viewer / vertical_viewer /
 *      webtoon_viewer / vertical_plus_viewer, icons CustomMaterialSymbols.Rounded.ReaderLeftToRight /
 *      ReaderRightToLeft / ReaderVertical / ReaderLongStrip / ReaderLongStripGaps.
 *  - ModeSelectionDialog.kt: Box(padding vertical 16.dp) { content(); Row(horizontal padding 24.dp) {
 *          OutlinedButton(MR.strings.action_revert_to_default)?, Spacer(weight 1f),
 *          FilledTonalButton(Icon(MaterialSymbols.Rounded.Check) + MR.strings.action_apply) } }
 *  - SettingsIconGrid: HeadingItem + LazyVerticalGrid(GridCells.Adaptive(128.dp),
 *      spacedBy 4.dp vertical / 8.dp horizontal, padding 24.dp horizontal / 10.dp bottom)
 *  - IconToggleButton: FilledIconToggleButton, height 48.dp, Row(spacedBy 8.dp, padding 8.dp) {
 *      Icon(24.dp), Text(maxLines 2) }; toggle button text style = labelLarge (14sp/20sp Medium).
 *      MD3 styling: inactive with outline (outline-variant), active with secondaryContainer container
 *      and onSecondaryContainer content.
 *  - AdaptiveSheet (presentation-core): tablet -> centered Surface(widthIn max 460.dp, shape extraLarge,
 *      color surfaceContainerHigh, systemBarsPadding + padding vertical 16.dp);
 *      phone -> Surface(widthIn max 460.dp) at BottomCenter, shape extraLarge, anchoredDraggable,
 *      positionalThreshold 56.dp, sheetAnimationSpec tween 350ms, navigationBarsPadding + statusBarsPadding.
 *  - ReaderActivity.kt: after the mode changes the reader toasts the mode name (ReadingMode.stringRes).
 */

type ModeId = 'ltr' | 'rtl' | 'vertical' | 'webtoon' | 'continuous'
/** Mihon's ReadingMode.DEFAULT is a state of its own and is not part of the grid. */
type Selection = ModeId | 'default'
interface ModeEntry { id: ModeId, label: string, path: string, store?: StoreMode, unsupported?: string }

const props = defineProps<{
  mangaId?: number
}>()

/** ReadingMode.entries - ReadingMode.DEFAULT, in Mihon enum order. */
const modes: ModeEntry[] = [
  { id: 'ltr', label: 'Paged (left to right)', path: READER_MODE_ICONS.ltr, store: 'ltr' },
  { id: 'rtl', label: 'Paged (right to left)', path: READER_MODE_ICONS.rtl, store: 'rtl' },
  { id: 'vertical', label: 'Paged (vertical)', path: READER_MODE_ICONS.vertical, unsupported: 'Paged (vertical) is not supported in the web version. Use a paged left-to-right or right-to-left mode, or the long strip.' },
  { id: 'webtoon', label: 'Long strip', path: READER_MODE_ICONS.webtoon, store: 'webtoon' },
  { id: 'continuous', label: 'Long strip with gaps', path: READER_MODE_ICONS.continuous, unsupported: 'Long strip with gaps is not supported in the web version. Use the long strip instead.' },
]

/**
 * Mihon's ReadingMode.DEFAULT is a separate state that resolves to the app default reading mode
 * (flag 0x00000000), distinct from LEFT_TO_RIGHT (0x00000001). The web reader store keeps only
 * explicit modes, so the default state is tracked next to it and resolves to paged left-to-right.
 */
const DEFAULT_MODE: StoreMode = 'ltr'
const DEFAULT_KEY = 'mihon.reader.mode.default'

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ (event: 'change', label: string): void }>()
const preferences = useReaderPreferences()
const reader = useReaderStore()
const tablet = useTabletUi()
const selected = ref<Selection>('default')
const dragStart = ref<number | null>(null)
const toast = ref(''), toastOpen = ref(false)

const mangaId = computed(() => props.mangaId ?? reader.manga?.id ?? 0)
const storageKey = computed(() => `mihon.reader.mode.${mangaId.value}`)

/**
 * Resolves the current reading mode matching Mihon's `ReadingMode.fromPreference(manga?.readingMode?.toInt())`:
 * If manga has a specific reading mode override, returns that ModeId.
 * If manga follows ReadingMode.DEFAULT (or no override set), returns null.
 */
function resolveCurrentMode(): ModeId | null {
  if (mangaId.value > 0) {
    const stored = readPreference(storageKey.value)
    if (stored && stored !== 'default') {
      const found = modes.find(m => m.id === stored || m.store === stored)
      if (found) return found.id
    }
    return null
  }
  if (readPreference(DEFAULT_KEY) === 'true') return null
  return modes.find(m => m.store === preferences.mode)?.id ?? null
}

const currentId = computed<ModeId | null>(() => resolveCurrentMode())
const isDefault = computed(() => currentId.value === null)
const selectedMode = computed<ModeEntry | null>(() => modes.find(mode => mode.id === selected.value) ?? null)

/** ModeSelectionDialog renders "Revert to default" only when the current mode is not the default one. */
const showRevert = computed(() => !isDefault.value)

watch(open, isOpen => {
  if (isOpen) {
    selected.value = currentId.value ?? 'default'
  }
})

watch(storageKey, () => {
  if (open.value) {
    selected.value = currentId.value ?? 'default'
  }
})

function choose(mode: ModeEntry) {
  selected.value = mode.id
}

/**
 * Applies the selection, like Mihon's onChangeReadingMode + onDismissRequest.
 * Mihon applies the picked mode and closes the sheet, then the reader toasts the mode name.
 */
function apply() {
  // Selecting nothing means keeping ReadingMode.DEFAULT, like Mihon's `onApply` on an untouched grid.
  if (selected.value === 'default') {
    revert()
    return
  }
  const mode = selectedMode.value!
  if (!mode.store) {
    // Web limitation: the mode exists in Mihon, but the web reader has no viewer for it.
    toast.value = mode.unsupported ?? 'This reading mode is not available in the web version.'
    toastOpen.value = true
    return
  }
  if (mangaId.value > 0) {
    writePreference(storageKey.value, mode.id)
  }
  writePreference(DEFAULT_KEY, 'false')
  preferences.mode = mode.store
  emit('change', mode.label)
  toast.value = mode.label
  toastOpen.value = true
  open.value = false
}

/** Reverts to the default reading mode, like Mihon's onUseDefault branch. */
function revert() {
  if (mangaId.value > 0) {
    try {
      localStorage.removeItem(storageKey.value)
    } catch {
      writePreference(storageKey.value, 'default')
    }
  }
  writePreference(DEFAULT_KEY, 'true')
  preferences.mode = DEFAULT_MODE
  emit('change', 'Default')
  toast.value = 'Default'
  toastOpen.value = true
  open.value = false
}

/** AdaptiveSheet phone: the sheet is dismissed by dragging it down past the 56.dp positional threshold. */
function endDrag(event: TouchEvent) {
  if (!tablet.value && dragStart.value !== null && event.changedTouches[0]!.clientY - dragStart.value > 56) open.value = false
  dragStart.value = null
}
</script>

<template>
  <component :is="tablet ? VDialog : VBottomSheet" v-model="open" max-width="460" aria-label="Reading mode" :class="{ 'rmd-sheet': !tablet }">
    <v-card class="rmd-card" :class="{ 'rmd-card--mobile': !tablet, 'rmd-card--tablet': tablet }" flat color="surface-container-high">
      <div class="rmd-content" @touchstart="dragStart = $event.touches[0]!.clientY" @touchend="endDrag">
        <!-- HeadingItem(MR.strings.pref_category_reading_mode): Typography.header = bodyMedium SemiBold, onSurfaceVariant, padding 10.dp/24.dp -->
        <h2 class="rmd-heading">Reading mode</h2>
        <!-- SettingsIconGrid: LazyVerticalGrid(GridCells.Adaptive(128.dp)), spacedBy 4.dp vertical / 8.dp horizontal, padding 24.dp/10.dp -->
        <div class="rmd-grid" role="group" aria-label="Reading mode">
          <button
            v-for="mode in modes"
            :key="mode.id"
            type="button"
            class="rmd-option"
            :class="{ 'rmd-option--on': mode.id === selected }"
            :aria-pressed="mode.id === selected"
            :aria-label="mode.label"
            @click="choose(mode)"
          >
            <span class="rmd-option-body">
              <svg class="rmd-option-icon" viewBox="0 -960 960 960" width="24" height="24" aria-hidden="true"><path :d="mode.path" fill="currentColor" /></svg>
              <span class="rmd-option-label">{{ mode.label }}</span>
            </span>
          </button>
        </div>
        <!-- ModeSelectionDialog action Row: horizontal padding 24.dp, Spacer(weight 1f) -->
        <div class="rmd-actions">
          <v-btn v-if="showRevert" variant="outlined" class="rmd-revert" @click="revert">Revert to default</v-btn>
          <span class="rmd-spacer" />
          <v-btn variant="tonal" class="rmd-apply" @click="apply">
            <v-icon icon="check" size="24" aria-hidden="true" />
            <span>Apply</span>
          </v-btn>
        </div>
      </div>
    </v-card>
  </component>
  <!-- ReaderActivity.kt shows a toast with the new mode name when the reading mode changes. -->
  <v-snackbar v-model="toastOpen" :timeout="3000" color="surface-container-high" location="bottom">{{ toast }}</v-snackbar>
</template>

<style scoped>
@layer app-components {
/* AdaptiveSheet phone: the Surface is at most 460.dp wide and sits at the bottom center. */
.rmd-sheet { background: transparent; border-radius: 28px; }
.rmd-sheet :deep(.v-sheet__content) { display: flex; justify-content: center; background: transparent; }
/* AdaptiveSheet Surface: shape extraLarge (28.dp), color surfaceContainerHigh, max width 460.dp. */
.rmd-card { border-radius: 28px; max-width: 460px; margin: 0 auto; max-height: 85dvh; }
.rmd-card :deep(.v-card__underlay) { display: none; }
/* AdaptiveSheet phone keeps the extraLarge shape on every corner and the navigation bar inset. */
.rmd-card--mobile { border-radius: 28px !important; width: min(460px, 100%); margin: 0 auto; padding-bottom: env(safe-area-inset-bottom); }
/* AdaptiveSheet tablet: systemBarsPadding + padding(vertical 16.dp) around the centered Surface. */
.rmd-card--tablet { width: 100%; margin: 16px 0; }
/* ModeSelectionDialog: Box(modifier = Modifier.padding(vertical = 16.dp)). */
.rmd-content { display: flex; flex-direction: column; min-height: 0; padding: 16px 0; }
/* HeadingItem: bodyMedium (14sp/20sp) SemiBold, onSurfaceVariant, padding 10.dp/24.dp. */
.rmd-heading { margin: 0; padding: 10px 24px; font-size: 14px; line-height: 20px; font-weight: 600; letter-spacing: .25px; color: rgb(var(--v-theme-on-surface-variant)); }
/* SettingsIconGrid: LazyVerticalGrid(GridCells.Adaptive(128.dp)), spacedBy 4.dp vertical, 8.dp horizontal, padding 24.dp/10.dp. */
.rmd-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); column-gap: 8px; row-gap: 4px; padding: 0 24px 10px; overflow-y: auto; min-height: 0; scrollbar-width: none; }
.rmd-grid::-webkit-scrollbar { display: none; }
/* IconToggleButton: FilledIconToggleButton, height 48.dp, shape = IconButtonDefaults.filledShape (corner full),
   MD3 styling:
   - Inactive: outline (контур) 1px outline-variant, background transparent, color onSurfaceVariant
   - Active: container secondaryContainer, color onSecondaryContainer, border-color transparent
   Row(spacedBy 8.dp, padding 8.dp) { Icon(24.dp), Text(maxLines 2) }. */
.rmd-option {
  height: 48px;
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  padding: 0;
  border: 1px solid rgb(var(--v-theme-outline-variant));
  border-radius: 24px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  font: inherit;
  text-align: start;
  cursor: pointer;
  box-sizing: border-box;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}
.rmd-option:hover { background-image: linear-gradient(rgb(var(--v-theme-on-surface) / 0.08), rgb(var(--v-theme-on-surface) / 0.08)); }
.rmd-option:active { background-image: linear-gradient(rgb(var(--v-theme-on-surface) / 0.12), rgb(var(--v-theme-on-surface) / 0.12)); }
.rmd-option--on, .rmd-option--on:hover {
  background: rgb(var(--v-theme-secondary-container));
  border-color: transparent;
  color: rgb(var(--v-theme-on-secondary-container));
}
.rmd-option--on:hover { background-image: linear-gradient(rgb(var(--v-theme-on-secondary-container) / 0.08), rgb(var(--v-theme-on-secondary-container) / 0.08)); }
.rmd-option--on:active { background-image: linear-gradient(rgb(var(--v-theme-on-secondary-container) / 0.12), rgb(var(--v-theme-on-secondary-container) / 0.12)); }
.rmd-option:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.rmd-option-body { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; padding: 8px; box-sizing: border-box; }
.rmd-option-icon { flex: 0 0 24px; width: 24px; height: 24px; display: block; }
/* IconToggleButton provides LocalTextStyle = MaterialTheme.typography.labelLarge (14sp/20sp, Medium). */
.rmd-option-label { min-width: 0; font-size: 14px; line-height: 20px; font-weight: 500; letter-spacing: .1px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
/* ModeSelectionDialog action Row: padding horizontal 24.dp, Spacer(weight 1f). */
.rmd-actions { display: flex; align-items: center; padding: 0 24px; }
.rmd-spacer { flex: 1 1 auto; }
/* OutlinedButton / FilledTonalButton: height 40.dp, shape 20.dp, labelLarge typography. */
.rmd-revert, .rmd-apply { height: 40px; border-radius: 20px; font-size: 14px; line-height: 20px; font-weight: 500; letter-spacing: .1px; text-transform: none; }
.rmd-revert { border-color: rgb(var(--v-theme-outline)); color: rgb(var(--v-theme-primary)); }
.rmd-apply { background: rgb(var(--v-theme-secondary-container)); color: rgb(var(--v-theme-on-secondary-container)); }
.rmd-apply :deep(.v-btn__content) { gap: 8px; }
}
</style>
