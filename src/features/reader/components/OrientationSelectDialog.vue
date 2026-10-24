<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VBottomSheet, VDialog, VSnackbar } from 'vuetify/components'
import { useTabletUi } from '@/core/composables/useTabletUi'
import { useReaderStore } from '@/features/reader/stores/reader'
import { readPreference, writePreference } from '@/features/settings/stores/preferences'

/**
 * Mihon reference: eu/kanade/presentation/reader/OrientationSelectDialog.kt
 *  - AdaptiveSheet(onDismissRequest) { DialogContent(orientation, onChangeOrientation) }
 *  - DialogContent: `var selected by remember { mutableStateOf(orientation) }`,
 *      ModeSelectionDialog(
 *          onUseDefault = { onChangeOrientation(ReaderOrientation.DEFAULT) }.takeIf { orientation != ReaderOrientation.DEFAULT },
 *          onApply = { onChangeOrientation(selected) },
 *      ) { SettingsIconGrid(MR.strings.rotation_type) { items(ReaderOrientationsWithoutDefault) { IconToggleButton } } }
 *  - ModeSelectionDialog: Box(padding vertical 16.dp) { content(); Row(horizontal padding 24.dp) {
 *          OutlinedButton(MR.strings.action_revert_to_default)?, Spacer(weight 1f),
 *          FilledTonalButton(Icon(MaterialSymbols.Rounded.Check) + MR.strings.action_apply) } }
 *  - SettingsIconGrid: HeadingItem + LazyVerticalGrid(GridCells.Adaptive(128.dp), spacedBy 4.dp/8.dp, padding 24.dp/10.dp)
 *  - IconToggleButton: FilledIconToggleButton, height 48.dp, Row(spacedBy 8.dp, padding 8.dp) { Icon(24.dp), Text(maxLines 2) }
 *  - FilledIconToggleButton colors: unchecked = SurfaceContainer/OnSurfaceVariant, checked = Primary/OnPrimary
 *  - AdaptiveSheet mobile: Surface(widthIn(max 460.dp), shape extraLarge, color surfaceContainerHigh) at BottomCenter,
 *      navigationBarsPadding + statusBarsPadding, anchoredDraggable, positionalThreshold 56.dp, sheetAnimationSpec tween 350ms
 *  - AdaptiveSheet tablet: Surface(requiredWidthIn(max 460.dp) + systemBarsPadding + padding(vertical 16.dp)), centered
 *  - ReaderOrientation.kt: DEFAULT is excluded from the grid; FREE/PORTRAIT/LANDSCAPE/LOCKED_PORTRAIT/
 *      LOCKED_LANDSCAPE/REVERSE_PORTRAIT keep the enum order and the MaterialSymbols Rounded glyphs
 *      MobileRotate / Mobile / MobileLandscape / MobileLockPortrait / MobileLockLandscape / Mobile.
 */
type OrientationId = 'default' | 'free' | 'portrait' | 'landscape' | 'lockedPortrait' | 'lockedLandscape' | 'reversePortrait'
interface OrientationEntry { id: OrientationId, label: string, icon: string, flag: number, fixed?: boolean }

/** ReaderOrientation.entries - DEFAULT, in enum order, with the ReaderOrientation.kt icons. */
const ORIENTATIONS: OrientationEntry[] = [
  { id: 'free', label: 'Free', icon: 'mobile_rotate', flag: 0x00000008 },
  { id: 'portrait', label: 'Portrait', icon: 'mobile', flag: 0x00000010, fixed: true },
  { id: 'landscape', label: 'Landscape', icon: 'mobile_landscape', flag: 0x00000018, fixed: true },
  { id: 'lockedPortrait', label: 'Locked portrait', icon: 'mobile_lock_portrait', flag: 0x00000020, fixed: true },
  { id: 'lockedLandscape', label: 'Locked landscape', icon: 'mobile_lock_landscape', flag: 0x00000028, fixed: true },
  { id: 'reversePortrait', label: 'Reverse portrait', icon: 'mobile', flag: 0x00000030, fixed: true },
]
const DEFAULT_ORIENTATION: OrientationEntry = { id: 'default', label: 'Default', icon: 'mobile_rotate', flag: 0x00000000 }

