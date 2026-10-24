<script setup lang="ts">
/**
 * Mihon reference: eu/kanade/presentation/reader/settings/GeneralSettingsPage.kt
 * Additional references:
 *   - ReaderPreferences.kt
 *   - ReadingMode.kt
 *   - SettingsItems.kt [HeadingItem, SettingsChipRow, CheckboxItem, SliderItem]
 *   - Pill.kt
 *
 * ColumnScope.GeneralPage(viewModel: ReaderSettingsViewModel)
 *
 * Sequence of elements (100% exact match):
 * 1. SettingsChipRow(MR.strings.pref_reader_theme) -> "Background color"
 *    - Black (1), Gray (2), White (0), Auto (3)
 * 2. CheckboxItem(MR.strings.pref_show_page_number) -> "Show page number"
 * 3. SettingsChipRow(MR.strings.pref_vertical_navigator) -> "Use vertical chapter navigator in"
 *    - ReadingMode.entries.filter { it != ReadingMode.DEFAULT }:
 *      * Paged (left to right)
 *      * Paged (right to left)
 *      * Paged (vertical)
 *      * Long strip
 *      * Long strip with gaps
 *    - if (verticalNavigatorModes.isNotEmpty()):
 *      * CheckboxItem(MR.strings.pref_webtoon_vertical_navigator_on_left) -> "Place vertical navigator on the left side"
 *      * SliderItem(MR.strings.pref_vertical_navigator_height) -> "Vertical navigator height", 65..100, steps = 6
 * 4. CheckboxItem(MR.strings.pref_fullscreen) -> "Fullscreen"
 * 5. CheckboxItem(MR.strings.pref_cutout_short) -> "Show content in cutout area" (conditional on isFullscreen)
 * 6. CheckboxItem(MR.strings.pref_keep_screen_on) -> "Keep screen on"
 * 7. CheckboxItem(MR.strings.pref_read_with_long_tap) -> "Show actions on long tap"
 * 8. CheckboxItem(MR.strings.pref_always_show_chapter_transition) -> "Always show chapter transition"
 * 9. CheckboxItem(MR.strings.pref_page_transitions) -> "Animate page transitions"
 * 10. CheckboxItem(MR.strings.pref_flash_page) -> "Flash on page change"
 *     - if (flashPageState):
 *       * SliderItem(pref_flash_duration, 1..15 over MILLI_CONVERSION, pillColor = surfaceContainerHighest) -> "Flash duration"
 *       * SliderItem(pref_flash_page_interval, 1..10, pillColor = surfaceContainerHighest) -> "Flash every"
 *       * SettingsChipRow(pref_flash_with) -> "Flash with" (Black, White, White and Black)
 */
import { computed } from 'vue'
import Md3Slider from '@/core/components/Md3Slider.vue'
import { useReaderPreferences } from '@/features/reader/stores/readerPreferences'

const reader = useReaderPreferences()

function hapticTick() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(10)
    } catch {
      // ignore
    }
  }
}

// -----------------------------------------------------------------------------
// 1. SettingsChipRow(MR.strings.pref_reader_theme)
// Themes in Kotlin: Black = 1, Gray = 2, White = 0, Auto = 3
// -----------------------------------------------------------------------------
const themeChips = [
  { title: 'Black', value: 1 },
  { title: 'Gray', value: 2 },
  { title: 'White', value: 0 },
  { title: 'Auto', value: 3 },
]

const readerTheme = computed({
  get: () => reader.readerTheme,
  set: val => {
    reader.readerTheme = val
    hapticTick()
  },
})

// -----------------------------------------------------------------------------
// 2. CheckboxItem(MR.strings.pref_show_page_number)
// -----------------------------------------------------------------------------
const showPageNumber = computed({
  get: () => reader.showPageNumber,
  set: val => {
    reader.showPageNumber = val
    hapticTick()
  },
})

// -----------------------------------------------------------------------------
// 3. SettingsChipRow(MR.strings.pref_vertical_navigator)
// ReadingMode.entries without DEFAULT
// -----------------------------------------------------------------------------
const verticalNavigatorChips = [
  { title: 'Paged (left to right)', value: 'ltr' },
  { title: 'Paged (right to left)', value: 'rtl' },
  { title: 'Paged (vertical)', value: 'vertical' },
  { title: 'Long strip', value: 'webtoon' },
  { title: 'Long strip with gaps', value: 'continuous' },
]

const verticalNavigatorModes = computed(() => reader.verticalNavigator.split(',').filter(Boolean))

