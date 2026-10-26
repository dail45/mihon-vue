<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '@/features/settings/stores/preferences'
import Md3Slider from '@/core/components/Md3Slider.vue'
import PreferenceCheckbox from '@/features/settings/components/PreferenceCheckbox.vue'

const { t } = useI18n()
const prefs = usePreferencesStore(), display = useDisplay()

/**
 * DisplayPage.kt captures the orientation-dependent column preference once, in a
 * `remember { }` block, when the page is first composed. Rotating the device
 * while the dialog is open therefore keeps editing the same preference.
 */
const landscape = ref(display.width.value > display.height.value)
const columns = computed({
  get: () => landscape.value ? prefs.landscapeColumns : prefs.portraitColumns,
  set: (n: number) => { if (landscape.value) prefs.landscapeColumns = n; else prefs.portraitColumns = n },
})

/** `displayModes` in DisplayPage.kt. */
const modes = computed(() => [
  { title: t('action_display_grid', 'Compact grid'), value: 'compact' as const },
  { title: t('action_display_comfortable_grid', 'Comfortable grid'), value: 'comfortable' as const },
  { title: t('action_display_comfortable_grid_panorama', 'Comfortable grid (panorama)'), value: 'comfortable-panorama' as const },
  { title: t('action_display_cover_only_grid', 'Cover-only grid'), value: 'covers' as const },
  { title: t('action_display_list', 'List'), value: 'list' as const },
])
</script>

<template>
  <!-- SettingsChipRow(MR.strings.action_display_mode): heading + FlowRow of FilterChips. -->
  <h3 class="settings-heading">{{ t('action_display_mode', 'Display mode') }}</h3>
  <div class="display-mode-chips" role="group" :aria-label="t('action_display_mode', 'Display mode')">
    <button
      v-for="mode in modes"
      :key="mode.value"
      type="button"
      class="display-mode-chip"
      :class="{ 'is-selected': prefs.libraryDisplay === mode.value }"
      :aria-pressed="prefs.libraryDisplay === mode.value"
      @click="prefs.libraryDisplay = mode.value"
    >{{ mode.title }}</button>
  </div>

  <!-- SliderItem(pref_library_columns): title + Pill on the right, slider below. -->
  <div v-if="prefs.libraryDisplay !== 'list'" class="settings-slider-item">
    <div class="settings-slider-item-head">
      <span class="settings-slider-item-title">{{ t('pref_library_columns', 'Items per row') }}</span>
      <span class="columns-pill">{{ columns ? columns : t('label_auto', 'Auto') }}</span>
    </div>
    <Md3Slider v-model="columns" :label="t('pref_library_columns', 'Items per row')" :max="10" :value-text="columns ? String(columns) : t('label_auto', 'Auto')" />
  </div>

  <h3 class="settings-heading">{{ t('badges_header', 'Badges') }}</h3>
  <PreferenceCheckbox v-model="prefs.downloadBadge" :label="t('action_display_download_badge', 'Downloaded chapters')" />
  <PreferenceCheckbox v-model="prefs.unreadBadge" :label="t('action_display_unread_badge', 'Unread chapters')" />
  <PreferenceCheckbox v-model="prefs.localBadge" :label="t('action_display_local_badge', 'Local source')" />
  <PreferenceCheckbox v-model="prefs.languageBadge" :label="t('action_display_language_badge', 'Language')" />
  <PreferenceCheckbox v-model="prefs.useLangIcon" :label="t('action_display_language_icon', 'Show language flag icon')" />
  <PreferenceCheckbox v-model="prefs.sourceBadge" :label="t('action_display_source_badge', 'Show source icon badge')" />
  <PreferenceCheckbox v-model="prefs.showContinue" :label="t('action_display_show_continue_reading_button', 'Continue reading button')" />

  <h3 class="settings-heading">{{ t('tabs_header', 'Tabs') }}</h3>
  <PreferenceCheckbox v-model="prefs.categoryTabs" :label="t('action_display_show_tabs', 'Show category tabs')" />
  <PreferenceCheckbox v-model="prefs.categoryCounts" :label="t('action_display_show_number_of_items', 'Show number of items')" />
</template>

<style scoped>
@layer app-components {
/**
 * HeadingItem(): `MaterialTheme.typography.header` = bodyMedium (14sp/20sp),
 * SemiBold (600), colored onSurfaceVariant.
 */
.settings-heading {
  margin: 0;
  padding: 10px 24px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
}

/**
 * FilterChip(): 32dp tall, 8dp shape, labelLarge (14sp/500). Selected uses the
 * secondaryContainer / onSecondaryContainer pair without a border; unselected
 * keeps a 1dp outline and the onSurfaceVariant label.
 */
.display-mode-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 24px 10px;
}

.display-mode-chip {
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
  text-align: center;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
  -webkit-tap-highlight-color: transparent;
}

.display-mode-chip:hover {
  background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}

.display-mode-chip.is-selected {
  border-color: transparent;
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}

.display-mode-chip:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/**
 * SliderItem(): Column padding(horizontal 24dp, vertical 10dp) with a Row of the
 * title (bodyMedium) and the value Pill, then the Slider 2dp below it.
 */
.settings-slider-item {
  padding: 10px 24px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-slider-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.settings-slider-item-title {
  color: rgb(var(--v-theme-on-surface));
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
}

/**
 * Pill(): shape = MaterialTheme.shapes.extraLarge (28dp), padding(6.dp, 1.dp),
 * color = surfaceContainerHighest, style = bodyMedium (14sp).
 */
.columns-pill {
  padding: 1px 6px;
  border-radius: 28px;
  background: rgb(var(--v-theme-surface-container-highest));
  color: rgb(var(--v-theme-on-surface));
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  margin-left: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
}
</style>
