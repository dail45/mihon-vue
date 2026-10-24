<script setup lang="ts">
/**
 * ReaderLayout — pure black, zero chrome, immersive viewport for reading manga.
 */
</script>

<template>
  <div class="reader-layout">
    <slot />
  </div>
</template>

<style scoped>
.reader-layout {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background-color: #000000;
  color: #ffffff;
}
</style>