function toggleVerticalNavigator(mode: string) {
  const current = verticalNavigatorModes.value
  const next = current.includes(mode) ? current.filter(m => m !== mode) : [...current, mode]
  reader.verticalNavigator = next.join(',')
  hapticTick()
}

const verticalNavigatorOnLeft = computed({
  get: () => reader.verticalNavigatorOnLeft,
  set: val => {
    reader.verticalNavigatorOnLeft = val
    hapticTick()
  },
})

const verticalNavigatorHeight = computed({
  get: () => reader.verticalNavigatorHeight,
  set: val => {
    reader.verticalNavigatorHeight = val
  },
})

// -----------------------------------------------------------------------------
// 4. CheckboxItem(MR.strings.pref_fullscreen)
// -----------------------------------------------------------------------------
const fullscreen = computed({
  get: () => reader.fullscreen,
  set: val => {
    reader.fullscreen = val
    hapticTick()
  },
})

// -----------------------------------------------------------------------------
// 5. CheckboxItem(MR.strings.pref_cutout_short)
// Conditional on isFullscreen: if (LocalActivity.current?.hasDisplayCutout() == true && isFullscreen)
// In web: rendered when fullscreen is active.
// -----------------------------------------------------------------------------
const drawUnderCutout = computed({
  get: () => reader.drawUnderCutout,
  set: val => {
    reader.drawUnderCutout = val
    hapticTick()
  },
})

// -----------------------------------------------------------------------------
// 6. CheckboxItem(MR.strings.pref_keep_screen_on)
// -----------------------------------------------------------------------------
const keepScreenOn = computed({
  get: () => reader.keepScreenOn,
  set: val => {
    reader.keepScreenOn = val
    hapticTick()
  },
})

// -----------------------------------------------------------------------------
// 7. CheckboxItem(MR.strings.pref_read_with_long_tap)
// -----------------------------------------------------------------------------
const readWithLongTap = computed({
  get: () => reader.readWithLongTap,
  set: val => {
    reader.readWithLongTap = val
    hapticTick()
  },
})

// -----------------------------------------------------------------------------
// 8. CheckboxItem(MR.strings.pref_always_show_chapter_transition)
// -----------------------------------------------------------------------------
const alwaysShowChapterTransition = computed({
  get: () => reader.alwaysShowChapterTransition,
  set: val => {
    reader.alwaysShowChapterTransition = val
    hapticTick()
  },
})

// -----------------------------------------------------------------------------
// 9. CheckboxItem(MR.strings.pref_page_transitions)
// -----------------------------------------------------------------------------
const pageTransitions = computed({
  get: () => reader.pageTransitions,
  set: val => {
    reader.pageTransitions = val
    hapticTick()
  },
})

// -----------------------------------------------------------------------------
// 10. CheckboxItem(MR.strings.pref_flash_page) & conditional controls
// -----------------------------------------------------------------------------
const flashOnPageChange = computed({
  get: () => reader.flashOnPageChange,
  set: val => {
    reader.flashOnPageChange = val
    hapticTick()
  },
})

const flashDurationMillis = computed({
  get: () => reader.flashDuration,
  set: val => {
    reader.flashDuration = val
  },
})

function setFlashDuration(stepValue: number) {
  flashDurationMillis.value = stepValue * 100
  hapticTick()
}

const flashInterval = computed({
  get: () => reader.flashInterval,
  set: val => {
    reader.flashInterval = val
  },
})

const flashIntervalText = computed(() => (flashInterval.value === 1 ? '1 page' : `${flashInterval.value} pages`))

const flashColorChips = [
  { title: 'Black', value: 'black' },
  { title: 'White', value: 'white' },
  { title: 'White and Black', value: 'white_black' },
]

const flashColor = computed({
  get: () => reader.flashColor,
  set: val => {
    reader.flashColor = val
    hapticTick()
  },
})

// -----------------------------------------------------------------------------
// Auto-Webtoon Heuristic Mode (Komikku / SY)
// -----------------------------------------------------------------------------
const autoWebtoon = computed({
  get: () => reader.autoWebtoon,
  set: val => {
    reader.autoWebtoon = val
    hapticTick()
  },
})

// -----------------------------------------------------------------------------
// Continuous Strip Gap Size (0..32px)
// -----------------------------------------------------------------------------
const stripGapSize = computed({
  get: () => reader.stripGapSize,
  set: val => {
    reader.stripGapSize = val
  },
})
</script>

