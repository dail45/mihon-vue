<script setup lang="ts">
/**
 * BasePreferenceWidget / TextPreferenceWidget / SwitchPreferenceWidget, ported to the web.
 *
 * Reference:
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/BasePreferenceWidget.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/TextPreferenceWidget.kt
 *   mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/SwitchPreferenceWidget.kt
 *
 * Geometry taken from BasePreferenceWidget.kt:
 *   - Row, verticalAlignment = CenterVertically, `sizeIn(minHeight = 56.dp)`, fillMaxWidth.
 *   - icon Box: `padding(start = 16.dp, end = 8.dp)`, icon tint = colorScheme.primary.
 *   - title/subtitle Column: `weight(1f)`, `padding(vertical = 16.dp)`.
 *   - title Text: `padding(horizontal = 16.dp)`, titleLarge with fontSize = 16.sp, maxLines 2.
 *   - subtitle Text: `padding(horizontal = 16.dp)`, bodySmall, `secondaryItemAlpha()` (0.78 alpha).
 *   - widget Box: `padding(end = 16.dp)`.
 */
import { computed } from 'vue'
import Md3Switch from './Md3Switch.vue'
import { stringResource } from '../i18n'

const TITLE_I18N_MAP: Record<string, string> = {
  'Downloaded only': 'label_downloaded_only',
  'Incognito mode': 'pref_incognito_mode',
  'Download queue': 'label_download_queue',
  'Categories': 'categories',
  'Statistics': 'label_stats',
  'Data and storage': 'label_data_storage',
  'Settings': 'label_settings',
  'Support Us': 'label_support_us',
  'About': 'pref_category_about',
  'Help': 'label_help',
}

const SUBTITLE_I18N_MAP: Record<string, string> = {
  'Filters all entries in your library': 'downloaded_only_summary',
  'Pauses reading history': 'pref_incognito_mode_summary',
}

const props = withDefaults(
  defineProps<{
    title: string
    subtitle?: string | null
    /** Material Symbols ligature name rendered with the bundled font. */
    icon?: string
    /** Inline SVG path data, used for the glyphs the bundled font does not carry. */
    iconPath?: string
    /** Optional badge count or text shown on the icon. */
    badge?: number | string | null
    /** Renders the trailing MD3 switch (non-interactive, like `onCheckedChange = null`). */
    switch?: boolean
    /** State of the trailing MD3 switch. */
    checked?: boolean
    /** Renders the trailing widget slot content. */
    disabled?: boolean
  }>(),
  { subtitle: null, icon: undefined, iconPath: undefined, badge: undefined, switch: false, checked: false, disabled: false },
)

const localizedTitle = computed(() => {
  const key = TITLE_I18N_MAP[props.title]
  if (key) {
    const val = stringResource(key)
    if (val && val !== key) return val
  }
  return props.title
})

const localizedSubtitle = computed(() => {
  if (!props.subtitle) return null
  const key = SUBTITLE_I18N_MAP[props.subtitle]
  if (key) {
    const val = stringResource(key)
    if (val && val !== key) return val
  }
  return props.subtitle
})

const emit = defineEmits<{ (event: 'click'): void }>()
</script>

<template>
  <div
    class="pref-row"
    :class="{ 'pref-row--disabled': disabled }"
    :role="props.switch ? 'switch' : 'button'"
    :aria-checked="props.switch ? checked : undefined"
    tabindex="0"
    :aria-disabled="disabled || undefined"
    @click="!disabled && emit('click')"
    @keydown.enter.prevent="!disabled && emit('click')"
    @keydown.space.prevent="!disabled && emit('click')"
  >
    <span v-if="icon || iconPath" class="pref-icon">
      <v-badge
        v-if="badge != null && badge !== '' && badge !== 0"
        :content="badge"
        color="primary"
        offset-x="-2"
        offset-y="-2"
      >
        <svg v-if="iconPath" viewBox="0 -960 960 960" width="24" height="24" aria-hidden="true">
          <path :d="iconPath" fill="currentColor" />
        </svg>
        <v-icon v-else-if="icon" :icon="icon" size="24" />
      </v-badge>
      <template v-else>
        <svg v-if="iconPath" viewBox="0 -960 960 960" width="24" height="24" aria-hidden="true">
          <path :d="iconPath" fill="currentColor" />
        </svg>
        <v-icon v-else-if="icon" :icon="icon" size="24" />
      </template>
    </span>
    <span class="pref-text">
      <span class="pref-title">{{ localizedTitle }}</span>
      <span v-if="localizedSubtitle" class="pref-subtitle">{{ localizedSubtitle }}</span>
    </span>
    <span v-if="switch" class="pref-widget pref-widget--switch">
      <!-- Switch(checked, onCheckedChange = null): the switch itself is not interactive,
           the whole row toggles the preference. -->
      <Md3Switch :model-value="checked" :label="title" @update:model-value="() => {}" />
    </span>
    <span v-else-if="$slots.widget" class="pref-widget"><slot name="widget" /></span>
  </div>
</template>

<style scoped>
/* BasePreferenceWidget: Row, clickable, fillMaxWidth, sizeIn(minHeight = 56.dp).
   The reference `clickable` draws the MD3 state layer: 8% onSurface on hover and 12% while
   the row is pressed, 10% on focus. */
.pref-row {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 56px;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface));
  background-color: transparent;
  transition: background-color .1s ease-out;
  outline: none;
}
.pref-row:hover:not(.pref-row--disabled) {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 8%, transparent);
}
.pref-row:active:not(.pref-row--disabled) {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 12%, transparent);
}
.pref-row:focus-visible:not(.pref-row--disabled) {
  background-color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 10%, transparent);
}
.pref-row--disabled { cursor: default; opacity: .38; }

/* icon Box(padding(start = 16.dp, end = 8.dp)), tint = colorScheme.primary. */
.pref-icon {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px 0 16px;
  color: rgb(var(--v-theme-primary));
}
.pref-icon :deep(.material-symbols-rounded) { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }

/* Column(weight(1f), padding(vertical = 16.dp)). */
.pref-text {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

/* title Text(horizontal padding 16.dp), titleLarge with fontSize = 16.sp, maxLines = 2.
   16sp font size + 24px line height + 32px vertical padding = exactly 56px row height for 1 line. */
.pref-title {
  font-size: 16px;
  line-height: 24px;
  letter-spacing: 0;
  font-weight: 400;
  color: rgb(var(--v-theme-on-surface));
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
}

/* subtitle Text(horizontal padding 16.dp), bodySmall + secondaryItemAlpha() (0.78).
   The reference pads the subtitle with `padding(horizontal = PrefsHorizontalPadding)` inside the
   same Column as the title, so both texts share one 16dp inset - not two. */
.pref-subtitle {
  margin-top: 0;
  font-size: 12px;
  line-height: 16px;
  letter-spacing: .4px;
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 78%, transparent);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 10;
  overflow: hidden;
  overflow-wrap: anywhere;
}

/* widget Box(padding(end = 16.dp)). Switch adds its own start padding (TrailingWidgetBuffer = 16.dp). */
.pref-widget {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  padding: 0 16px 0 0;
}
.pref-widget--switch { pointer-events: none; }
</style>
