<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

// Reference: mihon/app/src/main/java/mihon/feature/migration/list/components/MigrationProgressDialog.kt
//
//   AlertDialog(
//     onDismissRequest = {},
//     confirmButton = { TextButton(onClick = exitMigration) { Text(cancelLabel) } },
//     text = { if (!progress.isNaN()) LinearProgressIndicator(progress = { progressAnimated }) },
//     properties = DialogProperties(dismissOnBackPress = false, dismissOnClickOutside = false),
//   )
//
// The reference has NO title, NO icon and NO dismiss button: the body of the dialog is the linear
// progress indicator and the only action is the "Cancel" TextButton, which is the confirmButton
// and therefore renders rightmost (Box(align = End) around the AlertDialogFlowRow).
// The text slot is skipped only when `progress` is NaN, but the slot itself (and its 24dp bottom
// padding) is always part of the layout, so the button keeps the same position in both cases.
//
// MD3 AlertDialog geometry (androidx.compose.material3.AlertDialog + DialogTokens):
//   container shape CornerExtraLarge (28dp), color surfaceContainerHigh, elevation level 3,
//   container padding 24dp, text slot padding bottom 24dp, container width 280dp (DialogMinWidth,
//   propagated to the content by BasicAlertDialog) / max width 560dp, button label = labelLarge
//   (14sp/20sp, w500) in primary, button spacing 8dp.
// MD3 LinearProgressIndicator: a 240dp x 4dp canvas (coerced to the 232dp content width of the
//   dialog), active color primary, track secondary-container, round stroke caps, a 4dp gap between
//   the active bar and the track, and a 4dp stop indicator dot at the end of the track. The
//   progress is animated with ProgressIndicatorDefaults.ProgressAnimationSpec (spring, no bounce,
//   very low stiffness).

const open = defineModel<boolean>({ required: true })

const props = withDefaults(
  defineProps<{
    /** MigrationListViewModel.Dialog.Progress.progress — 0f..1f. NaN hides the indicator. */
    progress: number
    /**
     * Whether the host can actually run a migration. Suwayomi-Server exposes no migration
     * endpoint, so the dialog reports the limitation instead of pretending the work is running.
     */
    supported?: boolean
  }>(),
  { supported: false },
)

const emit = defineEmits<{ (event: 'cancel'): void }>()

/** LinearProgressIndicator canvas height (4dp) and the round stroke cap radius (height / 2). */
const INDICATOR_HEIGHT = 4
const CAP_RADIUS = INDICATOR_HEIGHT / 2
/** ProgressIndicatorDefaults.LinearIndicatorTrackGapSize (4dp) plus the round stroke cap (4dp). */
const TRACK_GAP = 8
/** Spring.StiffnessVeryLow with Spring.DampingRatioNoBouncy => a critically damped spring. */
const SPRING_OMEGA = Math.sqrt(300)

/** The animated value that is actually drawn (the reference animates it with a spring). */
const animatedProgress = ref(0)
/** The measured canvas width in px (Compose coerces the 240dp canvas to the available width). */
const canvasWidth = ref(232)
let rafId = 0
let springFrom = 0
let springTo = 0
let springStart = 0
let springInitialized = false

function stopAnimation() {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = 0
}

/**
 * Critically damped spring solved analytically: x(t) = 1 - (1 + w*t) * e^(-w*t).
 * This is the same curve Compose's SpringSpec produces for dampingRatio 1.
 */
function step(now: number) {
  const t = Math.max(0, (now - springStart) / 1000)
  const x = 1 - (1 + SPRING_OMEGA * t) * Math.exp(-SPRING_OMEGA * t)
  const value = springFrom + (springTo - springFrom) * x
  // ProgressIndicatorDefaults.ProgressAnimationSpec uses visibilityThreshold = 1/1000f.
  if (Math.abs(springTo - value) < 0.001) {
    animatedProgress.value = springTo
    rafId = 0
    return
  }
  animatedProgress.value = value
  rafId = requestAnimationFrame(step)
}

