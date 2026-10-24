<script setup lang="ts">
/**
 * Pixel-parity port of Mihon's `GlobalSearchErrorResultItem`
 * (mihon @ 446f6df82c390ab760802c2fce3b677bce3f31c1).
 */
withDefaults(
  defineProps<{
    message?: string | null
  }>(),
  {
    message: null,
  },
)
</script>

<template>
  <div class="gsri-error">
    <span class="material-symbols-rounded gsri-error__icon" aria-hidden="true">error</span>
    <p class="gsri-error__text">{{ message ?? 'Unknown error' }}</p>
  </div>
</template>

<style scoped>
.gsri-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 8px 16px;
}

.gsri-error__icon {
  font-size: 24px;
  width: 24px;
  height: 24px;
  line-height: 24px;
  color: rgb(var(--v-theme-on-surface));
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.gsri-error__text {
  margin: 4px 0 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.5px;
  text-align: center;
  color: rgb(var(--v-theme-on-surface));
}
</style>
