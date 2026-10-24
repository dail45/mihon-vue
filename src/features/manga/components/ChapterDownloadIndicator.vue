<script setup lang="ts">
export type ChapterDownloadIndicatorState =
  | 'not-downloaded'
  | 'queue'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'NOT_DOWNLOADED'
  | 'QUEUE'
  | 'DOWNLOADING'
  | 'DOWNLOADED'
  | 'ERROR'

export type ChapterDownloadIndicatorAction =
  | 'start'
  | 'start-now'
  | 'cancel'
  | 'delete'

export type ChapterDownloadAction = 'start' | 'start-now' | 'cancel' | 'delete'
export type DownloadState = 'not-downloaded' | 'queue' | 'downloading' | 'downloaded' | 'error'

/** IndicatorWavelength = 7dp. */
const WAVELENGTH = 7
void WAVELENGTH

/**
 * Chapter download indicator.
 * Reference: mihon/app/src/main/java/eu/kanade/presentation/manga/components/ChapterDownloadIndicator.kt
 *
 * Mihon draws four states inside a 40dp (IconButtonTokens.StateLayerSize) clickable box:
 *  - NOT_DOWNLOADED: custom `download_circle` glyph, 26dp, onSurfaceVariant, the whole box dimmed
 *    to SECONDARY_ALPHA (0.78). Click starts the download, long click starts it right away.
 *  - QUEUE / DOWNLOADING: a circular indicator (26dp box, 1dp padding, 2dp round stroke,
 *    7dp wavelength, amplitude 0.6) with the custom `download_arrow` glyph (26dp) in the middle.
 *    The track is onSurfaceVariant at 25% alpha. A queued item spins without a wave,
 *    an active one waves. Click opens a menu (start now / cancel), long click cancels.
 *  - DOWNLOADED: filled `check_circle`, 26dp, onSurfaceVariant. Click or long click opens
 *    a menu with the delete action.
 *  - ERROR: `error` glyph, 26dp, colorScheme.error. Click or long click starts the download.
 *
 * The custom `download_circle` / `download_arrow` and the filled `check_circle` are not part
 * of the bundled Material Symbols font, so they are drawn inline from the Mihon icon set.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  state: ChapterDownloadIndicatorState
  /** Download progress in percent (0..100). Only used while downloading. */
  progress?: number
  /** Chapter title, used for the accessible labels. */
  chapterTitle?: string
  disabled?: boolean
  /** Compose parameter name alias for disabled (!enabled). */
  enabled?: boolean
}>(), { progress: 0, chapterTitle: '', disabled: false, enabled: undefined })

const emit = defineEmits<{ (event: 'action', action: ChapterDownloadIndicatorAction): void }>()

const isDisabled = computed(() => props.disabled || (props.enabled !== undefined && !props.enabled))

/** Mihon `mihon/icons/custom-material-symbols/.../rounded/download_circle.svg`. */
const DOWNLOAD_CIRCLE_PATH = 'M479 -680Q462 -680 450.5 -668.5Q439 -657 439 -640L439 -435L364 -511Q352 -523 335.5 -523Q319 -523 307 -511Q295 -499 294.5 -482.5Q294 -466 306 -454L451 -308Q462 -297 479 -297Q496 -297 507 -308L650 -451Q662 -463 662.5 -480Q663 -497 651 -509Q639 -521 622 -521Q605 -521 593 -509L519 -435L519 -640Q519 -657 507.5 -668.5Q496 -680 479 -680ZM480 -810C662.3 -810 810 -662.3 810 -480C810 -297.7 662.3 -150 480 -150C297.7 -150 150 -297.7 150 -480C150 -662.3 297.7 -810 480 -810ZM480 -880Q397 -880 324 -848.5Q251 -817 197 -763Q143 -709 111.5 -636Q80 -563 80 -480Q80 -397 111.5 -324Q143 -251 197 -197Q251 -143 324 -111.5Q397 -80 480 -80Q563 -80 636 -111.5Q709 -143 763 -197Q817 -251 848.5 -324Q880 -397 880 -480Q880 -563 848.5 -636Q817 -709 763 -763Q709 -817 636 -848.5Q563 -880 480 -880Z'
/** Mihon `mihon/icons/custom-material-symbols/.../rounded/download_arrow.svg`. */
const DOWNLOAD_ARROW_PATH = 'M479 -680Q462 -680 450.5 -668.5Q439 -657 439 -640L439 -435L364 -511Q352 -523 335.5 -523Q319 -523 307 -511Q295 -499 294.5 -482.5Q294 -466 306 -454L451 -308Q462 -297 479 -297Q496 -297 507 -308L650 -451Q662 -463 662.5 -480Q663 -497 651 -509Q639 -521 622 -521Q605 -521 593 -509L519 -435L519 -640Q519 -657 507.5 -668.5Q496 -680 479 -680Z'
/** Mihon `mihon/icons/material-symbols/.../roundedFilled/check_circle.svg`. */
const CHECK_CIRCLE_PATH = 'm424-408-86-86q-11-11-28-11t-28 11q-11 11-11 28t11 28l114 114q12 12 28 12t28-12l226-226q11-11 11-28t-11-28q-11-11-28-11t-28 11L424-408Zm56 328q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z'
/** Mihon `mihon/icons/material-symbols/.../rounded/error.svg`. */
const ERROR_PATH = 'M508.5-291.5Q520-303 520-320t-11.5-28.5Q497-360 480-360t-28.5 11.5Q440-337 440-320t11.5 28.5Q463-280 480-280t28.5-11.5Zm0-160Q520-463 520-480v-160q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640v160q0 17 11.5 28.5T480-440q17 0 28.5-11.5ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z'

