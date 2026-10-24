<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { useTabletUi } from '../../composables/useTabletUi'
import { READER_NAVIGATOR_ICONS } from './readerIcons'

/**
 * Mirrors Mihon's `ChapterNavigator`
 * (mihon/app/src/main/java/eu/kanade/presentation/reader/components/ChapterNavigator.kt).
 */
const ChapterNavigatorType = {
  HORIZONTAL_LTR: 'horizontal-ltr',
  HORIZONTAL_RTL: 'horizontal-rtl',
  VERTICAL_LEFT: 'vertical-left',
  VERTICAL_RIGHT: 'vertical-right',
} as const

export type ChapterNavigatorType =
  | 'horizontal-ltr'
  | 'horizontal-rtl'
  | 'vertical-left'
  | 'vertical-right'
  | 'HORIZONTAL_LTR'
  | 'HORIZONTAL_RTL'
  | 'VERTICAL_LEFT'
  | 'VERTICAL_RIGHT'

const props = withDefaults(
  defineProps<{
    /** Layout variant; drives orientation and RTL handling. */
    type?: ChapterNavigatorType
    /** 1-based page currently shown (Mihon: `state.currentPage`). */
    currentPage: number
    /** Number of pages in the chapter (Mihon: `state.totalPages`, -1 when unknown). */
    totalPages: number
    enabledNext?: boolean
    enabledPrevious?: boolean
  }>(),
  {
    type: 'horizontal-ltr',
    enabledNext: true,
    enabledPrevious: true,
  },
)

const emit = defineEmits<{
  (event: 'next-chapter'): void
  (event: 'previous-chapter'): void
  /** 0-based page index, matching Mihon's `onPageIndexChange`. */
  (event: 'page-index-change', index: number): void
  (event: 'page-index-change-finished'): void
  (event: 'nextChapter'): void
  (event: 'previousChapter'): void
  (event: 'pageIndexChange', index: number): void
  (event: 'pageIndexChangeFinished'): void
}>()

function emitNext() {
  emit('next-chapter')
  emit('nextChapter')
}

function emitPrevious() {
  emit('previous-chapter')
  emit('previousChapter')
}

function emitPageIndexChange(pageIndex: number) {
  emit('page-index-change', pageIndex)
  emit('pageIndexChange', pageIndex)
}

function emitPageIndexChangeFinished() {
  emit('page-index-change-finished')
  emit('pageIndexChangeFinished')
}

const theme = useTheme()
const tablet = useTabletUi()

const normalizedType = computed(() => {
  const t = (props.type || 'horizontal-ltr').toLowerCase().replace(/_/g, '-')
  if (t === 'vertical-left' || t === 'vertical-right' || t === 'horizontal-rtl') return t
  return 'horizontal-ltr'
})

const isHorizontal = computed(() => normalizedType.value === 'horizontal-ltr' || normalizedType.value === 'horizontal-rtl')
const isRtl = computed(() => normalizedType.value === 'horizontal-rtl')

/** Kotlin: `val state = if (totalPages > 1) { ... } else null` */
const hasSlider = computed(() => props.totalPages > 1)

