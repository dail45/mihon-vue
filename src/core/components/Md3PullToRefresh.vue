<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type CSSProperties } from 'vue'

export interface Md3PullToRefreshProps {
  modelValue?: boolean
  refreshing?: boolean
  disabled?: boolean
  threshold?: number
  maxPull?: number
  ariaLabel?: string
  onRefresh?: () => Promise<void> | void
}

const props = withDefaults(
  defineProps<Md3PullToRefreshProps>(),
  {
    disabled: false,
    threshold: 72,
    maxPull: undefined,
    ariaLabel: 'Refresh',
  },
)

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:refreshing', value: boolean): void
}>()

const containerRef = ref<HTMLElement | null>(null)

const isPulling = ref(false)
const isClosing = ref(false)
const pullDistance = ref(0)
const pullProgress = ref(0)

const isRefreshingInternal = ref(props.modelValue ?? props.refreshing ?? false)
const isRefreshing = computed({
  get: () => props.modelValue ?? props.refreshing ?? isRefreshingInternal.value,
  set: (val: boolean) => {
    isRefreshingInternal.value = val
    emit('update:modelValue', val)
    emit('update:refreshing', val)
  },
})

const effectiveThreshold = computed(() => props.threshold ?? 72)
const effectiveMaxPull = computed(() => {
  if (props.maxPull !== undefined) return props.maxPull
  if (props.threshold !== undefined) return props.threshold * 1.6
  return 120
})

let touchActive = false
let startY = 0
let startX = 0
let closingTimer: ReturnType<typeof setTimeout> | null = null

function isScrollAtTop(container: HTMLElement | null, target?: EventTarget | null): boolean {
  if (typeof window !== 'undefined') {
    const winY = window.scrollY || document.documentElement?.scrollTop || document.body?.scrollTop || 0
    if (winY > 0) return false
  }

  if (!container) return true
  if (container.scrollTop > 0) return false

  let current = target as HTMLElement | null
  while (current && current !== container && current !== document.body) {
    if (current.scrollTop > 0) return false
    current = current.parentElement
  }

  const scrollers = container.querySelectorAll<HTMLElement>(
    '.vue-recycle-scroller, [data-scroll-container], .v-table__wrapper, .overflow-y-auto',
  )
  for (const scroller of scrollers) {
    if (scroller.scrollTop > 0) return false
  }

  return true
}

function handleTouchStart(event: TouchEvent) {
  if (props.disabled || isRefreshing.value || isClosing.value) return
  if (event.touches.length !== 1) {
    touchActive = false
    isPulling.value = false
    pullDistance.value = 0
    pullProgress.value = 0
    return
  }

  const touch = event.touches[0]
  startY = touch.clientY
  startX = touch.clientX
  touchActive = true
  isPulling.value = false
}

function handleTouchMove(event: TouchEvent) {
  if (!touchActive || props.disabled || isRefreshing.value || isClosing.value) return
  if (event.touches.length !== 1) return

  const touch = event.touches[0]
  const deltaY = touch.clientY - startY
  const deltaX = touch.clientX - startX

  if (!isPulling.value) {
    // If predominantly horizontal gesture, abort tracking
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
      touchActive = false
      return
    }

    if (deltaY > 4) {
      if (isScrollAtTop(containerRef.value, event.target)) {
        isPulling.value = true
      } else {
        touchActive = false
        return
      }
    } else {
      return
    }
  }

  if (isPulling.value) {
    if (event.cancelable) {
      event.preventDefault()
    }
    const currentPull = Math.max(0, touch.clientY - startY)
    pullDistance.value = Math.min(effectiveMaxPull.value, currentPull * 0.45)
    pullProgress.value = Math.min(1, Math.max(0, pullDistance.value / effectiveThreshold.value))
  }
}

function handleTouchEnd() {
  if (!touchActive && !isPulling.value) return
  touchActive = false

  if (isPulling.value) {
    isPulling.value = false
    if (pullProgress.value >= 1) {
      void triggerRefresh()
    } else {
      pullDistance.value = 0
      pullProgress.value = 0
    }
  }
}