/** IndicatorSize = 26dp. */
const INDICATOR = 26
/** IndicatorStrokeWidth = 2dp. */
const STROKE = 2
/** IndicatorPadding = 1dp. */
const PADDING = 1
/** INDICATOR_AMPLITUDE = 0.6f. */
const AMPLITUDE = 0.6
/** The wave of the indicator travels one wavelength per second. */
const PHASE_SPEED = (Math.PI * 2) / 1
/** The indeterminate arc rotates once per 1.6s. */
const ROTATION_SPEED = 360 / 1.6
/** WavyProgressIndicatorDefaults.ProgressAnimationSpec: 1000ms, FastOutSlowInEasing. */
const PROGRESS_ANIM_MS = 1000

/** The centre of the 26dp indicator box. */
const CX = INDICATOR / 2
const CY = INDICATOR / 2
/** The wavy circle: the 26dp box minus the 1dp padding and the 2dp stroke. */
const BASE_R = (INDICATOR - PADDING * 2 - STROKE) / 2

const buttonEl = ref<HTMLElement | null>(null)
const menu = ref(false)
let pressTimer: number | undefined
let longPressed = false
let startX = 0
let startY = 0

const normalizedState = computed<'not-downloaded' | 'queue' | 'downloading' | 'downloaded' | 'error'>(() => {
  const s = String(props.state || '').toLowerCase().replace(/_/g, '-')
  if (s === 'queue' || s === 'queued') return 'queue'
  if (s === 'downloading') return 'downloading'
  if (s === 'downloaded') return 'downloaded'
  if (s === 'error') return 'error'
  return 'not-downloaded'
})

const isDownloading = computed(() => normalizedState.value === 'queue' || normalizedState.value === 'downloading')
const isDownloaded = computed(() => normalizedState.value === 'downloaded')
const isError = computed(() => normalizedState.value === 'error')
const isNotDownloaded = computed(() => normalizedState.value === 'not-downloaded')

const normalizedProgress = computed(() => {
  const p = Number(props.progress)
  if (!Number.isFinite(p) || p <= 0) return 0
  if (p <= 1) return Math.round(p * 100)
  return Math.min(100, Math.round(p))
})

/** A queued item has no progress yet: Mihon draws the indeterminate indicator then. */
const indeterminate = computed(() => normalizedState.value === 'queue' || (normalizedState.value === 'downloading' && normalizedProgress.value <= 0))

const label = computed(() => {
  const suffix = props.chapterTitle ? `. ${props.chapterTitle}` : ''
  if (isDownloaded.value) return `Downloaded${suffix}`
  if (isError.value) return `Error${suffix}`
  if (isDownloading.value) {
    if (indeterminate.value) return `Downloading${suffix}`
    return `Downloading ${normalizedProgress.value}%${suffix}`
  }
  return `Download${suffix}`
})

watch(() => props.state, () => { menu.value = false })

function clearPress() {
  if (pressTimer !== undefined) {
    window.clearTimeout(pressTimer)
    pressTimer = undefined
  }
}

/* Long press (`combinedClickable(onLongClick = …)`): 500ms timeout matching Android LongPress. */
const LONG_PRESS_MS = 500

