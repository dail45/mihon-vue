<script setup lang="ts">
/**
 * `AnimatedContent` with a material fade-through transition, as used by HomeScreen.kt:
 *
 *   AnimatedContent(
 *     targetState = tabNavigator.current,
 *     transitionSpec = {
 *       materialFadeThroughIn(initialScale = 1f, durationMillis = TabFadeDuration)
 *         togetherWith materialFadeThroughOut(durationMillis = TabFadeDuration)
 *     },
 *     label = "tabContent",
 *   )
 *
 * `TabFadeDuration` is 200ms. The material fade-through scales the incoming content from
 * 0.92 to 1 while fading it in, and fades the outgoing content out with a slight
 * upward scale drift; both halves last 200ms.
 */
const props = defineProps<{ tabKey: string | number }>()
</script>

<template>
  <Transition name="material-fade-through" mode="out-in">
    <div :key="props.tabKey" class="material-fade-through">
      <slot />
    </div>
  </Transition>
</template>

<style scoped>
.material-fade-through { width: 100%; height: 100%; }

.material-fade-through-enter-active,
.material-fade-through-leave-active {
  transition: opacity 200ms cubic-bezier(0.2, 0, 0, 1),
    transform 200ms cubic-bezier(0.2, 0, 0, 1);
}
.material-fade-through-enter-from { opacity: 0; transform: scale(0.92); }
.material-fade-through-leave-to { opacity: 0; transform: scale(1.08); }
</style>