async function triggerRefresh() {
  if (isRefreshing.value) return
  isRefreshing.value = true

  emit('update:modelValue', true)
  emit('update:refreshing', true)
  emit('refresh')

  const isControlled = props.modelValue !== undefined || props.refreshing !== undefined

  if (typeof props.onRefresh === 'function') {
    try {
      const res = props.onRefresh()
      if (res && typeof (res as Promise<unknown>).then === 'function') {
        await res
        finishRefresh()
        return
      }
    } catch (err) {
      finishRefresh()
      throw err
    }
  }

  if (!isControlled) {
    await nextTick()
    finishRefresh()
  }
}

function finishRefresh() {
  if (!isRefreshingInternal.value && !isRefreshing.value) return
  isClosing.value = true
  isRefreshingInternal.value = false
  emit('update:modelValue', false)
  emit('update:refreshing', false)

  if (closingTimer) {
    clearTimeout(closingTimer)
  }
  closingTimer = setTimeout(() => {
    isClosing.value = false
    pullDistance.value = 0
    pullProgress.value = 0
    closingTimer = null
  }, 200)
}

watch(
  () => props.modelValue ?? props.refreshing,
  (newVal, oldVal) => {
    if (newVal === true && !isRefreshingInternal.value) {
      isRefreshingInternal.value = true
    } else if (newVal === false && (isRefreshingInternal.value || oldVal === true)) {
      finishRefresh()
    }
  },
)

const indicatorStyle = computed<CSSProperties>(() => {
  if (isPulling.value) {
    const y = pullDistance.value - 64
    const opacity = Math.min(1, Math.max(0, pullProgress.value * 1.5))
    return {
      transform: `translate(-50%, ${y}px)`,
      opacity: String(opacity),
    }
  }
  return {}
})

onMounted(() => {
  const container = containerRef.value
  if (!container) return

  container.addEventListener('touchstart', handleTouchStart, { passive: true })
  container.addEventListener('touchmove', handleTouchMove, { passive: false })
  container.addEventListener('touchend', handleTouchEnd, { passive: true })
  container.addEventListener('touchcancel', handleTouchEnd, { passive: true })

  window.addEventListener('touchmove', handleTouchMove, { passive: false })
  window.addEventListener('touchend', handleTouchEnd, { passive: true })
  window.addEventListener('touchcancel', handleTouchEnd, { passive: true })
})

onUnmounted(() => {
  if (closingTimer) {
    clearTimeout(closingTimer)
    closingTimer = null
  }

  const container = containerRef.value
  if (container) {
    container.removeEventListener('touchstart', handleTouchStart)
    container.removeEventListener('touchmove', handleTouchMove)
    container.removeEventListener('touchend', handleTouchEnd)
    container.removeEventListener('touchcancel', handleTouchEnd)
  }

  window.removeEventListener('touchmove', handleTouchMove)
  window.removeEventListener('touchend', handleTouchEnd)
  window.removeEventListener('touchcancel', handleTouchEnd)
})

defineExpose({
  triggerRefresh,
  finishRefresh,
  isRefreshing,
  isPulling,
  isClosing,
  pullDistance,
  pullProgress,
  effectiveThreshold,
  effectiveMaxPull,
})
</script>

