<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

/**
 * @Composable
 * fun GlobalSearchResultItem(title: String, subtitle: String, onClick: () -> Unit, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
 *     Column(modifier = modifier) {
 *         Row(
 *             modifier = Modifier.padding(start = MaterialTheme.padding.medium, end = MaterialTheme.padding.extraSmall).fillMaxWidth().clickable(onClick = onClick),
 *             horizontalArrangement = Arrangement.SpaceBetween,
 *             verticalAlignment = Alignment.CenterVertically,
 *         ) {
 *             Column {
 *                 Text(text = title, style = MaterialTheme.typography.titleMedium)
 *                 Text(text = subtitle)
 *             }
 *             IconButton(onClick = onClick) {
 *                 Icon(imageVector = MaterialSymbols.AutoMirroredRounded.ArrowForward, contentDescription = null)
 *             }
 *         }
 *         content()
 *     }
 * }
 */
const props = defineProps<{
  title: string
  subtitle: string
  /** Mihon: `onClick` — with a route the row navigates, otherwise a `click` event is emitted. */
  to?: RouteLocationRaw
}>()

const emit = defineEmits<{ (event: 'click'): void }>()

const isLink = computed(() => props.to !== undefined)
const linkProps = computed(() => (isLink.value ? { to: props.to } : { type: 'button' as const }))
</script>

<template>
  <div class="gsri">
    <!-- Row(padding(start = medium = 16dp, end = extraSmall = 4dp), fillMaxWidth, SpaceBetween, CenterVertically) -->
    <div class="gsri__row">
      <component
        :is="isLink ? RouterLink : 'button'"
        v-bind="linkProps"
        class="gsri__clickable"
        @click="emit('click')"
      >
        <!-- Column { Text(title, style = titleMedium); Text(subtitle) } -->
        <span class="gsri__text">
          <!-- Text(text = title, style = MaterialTheme.typography.titleMedium) -->
          <span class="gsri__title">{{ props.title }}</span>
          <!-- Text(text = subtitle) with the default bodyLarge style -->
          <span class="gsri__subtitle">{{ props.subtitle }}</span>
        </span>

        <!-- IconButton { Icon(MaterialSymbols.AutoMirroredRounded.ArrowForward) } -->
        <span class="gsri__icon-button" aria-hidden="true">
          <span class="material-symbols-rounded gsri__icon">arrow_forward</span>
        </span>
      </component>
    </div>

    <!-- content(): the result row of the source (the card row, the loading or the error state) -->
    <slot />
  </div>
</template>

<!--
  The three composables of the Kotlin file are rendered from other SFCs (the global search
  screen), so a `scoped` block of this file could not reach their markup: the block stays
  unscoped and the class names are prefixed with `gsri-` to stay collision free. The block is
  deliberately outside of the `app-components` cascade layer, so it wins over the shared rules
  of src/styles/main.scss (the filled error glyph, for instance).
-->
<style>
/* GlobalSearchResultItem: Column { Row(...) ; content() } */
.gsri {
  display: flex;
  flex-direction: column;
  width: 100%;
}

/* Row(padding(start = MaterialTheme.padding.medium = 16dp, end = extraSmall = 4dp), fillMaxWidth) */
.gsri__row {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0 4px 0 16px;
}