const props = defineProps<{ mangaId?: number }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ (event: 'change', label: string): void }>()

const tablet = useTabletUi()
const reader = useReaderStore()
const selected = ref<OrientationId>('default')
const current = ref<OrientationId>('default')
const dragStart = ref<number | null>(null)
const toast = ref(''), toastOpen = ref(false)

/** The manga the orientation belongs to; Mihon stores it per manga (manga.readerOrientation). */
const mangaId = computed(() => props.mangaId ?? reader.manga?.id ?? 0)
const storageKey = computed(() => `mihon.reader.orientation.${mangaId.value}`)

function fromFlag(flag: number | null | undefined): OrientationId {
  if (typeof flag !== 'number') return 'default'
  const found = ORIENTATIONS.find(entry => entry.flag === flag)
  return found ? found.id : 'default'
}
/** Suwayomi REST v1 does not expose readerOrientation, so the browser value wins; the remote one is a fallback. */
function resolveOrientation(): OrientationId {
  const stored = readPreference(storageKey.value)
  if (stored !== null) return fromFlag(Number(stored))
  const remote = reader.manga?.readerOrientation
  return fromFlag(typeof remote === 'number' ? remote : null)
}
/** Mihon keeps the current value as the initial selection and only re-syncs while the dialog is open. */
watch(open, isOpen => { if (isOpen) { current.value = resolveOrientation(); selected.value = current.value } })
watch(storageKey, () => { if (open.value) { current.value = resolveOrientation(); selected.value = current.value } })

/** "Revert to default" is only offered when the current orientation is not the default one. */
const showRevert = computed(() => current.value !== 'default')
const selectedEntry = computed<OrientationEntry>(() => ORIENTATIONS.find(entry => entry.id === selected.value) ?? DEFAULT_ORIENTATION)
/**
 * Mihon drives the Android activity orientation (ActivityInfo.SCREEN_ORIENTATION_*). The browser only
 * exposes screen.orientation.lock(), which works in fullscreen only, so the notice states the limit.
 */
const notice = computed(() => selectedEntry.value.fixed
  ? 'A fixed screen orientation works in the fullscreen mode of the web version only. The choice is stored for this browser.'
  : 'The screen orientation follows the device in the web version. The choice is stored for this browser only.')
/** Screen Orientation API lock types matching the Android activity orientations. */
const LOCKS: Partial<Record<OrientationId, string>> = {
  portrait: 'portrait',
  landscape: 'landscape',
  lockedPortrait: 'portrait-primary',
  lockedLandscape: 'landscape-primary',
  reversePortrait: 'portrait-secondary',
}

function choose(id: OrientationId) { selected.value = id }

/** Applies the browser orientation lock that matches the Android activity orientation. */
async function applyOrientationLock(id: OrientationId): Promise<boolean> {
  const orientation = window.screen?.orientation as (ScreenOrientation & { lock?: (type: string) => Promise<void>, unlock?: () => void }) | undefined
  if (!orientation) return false
  const type = LOCKS[id]
  try {
    if (!type) {
      orientation.unlock?.()
      return true
    }
    if (typeof orientation.lock !== 'function') return false
    await orientation.lock(type)
    return true
  } catch {
    return false
  }
}
/** Applies the selection, like Mihon's onChangeOrientation + onDismissRequest + toast. */
async function commit(id: OrientationId) {
  const entry = id === 'default' ? DEFAULT_ORIENTATION : ORIENTATIONS.find(item => item.id === id) ?? DEFAULT_ORIENTATION
  if (entry.flag === 0x00000000) {
    try { localStorage.removeItem(storageKey.value) } catch { /* private mode: keep the in-memory selection */ }
  } else {
    writePreference(storageKey.value, String(entry.flag))
  }
  const locked = await applyOrientationLock(id)
  current.value = id
  selected.value = id
  open.value = false
  emit('change', entry.label)
  toast.value = entry.label
  toastOpen.value = true
  if (!locked && entry.fixed) toast.value = `${entry.label} — the orientation lock needs the fullscreen mode`
}
/** AdaptiveSheet mobile: the sheet is dismissed by dragging it down past the 56.dp positional threshold. */
function endDrag(event: TouchEvent) {
  if (!tablet.value && dragStart.value !== null && event.changedTouches[0]!.clientY - dragStart.value > 56) open.value = false
  dragStart.value = null
}
</script>

