<script setup lang="ts">
/**
 * Mihon `AppThemePreviewItem` (AppThemePreferenceWidget.kt:127-254).
 *
 * A miniature of the app UI drawn with the palette of the previewed theme:
 * 9:16 aspect ratio, a 4dp border (primary when selected, the divider colour otherwise),
 * a 17dp outer / 13dp inner corner radius, a 4dp inner padding, then
 *   - an app bar row (40dp tall, 8dp padding) with a title placeholder and the check icon,
 *   - a cover (half the width, 2:3 ratio, divider colour) with a two-tone label,
 *   - a bottom bar (32dp tall, surfaceContainer) with a primary circle and a title placeholder.
 */
import { computed } from 'vue'
import type { AppTheme, AppThemeColors } from '@/core/theme/appThemes'

const props = defineProps<{
  theme: AppTheme
  selected: boolean
  dark: boolean
  amoled: boolean
}>()

/** AMOLED surfaces from BaseColorScheme.kt (dark scheme only). */
const amoledSurfaces: Record<string, string> = {
  background: '#000000',
  onBackground: '#FFFFFF',
  surface: '#000000',
  onSurface: '#FFFFFF',
  surfaceVariant: '#0C0C0C',
  surfaceContainerLowest: '#0C0C0C',
  surfaceContainerLow: '#0C0C0C',
  surfaceContainer: '#0C0C0C',
  surfaceContainerHigh: '#131313',
  surfaceContainerHighest: '#1B1B1B',
}

const palette = computed<AppThemeColors>(() => {
  const colors: AppThemeColors = { ...(props.dark ? props.theme.dark : props.theme.light) }
  if (props.dark && props.amoled) Object.assign(colors, amoledSurfaces)
  return colors
})

const style = computed(() => ({
  '--pv-background': palette.value.background,
  '--pv-on-surface': palette.value.onSurface,
  '--pv-primary': palette.value.primary,
  '--pv-secondary': palette.value.secondary,
  '--pv-tertiary': palette.value.tertiary,
  '--pv-surface-container': palette.value.surfaceContainer,
  '--pv-outline-variant': palette.value.outlineVariant,
}))
</script>

<template>
  <div class="theme-preview" :class="{ 'is-selected': selected }" :style="style">
    <div class="theme-preview__bar">
      <span class="theme-preview__title" />
      <span class="theme-preview__check">
        <span v-if="selected" class="material-symbols-rounded theme-preview__check-icon" aria-hidden="true">check_circle</span>
      </span>
    </div>
    <div class="theme-preview__cover">
      <span class="theme-preview__cover-label"><i class="theme-preview__cover-a" /><i class="theme-preview__cover-b" /></span>
    </div>
    <div class="theme-preview__bottom">
      <span class="theme-preview__fab" />
      <span class="theme-preview__label" />
    </div>
  </div>
</template>

<style scoped>
@layer app-components {
/* AppThemePreviewItem.kt: fillMaxWidth().aspectRatio(9f / 16f).border(4.dp, RoundedCornerShape(17.dp))
   .padding(4.dp).clip(RoundedCornerShape(13.dp)).background(colorScheme.background). */
.theme-preview {
  box-sizing: border-box;
  width: 100%;
  aspect-ratio: 9 / 16;
  border: 4px solid var(--pv-outline-variant);
  border-radius: 17px;
  background: var(--pv-background);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.theme-preview.is-selected { border-color: var(--pv-primary); }

/* App bar: Row(fillMaxWidth().height(40.dp).padding(8.dp)). */
.theme-preview__bar {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  height: 40px;
  padding: 8px;
}
.theme-preview__title {
  width: 70%;
  height: 80%;
  margin-right: 4px;
  border-radius: 8px;
  background: var(--pv-on-surface);
}
.theme-preview__check {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 30%;
}
/* MaterialSymbols.RoundedFilled.CheckCircle */
.theme-preview__check-icon {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  font-size: 24px;
  line-height: 24px;
  color: var(--pv-primary);
}

/* Cover: Box(padding(start = 8.dp, top = 2.dp), divider colour).fillMaxWidth(0.5f).aspectRatio(2f / 3f). */
.theme-preview__cover {
  box-sizing: border-box;
  width: 50%;
  margin-top: 2px;
  margin-left: 8px;
  aspect-ratio: 2 / 3;
  border-radius: 8px;
  background: var(--pv-outline-variant);
  padding: 4px;
}
/* The label inside the cover: Row(padding(4.dp).size(24.dp x 16.dp).clip(RoundedCornerShape(5.dp))). */
.theme-preview__cover-label {
  display: flex;
  box-sizing: border-box;
  width: 24px;
  height: 16px;
  border-radius: 5px;
  overflow: hidden;
}
.theme-preview__cover-a { flex: 1; background: var(--pv-tertiary); }
.theme-preview__cover-b { flex: 1; background: var(--pv-secondary); }

/* Bottom bar: Surface(surfaceContainer) with a Row(height = 32.dp, padding(horizontal = 8.dp)). */
.theme-preview__bottom {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  margin-top: auto;
  padding: 0 8px;
  background: var(--pv-surface-container);
}
.theme-preview__fab {
  width: 17px;
  height: 17px;
  border-radius: 50%;
  background: var(--pv-primary);
}
.theme-preview__label {
  flex: 1;
  height: 17px;
  margin-left: 8px;
  border-radius: 8px;
  background: var(--pv-on-surface);
  opacity: 0.6;
}
}
</style>