/*
  The Compose chain is `padding(...).fillMaxWidth().clickable(...)`, so the clickable area is the
  padded content area, not the full row.
*/
.gsri__clickable {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
  text-decoration: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

/* Material 3 state layer: pressed 10% of the content color. */
.gsri__clickable:active {
  background-color: rgba(var(--v-theme-on-surface), 0.1);
}

/* Column { Text(title); Text(subtitle) } */
.gsri__text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

/* Text(text = title, style = MaterialTheme.typography.titleMedium): 16sp / 24sp / 500 / 0.15sp. */
.gsri__title {
  font-size: 16px;
  line-height: 24px;
  font-weight: 500;
  letter-spacing: 0.15px;
  color: rgb(var(--v-theme-on-surface));
}

/* Text(text = subtitle) uses the default bodyLarge style: 16sp / 24sp / 0.5sp / Regular. */
.gsri__subtitle {
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.5px;
  color: rgb(var(--v-theme-on-surface));
}

/*
  IconButton: the 48dp minimum interactive size, a 40dp circular state layer centred inside it
  and a 24dp icon tinted by the ambient content color (onSurface).
*/
.gsri__icon-button {
  position: relative;
  display: grid;
  place-items: center;
  flex: none;
  width: 48px;
  height: 48px;
  color: rgb(var(--v-theme-on-surface));
}

/* The circular state layer of the IconButton (IconButtonTokens.StateLayerSize = 40dp). */
.gsri__icon-button::before {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  background-color: transparent;
}

/* Material 3 state layer opacities: hover 8%, pressed 10%. */
.gsri__icon-button:hover::before {
  background-color: rgba(var(--v-theme-on-surface), 0.08);
}

.gsri__clickable:active .gsri__icon-button::before {
  background-color: rgba(var(--v-theme-on-surface), 0.1);
}

.gsri__icon {
  font-size: 24px;
  width: 24px;
  height: 24px;
  line-height: 24px;
}

/* MaterialSymbols.AutoMirroredRounded.ArrowForward is mirrored in a right to left layout. */
[dir='rtl'] .gsri__icon {
  transform: scaleX(-1);
}

/* GlobalSearchLoadingResultItem: Box(fillMaxWidth().padding(vertical = 16dp)) with a centred
   16dp CircularProgressIndicator (2dp stroke). */
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

/* Global rotation: 1080deg over 6s (M3 CircularAnimationProgressDuration / GlobalRotationTarget). */
.gsri-loading__global {
  animation: gsri-loading-global-rotate 6s linear infinite;
}

/* Additional rotation: 90deg eased steps at 300/1800/3300/4800ms (M3 AdditionalRotation). */
.gsri-loading__steps {
  animation: gsri-loading-step-rotate 6s linear infinite;
}

.gsri-loading__arc {
  fill: none;
  stroke: rgb(var(--v-theme-primary));
  stroke-width: 2;
  stroke-linecap: round;
  /* M3 indeterminate arc: 10%..87% of the circle; the track is transparent. */
  stroke-dasharray: 10 100;
  animation: gsri-loading-sweep 6s linear infinite;
}

@keyframes gsri-loading-global-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(1080deg); }
}
/*
  M3 additional rotation keyframes (CircularAnimationAdditionalRotationDuration = 300ms,
  CircularAnimationAdditionalRotationDelay = 1500ms, total 6000ms):
  90f at 300ms using EasingEmphasizedDecelerateCubicBezier, 90f at 1500ms, 180f at 1800ms,
  180f at 3000ms, 270f at 3300ms, 270f at 4500ms, 360f at 4800ms, 360f at 6000ms.
  In Compose `using(easing)` binds the curve to the interval STARTING at that keyframe, and the
  keyframe that carries the emphasized curve (300ms) only starts a HOLD segment (90f -> 90f).
  Every segment that actually moves therefore interpolates linearly, which is what the CSS
  keyframes below reproduce.
*/
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
/*
  M3 progress sweep: CircularIndeterminateMaxProgress (0.87) at 3000ms using
  EasingStandardCubicBezier (0.2, 0, 0, 1), CircularIndeterminateMinProgress (0.1) at 6000ms.
  The curve is bound to the interval starting at 3000ms, so the growth (0 -> 3000ms) is linear
  and the shrinking (3000 -> 6000ms) is eased. The sweep is drawn as a dash of the circle.
*/
@keyframes gsri-loading-sweep {
  0% { stroke-dasharray: 10 100; animation-timing-function: linear; }
  50% { stroke-dasharray: 87 100; animation-timing-function: cubic-bezier(0.2, 0, 0, 1); }
  100% { stroke-dasharray: 10 100; }
}

/* GlobalSearchErrorResultItem: Column(padding(horizontal = 16dp, vertical = 8dp), fillMaxWidth),
   horizontally centred, with the filled error glyph, a 4dp spacer and the centred message. */
.gsri-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 8px 16px;
}

/* Icon(MaterialSymbols.RoundedFilled.Error) — the default icon size is 24dp. */
.gsri-error__icon {
  font-size: 24px;
  width: 24px;
  height: 24px;
  line-height: 24px;
  color: rgb(var(--v-theme-on-surface));
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* Text(message, textAlign = Center) with the default bodyLarge style. */
.gsri-error__text {
  margin: 4px 0 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.5px;
  text-align: center;
  color: rgb(var(--v-theme-on-surface));
}

@media (prefers-reduced-motion: reduce) {
.gsri-loading__global,
.gsri-loading__steps,
.gsri-loading__arc {
  animation: none !important;
}
}
</style>
