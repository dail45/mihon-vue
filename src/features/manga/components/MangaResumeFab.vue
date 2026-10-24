<script setup lang="ts">
defineProps<{
  visible: boolean
  expanded: boolean
  hasReadChapters: boolean
}>()

const emit = defineEmits<{
  (event: 'click'): void
}>()
</script>

<template>
  <transition name="manga-fab">
    <button
      v-if="visible"
      type="button"
      class="manga-fab"
      :class="{ 'manga-fab--expanded': expanded }"
      :aria-label="hasReadChapters ? 'Resume' : 'Start'"
      @click="emit('click')"
    >
      <v-icon icon="play_arrow" size="24" class="manga-fab__icon" />
      <span v-if="expanded" class="manga-fab__label">{{ hasReadChapters ? 'Resume' : 'Start' }}</span>
    </button>
  </transition>
</template>

<style scoped>
/* SmallExtendedFloatingActionButton */
.manga-fab {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 15;
  display: inline-flex;
  align-items: center;
  height: 56px;
  min-width: 56px;
  padding: 0 16px;
  border-radius: 16px;
  background: rgb(var(--v-theme-primary-container));
  color: rgb(var(--v-theme-on-primary-container));
  box-shadow: 0 3px 5px -1px rgba(0, 0, 0, 0.2), 0 6px 10px 0 rgba(0, 0, 0, 0.14), 0 1px 18px 0 rgba(0, 0, 0, 0.12);
  transition: all 0.2s ease-in-out;
}

.manga-fab:not(.manga-fab--expanded) {
  padding: 0;
  justify-content: center;
}

.manga-fab__icon {
  font-variation-settings: 'FILL' 1;
}

.manga-fab__label {
  margin-inline-start: 12px;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  letter-spacing: 0.15px;
}

.manga-fab-enter-active,
.manga-fab-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.manga-fab-enter-from,
.manga-fab-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
</style>
