<script setup lang="ts">
/**
 * MD3 Switch (Material3 SwitchDefaults).
 *
 * Reference: mihon/app/src/main/java/eu/kanade/presentation/more/settings/widget/SwitchPreferenceWidget.kt
 * (`Switch(checked, onCheckedChange = null)`) and the Material 3 Switch specification:
 * - Track: 52x32dp (radius 16dp / pill).
 * - Unselected: track = surfaceContainerHighest with a 2dp outline border;
 *   thumb = 16dp, centered in the left cap with 8dp inset from track edges ((32 - 16) / 2 = 8dp);
 *   thumb color = outline.
 * - Selected: track = primary with no border;
 *   thumb = 24dp, centered in the right cap with 4dp inset from track edges ((32 - 24) / 2 = 4dp);
 *   thumb color = onPrimary; translation = 16dp (8 + 16 + 24 = 48dp, 52 - 48 = 4dp).
 * - The reference Switch has no thumbContent, so the thumb carries no check mark.
 *
 * Vuetify's own VSwitch is not MD3 sized (default track height 14dp, thumb 20dp), so the
 * reference geometry is reproduced here instead of reusing the component.
 */
const model = defineModel<boolean>({ required: true })
defineProps<{ label?: string; disabled?: boolean }>()
</script>

<template>
  <span
    class="md3-switch"
    :class="{ 'is-on': model, 'is-disabled': disabled }"
    role="switch"
    :aria-checked="model"
    :aria-label="label"
    :aria-disabled="disabled || undefined"
    tabindex="0"
    @click.stop="disabled || (model = !model)"
    @keydown.space.prevent="disabled || (model = !model)"
    @keydown.enter.prevent="disabled || (model = !model)"
  >
    <span class="md3-switch-track">
      <span class="md3-switch-thumb" />
    </span>
  </span>
</template>

<style scoped>
.md3-switch {
  display: inline-flex;
  flex: 0 0 auto;
  padding-inline-start: 16px;
  cursor: pointer;
  touch-action: manipulation;
}
.md3-switch.is-disabled {
  cursor: default;
  opacity: .38;
}
.md3-switch-track {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 52px;
  height: 32px;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface-container-highest));
  box-shadow: inset 0 0 0 2px rgb(var(--v-theme-outline));
  box-sizing: border-box;
  transition: background-color .2s cubic-bezier(.2, 0, 0, 1), box-shadow .2s cubic-bezier(.2, 0, 0, 1);
}
.md3-switch-thumb {
  position: absolute;
  left: 8px;
  top: 8px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgb(var(--v-theme-outline));
  transition: transform .2s cubic-bezier(.2, 0, 0, 1),
              width .15s .05s cubic-bezier(0, 0, .2, 1),
              height .15s .05s cubic-bezier(0, 0, .2, 1),
              top .15s .05s cubic-bezier(0, 0, .2, 1),
              background-color .2s cubic-bezier(.2, 0, 0, 1);
}
.md3-switch.is-on .md3-switch-track {
  background: rgb(var(--v-theme-primary));
  box-shadow: inset 0 0 0 2px transparent;
}
.md3-switch.is-on .md3-switch-thumb {
  width: 24px;
  height: 24px;
  top: 4px;
  transform: translateX(16px);
  background: rgb(var(--v-theme-on-primary));
}
</style>