/** Kotlin: `val mainAxisPadding = if (isTabletUi) 24.dp else 8.dp` */
const mainAxisPadding = computed(() => (tablet.value ? 24 : 8))

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '').trim()
  const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value
  const int = Number.parseInt(full.slice(0, 6), 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

/**
 * Kotlin:
 *   MaterialTheme.colorScheme.surfaceColorAtElevation(3.dp)
 *     .copy(alpha = if (isSystemInDarkTheme()) 0.9f else 0.95f)
 * `surfaceColorAtElevation` composites the surface tint over the surface with
 * `alpha = ((4.5 * ln(elevation + 1)) + 2) / 100` = 8.238 % for 3.dp.
 */
const palette = computed(() => {
  const colors = theme.current.value.colors as Record<string, string>
  const surface = hexToRgb(colors.surface ?? '#1B1B1F')
  const tint = hexToRgb(colors['surface-tint'] ?? colors.primary ?? '#B0C6FF')
  const alpha = ((4.5 * Math.log(4)) + 2) / 100
  const mixed = surface.map((channel, index) => Math.round(tint[index] * alpha + channel * (1 - alpha)))
  const dark = theme.current.value.dark
  return {
    background: `rgba(${mixed.join(', ')}, ${dark ? 0.9 : 0.95})`,
    // `contentColorFor(backgroundColor)` does not match the surface tokens, so the icon/text colour
    // stays `LocalContentColor` = onBackground (Mihon's `setComposeContent`).
    content: colors['on-background'] ?? colors['on-surface'] ?? '#E3E2E6',
    primary: colors.primary ?? '#B0C6FF',
    // Material3 `SliderDefaults.colors` (compose material3 SliderDefaults):
    //   thumbColor         = HandleColor        = primary,
    //   activeTrackColor   = ActiveTrackColor   = primary,
    //   activeTickColor    = InactiveTrackColor = secondaryContainer,
    //   inactiveTrackColor = InactiveTrackColor = secondaryContainer,
    //   inactiveTickColor  = ActiveTrackColor   = primary.
    secondaryContainer: colors['secondary-container'] ?? '#00429B',
  }
})

/* ------------------------------------------------------------------ slider */

const dragging = ref(false)
const dragPage = ref<number | null>(null)

/** Current effective page, responsive during dragging without parent state delay. */
const effectivePage = computed(() => {
  if (dragging.value && dragPage.value !== null) return dragPage.value
  return props.currentPage
})

/**
 * Kotlin: `trackRange = 1f..totalPages.toFloat()`, value is 1-based.
 * `SliderState` snaps the value to the step grid, so the fraction is exact.
 */
const fraction = computed(() => {
  if (!hasSlider.value || props.totalPages <= 1) return 0
  const value = Math.min(props.totalPages, Math.max(1, effectivePage.value || 1))
  return (value - 1) / (props.totalPages - 1)
})

/**
 * Kotlin: `steps = totalPages - 2` and `stepsToTickFractions(steps)` returns
 * `FloatArray(steps + 2) { it / (steps + 1) }`, i.e. the fractions
 * `0, 1/(totalPages-1), …, (totalPages-2)/(totalPages-1), 1`.
 * The last fraction is the track stop indicator and is never drawn as a tick.
 */
const ticks = computed(() => {
  if (!hasSlider.value || props.totalPages <= 1) return []
  const denominator = props.totalPages - 1
  const count = props.totalPages - 2
  const interior = Array.from({ length: count }, (_, index) => (index + 1) / denominator)
  return [0, ...interior]
})

/**
 * The track geometry is computed the way compose material3 computes it, so the web slider is
 * pixel-identical to the native one:
 *
 * - the track canvas is the slider box minus the 4.dp handle (`SliderImpl` measures the track with
 *   `constraints.offset(horizontal = -thumbWidth)`), i.e. 2.dp narrower on each side;
 * - `cornerSize` = half the track height = 8.dp (`TrackHeight` = 16.dp);
 * - the value end inside the canvas is
 *   `(canvasSize - 2 * cornerSize) * fraction + cornerSize`, except on the first and the last step
 *   where it is `canvasSize * fraction`;
 * - the handle centre is that value end, the handle is 4.dp x 44.dp and keeps a 6.dp gap
 *   (`ActiveHandleLeadingSpace`) to the track, so the active segment ends and the inactive segment
 *   starts 8.dp away from the handle centre;
 * - ticks sit at `lerp(cornerSize, canvasSize - cornerSize, tickFraction)`, the ones falling into
 *   the handle gap are not drawn, and the last one is replaced by the stop indicator.
 */
const CORNER = 8
const HANDLE_GAP = 8
const railEl = ref<HTMLElement | null>(null)
const railSize = ref(0)
let railObserver: ResizeObserver | null = null

function updateRailSize() {
  const element = railEl.value
  if (!element) return
  railSize.value = isHorizontal.value ? element.clientWidth : element.clientHeight
}

function observeRail() {
  railObserver?.disconnect()
  railObserver = null
  const element = railEl.value
  if (!element || typeof ResizeObserver === 'undefined') return
  updateRailSize()
  railObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return
    railSize.value = isHorizontal.value ? entry.contentRect.width : entry.contentRect.height
  })
  railObserver.observe(element)
}

onMounted(() => {
  observeRail()
  nextTick(updateRailSize)
})
onBeforeUnmount(() => railObserver?.disconnect())
watch(railEl, observeRail)
watch(() => props.type, () => nextTick(updateRailSize))

/** Kotlin: `sliderValueEnd` inside the track canvas. */
const valueEnd = computed(() => {
  const size = railSize.value
  const value = fraction.value
  if (value <= 0) return 0
  if (value >= 1) return size
  return (size - 2 * CORNER) * value + CORNER
})

