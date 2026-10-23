<script setup lang="ts">
// Pixel-parity port of Mihon's BrowseSourceLoadingItem.kt:
//
//   Row(
//       modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
//       horizontalArrangement = Arrangement.Center,
//   ) { CircularProgressIndicator() }
//
// The bare Material3 CircularProgressIndicator() resolves to the *indeterminate* variant, so the
// M3 defaults apply (androidx.compose.material3.ProgressIndicator):
//   - diameter 40dp          -> CircularProgressIndicatorTokens.Size
//   - stroke 4dp             -> CircularProgressIndicatorTokens.TrackThickness
//   - round caps             -> ProgressIndicatorDefaults.CircularIndeterminateStrokeCap
//   - primary arc            -> ProgressIndicatorTokens.ActiveIndicatorColor = Primary
//   - transparent track      -> ProgressIndicatorDefaults.circularIndeterminateTrackColor
//
// The M3 indeterminate cycle (CircularAnimationProgressDuration = 6000ms) is:
//   - global rotation: tween 0 -> 1080deg, LinearEasing (CircularGlobalRotationDegreesTarget);
//   - additional rotation: keyframes 90deg@300ms, 90@1500, 180@1800, 180@3000, 270@3300,
//     270@4500, 360@4800, 360@6000. The "using EasingEmphasizedDecelerateCubicBezier" is bound
//     to the 300ms keyframe and therefore eases the following 90->90 hold, so every visible step
//     is a linear 90deg move;
//   - arc sweep: keyframes 0.1 (CircularIndeterminateMinProgress) -> 0.87
//     (CircularIndeterminateMaxProgress) at 3000ms, then back to 0.1 at 6000ms. The
//     "using EasingStandardCubicBezier" (0.2, 0, 0, 1) is bound to the 3000ms keyframe and so
//     eases the shrinking half, while the growing half stays linear.
//
// Sweep is progress * 360deg, so the drawn arc covers 36deg..313.2deg, i.e. 10%..87% of the
// circle, starting at 3 o'clock (Compose draws the indeterminate arc with startAngle = 0f).
//
// Vuetify's <v-progress-circular> spins a fixed dash in 1.4s and cannot express that animation,
// so the indicator is drawn as inline SVG with the same geometry and keyframes.
withDefaults(defineProps<{ label?: string }>(), { label: 'Loading' })
</script>

<template>
  <div class="browse-source-loading-item">
    <!--
      Compose puts `progressSemantics()` on the indicator's Canvas, not on the Row, so the
      progressbar role belongs to the indicator itself. An indeterminate progressbar carries no
      current-value attribute.
    -->
    <div class="browse-source-loading-item__indicator" role="progressbar" :aria-label="label">
      <svg
        class="browse-source-loading-item__canvas"
        width="40"
        height="40"
        viewBox="0 0 40 40"
        aria-hidden="true"
        focusable="false"
      >
        <g class="browse-source-loading-item__global">
          <g class="browse-source-loading-item__steps">
            <circle
              class="browse-source-loading-item__arc"
              cx="20"
              cy="20"
              r="18"
              pathLength="100"
            />
          </g>
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
@layer app-components {
.browse-source-loading-item {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  /* Modifier.padding(vertical = 16.dp) */
  padding: 16px 0;
}
.browse-source-loading-item__indicator {
  display: block;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  line-height: 0;
}
.browse-source-loading-item__canvas {
  display: block;
  overflow: visible;
}
.browse-source-loading-item__global,
.browse-source-loading-item__steps {
  transform-box: view-box;
  transform-origin: center;
}
/* Global rotation: 1080deg over 6s (M3 CircularGlobalRotationDegreesTarget, LinearEasing). */
.browse-source-loading-item__global {
  animation: browse-source-loading-global-rotate 6s linear infinite;
}
/* Additional rotation: 90deg steps at 300/1800/3300/4800ms, held in between (M3 keyframes). */
.browse-source-loading-item__steps {
  animation: browse-source-loading-step-rotate 6s linear infinite;
}
.browse-source-loading-item__arc {
  fill: none;
  stroke: rgb(var(--v-theme-primary));
  stroke-width: 4;
  stroke-linecap: round;
  /* M3 indeterminate arc: 10%..87% of the circle; the track is transparent. */
  stroke-dasharray: 10 100;
  animation: browse-source-loading-sweep 6s linear infinite;
}

@keyframes browse-source-loading-global-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(1080deg); }
}
@keyframes browse-source-loading-step-rotate {
  0% { transform: rotate(0deg); }
  5% { transform: rotate(90deg); }
  25% { transform: rotate(90deg); }
  30% { transform: rotate(180deg); }
  50% { transform: rotate(180deg); }
  55% { transform: rotate(270deg); }
  75% { transform: rotate(270deg); }
  80% { transform: rotate(360deg); }
  100% { transform: rotate(360deg); }
}
@keyframes browse-source-loading-sweep {
  /* 0 -> 3000ms: linear growth (M3 keyframes default easing). */
  0% { stroke-dasharray: 10 100; animation-timing-function: linear; }
  /* 3000 -> 6000ms: shrink eased with EasingStandardCubicBezier (0.2, 0, 0, 1). */
  50% { stroke-dasharray: 87 100; animation-timing-function: cubic-bezier(0.2, 0, 0, 1); }
  100% { stroke-dasharray: 10 100; }
}

@media (prefers-reduced-motion: reduce) {
.browse-source-loading-item__global,
.browse-source-loading-item__steps,
.browse-source-loading-item__arc {
  animation: none !important;
}
}
}
</style>