function onPointerDown(event: PointerEvent) {
  event.stopPropagation()
  if (isDisabled.value) return
  longPressed = false
  startX = event.clientX
  startY = event.clientY
  clearPress()
  pressTimer = window.setTimeout(() => {
    longPressed = true
    pressTimer = undefined
    try { navigator.vibrate?.(20) } catch { /* haptics are optional in the browser */ }
    if (isDownloaded.value) {
      menu.value = true
      return
    }
    if (isNotDownloaded.value) {
      emit('action', 'start-now')
      return
    }
    if (isDownloading.value) {
      emit('action', 'cancel')
      return
    }
    if (isError.value) {
      emit('action', 'start')
    }
  }, LONG_PRESS_MS)
}

function onPointerMove(event: PointerEvent) {
  if (pressTimer !== undefined) {
    const dist = Math.hypot(event.clientX - startX, event.clientY - startY)
    if (dist > 8) {
      clearPress()
    }
  }
}

function onPointerUp() {
  clearPress()
}

function onClick(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  if (isDisabled.value) return
  if (longPressed) {
    longPressed = false
    return
  }
  if (isDownloading.value || isDownloaded.value) {
    menu.value = true
    return
  }
  emit('action', 'start')
}

function onMenuAction(action: ChapterDownloadIndicatorAction) {
  menu.value = false
  emit('action', action)
}

/* --- The circular wavy progress indicator ------------------------------------------------------------ */

const trackEl = ref<SVGPathElement | null>(null)
const progressEl = ref<SVGPathElement | null>(null)

/**
 * A wavy circular arc matching Jetpack Compose M3 CircularWavyProgressIndicator.
 *
 * Base geometry:
 *  - IndicatorSize = 26dp
 *  - IndicatorPadding = 1dp
 *  - IndicatorStrokeWidth = 2dp
 *  - Center (13, 13)
 *  - Base radius = (26 - 1*2 - 2) / 2 = 11dp
 *
 * Periodic wave:
 *  - IndicatorWavelength = 7dp
 *  - Circumference = 2 * PI * 11 ≈ 69.115dp
 *  - Integer wave count N = round(69.115 / 7) = 10 waves per circumference
 *  - Effective wavelength = 6.91dp (~7dp), which ensures that the full 360-degree
 *    track closes seamlessly with zero phase mismatch or kink.
 *  - Amplitude = 0.6dp (INDICATOR_AMPLITUDE).
 */
function wavyArc(startDeg: number, sweepDeg: number, amplitude: number, phase: number) {
  const steps = Math.max(24, Math.ceil(Math.abs(sweepDeg) * 0.75))
  const points: string[] = []
  const N_WAVES = 10
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const currentDeg = startDeg + sweepDeg * t
    const angleRad = (currentDeg * Math.PI) / 180
    const waveR = amplitude > 0
      ? amplitude * Math.sin(angleRad * N_WAVES + phase)
      : 0
    const r = BASE_R + waveR
    const x = (CX + r * Math.cos(angleRad)).toFixed(2)
    const y = (CY + r * Math.sin(angleRad)).toFixed(2)
    points.push(`${x},${y}`)
  }
  const isFullCircle = Math.abs(sweepDeg) >= 359.5
  return `M${points.join(' L')}${isFullCircle ? ' Z' : ''}`
}

let raf = 0
let phase = 0
let rotation = 0
let lastFrame = 0
/** The animated progress of the determinate indicator. */
let shownProgress = 0
let progressFrom = 0
let progressTo = 0
let progressStart = 0

function easeInOut(value: number) {
  // FastOutSlowInEasing (MD3), the easing of WavyProgressIndicatorDefaults.ProgressAnimationSpec.
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2
}

function syncProgressTarget() {
  const target = Math.min(100, Math.max(0, normalizedProgress.value)) / 100
  if (target === progressTo) return
  progressFrom = shownProgress
  progressTo = target
  progressStart = performance.now()
}

watch(normalizedProgress, () => { if (!indeterminate.value) syncProgressTarget() })
watch(indeterminate, (value) => { if (!value) syncProgressTarget() })