watch(
  () => props.progress,
  value => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      // The reference does not compose the indicator for a NaN progress, so the animated state is
      // disposed and the next real value starts from scratch (no animation on the first frame).
      stopAnimation()
      springInitialized = false
      return
    }
    const target = Math.min(1, Math.max(0, value))
    if (!springInitialized) {
      springInitialized = true
      stopAnimation()
      animatedProgress.value = target
      return
    }
    if (Math.abs(target - animatedProgress.value) < 0.001) return
    stopAnimation()
    springFrom = animatedProgress.value
    springTo = target
    springStart = performance.now()
    rafId = requestAnimationFrame(step)
  },
  { immediate: true },
)

onBeforeUnmount(stopAnimation)

/** The indicator is only composed for a non-NaN progress. */
const showIndicator = computed(
  () => typeof props.progress === 'number' && !Number.isNaN(props.progress),
)

/**
 * Geometry of the Compose canvas, mirrored 1:1 (all values in px):
 *   - the active line is drawn from 0 to `progress * width`; the round stroke cap (radius 2)
 *     needs that much space on both ends, so the line endpoints are clamped to [2, width - 2] and
 *     the visible bar spans [0, clampedEnd + 2];
 *   - the track starts at `progress + min(progress, gap / width)` and is drawn to the end, with the
 *     same stroke cap clamping;
 *   - the stop indicator is a 4dp dot whose center sits 2dp from the right edge of the canvas.
 */
const activeBar = computed(() => {
  const width = canvasWidth.value
  if (animatedProgress.value <= 0) return 0
  const end = Math.min(Math.max(animatedProgress.value * width, CAP_RADIUS), width - CAP_RADIUS)
  // Compose clamps both line ends into [strokeWidth / 2, width - strokeWidth / 2], so the round
  // cap of the bar always reaches the left edge of the canvas and the visible bar spans
  // [0, clampedEnd + 2]. A progress of exactly 0 draws no line at all.
  return end + CAP_RADIUS
})

const track = computed(() => {
  const width = canvasWidth.value
  const progress = animatedProgress.value * width
  const start = progress + Math.min(progress, TRACK_GAP)
  // The reference only draws the track when trackStartFraction <= 1f
  // (drawLinearIndicator is skipped otherwise).
  if (start > width) return { left: width, width: 0, hidden: true }
  const clamped = Math.min(Math.max(start, CAP_RADIUS), width - CAP_RADIUS)
  const left = clamped - CAP_RADIUS
  return { left, width: Math.max(width - left, 0), hidden: false }
})

const indicatorEl = ref<HTMLElement | null>(null)
let observer: ResizeObserver | null = null

function measure() {
  const el = indicatorEl.value
  if (el) canvasWidth.value = el.clientWidth || 232
}