<template>
  <component :is="tablet ? VDialog : VBottomSheet" v-model="open" max-width="460" aria-label="Rotation" :class="{ 'osd-sheet': !tablet }">
    <v-card class="osd-card" :class="{ 'osd-card--mobile': !tablet, 'osd-card--tablet': tablet }" flat color="surface-container-high">
      <div class="osd-content" @touchstart="dragStart = $event.touches[0]!.clientY" @touchend="endDrag">
        <!-- HeadingItem(MR.strings.rotation_type): Typography.header = bodyMedium SemiBold, onSurfaceVariant, padding 10.dp/24.dp -->
        <h2 class="osd-heading">Rotation</h2>
        <!-- SettingsIconGrid: LazyVerticalGrid(GridCells.Adaptive(128.dp)), spacedBy 4.dp vertical, 8.dp horizontal, padding 24.dp/10.dp -->
        <div class="osd-grid" role="group" aria-label="Rotation">
          <button v-for="entry in ORIENTATIONS" :key="entry.id" type="button" class="osd-option" :class="{ 'osd-option--on': entry.id === selected }" :aria-pressed="entry.id === selected" :aria-describedby="entry.fixed ? 'osd-notice' : undefined" @click="choose(entry.id)">
            <span class="osd-option-body">
              <v-icon :icon="entry.icon" size="24" class="osd-option-icon" aria-hidden="true" />
              <span class="osd-option-label">{{ entry.label }}</span>
            </span>
          </button>
        </div>
        <!-- Web limitation notice: a real activity orientation lock has no full web counterpart. -->
        <p id="osd-notice" class="osd-notice" role="status">{{ notice }}</p>
        <!-- ModeSelectionDialog action Row: horizontal padding 24.dp, Spacer(weight 1f) -->
        <div class="osd-actions">
          <v-btn v-if="showRevert" variant="outlined" class="osd-revert" @click="commit('default')">Revert to default</v-btn>
          <span class="osd-spacer" />
          <v-btn variant="tonal" class="osd-apply" @click="commit(selected)">
            <v-icon icon="check" size="24" aria-hidden="true" />
            <span>Apply</span>
          </v-btn>
        </div>
      </div>
    </v-card>
  </component>
  <!-- ReaderActivity shows a toast with the new orientation name when the orientation changes. -->
  <v-snackbar v-model="toastOpen" :timeout="3000" color="surface-container-high" location="bottom">{{ toast }}</v-snackbar>
</template>