function frame(now: number) {
  const delta = lastFrame ? (now - lastFrame) / 1000 : 0
  lastFrame = now
  phase = (phase + delta * PHASE_SPEED) % (Math.PI * 2)
  rotation = (rotation + delta * ROTATION_SPEED) % 360

  if (!indeterminate.value) {
    const t = progressTo === progressFrom ? 1 : Math.min(1, (now - progressStart) / PROGRESS_ANIM_MS)
    shownProgress = progressFrom + (progressTo - progressFrom) * easeInOut(t)
  }

  if (isDownloading.value) {
    if (indeterminate.value) {
      // The indeterminate indicator: an arc that rotates.
      // A queued item has no wave (amplitude = 0f), an active one waves (amplitude = 0.6f).
      const amplitude = normalizedState.value === 'downloading' ? AMPLITUDE : 0
      if (trackEl.value) trackEl.value.setAttribute('d', '')
      if (progressEl.value) {
        progressEl.value.setAttribute('d', wavyArc(-90 + rotation, 270, amplitude, phase))
      }
    } else {
      if (trackEl.value) trackEl.value.setAttribute('d', wavyArc(-90, 360, AMPLITUDE, phase))
      if (progressEl.value) {
        const sweep = 360 * shownProgress
        progressEl.value.setAttribute('d', sweep <= 0.01 ? '' : wavyArc(-90, sweep, AMPLITUDE, phase))
      }
    }
  }
  raf = requestAnimationFrame(frame)
}

function startAnimation() {
  if (raf) return
  lastFrame = 0
  shownProgress = Math.min(100, Math.max(0, normalizedProgress.value)) / 100
  progressFrom = shownProgress
  progressTo = shownProgress
  syncProgressTarget()
  raf = requestAnimationFrame(frame)
}

function stopAnimation() {
  if (raf) {
    cancelAnimationFrame(raf)
    raf = 0
  }
}

watch(isDownloading, (value) => {
  if (value) startAnimation()
  else stopAnimation()
}, { immediate: true })

onBeforeUnmount(stopAnimation)
</script>

<template>
  <div class="chapter-download" :class="[`is-${normalizedState}`, { 'is-disabled': isDisabled }]">
    <button
      ref="buttonEl"
      type="button"
      class="chapter-download-button"
      :aria-label="label"
      :title="isDownloading && !indeterminate ? `${normalizedProgress}%` : undefined"
      :disabled="isDisabled"
      @click.stop.prevent="onClick"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
      @pointercancel="onPointerUp"
      @contextmenu.prevent
    >
      <!-- Ripple(bounded = false, radius = StateLayerSize / 2 = 20dp): an unbounded circle. -->
      <span class="chapter-download-ripple" aria-hidden="true" />

      <!-- QUEUE / DOWNLOADING: the circular indicator with the arrow in the middle. -->
      <span v-if="isDownloading" class="chapter-download-ring" aria-hidden="true">
        <svg :width="INDICATOR" :height="INDICATOR" viewBox="0 0 26 26">
          <!-- The track is transparent while the indicator is indeterminate. -->
          <path
            ref="trackEl"
            class="chapter-download-track"
            :class="{ 'is-hidden': indeterminate }"
            fill="none"
            :stroke-width="STROKE"
            stroke-linecap="round"
          />
          <path
            ref="progressEl"
            class="chapter-download-progress"
            fill="none"
            :stroke-width="STROKE"
            stroke-linecap="round"
          />
        </svg>
        <svg class="chapter-download-arrow" :width="INDICATOR" :height="INDICATOR" viewBox="0 -960 960 960" aria-hidden="true">
          <path :d="DOWNLOAD_ARROW_PATH" fill="currentColor" />
        </svg>
      </span>

      <!-- NOT_DOWNLOADED: custom download_circle glyph. -->
      <svg v-else-if="isNotDownloaded" :width="INDICATOR" :height="INDICATOR" viewBox="0 -960 960 960" aria-hidden="true">
        <path :d="DOWNLOAD_CIRCLE_PATH" fill="currentColor" />
      </svg>

      <!-- DOWNLOADED: filled check_circle. -->
      <svg v-else-if="isDownloaded" :width="INDICATOR" :height="INDICATOR" viewBox="0 -960 960 960" aria-hidden="true">
        <path :d="CHECK_CIRCLE_PATH" fill="currentColor" />
      </svg>

      <!-- ERROR: error glyph in the error color. -->
      <svg v-else :width="INDICATOR" :height="INDICATOR" viewBox="0 -960 960 960" aria-hidden="true">
        <path :d="ERROR_PATH" fill="currentColor" />
      </svg>
    </button>

    <!--
      Mihon `DropdownMenu(minWidth = 196.dp, maxWidth = 196.dp, offset = DpOffset(8.dp, (-56).dp))`.
      Matches Compose DropdownMenu with M3 styling and exact string resources.
    -->
    <v-menu
      v-model="menu"
      :activator="buttonEl ?? undefined"
      location="bottom end"
      :offset="[-8, 0]"
      min-width="196"
      max-width="196"
    >
      <v-list class="chapter-download-menu" density="compact">
        <!-- MR.strings.action_start_downloading_now: "Start downloading now" -->
        <v-list-item v-if="isDownloading" title="Start downloading now" @click="onMenuAction('start-now')" />
        <!-- MR.strings.action_cancel: "Cancel" -->
        <v-list-item v-if="isDownloading" title="Cancel" @click="onMenuAction('cancel')" />
        <!-- MR.strings.action_delete: "Delete" -->
        <v-list-item v-if="isDownloaded" title="Delete" @click="onMenuAction('delete')" />
      </v-list>
    </v-menu>
  </div>
