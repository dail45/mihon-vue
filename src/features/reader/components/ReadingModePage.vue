<script setup lang="ts">
/**
 * Mihon reference: eu/kanade/presentation/reader/settings/ReadingModePage.kt
 * Additional references: ReadingMode.kt, ReaderOrientation.kt, ReaderPreferences.kt, SettingsItems.kt, Pill.kt
 *
 * ColumnScope.ReadingModePage(viewModel: ReaderSettingsViewModel)
 *
 * Structure:
 * 1. HeadingItem(MR.strings.pref_category_for_this_series) -> "For this series"
 * 2. SettingsChipRow(MR.strings.pref_category_reading_mode) -> "Reading mode"
 *    - ReadingMode.entries:
 *      * DEFAULT ("Default")
 *      * LEFT_TO_RIGHT ("Paged (left to right)")
 *      * RIGHT_TO_LEFT ("Paged (right to left)")
 *      * VERTICAL ("Paged (vertical)")
 *      * WEBTOON ("Long strip")
 *      * CONTINUOUS_VERTICAL ("Long strip with gaps")
 * 3. SettingsChipRow(MR.strings.rotation_type) -> "Rotation"
 *    - ReaderOrientation.entries:
 *      * DEFAULT ("Default")
 *      * FREE ("Free")
 *      * PORTRAIT ("Portrait")
 *      * LANDSCAPE ("Landscape")
 *      * LOCKED_PORTRAIT ("Locked portrait")
 *      * LOCKED_LANDSCAPE ("Locked landscape")
 *      * REVERSE_PORTRAIT ("Reverse portrait")
 * 4. if (viewer is WebtoonViewer) WebtoonViewerSettings(viewModel) else PagerViewerSettings(viewModel)
 *
 * WebtoonViewerSettings:
 *   - HeadingItem(MR.strings.webtoon_viewer) -> "Long strip"
 *   - TapZonesItems:
 *     * SettingsChipRow(MR.strings.pref_viewer_nav) -> "Tap zones" (Default, L shaped, Kindle-ish, Edge, Right and Left, Disabled)
 *     * if (selected != 5) SettingsChipRow(MR.strings.pref_read_with_tapping_inverted) -> "Invert tap zones" (None, Horizontal, Vertical, Both)
 *   - SliderItem(pref_webtoon_side_padding, 0..25, pillColor = surfaceContainerHighest) -> "Side padding", valueString = "%d%%"
 *   - CheckboxItem(pref_crop_borders) -> "Crop borders" (cropBordersWebtoon)
 *   - CheckboxItem(pref_dual_page_split) -> "Split wide pages" (dualPageSplitWebtoon)
 *   - if (dualPageSplitWebtoon) CheckboxItem(pref_dual_page_invert) -> "Invert split page placement" (dualPageInvertWebtoon)
 *   - CheckboxItem(pref_page_rotate) -> "Rotate wide pages to fit" (dualPageRotateToFitWebtoon)
 *   - if (dualPageRotateToFitWebtoon) CheckboxItem(pref_page_rotate_invert) -> "Flip orientation of rotated wide pages" (dualPageRotateToFitInvertWebtoon)
 *   - CheckboxItem(pref_double_tap_zoom) -> "Double tap to zoom" (webtoonDoubleTapZoomEnabled)
 *   - CheckboxItem(pref_webtoon_disable_zoom_out) -> "Disable zoom out" (webtoonDisableZoomOut)
 *
 * PagerViewerSettings:
 *   - HeadingItem(MR.strings.pager_viewer) -> "Paged"
 *   - TapZonesItems:
 *     * SettingsChipRow(MR.strings.pref_viewer_nav) -> "Tap zones" (Default, L shaped, Kindle-ish, Edge, Right and Left, Disabled)
 *     * if (selected != 5) SettingsChipRow(MR.strings.pref_read_with_tapping_inverted) -> "Invert tap zones" (None, Horizontal, Vertical, Both)
 *   - SettingsChipRow(MR.strings.pref_image_scale_type) -> "Scale type" (Fit screen, Stretch, Fit width, Fit height, Original size, Smart fit)
 *   - SettingsChipRow(MR.strings.pref_zoom_start) -> "Zoom start position" (Automatic, Left, Right, Center)
 *   - CheckboxItem(pref_crop_borders) -> "Crop borders" (cropBorders)
 *   - CheckboxItem(pref_landscape_zoom) -> "Automatically zoom into wide images" (landscapeZoom)
 *   - CheckboxItem(pref_navigate_pan) -> "Pan wide images" (navigateToPan)
 *   - CheckboxItem(pref_dual_page_split) -> "Split wide pages" (dualPageSplitPaged)
 *   - if (dualPageSplitPaged) CheckboxItem(pref_dual_page_invert) -> "Invert split page placement" (dualPageInvertPaged)
 *   - CheckboxItem(pref_page_rotate) -> "Rotate wide pages to fit" (dualPageRotateToFit)
 *   - if (dualPageRotateToFit) CheckboxItem(pref_page_rotate_invert) -> "Flip orientation of rotated wide pages" (dualPageRotateToFitInvert)
 */