<style scoped>
@layer app-components {
/* AdaptiveSheet mobile: the Surface is at most 460.dp wide and sits at the bottom center. */
.osd-sheet { background: transparent; border-radius: 28px; }
.osd-sheet :deep(.v-sheet__content) { display: flex; justify-content: center; background: transparent; }
/* AdaptiveSheet Surface: shape extraLarge (28.dp), color surfaceContainerHigh, max width 460.dp. */
.osd-card { border-radius: 28px; max-height: 85dvh; }
.osd-card :deep(.v-card__underlay) { display: none; }
/* AdaptiveSheet mobile keeps the extraLarge shape on every corner and the navigation bar inset. */
.osd-card--mobile { border-radius: 28px; width: min(460px, 100%); margin: 0 auto; padding-bottom: env(safe-area-inset-bottom); }
/* AdaptiveSheet tablet: systemBarsPadding + padding(vertical 16.dp) around the centered Surface. */
.osd-card--tablet { width: 100%; margin: 16px 0; }
/* ModeSelectionDialog: Box(modifier = Modifier.padding(vertical = 16.dp)). */
.osd-content { display: flex; flex-direction: column; min-height: 0; padding: 16px 0; }
/* HeadingItem: Typography.header = bodyMedium (14sp/20sp) SemiBold, onSurfaceVariant, padding 10.dp/24.dp. */
.osd-heading { margin: 0; padding: 10px 24px; font-size: 14px; line-height: 20px; font-weight: 600; letter-spacing: .25px; color: rgb(var(--v-theme-on-surface-variant)); }
/* SettingsIconGrid: LazyVerticalGrid(GridCells.Adaptive(128.dp)), spacedBy 4.dp vertical, 8.dp horizontal, padding 24.dp/10.dp. */
.osd-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); column-gap: 8px; row-gap: 4px; padding: 0 24px 10px; overflow-y: auto; min-height: 0; scrollbar-width: none; }
.osd-grid::-webkit-scrollbar { display: none; }
/* IconToggleButton: FilledIconToggleButton, height 48.dp, shape = IconButtonDefaults.filledShape (round),
   colors = filledIconToggleButtonColors (unselected container surfaceContainer / content onSurfaceVariant,
   selected container primary / content onPrimary), Row(spacedBy 8.dp, padding 8.dp) { Icon(24.dp), Text(maxLines 2) }. */
.osd-option { height: 48px; width: 100%; min-width: 0; display: flex; align-items: center; padding: 0; border: 0; border-radius: 24px; background: rgb(var(--v-theme-surface-container)); color: rgb(var(--v-theme-on-surface-variant)); font: inherit; text-align: start; cursor: pointer; }
.osd-option:hover { background-image: linear-gradient(rgb(var(--v-theme-on-surface) / 0.08), rgb(var(--v-theme-on-surface) / 0.08)); }
.osd-option--on, .osd-option--on:hover { background: rgb(var(--v-theme-primary)); background-image: none; color: rgb(var(--v-theme-on-primary)); }
.osd-option--on:hover { background-image: linear-gradient(rgb(var(--v-theme-on-primary) / 0.08), rgb(var(--v-theme-on-primary) / 0.08)); }
.osd-option:focus-visible { outline: 3px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.osd-option-body { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; padding: 8px; box-sizing: border-box; }
.osd-option-icon { flex: 0 0 24px; width: 24px; height: 24px; display: block; }
.osd-option-label { min-width: 0; font-size: 16px; line-height: 24px; font-weight: 400; letter-spacing: .5px; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.osd-notice { margin: 0; padding: 0 24px 10px; font-size: 12px; line-height: 16px; color: rgb(var(--v-theme-on-surface-variant)); }
/* ModeSelectionDialog action Row: padding horizontal 24.dp, Spacer(weight 1f). */
.osd-actions { display: flex; align-items: center; padding: 0 24px; }
.osd-spacer { flex: 1 1 auto; }
/* OutlinedButton / FilledTonalButton: height 40.dp, shape 20.dp, labelLarge typography. */
.osd-revert, .osd-apply { height: 40px; border-radius: 20px; font-size: 14px; line-height: 20px; font-weight: 500; letter-spacing: .1px; text-transform: none; }
.osd-revert { border-color: rgb(var(--v-theme-outline)); color: rgb(var(--v-theme-primary)); }
.osd-apply { background: rgb(var(--v-theme-secondary-container)); color: rgb(var(--v-theme-on-secondary-container)); }
.osd-apply :deep(.v-btn__content) { gap: 8px; }
}
</style>