</template>

<style scoped>
@layer app-components {
.chapter-download {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  /* MangaChapterListItem.kt: Modifier.padding(start = 4.dp) on the indicator. */
  margin-inline-start: 4px;
}
.chapter-download-button {
  position: relative;
  /* IconButtonTokens.StateLayerSize = 40.dp */
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
/* M3 minimum interactive component size = 48x48dp */
.chapter-download-button::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 48px;
  height: 48px;
  transform: translate(-50%, -50%);
  pointer-events: auto;
}
/* NotDownloadedIndicator.kt applies secondaryItemAlpha() (0.78) to the whole box. */
.chapter-download.is-not-downloaded {
  opacity: 0.78;
}
/* ErrorIndicator.kt tints the icon with MaterialTheme.colorScheme.error. */
.chapter-download.is-error .chapter-download-button {
  color: rgb(var(--v-theme-error));
}
.chapter-download-button svg {
  flex: none;
}
/* Ripple(bounded = false, radius = StateLayerSize / 2 = 20dp): 40x40 circle. */
.chapter-download-ripple {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40px;
  height: 40px;
  margin: -20px 0 0 -20px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms linear;
}
.chapter-download-button:hover:not(:active) .chapter-download-ripple {
  opacity: 0.08;
}
.chapter-download-button:active .chapter-download-ripple {
  opacity: 0.12;
}
.chapter-download-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
/* A disabled indicator keeps its colors (Mihon only disables the click, not the glyph). */
.chapter-download.is-disabled .chapter-download-button {
  cursor: default;
  pointer-events: none;
}
.chapter-download.is-disabled .chapter-download-ripple {
  display: none;
}
.chapter-download-ring {
  position: relative;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.chapter-download-ring svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 26px;
  height: 26px;
}
/* The track of the determinate indicator: onSurfaceVariant at TRACK_ALPHA (0.25). */
.chapter-download-track {
  stroke: currentColor;
  opacity: 0.25;
}
/* CircularWavyProgressIndicator(trackColor = Color.Transparent) while indeterminate. */
.chapter-download-track.is-hidden {
  opacity: 0;
}
.chapter-download-progress {
  stroke: currentColor;
}
.chapter-download-arrow {
  position: relative;
}
}
</style>

<style>
/* Mihon: MD3 `DropdownMenu` (minWidth = maxWidth = 196dp, shape = CornerExtraSmall 4dp, surfaceContainer). */
.v-overlay__content .v-list.chapter-download-menu {
  width: 196px;
  min-width: 196px;
  max-width: 196px;
  padding: 8px 0;
  border-radius: 4px;
  background: rgb(var(--v-theme-surface-container)) !important;
  color: rgb(var(--v-theme-on-surface)) !important;
  box-shadow: 0 3px 6px 2px rgba(0, 0, 0, 0.15), 0 1px 3px 0 rgba(0, 0, 0, 0.3) !important;
}

/* Mihon: MD3 `DropdownMenuItem` text = bodyLarge (16sp), font weight Normal, 48dp row. */
.v-overlay__content .v-list.chapter-download-menu .v-list-item {
  min-height: 48px;
  padding: 0 12px;
  color: rgb(var(--v-theme-on-surface)) !important;
  cursor: pointer;
}

.v-overlay__content .v-list.chapter-download-menu .v-list-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.08);
}

.v-overlay__content .v-list.chapter-download-menu .v-list-item:active {
  background-color: rgba(var(--v-theme-on-surface), 0.12);
}

.v-overlay__content .v-list.chapter-download-menu .v-list-item-title {
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.03125em;
  color: rgb(var(--v-theme-on-surface));
}
</style>
