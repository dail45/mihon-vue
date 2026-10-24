<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { isSourcePinned, setSourcePinned } from '@/core/utils/sourcePins'

/**
 * Pixel-parity port of the private `SourcePinButton` composable in
 * mihon/app/src/main/java/eu/kanade/presentation/browse/SourcesScreen.kt:141-162
 *
 *   val icon = if (isPinned) MaterialSymbols.RoundedFilled.Keep else MaterialSymbols.Rounded.Keep
 *   val tint = if (isPinned) {
 *     MaterialTheme.colorScheme.primary
 *   } else {
 *     MaterialTheme.colorScheme.onBackground.copy(alpha = SECONDARY_ALPHA)
 *   }
 *   val description = if (isPinned) MR.strings.action_unpin else MR.strings.action_pin
 *   IconButton(onClick = onClick) {
 *     Icon(imageVector = icon, tint = tint, contentDescription = stringResource(description))
 *   }
 *
 * Metrics taken from the reference:
 * - Material3 IconButton: 48dp touch target, 40dp circular state layer
 *   (presentation-core/.../material/IconButtonTokens.kt -> StateLayerSize = 40.dp).
 * - Icon size: 24dp (the Compose `Icon` default).
 * - SECONDARY_ALPHA = .78f and DISABLED_ALPHA = .38f
 *   (mihon/presentation-core/.../material/Constants.kt:9-10).
 * - The state layer / ripple colour is the IconButton content colour. The plain M3
 *   `IconButton` uses `IconButtonDefaults.iconButtonColors()` whose contentColor is
 *   `Color.Unspecified`, so it resolves to `LocalContentColor` = onBackground of the
 *   Sources Scaffold (container = background) -- NOT the icon tint (the `Icon` gets an
 *   explicit `tint`).
 * - The IconButton container is a 40dp CircleShape, so the bounded ripple and the state
 *   layer share the same 40dp circle inside the 48dp touch target.
 * - base strings (i18n/.../base/strings.xml:133-134): action_pin = "Pin", action_unpin = "Unpin".
 *
 * Usage:
 * - controlled:   <SourcePinButton :is-pinned="pinned" @toggle="onToggle" />
 * - uncontrolled: <SourcePinButton source-id="42" />   (state kept in local preferences)
 */
const props = withDefaults(
  defineProps<{ isPinned?: boolean; sourceId?: string; disabled?: boolean }>(),
  { disabled: false },
)
const emit = defineEmits<{ (event: 'toggle', pinned: boolean): void }>()

/** Controlled mode wins; the uncontrolled mode mirrors the locally stored pin set. */
const localPinned = ref(props.sourceId ? isSourcePinned(props.sourceId) : false)
watch(
  () => props.sourceId,
  (id) => {
    if (id) localPinned.value = isSourcePinned(id)
  },
)
const pinned = computed(() => props.isPinned ?? localPinned.value)

/** MR.strings.action_pin / MR.strings.action_unpin */
const description = computed(() => (pinned.value ? 'Unpin' : 'Pin'))

/* Compose tints the Icon with primary when pinned and with onBackground at SECONDARY_ALPHA
   otherwise. The alpha belongs to the icon only, the button chrome stays onBackground. */
const iconColor = computed(() =>
  pinned.value ? 'rgb(var(--v-theme-primary))' : 'rgb(var(--v-theme-on-background))',
)
/* SECONDARY_ALPHA = .78f (mihon/presentation-core/.../material/Constants.kt:10).
   The reference never disables the button, and a Compose `Icon` with an explicit tint keeps
   that tint even in a disabled IconButton, so the disabled state only stops the click. */
const iconOpacity = computed(() => (pinned.value ? 1 : 0.78 /* SECONDARY_ALPHA */))

function onClick() {
  if (props.disabled) return
  const next = !pinned.value
  if (props.sourceId) {
    setSourcePinned(props.sourceId, next)
    localPinned.value = next
  }
  emit('toggle', next)
}
</script>

<template>
  <button
    type="button"
    class="source-pin-button"
    :class="{ 'source-pin-button--pinned': pinned }"
    :aria-label="description"
    :aria-pressed="pinned"
    :disabled="disabled"
    @click.stop="onClick"
  >
    <!-- M3 hover / focus state layer (8% / 10% of the content colour, onBackground). -->
    <span class="source-pin-button__state-layer" aria-hidden="true" />
    <!-- M3 press indication: bounded ripple in the content colour, 48dp circle. -->
    <span class="source-pin-button__ripple" aria-hidden="true" />
    <!-- MaterialSymbols.Rounded.Keep; MaterialSymbols.RoundedFilled.Keep == Keep with FILL = 1. -->
    <span
      class="source-pin-button__icon material-symbols-rounded"
      :class="{ 'source-pin-button__icon--filled': pinned }"
      :style="{ color: iconColor, opacity: iconOpacity }"
      aria-hidden="true"
    >keep</span>
  </button>
</template>

<style scoped>
/* Material3 IconButton: 48dp touch target, 40dp circular state layer, 24dp icon. */
.source-pin-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

/* State layer: 40dp circle, 4dp inset inside the 48dp button.
   The plain M3 IconButton leaves the content colour Unspecified, so it resolves to
   LocalContentColor. Inside the Sources screen that is the Scaffold content colour
   = contentColorFor(background) = onBackground
   (presentation-core/.../material/Scaffold.kt:38-39). */
.source-pin-button__state-layer {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgb(var(--v-theme-on-background));
  opacity: 0;
  pointer-events: none;
}

/* Ripple: the M3 IconButton container is 40dp wide with a CircleShape clip, so the bounded
   ripple fills the same 40dp circle as the state layer (the button itself is a 48dp
   minimum-interactive touch target). */
.source-pin-button__ripple {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgb(var(--v-theme-on-background));
  opacity: 0;
  pointer-events: none;
}

/* Hover: 8% state layer. Compose draws no hover layer on touch devices, the web port mirrors
   the M3 hover state of the button. */
.source-pin-button:hover:not(:disabled) .source-pin-button__state-layer {
  opacity: 0.08;
}

.source-pin-button:focus-visible .source-pin-button__state-layer {
  opacity: 0.1;
}

/* Press: the M3 ripple (12% of the content colour) grows out of the touch point. */
.source-pin-button__ripple {
  transition: transform 320ms cubic-bezier(0.2, 0, 0, 1), opacity 120ms linear;
  transform: scale(0);
}

.source-pin-button:active:not(:disabled) .source-pin-button__ripple {
  opacity: 0.12;
  transform: scale(1);
}

.source-pin-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.source-pin-button:disabled {
  cursor: default;
}

/* Compose `Icon` default size: 24dp. */
.source-pin-button__icon {
  position: relative;
  display: inline-block;
  width: 24px;
  height: 24px;
  font-size: 24px;
  line-height: 1;
  font-weight: normal;
  font-style: normal;
  letter-spacing: normal;
  text-transform: none;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  font-feature-settings: 'liga';
  -webkit-font-smoothing: antialiased;
  -webkit-font-feature-settings: 'liga';
  user-select: none;
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* MaterialSymbols.RoundedFilled.Keep == MaterialSymbols.Rounded.Keep with FILL = 1. */
.source-pin-button__icon--filled {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
