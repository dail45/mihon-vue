<script setup lang="ts">
/**
 * Pixel-parity port of Mihon's `SettingsAppearanceScreen`.
 *
 * Reference (Mihon, pinned commit 446f6df):
 * - `mihon/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsAppearanceScreen.kt`
 *   - Theme group (`pref_category_theme`): a `CustomPreference` whose content is a Column with
 *     `AppThemeModePreferenceWidget` (a MultiChoiceSegmentedButtonRow with System/Light/Dark)
 *     and `AppThemePreferenceWidget` (the horizontal list of theme previews), followed by the
 *     `pref_dark_theme_pure_black` switch, which is only visible when the theme mode is not LIGHT.
 *   - Display group (`pref_category_display`): `pref_app_language` (a text preference that opens
 *     the language screen), `pref_tablet_ui_mode`, `pref_date_format` and `pref_time_format`
 *     (list preferences rendered as a radio dialog) and the `pref_relative_format` /
 *     `pref_display_images_description` switches.
 * - `widget/PreferenceItem.kt`: a `CustomPreference` renders only its content — the
 *   `pref_app_theme` title is never displayed.
 * - `widget/PreferenceGroupHeader.kt`: the group title uses `typography.bodyMedium` in the
 *   secondary colour with 14dp top and 8dp bottom padding and 16dp horizontal padding.
 * - `widget/BasePreferenceWidget.kt`: rows are at least 56dp tall, the title uses
 *   `titleLarge` at 16sp (weight Normal, 28sp line height), the subtitle uses `bodySmall` at 78%
 *   alpha, the horizontal padding is 16dp and the vertical padding 16dp. The trailing widget slot
 *   is padded with `PrefsHorizontalPadding` (16dp) and the switch itself with
 *   `TrailingWidgetBuffer` (16dp).
 * - `widget/ListPreferenceWidget.kt`: the entry list is a Material 3 alert dialog with radio
 *   rows and a single "Cancel" text button.
 * - `PreferenceScreen.kt`: a 12dp spacer separates two preference groups.
 *
 * The web client stores these as harmless local preferences; no server state is touched.
 */
import { computed, ref } from 'vue'
import Md3Switch from '../components/Md3Switch.vue'
import { usePreferencesStore } from '../stores/preferences'
import {
  dateFormats,
  tabletUiModeOptions,
  themeModeOptions,
  timeFormatTitles,
  timeFormats,
  useAppearancePreferences,
  type DateFormatValue,
  type TimeFormatValue,
} from '../composables/useAppearancePreferences'
import ThemePreviewItem from '../components/appearance/ThemePreviewItem.vue'
import { appLanguages } from '../utils/appLanguage'
import { setAppLanguage, t, MR } from '../i18n'

const preferences = usePreferencesStore()
const appearance = useAppearancePreferences()

/** The open list dialog: `null` when no dialog is shown. */
type DialogKind = 'tablet' | 'date' | 'time' | null
const dialog = ref<DialogKind>(null)

/**
 * `pref_app_language` pushes the `AppLanguageScreen` (a separate screen with its own app bar).
 * The web client renders it inside this pane: the app bar row with the up button and the title
 * `pref_app_language` = "App language", then the list of the shipped translations.
 */
const screen = ref<'language' | null>(null)
const LANGUAGE_STORAGE_KEY = 'mihon.appLanguage'
const deviceLocale = typeof navigator !== 'undefined' ? (navigator.language || 'en') : 'en'
const languages = computed(() => appLanguages(deviceLocale))
const currentLanguage = ref('')

function readLanguage(): string {
  try { return localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? '' } catch { return '' }
}
function selectLanguage(tag: string) {
  currentLanguage.value = tag
  void setAppLanguage(tag)
}
currentLanguage.value = readLanguage()

const selectedLanguageDisplayName = computed(() => {
  if (!currentLanguage.value) return t(MR.strings.label_default) || 'Default'
  return languages.value.find(l => l.tag === currentLanguage.value)?.displayName || currentLanguage.value
})

