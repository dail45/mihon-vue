<script setup lang="ts">
import { computed } from 'vue'
import ContentWarningDialog from './ContentWarningDialog.vue'
import { contentWarningLabel, type ContentWarningLevel } from '../utils/contentWarning'

/**
 * The clickable "Warning" cell of the extension details header.
 *
 * Reference: `mihon/app/src/main/java/eu/kanade/presentation/browse/ExtensionDetailsScreen.kt`
 * - `DetailsHeader` renders, when `extension.contentWarning.label != null`, an `InfoText`
 *   cell with the warning title as the primary text (in the label colour) and
 *   `MR.strings.ext_info_warning` ("Warning") as the secondary text, plus the "ⓘ" suffix
 *   that `InfoText` appends whenever the cell is clickable.
 * - `InfoText` styles: primary = `titleSmall` (14sp / 20sp, weight 500, letter spacing 0.1sp,
 *   max 2 lines, ellipsis), secondary = `bodySmall` (12sp / 16sp, letter spacing 0.4sp) in
 *   `onSurface` at 50% alpha. The cell is centred in both directions.
 * - The click handler is `Modifier.clickable(interactionSource = null, indication = null, ...)`,
 *   so the reference draws no ripple on this cell.
 * - Tapping it raises `showContentWarning`, which opens `ContentWarningDialog`.
 */
const props = defineProps<{ warning: ContentWarningLevel | null }>()

const open = defineModel<boolean>('open', { required: true })

const label = computed(() => (props.warning ? contentWarningLabel(props.warning) : null))
</script>

<template>
  <button
    v-if="label"
    type="button"
    class="content-warning-entry"
    :style="{ color: `rgb(var(--v-theme-${label.color}))` }"
    :aria-label="`${label.title} — Warning`"
    @click="open = true"
  >
    <span class="content-warning-entry-title">{{ label.title }}</span>
    <span class="content-warning-entry-subtitle">Warning ⓘ</span>
  </button>
  <ContentWarningDialog v-if="label" v-model="open" :warning="props.warning" />
</template>

<style scoped>
@layer app-components {
/* `InfoText`: a centred Column with a clickable modifier that has no indication. */
.content-warning-entry {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 0;
  background: none;
  padding: 0;
  font-family: inherit;
  text-align: center;
  cursor: pointer;
}

/* Primary text: `titleSmall` - 14sp / 20sp, weight 500, letter spacing 0.1sp, 2 lines max. */
.content-warning-entry-title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: 0.1px;
}

/* Secondary text: `bodySmall` - 12sp / 16sp, letter spacing 0.4sp, onSurface at 50% alpha. */
.content-warning-entry-subtitle {
  font-size: 12px;
  line-height: 16px;
  letter-spacing: 0.4px;
  color: color-mix(in srgb, rgb(var(--v-theme-on-surface)) 50%, transparent);
}
}
</style>