import { computed, onMounted, ref, watch } from 'vue'
import Md3Slider from '@/core/components/Md3Slider.vue'
import { useReaderPreferences } from '@/features/reader/stores/readerPreferences'
import { useReaderStore } from '@/features/reader/stores/reader'
import { readPreference, writePreference } from '@/features/settings/stores/preferences'

const props = defineProps<{
  mangaId?: number
}>()

const emit = defineEmits<{
  (e: 'change-mode'): void
}>()

const readerPreferences = useReaderPreferences()
const readerStore = useReaderStore()

const currentMangaId = computed(() => props.mangaId ?? readerStore.manga?.id ?? 0)
const mangaModeKey = computed(() => `mihon.reader.mode.${currentMangaId.value}`)
const mangaOrientationKey = computed(() => `mihon.reader.orientation.${currentMangaId.value}`)

// --- Persistence Helpers -----------------------------------------------------------------
function persistedStr(key: string, fallback: string) {
  const stored = readPreference(key)
  const val = ref(stored === null ? fallback : stored)
  watch(val, v => writePreference(key, v))
  return val
}

function persistedInt(key: string, fallback: number) {
  const stored = readPreference(key)
  const parsed = stored === null ? Number.NaN : Number(stored)
  const val = ref(Number.isFinite(parsed) ? parsed : fallback)
  watch(val, v => writePreference(key, String(v)))
  return val
}

function persistedBool(key: string, fallback: boolean) {
  const stored = readPreference(key)
  const val = ref(stored === null ? fallback : stored === 'true')
  watch(val, v => writePreference(key, String(v)))
  return val
}

function hapticTick() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(10)
    } catch {
      // ignore
    }
  }
}

// --- Toast / Feedback --------------------------------------------------------------------
const toastMessage = ref('')
const toastVisible = ref(false)
function showToast(msg: string) {
  toastMessage.value = msg
  toastVisible.value = true
}

// --- Section 1 & 2: ReadingMode.entries --------------------------------------------------
type ReadingModeVal = 'default' | 'ltr' | 'rtl' | 'vertical' | 'webtoon' | 'continuous'
interface ChipItem<T> {
  label: string
  value: T
}

const readingModeChips: ChipItem<ReadingModeVal>[] = [
  { label: 'Default', value: 'default' },
  { label: 'Paged (left to right)', value: 'ltr' },
  { label: 'Paged (right to left)', value: 'rtl' },
  { label: 'Paged (vertical)', value: 'vertical' },
  { label: 'Long strip', value: 'webtoon' },
  { label: 'Long strip with gaps', value: 'continuous' },
]

// Resolve initial reading mode selection
function resolveInitialMode(): ReadingModeVal {
  if (currentMangaId.value > 0) {
    const stored = readPreference(mangaModeKey.value)
    if (stored && stored !== 'default') {
      const match = readingModeChips.find(c => c.value === stored)
      if (match) return match.value
    }
    return 'default'
  }
  const globalMode = readerPreferences.mode
  return globalMode === 'webtoon' ? 'webtoon' : globalMode === 'rtl' ? 'rtl' : 'ltr'
}

const selectedReadingMode = ref<ReadingModeVal>(resolveInitialMode())

watch(mangaModeKey, () => {
  selectedReadingMode.value = resolveInitialMode()
})

function onSelectReadingMode(mode: ReadingModeVal) {
  selectedReadingMode.value = mode
  if (currentMangaId.value > 0) {
    writePreference(mangaModeKey.value, mode)
  }

  if (mode === 'default') {
    // Follow global default mode
    const globalMode = readerPreferences.mode
    if (globalMode === 'ltr' || globalMode === 'rtl' || globalMode === 'webtoon') {
      // already aligned
    }
  } else if (mode === 'ltr' || mode === 'rtl' || mode === 'webtoon') {
    readerPreferences.mode = mode
  } else if (mode === 'vertical') {
    showToast('Paged (vertical) is not supported in the web version.')
  } else if (mode === 'continuous') {
    showToast('Long strip with gaps is not supported in the web version.')
  }
  emit('change-mode')
}