const tabletEntries = computed(() => tabletUiModeOptions.map(o => ({ value: o.value, label: o.title })))
const dateEntries = computed(() => dateFormats.map(format => ({
  value: format as string,
  label: `${format || 'Default'} (${appearance.formatSampleDate(format)})`,
})))
const timeEntries = computed(() => timeFormats.map(format => ({
  value: format as string,
  label: `${timeFormatTitles[format]} (${appearance.formatSampleTime(format)})`,
})))

const tabletLabel = computed(() => tabletUiModeOptions.find(o => o.value === preferences.tabletUiMode)?.title ?? '')
const dateLabel = computed(() => dateEntries.value.find(e => e.value === appearance.dateFormat.value)?.label ?? '')
const timeLabel = computed(() => timeEntries.value.find(e => e.value === appearance.timeFormat.value)?.label ?? '')

/** The relative timestamp summary: `"Today" instead of "<formatted date>"`. */
const relativeSummary = computed(() => `"Today" instead of "${appearance.formattedDateNow.value}"`)

/**
 * `SettingsAppearanceScreen.getDisplayGroup()` shows a toast when the tablet UI mode changes:
 * `context.toast(MR.strings.requires_app_restart)`. A web client has no Android toast, so the
 * message is shown in an MD3 snackbar instead.
 */
const toast = ref('')
let toastTimer: number | undefined
function showToast(message: string) {
  toast.value = message
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = '' }, 5000)
}

function selectTablet(value: string) {
  // `DialogRow`: `onClick = { if (!isSelected) onSelected() }` — the dialog stays open when the
  // already selected entry is tapped.
  if (preferences.tabletUiMode === value) return
  preferences.tabletUiMode = value as typeof preferences.tabletUiMode
  dialog.value = null
  showToast('Requires app restart to take effect')
}
function selectDate(value: string) {
  if (appearance.dateFormat.value === value) return
  appearance.dateFormat.value = value as DateFormatValue
  dialog.value = null
}
function selectTime(value: string) {
  if (appearance.timeFormat.value === value) return
  appearance.timeFormat.value = value as TimeFormatValue
  dialog.value = null
}

const activeListDialog = computed(() => {
  if (dialog.value === 'tablet') {
    return {
      title: 'Tablet UI',
      entries: tabletEntries.value,
      selected: preferences.tabletUiMode,
      select: selectTablet,
    }
  }
  if (dialog.value === 'date') {
    return {
      title: 'Date format',
      entries: dateEntries.value,
      selected: appearance.dateFormat.value,
      select: selectDate,
    }
  }
  if (dialog.value === 'time') {
    return {
      title: 'Time format',
      entries: timeEntries.value,
      selected: appearance.timeFormat.value,
      select: selectTime,
    }
  }
  return null
})
</script>