<template>
  <div class="md3-pull-to-refresh" ref="containerRef">
    <div
      class="md3-pull-to-refresh__indicator"
      :class="{
        'md3-pull-to-refresh__indicator--pulling': isPulling,
        'md3-pull-to-refresh__indicator--refreshing': isRefreshing,
        'md3-pull-to-refresh__indicator--closing': isClosing,
      }"
      :style="indicatorStyle"
      role="progressbar"
      :aria-label="ariaLabel"
      :aria-valuenow="isRefreshing ? undefined : Math.round(pullProgress * 100)"
      :aria-valuemin="0"
      :aria-valuemax="100"
    >
      <!-- While pulling: SVG arc with proportional stroke and tangent arrow tip -->
      <svg
        v-if="!isRefreshing"
        class="md3-pull-to-refresh__arc-canvas"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        :style="{
          transform: `rotate(${pullProgress * 360}deg)`,
        }"
      >
        <circle
          class="md3-pull-to-refresh__track"
          cx="12"
          cy="12"
          r="8.5"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          pathLength="100"
          :stroke-dasharray="`${pullProgress * 75} 100`"
          stroke-dashoffset="0"
          transform="rotate(-90 12 12)"
        />
        <path
          v-if="pullProgress > 0.05"
          class="md3-pull-to-refresh__arrow"
          d="M 9.5 0.5 L 14.5 3.5 L 9.5 6.5 Z"
          fill="currentColor"
          :transform="`rotate(${pullProgress * 270 - 90} 12 12)`"
        />
      </svg>

      <!-- While refreshing: Authentic indeterminate M3 circular progress spinner -->
      <div v-else class="md3-pull-to-refresh__spinner" aria-hidden="true">
        <svg
          class="md3-pull-to-refresh__spinner-canvas"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          focusable="false"
        >
          <g class="md3-pull-to-refresh__spinner-global">
            <g class="md3-pull-to-refresh__spinner-steps">
              <circle
                class="md3-pull-to-refresh__spinner-arc"
                cx="12"
                cy="12"
                r="8.5"
                pathLength="100"
              />
            </g>
          </g>
        </svg>
      </div>
    </div>
    <slot />
  </div>
</template>

<style scoped>
@layer app-components {
.md3-pull-to-refresh {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  width: 100%;
}

.md3-pull-to-refresh__indicator {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translate(-50%, -64px);
  width: 40px;
  height: 40px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--v-theme-surface-container-high, 236 230 240));
  color: rgb(var(--v-theme-primary, 103 80 164));
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), 0 4px 8px 3px rgba(0, 0, 0, 0.15);
  pointer-events: none;
  z-index: 10;
  opacity: 0;
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s linear;
}

.md3-pull-to-refresh__indicator--pulling {
  transition: none !important;
}

.md3-pull-to-refresh__indicator--refreshing {
  transform: translate(-50%, 16px);
  opacity: 1;
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.md3-pull-to-refresh__indicator--closing {
  transform: translate(-50%, 16px) scale(0);
  opacity: 0;
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s linear;
}

.md3-pull-to-refresh__arc-canvas {
  display: block;
  overflow: visible;
  transition: transform 0.05s linear;
}

.md3-pull-to-refresh__track {
  transition: stroke-dasharray 0.05s linear;
}

.md3-pull-to-refresh__arrow {
  transition: transform 0.05s linear;
}

.md3-pull-to-refresh__spinner {
  display: block;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  line-height: 0;
}

.md3-pull-to-refresh__spinner-canvas {
  display: block;
  overflow: visible;
}

.md3-pull-to-refresh__spinner-global,
.md3-pull-to-refresh__spinner-steps {
  transform-box: view-box;
  transform-origin: center;
}

.md3-pull-to-refresh__spinner-global {
  animation: md3-ptr-global-rotate 6s linear infinite;
}

.md3-pull-to-refresh__spinner-steps {
  animation: md3-ptr-step-rotate 6s linear infinite;
}

.md3-pull-to-refresh__spinner-arc {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-dasharray: 10 100;
  animation: md3-ptr-sweep 6s linear infinite;
}

@keyframes md3-ptr-global-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(1080deg); }
}

@keyframes md3-ptr-step-rotate {
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

@keyframes md3-ptr-sweep {
  0% { stroke-dasharray: 10 100; animation-timing-function: linear; }
  50% { stroke-dasharray: 87 100; animation-timing-function: cubic-bezier(0.2, 0, 0, 1); }
  100% { stroke-dasharray: 10 100; }
}

@media (prefers-reduced-motion: reduce) {
  .md3-pull-to-refresh__spinner-global,
  .md3-pull-to-refresh__spinner-steps,
  .md3-pull-to-refresh__spinner-arc {
    animation: none !important;
  }
}
}
</style>
