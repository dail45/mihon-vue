<script setup lang="ts">
// Pixel-parity port of Mihon's MissingChapterCountListItem.kt:
//
//   Row(
//       modifier = Modifier
//           .padding(horizontal = MaterialTheme.padding.medium, vertical = MaterialTheme.padding.small)
//           .secondaryItemAlpha(),
//       verticalAlignment = Alignment.CenterVertically,
//       horizontalArrangement = Arrangement.spacedBy(MaterialTheme.padding.medium),
//   ) {
//       HorizontalDivider(modifier = Modifier.weight(1f))
//       Text(text = pluralStringResource(MR.plurals.missing_chapters, count = count, count),
//            style = MaterialTheme.typography.labelMedium)
//       HorizontalDivider(modifier = Modifier.weight(1f))
//   }
//
// Reference: mihon/app/src/main/java/eu/kanade/presentation/manga/components/MissingChapterCountListItem.kt
//
// Geometry taken from the reference and from
// mihon/presentation-core/src/main/java/tachiyomi/presentation/core/components/material/Constants.kt:
//   - MaterialTheme.padding.medium = 16dp -> horizontal padding and the gap between the three children
//   - MaterialTheme.padding.small  = 8dp  -> vertical padding
//   - secondaryItemAlpha() = alpha(SECONDARY_ALPHA) with SECONDARY_ALPHA = .78f
//
// Typography: MaterialTheme.typography.labelMedium is the Material 3 "labelMedium" style:
// 12sp / 16sp, FontWeight.Medium (500), letterSpacing 0.5sp.
//
// Divider: androidx.compose.material3.HorizontalDivider() defaults -> thickness 1dp
// (DividerDefaults.Thickness) and color DividerDefaults.color == MaterialTheme.colorScheme.outlineVariant.
//
// Text colour: the Text has no explicit color, so it inherits LocalContentColor, which inside the
// Manga screen Scaffold (contentColor = contentColorFor(containerColor = background)) resolves to
// colorScheme.onBackground (in the Tachiyomi scheme it happens to equal onSurface, but onBackground
// is the semantically correct slot, so it is used here).
//
// Divider colour: androidx.compose.material3.HorizontalDivider() defaults to
// DividerDefaults.color == MaterialTheme.colorScheme.outlineVariant, and it is also affected by
// the row-wide secondaryItemAlpha().
//
// The count is a plural string ("Missing 1 chapter" / "Missing 42 chapters"), matching the English
// `missing_chapters` plural of mihon/i18n/src/commonMain/moko-resources/base/plurals.xml.
import { computed } from 'vue'

const props = defineProps<{ count: number }>()

/**
 * `pluralStringResource(MR.plurals.missing_chapters, count = count, count)`:
 * quantity "one" for count === 1, "other" otherwise.
 */
const label = computed(() => `Missing ${props.count} ${props.count === 1 ? 'chapter' : 'chapters'}`)
</script>

<template>
  <div class="missing-chapter-count-list-item">
    <span class="missing-chapter-count-list-item__divider" role="separator" />
    <span class="missing-chapter-count-list-item__text">{{ label }}</span>
    <span class="missing-chapter-count-list-item__divider" role="separator" />
  </div>
</template>

<style scoped>
.missing-chapter-count-list-item {
  /* Row(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp).secondaryItemAlpha()) */
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 8px 16px;
  /* secondaryItemAlpha(): alpha(SECONDARY_ALPHA) = .78 */
  opacity: 0.78;
}

/* HorizontalDivider(modifier = Modifier.weight(1f)): 1dp thickness, outlineVariant colour. */
.missing-chapter-count-list-item__divider {
  flex: 1 1 0;
  min-width: 0;
  align-self: center;
  height: 1px;
  background-color: rgb(var(--v-theme-outline-variant));
}

/* MaterialTheme.typography.labelMedium: 12sp / 16sp, Medium weight, 0.5sp letter spacing.
   Compose measures the unweighted Text child against the full width of the Row, so the label wraps
   at word boundaries and the two weighted dividers only keep the space that is left over. */
.missing-chapter-count-list-item__text {
  flex: 0 1 auto;
  color: rgb(var(--v-theme-on-background));
  font-family: var(--v-font-body, Roboto, sans-serif);
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-align: start;
}
</style>