<template>
  <div class="appearance-settings">
    <!--
      AppLanguageScreen.kt: a separate screen with an app bar and a LazyColumn of ListItems.
      The web client renders it inside the settings pane; the app bar row has the up button and
      the title `pref_app_language` = "App language".
    -->
    <div v-if="screen === 'language'" class="appearance-language-screen">
      <div class="appearance-language-bar">
        <button type="button" class="appearance-language-bar__up" aria-label="Back" @click="screen = null">
          <span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>
        </button>
        <span class="appearance-language-bar__title">{{ t(MR.strings.pref_app_language) || 'App language' }}</span>
      </div>
      <ul class="appearance-language-list" role="listbox" aria-label="App language">
        <li v-for="language in languages" :key="language.tag" role="none">
          <button
            type="button"
            role="option"
            class="appearance-language-item"
            :aria-selected="currentLanguage === language.tag"
            @click="selectLanguage(language.tag)"
          >
            <span class="appearance-language-item__text">
              <span class="appearance-language-item__headline">{{ language.tag === '' ? (t(MR.strings.label_default) || language.displayName) : language.displayName }}</span>
              <span v-if="language.localizedDisplayName" class="appearance-language-item__supporting">{{ language.localizedDisplayName }}</span>
            </span>
            <span v-if="currentLanguage === language.tag" class="material-symbols-rounded appearance-language-item__check" aria-hidden="true">check</span>
          </button>
        </li>
      </ul>
    </div>

    <template v-else>
    <!-- Theme group (pref_category_theme). -->
    <h2 class="pref-group-header">Theme</h2>
    <!-- AppThemeModePreferenceWidget: BasePreferenceWidget with a MultiChoiceSegmentedButtonRow. -->
    <div class="pref-widget">
      <div class="theme-mode-row" role="group" aria-label="App theme">
        <button
          v-for="(mode, index) in themeModeOptions"
          :key="mode.value"
          type="button"
          class="theme-mode-button"
          :class="{ 'is-first': index === 0, 'is-last': index === themeModeOptions.length - 1, 'is-selected': preferences.themeMode === mode.value }"
          :aria-pressed="preferences.themeMode === mode.value"
          @click="preferences.themeMode = mode.value"
        >
          <!-- SegmentedButton shows the check icon in the leading icon slot when it is checked. -->
          <span v-if="preferences.themeMode === mode.value" class="theme-mode-button__icon material-symbols-rounded" aria-hidden="true">check</span>
          <span class="theme-mode-button__label">{{ mode.title }}</span>
        </button>
      </div>
    </div>
    <!-- AppThemePreferenceWidget: BasePreferenceWidget with the horizontal list of theme previews. -->
    <div class="pref-widget">
      <div class="theme-list" role="listbox" aria-label="App theme">
        <div v-for="theme in appearance.appThemes" :key="theme.id" class="theme-list-item">
          <!-- AppThemePreviewItem is clickable and applies the theme; the label is not. -->
          <button
            type="button"
            class="theme-list-item__preview"
            :aria-label="theme.title"
            :aria-pressed="appearance.appThemeId.value === theme.id"
            @click="appearance.appThemeId.value = theme.id"
          >
            <ThemePreviewItem
              :theme="theme"
              :selected="appearance.appThemeId.value === theme.id"
              :dark="appearance.isDark.value"
              :amoled="appearance.amoled.value"
            />
          </button>
          <span class="theme-list-label">{{ theme.title }}</span>
        </div>
      </div>
    </div>
    <!-- pref_dark_theme_pure_black: only visible when the theme mode is not LIGHT. -->
    <div
      v-if="preferences.themeMode !== 'light'"
      class="pref-row pref-row--button"
      role="switch"
      :aria-checked="appearance.amoled.value"
      @click="appearance.amoled.value = !appearance.amoled.value"
    >
      <span class="pref-text">
        <span class="pref-title">Pure black dark mode</span>
      </span>
      <div class="pref-trailing">
        <Md3Switch
          :model-value="appearance.amoled.value"
          label="Pure black dark mode"
          @update:model-value="(val: boolean) => { appearance.amoled.value = val }"
        />
      </div>
    </div>

    <!-- 12dp spacer between the two preference groups (PreferenceScreen.kt). -->
    <div class="pref-group-spacer" />

    <!-- Display group (pref_category_display). -->
    <h2 class="pref-group-header">{{ t(MR.strings.pref_category_display) || 'Display' }}</h2>
    <!-- pref_app_language pushes the AppLanguageScreen (a separate screen in the reference). -->
    <button type="button" class="pref-row pref-row--button" @click="screen = 'language'">
      <span class="pref-text">
        <span class="pref-title">{{ t(MR.strings.pref_app_language) || 'App language' }}</span>
        <span class="pref-subtitle">{{ selectedLanguageDisplayName }}</span>
      </span>
    </button>
    <button type="button" class="pref-row pref-row--button" @click="dialog = 'tablet'">
      <span class="pref-text">
        <span class="pref-title">{{ t(MR.strings.pref_tablet_ui_mode) || 'Tablet UI' }}</span>
        <span class="pref-subtitle">{{ tabletLabel }}</span>
      </span>
    </button>
    <button type="button" class="pref-row pref-row--button" @click="dialog = 'date'">
      <span class="pref-text">
        <span class="pref-title">{{ t(MR.strings.pref_date_format) || 'Date format' }}</span>
        <span class="pref-subtitle">{{ dateLabel }}</span>
      </span>
    </button>
    <button type="button" class="pref-row pref-row--button" @click="dialog = 'time'">
      <span class="pref-text">
        <span class="pref-title">{{ t(MR.strings.pref_time_format) || 'Time format' }}</span>
        <span class="pref-subtitle">{{ timeLabel }}</span>
      </span>
    </button>
    <div
      class="pref-row pref-row--button"
      role="switch"
      :aria-checked="appearance.relativeTime.value"
      @click="appearance.relativeTime.value = !appearance.relativeTime.value"
    >
      <span class="pref-text">
        <span class="pref-title">Relative timestamps</span>
        <span class="pref-subtitle">{{ relativeSummary }}</span>
      </span>
      <div class="pref-trailing">
        <Md3Switch
          :model-value="appearance.relativeTime.value"
          label="Relative timestamps"
          @update:model-value="(val: boolean) => { appearance.relativeTime.value = val }"
        />
      </div>
    </div>
    <div
      class="pref-row pref-row--button"
      role="switch"
      :aria-checked="appearance.imagesInDescription.value"
      @click="appearance.imagesInDescription.value = !appearance.imagesInDescription.value"
    >
      <span class="pref-text">
        <span class="pref-title">Render images in manga descriptions</span>
      </span>
      <div class="pref-trailing">
        <Md3Switch
          :model-value="appearance.imagesInDescription.value"
          label="Render images in manga descriptions"
          @update:model-value="(val: boolean) => { appearance.imagesInDescription.value = val }"
        />
      </div>
    </div>

    <!-- ListPreferenceWidget: the Material 3 alert dialog with radio rows. -->
    <v-dialog
      v-if="activeListDialog"
      :model-value="true"
      max-width="560"
      content-class="appearance-dialog-overlay"
      :aria-label="activeListDialog.title"
      @update:model-value="val => { if (!val) dialog = null }"
    >
      <v-card class="appearance-dialog" rounded="28px">
        <h2 class="appearance-dialog__title">{{ activeListDialog.title }}</h2>
        <div class="appearance-dialog__list" role="radiogroup" :aria-label="activeListDialog.title">
          <button
            v-for="entry in activeListDialog.entries"
            :key="entry.value"
            type="button"
            class="appearance-dialog__row"
            role="radio"
            :aria-checked="activeListDialog.selected === entry.value"
            @click="activeListDialog.select(entry.value)"
          >
            <span class="appearance-dialog__radio" :class="{ 'is-checked': activeListDialog.selected === entry.value }" />
            <span class="appearance-dialog__label">{{ entry.label }}</span>
          </button>
        </div>
        <div class="appearance-dialog__actions">
          <button type="button" class="appearance-dialog__button" @click="dialog = null">Cancel</button>
        </div>
      </v-card>
    </v-dialog>

    <!-- The Android toast of the tablet UI mode change, shown as an MD3 snackbar. -->
    <div v-if="toast" class="appearance-snackbar" role="status" aria-live="polite">{{ toast }}</div>
    </template>
  </div>