// The reference checks `if (viewer is WebtoonViewer)`:
const isWebtoonViewer = computed(() => {
  if (selectedReadingMode.value === 'webtoon' || selectedReadingMode.value === 'continuous') {
    return true
  }
  if (selectedReadingMode.value === 'default') {
    return readerPreferences.mode === 'webtoon'
  }
  return false
})

// --- Section 3: ReaderOrientation.entries ------------------------------------------------
type OrientationVal = 'default' | 'free' | 'portrait' | 'landscape' | 'lockedPortrait' | 'lockedLandscape' | 'reversePortrait'

const orientationChips: ChipItem<OrientationVal>[] = [
  { label: 'Default', value: 'default' },
  { label: 'Free', value: 'free' },
  { label: 'Portrait', value: 'portrait' },
  { label: 'Landscape', value: 'landscape' },
  { label: 'Locked portrait', value: 'lockedPortrait' },
  { label: 'Locked landscape', value: 'lockedLandscape' },
  { label: 'Reverse portrait', value: 'reversePortrait' },
]

function resolveInitialOrientation(): OrientationVal {
  if (currentMangaId.value > 0) {
    const stored = readPreference(mangaOrientationKey.value)
    if (stored) {
      const match = orientationChips.find(c => c.value === stored)
      if (match) return match.value
    }
  }
  const globalOrientation = readPreference('mihon.reader.rotation')
  if (globalOrientation) {
    const match = orientationChips.find(c => c.value === globalOrientation)
    if (match) return match.value
  }
  return 'default'
}

const selectedOrientation = ref<OrientationVal>(resolveInitialOrientation())

watch(mangaOrientationKey, () => {
  selectedOrientation.value = resolveInitialOrientation()
})

const LOCK_MAP: Partial<Record<OrientationVal, string>> = {
  portrait: 'portrait',
  landscape: 'landscape',
  lockedPortrait: 'portrait-primary',
  lockedLandscape: 'landscape-primary',
  reversePortrait: 'portrait-secondary',
}

async function applyOrientationLock(orient: OrientationVal) {
  const orientApi = typeof screen !== 'undefined' ? (screen.orientation as any) : null
  if (!orientApi || typeof orientApi.lock !== 'function') return
  try {
    const lockType = LOCK_MAP[orient]
    if (lockType && document.fullscreenElement) {
      await orientApi.lock(lockType)
    } else if (orient === 'default' || orient === 'free') {
      orientApi.unlock?.()
    }
  } catch {
    // Screen orientation lock may fail without fullscreen or permission
  }
}

function onSelectOrientation(val: OrientationVal) {
  selectedOrientation.value = val
  if (currentMangaId.value > 0) {
    writePreference(mangaOrientationKey.value, val)
  }
  writePreference('mihon.reader.rotation', val)
  void applyOrientationLock(val)
}

// --- Tap Zones & Invert Tap Zones --------------------------------------------------------
// ReaderPreferences.TapZones: Default (0), L shaped (1), Kindle-ish (2), Edge (3), Right and Left (4), Disabled (5)
const tapZoneChips: ChipItem<number>[] = [
  { label: 'Default', value: 0 },
  { label: 'L shaped', value: 1 },
  { label: 'Kindle-ish', value: 2 },
  { label: 'Edge', value: 3 },
  { label: 'Right and Left', value: 4 },
  { label: 'Disabled', value: 5 },
]

// ReaderPreferences.TappingInvertMode: None, Horizontal, Vertical, Both
const tapInvertChips: ChipItem<string>[] = [
  { label: 'None', value: 'none' },
  { label: 'Horizontal', value: 'horizontal' },
  { label: 'Vertical', value: 'vertical' },
  { label: 'Both', value: 'both' },
]

const tapZonePager = persistedInt('mihon.reader.tapZonePager', 0)
const tapInvertPager = persistedStr('mihon.reader.tapInvertPager', 'none')
const tapZoneWebtoon = persistedInt('mihon.reader.tapZoneWebtoon', 0)
const tapInvertWebtoon = persistedStr('mihon.reader.tapInvertWebtoon', 'none')

watch(tapInvertPager, v => {
  if (!isWebtoonViewer.value) {
    writePreference('mihon.reader.tappingInverted', v)
  }
})
watch(tapInvertWebtoon, v => {
  if (isWebtoonViewer.value) {
    writePreference('mihon.reader.tappingInverted', v)
  }
})

