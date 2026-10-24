<script setup lang="ts">
import { computed } from 'vue'

/**
 * Mirrors Mihon's `ExtensionPill`
 * (mihon/app/src/main/java/eu/kanade/presentation/browse/components/ExtensionPill.kt).
 *
 * The Kotlin composable is:
 *
 * ```kotlin
 * Text(
 *     text = text,
 *     modifier = modifier
 *         .background(color = color.copy(alpha = PILL_BACKGROUND_ALPHA), shape = MaterialTheme.shapes.small)
 *         .padding(horizontal = MaterialTheme.padding.small, vertical = 2.dp),
 *     color = color,
 *     maxLines = 1,
 *     overflow = TextOverflow.Ellipsis,
 *     style = MaterialTheme.typography.labelSmall,
 * )
 * ```
 *
 * Token mapping (Mihon / Material 3):
 * - `MaterialTheme.shapes.small` -> 8dp corner radius (M3 `Shapes.small`).
 * - `MaterialTheme.padding.small` -> 8dp horizontal padding
 *   (mihon/presentation-core/.../material/Constants.kt: `val small = 8.dp`).
 * - vertical padding -> 2dp.
 * - `PILL_BACKGROUND_ALPHA` = 0.12f -> the container is the pill colour at 12% alpha.
 * - `MaterialTheme.typography.labelSmall` -> 11sp / 16sp, weight Medium (500),
 *   letter spacing 0.5sp (M3 baseline).
 * - `maxLines = 1` + `TextOverflow.Ellipsis` -> a single ellipsized line.
 *
 * The colour argument mirrors the call sites:
 * - `presentation/browse/ExtensionsScreen.kt` -> `primary` (install steps),
 *   `error` (not-loaded reason, obsolete), `onSurfaceVariant` (private installer).
 * - `presentation/browse/ExtensionDetailsScreen.kt` -> the default `onSurfaceVariant`.
 */
const props = withDefaults(
  defineProps<{
    /** The label. MR.strings.ext_pending, ext_obsolete, ext_installer_private, ... */
    text: string
    /**
     * Theme colour slot of the pill. `on-surface-variant` is Mihon's default
     * (`MaterialTheme.colorScheme.onSurfaceVariant`).
     */
    color?: 'primary' | 'error' | 'on-surface-variant'
  }>(),
  { color: 'on-surface-variant' },
)

/** The pill colour, driven by the active Vuetify theme. */
const style = computed(() => ({
  '--pill-color': `rgb(var(--v-theme-${props.color}))`,
}))
</script>

<template>
  <span class="extension-pill" :style="style"><span class="extension-pill__text">{{ props.text }}</span></span>
</template>

<style scoped>
/*
 * ExtensionPill.kt: a `Text` with a `MaterialTheme.shapes.small` (8dp) background
 * filled with the pill colour at 12% alpha, `MaterialTheme.padding.small` (8dp)
 * horizontal and 2dp vertical padding, `labelSmall` typography and a single
 * ellipsized line.
 */
.extension-pill {
  display: inline-block;
  /* The pill is a flex item inside the metadata FlowRow: it must be allowed to
     shrink so the single ellipsized line of the reference Text can kick in. */
  min-width: 0;
  max-width: 100%;
  vertical-align: middle;
  box-sizing: border-box;
  padding: 2px 8px;
  border-radius: 8px;
  /* `color.copy(alpha = PILL_BACKGROUND_ALPHA)` - the container is the pill colour
     at 12% alpha; the label itself stays fully opaque. */
  background-color: color-mix(in srgb, var(--pill-color) 12%, transparent);
  color: var(--pill-color);
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

/* `maxLines = 1` + `TextOverflow.Ellipsis`. */
.extension-pill__text {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  /* Compose applies the 0.5sp tracking between the glyphs only, while CSS also
     adds it after the last character. Compensate so the pill keeps the exact
     reference width. */
  margin-right: -0.5px;
}
</style>
