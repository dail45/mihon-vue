<script setup lang="ts">
/**
 * Mirrors Mihon's `ReaderPageIndicator`
 * (mihon/app/src/main/java/eu/kanade/presentation/reader/ReaderPageIndicator.kt,
 * Mihon 446f6df8).
 *
 * Reference behaviour:
 * - `if (currentPage <= 0 || totalPages <= 0) return` — nothing is drawn.
 * - `val text = "$currentPage / $totalPages"` — the literal label.
 * - Foreground `TextStyle`: `MaterialTheme.typography.bodySmall.fontSize` (12sp),
 *   `FontWeight.Bold`, `letterSpacing = 1.sp`, colour `Color(235, 235, 235)` (#EBEBEB).
 * - A second copy of the same text is drawn *behind* it with colour `Color(45, 45, 45)`
 *   (#2D2D2D) and `drawStyle = Stroke(width = 4f)`. The stroke is centred on the glyph
 *   outline, so the opaque filled copy on top hides its inner half and only a 2px dark
 *   halo remains around the letters.
 * - The reference `TextStyle` sets only `fontSize`, `fontWeight` and `letterSpacing`, so
 *   the line height stays unset and the text is laid out with the font's own metrics.
 *   The web build therefore uses `line-height: normal` instead of a hard 16px.
 * - The indicator is only drawn while the reader menu is hidden and the
 *   `pref_show_page_number_key` preference is enabled (ReaderActivity.kt:261). The
 *   "Show page number" switch of the settings dialog toggles `reader-hide-page-number`
 *   on the `.reader` root; this component honours that class.
 * - The composable paints **no** background, **no** padding and **no** rounded shape:
 *   the text sits directly on the page image and stays readable thanks to the outline.
 *
 * Placement (bottom-centred above the navigation bar) is the caller's job in Mihon:
 * `ReaderActivity` aligns the composable `Alignment.BottomCenter` and applies
 * `Modifier.navigationBarsPadding()`. The same placement is reproduced here so the
 * indicator sits on the bottom edge of the reader, above the system navigation inset.
 */
import { computed, onMounted, ref } from 'vue'
import { readPreference } from '../../stores/preferences'
import {
  PAGE_INDICATOR_FILL_COLOR,
  PAGE_INDICATOR_FONT_SIZE,
  PAGE_INDICATOR_LETTER_SPACING,
  PAGE_INDICATOR_STROKE_COLOR,
  PAGE_INDICATOR_STROKE_WIDTH,
  SHOW_PAGE_NUMBER_PREF_KEY,
  isPageNumberEnabled,
  isPageIndicatorVisible,
  pageIndicatorLabel,
} from './readerPageIndicator'

const props = defineProps<{
  /** 1-based page number currently shown. */
  currentPage: number
  /** Total number of pages in the chapter. */
  totalPages: number
}>()

/**
 * ReaderActivity.kt:261 — the indicator is only drawn when the
 * `pref_show_page_number_key` preference is enabled. The value is read from the local
 * preference store (`mihon.reader.showPageNumber`, default `true`, see
 * ReaderPreferences.kt:42) so the indicator honours the "Show page number" switch even
 * before the reader settings dialog was opened once.
 */
const showPageNumber = ref(true)
onMounted(() => {
  showPageNumber.value = isPageNumberEnabled(readPreference(SHOW_PAGE_NUMBER_PREF_KEY))
})

/** Kotlin: `if (currentPage <= 0 || totalPages <= 0) return` */
const visible = computed(() => showPageNumber.value && isPageIndicatorVisible(props.currentPage, props.totalPages))

/** Kotlin: `val text = "$currentPage / $totalPages"` */
const label = computed(() => pageIndicatorLabel(props.currentPage, props.totalPages))
</script>

<template>
  <span
    v-if="visible"
    class="reader-page-indicator"
    aria-live="polite"
    :style="{
      '--page-indicator-fill': PAGE_INDICATOR_FILL_COLOR,
      '--page-indicator-stroke': PAGE_INDICATOR_STROKE_COLOR,
      '--page-indicator-stroke-width': `${PAGE_INDICATOR_STROKE_WIDTH}px`,
      '--page-indicator-font-size': `${PAGE_INDICATOR_FONT_SIZE}px`,
      '--page-indicator-letter-spacing': `${PAGE_INDICATOR_LETTER_SPACING}px`,
    }"
  >
    <span class="reader-page-indicator__stack">
      <!-- Kotlin: stroke copy (`Color(45, 45, 45)`, `Stroke(width = 4f)`) drawn first. -->
      <span class="reader-page-indicator__stroke" aria-hidden="true">{{ label }}</span>
      <!-- Kotlin: filled copy (`Color(235, 235, 235)`) drawn on top of the stroke. -->
      <span class="reader-page-indicator__fill">{{ label }}</span>
    </span>
  </span>
</template>

<style scoped>
/* Mihon ReaderPageIndicator.kt:
     Box(contentAlignment = Center) { Text(strokeStyle); Text(style) }
   - typography.bodySmall fontSize = 12sp; the reference TextStyle sets no lineHeight,
     so the text keeps the font's own metrics (CSS `line-height: normal`).
   - FontWeight.Bold (700), letterSpacing = 1.sp
   - fill Color(235, 235, 235) = #EBEBEB, stroke Color(45, 45, 45) = #2D2D2D, stroke width 4px
   - no background, no padding, no rounded shape. */
.reader-page-indicator {
  /* Mihon: `Modifier.align(Alignment.BottomCenter).navigationBarsPadding()` */
  position: absolute;
  z-index: 2;
  left: 50%;
  bottom: env(safe-area-inset-bottom, 0px);
  transform: translateX(-50%);
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  border-radius: 0;
  color: var(--page-indicator-fill, #ebebeb);
  font-family: var(--v-font-body, Roboto, sans-serif);
  font-size: var(--page-indicator-font-size, 12px);
  line-height: normal;
  font-weight: 700;
  letter-spacing: var(--page-indicator-letter-spacing, 1px);
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
  -webkit-user-select: none;
  user-select: none;
}

/* ReaderActivity.kt:261 — the indicator is only drawn while the menu is hidden and
   `pref_show_page_number_key` is on. The settings dialog toggles this class on the
   `.reader` root when "Show page number" is disabled. */
:global(.reader-hide-page-number .reader-page-indicator) {
  display: none;
}

.reader-page-indicator__stack {
  position: relative;
  display: inline-block;
}

/* The stroke copy sits behind the filled copy. A 4px stroke is centred on the glyph
   outline, so the filled copy hides its inner half and only the outer halo shows. */
.reader-page-indicator__stroke {
  position: absolute;
  inset: 0;
  color: transparent;
  -webkit-text-stroke: var(--page-indicator-stroke-width, 4px) var(--page-indicator-stroke, #2d2d2d);
  pointer-events: none;
}

.reader-page-indicator__fill {
  position: relative;
  color: var(--page-indicator-fill, #ebebeb);
}
</style>