// --- Pager Viewer Settings ---------------------------------------------------------------
// ReaderPreferences.ImageScaleType: Fit screen (1), Stretch (2), Fit width (3), Fit height (4), Original size (5), Smart fit (6)
const scaleTypeChips: ChipItem<number>[] = [
  { label: 'Fit screen', value: 1 },
  { label: 'Stretch', value: 2 },
  { label: 'Fit width', value: 3 },
  { label: 'Fit height', value: 4 },
  { label: 'Original size', value: 5 },
  { label: 'Smart fit', value: 6 },
]
const scaleType = persistedInt('mihon.reader.scaleType', readerPreferences.fit === 'width' ? 3 : 1)
watch(scaleType, v => {
  readerPreferences.fit = v === 3 ? 'width' : 'page'
})

// ReaderPreferences.ZoomStart: Automatic (1), Left (2), Right (3), Center (4)
const zoomStartChips: ChipItem<number>[] = [
  { label: 'Automatic', value: 1 },
  { label: 'Left', value: 2 },
  { label: 'Right', value: 3 },
  { label: 'Center', value: 4 },
]
const zoomStart = persistedInt('mihon.reader.zoomStart', 1)

// Pager Checkboxes
const cropBorders = persistedBool('mihon.reader.cropBorders', false)
watch(cropBorders, v => {
  readerPreferences.crop = v
})
const landscapeZoom = persistedBool('mihon.reader.landscapeZoom', true)
const navigateToPan = persistedBool('mihon.reader.navigateToPan', true)
const dualPageSplitPaged = persistedBool('mihon.reader.dualPageSplitPaged', false)
const dualPageInvertPaged = persistedBool('mihon.reader.dualPageInvertPaged', false)
const dualPageRotateToFit = persistedBool('mihon.reader.dualPageRotateToFit', false)
const dualPageRotateToFitInvert = persistedBool('mihon.reader.dualPageRotateToFitInvert', false)

// --- Webtoon Viewer Settings -------------------------------------------------------------
const webtoonSidePadding = persistedInt('mihon.reader.webtoonPadding', 0)
const webtoonSidePaddingText = computed(() => `${webtoonSidePadding.value}%`)

function syncWebtoonPadding() {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--reader-webtoon-padding', `${webtoonSidePadding.value}%`)
  }
}
watch(webtoonSidePadding, syncWebtoonPadding)

const cropBordersWebtoon = persistedBool('mihon.reader.cropBordersWebtoon', false)
const dualPageSplitWebtoon = persistedBool('mihon.reader.dualPageSplitWebtoon', false)
const dualPageInvertWebtoon = persistedBool('mihon.reader.dualPageInvertWebtoon', false)
const dualPageRotateToFitWebtoon = persistedBool('mihon.reader.dualPageRotateToFitWebtoon', false)
const dualPageRotateToFitInvertWebtoon = persistedBool('mihon.reader.dualPageRotateToFitInvertWebtoon', false)
const webtoonDoubleTapZoom = persistedBool('mihon.reader.doubleTapZoom', true)
const webtoonDisableZoomOut = persistedBool('mihon.reader.webtoonDisableZoomOut', false)

onMounted(() => {
  syncWebtoonPadding()
})
</script>

