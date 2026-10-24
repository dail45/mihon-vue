<script setup lang="ts">
/**
 * FullscreenLayout — zero-chrome layout for onboarding, splash, crash, and unlock screens.
 */
</script>

<template>
  <div class="fullscreen-layout">
    <slot />
  </div>
</template>

<style scoped>
.fullscreen-layout {
  width: 100vw;
  min-height: 100vh;
  margin: 0;
  padding: 0;
  background: rgb(var(--v-theme-background));
}
</style>