</template>

<style scoped>
@layer app-components {
/* AppLanguageScreen.kt: pushed screen with own Scaffold & AppBar. */
.appearance-language-screen {
  box-sizing: border-box;
  width: 100%;
  background: rgb(var(--v-theme-surface));
}
@media (max-width: 599.98px) {
  .appearance-language-screen {
    position: fixed;
    inset: 0;
    z-index: 1000;
    overflow-y: auto;
  }
}

/* AppLanguageScreen.kt: the app bar (AppBar.kt) with the up button and the title. */
.appearance-language-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 64px;
  padding: 0 4px 0 4px;
}
.appearance-language-bar__up {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border: 0;
  border-radius: 24px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
}
.appearance-language-bar__up:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.appearance-language-bar__up span { font-size: 24px; line-height: 24px; }
/* AppBar.kt: the title uses titleLarge (22sp / 28sp, Normal weight). */
.appearance-language-bar__title {
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}
.appearance-language-list { margin: 0; padding: 0; list-style: none; }
/* material3 ListItem: 16dp start/end + 10dp top/bottom padding, 72dp two-line container height. */
.appearance-language-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 72px;
  padding: 10px 16px;
  box-sizing: border-box;
  border: 0;
  background: transparent;
  font: inherit;
  text-align: start;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
}
.appearance-language-item:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.appearance-language-item__text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.appearance-language-item__headline {
  display: block;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: .5px;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.appearance-language-item__supporting {
  display: block;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: .25px;
  color: rgb(var(--v-theme-on-surface-variant));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* MaterialSymbols.Rounded.Check, 24dp, tinted with the primary color. */
.appearance-language-item__check {
  flex: 0 0 auto;
  font-size: 24px;
  line-height: 24px;
  color: rgb(var(--v-theme-primary));
}

/* PreferenceGroupHeader.kt: bodyMedium in the secondary colour, 14dp top / 8dp bottom padding. */
.pref-group-header {
  margin: 0;
  padding: 14px 16px 8px;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.25px;
  color: rgb(var(--v-theme-secondary));
}

/* PreferenceScreen.kt: a 12dp spacer separates two preference groups. */
.pref-group-spacer { height: 12px; }

/* BasePreferenceWidget.kt: the subcomponent column has 16dp vertical padding. */
.pref-widget { padding: 16px 0; }

/* AppThemeModePreferenceWidget.kt: MultiChoiceSegmentedButtonRow with 16dp horizontal padding. */
.theme-mode-row {
  display: flex;
  width: 100%;
  padding: 0 16px;
  box-sizing: border-box;
}
/* SegmentedButtonDefaults.shape = RoundedCornerShape(20.dp); the height is 40dp, the border 1dp. */
.theme-mode-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 1 1 0;
  min-width: 0;
  height: 40px;
  padding: 0 12px;
  border: 1px solid rgb(var(--v-theme-outline));
  margin-inline-start: -1px;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
}
.theme-mode-button.is-first { margin-inline-start: 0; border-start-start-radius: 20px; border-end-start-radius: 20px; }
.theme-mode-button.is-last { border-start-end-radius: 20px; border-end-end-radius: 20px; }
/* SegmentedButtonDefaults.colors: checkedContainer = secondaryContainer,
   checkedContent = onSecondaryContainer, checkedBorder = outline. */
.theme-mode-button.is-selected {
  z-index: 1;
  border-color: rgb(var(--v-theme-outline));
  background: rgb(var(--v-theme-secondary-container));
  color: rgb(var(--v-theme-on-secondary-container));
}
/* The check icon of a checked SegmentedButton is 18dp. */
.theme-mode-button__icon {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
  font-size: 18px;
  line-height: 18px;
}
.theme-mode-button:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.theme-mode-button.is-selected:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-secondary-container)) 8%, transparent); }
.theme-mode-button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }

/* AppThemePreferenceWidget.kt: LazyRow with 16dp content padding, 8dp spacing, 114dp items. */
.theme-list {
  display: flex;
  gap: 8px;
  padding: 0 16px;
  overflow-x: auto;
  scrollbar-width: none;
}
.theme-list::-webkit-scrollbar { display: none; }
/* Each item is a Column(width = 114.dp).padding(top = 8.dp). */
.theme-list-item { flex: 0 0 114px; width: 114px; padding-top: 8px; }
.theme-list-item__preview {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
/* Spacer(height = 8.dp) + Text(bodyMedium, minLines = 2, maxLines = 2, centered). */
.theme-list-label {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  box-sizing: border-box;
  min-height: 40px;
  margin-top: 8px;
  padding-top: 0;
  overflow: hidden;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.25px;
  text-align: center;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.78;
}

/* BasePreferenceWidget.kt: 56dp minimum height, 16dp padding, titleLarge @16sp, bodySmall subtitle. */
.pref-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 56px;
  padding: 0 16px;
  box-sizing: border-box;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  text-decoration: none;
}
.pref-row--button { cursor: pointer; }
.pref-row--button:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
.pref-row--button:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }
.pref-text { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; padding: 16px 0; }
/* MaterialTheme.typography.titleLarge with fontSize = 16.sp: Normal weight, 28sp line height. */
.pref-title {
  font-size: 16px;
  line-height: 28px;
  font-weight: 400;
  letter-spacing: 0.15px;
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
/* MaterialTheme.typography.bodySmall (12sp / 16sp) at SECONDARY_ALPHA = 0.78. */
.pref-subtitle {
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  letter-spacing: 0.4px;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.78;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 10;
}
/*
 * BasePreferenceWidget.kt: trailing widget slot and SwitchPreferenceWidget TrailingWidgetBuffer.
 */
.pref-trailing {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
}

/* ListPreferenceWidget.kt: the Material 3 alert dialog with radio rows. */
.appearance-dialog {
  box-sizing: border-box;
  padding: 24px;
  background: rgb(var(--v-theme-surface-container-high));
  color: rgb(var(--v-theme-on-surface));
}
/* AlertDialog title: MaterialTheme.typography.titleLarge (22sp / 28sp, Normal weight). */
.appearance-dialog__title {
  margin: 0 0 16px;
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
}
.appearance-dialog__list {
  max-height: 320px;
  margin-bottom: 24px;
  overflow-y: auto;
}
/* DialogRow: Row(verticalAlignment = CenterVertically).fillMaxWidth().minimumInteractiveComponentSize(). */
.appearance-dialog__row {
  display: flex;
  align-items: center;
  gap: 24px;
  width: 100%;
  min-height: 48px;
  padding: 0 12px;
  box-sizing: border-box;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font: inherit;
  text-align: start;
  color: inherit;
  cursor: pointer;
}
.appearance-dialog__row:hover { background: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent); }
/* Material3 RadioButton: a 20dp circle with a 2dp outline and a 10dp filled dot when selected. */
.appearance-dialog__radio {
  position: relative;
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  box-sizing: border-box;
  border: 2px solid rgb(var(--v-theme-on-surface-variant));
  border-radius: 50%;
}
.appearance-dialog__radio.is-checked { border-color: rgb(var(--v-theme-primary)); }
.appearance-dialog__radio.is-checked::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 10px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
}
/* DialogRow label: MaterialTheme.typography.bodyLarge (16sp / 24sp, letterSpacing 0.5sp). */
.appearance-dialog__label {
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.5px;
}
.appearance-dialog__actions { display: flex; justify-content: flex-end; }
/* TextButton: labelLarge (14sp / 20sp, Medium weight), 12dp horizontal padding, 20dp radius. */
.appearance-dialog__button {
  height: 40px;
  min-width: 58px;
  padding: 0 12px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
}
.appearance-dialog__button:hover { background: color-mix(in srgb, rgb(var(--v-theme-primary)) 8%, transparent); }

/* The MD3 snackbar that replaces the Android toast of the tablet UI mode change. */
.appearance-snackbar {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 1000;
  max-width: min(560px, calc(100vw - 32px));
  min-width: 288px;
  padding: 14px 16px;
  border-radius: 4px;
  background: rgb(var(--v-theme-inverse-surface));
  color: rgb(var(--v-theme-inverse-on-surface));
  font-size: 14px;
  line-height: 20px;
  box-shadow: 0 3px 6px rgba(0, 0, 0, .28), 0 1px 2px rgba(0, 0, 0, .2);
}
}
</style>

<style>
/* BasicAlertDialog: the content is 280dp..560dp wide. */
.v-dialog > .appearance-dialog-overlay {
  width: fit-content;
  min-width: min(280px, calc(100% - 48px));
  max-width: min(560px, calc(100% - 48px));
}
.v-dialog > .appearance-dialog-overlay > .appearance-dialog {
  box-shadow: none;
  flex: 0 0 auto;
  overflow: hidden;
}
</style>