/**
 * Kotlin: `activeTrackEnd = sliderValueEnd - endGap`, drawn from the canvas start, and it is only
 * drawn when it is longer than its corner radius (`activeTrackWidth > activeTrackThreshold`).
 */
const activeStyle = computed(() => {
  const length = valueEnd.value - HANDLE_GAP
  const size = length > CORNER ? length : 0
  return isHorizontal.value
    ? { width: `${size}px` }
    : { height: `${size}px` }
})

/**
 * Kotlin: the inactive track runs from `sliderValueEnd + endGap` to the canvas end and is only
 * drawn while the value is short of the end (`adjustedSliderValueStart < inactiveTrackThreshold`).
 */
const inactiveStyle = computed(() => {
  const size = railSize.value
  const start = Math.min(size, valueEnd.value + HANDLE_GAP)
  const length = Math.max(0, size - start)
  return isHorizontal.value
    ? { left: `${start}px`, width: `${length}px` }
    : { top: `${start}px`, height: `${length}px` }
})

/** Kotlin: the handle centre is the value end; the handle is 4.dp wide. */
const thumbStyle = computed(() => {
  const offset = valueEnd.value - 2
  return isHorizontal.value
    ? { left: `${offset}px` }
    : { top: `${offset}px` }
})

/**
 * Kotlin: `centerTick = lerp(cornerSize, canvasSize - cornerSize, tick)` and the ticks that fall
 * into the handle gap (`tickEndGap`) or onto the stop indicator are skipped.
 */
function tickStyle(tick: number): Record<string, string> {
  const size = railSize.value
  const position = size ? CORNER + Math.max(0, size - 2 * CORNER) * tick : 0
  return isHorizontal.value
    ? { left: `${position}px` }
    : { top: `${position}px` }
}

function tickState(tick: number): { visible: boolean, active: boolean } {
  const size = railSize.value
  const active = tick <= fraction.value
  if (!size) return { visible: true, active }
  const position = CORNER + Math.max(0, size - 2 * CORNER) * tick
  // Kotlin: `if (centerTick in tickEndGap) return@forEachIndexed` — the ticks that fall into the
  // gap the handle leaves around itself are not drawn.
  const inGap = Math.abs(position - valueEnd.value) <= HANDLE_GAP
  return { visible: !inGap, active }
}

/**
 * Kotlin: the stop indicator is drawn at the canvas end (`end - cornerSize`) with the active track
 * colour and only while the inactive track is drawn.
 */
const stopStyle = computed(() => {
  const size = railSize.value
  const offset = Math.max(0, size - CORNER - 2)
  return isHorizontal.value
    ? { left: `${offset}px` }
    : { top: `${offset}px` }
})

const stopVisible = computed(() => {
  const size = railSize.value
  if (!size) return false
  return valueEnd.value < size - 2 * CORNER
})

/**
 * Kotlin: `haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)` on every page change
 * while the slider is dragged (`LaunchedEffect(currentPage) { if (sliderDragged) ... }`).
 */
let lastHapticPage = props.currentPage

function hapticTick() {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  navigator.vibrate(10)
}

watch(() => props.currentPage, (newPage) => {
  if (dragging.value && newPage !== lastHapticPage) {
    lastHapticPage = newPage
    hapticTick()
  }
})

function fractionFromPointer(event: PointerEvent): number {
  const element = railEl.value || (event.currentTarget as HTMLElement)
  const rect = element.getBoundingClientRect()
  let value = 0
  if (isHorizontal.value) {
    value = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0
  } else {
    value = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0
  }
  value = Math.min(1, Math.max(0, value))
  // Kotlin: the horizontal slider honours LocalLayoutDirection, the vertical one does not.
  return isRtl.value ? 1 - value : value
}

function applyFraction(value: number) {
  if (!hasSlider.value) return
  const page = Math.min(props.totalPages, Math.max(1, Math.round(value * (props.totalPages - 1)) + 1))
  dragPage.value = page
  if (dragging.value && page !== lastHapticPage) {
    lastHapticPage = page
    hapticTick()
  }
  emitPageIndexChange(page - 1)
}

function onPointerDown(event: PointerEvent) {
  if (!hasSlider.value) return
  event.stopPropagation()
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  dragging.value = true
  applyFraction(fractionFromPointer(event))
}

