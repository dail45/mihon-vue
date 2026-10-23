<script setup lang="ts">
// Port of mihon/app/src/main/java/eu/kanade/presentation/reader/ReaderContentOverlay.kt
// (Mihon 446f6df).
//
// The reference composable paints two full-size canvases over the reader content:
//
//   if (brightness < 0) {
//       val brightnessAlpha = remember(brightness) { abs(brightness) / 100f }
//       Canvas(modifier.fillMaxSize().graphicsLayer { alpha = brightnessAlpha }) { drawRect(Color.Black) }
//   }
//
//   if (color != null) {
//       Canvas(modifier.fillMaxSize()) { drawRect(color = Color(color), blendMode = colorBlendMode ?: BlendMode.SrcOver) }
//   }
//
// Drawing order therefore is: dim rect first, colour rect second (the colour rect
// blends with the already-dimmed page, exactly like the two Compose canvases).
//
// Web mapping notes
// -----------------
// * A Compose `Canvas` is a positioned, non-interactive layer, so the overlay uses
//   `pointer-events: none` and never swallows reader gestures.
// * `graphicsLayer { alpha = ... }` maps to the CSS `opacity` of the dim layer.
// * `BlendMode` maps to the CSS `mix-blend-mode` of the colour layer.
//   `BlendMode.Modulate` multiplies the source and backdrop colours (alpha is added);
//   over the opaque reader page that is exactly the CSS `multiply` blend mode.
// * The overlay root must NOT create a stacking context (no `z-index`, `opacity`,
//   `filter`, `transform` or `isolation`), otherwise `mix-blend-mode` would only
//   blend against the transparent overlay backdrop and every non-default blend mode
//   would silently degrade to a plain alpha overlay. The reader app bars keep their
//   own `z-index` so they stay above the overlay, as in the reference where
//   `AppBars(state)` is drawn after `ContentOverlay(state)`.
//
// When no props are supplied the component reads the reader colour-filter
// preferences itself, matching `ReaderActivity.ContentOverlay()`:
//   color = colorOverlay.takeIf { colorOverlayEnabled }
//   colorBlendMode = ReaderPreferences.ColorFilterMode.getOrNull(colorFilterMode)?.second
import { computed, onBeforeUnmount } from 'vue'
import {
  brightnessOverlayAlpha,
  colorOverlayStyle,
  contentFilterStyle,
  useReaderContentOverlayState,
  type ReaderBlendMode,
} from './readerContentOverlay'

const props = withDefaults(
  defineProps<{
    /** Mihon `brightnessOverlayValue`, range -100..100. Only negative values paint dim layer. */
    brightness?: number
    /** Packed ARGB colour (0xAARRGGBB) of the colour filter, or `null` for no filter. */
    color?: number | null
    /** Mihon `ReaderPreferences.ColorFilterMode` blend mode. `null` means `BlendMode.SrcOver`. */
    colorBlendMode?: ReaderBlendMode | null
    /** Grayscale filter toggle (Mihon ReaderActivity.kt getCombinedPaint). */
    grayscale?: boolean
    /** Inverted colors filter toggle (Mihon ReaderActivity.kt getCombinedPaint). */
    invertedColors?: boolean
  }>(),
  {
    brightness: undefined,
    color: undefined,
    colorBlendMode: undefined,
    grayscale: undefined,
    invertedColors: undefined,
  },
)

const stored = useReaderContentOverlayState()
onBeforeUnmount(stored.stop)

// Explicit props win; otherwise the stored reader preferences are used.
const effectiveBrightness = computed(() => props.brightness ?? stored.brightness.value)
const effectiveColor = computed(() => (props.color === undefined ? stored.color.value : props.color))
const effectiveBlendMode = computed(() => (props.colorBlendMode === undefined ? stored.colorBlendMode.value : props.colorBlendMode))
const effectiveGrayscale = computed(() => (props.grayscale === undefined ? stored.grayscale.value : props.grayscale))
const effectiveInverted = computed(() => (props.invertedColors === undefined ? stored.invertedColors.value : props.invertedColors))

// `remember(brightness) { abs(brightness) / 100f }` -> the black layer alpha.
const dimAlpha = computed(() => brightnessOverlayAlpha(effectiveBrightness.value))
// `drawRect(color = Color(color), blendMode = colorBlendMode ?: BlendMode.SrcOver)`.
const colorLayer = computed(() => colorOverlayStyle(effectiveColor.value, effectiveBlendMode.value))
// `ReaderActivity.kt getCombinedPaint(grayscale, invertedColors)`.
const filterStyle = computed(() => contentFilterStyle(effectiveGrayscale.value, effectiveInverted.value))
</script>

<template>
  <div class="reader-content-overlay" aria-hidden="true" data-testid="reader-content-overlay">
    <!-- ReaderActivity.kt getCombinedPaint(): Grayscale / Inverted colors backdrop layer -->
    <div
      v-if="filterStyle !== 'none'"
      class="reader-content-overlay-filter"
      data-testid="reader-content-overlay-filter"
      :style="{ backdropFilter: filterStyle, WebkitBackdropFilter: filterStyle }"
    />
    <!-- Canvas(fillMaxSize).graphicsLayer { alpha = brightnessAlpha } { drawRect(Color.Black) } -->
    <div
      v-if="dimAlpha > 0"
      class="reader-content-overlay-dim"
      data-testid="reader-content-overlay-dim"
      :style="{ opacity: dimAlpha }"
    />
    <!-- Canvas(fillMaxSize) { drawRect(color, blendMode) } -->
    <div
      v-if="colorLayer"
      class="reader-content-overlay-color"
      data-testid="reader-content-overlay-color"
      :style="{ backgroundColor: colorLayer.backgroundColor, mixBlendMode: colorLayer.mixBlendMode }"
    />
  </div>
</template>

<style scoped>
@layer app-components {
/* Modifier.fillMaxSize(): the overlay covers the whole reader content area.
   The Compose canvas does not consume touch events, so the layer must not either.
   The root keeps `z-index: auto` so it does not create a stacking context: the
   colour layer's `mix-blend-mode` has to blend with the page below it, not with a
   transparent isolated backdrop. The rects carry their own z-index (0, 1, 2)
   and therefore paint above the page and below the app bars (z-index 3). */
.reader-content-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
/* ReaderActivity.kt getCombinedPaint(): grayscale and inverted colors.
   In Compose/Android, this is set as a hardware layer paint on viewerContainer.
   In web, backdrop-filter applies the matrix filter to the viewport underneath.
   z-index 0 keeps it below ReaderPageIndicator (z-index 0 later in DOM, or z-index 1). */
.reader-content-overlay-filter {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
/* drawRect(Color.Black) with the layer alpha applied to the whole canvas. */
.reader-content-overlay-dim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background-color: #000;
  pointer-events: none;
}
/* drawRect(color = Color(color), blendMode = ...)
   The colour rect is drawn after the dim rect, so it blends with the already
   dimmed page — the same order as the two Compose canvases. */
.reader-content-overlay-color {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}
}
</style>

<style>
/* ReaderActivity.setComposeOverlay(): the draw order inside the reader Box is
     ReaderPageIndicator -> ContentOverlay -> AppBars.
   The page indicator is therefore painted *below* the overlay, so the dim and the
   colour filter also cover the page number. The indicator component carries its
   own `z-index: 2`, which would lift it above the overlay, so it is lowered here.
   The app bars keep their own z-index and stay on top, as in the reference. */
.reader .reader-page-indicator {
  z-index: 0 !important;
}
</style>
