<script setup lang="ts">
/**
 * UpdatesLastUpdatedHeader.vue
 *
 * Pixel-perfect parity port of Mihon's `UpdatesLastUpdatedHeader`
 * (`mihon/app/src/main/java/eu/kanade/presentation/updates/UpdatesUiItem.kt:62-76`).
 *
 * Reference:
 * ```kotlin
 * @Composable
 * internal fun UpdatesLastUpdatedHeader(
 *     lastUpdated: Long,
 *     modifier: Modifier = Modifier,
 * ) {
 *     Box(
 *         modifier = modifier
 *             .padding(horizontal = MaterialTheme.padding.medium, vertical = MaterialTheme.padding.small),
 *     ) {
 *         Text(
 *             text = stringResource(MR.strings.updates_last_update_info, relativeTimeSpanString(lastUpdated)),
 *             fontStyle = FontStyle.Italic,
 *         )
 *     }
 * }
 * ```
 *
 * Design Tokens & Dimensions:
 * - Container Box padding: horizontal = 16dp (`MaterialTheme.padding.medium`), vertical = 8dp (`MaterialTheme.padding.small`)
 * - Typography: Material 3 `bodyLarge` (16sp / line-height 24sp, weight 400, letter-spacing 0.5sp = 0.03125em)
 * - Font style: `FontStyle.Italic`
 * - Color: `LocalContentColor.current` -> `rgb(var(--v-theme-on-surface))`
 * - Format string: `MR.strings.updates_last_update_info` ("Library last updated: %s")
 * - Formatted time: `relativeTimeSpanString(lastUpdated)`
 */
import { computed } from 'vue'
import { relativeTimeSpanString } from '../utils/dates'

const props = withDefaults(defineProps<{
  /**
   * Epoch timestamp in seconds or milliseconds, matching Mihon's `lastUpdated: Long`.
   * Also accepts an already-formatted relative string for flexibility.
   */
  lastUpdated?: number | string | null
}>(), {
  lastUpdated: 0,
})

const formattedRelative = computed(() => {
  if (props.lastUpdated === null || props.lastUpdated === undefined) {
    return relativeTimeSpanString(0)
  }
  if (typeof props.lastUpdated === 'number') {
    return relativeTimeSpanString(props.lastUpdated)
  }
  // If a string was provided:
  const trimmed = props.lastUpdated.trim()
  if (trimmed.startsWith('Library last updated:')) {
    return trimmed.replace(/^Library last updated:\s*/, '')
  }
  return trimmed || relativeTimeSpanString(0)
})
</script>

<template>
  <div class="updates-last-updated-header" role="region" aria-label="Library last updated">
    <p class="updates-last-updated">Library last updated: {{ formattedRelative }}</p>
  </div>
</template>

<style scoped>
@layer app-components {
  .updates-last-updated-header {
    box-sizing: border-box;
    padding: 8px 16px;
  }

  .updates-last-updated {
    margin: 0;
    font-size: 16px;
    line-height: 24px;
    font-weight: 400;
    letter-spacing: 0.03125em;
    font-style: italic;
    color: rgb(var(--v-theme-on-surface));
  }
}
</style>