function onPointerMove(event: PointerEvent) {
  if (!hasSlider.value) return
  if (!(event.currentTarget as HTMLElement).hasPointerCapture?.(event.pointerId)) return
  event.stopPropagation()
  applyFraction(fractionFromPointer(event))
}

function onPointerUp(event: PointerEvent) {
  if (!hasSlider.value) return
  const element = event.currentTarget as HTMLElement
  if (element.hasPointerCapture?.(event.pointerId)) {
    element.releasePointerCapture(event.pointerId)
  }
  event.stopPropagation()
  applyFraction(fractionFromPointer(event))
  dragging.value = false
  dragPage.value = null
  emitPageIndexChangeFinished()
}

/**
 * Kotlin `slideOnKeyEvents`: the step size is `rangeLength / (steps + 1)` = one page,
 * Home/End jump to the track ends, PageUp/PageDown move by `actualSteps / 10` pages
 * (clamped to 1..10).
 */
function onKeydown(event: KeyboardEvent) {
  if (!hasSlider.value) return
  const last = props.totalPages
  const actualSteps = Math.max(1, last - 1)
  const pageSteps = Math.min(10, Math.max(1, Math.floor(actualSteps / 10)))
  const reverse = isHorizontal.value ? isRtl.value : false
  let target: number | null = null
  if (event.key === 'Home') target = 1
  else if (event.key === 'End') target = last
  else if (isHorizontal.value) {
    if (event.key === 'ArrowRight') target = props.currentPage + (reverse ? -1 : 1)
    if (event.key === 'ArrowLeft') target = props.currentPage - (reverse ? -1 : 1)
    if (event.key === 'PageUp') target = props.currentPage + pageSteps
    if (event.key === 'PageDown') target = props.currentPage - pageSteps
  } else {
    if (event.key === 'ArrowDown') target = props.currentPage + 1
    if (event.key === 'ArrowUp') target = props.currentPage - 1
    if (event.key === 'PageDown') target = props.currentPage + pageSteps
    if (event.key === 'PageUp') target = props.currentPage - pageSteps
  }
  if (target === null) return
  event.preventDefault()
  const clamped = Math.min(last, Math.max(1, target))
  dragPage.value = clamped
  emitPageIndexChange(clamped - 1)
}