<template>
  <div class="reading-mode-page">
    <!-- 1. HeadingItem(MR.strings.pref_category_for_this_series) -->
    <h3 class="rm-heading">For this series</h3>

    <!-- 2. SettingsChipRow(MR.strings.pref_category_reading_mode) -->
    <div class="rm-chip-row">
      <h3 class="rm-heading">Reading mode</h3>
      <div class="rm-chips" role="group" aria-label="Reading mode">
        <button
          v-for="chip in readingModeChips"
          :key="chip.value"
          type="button"
          class="rm-chip"
          :class="{ 'rm-chip--selected': selectedReadingMode === chip.value }"
          :aria-pressed="selectedReadingMode === chip.value"
          @click="onSelectReadingMode(chip.value)"
        >
          <span>{{ chip.label }}</span>
        </button>
      </div>
    </div>

    <!-- 3. SettingsChipRow(MR.strings.rotation_type) -->
    <div class="rm-chip-row">
      <h3 class="rm-heading">Rotation</h3>
      <div class="rm-chips" role="group" aria-label="Rotation">
        <button
          v-for="chip in orientationChips"
          :key="chip.value"
          type="button"
          class="rm-chip"
          :class="{ 'rm-chip--selected': selectedOrientation === chip.value }"
          :aria-pressed="selectedOrientation === chip.value"
          @click="onSelectOrientation(chip.value)"
        >
          <span>{{ chip.label }}</span>
        </button>
      </div>
    </div>

    <!-- 4. Viewer settings: Webtoon vs Pager -->
    <template v-if="isWebtoonViewer">
      <!-- WebtoonViewerSettings -->
      <h3 class="rm-heading">Long strip</h3>

      <!-- TapZonesItems -->
      <div class="rm-chip-row">
        <h3 class="rm-heading">Tap zones</h3>
        <div class="rm-chips" role="group" aria-label="Tap zones">
          <button
            v-for="chip in tapZoneChips"
            :key="chip.value"
            type="button"
            class="rm-chip"
            :class="{ 'rm-chip--selected': tapZoneWebtoon === chip.value }"
            :aria-pressed="tapZoneWebtoon === chip.value"
            @click="tapZoneWebtoon = chip.value"
          >
            <span>{{ chip.label }}</span>
          </button>
        </div>
      </div>

      <div v-if="tapZoneWebtoon !== 5" class="rm-chip-row">
        <h3 class="rm-heading">Invert tap zones</h3>
        <div class="rm-chips" role="group" aria-label="Invert tap zones">
          <button
            v-for="chip in tapInvertChips"
            :key="chip.value"
            type="button"
            class="rm-chip"
            :class="{ 'rm-chip--selected': tapInvertWebtoon === chip.value }"
            :aria-pressed="tapInvertWebtoon === chip.value"
            @click="tapInvertWebtoon = chip.value"
          >
            <span>{{ chip.label }}</span>
          </button>
        </div>
      </div>

      <!-- SliderItem(pref_webtoon_side_padding, 0..25, pillColor = surfaceContainerHighest) -->
      <div class="rm-slider">
        <div class="rm-slider-header">
          <span class="rm-slider-title">Side padding</span>
          <span class="rm-pill">{{ webtoonSidePaddingText }}</span>
        </div>
        <Md3Slider
          v-model="webtoonSidePadding"
          :min="0"
          :max="25"
          :step="1"
          label="Side padding"
          :value-text="webtoonSidePaddingText"
          @update:model-value="hapticTick"
        />
      </div>

      <!-- CheckboxItem(pref_crop_borders) -->
      <button
        type="button"
        role="checkbox"
        class="rm-checkbox"
        :aria-checked="cropBordersWebtoon"
        aria-label="Crop borders"
        @click="cropBordersWebtoon = !cropBordersWebtoon"
      >
        <span class="rm-checkbox-slot">
          <span class="rm-checkbox-box" :class="{ 'rm-checkbox-box--checked': cropBordersWebtoon }">
            <svg v-if="cropBordersWebtoon" class="rm-checkbox-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </span>
        </span>
        <span class="rm-checkbox-label">Crop borders</span>
      </button>

      <!-- CheckboxItem(pref_dual_page_split) -->
      <button
        type="button"
        role="checkbox"
        class="rm-checkbox"
        :aria-checked="dualPageSplitWebtoon"
        aria-label="Split wide pages"
        @click="dualPageSplitWebtoon = !dualPageSplitWebtoon"
      >
        <span class="rm-checkbox-slot">
          <span class="rm-checkbox-box" :class="{ 'rm-checkbox-box--checked': dualPageSplitWebtoon }">
            <svg v-if="dualPageSplitWebtoon" class="rm-checkbox-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </span>
        </span>
        <span class="rm-checkbox-label">Split wide pages</span>
      </button>

      <!-- if (dualPageSplitWebtoon) CheckboxItem(pref_dual_page_invert) -->
      <button
        v-if="dualPageSplitWebtoon"
        type="button"
        role="checkbox"
        class="rm-checkbox"
        :aria-checked="dualPageInvertWebtoon"
        aria-label="Invert split page placement"
        @click="dualPageInvertWebtoon = !dualPageInvertWebtoon"
      >
        <span class="rm-checkbox-slot">
          <span class="rm-checkbox-box" :class="{ 'rm-checkbox-box--checked': dualPageInvertWebtoon }">
            <svg v-if="dualPageInvertWebtoon" class="rm-checkbox-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </span>
        </span>
        <span class="rm-checkbox-label">Invert split page placement</span>
      </button>

      <!-- CheckboxItem(pref_page_rotate) -->
      <button
        type="button"
        role="checkbox"
        class="rm-checkbox"
        :aria-checked="dualPageRotateToFitWebtoon"
        aria-label="Rotate wide pages to fit"
        @click="dualPageRotateToFitWebtoon = !dualPageRotateToFitWebtoon"
      >
        <span class="rm-checkbox-slot">
          <span class="rm-checkbox-box" :class="{ 'rm-checkbox-box--checked': dualPageRotateToFitWebtoon }">
            <svg v-if="dualPageRotateToFitWebtoon" class="rm-checkbox-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </span>
        </span>
        <span class="rm-checkbox-label">Rotate wide pages to fit</span>
      </button>

      <!-- if (dualPageRotateToFitWebtoon) CheckboxItem(pref_page_rotate_invert) -->
      <button
        v-if="dualPageRotateToFitWebtoon"
        type="button"
        role="checkbox"
        class="rm-checkbox"
        :aria-checked="dualPageRotateToFitInvertWebtoon"
        aria-label="Flip orientation of rotated wide pages"
        @click="dualPageRotateToFitInvertWebtoon = !dualPageRotateToFitInvertWebtoon"
      >
        <span class="rm-checkbox-slot">
          <span class="rm-checkbox-box" :class="{ 'rm-checkbox-box--checked': dualPageRotateToFitInvertWebtoon }">
            <svg v-if="dualPageRotateToFitInvertWebtoon" class="rm-checkbox-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </span>
        </span>
        <span class="rm-checkbox-label">Flip orientation of rotated wide pages</span>
      </button>

      <!-- CheckboxItem(pref_double_tap_zoom) -->
      <button
        type="button"
        role="checkbox"
        class="rm-checkbox"
        :aria-checked="webtoonDoubleTapZoom"
        aria-label="Double tap to zoom"
        @click="webtoonDoubleTapZoom = !webtoonDoubleTapZoom"
      >
        <span class="rm-checkbox-slot">
          <span class="rm-checkbox-box" :class="{ 'rm-checkbox-box--checked': webtoonDoubleTapZoom }">
            <svg v-if="webtoonDoubleTapZoom" class="rm-checkbox-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </span>
        </span>
        <span class="rm-checkbox-label">Double tap to zoom</span>
      </button>

      <!-- CheckboxItem(pref_webtoon_disable_zoom_out) -->
      <button
        type="button"
        role="checkbox"
        class="rm-checkbox"
        :aria-checked="webtoonDisableZoomOut"
        aria-label="Disable zoom out"
        @click="webtoonDisableZoomOut = !webtoonDisableZoomOut"
      >
        <span class="rm-checkbox-slot">
          <span class="rm-checkbox-box" :class="{ 'rm-checkbox-box--checked': webtoonDisableZoomOut }">
            <svg v-if="webtoonDisableZoomOut" class="rm-checkbox-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </span>
        </span>
        <span class="rm-checkbox-label">Disable zoom out</span>
      </button>
    </template>

    <template v-else>
      <!-- PagerViewerSettings -->
      <h3 class="rm-heading">Paged</h3>

      <!-- TapZonesItems -->
      <div class="rm-chip-row">
        <h3 class="rm-heading">Tap zones</h3>
        <div class="rm-chips" role="group" aria-label="Tap zones">
          <button
            v-for="chip in tapZoneChips"
            :key="chip.value"
            type="button"
            class="rm-chip"
            :class="{ 'rm-chip--selected': tapZonePager === chip.value }"
            :aria-pressed="tapZonePager === chip.value"
            @click="tapZonePager = chip.value"
          >
            <span>{{ chip.label }}</span>
          </button>
        </div>
      </div>

      <div v-if="tapZonePager !== 5" class="rm-chip-row">
        <h3 class="rm-heading">Invert tap zones</h3>
        <div class="rm-chips" role="group" aria-label="Invert tap zones">
          <button
            v-for="chip in tapInvertChips"
            :key="chip.value"
            type="button"
            class="rm-chip"
            :class="{ 'rm-chip--selected': tapInvertPager === chip.value }"
            :aria-pressed="tapInvertPager === chip.value"
            @click="tapInvertPager = chip.value"
          >
            <span>{{ chip.label }}</span>
          </button>
        </div>
      </div>

      <!-- SettingsChipRow(pref_image_scale_type) -->
      <div class="rm-chip-row">
        <h3 class="rm-heading">Scale type</h3>
        <div class="rm-chips" role="group" aria-label="Scale type">
          <button
            v-for="chip in scaleTypeChips"
            :key="chip.value"
            type="button"
            class="rm-chip"
            :class="{ 'rm-chip--selected': scaleType === chip.value }"
            :aria-pressed="scaleType === chip.value"
            @click="scaleType = chip.value"
          >
            <span>{{ chip.label }}</span>
          </button>
        </div>
      </div>

      <!-- SettingsChipRow(pref_zoom_start) -->
      <div class="rm-chip-row">
        <h3 class="rm-heading">Zoom start position</h3>
        <div class="rm-chips" role="group" aria-label="Zoom start position">
          <button
            v-for="chip in zoomStartChips"
            :key="chip.value"
            type="button"
            class="rm-chip"
            :class="{ 'rm-chip--selected': zoomStart === chip.value }"
            :aria-pressed="zoomStart === chip.value"
            @click="zoomStart = chip.value"
          >
            <span>{{ chip.label }}</span>
          </button>
        </div>
      </div>

      <!-- CheckboxItem(pref_crop_borders) -->
      <button
        type="button"
        role="checkbox"
        class="rm-checkbox"
        :aria-checked="cropBorders"
        aria-label="Crop borders"
        @click="cropBorders = !cropBorders"
      >
        <span class="rm-checkbox-slot">
          <span class="rm-checkbox-box" :class="{ 'rm-checkbox-box--checked': cropBorders }">
            <svg v-if="cropBorders" class="rm-checkbox-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </span>
        </span>
        <span class="rm-checkbox-label">Crop borders</span>
      </button>

      <!-- CheckboxItem(pref_landscape_zoom) -->
      <button
        type="button"
        role="checkbox"
        class="rm-checkbox"
        :aria-checked="landscapeZoom"
        aria-label="Automatically zoom into wide images"
        @click="landscapeZoom = !landscapeZoom"
      >
        <span class="rm-checkbox-slot">
          <span class="rm-checkbox-box" :class="{ 'rm-checkbox-box--checked': landscapeZoom }">
            <svg v-if="landscapeZoom" class="rm-checkbox-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </span>
        </span>
        <span class="rm-checkbox-label">Automatically zoom into wide images</span>
      </button>

      <!-- CheckboxItem(pref_navigate_pan) -->
      <button
        type="button"
        role="checkbox"
        class="rm-checkbox"
        :aria-checked="navigateToPan"
        aria-label="Pan wide images"
        @click="navigateToPan = !navigateToPan"
      >
        <span class="rm-checkbox-slot">
          <span class="rm-checkbox-box" :class="{ 'rm-checkbox-box--checked': navigateToPan }">
            <svg v-if="navigateToPan" class="rm-checkbox-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </span>
        </span>
        <span class="rm-checkbox-label">Pan wide images</span>
      </button>

      <!-- CheckboxItem(pref_dual_page_split) -->
      <button
        type="button"
        role="checkbox"
        class="rm-checkbox"
        :aria-checked="dualPageSplitPaged"
        aria-label="Split wide pages"
        @click="dualPageSplitPaged = !dualPageSplitPaged"
      >
        <span class="rm-checkbox-slot">
          <span class="rm-checkbox-box" :class="{ 'rm-checkbox-box--checked': dualPageSplitPaged }">
            <svg v-if="dualPageSplitPaged" class="rm-checkbox-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </span>
        </span>
        <span class="rm-checkbox-label">Split wide pages</span>
      </button>

      <!-- if (dualPageSplitPaged) CheckboxItem(pref_dual_page_invert) -->
      <button
        v-if="dualPageSplitPaged"
        type="button"
        role="checkbox"
        class="rm-checkbox"
        :aria-checked="dualPageInvertPaged"
        aria-label="Invert split page placement"
        @click="dualPageInvertPaged = !dualPageInvertPaged"
      >
        <span class="rm-checkbox-slot">
          <span class="rm-checkbox-box" :class="{ 'rm-checkbox-box--checked': dualPageInvertPaged }">
            <svg v-if="dualPageInvertPaged" class="rm-checkbox-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </span>
        </span>
        <span class="rm-checkbox-label">Invert split page placement</span>
      </button>

      <!-- CheckboxItem(pref_page_rotate) -->
      <button
        type="button"
        role="checkbox"
        class="rm-checkbox"
        :aria-checked="dualPageRotateToFit"
        aria-label="Rotate wide pages to fit"
        @click="dualPageRotateToFit = !dualPageRotateToFit"
      >
        <span class="rm-checkbox-slot">
          <span class="rm-checkbox-box" :class="{ 'rm-checkbox-box--checked': dualPageRotateToFit }">
            <svg v-if="dualPageRotateToFit" class="rm-checkbox-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </span>
        </span>
        <span class="rm-checkbox-label">Rotate wide pages to fit</span>
      </button>

      <!-- if (dualPageRotateToFit) CheckboxItem(pref_page_rotate_invert) -->
      <button
        v-if="dualPageRotateToFit"
        type="button"
        role="checkbox"
        class="rm-checkbox"
        :aria-checked="dualPageRotateToFitInvert"
        aria-label="Flip orientation of rotated wide pages"
        @click="dualPageRotateToFitInvert = !dualPageRotateToFitInvert"
      >
        <span class="rm-checkbox-slot">
          <span class="rm-checkbox-box" :class="{ 'rm-checkbox-box--checked': dualPageRotateToFitInvert }">
            <svg v-if="dualPageRotateToFitInvert" class="rm-checkbox-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </span>
        </span>
        <span class="rm-checkbox-label">Flip orientation of rotated wide pages</span>
      </button>
    </template>

    <v-snackbar v-model="toastVisible" :timeout="2500" color="surface-container-high" location="bottom">
      {{ toastMessage }}
    </v-snackbar>
  </div>
