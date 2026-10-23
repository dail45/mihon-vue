<script setup lang="ts">
/**
 * Pixel-parity port of the bare Material3 `CircularProgressIndicator()` used by Mihon's
 * `LoadingScreen` (mihon/presentation-core/src/main/java/tachiyomi/presentation/core/screens/LoadingScreen.kt:16):
 *
 *   Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
 *     CircularProgressIndicator()
 *   }
 *
 * The bare M3 indicator resolves to the *indeterminate* variant, so the M3 defaults apply
 * (androidx.compose.material3.ProgressIndicator):
 *   - diameter 40dp          -> CircularProgressIndicatorTokens.Size
 *   - stroke 4dp             -> CircularProgressIndicatorTokens.TrackThickness
 *   - round caps             -> ProgressIndicatorDefaults.CircularIndeterminateStrokeCap
 *   - primary arc            -> ProgressIndicatorTokens.ActiveIndicatorColor = Primary
 *   - transparent track      -> ProgressIndicatorDefaults.circularIndeterminateTrackColor
 *
 * The M3 indeterminate cycle (CircularAnimationProgressDuration = 6000ms) is:
 *   - global rotation: tween 0 -> 1080deg, LinearEasing (CircularGlobalRotationDegreesTarget);
 *   - additional rotation: keyframes 90deg@300ms, 90@1500, 180@1800, 180@3000, 270@3300,
 *     270@4500, 360@4800, 360@6000;
 *   - arc sweep: keyframes 0.1 (CircularIndeterminateMinProgress) -> 0.87
 *     (CircularIndeterminateMaxProgress) at 3000ms, then back to 0.1 at 6000ms, the shrinking
 *     half eased with EasingStandardCubicBezier (0.2, 0, 0, 1).
 *
 * The sweep is progress * 360deg, so the drawn arc covers 36deg..313.2deg (10%..87% of the
 * circle) and starts at 3 o'clock (Compose draws the indeterminate arc with startAngle = 0f).
 *
 * Vuetify's <v-progress-circular> spins a fixed dash in 1.4s and cannot express that
 * animation, so the indicator is drawn as an inline SVG with the same geometry and keyframes.
 */
const props = withDefaults(
  defineProps<{
    label?: string
    /** Diameter of the indicator in dp (M3 default: 40dp). */
    size?: number
    /** Stroke thickness in dp (M3 default: 4dp). */
    stroke?: number
  }>(),
  { label: 'Loading', size: 40, stroke: 4 },
)
</script>

<template>
  <div class="md3-circular-progress" role="progressbar" :aria-label="label">
    <svg
      class="md3-circular-progress__canvas"
      width="40"
      height="40"
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <g class="md3-circular-progress__global">
        <g class="md3-circular-progress__steps">
          <circle
            class="md3-circular-progress__arc"
            cx="20"
            cy="20"
            r="18"
            pathLength="100"
          />
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
@layer app-components {
.md3-circular-progress {
  display: block;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  line-height: 0;
}
.md3-circular-progress__canvas {
  display: block;
  overflow: visible;
}
.md3-circular-progress__global,
.md3-circular-progress__steps {
  transform-box: view-box;
  transform-origin: center;
}
/* Global rotation: 1080deg over 6s (M3 CircularGlobalRotationDegreesTarget, LinearEasing). */
.md3-circular-progress__global {
  animation: md3-circular-progress-global-rotate 6s linear infinite;
}
/* Additional rotation: 90deg steps at 300/1800/3300/4800ms, held in between (M3 keyframes). */
.md3-circular-progress__steps {
  animation: md3-circular-progress-step-rotate 6s linear infinite;
}
.md3-circular-progress__arc {
  fill: none;
  stroke: rgb(var(--v-theme-primary));
  stroke-width: 4;
  stroke-linecap: round;
  /* M3 indeterminate arc: 10%..87% of the circle; the track is transparent. */
  stroke-dasharray: 10 100;
  animation: md3-circular-progress-sweep 6s linear infinite;
}

@keyframes md3-circular-progress-global-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(1080deg); }
}

@keyframes md3-circular-progress-step-rotate {
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

@keyframes md3-circular-progress-sweep {
  /* 0 -> 3000ms: linear growth (M3 keyframes default easing). */
  0% { stroke-dasharray: 10 100; animation-timing-function: linear; }
  /* 3000 -> 6000ms: shrink eased with EasingStandardCubicBezier (0.2, 0, 0, 1). */
  50% { stroke-dasharray: 87 100; animation-timing-function: cubic-bezier(0.2, 0, 0, 1); }
  100% { stroke-dasharray: 10 100; }
}

@media (prefers-reduced-motion: reduce) {
  .md3-circular-progress__global,
  .md3-circular-progress__steps,
  .md3-circular-progress__arc {
    animation: none !important;
  }
}
}
</style>