function onKeyup(event: KeyboardEvent) {
  if (!hasSlider.value) return
  if (['Home', 'End', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(event.key)) {
    dragPage.value = null
    emitPageIndexChangeFinished()
  }
}
</script>

<template>
  <div
    class="chapter-navigator"
    :class="[
      `chapter-navigator--${normalizedType}`,
      isHorizontal ? 'chapter-navigator--horizontal' : 'chapter-navigator--vertical',
    ]"
    :style="{
      '--cn-main-padding': `${mainAxisPadding}px`,
      '--cn-background': palette.background,
      '--cn-content': palette.content,
      '--cn-primary': palette.primary,
      '--cn-secondary-container': palette.secondaryContainer,
    }"
    @pointerdown.stop
    @mousedown.stop
    @touchstart.stop
    @click.stop
  >
    <!-- Horizontal: previous (left), slider surface, next (right). The outer row stays LTR. -->
    <template v-if="isHorizontal">
      <button
        type="button"
        class="cn-button"
        :disabled="isRtl ? !enabledNext : !enabledPrevious"
        :aria-label="isRtl ? 'Next chapter' : 'Previous chapter'"
        :title="isRtl ? 'Next chapter' : 'Previous chapter'"
        @click="isRtl ? emitNext() : emitPrevious()"
      >
        <svg
          class="cn-button__icon"
          viewBox="0 -960 960 960"
          width="24"
          height="24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path :d="READER_NAVIGATOR_ICONS.skipPrevious" />
        </svg>
      </button>

      <div v-if="hasSlider" class="cn-surface cn-surface--horizontal" :dir="isRtl ? 'rtl' : 'ltr'">
        <span class="cn-number">
          <span class="cn-number__value">{{ effectivePage }}</span>
          <span class="cn-number__ghost" aria-hidden="true">{{ totalPages }}</span>
        </span>
        <div
          class="cn-slider cn-slider--horizontal"
          :class="{ 'cn-slider--rtl': isRtl }"
          role="slider"
          tabindex="0"
          aria-label="Page position"
          aria-valuemin="1"
          :aria-valuemax="totalPages"
          :aria-valuenow="effectivePage"
          :aria-valuetext="`Page ${effectivePage} of ${totalPages}`"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @lostpointercapture="onPointerUp"
          @keydown="onKeydown"
          @keyup="onKeyup"
        >
          <div ref="railEl" class="cn-slider__rail">
            <div class="cn-slider__active" :style="activeStyle" />
            <div class="cn-slider__inactive" :style="inactiveStyle" />
            <span
              v-for="(tick, index) in ticks"
              v-show="tickState(tick).visible"
              :key="index"
              class="cn-slider__tick"
              :class="{ 'cn-slider__tick--active': tickState(tick).active }"
              :style="tickStyle(tick)"
            />
            <span v-show="stopVisible" class="cn-slider__stop" :style="stopStyle" />
            <div class="cn-slider__thumb" :style="thumbStyle" />
          </div>
        </div>
        <span class="cn-number cn-number--plain">{{ totalPages }}</span>
      </div>
      <div v-else class="cn-spacer" />

      <button
        type="button"
        class="cn-button"
        :disabled="isRtl ? !enabledPrevious : !enabledNext"
        :aria-label="isRtl ? 'Previous chapter' : 'Next chapter'"
        :title="isRtl ? 'Previous chapter' : 'Next chapter'"
        @click="isRtl ? emitPrevious() : emitNext()"
      >
        <svg
          class="cn-button__icon"
          viewBox="0 -960 960 960"
          width="24"
          height="24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path :d="READER_NAVIGATOR_ICONS.skipNext" />
        </svg>
      </button>
    </template>

    <!-- Vertical: previous (top), slider surface, next (bottom). -->
    <template v-else>
      <button
        type="button"
        class="cn-button"
        :disabled="!enabledPrevious"
        aria-label="Previous chapter"
        title="Previous chapter"
        @click="emitPrevious()"
      >
        <svg
          class="cn-button__icon cn-button__icon--rotated"
          viewBox="0 -960 960 960"
          width="24"
          height="24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path :d="READER_NAVIGATOR_ICONS.skipPrevious" />
        </svg>
      </button>

      <div v-if="hasSlider" class="cn-surface cn-surface--vertical">
        <span class="cn-number cn-number--plain">{{ effectivePage }}</span>
        <div
          class="cn-slider cn-slider--vertical"
          role="slider"
          tabindex="0"
          aria-label="Page position"
          aria-valuemin="1"
          :aria-valuemax="totalPages"
          :aria-valuenow="effectivePage"
          :aria-valuetext="`Page ${effectivePage} of ${totalPages}`"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @lostpointercapture="onPointerUp"
          @keydown="onKeydown"
          @keyup="onKeyup"
        >
          <div ref="railEl" class="cn-slider__rail">
            <div class="cn-slider__active" :style="activeStyle" />
            <div class="cn-slider__inactive" :style="inactiveStyle" />
            <span
              v-for="(tick, index) in ticks"
              v-show="tickState(tick).visible"
              :key="index"
              class="cn-slider__tick"
              :class="{ 'cn-slider__tick--active': tickState(tick).active }"
              :style="tickStyle(tick)"
            />
            <span v-show="stopVisible" class="cn-slider__stop" :style="stopStyle" />
            <div class="cn-slider__thumb" :style="thumbStyle" />
          </div>
        </div>
        <span class="cn-number cn-number--plain">{{ totalPages }}</span>
      </div>
      <div v-else class="cn-spacer" />

      <button
        type="button"
        class="cn-button"
        :disabled="!enabledNext"
        aria-label="Next chapter"
        title="Next chapter"
        @click="emitNext()"
      >
        <svg
          class="cn-button__icon cn-button__icon--rotated"
          viewBox="0 -960 960 960"
          width="24"
          height="24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path :d="READER_NAVIGATOR_ICONS.skipNext" />
        </svg>
      </button>
    </template>
  </div>
</template>