</template>

<style scoped>
@layer app-components {
/* ReadingModePage container: Vertical padding handled by TabbedDialog (TabbedDialogPaddings.Vertical = 8dp). */
.reading-mode-page {
  display: flex;
  flex-direction: column;
}

/* HeadingItem: Typography.header = bodyMedium (14/20) SemiBold onSurfaceVariant, padding 10dp / 24dp. */
.rm-heading {
  margin: 0;
  padding: 10px 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* SettingsChipRow: Column { HeadingItem, FlowRow(start 24dp, top 0dp, end 24dp, bottom 10dp, spacedBy 8dp) } */
.rm-chip-row {
  display: flex;
  flex-direction: column;
}

.rm-chips {
  display: flex;
  flex-wrap: wrap;
  column-gap: 8px;
  row-gap: 8px;
  padding: 0 24px 10px;
}

/* FilterChip: height 32dp, shape CornerSmall (8dp), labelLarge (14/20sp w500, letter-spacing 0.1px).
   Unselected: outline 1dp onSurfaceVariant, transparent container.
   Selected: secondaryContainer container, onSecondaryContainer content, no border. */
.rm-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 16px;
  border: 1px solid rgb(var(--v-theme-outline));
  border-radius: 8px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  cursor: pointer;
  user-select: none;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
  -webkit-tap-highlight-color: transparent;
}

.rm-chip:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.rm-chip:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}

