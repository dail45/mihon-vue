<script setup lang="ts">
/**
 * AppMigratingScreen.kt (eu.kanade.presentation.more.AppMigratingScreen)
 *
 * Reference (mihon @ 446f6df):
 *   Surface(modifier = Modifier.fillMaxSize()) {
 *     Column(
 *       modifier = Modifier
 *         .safeDrawingPadding()
 *         .padding(horizontal = 32.dp),
 *       verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
 *       horizontalAlignment = Alignment.CenterHorizontally,
 *     ) {
 *       CircularProgressIndicator()
 *       Text(
 *         text = stringResource(MR.strings.app_migrating_title),
 *         style = MaterialTheme.typography.titleLarge,
 *         textAlign = TextAlign.Center,
 *       )
 *       Text(
 *         text = stringResource(MR.strings.app_migrating_summary),
 *         style = MaterialTheme.typography.bodyMedium,
 *         color = MaterialTheme.colorScheme.onSurfaceVariant,
 *         textAlign = TextAlign.Center,
 *       )
 *     }
 *   }
 *
 * Strings (i18n base/strings.xml):
 *   app_migrating_title   = "Finishing the update"
 *   app_migrating_summary = "Getting things ready after the update. This can take a few minutes, so keep the app open."
 *
 * Metrics used here:
 *  - Surface: fills the whole window, container colour = colorScheme.surface, no elevation.
 *  - safeDrawingPadding(): system insets (status/nav/cutout) are added *around* the column.
 *  - padding(horizontal = 32.dp): applied *after* the safe drawing padding, so the horizontal
 *    inset is inset + 32dp (additive, not a max()).
 *  - Arrangement.spacedBy(16.dp, Alignment.CenterVertically): children are centred vertically and
 *    separated by 16dp.
 *  - CircularProgressIndicator() (bare, M3): indeterminate, 40dp diameter, 4dp stroke, round caps,
 *    primary arc, transparent track, 6s M3 cycle (1080deg global rotation + 90deg steps +
 *    10%..87% sweep). Vuetify's <v-progress-circular> spins a fixed dash in 1.4s and cannot
 *    express that animation, so the indicator is inline SVG with the same geometry/keyframes
 *    (same approach as components/BrowseSourceLoadingItem.vue).
 *  - titleLarge = 22sp / 28sp, weight 400, letter spacing 0.
 *  - bodyMedium = 14sp / 20sp, weight 400, letter spacing 0.25sp, onSurfaceVariant.
 *
 * The web client has no on-device database migrations (production code is a headless REST
 * client), so this screen is the full-screen "app is preparing" state shown while the client
 * connects to / prepares data from Suwayomi.
 */
</script>

<template>
  <div class="app-migrating" role="status" aria-live="polite">
    <div class="app-migrating__column">
      <!-- CircularProgressIndicator(): M3 indeterminate, 40dp diameter, 4dp round-capped arc. -->
      <div class="app-migrating__indicator" role="progressbar" aria-label="Loading">
        <svg
          class="app-migrating__canvas"
          width="40"
          height="40"
          viewBox="0 0 40 40"
          aria-hidden="true"
          focusable="false"
        >
          <g class="app-migrating__global">
            <g class="app-migrating__steps">
              <circle class="app-migrating__arc" cx="20" cy="20" r="18" pathLength="100" />
            </g>
          </g>
        </svg>
      </div>
      <!-- Text(app_migrating_title, MaterialTheme.typography.titleLarge, TextAlign.Center) -->
      <h1 class="app-migrating__title">Finishing the update</h1>
      <!-- Text(app_migrating_summary, bodyMedium, onSurfaceVariant, TextAlign.Center) -->
      <p class="app-migrating__summary">
        Getting things ready after the update. This can take a few minutes, so keep the app open.
      </p>
    </div>
  </div>
</template>

<style scoped>
@layer app-components {
/* Surface(Modifier.fillMaxSize()) — the screen covers the whole window. */
.app-migrating {
  position: fixed;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

/* Column(safeDrawingPadding().padding(horizontal = 32.dp)) */
.app-migrating__column {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  /* Arrangement.spacedBy(16.dp, Alignment.CenterVertically) */
  justify-content: center;
  align-items: center;
  gap: 16px;
  /* safeDrawingPadding() then padding(horizontal = 32.dp) — the insets are additive. */
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  padding-left: calc(env(safe-area-inset-left, 0px) + 32px);
  padding-right: calc(env(safe-area-inset-right, 0px) + 32px);
  text-align: center;
}

/* CircularProgressIndicator(): 40dp indicator box. */
.app-migrating__indicator {
  display: block;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  line-height: 0;
}
.app-migrating__canvas {
  display: block;
  overflow: visible;
}
.app-migrating__global,
.app-migrating__steps {
  transform-box: view-box;
  transform-origin: center;
}
/* Global rotation: 1080deg over 6s (M3 CircularGlobalRotationDegreesTarget, LinearEasing). */
.app-migrating__global {
  animation: app-migrating-global-rotate 6s linear infinite;
}
/* Additional rotation: 90deg steps at 300/1800/3300/4800ms, held in between (M3 keyframes). */
.app-migrating__steps {
  animation: app-migrating-step-rotate 6s linear infinite;
}
.app-migrating__arc {
  fill: none;
  stroke: rgb(var(--v-theme-primary));
  stroke-width: 4;
  stroke-linecap: round;
  /* M3 indeterminate arc: 10%..87% of the circle; the track is transparent. */
  stroke-dasharray: 10 100;
  animation: app-migrating-sweep 6s linear infinite;
}

@keyframes app-migrating-global-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(1080deg); }
}
@keyframes app-migrating-step-rotate {
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
@keyframes app-migrating-sweep {
  /* 0 -> 3000ms: linear growth (M3 keyframes default easing). */
  0% { stroke-dasharray: 10 100; animation-timing-function: linear; }
  /* 3000 -> 6000ms: shrink eased with EasingStandardCubicBezier (0.2, 0, 0, 1). */
  50% { stroke-dasharray: 87 100; animation-timing-function: cubic-bezier(0.2, 0, 0, 1); }
  100% { stroke-dasharray: 10 100; }
}

/* Text(app_migrating_title, titleLarge) — MaterialTheme.typography.titleLarge: 22sp / 28sp / 400. */
.app-migrating__title {
  margin: 0;
  font-family: var(--v-font-heading, var(--v-font-body, 'Roboto', sans-serif));
  font-size: 22px;
  line-height: 28px;
  font-weight: 400;
  letter-spacing: 0;
  color: rgb(var(--v-theme-on-surface));
}

/* Text(app_migrating_summary, bodyMedium, onSurfaceVariant): 14sp / 20sp / 400 / 0.25sp. */
.app-migrating__summary {
  margin: 0;
  font-family: var(--v-font-body, 'Roboto', sans-serif);
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: .25px;
  color: rgb(var(--v-theme-on-surface-variant));
}

@media (prefers-reduced-motion: reduce) {
.app-migrating__global,
.app-migrating__steps,
.app-migrating__arc {
  animation: none !important;
}
}
}
</style>
