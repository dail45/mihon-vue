<script setup lang="ts">
/**
 * Pixel-parity port of Mihon's `EmptyScreen`
 * (mihon/presentation-core/src/main/java/tachiyomi/presentation/core/screens/EmptyScreen.kt,
 * pinned commit 446f6df82c390ab760802c2fce3b677bce3f31c1).
 *
 * Reference:
 *   Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp),
 *          horizontalAlignment = CenterHorizontally, verticalArrangement = Center)
 *     Text(face, style = displayMedium, modifier = secondaryItemAlpha())
 *     Text(message, modifier = paddingFromBaseline(top = 24.dp).secondaryItemAlpha(),
 *          style = bodyMedium, textAlign = Center)
 *     if (actions not empty) Row(padding(top = 24.dp), spacedBy(MaterialTheme.padding.small)) { ActionButton }
 *
 * `secondaryItemAlpha()` = alpha(SECONDARY_ALPHA) = 0.78
 * (mihon/presentation-core/.../components/material/Constants.kt).
 * The face is picked at random from the reference `ErrorFaces` list.
 */
import { computed, onMounted, ref } from 'vue'

const props = defineProps<{ message: string }>()

/** ErrorFaces of the reference (EmptyScreen.kt:101-114). */
const FACES = [
  '(･o･;)',
  'Σ(ಠ_ಠ)',
  'ಥ_ಥ',
  '(˘･_･˘)',
  '(；￣Д￣)',
  '(･Д･。',
  '(╬ಠ益ಠ)',
  '(╥﹏╥)',
  '(⋟﹏⋞)',
  'Ò︵Ó',
  ' ˙ᯅ˙)',
  '(¬_¬)',
]

const face = ref(FACES[0]!)

onMounted(() => {
  face.value = FACES[Math.floor(Math.random() * FACES.length)]!
})

/** The face is always laid out left to right, like the CompositionLocalProvider in the reference. */
const faceText = computed(() => face.value)
</script>

<template>
  <section class="mihon-empty-screen">
    <p class="mihon-empty-face" aria-hidden="true">{{ faceText }}</p>
    <p class="mihon-empty-message" role="heading" aria-level="2">{{ props.message }}</p>
    <div v-if="$slots.default" class="mihon-empty-actions">
      <slot />
    </div>
  </section>
</template>

<style scoped>
@layer app-components {
/* Column: fillMaxSize, vertical scroll, horizontal padding 24dp, centered. */
.mihon-empty-screen {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100%;
  padding: 0 24px;
  overflow-y: auto;
  text-align: center;
}
/* Text(face): displayMedium (45sp / 52sp, weight 400) at secondaryItemAlpha (0.78). */
.mihon-empty-face {
  margin: 0;
  font-size: 45px;
  line-height: 52px;
  font-weight: 400;
  letter-spacing: normal;
  color: rgb(var(--v-theme-on-surface) / 0.78);
  direction: ltr;
}
/* Text(message): bodyMedium (14sp / 20sp, weight 400) at secondaryItemAlpha (0.78),
   24dp above the baseline of the first line. */
.mihon-empty-message {
  margin: 24px 0 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  letter-spacing: 0.0178571429em;
  color: rgb(var(--v-theme-on-surface) / 0.78);
}
/* Row(padding(top = 24.dp), spacedBy(MaterialTheme.padding.small = 8dp)) */
.mihon-empty-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 24px;
}
}
</style>