watch(indicatorEl, el => {
  observer?.disconnect()
  observer = null
  if (!el || typeof ResizeObserver === 'undefined') return
  measure()
  observer = new ResizeObserver(measure)
  observer.observe(el)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

function cancel() {
  emit('cancel')
  open.value = false
}
</script>

<template>
  <!-- DialogProperties(dismissOnBackPress = false, dismissOnClickOutside = false). -->
  <v-dialog v-model="open" persistent max-width="560">
    <div class="migration-progress-dialog">
      <!--
        The text slot of the reference: only the linear progress indicator. The 24dp bottom padding
        of the slot is kept even when the indicator is not composed (NaN progress).
      -->
      <div class="migration-progress-text">
        <div
          v-if="showIndicator"
          ref="indicatorEl"
          class="migration-progress-indicator"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="1"
          :aria-valuenow="animatedProgress.toFixed(3)"
        >
          <div
            class="migration-progress-track"
            :style="{ left: `${track.left}px`, width: `${track.width}px` }"
          />
          <div class="migration-progress-bar" :style="{ width: `${activeBar}px` }" />
          <div class="migration-progress-stop" />
        </div>
        <p v-if="!supported" class="migration-progress-unsupported" role="alert">
          Migration is not supported in the web version: the Suwayomi REST API has no endpoint that
          migrates or copies entries between sources.
        </p>
      </div>

      <!-- Box(align = End): the single confirm button ("Cancel") is right aligned. -->
      <div class="migration-progress-actions">
        <button type="button" class="migration-progress-button" @click="cancel">Cancel</button>
      </div>
    </div>
  </v-dialog>
</template>

<style scoped>
@layer app-components {
  /* Surface: DialogTokens.ContainerColor = SurfaceContainerHigh, ContainerShape = CornerExtraLarge
     (28dp), ContainerElevation = Level3, container padding 24dp, width 280dp (DialogMinWidth,
     propagated to the content by BasicAlertDialog) / max width 560dp. */
  .migration-progress-dialog {
    box-sizing: border-box;
    align-self: center;
    width: fit-content;
    min-width: 280px;
    max-width: 560px;
    margin: 0 auto;
    padding: 24px;
    border-radius: 28px;
    background: rgb(var(--v-theme-surface-container-high));
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, .3), 0 4px 8px 3px rgba(0, 0, 0, .15);
  }
  /* AlertDialogDefaults.textPadding = 24dp bottom; the slot is always present. */
  .migration-progress-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding-bottom: 24px;
  }
  /* LinearProgressIndicator canvas: 240dp wide, coerced by the parent to the 232dp content width,
     4dp high. */
  .migration-progress-indicator {
    position: relative;
    width: 100%;
    max-width: 240px;
    height: 4px;
    flex: none;
  }
  .migration-progress-track {
    position: absolute;
    top: 0;
    height: 4px;
    border-radius: 2px;
    background: rgb(var(--v-theme-secondary-container));
  }
  .migration-progress-bar {
    position: absolute;
    top: 0;
    left: 0;
    height: 4px;
    border-radius: 2px;
    background: rgb(var(--v-theme-primary));
  }
  /* The stop indicator: a 4dp dot at the end of the track, drawn in the active color. */
  .migration-progress-stop {
    position: absolute;
    top: 0;
    right: 0;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgb(var(--v-theme-primary));
  }
  /* The text slot inherits the dialog supporting text style: BodyMedium (14sp/20sp, w400,
     letter spacing 0.25sp). */
  .migration-progress-unsupported {
    margin: 0;
    max-width: 100%;
    font-size: 14px;
    line-height: 20px;
    font-weight: 400;
    letter-spacing: .25px;
    text-align: start;
    color: rgb(var(--v-theme-error));
  }
  .migration-progress-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }
  /* MD3 TextButton: height 40dp, min width 58dp, content padding 12dp horizontal,
     shape = CornerFull (20dp), label = labelLarge (14sp/20sp, w500) in primary. */
  .migration-progress-button {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 58px;
    height: 40px;
    padding: 0 12px;
    border: 0;
    border-radius: 20px;
    background: transparent;
    color: rgb(var(--v-theme-primary));
    font-family: inherit;
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    letter-spacing: .1px;
    text-transform: none;
    cursor: pointer;
    overflow: hidden;
  }
  .migration-progress-button::after {
    content: '';
    position: absolute;
    inset: 0;
    background-color: currentColor;
    opacity: 0;
    transition: opacity 0.2s ease-in-out;
    pointer-events: none;
  }
  /* MD3 state layers: hover 8%, pressed 10% of the content color (primary). */
  .migration-progress-button:hover::after { opacity: 0.08; }
  .migration-progress-button:active::after { opacity: 0.1; }
  .migration-progress-button:focus-visible {
    outline: 2px solid rgb(var(--v-theme-primary));
    outline-offset: 2px;
  }
}
</style>