<style scoped>
@layer app-components {
/*
 * ChapterNavigator.kt
 *   Row(modifier.fillMaxWidth().padding(horizontal = mainAxisPadding), CenterVertically)
 *   Column(modifier.fillMaxHeight().padding(vertical = mainAxisPadding), CenterHorizontally)
 * mainAxisPadding = 24.dp on tablets, 8.dp otherwise.
 */
.chapter-navigator {
  color: var(--cn-content);
  font-family: var(--v-font-body, Roboto, sans-serif);
  user-select: none;
  -webkit-user-select: none;
  box-sizing: border-box;
}

.chapter-navigator--horizontal {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  padding-inline: var(--cn-main-padding);
  box-sizing: border-box;
}

.chapter-navigator--vertical {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  padding-block: var(--cn-main-padding);
  box-sizing: border-box;
}

/*
 * FilledIconButton: `.size(IconButtonDefaults.smallContainerSize())` = 40.dp,
 * `minimumInteractiveComponentSize` = 48.dp, `.clip(filledShape)` = fully rounded,
 * `.background(containerColor)` = reader background colour,
 * content colour = LocalContentColor (onBackground).
 * Icon = Material Symbols Rounded SkipPrevious / SkipNext, 24.dp.
 */
.cn-button {
  position: relative;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  min-width: 40px;
  margin-inline: 4px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--cn-background);
  color: var(--cn-content);
  cursor: pointer;
  overflow: visible;
  -webkit-tap-highlight-color: transparent;
  box-sizing: border-box;
}

.chapter-navigator--vertical .cn-button {
  margin-inline: 0;
  margin-block: 4px;
}

/* Minimum interactive component size: 48x48dp footprint */
.cn-button::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 48px;
  height: 48px;
  transform: translate(-50%, -50%);
  min-width: 48px;
  min-height: 48px;
  pointer-events: auto;
}

.cn-button__icon {
  display: block;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  pointer-events: none;
}

/* Kotlin: `Modifier.rotate(90f)` on the vertical navigator icons. */
.cn-button__icon--rotated {
  transform: rotate(90deg);
}

/* Compose ripple equivalent for hover/press. */
.cn-button::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: currentColor;
  opacity: 0;
  transition: opacity 120ms ease;
  pointer-events: none;
}

.cn-button:hover:not(:disabled)::after {
  opacity: 0.08;
}

.cn-button:active:not(:disabled)::after {
  opacity: 0.12;
}

.cn-button:focus-visible {
  outline: 2px solid var(--cn-content);
  outline-offset: 2px;
}

/* Kotlin: disabled content colour = onSurface at DisabledOpacity (0.38); the container
   keeps the reader background colour (`disabledContainerColor = backgroundColor`). */
.cn-button:disabled {
  cursor: default;
}

.cn-button:disabled .cn-button__icon {
  opacity: 0.38;
}

/*
 * The rounded slider surface:
 *   Row(Modifier.weight(1f).clip(RoundedCornerShape(24.dp)).background(backgroundColor)
 *        .padding(horizontal = 16.dp), CenterVertically)
 *   Column(Modifier.weight(1f).clip(RoundedCornerShape(24.dp)).background(backgroundColor)
 *        .padding(vertical = 16.dp), CenterHorizontally)
 */
.cn-surface {
  background: var(--cn-background);
  border-radius: 24px;
  box-sizing: border-box;
}

.cn-surface--horizontal {
  flex: 1 1 auto;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-inline: 16px;
  min-width: 0;
  height: 48px;
  min-height: 48px;
}

.cn-surface--vertical {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-block: 16px;
  min-height: 0;
  width: 48px;
  min-width: 48px;
}

/* Kotlin: `Spacer(Modifier.weight(1f))` when there is no slider. */
.cn-spacer {
  flex: 1 1 auto;
}

/*
 * Kotlin: plain `Text` uses MaterialTheme.typography.bodyLarge
 * (16.sp / 24.sp, weight Normal, letterSpacing 0.5.sp) and LocalContentColor.
 */
