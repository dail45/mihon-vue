<script setup lang="ts">
/**
 * MD3 Switch (Material3 SwitchDefaults).
 *
 * Reference: mihon/app/src/main/java/mihon/feature/migration/config/MigrationConfigScreenSheet.kt
 * (`Switch(checked, onCheckedChange = null)`) and the material3 switch geometry:
 * track 52x32dp (radius 16), 2dp outline on the unselected track, thumb 16dp when off and
 * 24dp when on, 4dp inset from the track edge, the selected thumb carries the check mark.
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
      <span class="md3-switch-thumb">
        <svg class="md3-switch-mark" viewBox="0 0 24 24" focusable="false">
          <path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7z" fill="currentColor" />
        </svg>
      </span>
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
.md3-switch.is-disabled { cursor: default; opacity: .38; }
.md3-switch-track {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 52px;
  height: 32px;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface-variant));
  box-shadow: inset 0 0 0 2px rgb(var(--v-theme-outline));
  box-sizing: border-box;
  transition: background-color .2s cubic-bezier(.2, 0, 0, 1), box-shadow .2s cubic-bezier(.2, 0, 0, 1);
}
.md3-switch-thumb {
  position: absolute;
  left: 4px;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgb(var(--v-theme-outline));
  color: rgb(var(--v-theme-primary));
  transition: transform .2s cubic-bezier(.2, 0, 0, 1), width .15s .05s cubic-bezier(0, 0, .2, 1), height .15s .05s cubic-bezier(0, 0, .2, 1), background-color .2s;
}
.md3-switch-mark { width: 18px; height: 18px; opacity: 0; transition: opacity .15s; }
.md3-switch.is-on .md3-switch-track { background: rgb(var(--v-theme-primary)); box-shadow: inset 0 0 0 2px rgb(var(--v-theme-primary)); }
.md3-switch.is-on .md3-switch-thumb { width: 24px; height: 24px; transform: translateX(20px); background: rgb(var(--v-theme-on-primary)); }
.md3-switch.is-on .md3-switch-mark { opacity: 1; }
</style>
