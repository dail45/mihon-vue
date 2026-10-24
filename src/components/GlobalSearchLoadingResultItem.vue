<script setup lang="ts">
/**
 * Pixel-parity port of Mihon's `GlobalSearchLoadingResultItem`
 * (mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1).
 */
</script>

<template>
  <div class="gsri-loading">
    <svg
      class="gsri-loading__indicator"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      role="progressbar"
      aria-label="Loading"
      focusable="false"
    >
      <g class="gsri-loading__global">
        <g class="gsri-loading__steps">
          <circle class="gsri-loading__arc" cx="8" cy="8" r="7" pathLength="100" />
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.gsri-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 16px 0;
}

.gsri-loading__indicator {
  display: block;
  flex: 0 0 auto;
  overflow: visible;
}

.gsri-loading__global,
.gsri-loading__steps {
  transform-box: view-box;
  transform-origin: center;
}

.gsri-loading__global {
  animation: gsri-loading-global-rotate 6s linear infinite;
}

.gsri-loading__steps {
  animation: gsri-loading-step-rotate 6s linear infinite;
}

.gsri-loading__arc {
  fill: none;
  stroke: rgb(var(--v-theme-primary));
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 10 100;
  animation: gsri-loading-sweep 6s linear infinite;
}

@keyframes gsri-loading-global-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(1080deg); }
}

@keyframes gsri-loading-step-rotate {
  0% { transform: rotate(0deg); animation-timing-function: linear; }
  5% { transform: rotate(90deg); animation-timing-function: linear; }
  25% { transform: rotate(90deg); animation-timing-function: linear; }
  30% { transform: rotate(180deg); animation-timing-function: linear; }
  50% { transform: rotate(180deg); animation-timing-function: linear; }
  55% { transform: rotate(270deg); animation-timing-function: linear; }
  75% { transform: rotate(270deg); animation-timing-function: linear; }
  80% { transform: rotate(360deg); animation-timing-function: linear; }
  100% { transform: rotate(360deg); }
}

@keyframes gsri-loading-sweep {
  0% { stroke-dasharray: 10 100; animation-timing-function: linear; }
  50% { stroke-dasharray: 87 100; animation-timing-function: cubic-bezier(0.2, 0, 0, 1); }
  100% { stroke-dasharray: 10 100; }
}

@media (prefers-reduced-motion: reduce) {
  .gsri-loading__global,
  .gsri-loading__steps,
  .gsri-loading__arc {
    animation: none !important;
  }
}
</style>