.cn-number {
  position: relative;
  display: grid;
  justify-items: end;
  align-items: center;
  flex: 0 0 auto;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.cn-number--plain {
  justify-items: center;
  display: block;
}

/*
 * Box(contentAlignment = CenterEnd) { Text(currentPage); Text(totalPages, Transparent) }
 * The transparent copy reserves the width so the slider does not shift.
 */
.cn-number__value,
.cn-number__ghost {
  grid-area: 1 / 1;
}

.cn-number__ghost {
  visibility: hidden;
}

/* ------------------------------------------------------------------ slider */

/*
 * Material 3 Slider (compose material3 `SliderDefaults.Track` → `drawTrack`):
 * - track 16.dp thick (`SliderTokens.ActiveTrackHeight` = `InactiveTrackHeight` = 16.dp), fully
 *   rounded (radius = 8.dp) on the outer end and 2.dp (`TrackInsideCornerSize`) on the end that
 *   faces the handle;
 * - handle 4.dp x 44.dp (`HandleWidth` / `HandleHeight`), fully rounded, primary colour;
 * - the handle keeps a 6.dp gap to the track (`ActiveHandleLeadingSpace` = 6.dp), so the track is
 *   split into an active and an inactive segment that end 8.dp away from the handle centre;
 * - the track canvas is 2.dp narrower than the slider box on each side of the main axis (the 4.dp
 *   handle is centred on it), so the canvas starts 2.dp inside the slider box;
 * - tick marks (4.dp dots, `TickSize` = `StopIndicatorSize`) sit on the step positions.
 */
.cn-slider {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  touch-action: none;
  cursor: pointer;
  box-sizing: border-box;
}

.cn-slider--horizontal {
  height: 48px;
  margin-inline: 8px;
}

.cn-slider--vertical {
  width: 48px;
  margin-block: 8px;
}

.cn-slider:focus-visible {
  outline: none;
}

.cn-slider:focus-visible .cn-slider__thumb {
  outline: none;
}

.cn-slider--horizontal:focus-visible .cn-slider__thumb,
.cn-slider--horizontal:active .cn-slider__thumb {
  width: 2px;
}

.cn-slider--vertical:focus-visible .cn-slider__thumb,
.cn-slider--vertical:active .cn-slider__thumb {
  height: 2px;
}

.cn-slider__rail {
  position: absolute;
  pointer-events: none;
}

/* Horizontal: track canvas 16.dp tall, inset 2.dp from the slider box on both sides. */
.cn-slider--horizontal .cn-slider__rail {
  left: 2px;
  right: 2px;
  top: 16px;
  height: 16px;
}

/* Vertical: track canvas 16.dp wide, inset 2.dp from the slider box on both ends. */
.cn-slider--vertical .cn-slider__rail {
  top: 2px;
  bottom: 2px;
  left: 16px;
  width: 16px;
}

.cn-slider__active,
.cn-slider__inactive {
  position: absolute;
  pointer-events: none;
}

.cn-slider--horizontal .cn-slider__active {
  left: 0;
  top: 0;
  height: 16px;
  border-radius: 8px 2px 2px 8px;
  background: var(--cn-primary);
}

.cn-slider--horizontal .cn-slider__inactive {
  top: 0;
  height: 16px;
  border-radius: 2px 8px 8px 2px;
  background: var(--cn-secondary-container);
}

.cn-slider--vertical .cn-slider__active {
  top: 0;
  left: 0;
  width: 16px;
  border-radius: 8px 8px 2px 2px;
  background: var(--cn-primary);
}

.cn-slider--vertical .cn-slider__inactive {
  left: 0;
  width: 16px;
  border-radius: 2px 2px 8px 8px;
  background: var(--cn-secondary-container);
}

/* Kotlin: handle 4.dp x 44.dp, fully rounded, primary colour. */
.cn-slider__thumb {
  position: absolute;
  background: var(--cn-primary);
  border-radius: 2px;
  pointer-events: none;
}

.cn-slider--horizontal .cn-slider__thumb {
  top: -14px;
  width: 4px;
  height: 44px;
}

.cn-slider--vertical .cn-slider__thumb {
  left: -14px;
  width: 44px;
  height: 4px;
}

/*
 * Tick marks: 4.dp dots on the step positions.
 * Ticks behind the handle use the inactive track colour, ticks in front of it the active track
 * colour (compose `activeTickColor` / `inactiveTickColor`).
 */
.cn-slider__tick {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--cn-primary);
  pointer-events: none;
}

.cn-slider__tick--active {
  background: var(--cn-secondary-container);
}

.cn-slider--horizontal .cn-slider__tick {
  top: 6px;
}

.cn-slider--vertical .cn-slider__tick {
  left: 6px;
}

/* The track stop indicator replaces the last tick (compose `drawStopIndicator`). */
.cn-slider__stop {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--cn-primary);
  pointer-events: none;
}

.cn-slider--horizontal .cn-slider__stop {
  top: 6px;
}

.cn-slider--vertical .cn-slider__stop {
  left: 6px;
}

/*
 * Kotlin: the horizontal slider honours `LocalLayoutDirection`; in RTL the whole track
 * (active segment, ticks, stop indicator and handle) is mirrored.
 */
.cn-slider--rtl .cn-slider__rail {
  transform: scaleX(-1);
}
}
</style>