<template>
  <div class="general-settings-page" role="group" aria-label="General reader settings">
    <!-- 1. SettingsChipRow(MR.strings.pref_reader_theme) -->
    <h3 class="gs-heading">Background color</h3>
    <div class="gs-chips" role="group" aria-label="Background color">
      <button
        v-for="chip in themeChips"
        :key="chip.value"
        type="button"
        class="gs-chip"
        :class="{ 'gs-chip--selected': readerTheme === chip.value }"
        :aria-pressed="readerTheme === chip.value"
        @click="readerTheme = chip.value"
      >
        <svg v-if="readerTheme === chip.value" class="gs-chip-check" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
        <span>{{ chip.title }}</span>
      </button>
    </div>

    <!-- 2. CheckboxItem(MR.strings.pref_show_page_number) -->
    <button
      type="button"
      role="checkbox"
      :aria-checked="showPageNumber"
      class="gs-checkbox"
      @click="showPageNumber = !showPageNumber"
    >
      <span class="gs-checkbox-slot" aria-hidden="true">
        <span class="gs-checkbox-box" :class="{ 'gs-checkbox-box--checked': showPageNumber }">
          <svg v-if="showPageNumber" class="gs-checkbox-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </span>
      </span>
      <span class="gs-checkbox-label">Show page number</span>
    </button>

    <!-- 3. SettingsChipRow(MR.strings.pref_vertical_navigator) -->
    <h3 class="gs-heading">Use vertical chapter navigator in</h3>
    <div class="gs-chips" role="group" aria-label="Use vertical chapter navigator in">
      <button
        v-for="chip in verticalNavigatorChips"
        :key="chip.value"
        type="button"
        class="gs-chip"
        :class="{ 'gs-chip--selected': verticalNavigatorModes.includes(chip.value) }"
        :aria-pressed="verticalNavigatorModes.includes(chip.value)"
        @click="toggleVerticalNavigator(chip.value)"
      >
        <svg v-if="verticalNavigatorModes.includes(chip.value)" class="gs-chip-check" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
        <span>{{ chip.title }}</span>
      </button>
    </div>

    <template v-if="verticalNavigatorModes.length > 0">
      <!-- 3a. CheckboxItem(MR.strings.pref_webtoon_vertical_navigator_on_left) -->
      <button
        type="button"
        role="checkbox"
        :aria-checked="verticalNavigatorOnLeft"
        class="gs-checkbox"
        @click="verticalNavigatorOnLeft = !verticalNavigatorOnLeft"
      >
        <span class="gs-checkbox-slot" aria-hidden="true">
          <span class="gs-checkbox-box" :class="{ 'gs-checkbox-box--checked': verticalNavigatorOnLeft }">
            <svg v-if="verticalNavigatorOnLeft" class="gs-checkbox-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </span>
        </span>
        <span class="gs-checkbox-label">Place vertical navigator on the left side</span>
      </button>

      <!-- 3b. SliderItem(MR.strings.pref_vertical_navigator_height) -->
      <div class="gs-slider">
        <div class="gs-slider-header">
          <span class="gs-slider-title">Vertical navigator height</span>
          <span class="gs-pill">{{ verticalNavigatorHeight }}</span>
        </div>
        <Md3Slider
          v-model="verticalNavigatorHeight"
          :min="65"
          :max="100"
          :step="5"
          :stop-count="7"
          label="Vertical navigator height"
          :value-text="String(verticalNavigatorHeight)"
          @update:model-value="hapticTick"
        />
      </div>
    </template>

    <!-- 4. CheckboxItem(MR.strings.pref_fullscreen) -->
    <button
      type="button"
      role="checkbox"
      :aria-checked="fullscreen"
      class="gs-checkbox"
      @click="fullscreen = !fullscreen"
    >
      <span class="gs-checkbox-slot" aria-hidden="true">
        <span class="gs-checkbox-box" :class="{ 'gs-checkbox-box--checked': fullscreen }">
          <svg v-if="fullscreen" class="gs-checkbox-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </span>
      </span>
      <span class="gs-checkbox-label">Fullscreen</span>
    </button>

    <!-- 5. CheckboxItem(MR.strings.pref_cutout_short) conditional on isFullscreen -->
    <button
      v-if="fullscreen"
      type="button"
      role="checkbox"
      :aria-checked="drawUnderCutout"
      class="gs-checkbox"
      @click="drawUnderCutout = !drawUnderCutout"
    >
      <span class="gs-checkbox-slot" aria-hidden="true">
        <span class="gs-checkbox-box" :class="{ 'gs-checkbox-box--checked': drawUnderCutout }">
          <svg v-if="drawUnderCutout" class="gs-checkbox-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </span>
      </span>
      <span class="gs-checkbox-label">Show content in cutout area</span>
    </button>

    <!-- 6. CheckboxItem(MR.strings.pref_keep_screen_on) -->
    <button
      type="button"
      role="checkbox"
      :aria-checked="keepScreenOn"
      class="gs-checkbox"
      @click="keepScreenOn = !keepScreenOn"
    >
      <span class="gs-checkbox-slot" aria-hidden="true">
        <span class="gs-checkbox-box" :class="{ 'gs-checkbox-box--checked': keepScreenOn }">
          <svg v-if="keepScreenOn" class="gs-checkbox-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </span>
      </span>
      <span class="gs-checkbox-label">Keep screen on</span>
    </button>

    <!-- 7. CheckboxItem(MR.strings.pref_read_with_long_tap) -->
    <button
      type="button"
      role="checkbox"
      :aria-checked="readWithLongTap"
      class="gs-checkbox"
      @click="readWithLongTap = !readWithLongTap"
    >
      <span class="gs-checkbox-slot" aria-hidden="true">
        <span class="gs-checkbox-box" :class="{ 'gs-checkbox-box--checked': readWithLongTap }">
          <svg v-if="readWithLongTap" class="gs-checkbox-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </span>
      </span>
      <span class="gs-checkbox-label">Show actions on long tap</span>
    </button>

    <!-- 8. CheckboxItem(MR.strings.pref_always_show_chapter_transition) -->
    <button
      type="button"
      role="checkbox"
      :aria-checked="alwaysShowChapterTransition"
      class="gs-checkbox"
      @click="alwaysShowChapterTransition = !alwaysShowChapterTransition"
    >
      <span class="gs-checkbox-slot" aria-hidden="true">
        <span class="gs-checkbox-box" :class="{ 'gs-checkbox-box--checked': alwaysShowChapterTransition }">
          <svg v-if="alwaysShowChapterTransition" class="gs-checkbox-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </span>
      </span>
      <span class="gs-checkbox-label">Always show chapter transition</span>
    </button>

    <!-- 9. CheckboxItem(MR.strings.pref_page_transitions) -->
    <button
      type="button"
      role="checkbox"
      :aria-checked="pageTransitions"
      class="gs-checkbox"
      @click="pageTransitions = !pageTransitions"
    >
      <span class="gs-checkbox-slot" aria-hidden="true">
        <span class="gs-checkbox-box" :class="{ 'gs-checkbox-box--checked': pageTransitions }">
          <svg v-if="pageTransitions" class="gs-checkbox-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </span>
      </span>
      <span class="gs-checkbox-label">Animate page transitions</span>
    </button>

    <!-- 10. CheckboxItem(MR.strings.pref_flash_page) -->
    <button
      type="button"
      role="checkbox"
      :aria-checked="flashOnPageChange"
      class="gs-checkbox"
      @click="flashOnPageChange = !flashOnPageChange"
    >
      <span class="gs-checkbox-slot" aria-hidden="true">
        <span class="gs-checkbox-box" :class="{ 'gs-checkbox-box--checked': flashOnPageChange }">
          <svg v-if="flashOnPageChange" class="gs-checkbox-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </span>
      </span>
      <span class="gs-checkbox-label">Flash on page change</span>
    </button>

    <template v-if="flashOnPageChange">
      <!-- 10a. SliderItem(pref_flash_duration) -->
      <div class="gs-slider">
        <div class="gs-slider-header">
          <span class="gs-slider-title">Flash duration</span>
          <span class="gs-pill gs-pill--highest">{{ flashDurationMillis }} ms</span>
        </div>
        <Md3Slider
          :model-value="flashDurationMillis / 100"
          :min="1"
          :max="15"
          :step="1"
          :stop-count="15"
          label="Flash duration"
          :value-text="`${flashDurationMillis} ms`"
          @update:model-value="setFlashDuration"
        />
      </div>

      <!-- 10b. SliderItem(pref_flash_page_interval) -->
      <div class="gs-slider">
        <div class="gs-slider-header">
          <span class="gs-slider-title">Flash every</span>
          <span class="gs-pill gs-pill--highest">{{ flashIntervalText }}</span>
        </div>
        <Md3Slider
          v-model="flashInterval"
          :min="1"
          :max="10"
          :step="1"
          :stop-count="10"
          label="Flash every"
          :value-text="flashIntervalText"
          @update:model-value="hapticTick"
        />
      </div>

      <!-- 10c. SettingsChipRow(pref_flash_with) -->
      <h3 class="gs-heading">Flash with</h3>
      <div class="gs-chips" role="group" aria-label="Flash with">
        <button
          v-for="chip in flashColorChips"
          :key="chip.value"
          type="button"
          class="gs-chip"
          :class="{ 'gs-chip--selected': flashColor === chip.value }"
          :aria-pressed="flashColor === chip.value"
          @click="flashColor = chip.value"
        >
          <svg v-if="flashColor === chip.value" class="gs-chip-check" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
          <span>{{ chip.title }}</span>
        </button>
      </div>
    </template>

    <!-- 11. Auto-Webtoon detection (Komikku / SY) -->
    <button
      type="button"
      role="checkbox"
      :aria-checked="autoWebtoon"
      class="gs-checkbox"
      @click="autoWebtoon = !autoWebtoon"
    >
      <span class="gs-checkbox-slot" aria-hidden="true">
        <span class="gs-checkbox-box" :class="{ 'gs-checkbox-box--checked': autoWebtoon }">
          <svg v-if="autoWebtoon" class="gs-checkbox-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </span>
      </span>
      <span class="gs-checkbox-label">Auto-Webtoon detection</span>
    </button>

    <!-- 12. Continuous Strip Gap Size Slider (0..32px) -->
    <div class="gs-slider">
      <div class="gs-slider-header">
        <span class="gs-slider-title">Continuous strip gap</span>
        <span class="gs-pill gs-pill--highest">{{ stripGapSize }} px</span>
      </div>
      <Md3Slider
        v-model="stripGapSize"
        :min="0"
        :max="32"
        :step="1"
        label="Continuous strip gap"
        :value-text="`${stripGapSize} px`"
        @update:model-value="hapticTick"
      />
    </div>
  </div>