.rm-chip:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.rm-chip--selected {
  border-color: transparent;
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}

.rm-chip--selected:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-secondary-container)) 8%, rgb(var(--v-theme-secondary-container)));
}

.rm-chip--selected:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-secondary-container)) 12%, rgb(var(--v-theme-secondary-container)));
}

/* CheckboxItem: BaseSettingsItem Row(fillMaxWidth, padding 24/10dp, spacedBy 24dp) { Checkbox, Text(bodyMedium) } */
.rm-checkbox {
  width: 100%;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 24px;
  min-height: 48px;
  padding: 10px 24px;
  color: rgb(var(--v-theme-on-surface));
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  text-align: start;
  cursor: pointer;
  user-select: none;
  transition: background-color 150ms ease;
  -webkit-tap-highlight-color: transparent;
}

.rm-checkbox:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.rm-checkbox:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}

.rm-checkbox:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.rm-checkbox-slot {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  display: grid;
  place-items: center;
}

/* Checkbox (CheckboxTokens): 18x18dp, corner radius 2dp, 2dp outline onSurfaceVariant / primary. */
.rm-checkbox-box {
  box-sizing: border-box;
  width: 18px;
  height: 18px;
  border-radius: 2px;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
  display: grid;
  place-items: center;
  background: transparent;
  color: rgb(var(--v-theme-on-primary));
  transition: background-color 150ms ease, border-color 150ms ease;
}

.rm-checkbox-box--checked {
  background: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
}

.rm-checkbox-icon {
  width: 14px;
  height: 14px;
  display: block;
}

.rm-checkbox-label {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface));
}

/* SliderItem: Column(fillMaxWidth, spacedBy 2dp, padding 24/10dp) { Row { title, Pill }, Slider } */
.rm-slider {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 24px;
}

.rm-slider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.rm-slider-title {
  flex: 1 1 auto;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface));
}

/* Pill (Pill.kt): shapes.extraLarge (28dp radius), color surfaceContainerHighest, padding 6dp / 1dp */
.rm-pill {
  flex: 0 0 auto;
  margin-left: 4px;
  padding: 1px 6px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-highest));
  color: rgb(var(--v-theme-on-surface));
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  text-align: center;
  white-space: nowrap;
}

/* Webtoon side padding slider is continuous, hide discrete stop indicators */
.reading-mode-page :deep(.md3-slider-stop) {
  display: none;
}
}
</style>