</template>

<style scoped>
@layer app-components {
.general-settings-page {
  display: flex;
  flex-direction: column;
}

/* HeadingItem: Typography.header = bodyMedium (14/20) SemiBold onSurfaceVariant, padding 10dp/24dp. */
.gs-heading {
  margin: 0;
  padding: 10px 24px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* SettingsChipRow: FlowRow(start 24dp, top 0dp, end 24dp, bottom 10dp, horizontal spacedBy 8dp). */
.gs-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 24px 10px;
}

/* MD3 FilterChip: 32dp height, 8dp corner radius, label 14/20 Medium, 1dp outline when unselected. */
.gs-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
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

.gs-chip:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.gs-chip:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}

.gs-chip:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* MD3 selected filter chip: no outline, leading check icon (18dp) with 8dp spacing, 8dp start padding. */
.gs-chip--selected {
  padding: 0 16px 0 8px;
  border-color: transparent;
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}

.gs-chip--selected:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-secondary-container)) 8%, rgb(var(--v-theme-secondary-container)));
}

.gs-chip--selected:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-secondary-container)) 12%, rgb(var(--v-theme-secondary-container)));
}

.gs-chip-check {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  fill: currentColor;
}

/* CheckboxItem: BaseSettingsItem Row(fillMaxWidth, padding 24/10dp, spacedBy 24dp) { Checkbox, Text(bodyMedium) }. */
.gs-checkbox {
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

.gs-checkbox:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.gs-checkbox:active {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}

.gs-checkbox:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.gs-checkbox-slot {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  display: grid;
  place-items: center;
}

/* MD3 Checkbox: 18dp box, 2dp corner radius, 2dp outline, 48dp minimum touch target. */
.gs-checkbox-box {
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

.gs-checkbox-box--checked {
  background: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
}

.gs-checkbox-icon {
  width: 14px;
  height: 14px;
  display: block;
}

.gs-checkbox-label {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface));
}

/* SliderItem: Column(padding 24/10dp, spacedBy 2dp) { Row(spacedBy 8dp) { title, Pill }, Slider }. */
.gs-slider {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 24px;
}

.gs-slider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.gs-slider-title {
  flex: 1 1 auto;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-on-surface));
}

/* Pill: surfaceContainerHigh (default) or surfaceContainerHighest, extraLarge shape (28dp radius), content padding 6dp/1dp, start padding 4dp, bodyMedium. */
.gs-pill {
  flex: 0 0 auto;
  margin-left: 4px;
  padding: 1px 6px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  text-align: center;
  white-space: nowrap;
}

.gs-pill--highest {
  background: rgb(var(--v-theme-surface-container-highest));
}
}
</style>
